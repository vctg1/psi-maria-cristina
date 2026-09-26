import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/guard';
import { gerarTokenBruto, hashToken } from '@/lib/auth/token';
import { urlAbsoluta } from '@/lib/url-publica';
import { enviarEmail } from '@/lib/email/enviar';
import { emailPedidoConfirmacao } from '@/lib/email/templates';
import type { LinkConfirmacaoResposta } from '@/types/agenda';

type Contexto = { params: Promise<{ id: string }> };

function comoObjeto(body: unknown): Record<string, unknown> {
  return body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
}

// POST /api/consultas/[id]/link-confirmacao { enviarEmail?: boolean } — psicóloga.
// Gera um NOVO link de confirmação para o lote da consulta (invalida o token anterior e
// reaponta as consultas do lote que ainda estão `agendada`). Só para consulta `agendada`
// que tenha `confirmacaoSolicitadaEm` (foi criada pedindo confirmação ao paciente).
export async function POST(request: NextRequest, { params }: Contexto) {
  try {
    const r = await requireAuth(request, 'psicologa');
    if ('erro' in r) return r.erro;

    const { id } = await params;

    let body: unknown;
    try {
      body = request.headers.get('content-length') === '0' ? {} : await request.json();
    } catch {
      body = {};
    }
    const obj = comoObjeto(body);
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
        modalidade: true,
        confirmacaoSolicitadaEm: true,
        tokenConfirmacaoId: true,
        pacienteId: true,
        paciente: { select: { nome: true, usuario: { select: { email: true } } } },
      },
    });
    if (!existente) {
      return NextResponse.json({ error: 'Consulta não encontrada' }, { status: 404 });
    }
    if (existente.status !== 'agendada' || existente.confirmacaoSolicitadaEm === null) {
      return NextResponse.json({ error: 'Esta consulta não está aguardando confirmação do paciente' }, { status: 409 });
    }

    const tokenBruto = gerarTokenBruto();
    const tokenHash = hashToken(tokenBruto);
    const expiraEm = existente.inicio;
    const tokenAntigoId = existente.tokenConfirmacaoId;

    await prisma.$transaction(async (tx) => {
      if (tokenAntigoId) {
        await tx.tokenConfirmacao.update({ where: { id: tokenAntigoId }, data: { usadoEm: new Date() } });
      }
      const criado = await tx.tokenConfirmacao.create({
        data: { tokenHash, expiraEm },
        select: { id: true },
      });
      const where = tokenAntigoId
        ? { tokenConfirmacaoId: tokenAntigoId, status: 'agendada' as const }
        : { id };
      await tx.consulta.updateMany({ where, data: { tokenConfirmacaoId: criado.id } });
    });

    const link = urlAbsoluta(`/confirmar-consulta?token=${tokenBruto}`);

    let emailEnviado = false;
    if (querEnviarEmail) {
      const emailPaciente = existente.paciente.usuario?.email;
      if (emailPaciente) {
        const conteudo = emailPedidoConfirmacao({
          nome: existente.paciente.nome,
          inicio: existente.inicio,
          modalidade: existente.modalidade ?? 'presencial',
          link,
        });
        const resultado = await enviarEmail({
          para: emailPaciente,
          assunto: conteudo.assunto,
          html: conteudo.html,
          texto: conteudo.texto,
        });
        emailEnviado = resultado.ok;
      }
    }

    const resposta: LinkConfirmacaoResposta = { link, expiraEm: expiraEm.toISOString(), emailEnviado };
    return NextResponse.json(resposta, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
