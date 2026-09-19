import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@/generated/prisma/client';
import { requireAuth } from '@/lib/auth/guard';
import { formatoDataValido, formatoHoraValido } from '@/lib/agenda/tempo';
import { montarDataColuna } from '@/lib/agenda/disponibilidade';
import type { ExcecaoDto } from '@/types/agenda';

function paraDto(e: { id: string; data: Date; hora: string | null; motivo: string | null }): ExcecaoDto {
  return { id: e.id, data: e.data.toISOString().slice(0, 10), hora: e.hora, motivo: e.motivo };
}

// GET /api/excecoes?de=&ate= — só psicóloga.
export async function GET(request: NextRequest) {
  try {
    const r = await requireAuth(request, 'psicologa');
    if ('erro' in r) return r.erro;

    const { searchParams } = new URL(request.url);
    const de = searchParams.get('de');
    const ate = searchParams.get('ate');

    if (!formatoDataValido(de) || !formatoDataValido(ate)) {
      return NextResponse.json({ error: 'Parâmetros "de" e "ate" (YYYY-MM-DD) são obrigatórios' }, { status: 400 });
    }

    const excecoes = await prisma.excecaoDisponibilidade.findMany({
      where: { data: { gte: montarDataColuna(de), lte: montarDataColuna(ate) } },
      orderBy: [{ data: 'asc' }, { hora: 'asc' }],
    });

    return NextResponse.json(excecoes.map(paraDto));
  } catch {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

// POST /api/excecoes { data, hora?, motivo? } — só psicóloga.
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

    if (!formatoDataValido(obj.data)) {
      return NextResponse.json({ error: 'Data inválida (use YYYY-MM-DD)' }, { status: 400 });
    }

    let hora: string | null = null;
    if (obj.hora !== undefined && obj.hora !== null) {
      if (!formatoHoraValido(obj.hora)) {
        return NextResponse.json({ error: 'Hora inválida (use HH:MM)' }, { status: 400 });
      }
      hora = obj.hora;
    }

    let motivo: string | null = null;
    if (obj.motivo !== undefined && obj.motivo !== null) {
      if (typeof obj.motivo !== 'string' || obj.motivo.trim().length > 300) {
        return NextResponse.json({ error: 'Motivo inválido (máximo 300 caracteres)' }, { status: 400 });
      }
      motivo = obj.motivo.trim() || null;
    }

    // "dia inteiro" (hora null) não colide com constraint (null,null) no Postgres — checagem manual.
    if (hora === null) {
      const existente = await prisma.excecaoDisponibilidade.findFirst({
        where: { data: montarDataColuna(obj.data), hora: null },
        select: { id: true },
      });
      if (existente) {
        return NextResponse.json({ error: 'Já existe um bloqueio de dia inteiro para esta data' }, { status: 409 });
      }
    }

    const criada = await prisma.excecaoDisponibilidade.create({
      data: { data: montarDataColuna(obj.data), hora, motivo },
    });

    return NextResponse.json(paraDto(criada), { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json({ error: 'Exceção já cadastrada para esta data/horário' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
