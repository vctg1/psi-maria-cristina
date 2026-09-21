// Tipos de contrato compartilhados entre cliente e servidor para pagamentos (Fase 5a — manual).
// Sem imports de servidor (fs, prisma, server-only) — pode ser importado por Client Components.
// REGRA: o valor de uma cobrança NUNCA vem do paciente. Vem de Configuracao.valorPadraoSessao ou é
// definido pela psicóloga (rota com guarda 'psicologa'). O paciente só LÊ o status.

import type { ConsultaStatus } from './index';

/** Meios aceitos no registro MANUAL pela psicóloga. `boleto`/`cartao` são só do fluxo online (5b). */
export const METODOS_MANUAIS = ['pix', 'dinheiro', 'maquininha', 'outro'] as const;
export type MetodoManual = (typeof METODOS_MANUAIS)[number];

export const METODO_LABEL: Record<MetodoManual | 'boleto' | 'cartao', string> = {
  pix: 'PIX',
  dinheiro: 'Dinheiro',
  maquininha: 'Maquininha',
  boleto: 'Boleto',
  cartao: 'Cartão',
  outro: 'Outro',
};

export type PagamentoStatus = 'pendente' | 'pago' | 'falhou' | 'expirado' | 'estornado';
export type OrigemPagamento = 'manual' | 'online';

/** Resumo de cobrança embutido em cada consulta (psicóloga e paciente veem a mesma forma). */
export type CobrancaConsulta = {
  /** `pago` = coberta por um Pagamento com status pago · `em_aberto` = sem pagamento e cobrável ·
   *  `nao_cobravel` = cancelada/não compareceu sem pagamento (não entra em "em aberto"). */
  situacao: 'pago' | 'em_aberto' | 'nao_cobravel';
  /** Valor efetivo em reais: Consulta.valor quando definido, senão Configuracao.valorPadraoSessao. */
  valor: number;
  /** true quando a psicóloga definiu um valor específico para esta consulta. */
  valorPersonalizado: boolean;
  pagamentoId: string | null;
  metodo: MetodoManual | 'boleto' | 'cartao' | null;
  /** YYYY-MM-DD (manual) ou ISO (online). */
  recebidoEm: string | null;
};

/** Consulta vista pela tela Financeiro (em aberto) — só o necessário. */
export type ConsultaCobrancaDto = {
  id: string;
  inicio: string; // ISO
  status: ConsultaStatus;
  modalidade: 'presencial' | 'online' | null;
  paciente: { id: string; nome: string };
  cobranca: CobrancaConsulta;
};

export type PagamentoDto = {
  id: string;
  origem: OrigemPagamento;
  status: PagamentoStatus;
  metodo: MetodoManual | 'boleto' | 'cartao' | null;
  valor: number;
  recebidoEm: string | null; // YYYY-MM-DD
  estornadoEm: string | null; // ISO
  observacao: string | null;
  criadoEm: string; // ISO
  consultas: { id: string; inicio: string; status: ConsultaStatus; paciente: { id: string; nome: string } }[];
};

/** Body de POST /api/pagamentos/manual (psicóloga). */
export type PagamentoManualEntrada = {
  consultaIds: string[]; // 1..50, todas em aberto
  metodo: MetodoManual;
  /** Opcional: valor total recebido (pacote/desconto). Default = soma dos valores efetivos das consultas. */
  valor?: number;
  recebidoEm: string; // YYYY-MM-DD, não futuro
  observacao?: string;
};

/** Body de PATCH /api/consultas/[id]/valor (psicóloga). `null` volta ao valor padrão. */
export type ValorConsultaEntrada = { valor: number | null };

export type ConfiguracaoDto = {
  valorPadraoSessao: number;
  duracaoSessaoMin: number;
  antecedenciaCancelamentoHoras: number;
  gatewayPadrao: 'mercadopago' | 'asaas';
};

export const PAGAMENTO_VALOR_MAX = 100000; // teto de sanidade (R$)
export const PAGAMENTO_CONSULTAS_MAX = 50;
