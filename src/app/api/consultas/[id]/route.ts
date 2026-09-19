import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@/generated/prisma/client';
import { requireAuth } from '@/lib/auth/guard';
import { formatoDataValido, formatoHoraValido, montarInicio } from '@/lib/agenda/tempo';
import { verificarLivreNaTransacao } from '@/lib/agenda/disponibilidade';
import { SELECT_CONSULTA_COM_PACIENTE, paraConsultaDto } from '@/lib/agenda/consultas';
import { CONSULTA_STATUS_OCUPA_HORARIO, type ConsultaStatus } from '@/types';
import type { Modalidade } from '@/types/agenda';

type Contexto = { params: Promise<{ id: string }> };

const MODALIDADES: Modalidade[] = ['presencial', 'online'];

function comoObjeto(body: unknown): Record<string, unknown> {
  return body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
}

// GET /api/consultas/[id] — psicóloga.
export async function GET(request: NextRequest, { params }: Contexto) {
  try {
    const r = await requireAuth(request, 'psicologa');
    if ('erro' in r) return r.erro;

    const { id } = await params;
    const consulta = await prisma.consulta.findUnique({ where: { id }, select: SELECT_CONSULTA_COM_PACIENTE });
    if (!consulta) {
      return NextResponse.json({ error: 'Consulta não encontrada' }, { status: 404 });
    }
    return NextResponse.json(paraConsultaDto(consulta));
  } catch {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

// PATCH /api/consultas/[id] { modalidade?, motivo?, observacoes?, relatorio?, data?+hora? } — psicóloga.
// Sem alteração de status aqui (ver /confirmar, /encerrar, /cancelar).
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

    const existente = await prisma.consulta.findUnique({ where: { id }, select: { status: true } });
    if (!existente) {
      return NextResponse.json({ error: 'Consulta não encontrada' }, { status: 404 });
    }

    const data: Prisma.ConsultaUpdateInput = {};

    if (obj.modalidade !== undefined) {
      if (typeof obj.modalidade !== 'string' || !MODALIDADES.includes(obj.modalidade as Modalidade)) {
        return NextResponse.json({ error: 'Modalidade inválida' }, { status: 400 });
      }
      data.modalidade = obj.modalidade as Modalidade;
    }

    if (obj.motivo !== undefined) {
      if (obj.motivo !== null && (typeof obj.motivo !== 'string' || obj.motivo.trim().length > 200)) {
        return NextResponse.json({ error: 'Motivo inválido (máximo 200 caracteres)' }, { status: 400 });
      }
      data.motivo = obj.motivo === null ? null : (obj.motivo as string).trim() || null;
    }

    if (obj.observacoes !== undefined) {
      if (obj.observacoes !== null && (typeof obj.observacoes !== 'string' || obj.observacoes.trim().length > 1000)) {
        return NextResponse.json({ error: 'Observações inválidas (máximo 1000 caracteres)' }, { status: 400 });
      }
      data.observacoes = obj.observacoes === null ? null : (obj.observacoes as string).trim() || null;
    }

    if (obj.relatorio !== undefined) {
      if (obj.relatorio !== null && (typeof obj.relatorio !== 'string' || obj.relatorio.trim().length > 5000)) {
        return NextResponse.json({ error: 'Relatório inválido (máximo 5000 caracteres)' }, { status: 400 });
      }
      data.relatorio = obj.relatorio === null ? null : (obj.relatorio as string).trim() || null;
    }

    const querReagendar = obj.data !== undefined || obj.hora !== undefined;
    let novoInicio: Date | null = null;
    if (querReagendar) {
      if (!formatoDataValido(obj.data) || !formatoHoraValido(obj.hora)) {
        return NextResponse.json({ error: 'Para reagendar, informe data (YYYY-MM-DD) e hora (HH:MM) válidas' }, { status: 400 });
      }
      if (!CONSULTA_STATUS_OCUPA_HORARIO.includes(existente.status as ConsultaStatus)) {
        return NextResponse.json({ error: 'Só é possível reagendar consultas agendadas ou confirmadas' }, { status: 400 });
      }
      novoInicio = montarInicio(obj.data, obj.hora);
    }

    const atualizado = await prisma.$transaction(
      async (tx) => {
        if (novoInicio) {
          const resultado = await verificarLivreNaTransacao(tx, novoInicio, id);
          if (resultado !== 'livre') {
            throw new ReagendamentoIndisponivel();
          }
          data.inicio = novoInicio;
        }
        return tx.consulta.update({ where: { id }, data, select: SELECT_CONSULTA_COM_PACIENTE });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 5000, timeout: 10000 }
    );

    return NextResponse.json(paraConsultaDto(atualizado));
  } catch (error) {
    if (error instanceof ReagendamentoIndisponivel) {
      return NextResponse.json({ error: 'Horário indisponível' }, { status: 409 });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && (error.code === 'P2025' || error.code === 'P2034')) {
      return NextResponse.json({ error: 'Consulta não encontrada ou horário indisponível' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

class ReagendamentoIndisponivel extends Error {}
