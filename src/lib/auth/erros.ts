import 'server-only';
import { NextResponse } from 'next/server';

const MENSAGENS_CONFIG = new Set(['JWT_SECRET ausente ou curto', 'DATABASE_URL ausente']);

/** Trata erros de rotas de auth: erro de configuração (env ausente) vira 500 genérico
 *  sem detalhes; qualquer outro erro vira 500 interno genérico. Nunca loga dados sensíveis. */
export function respostaErroAuth(error: unknown): NextResponse {
  if (error instanceof Error && MENSAGENS_CONFIG.has(error.message)) {
    console.error('Autenticação indisponível: erro de configuração do servidor');
    return NextResponse.json({ error: 'Autenticação indisponível' }, { status: 500 });
  }
  console.error('Erro interno em rota de autenticação');
  return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
}
