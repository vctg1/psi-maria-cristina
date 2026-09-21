import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@/generated/prisma/client';
import { requireAuth } from '@/lib/auth/guard';
import { SELECT_CONSULTA_COM_PACIENTE, paraConsultaDto } from '@/lib/agenda/consultas';
import { obterValorPadraoSessao } from '@/lib/pagamentos/cobranca';
import { PAGAMENTO_VALOR_MAX } from '@/types/pagamento';

type Contexto = { params: Promise<{ id: string }> };

function comoObjeto(body: unknown): Record<string, unknown> {
  return body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
}

function valorValido(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v > 0 && v <= PAGAMENTO_VALOR_MAX && Math.round(v * 100) / 100 === v;
}

// PATCH /api/consultas/[id]/valor { valor: number | null } — psicóloga.
export async function PATCH(request: NextRequest, { params }: Contexto) {
  try {
    const r = await requireAuth(request, 'psicologa');
    if ('erro' in r) return r.erro;

    const { id } = await params;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
    }
    const obj = comoObjeto(body);

    if (!('valor' in obj) || (obj.valor !== null && !valorValido(obj.valor))) {
      return NextResponse.json(
        { error: 'Dados inválidos', campos: { valor: `Informe null ou um número entre 0 e ${PAGAMENTO_VALOR_MAX} (até 2 casas decimais)` } },
        { status: 400 }
      );
    }

    const existente = await prisma.consulta.findUnique({ where: { id }, select: { pagamentoId: true } });
    if (!existente) {
      return NextResponse.json({ error: 'Consulta não encontrada' }, { status: 404 });
    }
    if (existente.pagamentoId !== null) {
      return NextResponse.json({ error: 'Consulta já paga; o valor não pode ser alterado' }, { status: 409 });
    }

    const atualizado = await prisma.consulta.update({
      where: { id },
      data: { valor: obj.valor === null ? null : new Prisma.Decimal(obj.valor as number) },
      select: SELECT_CONSULTA_COM_PACIENTE,
    });

    const valorPadrao = await obterValorPadraoSessao();
    return NextResponse.json(paraConsultaDto(atualizado, valorPadrao));
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return NextResponse.json({ error: 'Consulta não encontrada' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
