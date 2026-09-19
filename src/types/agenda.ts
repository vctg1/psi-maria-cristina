// Tipos de contrato compartilhados entre cliente e servidor para agenda/disponibilidade/
// consultas. Sem imports de servidor (fs, prisma, bcrypt, server-only) — pode ser importado
// por Client Components.

import type { ConsultaStatus } from './index';

export type { ConsultaStatus };

export type DiaSemana = 'segunda' | 'terca' | 'quarta' | 'quinta' | 'sexta' | 'sabado' | 'domingo';

export type HorarioAtendimentoDto = { id: string; diaSemana: DiaSemana; hora: string; ativo: boolean };

export type ExcecaoDto = { id: string; data: string; hora: string | null; motivo: string | null };

/** Mesma forma do legado `/api/disponibilidade?ano=&mes=` para não quebrar o calendário. */
export type LivresMes = { ano: number; mes: number; disponibilidades: Record<string, string[]> };

export type LivresDia = { data: string; horarios: string[] };

export type Modalidade = 'presencial' | 'online';

export type PacienteNaConsulta = { id: string; nome: string; telefone: string; temLogin: boolean };

export type ConsultaDto = {
  id: string;
  inicio: string;
  status: ConsultaStatus;
  modalidade: Modalidade | null;
  motivo: string | null;
  observacoes: string | null;
  relatorio: string | null;
  criadaPor: 'paciente' | 'psicologa';
  confirmadaEm: string | null;
  encerradaEm: string | null;
  canceladaEm: string | null;
  canceladaPor: 'paciente' | 'psicologa' | null;
  motivoCancelamento: string | null;
  criadaEm: string;
  paciente: PacienteNaConsulta;
};

export type ConsultaDtoPaciente = Omit<ConsultaDto, 'relatorio' | 'paciente'> & {
  paciente: { id: string; nome: string };
};

export type NovaConsultaEntrada = {
  pacienteId?: string;
  pacienteNovo?: {
    nome: string;
    telefone: string;
    dataNascimento?: string;
    observacoesCadastro?: string;
  };
  data: string;
  hora: string;
  modalidade: Modalidade;
  motivo?: string;
  observacoes?: string;
  repetirSemanas?: number; // 0..12
};

export type ResultadoLote = {
  criadas: ConsultaDto[];
  puladas: { data: string; motivo: 'sem_horario' | 'excecao' | 'ocupado' }[];
};

export type AgendamentoEntrada = {
  data: string;
  hora: string;
  modalidade?: Modalidade;
  motivo?: string;
  observacoes?: string;
  cadastro?: {
    nome: string;
    email: string;
    telefone: string;
    dataNascimento: string;
    cpf?: string | null;
    responsavel?: string | null;
    telefoneResponsavel?: string | null;
    senha: string;
  };
};

export type AgendamentoResposta = {
  consulta: { id: string; inicio: string; status: ConsultaStatus };
  novoCadastro: boolean;
};

export type ErroApi = { error: string; codigo?: string; campos?: Record<string, string> };
