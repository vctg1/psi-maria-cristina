import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@/generated/prisma/client';
import { requireAuth } from '@/lib/auth/guard';
import { formatoDataValido, partesLocais } from '@/lib/agenda/tempo';
import { CONSULTA_STATUS_COBRAVEL, SELECT_PAGAMENTO, obterValorPadraoSessao, paraPagamentoDto } from '@/lib/pagamentos/cobranca';
import { METODOS_MANUAIS, PAGAMENTO_CONSULTAS_MAX, PAGAMENTO_VALOR_MAX, type MetodoManual } from '@/types/pagamento';

const DATA_MINIMA = '2020-01-01';

function comoObjeto(body: unknown): Record<string, unknown> {
  return body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
}

function valorValido(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v > 0 && v <= PAGAMENTO_VALOR_MAX && Math.round(v * 100) / 100 === v;
}

class ConsultaJaPaga extends Error {
  consultaIds: string[];
  constructor(consultaIds: string[]) {
    super('Consulta já paga');
    this.consultaIds = consultaIds;
  }
}

// POST /api/pagamentos/manual — psicóloga. Registra recebimento (PIX/dinheiro/maquininha/outro)
// para uma ou mais consultas em aberto.
export async function POST(request: NextRequest) {
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

    let consultaIds: string[] = [];
    if (
      !Array.isArray(obj.consultaIds) ||
      obj.consultaIds.length < 1 ||
      obj.consultaIds.length > PAGAMENTO_CONSULTAS_MAX ||
      !obj.consultaIds.every((v) => typeof v === 'string' && v.length > 0)
    ) {
      campos.consultaIds = `Informe de 1 a ${PAGAMENTO_CONSULTAS_MAX} ids de consulta`;
    } else {
      const unicos = new Set(obj.consultaIds as string[]);
      if (unicos.size !== obj.consultaIds.length) {
        campos.consultaIds = 'IDs de consulta duplicados';
      } else {
        consultaIds = obj.consultaIds as string[];
      }
    }

    if (typeof obj.metodo !== 'string' || !METODOS_MANUAIS.includes(obj.metodo as MetodoManual)) {
      campos.metodo = 'Método inválido';
    }

    let valorBody: number | undefined;
    if (obj.valor !== undefined) {
      if (!valorValido(obj.valor)) {
        campos.valor = `Valor inválido (0 a ${PAGAMENTO_VALOR_MAX}, até 2 casas decimais)`;
      } else {
        valorBody = obj.valor;
      }
    }

    if (!formatoDataValido(obj.recebidoEm)) {
      campos.recebidoEm = 'Data inválida (use YYYY-MM-DD)';
    } else {
      const hoje = partesLocais(new Date()).data;
      if ((obj.recebidoEm as string) > hoje) {
        campos.recebidoEm = 'Data não pode ser futura';
      } else if ((obj.recebidoEm as string) < DATA_MINIMA) {
        campos.recebidoEm = `Data não pode ser anterior a ${DATA_MINIMA}`;
      }
    }

    let observacao: string | null = null;
    if (obj.observacao !== undefined && obj.observacao !== null) {
      if (typeof obj.observacao !== 'string' || obj.observacao.trim().length > 500) {
        campos.observacao = 'Observação inválida (máximo 500 caracteres)';
      } else {
        observacao = obj.observacao.trim() || null;
      }
    }

    if (Object.keys(campos).length > 0) {
      return NextResponse.json({ error: 'Dados inválidos', campos }, { status: 400 });
    }

    const metodo = obj.metodo as MetodoManual;
    const recebidoEm = obj.recebidoEm as string;

    const pagamento = await prisma.$transaction(
      async (tx) => {
        const consultasExistentes = await tx.consulta.findMany({
          where: { id: { in: consultaIds } },
          select: { id: true, status: true, valor: true, pagamentoId: true },
        });

        if (consultasExistentes.length !== consultaIds.length) {
          const encontrados = new Set(consultasExistentes.map((c) => c.id));
          const faltantes = consultaIds.filter((id) => !encontrados.has(id));
          throw new ConsultaNaoEncontrada(faltantes);
        }

        const jaPagas = consultasExistentes.filter((c) => c.pagamentoId !== null).map((c) => c.id);
        if (jaPagas.length > 0) {
          throw new ConsultaJaPaga(jaPagas);
        }

        const naoCobraveis = consultasExistentes
          .filter((c) => !CONSULTA_STATUS_COBRAVEL.includes(c.status))
          .map((c) => c.id);
        if (naoCobraveis.length > 0) {
          throw new ConsultaNaoCobravel(naoCobraveis);
        }

        const valorPadrao = await obterValorPadraoSessao(tx);
        const somaEfetiva = consultasExistentes.reduce((soma, c) => {
          const v = c.valor !== null ? Number(c.valor) : valorPadrao;
          return soma + v;
        }, 0);
        const valorFinal = valorBody ?? Math.round(somaEfetiva * 100) / 100;

        const pagoEm = new Date(`${recebidoEm}T12:00:00-03:00`);

        const criado = await tx.pagamento.create({
          data: {
            origem: 'manual',
            status: 'pago',
            metodo,
            valor: new Prisma.Decimal(valorFinal),
            recebidoEm: new Date(`${recebidoEm}T00:00:00.000Z`),
            pagoEm,
            geradoPorId: auth.usuarioId,
            observacao,
          },
        });

        const atualizadas = await tx.consulta.updateMany({
          where: { id: { in: consultaIds }, pagamentoId: null },
          data: { pagamentoId: criado.id },
        });

        if (atualizadas.count !== consultaIds.length) {
          throw new ConsultaJaPaga(consultaIds);
        }

        return tx.pagamento.findUniqueOrThrow({ where: { id: criado.id }, select: SELECT_PAGAMENTO });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 5000, timeout: 10000 }
    );

    return NextResponse.json(paraPagamentoDto(pagamento), { status: 201 });
  } catch (error) {
    if (error instanceof ConsultaNaoEncontrada) {
      return NextResponse.json({ error: 'Consulta não encontrada', consultaIds: error.consultaIds }, { status: 404 });
    }
    if (error instanceof ConsultaJaPaga) {
      return NextResponse.json(
        { error: 'Consulta já paga', codigo: 'JA_PAGA', consultaIds: error.consultaIds },
        { status: 409 }
      );
    }
    if (error instanceof ConsultaNaoCobravel) {
      return NextResponse.json(
        {
          error: 'Consulta cancelada/sem comparecimento não pode ser cobrada',
          codigo: 'NAO_COBRAVEL',
          consultaIds: error.consultaIds,
        },
        { status: 409 }
      );
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
      return NextResponse.json({ error: 'Consulta já paga', codigo: 'JA_PAGA' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

class ConsultaNaoEncontrada extends Error {
  consultaIds: string[];
  constructor(consultaIds: string[]) {
    super('Consulta não encontrada');
    this.consultaIds = consultaIds;
  }
}

class ConsultaNaoCobravel extends Error {
  consultaIds: string[];
  constructor(consultaIds: string[]) {
    super('Consulta não cobrável');
    this.consultaIds = consultaIds;
  }
}
