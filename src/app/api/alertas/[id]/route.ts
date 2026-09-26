import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/guard';

type Contexto = { params: Promise<{ id: string }> };

function comoObjeto(body: unknown): Record<string, unknown> {
  return body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
}

// PATCH /api/alertas/[id] { tipo: 'cancelamento' | 'novo_agendamento' | 'lembrete' } — psicóloga.
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

    // Alertas baseados em Notificacao (cancelamento e, desde a Fase 6, novo_agendamento): marca como
    // lida só se o tipo bater — antes 'novo_agendamento' caía no 400 abaixo e o aviso voltava na tela.
    if (obj.tipo === 'cancelamento' || obj.tipo === 'novo_agendamento') {
      const resultado = await prisma.notificacao.updateMany({
        where: { id, tipo: obj.tipo },
        data: { lida: true },
      });
      if (resultado.count === 0) {
        return NextResponse.json({ error: 'Alerta não encontrado' }, { status: 404 });
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

    return NextResponse.json({ error: 'Tipo inválido (use "cancelamento", "novo_agendamento" ou "lembrete")' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
