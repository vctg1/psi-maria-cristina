import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@/generated/prisma/client';
import { requireAuth } from '@/lib/auth/guard';
import { SELECT_PAGAMENTO, paraPagamentoDto } from '@/lib/pagamentos/cobranca';
import { obterAdapter, ErroConfiguracaoGateway } from '@/lib/pagamentos/gateways';

type Contexto = { params: Promise<{ id: string }> };

function comoObjeto(body: unknown): Record<string, unknown> {
  return body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
}

// POST /api/pagamentos/[id]/estornar { motivo? } — psicóloga. Só "pago". Manual: desfaz o registro.
// Online: devolve o valor total no gateway e então marca como estornado. Em ambos as consultas
// voltam a "em aberto" e podem receber nova cobrança.
export async function POST(request: NextRequest, { params }: Contexto) {
  try {
    const r = await requireAuth(request, 'psicologa');
    if ('erro' in r) return r.erro;

    const { id } = await params;

    let body: unknown;
    try {
      body = request.headers.get('content-length') === '0' ? {} : await request.json();
    } catch {
      body = {};
    }
    const obj = comoObjeto(body);

    let motivo: string | null = null;
    if (obj.motivo !== undefined && obj.motivo !== null) {
      if (typeof obj.motivo !== 'string' || obj.motivo.trim().length > 300) {
        return NextResponse.json({ error: 'Motivo inválido (máximo 300 caracteres)' }, { status: 400 });
      }
      motivo = obj.motivo.trim() || null;
    }

    const existente = await prisma.pagamento.findUnique({
      where: { id },
      select: { id: true, origem: true, status: true, observacao: true, gateway: true, pagamentoExternoId: true },
    });
    if (!existente) {
      return NextResponse.json({ error: 'Pagamento não encontrado' }, { status: 404 });
    }
    if (existente.status !== 'pago') {
      return NextResponse.json({ error: 'Pagamento não pode ser estornado' }, { status: 409 });
    }

    // Online: devolve o dinheiro no gateway ANTES de mudar o registro. Se o gateway falhar, nada
    // muda aqui — a psicóloga vê o erro e pode tentar de novo (o estorno no gateway é idempotente).
    if (existente.origem === 'online') {
      if (!existente.gateway || !existente.pagamentoExternoId) {
        return NextResponse.json({ error: 'Pagamento online sem referência no gateway' }, { status: 409 });
      }
      try {
        await obterAdapter(existente.gateway).estornarPagamento({ pagamentoExternoId: existente.pagamentoExternoId });
      } catch (erro) {
        console.error(
          erro instanceof ErroConfiguracaoGateway
            ? 'Gateway sem configuração ao estornar pagamento'
            : 'Falha ao estornar pagamento no gateway (ids omitidos do log)'
        );
        return NextResponse.json(
          { error: 'Não foi possível devolver o valor pelo gateway. Tente novamente.' },
          { status: 502 }
        );
      }
    }

    const novaObservacao = motivo
      ? `${existente.observacao ?? ''}${existente.observacao ? ' | ' : ''}Estorno: ${motivo}`
      : existente.observacao;

    const pagamento = await prisma.$transaction(async (tx) => {
      // updateMany condicional: se o webhook do estorno chegou antes e já marcou, não regrava.
      const atualizado = await tx.pagamento.updateMany({
        where: { id, status: 'pago' },
        data: { status: 'estornado', estornadoEm: new Date(), observacao: novaObservacao },
      });
      if (atualizado.count > 0) {
        await tx.consulta.updateMany({ where: { pagamentoId: id }, data: { pagamentoId: null } });
      }
      return tx.pagamento.findUniqueOrThrow({ where: { id }, select: SELECT_PAGAMENTO });
    });
    if (pagamento.status !== 'estornado') {
      return NextResponse.json({ error: 'Pagamento não pode ser estornado' }, { status: 409 });
    }

    return NextResponse.json(paraPagamentoDto(pagamento));
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return NextResponse.json({ error: 'Pagamento não encontrado' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
