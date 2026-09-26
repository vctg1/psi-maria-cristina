import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/guard';
import { gerarTokenBruto, hashToken, EXPIRACAO } from '@/lib/auth/token';
import { respostaErroAuth } from '@/lib/auth/erros';
import { urlAbsoluta } from '@/lib/url-publica';
import { enviarEmail } from '@/lib/email/enviar';
import { emailPrimeiroAcesso } from '@/lib/email/templates';

// Único uso aceito nesta rota (autenticada, gerada pela psicóloga). A finalidade
// "redefinicao_senha" foi aposentada aqui: agora é auto-serviço via POST /api/auth/esqueci-senha.
const FINALIDADE = 'primeiro_acesso' as const;

export async function POST(request: NextRequest) {
  try {
    const r = await requireAuth(request, 'psicologa');
    if ('erro' in r) return r.erro;

    const body = await request.json();
    const { usuarioId, finalidade, enviarPorEmail } = body ?? {};

    if (finalidade !== undefined && finalidade !== FINALIDADE) {
      return NextResponse.json({ error: 'Use "Esqueci minha senha" na tela de login' }, { status: 400 });
    }

    if (typeof usuarioId !== 'string' || !usuarioId) {
      return NextResponse.json({ error: 'Dados obrigatórios não fornecidos' }, { status: 400 });
    }

    const usuarioAlvo = await prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: {
        id: true,
        ativo: true,
        email: true,
        paciente: { select: { nome: true } },
      },
    });
    if (!usuarioAlvo || !usuarioAlvo.ativo) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
    }

    const tokenBruto = gerarTokenBruto();
    const tokenHash = hashToken(tokenBruto);
    const expiraEm = new Date(Date.now() + EXPIRACAO[FINALIDADE]);

    await prisma.$transaction(async (tx) => {
      await tx.tokenAcesso.updateMany({
        where: { usuarioId, finalidade: FINALIDADE, usadoEm: null },
        data: { usadoEm: new Date() },
      });

      await tx.tokenAcesso.create({
        data: { usuarioId, tokenHash, finalidade: FINALIDADE, expiraEm },
      });
    });

    const link = urlAbsoluta(`/primeiro-acesso?token=${tokenBruto}`);

    let emailEnviado = false;
    if (enviarPorEmail === true && usuarioAlvo.email) {
      const nome = usuarioAlvo.paciente?.nome ?? 'olá';
      const conteudo = emailPrimeiroAcesso({ nome, link });
      const resultado = await enviarEmail({
        para: usuarioAlvo.email,
        assunto: conteudo.assunto,
        html: conteudo.html,
        texto: conteudo.texto,
      });
      emailEnviado = resultado.ok;
    }

    return NextResponse.json({ link, expiraEm, emailEnviado }, { status: 201 });
  } catch (error) {
    return respostaErroAuth(error);
  }
}
