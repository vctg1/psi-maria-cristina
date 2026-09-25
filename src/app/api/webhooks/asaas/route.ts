import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { obterAdapter } from '@/lib/pagamentos/gateways';
import { aplicarStatusExterno } from '@/lib/pagamentos/conciliacao';

export const dynamic = 'force-dynamic';

// POST /api/webhooks/asaas — público. Nunca confia no corpo como fonte de verdade: valida o
// token, busca o status REAL no gateway e só então atualiza o Pagamento.
export async function POST(request: NextRequest) {
  try {
    const corpoCru = await request.text();
    const adapter = obterAdapter('asaas');

    const evento = await adapter.validarWebhook(request, corpoCru);
    if (!evento) {
      console.error('Webhook asaas inválido (token ausente ou incorreto)');
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    if (!evento.pagamentoExternoId) {
      return NextResponse.json({ ok: true });
    }

    const pagamento = await prisma.pagamento.findUnique({
      where: { referenciaExterna: evento.pagamentoExternoId },
      select: { id: true, referenciaExterna: true, pagamentoExternoId: true },
    });
    if (!pagamento || !pagamento.referenciaExterna) {
      // Evento de uma cobrança que não corresponde a nenhum Pagamento nosso; não é erro.
      return NextResponse.json({ ok: true });
    }

    // O Asaas manda o externalReference (= nosso pagamentoId) no próprio evento; confere antes
    // de aplicar qualquer mudança de status.
    if (evento.referenciaExterna && evento.referenciaExterna !== pagamento.id) {
      console.error('Webhook asaas com externalReference divergente do Pagamento resolvido');
      return NextResponse.json({ ok: true });
    }

    const externo = await adapter.consultarStatus({
      referenciaExterna: pagamento.referenciaExterna,
      pagamentoExternoId: pagamento.pagamentoExternoId,
    });

    const resultado = await aplicarStatusExterno(pagamento.id, externo, 'webhook', {
      notificacaoExternaId: evento.notificacaoExternaId,
      gateway: 'asaas',
      payloadSanitizado: evento.payloadSanitizado,
    });

    return NextResponse.json({ ok: true, duplicado: resultado.duplicado });
  } catch {
    console.error('Erro ao processar webhook asaas');
    return NextResponse.json({ ok: true });
  }
}
