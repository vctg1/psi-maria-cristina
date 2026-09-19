/** Fonte única de verdade para o status de uma consulta. Qualquer rota/componente deve importar daqui. */
export const CONSULTA_STATUS = ['agendada', 'confirmada', 'realizada', 'cancelada', 'nao_compareceu'] as const;
export type ConsultaStatus = typeof CONSULTA_STATUS[number];
/** Status que ocupam o horário (bloqueiam novo agendamento no mesmo data+hora). */
export const CONSULTA_STATUS_OCUPA_HORARIO: readonly ConsultaStatus[] = ['agendada', 'confirmada'];
export const CONSULTA_PAGAMENTO = ['pendente', 'pago', 'cancelado'] as const;
export type ConsultaPagamento = typeof CONSULTA_PAGAMENTO[number];