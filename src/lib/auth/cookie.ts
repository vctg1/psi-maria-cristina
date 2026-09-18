import 'server-only';
import { COOKIE_SESSAO, DURACAO_S } from './jwt';

export function cookieSessao(token: string) {
  return {
    name: COOKIE_SESSAO,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: DURACAO_S,
  };
}

export function cookieLimparSessao() {
  return {
    name: COOKIE_SESSAO,
    value: '',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 0,
  };
}
