import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@/generated/prisma/client';
import { requireAuth } from '@/lib/auth/guard';
import { SELECT_CONSULTA_COM_PACIENTE, paraConsultaDto } from '@/lib/agenda/consultas';
import { podeTransitar } from '@/lib/agenda/transicoes';
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

    const atualizado = await prisma.consulta.update({
      where: { id },
      data: { status: 'confirmada', confirmadaEm: new Date() },
      select: SELECT_CONSULTA_COM_PACIENTE,
    });

    return NextResponse.json(paraConsultaDto(atualizado));
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return NextResponse.json({ error: 'Consulta não encontrada' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
