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

export interface Consulta {
  id: string;
  pacienteId: string;
  data: string; // YYYY-MM-DD
  hora: string; // HH:MM
  status: 'agendada' | 'confirmada' | 'cancelada' | 'realizada' | 'nao_compareceu';
  pagamento: 'pendente' | 'pago' | 'cancelado';
  linkMeet?: string;
  observacoes?: string;
  relatorio?: string;
  criadaEm: string;
  atualizadaEm: string;
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