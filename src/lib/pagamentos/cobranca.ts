import 'server-only';
import { prisma } from '@/lib/prisma';
import type { Prisma, PrismaClient } from '@/generated/prisma/client';
import type { CobrancaConsulta, MetodoManual, PagamentoDto } from '@/types/pagamento';
import type { ConsultaStatus } from '@/types';

/** Consultas cobráveis: agendada/confirmada (a ocorrer ou aguardando confirmação) e realizada. */
export const CONSULTA_STATUS_COBRAVEL: readonly ConsultaStatus[] = ['agendada', 'confirmada', 'realizada'];

type TxOuClient = PrismaClient | Prisma.TransactionClient;

/** Valor padrão da sessão (Configuracao.id=1). Fallback 200 só se a linha não existir. */
export async function obterValorPadraoSessao(tx: TxOuClient = prisma): Promise<number> {
  const config = await tx.configuracao.findUnique({ where: { id: 1 }, select: { valorPadraoSessao: true } });
  if (!config) {
    console.warn('[pagamentos/cobranca] linha Configuracao(id=1) ausente; usando fallback de valor padrão');
    return 200;
  }
  return Number(config.valorPadraoSessao);
}

/** Select a embutir em queries de consulta para montar `CobrancaConsulta`. */
export const SELECT_COBRANCA = {
  valor: true,
  pagamentoId: true,
  pagamento: {
    select: {
      id: true,
      origem: true,
      status: true,
      metodo: true,
      gateway: true,
      linkCheckout: true,
      recebidoEm: true,
      pagoEm: true,
    },
  },
} as const;

export type ConsultaComCobranca = {
  status: string;
  valor: Prisma.Decimal | null;
  pagamentoId: string | null;
  pagamento: {
    id: string;
    origem: string;
    status: string;
    metodo: string | null;
    gateway: string | null;
    linkCheckout: string | null;
    recebidoEm: Date | null;
    pagoEm: Date | null;
  } | null;
};

function formatarDataLocal(d: Date): string {
  const ano = d.getUTCFullYear();
  const mes = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dia = String(d.getUTCDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

/** Pagamento online: `pagoEm` é um instante; a UI espera só a data (YYYY-MM-DD) do dia em Brasília. */
function dataBrasilia(d: Date): string {
  return d.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}

export function montarCobranca(c: ConsultaComCobranca, valorPadrao: number): CobrancaConsulta {
  const valorPersonalizado = c.valor !== null;
  const valorEfetivo = c.valor !== null ? Number(c.valor) : valorPadrao;
  const valor = Math.round(valorEfetivo * 100) / 100;

  const pagamentoPago = c.pagamento !== null && c.pagamento.status === 'pago';
  const pagamentoAguardandoOnline =
    !pagamentoPago && c.pagamento !== null && c.pagamento.origem === 'online' && c.pagamento.status === 'pendente';

  let situacao: CobrancaConsulta['situacao'];
  if (pagamentoPago) {
    situacao = 'pago';
  } else if (pagamentoAguardandoOnline) {
    situacao = 'aguardando';
  } else if (c.status === 'cancelada' || c.status === 'nao_compareceu') {
    situacao = 'nao_cobravel';
  } else {
    situacao = 'em_aberto';
  }

  const pagamentoId = pagamentoPago || pagamentoAguardandoOnline ? c.pagamento!.id : null;
  const metodo = pagamentoPago ? ((c.pagamento!.metodo as MetodoManual | 'boleto' | 'cartao' | null) ?? null) : null;
  const linkCheckout = situacao === 'aguardando' ? c.pagamento!.linkCheckout : null;
  let recebidoEm: string | null = null;
  if (pagamentoPago) {
    if (c.pagamento!.recebidoEm) recebidoEm = formatarDataLocal(c.pagamento!.recebidoEm);
    else if (c.pagamento!.pagoEm) recebidoEm = dataBrasilia(c.pagamento!.pagoEm);
  }

  return { situacao, valor, valorPersonalizado, pagamentoId, metodo, recebidoEm, linkCheckout };
}

export const SELECT_PAGAMENTO = {
  id: true,
  origem: true,
  status: true,
  metodo: true,
  valor: true,
  recebidoEm: true,
  pagoEm: true,
  estornadoEm: true,
  observacao: true,
  criadoEm: true,
  consultas: {
    select: {
      id: true,
      inicio: true,
      status: true,
      paciente: { select: { id: true, nome: true } },
    },
  },
} as const;

export type PagamentoComConsultas = Prisma.PagamentoGetPayload<{ select: typeof SELECT_PAGAMENTO }>;

export function paraPagamentoDto(p: PagamentoComConsultas): PagamentoDto {
  return {
    id: p.id,
    origem: p.origem,
    status: p.status,
    metodo: (p.metodo as MetodoManual | 'boleto' | 'cartao' | null) ?? null,
    valor: Number(p.valor),
    recebidoEm: p.recebidoEm
      ? formatarDataLocal(p.recebidoEm)
      : p.pagoEm
        ? dataBrasilia(p.pagoEm)
        : null,
    estornadoEm: p.estornadoEm ? p.estornadoEm.toISOString() : null,
    observacao: p.observacao,
    criadoEm: p.criadoEm.toISOString(),
    consultas: p.consultas.map((c) => ({
      id: c.id,
      inicio: c.inicio.toISOString(),
      status: c.status as ConsultaStatus,
      paciente: { id: c.paciente.id, nome: c.paciente.nome },
    })),
  };
}
