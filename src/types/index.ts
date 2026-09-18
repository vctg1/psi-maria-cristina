export interface Paciente {
  id: string;
  nome: string;
  email: string;
  telefone: string;
  dataNascimento: string;
  cpf: string;
  responsavel?: string; // Para menores de idade
  telefoneResponsavel?: string;
  criadoEm: string;
}

export interface HorarioDisponivel {
  id: string;
  data: string; // YYYY-MM-DD
  hora: string; // HH:MM
  tipo: 'unico' | 'recorrente';
  diaSemana?: number; // 0-6 para recorrente
  ativo: boolean;
  criadoEm: string;
}

/** Fonte única de verdade para o status de uma consulta. Qualquer rota/componente deve importar daqui. */
export const CONSULTA_STATUS = ['agendada', 'confirmada', 'realizada', 'cancelada', 'nao_compareceu'] as const;
export type ConsultaStatus = typeof CONSULTA_STATUS[number];
/** Status que ocupam o horário (bloqueiam novo agendamento no mesmo data+hora). */
export const CONSULTA_STATUS_OCUPA_HORARIO: readonly ConsultaStatus[] = ['agendada', 'confirmada'];
export const CONSULTA_PAGAMENTO = ['pendente', 'pago', 'cancelado'] as const;
export type ConsultaPagamento = typeof CONSULTA_PAGAMENTO[number];

export interface Consulta {
  id: string;
  pacienteId: string;
  data: string; // YYYY-MM-DD
  hora: string; // HH:MM
  status: ConsultaStatus;
  pagamento: ConsultaPagamento;
  linkMeet?: string;
  observacoes?: string; // nome canônico do campo de observação; não usar "observacao" (singular)
  relatorio?: string;
  criadaEm: string;
  atualizadaEm: string;
  pagamentoId?: number;
  pagamentoData?: string;
}

export interface ConfigSite {
  nome: string;
  email: string;
  telefone: string;
  valorConsulta: number;
  sobre: string;
  especialidades: string[];
  horarioFuncionamento: {
    inicio: string;
    fim: string;
    diasSemana: number[];
  };
  dadosPagamento: {
    pix: string;
    banco?: string;
    agencia?: string;
    conta?: string;
  };
}

export interface Notificacao {
  id: string;
  tipo: 'novo_agendamento' | 'cancelamento' | 'lembrete';
  titulo: string;
  mensagem: string;
  lida: boolean;
  criadaEm: string;
}