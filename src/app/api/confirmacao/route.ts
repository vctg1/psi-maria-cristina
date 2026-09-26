import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@/generated/prisma/client';
import { hashToken } from '@/lib/auth/token';
import { consumirLimite, chaveIp } from '@/lib/limite-taxa';
import { enviarConfirmacaoAoPaciente } from '@/lib/agenda/avisos';
import type { ConfirmacaoPublicaDto, Modalidade } from '@/types/agenda';

export const dynamic = 'force-dynamic';

const ERRO_GENERICO = { error: 'Link inválido ou expirado' } as const;

function comoObjeto(body: unknown): Record<string, unknown> {
  return body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
}

/** Busca o token pelo hash e monta o DTO público. Nunca chamado com token desconhecido sem
 *  antes o caller ter validado a existência (ver GET/POST abaixo) — mas também não assume
 *  nada: retorna null se não achar nada renderizável. */
async function montarDto(tokenId: string, estadoForcado?: 'confirmada'): Promise<ConfirmacaoPublicaDto | null> {
  const consultas = await prisma.consulta.findMany({
    where: { tokenConfirmacaoId: tokenId },
    select: {
      id: true,
      inicio: true,
      modalidade: true,
      status: true,
      paciente: { select: { nome: true } },
    },
    orderBy: { inicio: 'asc' },
  });
  if (consultas.length === 0) return null;

  const primeiroNome = consultas[0].paciente.nome.trim().split(/\s+/)[0] || 'Paciente';
  const estado: ConfirmacaoPublicaDto['estado'] =
    estadoForcado ?? (consultas.every((c) => c.status === 'confirmada') ? 'ja_confirmada' : 'pendente');

  return {
    estado,
    primeiroNome,
    consultas: consultas.map((c) => ({
      id: c.id,
      inicio: c.inicio.toISOString(),
      modalidade: c.modalidade as Modalidade | null,
    })),
  };
}

// GET /api/confirmacao?token=... — pública, sem login. Não altera nada.
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');
    if (!token) {
      return NextResponse.json(ERRO_GENERICO, { status: 404 });
    }

    const limite = await consumirLimite(chaveIp('confirmacao', request), { max: 30, janelaMs: 3600000 });
    if (!limite.permitido) {
      return NextResponse.json(ERRO_GENERICO, { status: 429 });
    }

    const registro = await prisma.tokenConfirmacao.findUnique({
      where: { tokenHash: hashToken(token) },
      select: { id: true, usadoEm: true, expiraEm: true },
    });
    if (!registro) {
      return NextResponse.json(ERRO_GENERICO, { status: 404 });
    }

    const expirado = registro.expiraEm.getTime() <= Date.now();
    if (expirado && !registro.usadoEm) {
      return NextResponse.json(ERRO_GENERICO, { status: 404 });
    }

    const dto = await montarDto(registro.id);
    if (!dto) {
      return NextResponse.json(ERRO_GENERICO, { status: 404 });
    }

    return NextResponse.json(dto);
  } catch {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

// POST /api/confirmacao { token } — pública, sem login. Confirma todas as consultas do lote
// amarradas a este token (nunca aceita consultaId do body: o token é a única autorização).
export async function POST(request: NextRequest) {
  try {
    const limite = await consumirLimite(chaveIp('confirmacao', request), { max: 30, janelaMs: 3600000 });
    if (!limite.permitido) {
      return NextResponse.json(ERRO_GENERICO, { status: 429 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(ERRO_GENERICO, { status: 404 });
    }
    const obj = comoObjeto(body);
    if (typeof obj.token !== 'string' || obj.token.length === 0) {
      return NextResponse.json(ERRO_GENERICO, { status: 404 });
    }
    const tokenHash = hashToken(obj.token);

    let tokenId: string;
    try {
      tokenId = await prisma.$transaction(
        async (tx) => {
          const agora = new Date();
          const registro = await tx.tokenConfirmacao.findUnique({ where: { tokenHash }, select: { id: true } });
          if (!registro) throw new TokenInvalido();

          const { count } = await tx.tokenConfirmacao.updateMany({
            where: { tokenHash, usadoEm: null, expiraEm: { gt: agora } },
            data: { usadoEm: agora },
          });
          if (count !== 1) throw new TokenInvalido();

          await tx.consulta.updateMany({
            where: { tokenConfirmacaoId: registro.id, status: 'agendada' },
            data: { status: 'confirmada', confirmadaEm: agora },
          });

          return registro.id;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 5000, timeout: 10000 }
      );
    } catch (error) {
      if (error instanceof TokenInvalido) {
        return NextResponse.json(ERRO_GENERICO, { status: 404 });
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
        return NextResponse.json(ERRO_GENERICO, { status: 409 });
      }
      throw error;
    }

    const confirmadas = await prisma.consulta.findMany({
      where: { tokenConfirmacaoId: tokenId, status: 'confirmada' },
      select: { id: true },
    });
    for (const c of confirmadas) {
      await enviarConfirmacaoAoPaciente(c.id);
    }

    const dto = await montarDto(tokenId, 'confirmada');
    if (!dto) {
      return NextResponse.json(ERRO_GENERICO, { status: 404 });
    }
    return NextResponse.json(dto);
  } catch {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

class TokenInvalido extends Error {}
