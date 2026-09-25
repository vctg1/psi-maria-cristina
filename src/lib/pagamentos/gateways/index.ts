import 'server-only';
import type { Gateway } from '@/types/pagamento';
import type { GatewayPagamentoAdapter } from './tipos';
import { mercadoPagoAdapter } from './mercadopago';
import { asaasAdapter } from './asaas';

const ADAPTERS: Record<Gateway, GatewayPagamentoAdapter> = {
  mercadopago: mercadoPagoAdapter,
  asaas: asaasAdapter,
};

export function obterAdapter(gateway: Gateway): GatewayPagamentoAdapter {
  return ADAPTERS[gateway];
}

export type { GatewayPagamentoAdapter, StatusExterno, CobrancaCriada, EventoWebhook } from './tipos';
export { ErroConfiguracaoGateway } from './tipos';
