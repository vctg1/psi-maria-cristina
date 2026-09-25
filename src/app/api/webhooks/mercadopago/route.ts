import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { obterAdapter } from '@/lib/pagamentos/gateways';
import { aplicarStatusExterno } from '@/lib/pagamentos/conciliacao';

export const dynamic = 'force-dynamic';

// POST /api/webhooks/mercadopago — público. Nunca confia no corpo/query como fonte de verdade:
// valida assinatura, busca o status REAL no gateway e só então atualiza o Pagamento.
export async function POST(request: NextRequest) {
  try {
    const corpoCru = await request.text();
    const adapter = obterAdapter('mercadopago');

    const evento = await adapter.validarWebhook(request, corpoCru);
    if (!evento) {
      console.error('Webhook mercadopago inválido (assinatura/headers ausentes ou incorretos)');
      return NextResponse.json({ error: 'Assinatura inválida' }, { status: 401 });
    }

    if (!evento.pagamentoExternoId) {
      // Notificação sem id de pagamento (ex.: teste do painel) — nada a processar.
      return NextResponse.json({ ok: true });
    }

    // Busca o status real: o MP não manda external_reference no header, então precisamos do
    // payment.get para descobrir a qual Pagamento nosso isso pertence.
    const externo = await adapter.consultarStatus({
      referenciaExterna: evento.pagamentoExternoId,
      pagamentoExternoId: evento.pagamentoExternoId,
    });

    const referenciaPropria = await buscarReferenciaPropria(evento.pagamentoExternoId);
    if (!referenciaPropria) {
      // Evento de um pagamento que não corresponde a nenhum Pagamento nosso; não é erro.
      return NextResponse.json({ ok: true });
    }

    const resultado = await aplicarStatusExterno(referenciaPropria, externo, 'webhook', {
      notificacaoExternaId: evento.notificacaoExternaId,
      gateway: 'mercadopago',
      payloadSanitizado: evento.payloadSanitizado,
    });

    return NextResponse.json({ ok: true, duplicado: resultado.duplicado });
  } catch {
    console.error('Erro ao processar webhook mercadopago');
    // Responde 200 mesmo em erro interno para não gerar reentrega infinita por bug nosso;
    // o problema fica registrado no log e é coberto pela reconciliação periódica.
    return NextResponse.json({ ok: true });
  }
}

/** Descobre a qual Pagamento (nosso id) um pagamentoExternoId do MP pertence: primeiro pelo
 *  campo já gravado (reentrega), senão pelo external_reference devolvido pelo próprio MP. */
async function buscarReferenciaPropria(pagamentoExternoId: string): Promise<string | null> {
  const existente = await prisma.pagamento.findUnique({
    where: { pagamentoExternoId },
    select: { id: true },
  });
  if (existente) return existente.id;

  const { Payment, MercadoPagoConfig } = await import('mercadopago');
  const accessToken = process.env.MP_ACCESS_TOKEN;
  if (!accessToken) {
    console.error('MP_ACCESS_TOKEN ausente');
    return null;
  }
  const payment = new Payment(new MercadoPagoConfig({ accessToken }));
  const p = await payment.get({ id: pagamentoExternoId });
  const externalReference = p.external_reference;
  if (!externalReference) return null;

  const pagamento = await prisma.pagamento.findUnique({ where: { id: externalReference }, select: { id: true } });
  return pagamento?.id ?? null;
}
