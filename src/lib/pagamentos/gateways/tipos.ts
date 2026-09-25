import 'server-only';
import type { NextRequest } from 'next/server';
import type { Gateway } from '@/types/pagamento';

/** Status normalizado devolvido por `consultarStatus`. `statusExterno`/`statusExternoDetalhe`
 *  são o valor CRU do gateway (para depuração interna) — nunca vazam ao cliente como estão. */
export type StatusExterno = {
  status: 'pendente' | 'pago' | 'falhou' | 'expirado';
  statusExterno: string;
  statusExternoDetalhe?: string | null;
  pagamentoExternoId?: string | null;
  pagoEm?: Date | null;
  valorPago?: number | null;
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

  consultarStatus(ref: { referenciaExterna: string; pagamentoExternoId?: string | null }): Promise<StatusExterno>;

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
