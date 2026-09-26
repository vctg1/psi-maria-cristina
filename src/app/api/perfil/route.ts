import { NextRequest, NextResponse, after } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@/generated/prisma/client';
import { requireAuth } from '@/lib/auth/guard';
import { respostaErroAuth } from '@/lib/auth/erros';
import { compararSenha } from '@/lib/auth/senha';
import { consumirLimite, chaveHash } from '@/lib/limite-taxa';
import { enviarEmail } from '@/lib/email/enviar';
import { emailAlteracaoEmailAcesso } from '@/lib/email/templates';
import type { PerfilPsicologaDto } from '@/types/perfil';

function comoObjeto(body: unknown): Record<string, unknown> {
  return body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
}

function validarNome(v: unknown): { valor?: string; erro?: string } {
  if (typeof v !== 'string') return { erro: 'Nome é obrigatório' };
  const nome = v.trim();
  if (nome.length < 2 || nome.length > 120) {
    return { erro: 'Nome deve ter entre 2 e 120 caracteres' };
  }
  return { valor: nome };
}

function validarTelefone(v: unknown): { valor?: string | null; erro?: string } {
  if (v === null) return { valor: null };
  if (typeof v !== 'string') return { erro: 'Telefone inválido' };
  const digitos = v.replace(/\D/g, '');
  if (digitos.length < 10 || digitos.length > 13) {
    return { erro: 'Telefone deve ter entre 10 e 13 dígitos' };
  }
  return { valor: digitos };
}

function validarCrp(v: unknown): { valor?: string | null; erro?: string } {
  if (v === null) return { valor: null };
  if (typeof v !== 'string') return { erro: 'CRP inválido' };
  const crp = v.trim();
  if (crp.length === 0) return { valor: null };
  if (crp.length > 20) return { erro: 'CRP deve ter no máximo 20 caracteres' };
  return { valor: crp };
}

const REGEX_EMAIL_SIMPLES = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;

function validarEmailRespostas(v: unknown): { valor?: string | null; erro?: string } {
  if (v === null) return { valor: null };
  if (typeof v !== 'string') return { erro: 'E-mail de respostas inválido' };
  const email = v.trim().toLowerCase();
  if (email.length === 0) return { valor: null };
  if (email.length > 254 || !REGEX_EMAIL_SIMPLES.test(email)) {
    return { erro: 'E-mail de respostas inválido' };
  }
  return { valor: email };
}

// E-mail de LOGIN (Usuario.email). Formato apenas — unicidade é checada à parte (consulta o
// banco e a transação cobre a corrida com P2002).
function validarEmailLogin(v: unknown): { valor?: string; erro?: string } {
  if (typeof v !== 'string') return { erro: 'E-mail inválido' };
  const email = v.trim().toLowerCase();
  if (email.length === 0 || email.length > 254 || !REGEX_EMAIL_SIMPLES.test(email)) {
    return { erro: 'E-mail inválido' };
  }
  return { valor: email };
}

/** "maria@gmail.com" -> "ma***@gmail.com". Nunca expõe o e-mail completo em e-mails/logs. */
function mascararEmail(email: string): string {
  const arroba = email.indexOf('@');
  if (arroba <= 0) return '***';
  const local = email.slice(0, arroba);
  const dominio = email.slice(arroba + 1);
  // Mostra no máximo 2 caracteres e sempre esconde pelo menos 1 ("ab@x.com" -> "a***@x.com").
  const visiveis = local.slice(0, Math.max(0, Math.min(2, local.length - 1)));
  return `${visiveis}***@${dominio}`;
}

/** Avisa o ENDEREÇO ANTIGO que o e-mail de login foi trocado. Nunca lança, nunca loga endereços. */
async function enviarAvisoAlteracaoEmailAcesso(params: {
  nome: string;
  emailAntigo: string;
  emailNovoMascarado: string;
}): Promise<void> {
  try {
    const conteudo = emailAlteracaoEmailAcesso({
      nome: params.nome,
      emailNovoMascarado: params.emailNovoMascarado,
    });
    await enviarEmail({
      para: params.emailAntigo,
      assunto: conteudo.assunto,
      html: conteudo.html,
      texto: conteudo.texto,
    });
  } catch (erro) {
    console.error('[perfil] falha ao enviar aviso de alteração de e-mail', erro instanceof Error ? erro.message : erro);
  }
}

