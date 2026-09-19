import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/guard';
import { SELECT_CONSULTA_COM_PACIENTE, paraConsultaDtoPaciente } from '@/lib/agenda/consultas';
import { CONSULTA_STATUS_OCUPA_HORARIO } from '@/types';

const LIMITE_HISTORICO = 100;

// GET /api/paciente/me/consultas — próximas e histórico do paciente logado.
export async function GET(request: NextRequest) {
  try {
    const r = await requireAuth(request, 'paciente');
    if ('erro' in r) return r.erro;
    const { auth } = r;

    if (!auth.pacienteId) {
      return NextResponse.json({ error: 'Paciente não encontrado' }, { status: 404 });
    }

    const agora = new Date();

    const [proximasRaw, historicoRaw, config] = await Promise.all([
      prisma.consulta.findMany({
        where: {
          pacienteId: auth.pacienteId,
          inicio: { gte: agora },
          status: { in: [...CONSULTA_STATUS_OCUPA_HORARIO] },
        },
        select: SELECT_CONSULTA_COM_PACIENTE,
        orderBy: { inicio: 'asc' },
      }),
      prisma.consulta.findMany({
        where: {
          pacienteId: auth.pacienteId,
          OR: [{ inicio: { lt: agora } }, { status: { notIn: [...CONSULTA_STATUS_OCUPA_HORARIO] } }],
        },
        select: SELECT_CONSULTA_COM_PACIENTE,
        orderBy: { inicio: 'desc' },
        take: LIMITE_HISTORICO,
      }),
      prisma.configuracao.findUnique({ where: { id: 1 }, select: { antecedenciaCancelamentoHoras: true } }),
    ]);

    return NextResponse.json({
      proximas: proximasRaw.map(paraConsultaDtoPaciente),
      historico: historicoRaw.map(paraConsultaDtoPaciente),
      antecedenciaCancelamentoHoras: config?.antecedenciaCancelamentoHoras ?? 24,
    });
  } catch {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
