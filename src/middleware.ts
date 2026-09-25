import { NextRequest, NextResponse } from 'next/server';
import { COOKIE_SESSAO, verificarSessao } from '@/lib/auth/jwt';

export const config = {
  matcher: ['/area-restrita/:path*', '/area-paciente/:path*'],
};

// Roda no Edge Runtime: só jose (via verificarSessao), sem Prisma/bcrypt. Garante apenas que
// existe uma sessão assinada válida; a checagem de papel (psicologa/paciente) fica nas
// páginas/APIs.
export async function middleware(request: NextRequest) {
  const token = request.cookies.get(COOKIE_SESSAO)?.value;
  const sessao = token ? await verificarSessao(token) : null;

  if (!sessao) {
    const loginUrl = new URL('/login', process.env.NEXT_PUBLIC_URL || request.url);
    loginUrl.searchParams.set('next', request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}
