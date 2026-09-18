import { NextRequest } from 'next/server';
import { tratarConsumoDeToken } from '@/lib/auth/rotas-token';

export async function POST(request: NextRequest) {
  return tratarConsumoDeToken(request, 'redefinicao_senha');
}
