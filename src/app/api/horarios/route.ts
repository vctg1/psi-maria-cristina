import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@/generated/prisma/client';
import { requireAuth } from '@/lib/auth/guard';
import { formatoHoraValido } from '@/lib/agenda/tempo';
import type { HorarioAtendimentoDto, DiaSemana } from '@/types/agenda';

const DIAS_VALIDOS: DiaSemana[] = ['segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado', 'domingo'];

function paraDto(h: { id: string; diaSemana: string; hora: string; ativo: boolean }): HorarioAtendimentoDto {
  return { id: h.id, diaSemana: h.diaSemana as DiaSemana, hora: h.hora, ativo: h.ativo };
}

// GET /api/horarios — todos os horários cadastrados (inclusive inativos), só psicóloga.
export async function GET(request: NextRequest) {
  try {
    const r = await requireAuth(request, 'psicologa');
    if ('erro' in r) return r.erro;

    const horarios = await prisma.horarioAtendimento.findMany({
      orderBy: [{ diaSemana: 'asc' }, { hora: 'asc' }],
    });

    return NextResponse.json(horarios.map(paraDto));
  } catch {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

// POST /api/horarios { diaSemana, hora } — só psicóloga.
export async function POST(request: NextRequest) {
  try {
    const r = await requireAuth(request, 'psicologa');
    if ('erro' in r) return r.erro;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
    }

    const obj = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
    const diaSemana = obj.diaSemana;
    const hora = obj.hora;

    if (typeof diaSemana !== 'string' || !DIAS_VALIDOS.includes(diaSemana as DiaSemana)) {
      return NextResponse.json({ error: 'Dia da semana inválido' }, { status: 400 });
    }
    if (!formatoHoraValido(hora)) {
      return NextResponse.json({ error: 'Hora inválida (use HH:MM)' }, { status: 400 });
    }

    const criado = await prisma.horarioAtendimento.create({
      data: { diaSemana: diaSemana as DiaSemana, hora },
    });

    return NextResponse.json(paraDto(criado), { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json({ error: 'Horário já cadastrado' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
