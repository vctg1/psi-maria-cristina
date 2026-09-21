import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@/generated/prisma/client';
import { requireAuth } from '@/lib/auth/guard';
import { SELECT_PAGAMENTO, paraPagamentoDto } from '@/lib/pagamentos/cobranca';

type Contexto = { params: Promise<{ id: string }> };

function comoObjeto(body: unknown): Record<string, unknown> {
  return body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
}

// POST /api/pagamentos/[id]/estornar { motivo? } — psicóloga. Só pagamentos manuais e "pago".
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
      select: { id: true, origem: true, status: true, observacao: true },
    });
    if (!existente) {
      return NextResponse.json({ error: 'Pagamento não encontrado' }, { status: 404 });
    }
    if (existente.origem !== 'manual' || existente.status !== 'pago') {
      return NextResponse.json({ error: 'Pagamento não pode ser estornado' }, { status: 409 });
    }

    const novaObservacao = motivo
      ? `${existente.observacao ?? ''}${existente.observacao ? ' | ' : ''}Estorno: ${motivo}`
      : existente.observacao;

    const pagamento = await prisma.$transaction(async (tx) => {
      await tx.pagamento.update({
        where: { id },
        data: { status: 'estornado', estornadoEm: new Date(), observacao: novaObservacao },
      });
      await tx.consulta.updateMany({ where: { pagamentoId: id }, data: { pagamentoId: null } });
      return tx.pagamento.findUniqueOrThrow({ where: { id }, select: SELECT_PAGAMENTO });
    });

    return NextResponse.json(paraPagamentoDto(pagamento));
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return NextResponse.json({ error: 'Pagamento não encontrado' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
