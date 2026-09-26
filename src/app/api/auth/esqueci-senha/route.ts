import { NextRequest, NextResponse } from 'next/server';
import { after } from 'next/server';
import { prisma } from '@/lib/prisma';
import { gerarTokenBruto, hashToken, EXPIRACAO } from '@/lib/auth/token';
import { urlAbsoluta } from '@/lib/url-publica';
import { enviarEmail } from '@/lib/email/enviar';
import { emailRedefinicaoSenha } from '@/lib/email/templates';
import { consumirLimite, chaveHash, chaveIp } from '@/lib/limite-taxa';
import type { EsqueciSenhaEntrada, EsqueciSenhaResposta } from '@/types/perfil';

const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const RESPOSTA_PADRAO: EsqueciSenhaResposta = {
  ok: true,
  mensagem: 'Se este e-mail estiver cadastrado, enviaremos um link para redefinir a senha.',
};

const LIMITE_EMAIL = { max: 3, janelaMs: 60 * 60 * 1000 };
const LIMITE_IP = { max: 10, janelaMs: 60 * 60 * 1000 };

/** Faz a lookup do usuário, invalida tokens de redefinição abertos e envia o e-mail com o
 *  novo link. Roda em `after()`, ou seja, DEPOIS que a resposta HTTP já foi enviada ao
 *  cliente — assim o tempo de resposta nunca varia entre "e-mail existe" e "e-mail não
 *  existe" (anti-enumeração por timing), já que nada aqui pode atrasar o response. */
async function processarRecuperacao(emailNormalizado: string): Promise<void> {
  try {
    const usuario = await prisma.usuario.findUnique({
      where: { email: emailNormalizado },
      select: {
        id: true,
        email: true,
        ativo: true,
        paciente: { select: { nome: true } },
        perfilPsicologa: { select: { nome: true } },
      },
    });

    if (!usuario || !usuario.ativo) return;

    const tokenBruto = gerarTokenBruto();
    const tokenHash = hashToken(tokenBruto);
    const expiraEm = new Date(Date.now() + EXPIRACAO.redefinicao_senha);

    await prisma.$transaction(async (tx) => {
      await tx.tokenAcesso.updateMany({
        where: { usuarioId: usuario.id, finalidade: 'redefinicao_senha', usadoEm: null },
        data: { usadoEm: new Date() },
      });

      await tx.tokenAcesso.create({
        data: { usuarioId: usuario.id, tokenHash, finalidade: 'redefinicao_senha', expiraEm },
      });
    });

    const link = urlAbsoluta(`/redefinir-senha?token=${tokenBruto}`);
    const nome = usuario.paciente?.nome ?? usuario.perfilPsicologa?.nome ?? 'olá';

    const conteudo = emailRedefinicaoSenha({ nome, link, validadeMinutos: 60 });
    await enviarEmail({
      para: usuario.email,
      assunto: conteudo.assunto,
      html: conteudo.html,
      texto: conteudo.texto,
    });
  } catch {
    // Nenhum e-mail, token ou id em log — só um sinal genérico de falha.
    console.error('Falha na recuperação de senha');
  }
}

// POST /api/auth/esqueci-senha — pública. Resposta é SEMPRE idêntica (200 com a mesma
// mensagem), exista ou não o e-mail, esteja a conta ativa ou não, e mesmo quando o limite
// de taxa estourar (nesse caso simplesmente não processamos nada em `after`). A única
// exceção é JSON inválido / e-mail malformado, que não depende do banco.
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const obj = body && typeof body === 'object' ? (body as Partial<EsqueciSenhaEntrada>) : {};
  const email = obj.email;

  if (typeof email !== 'string' || !REGEX_EMAIL.test(email.trim())) {
    return NextResponse.json({ error: 'E-mail inválido' }, { status: 400 });
  }

  const emailNormalizado = email.trim().toLowerCase();

  const [limiteEmail, limiteIp] = await Promise.all([
    consumirLimite(chaveHash('recuperacao:email', emailNormalizado), LIMITE_EMAIL),
    consumirLimite(chaveIp('recuperacao', request), LIMITE_IP),
  ]);

  if (limiteEmail.permitido && limiteIp.permitido) {
    after(() => processarRecuperacao(emailNormalizado));
  }

  return NextResponse.json(RESPOSTA_PADRAO, { status: 200 });
}