// GET /api/perfil — dados de apresentação da psicóloga logada.
export async function GET(request: NextRequest) {
  try {
    const r = await requireAuth(request, 'psicologa');
    if ('erro' in r) return r.erro;
    const { auth } = r;

    const usuario = await prisma.usuario.findUnique({
      where: { id: auth.usuarioId },
      select: {
        email: true,
        perfilPsicologa: { select: { nome: true, telefone: true, crp: true, emailRespostas: true } },
      },
    });

    if (!usuario) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const dto: PerfilPsicologaDto = {
      nome: usuario.perfilPsicologa?.nome ?? '',
      email: usuario.email,
      telefone: usuario.perfilPsicologa?.telefone ?? null,
      crp: usuario.perfilPsicologa?.crp ?? null,
      emailRespostas: usuario.perfilPsicologa?.emailRespostas ?? null,
    };

    return NextResponse.json(dto);
  } catch (error) {
    return respostaErroAuth(error);
  }
}

// PATCH /api/perfil — edição do próprio cadastro da psicóloga logada. Whitelist estrita: papel e
// id nunca são editáveis aqui. `email` (login) é editável, mas exige `senhaAtual` quando muda de
// fato — mesma trava usada em /api/paciente/me e /api/auth/senha. `data` do Prisma é montado
// campo a campo, nunca spread do body.
export async function PATCH(request: NextRequest) {
  try {
    const r = await requireAuth(request, 'psicologa');
    if ('erro' in r) return r.erro;
    const { auth } = r;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
    }

    const obj = comoObjeto(body);
    const campos: Record<string, string> = {};

    const dados: {
      nome?: string;
      telefone?: string | null;
      crp?: string | null;
      emailRespostas?: string | null;
      email?: string;
    } = {};
    let algumCampoValido = false;

    if (obj.nome !== undefined) {
      const nome = validarNome(obj.nome);
      if (nome.erro) campos.nome = nome.erro;
      else {
        dados.nome = nome.valor;
        algumCampoValido = true;
      }
    }

    if (obj.telefone !== undefined) {
      const telefone = validarTelefone(obj.telefone);
      if (telefone.erro) campos.telefone = telefone.erro;
      else {
        dados.telefone = telefone.valor ?? null;
        algumCampoValido = true;
      }
    }

    if (obj.crp !== undefined) {
      const crp = validarCrp(obj.crp);
      if (crp.erro) campos.crp = crp.erro;
      else {
        dados.crp = crp.valor ?? null;
        algumCampoValido = true;
      }
    }

    if (obj.emailRespostas !== undefined) {
      const emailRespostas = validarEmailRespostas(obj.emailRespostas);
      if (emailRespostas.erro) campos.emailRespostas = emailRespostas.erro;
      else {
        dados.emailRespostas = emailRespostas.valor ?? null;
        algumCampoValido = true;
      }
    }

    if (obj.email !== undefined) {
      const email = validarEmailLogin(obj.email);
      if (email.erro) campos.email = email.erro;
      else dados.email = email.valor;
    }

    if (Object.keys(campos).length > 0) {
      return NextResponse.json({ error: 'Dados inválidos', campos }, { status: 400 });
    }

    // Troca de e-mail de login: exige senha atual e é resolvida à parte (consulta o banco,
    // nunca vai para `dados`/`data` como texto puro — só o e-mail novo, já validado, segue adiante).
    let emailLoginNovo: string | undefined;
    let emailLoginAntigo: string | undefined;
    if (dados.email !== undefined) {
      const usuarioAtual = await prisma.usuario.findUnique({
        where: { id: auth.usuarioId },
        select: { email: true, senhaHash: true },
      });
      if (!usuarioAtual) {
        return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
      }

      const emailAtualNormalizado = usuarioAtual.email.trim().toLowerCase();
      if (dados.email !== emailAtualNormalizado) {
        const senhaAtual = obj.senhaAtual;
        if (typeof senhaAtual !== 'string' || senhaAtual === '') {
          return NextResponse.json(
            { error: 'Dados inválidos', campos: { senhaAtual: 'Informe a senha atual para alterar o e-mail' } },
            { status: 400 },
          );
        }

        if (usuarioAtual.senhaHash === null) {
          return NextResponse.json(
            { error: 'Dados inválidos', campos: { senhaAtual: 'Cadastro sem senha definida' } },
            { status: 400 },
          );
        }

        // Com um cookie roubado, sem este limite dava para testar senhas à vontade (A1).
        const limite = await consumirLimite(chaveHash('perfil:senha', auth.usuarioId), { max: 5, janelaMs: 15 * 60 * 1000 });
        if (!limite.permitido) {
          return NextResponse.json(
            { error: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.' },
            { status: 429 },
          );
        }

        const senhaConfere = await compararSenha(senhaAtual, usuarioAtual.senhaHash);
        if (!senhaConfere) {
          return NextResponse.json(
            { error: 'Senha atual incorreta', campos: { senhaAtual: 'Senha atual incorreta' } },
            { status: 400 },
          );
        }

        const emailEmUso = await prisma.usuario.findUnique({
          where: { email: dados.email },
          select: { id: true },
        });
        if (emailEmUso && emailEmUso.id !== auth.usuarioId) {
          return NextResponse.json(
            { error: 'Este e-mail já está em uso por outra conta', campos: { email: 'Este e-mail já está em uso por outra conta' } },
            { status: 409 },
          );
        }

        emailLoginNovo = dados.email;
        emailLoginAntigo = usuarioAtual.email;
        algumCampoValido = true;
      }
      // Se igual ao atual (após normalização), não é uma alteração real: ignora sem exigir senha.
    }

    if (!algumCampoValido) {
      return NextResponse.json({ error: 'Dados inválidos', campos: { _: 'Nenhum campo válido informado' } }, { status: 400 });
    }

    const existente = await prisma.perfilPsicologa.findUnique({
      where: { usuarioId: auth.usuarioId },
      select: { nome: true },
    });

    const [perfil] = await prisma.$transaction([
      prisma.perfilPsicologa.upsert({
        where: { usuarioId: auth.usuarioId },
        create: {
          usuarioId: auth.usuarioId,
          nome: dados.nome ?? existente?.nome ?? '',
          telefone: dados.telefone ?? null,
          crp: dados.crp ?? null,
          emailRespostas: dados.emailRespostas ?? null,
        },
        update: {
          ...(dados.nome !== undefined ? { nome: dados.nome } : {}),
          ...(dados.telefone !== undefined ? { telefone: dados.telefone } : {}),
          ...(dados.crp !== undefined ? { crp: dados.crp } : {}),
          ...(dados.emailRespostas !== undefined ? { emailRespostas: dados.emailRespostas } : {}),
        },
        select: { nome: true, telefone: true, crp: true, emailRespostas: true },
      }),
      ...(emailLoginNovo !== undefined
        ? [prisma.usuario.update({ where: { id: auth.usuarioId }, data: { email: emailLoginNovo } })]
        : []),
    ]);

    const usuario = await prisma.usuario.findUnique({
      where: { id: auth.usuarioId },
      select: { email: true },
    });

    if (emailLoginNovo !== undefined && emailLoginAntigo !== undefined) {
      const nomeParaEmail = perfil.nome || 'Psicóloga';
      const emailNovoMascarado = mascararEmail(emailLoginNovo);
      after(() =>
        enviarAvisoAlteracaoEmailAcesso({
          nome: nomeParaEmail,
          emailAntigo: emailLoginAntigo as string,
          emailNovoMascarado,
        }),
      );
    }

    const dto: PerfilPsicologaDto = {
      nome: perfil.nome,
      email: usuario?.email ?? '',
      telefone: perfil.telefone,
      crp: perfil.crp,
      emailRespostas: perfil.emailRespostas,
    };

    return NextResponse.json(dto);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const t = error.meta?.target;
      const alvo: string[] = Array.isArray(t) ? t.map(String) : typeof t === 'string' ? [t] : [];
      if (alvo.some((campo) => campo.includes('email'))) {
        return NextResponse.json(
          { error: 'Este e-mail já está em uso por outra conta', campos: { email: 'Este e-mail já está em uso por outra conta' } },
          { status: 409 },
        );
      }
      return NextResponse.json({ error: 'Dado já cadastrado' }, { status: 409 });
    }
    return respostaErroAuth(error);
  }
}
