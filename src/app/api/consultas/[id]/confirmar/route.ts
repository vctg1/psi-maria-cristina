import { NextRequest, NextResponse, after } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@/generated/prisma/client';
import { requireAuth } from '@/lib/auth/guard';
import { SELECT_CONSULTA_COM_PACIENTE, paraConsultaDto } from '@/lib/agenda/consultas';
import { podeTransitar } from '@/lib/agenda/transicoes';
import { obterValorPadraoSessao } from '@/lib/pagamentos/cobranca';
import { enviarConfirmacaoAoPaciente } from '@/lib/agenda/avisos';
import type { ConsultaStatus } from '@/types';

type Contexto = { params: Promise<{ id: string }> };

// POST /api/consultas/[id]/confirmar — psicóloga.
export async function POST(request: NextRequest, { params }: Contexto) {
  try {
    const r = await requireAuth(request, 'psicologa');
    if ('erro' in r) return r.erro;

    const { id } = await params;

    const existente = await prisma.consulta.findUnique({ where: { id }, select: { status: true } });
    if (!existente) {
      return NextResponse.json({ error: 'Consulta não encontrada' }, { status: 404 });
    }
    if (!podeTransitar(existente.status as ConsultaStatus, 'confirmada')) {
      return NextResponse.json({ error: `Não é possível confirmar uma consulta com status "${existente.status}"` }, { status: 409 });
    }

    const { count } = await prisma.consulta.updateMany({
      where: { id, status: 'agendada' },
      data: { status: 'confirmada', confirmadaEm: new Date() },
    });
    if (count === 0) {
      return NextResponse.json({ error: `Não é possível confirmar uma consulta com status "${existente.status}"` }, { status: 409 });
    }

    const atualizado = await prisma.consulta.findUniqueOrThrow({ where: { id }, select: SELECT_CONSULTA_COM_PACIENTE });

    after(() => enviarConfirmacaoAoPaciente(id));

    const valorPadrao = await obterValorPadraoSessao();
    return NextResponse.json(paraConsultaDto(atualizado, valorPadrao));
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return NextResponse.json({ error: 'Consulta não encontrada' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
