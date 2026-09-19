import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@/generated/prisma/client';
import { requireAuth } from '@/lib/auth/guard';

type Contexto = { params: Promise<{ id: string }> };

function comoObjeto(body: unknown): Record<string, unknown> {
  return body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
}

// PATCH /api/alertas/[id] { tipo: 'cancelamento' | 'lembrete' } — psicóloga.
// 'cancelamento': marca a Notificacao como lida. 'lembrete': marca lembreteEnviadoEm na Consulta.
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

    if (obj.tipo === 'cancelamento') {
      try {
        await prisma.notificacao.update({ where: { id }, data: { lida: true } });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
          return NextResponse.json({ error: 'Alerta não encontrado' }, { status: 404 });
        }
        throw error;
      }
      return new NextResponse(null, { status: 204 });
    }

    if (obj.tipo === 'lembrete') {
      const resultado = await prisma.consulta.updateMany({
        where: { id, status: 'confirmada' },
        data: { lembreteEnviadoEm: new Date() },
      });
      if (resultado.count === 0) {
        return NextResponse.json({ error: 'Alerta não encontrado' }, { status: 404 });
      }
      return new NextResponse(null, { status: 204 });
    }

    return NextResponse.json({ error: 'Tipo inválido (use "cancelamento" ou "lembrete")' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
