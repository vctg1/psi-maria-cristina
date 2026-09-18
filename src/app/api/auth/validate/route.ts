import { NextResponse } from 'next/server';

// Placeholder: login real (bcrypt + sessão) será implementado na Fase 2 (ver PLANO-reconstrucao.md).
export async function GET() {
  return NextResponse.json({ error: 'Não implementado' }, { status: 501 });
}
