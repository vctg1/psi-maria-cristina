import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@/generated/prisma/client';
import { requireAuth } from '@/lib/auth/guard';
import { SELECT_CONSULTA_COM_PACIENTE, paraConsultaDto } from '@/lib/agenda/consultas';
import { podeTransitar } from '@/lib/agenda/transicoes';
import type { ConsultaStatus } from '@/types';

type Contexto = { params: Promise<{ id: string }> };
const STATUS_ENCERRAMENTO: ConsultaStatus[] = ['realizada', 'nao_compareceu'];

// POST /api/consultas/[id]/encerrar { status: 'realizada'|'nao_compareceu' } — psicóloga.
export async function POST(request: NextRequest, { params }: Contexto) {
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
    const obj = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
    const status = obj.status;
    if (typeof status !== 'string' || !STATUS_ENCERRAMENTO.includes(status as ConsultaStatus)) {
      return NextResponse.json({ error: 'Status deve ser "realizada" ou "nao_compareceu"' }, { status: 400 });
    }

    const existente = await prisma.consulta.findUnique({ where: { id }, select: { status: true, inicio: true } });
    if (!existente) {
      return NextResponse.json({ error: 'Consulta não encontrada' }, { status: 404 });
    }
    if (!podeTransitar(existente.status as ConsultaStatus, status as ConsultaStatus)) {
      return NextResponse.json({ error: `Não é possível marcar "${status}" a partir de "${existente.status}"` }, { status: 409 });
    }
    if (existente.inicio.getTime() > Date.now()) {
      return NextResponse.json({ error: 'A consulta ainda não ocorreu' }, { status: 400 });
    }

    const atualizado = await prisma.consulta.update({
      where: { id },
      data: { status: status as ConsultaStatus, encerradaEm: new Date() },
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
