import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { COOKIE_SESSAO, verificarSessao } from './jwt';

export type Papel = 'psicologa' | 'paciente';
export type Autenticado = { usuarioId: string; papel: Papel; pacienteId?: string };

export async function autenticar(request: NextRequest): Promise<Autenticado | null> {
  const token = request.cookies.get(COOKIE_SESSAO)?.value;
  if (!token) return null;

  const sessao = await verificarSessao(token);
  if (!sessao) return null;

  const usuario = await prisma.usuario.findUnique({
    where: { id: sessao.sub },
    select: { ativo: true, papel: true, paciente: { select: { id: true } } },
  });

  if (!usuario || !usuario.ativo) return null;

  return {
    usuarioId: sessao.sub,
    papel: usuario.papel,
    pacienteId: usuario.paciente?.id,
  };
}

export async function requireAuth(
  request: NextRequest,
  papel?: Papel
): Promise<{ auth: Autenticado } | { erro: NextResponse }> {
  const auth = await autenticar(request);

  if (!auth) {
    return { erro: NextResponse.json({ error: 'Não autenticado' }, { status: 401 }) };
  }

  if (papel && auth.papel !== papel) {
    return { erro: NextResponse.json({ error: 'Acesso negado' }, { status: 403 }) };
  }

  return { auth };
}
