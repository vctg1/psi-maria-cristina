import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { assinarSessao } from './jwt';
import { cookieSessao } from './cookie';
import { validarForcaSenha } from './senha';
import { consumirTokenEDefinirSenha, TokenInvalido } from './consumir-token';
import { respostaErroAuth } from './erros';

/** Lógica compartilhada por POST /api/auth/primeiro-acesso e
 *  POST /api/auth/redefinir-senha: valida body, consome o token e loga o usuário. */
export async function tratarConsumoDeToken(
  request: NextRequest,
  finalidade: 'primeiro_acesso' | 'redefinicao_senha'
): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { token, senha } = body ?? {};

    if (typeof token !== 'string' || !token || typeof senha !== 'string') {
      return NextResponse.json({ error: 'Dados obrigatórios não fornecidos' }, { status: 400 });
    }

    const erroForca = validarForcaSenha(senha);
    if (erroForca) {
      return NextResponse.json({ error: erroForca }, { status: 400 });
    }

    let usuarioId: string;
    try {
      usuarioId = await consumirTokenEDefinirSenha(token, senha, finalidade);
    } catch (erro) {
      if (erro instanceof TokenInvalido) {
        return NextResponse.json({ error: erro.message }, { status: 400 });
      }
      throw erro;
    }

    const usuario = await prisma.usuario.findUnique({
      where: { id: usuarioId },
      include: { paciente: { select: { id: true } } },
    });

    if (!usuario) {
      return NextResponse.json({ error: 'Link inválido, expirado ou já utilizado' }, { status: 400 });
    }

    const tokenSessao = await assinarSessao({
      sub: usuario.id,
      papel: usuario.papel,
      pacienteId: usuario.paciente?.id,
    });

    const response = NextResponse.json({
      usuario: {
        id: usuario.id,
        papel: usuario.papel,
        ...(usuario.paciente ? { pacienteId: usuario.paciente.id } : {}),
      },
    });
    response.cookies.set(cookieSessao(tokenSessao));
    return response;
  } catch (error) {
    return respostaErroAuth(error);
  }
}
