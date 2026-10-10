import 'server-only';
import crypto from 'crypto';
import type { NextRequest } from 'next/server';
import { MercadoPagoConfig, Payment, Preference } from 'mercadopago';
import { envObrigatoria, baseUrlPublica } from './config';
import type { CobrancaCriada, EventoWebhook, GatewayPagamentoAdapter, StatusExterno } from './tipos';

function client(): MercadoPagoConfig {
  return new MercadoPagoConfig({ accessToken: envObrigatoria('MP_ACCESS_TOKEN') });
}

function mapStatus(status: string | undefined): StatusExterno['status'] {
  switch (status) {
    case 'approved':
      return 'pago';
    case 'rejected':
    case 'cancelled':
      return 'falhou';
    case 'expired':
      return 'expirado';
    case 'pending':
    case 'in_process':
    case 'authorized':
    default:
      return 'pendente';
  }
}

function mapMetodo(tipo: string | undefined): StatusExterno['metodo'] {
  switch (tipo) {
    case 'credit_card':
    case 'debit_card':
    case 'prepaid_card':
      return 'cartao';
    case 'bank_transfer': // PIX
      return 'pix';
    case 'ticket':
      return 'boleto';
    default:
      return null;
  }
}

export const mercadoPagoAdapter: GatewayPagamentoAdapter = {
  nome: 'mercadopago',

  async gerarCobranca({ pagamentoId, valor, descricao, pagador }) {
    const base = baseUrlPublica();
    const preference = new Preference(client());

    const response = await preference.create({
      body: {
        items: [
          {
            id: pagamentoId,
            title: descricao,
            quantity: 1,
            unit_price: valor,
            currency_id: 'BRL',
          },
        ],
        payer: pagador.email ? { name: pagador.nome, email: pagador.email } : { name: pagador.nome },
        external_reference: pagamentoId,
        // Sem notification_url de propósito: quando presente, ele substitui o webhook do painel e os
        // avisos chegam com x-signature que NÃO confere com a chave secreta do painel (comprovado:
        // simulação do painel → assinatura ok; pagamento via notification_url → 401). O MP então usa
        // a URL configurada em "Suas integrações → Webhooks" (evento Pagamentos), assinada com
        // MP_WEBHOOK_SECRET. Essa URL precisa estar configurada no painel em cada ambiente.
        back_urls: {
          success: `${base}/pagamento/sucesso?p=${pagamentoId}`,
          pending: `${base}/pagamento/pendente?p=${pagamentoId}`,
          failure: `${base}/pagamento/falha?p=${pagamentoId}`,
        },
        auto_return: 'approved',
        payment_methods: {
          excluded_payment_types: [{ id: 'ticket' }, { id: 'atm' }, { id: 'debit_card' }],
          installments: 1,
        },
      },
    });

    if (!response.id || !response.init_point) {
      throw new Error('Resposta inválida do MercadoPago ao criar preference');
    }

    // Credenciais de teste antigas começam com TEST-; as novas (contas de teste) também são
    // APP_USR-…, indistinguíveis das de produção — por isso `MP_SANDBOX=true` força o checkout
    // de sandbox (`sandbox_init_point`). Em produção MP_SANDBOX é ignorada, para que um .env
    // esquecido não impeça pacientes de pagar. A escolha vem só de configuração, nunca de input.
    const ehSandbox =
      envObrigatoria('MP_ACCESS_TOKEN').startsWith('TEST-') ||
      (process.env.MP_SANDBOX === 'true' && process.env.NODE_ENV !== 'production');
    const link = (ehSandbox && response.sandbox_init_point) || response.init_point;

    return { referenciaExterna: response.id, linkCheckout: link, expiraEm: null };
  },

  async consultarStatus({ referenciaExterna, pagamentoExternoId, pagamentoId }) {
    const payment = new Payment(client());

    if (pagamentoExternoId) {
      const p = await payment.get({ id: pagamentoExternoId });
      const resultado: StatusExterno = {
        status: mapStatus(p.status),
        statusExterno: p.status ?? 'desconhecido',
        statusExternoDetalhe: p.status_detail ?? null,
        pagamentoExternoId: p.id ? String(p.id) : null,
        pagoEm: p.date_approved ? new Date(p.date_approved) : null,
        valorPago: typeof p.transaction_amount === 'number' ? p.transaction_amount : null,
        metodo: mapMetodo(p.payment_type_id),
      };
      // Tentativa gravada não aprovada (ex.: cartão recusado): a paciente pode ter pago depois
      // numa nova tentativa da mesma cobrança, então ainda vale a busca por external_reference.
      if (resultado.status === 'pago' || !pagamentoId) return resultado;
    }

    // Ainda sem pagamento aprovado: busca pelo external_reference, que é o id do NOSSO Pagamento
    // (gerarCobranca o envia assim). `referenciaExterna` aqui é o preference.id e nunca casaria.
    if (!pagamentoId) {
      return { status: 'pendente', statusExterno: 'sem_pagamento', pagamentoExternoId: null };
    }
    const busca = await payment.search({ options: { external_reference: pagamentoId } });
    const resultados = busca.results ?? [];
    const preferido =
      resultados.find((r) => r.status === 'approved') ??
      resultados.slice().sort((a, b) => (b.date_created ?? '').localeCompare(a.date_created ?? ''))[0];

    if (!preferido) {
      return { status: 'pendente', statusExterno: 'sem_pagamento', pagamentoExternoId: null };
    }

    return {
      status: mapStatus(preferido.status),
      statusExterno: preferido.status ?? 'desconhecido',
      statusExternoDetalhe: preferido.status_detail ?? null,
      pagamentoExternoId: preferido.id ? String(preferido.id) : null,
      pagoEm: preferido.date_approved ? new Date(preferido.date_approved) : null,
      valorPago: typeof preferido.transaction_amount === 'number' ? preferido.transaction_amount : null,
      metodo: mapMetodo(preferido.payment_type_id),
    };
  },

  async validarWebhook(request: NextRequest): Promise<EventoWebhook | null> {
    const secret = process.env.MP_WEBHOOK_SECRET;
    if (!secret) {
      console.error('MP_WEBHOOK_SECRET ausente');
      return null;
    }

    const xSignature = request.headers.get('x-signature');
    const xRequestId = request.headers.get('x-request-id');
    const dataId = new URL(request.url).searchParams.get('data.id');
    if (!xSignature || !xRequestId || !dataId) return null;

    const partes = new Map<string, string>();
    for (const par of xSignature.split(',')) {
      const [chave, ...resto] = par.split('=');
      if (chave) partes.set(chave.trim(), resto.join('=').trim());
    }
    const ts = partes.get('ts');
    const v1 = partes.get('v1');
    if (!ts || !v1) return null;

    const tsMs = Number(ts) * 1000;
    if (!Number.isFinite(tsMs) || Math.abs(Date.now() - tsMs) > 10 * 60 * 1000) return null;

    const template = `id:${dataId};request-id:${xRequestId};ts:${ts};`;
    const esperado = crypto.createHmac('sha256', secret).update(template).digest('hex');

    const bufEsperado = Buffer.from(esperado, 'hex');
    const bufRecebido = Buffer.from(v1, 'hex');
    if (bufEsperado.length !== bufRecebido.length || !crypto.timingSafeEqual(bufEsperado, bufRecebido)) {
      return null;
    }

    const type = new URL(request.url).searchParams.get('type');
    const action = new URL(request.url).searchParams.get('action');

    return {
      notificacaoExternaId: xRequestId,
      // Só eventos de pagamento carregam um payment id; outros (ex.: merchant_order) são ignorados.
      pagamentoExternoId: type === 'payment' ? dataId : null,
      referenciaExterna: null,
      payloadSanitizado: { type, action, dataId },
    };
  },
};
