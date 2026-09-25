import 'server-only';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@/generated/prisma/client';
import type { Gateway, PagamentoStatus } from '@/types/pagamento';
import { obterAdapter } from './gateways';
import type { StatusExterno } from './gateways/tipos';

type OrigemEvento = 'webhook' | 'reconciliacao' | 'manual';

type EventoEntrada = {
  notificacaoExternaId: string;
  gateway: Gateway;
  payloadSanitizado: Record<string, unknown>;
};

type ResultadoConciliacao = { duplicado: boolean; statusFinal: PagamentoStatus };

/** Aplica um status externo (vindo de webhook ou reconciliação) a um Pagamento, de forma
 *  atômica e idempotente. `pago` é terminal: uma vez pago, nada mais altera o status. */
export async function aplicarStatusExterno(
  pagamentoId: string,
  externo: StatusExterno,
  origem: OrigemEvento,
  evento?: EventoEntrada
): Promise<ResultadoConciliacao> {
  try {
    return await prisma.$transaction(
      async (tx) => {
        if (evento?.notificacaoExternaId) {
          const existente = await tx.eventoPagamento.findUnique({
            where: { notificacaoExternaId: evento.notificacaoExternaId },
            select: { id: true },
          });
          if (existente) {
            const atual = await tx.pagamento.findUniqueOrThrow({ where: { id: pagamentoId }, select: { status: true } });
            return { duplicado: true, statusFinal: atual.status };
          }
        }

        const pagamento = await tx.pagamento.findUniqueOrThrow({
          where: { id: pagamentoId },
          select: { id: true, status: true, valor: true },
        });

        // pago é terminal: só registra o evento (rastreabilidade), não altera nada.
        if (pagamento.status === 'pago') {
          if (evento) {
            await tx.eventoPagamento.create({
              data: {
                pagamentoId,
                origem,
                gateway: evento.gateway,
                notificacaoExternaId: evento.notificacaoExternaId,
                pagamentoExternoId: externo.pagamentoExternoId ?? null,
                statusAnterior: pagamento.status,
                statusNovo: pagamento.status,
                payload: evento.payloadSanitizado as Prisma.InputJsonValue,
              },
            });
          }
          return { duplicado: false, statusFinal: 'pago' };
        }

        // Confere valor antes de marcar como pago: se o gateway reportou valor menor que o devido,
        // não confirma — registra o evento e mantém pendente.
        let statusNovo: PagamentoStatus = externo.status;
        if (
          statusNovo === 'pago' &&
          typeof externo.valorPago === 'number' &&
          externo.valorPago < Number(pagamento.valor)
        ) {
          console.error('Valor pago divergente do esperado (pagamentoId omitido do log)');
          statusNovo = 'pendente';
        }

        const atualizado = await tx.pagamento.updateMany({
          where: { id: pagamentoId, status: { not: 'pago' } },
          data: {
            status: statusNovo,
            statusExterno: externo.statusExterno,
            statusExternoDetalhe: externo.statusExternoDetalhe ?? null,
            pagamentoExternoId: externo.pagamentoExternoId ?? undefined,
            pagoEm: statusNovo === 'pago' ? (externo.pagoEm ?? new Date()) : undefined,
            ultimaReconciliacaoEm: new Date(),
          },
        });

        // count === 0: outra requisição já mudou o status concorrentemente (idempotente, não é erro).
        const statusFinal = atualizado.count > 0 ? statusNovo : (await tx.pagamento.findUniqueOrThrow({ where: { id: pagamentoId }, select: { status: true } })).status;

        if (evento) {
          await tx.eventoPagamento.create({
            data: {
              pagamentoId,
              origem,
              gateway: evento.gateway,
              notificacaoExternaId: evento.notificacaoExternaId,
              pagamentoExternoId: externo.pagamentoExternoId ?? null,
              statusAnterior: pagamento.status,
              statusNovo: statusFinal,
              payload: evento.payloadSanitizado as Prisma.InputJsonValue,
            },
          });
        }

        return { duplicado: false, statusFinal };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 5000, timeout: 10000 }
    );
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      // Reentrega concorrente que colidiu no unique de notificacaoExternaId: idempotente.
      const atual = await prisma.pagamento.findUnique({ where: { id: pagamentoId }, select: { status: true } });
      return { duplicado: true, statusFinal: atual?.status ?? 'pendente' };
    }
    throw error;
  }
}

const IDADE_MINIMA_RECONCILIACAO_S = 60;

/** Se o pagamento está pendente e a última reconciliação é velha (ou nunca aconteceu), consulta
 *  o gateway e aplica o status. Sempre atualiza `ultimaReconciliacaoEm` para não martelar o
 *  gateway. Erros do gateway são engolidos (logados só por id) — a tela nunca quebra por isso. */
export async function reconciliarSePreciso(
  pagamento: {
    id: string;
    status: PagamentoStatus;
    gateway: Gateway | null;
    referenciaExterna: string | null;
    pagamentoExternoId: string | null;
    ultimaReconciliacaoEm: Date | null;
  },
  opts: { minIdadeSegundos?: number } = {}
): Promise<PagamentoStatus> {
  if (pagamento.status !== 'pendente' || !pagamento.gateway || !pagamento.referenciaExterna) {
    return pagamento.status;
  }

  const minIdadeS = opts.minIdadeSegundos ?? IDADE_MINIMA_RECONCILIACAO_S;
  const idadeMs = pagamento.ultimaReconciliacaoEm ? Date.now() - pagamento.ultimaReconciliacaoEm.getTime() : Infinity;
  if (idadeMs < minIdadeS * 1000) {
    return pagamento.status;
  }

  try {
    const adapter = obterAdapter(pagamento.gateway);
    const externo = await adapter.consultarStatus({
      referenciaExterna: pagamento.referenciaExterna,
      pagamentoExternoId: pagamento.pagamentoExternoId,
    });
    const resultado = await aplicarStatusExterno(pagamento.id, externo, 'reconciliacao');
    return resultado.statusFinal;
  } catch {
    console.error('Falha ao reconciliar pagamento com o gateway (id omitido do log)');
    await prisma.pagamento.updateMany({
      where: { id: pagamento.id, status: 'pendente' },
      data: { ultimaReconciliacaoEm: new Date() },
    });
    return pagamento.status;
  }
}
