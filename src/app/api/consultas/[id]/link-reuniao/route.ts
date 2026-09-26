import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@/generated/prisma/client';
import { requireAuth } from '@/lib/auth/guard';
import { SELECT_CONSULTA_COM_PACIENTE, paraConsultaDto } from '@/lib/agenda/consultas';
import { obterValorPadraoSessao } from '@/lib/pagamentos/cobranca';
import { enviarEmail } from '@/lib/email/enviar';
import { emailLinkReuniao } from '@/lib/email/templates';
import { PROVEDORES_REUNIAO } from '@/types/agenda';
import type { LinkReuniaoResposta } from '@/types/agenda';

type Contexto = { params: Promise<{ id: string }> };

function comoObjeto(body: unknown): Record<string, unknown> {
  return body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
}

const STATUS_ENCERRADOS = new Set(['cancelada', 'realizada', 'nao_compareceu']);

/** Valida e normaliza o link recebido. Retorna a URL normalizada, ou `null` para remover,
 *  ou `undefined` se o valor for inválido. */
function normalizarLink(valor: unknown): string | null | undefined {
  if (valor === null || valor === '') return null;
  if (typeof valor !== 'string') return undefined;

  const bruto = valor.trim();
  if (bruto === '') return null;
  if (bruto.length > 300) return undefined;

  let url: URL;
  try {
    url = new URL(bruto);
  } catch {
    return undefined;
  }

  if (url.protocol !== 'https:') return undefined;
  if (url.username !== '' || url.password !== '') return undefined;

  const host = url.hostname.toLowerCase();
  const permitido = PROVEDORES_REUNIAO.some((p) => host === p || host.endsWith(`.${p}`));
  if (!permitido) return undefined;

  // A normalização pode percent-codificar e crescer; a coluna é VarChar(300).
  const normalizado = url.toString();
  return normalizado.length <= 300 ? normalizado : undefined;
}

// PATCH /api/consultas/[id]/link-reuniao { link: string | null, enviarEmail?: boolean } — psicóloga.
export async function PATCH(request: NextRequest, { params }: Contexto) {
  try {
    const r = await requireAuth(request, 'psicologa');
    if ('erro' in r) return r.erro;

    const { id } = await params;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
    }
    const obj = comoObjeto(body);

    if (!('link' in obj)) {
      return NextResponse.json(
        { error: 'Dados inválidos', campos: { link: 'Use um link https do Google Meet, Zoom ou Teams' } },
        { status: 400 }
      );
    }

    const linkNormalizado = normalizarLink(obj.link);
    if (linkNormalizado === undefined) {
      return NextResponse.json(
        { error: 'Dados inválidos', campos: { link: 'Use um link https do Google Meet, Zoom ou Teams' } },
        { status: 400 }
      );
    }

    let querEnviarEmail = false;
    if (obj.enviarEmail !== undefined) {
      if (typeof obj.enviarEmail !== 'boolean') {
        return NextResponse.json({ error: 'enviarEmail deve ser booleano' }, { status: 400 });
      }
      querEnviarEmail = obj.enviarEmail;
    }

    const existente = await prisma.consulta.findUnique({
      where: { id },
      select: {
        status: true,
        inicio: true,
        paciente: { select: { nome: true, usuario: { select: { email: true } } } },
      },
    });
    if (!existente) {
      return NextResponse.json({ error: 'Consulta não encontrada' }, { status: 404 });
    }
    if (STATUS_ENCERRADOS.has(existente.status)) {
      return NextResponse.json(
        { error: 'Não é possível alterar o link de uma consulta encerrada' },
        { status: 409 }
      );
    }

    await prisma.consulta.update({ where: { id }, data: { linkReuniao: linkNormalizado } });

    // O link já está salvo: qualquer falha daqui em diante vira emailEnviado=false (a tela oferece
    // WhatsApp) em vez de 500 — senão a psicóloga veria "falhou" com o link gravado.
    let emailEnviado = false;
    if (querEnviarEmail && linkNormalizado !== null) {
      const emailPaciente = existente.paciente.usuario?.email;
      if (emailPaciente) {
        try {
          const conteudo = emailLinkReuniao({
            nome: existente.paciente.nome,
            inicio: existente.inicio,
            link: linkNormalizado,
          });
          const resultado = await enviarEmail({
            para: emailPaciente,
            assunto: conteudo.assunto,
            html: conteudo.html,
            texto: conteudo.texto,
          });
          emailEnviado = resultado.ok;
        } catch {
          emailEnviado = false;
        }
      }
    }

    const atualizado = await prisma.consulta.findUniqueOrThrow({ where: { id }, select: SELECT_CONSULTA_COM_PACIENTE });
    const valorPadrao = await obterValorPadraoSessao();

    const resposta: LinkReuniaoResposta = { consulta: paraConsultaDto(atualizado, valorPadrao), emailEnviado };
    return NextResponse.json(resposta);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return NextResponse.json({ error: 'Consulta não encontrada' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
