import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/guard';
import { gerarTokenBruto, hashToken, EXPIRACAO } from '@/lib/auth/token';
import { respostaErroAuth } from '@/lib/auth/erros';

const FINALIDADES = ['primeiro_acesso', 'redefinicao_senha'] as const;

export async function POST(request: NextRequest) {
  try {
    const r = await requireAuth(request, 'psicologa');
    if ('erro' in r) return r.erro;

    const body = await request.json();
    const { usuarioId, finalidade } = body ?? {};

    if (
      typeof usuarioId !== 'string' ||
      !usuarioId ||
      !FINALIDADES.includes(finalidade)
    ) {
      return NextResponse.json({ error: 'Dados obrigatórios não fornecidos' }, { status: 400 });
    }

    const baseUrl = process.env.NEXT_PUBLIC_URL;
    if (!baseUrl) {
      return NextResponse.json(
        { error: 'Configuração ausente: NEXT_PUBLIC_URL' },
        { status: 500 }
      );
    }

    const usuarioAlvo = await prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: { id: true, ativo: true },
    });
    if (!usuarioAlvo || !usuarioAlvo.ativo) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
    }

    const tokenBruto = gerarTokenBruto();
    const tokenHash = hashToken(tokenBruto);
    const expiraEm = new Date(Date.now() + EXPIRACAO[finalidade as 'primeiro_acesso' | 'redefinicao_senha']);

    await prisma.$transaction(async (tx) => {
      await tx.tokenAcesso.updateMany({
        where: { usuarioId, finalidade, usadoEm: null },
        data: { usadoEm: new Date() },
      });

      await tx.tokenAcesso.create({
        data: { usuarioId, tokenHash, finalidade, expiraEm },
      });
    });

    const caminho = finalidade === 'primeiro_acesso' ? 'primeiro-acesso' : 'redefinir-senha';
    const link = `${baseUrl}/${caminho}?token=${tokenBruto}`;

    return NextResponse.json({ link, expiraEm }, { status: 201 });
  } catch (error) {
    return respostaErroAuth(error);
  }
}
