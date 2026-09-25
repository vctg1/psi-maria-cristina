import 'server-only';
import crypto from 'crypto';
import type { NextRequest } from 'next/server';
import { envObrigatoria, baseUrlPublica } from './config';
import type { CobrancaCriada, EventoWebhook, GatewayPagamentoAdapter, StatusExterno } from './tipos';

function apiUrl(caminho: string): string {
  return `${envObrigatoria('ASAAS_API_URL').replace(/\/+$/, '')}${caminho}`;
}

function headers(): HeadersInit {
  return {
    'Content-Type': 'application/json',
    access_token: envObrigatoria('ASAAS_API_KEY'),
  };
}

type AsaasCustomer = { id: string; email?: string };
type AsaasCustomerList = { data: AsaasCustomer[] };
type AsaasPayment = {
  id: string;
  status: string;
  value: number;
  externalReference?: string | null;
  invoiceUrl?: string;
  dueDate?: string;
  paymentDate?: string | null;
  clientPaymentDate?: string | null;
};

async function obterOuCriarCliente(nome: string, email: string): Promise<string> {
  const busca = await fetch(apiUrl(`/customers?email=${encodeURIComponent(email)}`), {
    method: 'GET',
    headers: headers(),
    cache: 'no-store',
  });
  if (!busca.ok) throw new Error('Falha ao consultar cliente no Asaas');
  const encontrados = (await busca.json()) as AsaasCustomerList;
  const existente = encontrados.data?.[0];
  if (existente) return existente.id;

  const criacao = await fetch(apiUrl('/customers'), {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ name: nome, email }),
  });
  if (!criacao.ok) throw new Error('Falha ao criar cliente no Asaas');
  const criado = (await criacao.json()) as AsaasCustomer;
  return criado.id;
}

function mapStatus(status: string): StatusExterno['status'] {
  switch (status) {
    case 'RECEIVED':
    case 'CONFIRMED':
    case 'RECEIVED_IN_CASH':
      return 'pago';
    case 'OVERDUE':
      return 'expirado';
    case 'REFUNDED':
    case 'PAYMENT_DELETED':
    case 'CHARGEBACK_REQUESTED':
    case 'CHARGEBACK_DISPUTE':
    case 'AWAITING_CHARGEBACK_REVERSAL':
      return 'falhou';
    case 'PENDING':
    case 'AWAITING_RISK_ANALYSIS':
    default:
      return 'pendente';
  }
}

export const asaasAdapter: GatewayPagamentoAdapter = {
  nome: 'asaas',

  async gerarCobranca({ pagamentoId, valor, descricao, pagador, expiraEm }) {
    if (!pagador.email) throw new Error('Pagador sem e-mail: obrigatório para cobrança Asaas');
    const base = baseUrlPublica();
    const customerId = await obterOuCriarCliente(pagador.nome, pagador.email);

    const dueDate = (expiraEm ?? new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)).toISOString().slice(0, 10);

    const resposta = await fetch(apiUrl('/payments'), {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({
        customer: customerId,
        billingType: 'UNDEFINED', // paciente escolhe PIX ou cartão na página hospedada
        value: valor,
        dueDate,
        description: descricao,
        externalReference: pagamentoId,
        callback: { successUrl: `${base}/pagamento/sucesso?p=${pagamentoId}`, autoRedirect: true },
      }),
    });
    if (!resposta.ok) throw new Error('Falha ao criar cobrança no Asaas');
    const criado = (await resposta.json()) as AsaasPayment;
    if (!criado.id || !criado.invoiceUrl) throw new Error('Resposta inválida do Asaas ao criar cobrança');

    return { referenciaExterna: criado.id, linkCheckout: criado.invoiceUrl, expiraEm: new Date(`${dueDate}T23:59:59-03:00`) };
  },

  async consultarStatus({ referenciaExterna }) {
    const resposta = await fetch(apiUrl(`/payments/${encodeURIComponent(referenciaExterna)}`), {
      method: 'GET',
      headers: headers(),
      cache: 'no-store',
    });
    if (!resposta.ok) throw new Error('Falha ao consultar pagamento no Asaas');
    const pagamento = (await resposta.json()) as AsaasPayment;

    const pagoEmStr = pagamento.paymentDate ?? pagamento.clientPaymentDate ?? null;
    return {
      status: mapStatus(pagamento.status),
      statusExterno: pagamento.status,
      statusExternoDetalhe: null,
      pagamentoExternoId: pagamento.id,
      pagoEm: pagoEmStr ? new Date(`${pagoEmStr}T12:00:00-03:00`) : null,
      valorPago: typeof pagamento.value === 'number' ? pagamento.value : null,
    };
  },

  async validarWebhook(request: NextRequest, corpoCru: string): Promise<EventoWebhook | null> {
    const tokenEsperado = process.env.ASAAS_WEBHOOK_TOKEN;
    if (!tokenEsperado) {
      console.error('ASAAS_WEBHOOK_TOKEN ausente');
      return null;
    }
    const recebido = request.headers.get('asaas-access-token');
    if (!recebido) return null;

    const bufEsperado = Buffer.from(tokenEsperado);
    const bufRecebido = Buffer.from(recebido);
    if (bufEsperado.length !== bufRecebido.length || !crypto.timingSafeEqual(bufEsperado, bufRecebido)) {
      return null;
    }

    let corpo: { id?: string; event?: string; payment?: { id?: string; status?: string; externalReference?: string } };
    try {
      corpo = JSON.parse(corpoCru);
    } catch {
      return null;
    }
    if (!corpo.id) return null;

    return {
      notificacaoExternaId: corpo.id,
      referenciaExterna: corpo.payment?.externalReference ?? null,
      pagamentoExternoId: corpo.payment?.id ?? null,
      payloadSanitizado: { event: corpo.event, paymentId: corpo.payment?.id, status: corpo.payment?.status },
    };
  },
};
