import 'server-only';
import type { ConsultaStatus } from '@/types';

/** Máquina de estados de `Consulta` (PROPOSTA-schema.md §1.6). */
const TRANSICOES: Record<ConsultaStatus, ConsultaStatus[]> = {
  agendada: ['confirmada', 'cancelada'],
  confirmada: ['realizada', 'nao_compareceu', 'cancelada'],
  realizada: [],
  cancelada: [],
  nao_compareceu: [],
};

export const TERMINAIS: readonly ConsultaStatus[] = ['realizada', 'cancelada', 'nao_compareceu'];

export function podeTransitar(de: ConsultaStatus, para: ConsultaStatus): boolean {
  return TRANSICOES[de]?.includes(para) ?? false;
}
