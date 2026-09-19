import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/guard';
import { listarAlertas } from '@/lib/agenda/alertas';

// GET /api/alertas — psicóloga. Lembretes de véspera (derivados) + cancelamentos não lidos.
export async function GET(request: NextRequest) {
  try {
    const r = await requireAuth(request, 'psicologa');
    if ('erro' in r) return r.erro;

    const resposta = await listarAlertas();
    return NextResponse.json(resposta);
  } catch {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
