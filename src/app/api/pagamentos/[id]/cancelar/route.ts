import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/guard';
import { obterAdapter, ErroConfiguracaoGateway } from '@/lib/pagamentos/gateways';
import { aplicarStatusExterno } from '@/lib/pagamentos/conciliacao';

type Contexto = { params: Promise<{ id: string }> };

class JaPago extends Error {}

// POST /api/pagamentos/[id]/cancelar — psicóloga. Cancela uma cobrança ONLINE ainda pendente:
// invalida o link no gateway e desvincula as consultas (voltam a "em aberto" e podem receber nova
// cobrança). Recusa (409) se o gateway já registra o pagamento — nesse caso o marca como pago.
export async function POST(request: NextRequest, { params }: Contexto) {
  try {
    const r = await requireAuth(request, 'psicologa');
    if ('erro' in r) return r.erro;

    const { id } = await params;

    const pagamento = await prisma.pagamento.findUnique({
      where: { id },
      select: { id: true, origem: true, status: true, gateway: true, referenciaExterna: true, pagamentoExternoId: true },
    });
    if (!pagamento) {
      return NextResponse.json({ error: 'Cobrança não encontrada' }, { status: 404 });
    }
    if (pagamento.origem !== 'online' || pagamento.status !== 'pendente') {
      return NextResponse.json({ error: 'Esta cobrança não pode mais ser cancelada' }, { status: 409 });
    }

    // Sem referência externa a cobrança nunca chegou ao gateway: não há link a invalidar.
    if (pagamento.gateway && pagamento.referenciaExterna) {
      const adapter = obterAdapter(pagamento.gateway);
      const ref = {
        referenciaExterna: pagamento.referenciaExterna,
        pagamentoExternoId: pagamento.pagamentoExternoId,
        pagamentoId: pagamento.id,
      };
      const conferirSePago = async () => {
        const externo = await adapter.consultarStatus(ref);
        if (externo.status === 'pago') {
          await aplicarStatusExterno(pagamento.id, externo, 'reconciliacao');
          throw new JaPago();
        }
      };

      try {
        await conferirSePago();
        await adapter.cancelarCobranca({ referenciaExterna: pagamento.referenciaExterna, pagamentoId: pagamento.id });
        // Fecha a janela entre a conferência e a expiração do link.
        await conferirSePago();
      } catch (erro) {
        if (erro instanceof JaPago) {
          return NextResponse.json(
            { error: 'Esta cobrança já foi paga e não pode ser cancelada.', pago: true },
            { status: 409 }
          );
        }
        if (erro instanceof ErroConfiguracaoGateway) {
          console.error('Gateway sem configuração ao cancelar cobrança');
        } else {
          console.error('Falha ao cancelar cobrança no gateway (ids omitidos do log)');
        }
        return NextResponse.json(
          { error: 'Não foi possível cancelar a cobrança no gateway. Tente novamente.' },
          { status: 502 }
        );
      }
    }

    const cancelou = await prisma.$transaction(async (tx) => {
      const atualizado = await tx.pagamento.updateMany({
        where: { id, status: 'pendente' },
        data: { status: 'cancelado', statusExterno: 'cancelado_pela_psicologa', ultimaReconciliacaoEm: new Date() },
      });
      if (atualizado.count === 0) return false;
      await tx.consulta.updateMany({ where: { pagamentoId: id }, data: { pagamentoId: null } });
      return true;
    });
    if (!cancelou) {
      // Ex.: o webhook confirmou o pagamento entre a conferência e a transação.
      const agora = await prisma.pagamento.findUnique({ where: { id }, select: { status: true } });
      return agora?.status === 'pago'
        ? NextResponse.json({ error: 'Esta cobrança já foi paga e não pode ser cancelada.', pago: true }, { status: 409 })
        : NextResponse.json({ error: 'Esta cobrança não pode mais ser cancelada' }, { status: 409 });
    }

    return new NextResponse(null, { status: 204 });
  } catch {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
