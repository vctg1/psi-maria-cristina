import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { assinarSessao } from '@/lib/auth/jwt';
import { cookieSessao } from '@/lib/auth/cookie';
import { compararSenha, HASH_DUMMY } from '@/lib/auth/senha';
import { respostaErroAuth } from '@/lib/auth/erros';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, senha } = body ?? {};

    if (typeof email !== 'string' || typeof senha !== 'string' || !email.trim() || !senha) {
      return NextResponse.json({ error: 'Email e senha são obrigatórios' }, { status: 400 });
    }

    const emailNormalizado = email.trim().toLowerCase();

    const usuario = await prisma.usuario.findUnique({
      where: { email: emailNormalizado },
      include: { paciente: { select: { id: true } } },
    });

    if (!usuario || !usuario.ativo) {
      await compararSenha(senha, HASH_DUMMY);
      return NextResponse.json({ error: 'Credenciais inválidas' }, { status: 401 });
    }

    if (usuario.senhaHash === null) {
      return NextResponse.json(
        { error: 'Defina sua senha pelo link de primeiro acesso' },
        { status: 403 }
      );
    }

    const senhaCorreta = await compararSenha(senha, usuario.senhaHash);
    if (!senhaCorreta) {
      return NextResponse.json({ error: 'Credenciais inválidas' }, { status: 401 });
    }

    const token = await assinarSessao({
      sub: usuario.id,
      papel: usuario.papel,
      pacienteId: usuario.paciente?.id,
    });

    await prisma.usuario.update({
      where: { id: usuario.id },
      data: { ultimoLoginEm: new Date() },
    });

    const response = NextResponse.json({
      usuario: {
        id: usuario.id,
        papel: usuario.papel,
        ...(usuario.paciente ? { pacienteId: usuario.paciente.id } : {}),
      },
    });
    response.cookies.set(cookieSessao(token));
    return response;
  } catch (error) {
    return respostaErroAuth(error);
  }
}
