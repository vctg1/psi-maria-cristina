import { NextResponse } from 'next/server';
import { cookieLimparSessao } from '@/lib/auth/cookie';
import { respostaErroAuth } from '@/lib/auth/erros';

export async function POST() {
  try {
    const response = NextResponse.json({ success: true });
    response.cookies.set(cookieLimparSessao());
    return response;
  } catch (error) {
    return respostaErroAuth(error);
  }
}
