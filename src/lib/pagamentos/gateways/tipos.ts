import 'server-only';
import type { NextRequest } from 'next/server';
import type { Gateway } from '@/types/pagamento';

/** Status normalizado devolvido por `consultarStatus`. `statusExterno`/`statusExternoDetalhe`
 *  são o valor CRU do gateway (para depuração interna) — nunca vazam ao cliente como estão. */
export type StatusExterno = {
  /** `estornado` = o gateway devolveu o dinheiro (pelo site ou pelo painel do gateway). */
  status: 'pendente' | 'pago' | 'falhou' | 'expirado' | 'estornado';
  statusExterno: string;
  statusExternoDetalhe?: string | null;
  pagamentoExternoId?: string | null;
  pagoEm?: Date | null;
  valorPago?: number | null;
  /** Meio usado na página hospedada, já normalizado (null = gateway não informou / outro). */
  metodo?: 'pix' | 'cartao' | 'boleto' | null;
};

export type CobrancaCriada = {
  referenciaExterna: string;
  linkCheckout: string;
  expiraEm?: Date | null;
};

/** Evento de webhook já validado (assinatura conferida) e sanitizado. `referenciaExterna`/
 *  `pagamentoExternoId` quando o gateway os expõe diretamente no payload — mesmo assim o handler
 *  DEVE confirmar o status consultando o gateway (nunca confiar só no corpo do webhook). */
export type EventoWebhook = {
  notificacaoExternaId: string;
  referenciaExterna?: string | null;
  pagamentoExternoId?: string | null;
  /** Só campos não sensíveis (tipo/ação/ids) — nunca payer/card/identification. */
  payloadSanitizado: Record<string, unknown>;
};

export interface GatewayPagamentoAdapter {
  readonly nome: Gateway;

  gerarCobranca(p: {
    pagamentoId: string;
    valor: number;
    descricao: string;
    pagador: { nome: string; email: string | null };
    expiraEm?: Date;
  }): Promise<CobrancaCriada>;

  /** `pagamentoId` é o id do NOSSO Pagamento (enviado como external_reference ao gateway); o MP
   *  precisa dele para achar o pagamento enquanto ainda não há `pagamentoExternoId`. */
  consultarStatus(ref: {
    referenciaExterna: string;
    pagamentoExternoId?: string | null;
    pagamentoId?: string;
  }): Promise<StatusExterno>;

  /** Invalida o link hospedado para que não aceite mais pagamento (MP: expira a preference e
   *  cancela pagamentos ainda pendentes, ex.: QR PIX já gerado · Asaas: remove a cobrança). Lança em
   *  falha — o chamador NÃO deve cancelar localmente nesse caso, senão algo continuaria pagável sem
   *  cobrança correspondente. `pagamentoId` = nosso id (external_reference). */
  cancelarCobranca(ref: { referenciaExterna: string; pagamentoId: string }): Promise<void>;

  /** Devolve ao pagador o valor TOTAL de um pagamento aprovado. Lança em falha — o chamador não
   *  deve marcar como estornado nesse caso. Idempotente do ponto de vista do chamador: se o gateway
   *  já registra o estorno, não lança. */
  estornarPagamento(ref: { pagamentoExternoId: string }): Promise<void>;

  /** Retorna `null` quando a assinatura/token é inválido ou ausente — o chamador responde 401
   *  sem gravar nada. */
  validarWebhook(request: NextRequest, corpoCru: string): Promise<EventoWebhook | null>;
}

export class ErroConfiguracaoGateway extends Error {
  constructor(nomeEnv: string) {
    super(`Configuração de gateway ausente: ${nomeEnv}`);
    this.name = 'ErroConfiguracaoGateway';
  }
}
