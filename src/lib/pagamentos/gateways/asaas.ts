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
type AsaasNotificacao = {
  id: string;
  enabled?: boolean;
  emailEnabledForProvider?: boolean;
  smsEnabledForProvider?: boolean;
  emailEnabledForCustomer?: boolean;
  smsEnabledForCustomer?: boolean;
  phoneCallEnabledForCustomer?: boolean;
  whatsappEnabledForCustomer?: boolean;
};

// Estado-alvo de cada notificação: só o e-mail para a CONTA (psicóloga), que não é tarifado.
// Tudo que vai para a paciente (e-mail, SMS, WhatsApp, voz) e o SMS para a conta ficam desligados.
const NOTIFICACAO_ALVO = {
  enabled: true,
  emailEnabledForProvider: true,
  smsEnabledForProvider: false,
  emailEnabledForCustomer: false,
  smsEnabledForCustomer: false,
  phoneCallEnabledForCustomer: false,
  whatsappEnabledForCustomer: false,
} as const;
type AsaasPayment = {
  id: string;
  status: string;
  value: number;
  externalReference?: string | null;
  invoiceUrl?: string;
  dueDate?: string;
  paymentDate?: string | null;
  clientPaymentDate?: string | null;
  billingType?: string;
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

  // notificationDisabled na criação é a forma documentada de nascer sem notificações; mesmo
  // assim desligarNotificacoes() confere e desliga canal a canal antes de cada cobrança.
  const criacao = await fetch(apiUrl('/customers'), {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ name: nome, email, notificationDisabled: true }),
  });
  if (!criacao.ok) throw new Error('Falha ao criar cliente no Asaas');
  const criado = (await criacao.json()) as AsaasCustomer;
  return criado.id;
}

/** Desliga as notificações de cobrança do Asaas para a paciente (e-mail, SMS, WhatsApp, voz) e o
 *  SMS para a conta — algumas são tarifadas por envio e o link já vai pelo próprio site. Mantém
 *  só o e-mail para a conta da psicóloga (gratuito). O `notificationDisabled` do cliente não é garantia para clientes já existentes,
 *  então o controle é feito em cada notificação: GET /customers/{id}/notifications e
 *  PUT /notifications/batch. Falha aqui interrompe a cobrança (melhor tentar de novo do que
 *  disparar envios cobrados). */
async function desligarNotificacoes(customerId: string): Promise<void> {
  const lista = await fetch(apiUrl(`/customers/${encodeURIComponent(customerId)}/notifications?limit=100`), {
    method: 'GET',
    headers: headers(),
    cache: 'no-store',
  });
  if (!lista.ok) throw new Error('Falha ao listar notificações do cliente no Asaas');
  const { data, hasMore } = (await lista.json()) as { data?: AsaasNotificacao[]; hasMore?: boolean };
  // Resposta inesperada ou paginada: não dá para garantir que tudo foi desligado — falha fechado.
  if (!Array.isArray(data) || hasMore === true) {
    throw new Error('Resposta inesperada ao listar notificações do cliente no Asaas');
  }

  const ligadas = data.filter((n) =>
    (Object.keys(NOTIFICACAO_ALVO) as (keyof typeof NOTIFICACAO_ALVO)[]).some(
      (campo) => n[campo] !== NOTIFICACAO_ALVO[campo]
    )
  );
  if (ligadas.length === 0) return;

  const atualizacao = await fetch(apiUrl('/notifications/batch'), {
    method: 'PUT',
    headers: headers(),
    body: JSON.stringify({
      customer: customerId,
      notifications: ligadas.map((n) => ({ id: n.id, ...NOTIFICACAO_ALVO })),
    }),
  });
  if (!atualizacao.ok) throw new Error('Falha ao desativar notificações do cliente no Asaas');
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
      return 'estornado';
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
    await desligarNotificacoes(customerId);

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
      // UNDEFINED enquanto a paciente não escolhe na página hospedada.
      metodo:
        pagamento.billingType === 'PIX'
          ? 'pix'
          : pagamento.billingType === 'CREDIT_CARD' || pagamento.billingType === 'DEBIT_CARD'
            ? 'cartao'
            : pagamento.billingType === 'BOLETO'
              ? 'boleto'
              : null,
    };
  },

  async cancelarCobranca({ referenciaExterna }) {
    const resposta = await fetch(apiUrl(`/payments/${encodeURIComponent(referenciaExterna)}`), {
      method: 'DELETE',
      headers: headers(),
    });
    // 404: já removida no Asaas — o objetivo (link não pagável) está cumprido.
    if (!resposta.ok && resposta.status !== 404) throw new Error('Falha ao cancelar cobrança no Asaas');
  },

  async estornarPagamento({ pagamentoExternoId }) {
    const consulta = await fetch(apiUrl(`/payments/${encodeURIComponent(pagamentoExternoId)}`), {
      method: 'GET',
      headers: headers(),
      cache: 'no-store',
    });
    if (!consulta.ok) throw new Error('Falha ao consultar pagamento no Asaas');
    const atual = (await consulta.json()) as AsaasPayment;
    if (atual.status === 'REFUNDED' || atual.status === 'REFUND_REQUESTED') return; // já estornado

    const resposta = await fetch(apiUrl(`/payments/${encodeURIComponent(pagamentoExternoId)}/refund`), {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({}),
    });
    if (!resposta.ok) throw new Error('Falha ao estornar pagamento no Asaas');
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
