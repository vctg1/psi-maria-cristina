import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@/generated/prisma/client';
import { requireAuth } from '@/lib/auth/guard';
import { SELECT_CONSULTA_COM_PACIENTE, paraConsultaDto, paraConsultaDtoPaciente } from '@/lib/agenda/consultas';
import { podeTransitar } from '@/lib/agenda/transicoes';
import type { ConsultaStatus } from '@/types';

type Contexto = { params: Promise<{ id: string }> };

function comoObjeto(body: unknown): Record<string, unknown> {
  return body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
}

// POST /api/consultas/[id]/cancelar { motivo? } — psicóloga (sempre) ou o próprio paciente
// (respeitando antecedência mínima). Consulta de outro paciente responde 404 (não 403).
export async function POST(request: NextRequest, { params }: Contexto) {
  try {
    const r = await requireAuth(request);
    if ('erro' in r) return r.erro;
    const { auth } = r;

    const { id } = await params;

    let body: unknown;
    try {
      body = request.headers.get('content-length') === '0' ? {} : await request.json();
    } catch {
      body = {};
    }
    const obj = comoObjeto(body);

    let motivoCancelamento: string | null = null;
    if (obj.motivo !== undefined && obj.motivo !== null) {
      if (typeof obj.motivo !== 'string' || obj.motivo.trim().length > 300) {
        return NextResponse.json({ error: 'Motivo inválido (máximo 300 caracteres)' }, { status: 400 });
      }
      motivoCancelamento = obj.motivo.trim() || null;
    }

    const existente = await prisma.consulta.findUnique({
      where: { id },
      select: { status: true, inicio: true, pacienteId: true },
    });
    if (!existente) {
      return NextResponse.json({ error: 'Consulta não encontrada' }, { status: 404 });
    }

    if (auth.papel === 'paciente') {
      if (!auth.pacienteId || existente.pacienteId !== auth.pacienteId) {
        return NextResponse.json({ error: 'Consulta não encontrada' }, { status: 404 });
      }
      const config = await prisma.configuracao.findUnique({ where: { id: 1 }, select: { antecedenciaCancelamentoHoras: true } });
      const antecedenciaHoras = config?.antecedenciaCancelamentoHoras ?? 24;
      const horasAteConsulta = (existente.inicio.getTime() - Date.now()) / 3600000;
      if (horasAteConsulta < antecedenciaHoras) {
        return NextResponse.json({ error: `Cancelamento permitido até ${antecedenciaHoras} horas antes` }, { status: 409 });
      }
    }

    if (!podeTransitar(existente.status as ConsultaStatus, 'cancelada')) {
      return NextResponse.json({ error: `Não é possível cancelar uma consulta com status "${existente.status}"` }, { status: 409 });
    }

    const atualizado = await prisma.consulta.update({
      where: { id },
      data: {
        status: 'cancelada',
        canceladaEm: new Date(),
        canceladaPor: auth.papel,
        motivoCancelamento,
      },
      select: SELECT_CONSULTA_COM_PACIENTE,
    });

    return NextResponse.json(auth.papel === 'paciente' ? paraConsultaDtoPaciente(atualizado) : paraConsultaDto(atualizado));
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return NextResponse.json({ error: 'Consulta não encontrada' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
