import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@/generated/prisma/client';
import { requireAuth } from '@/lib/auth/guard';
import type { HorarioAtendimentoDto, DiaSemana } from '@/types/agenda';

type Contexto = { params: Promise<{ id: string }> };

function paraDto(h: { id: string; diaSemana: string; hora: string; ativo: boolean }): HorarioAtendimentoDto {
  return { id: h.id, diaSemana: h.diaSemana as DiaSemana, hora: h.hora, ativo: h.ativo };
}

// PATCH /api/horarios/[id] { ativo } — só psicóloga.
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
    const obj = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
    if (typeof obj.ativo !== 'boolean') {
      return NextResponse.json({ error: 'Campo "ativo" (booleano) é obrigatório' }, { status: 400 });
    }

    const atualizado = await prisma.horarioAtendimento.update({
      where: { id },
      data: { ativo: obj.ativo },
    });

    return NextResponse.json(paraDto(atualizado));
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return NextResponse.json({ error: 'Horário não encontrado' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

// DELETE /api/horarios/[id] — só psicóloga. Hard delete; consultas já criadas não dependem dele.
export async function DELETE(request: NextRequest, { params }: Contexto) {
  try {
    const r = await requireAuth(request, 'psicologa');
    if ('erro' in r) return r.erro;

    const { id } = await params;

    await prisma.horarioAtendimento.delete({ where: { id } });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return NextResponse.json({ error: 'Horário não encontrado' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
