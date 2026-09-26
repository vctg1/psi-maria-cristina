// Tipos de contrato compartilhados entre cliente e servidor para agenda/disponibilidade/
// consultas. Sem imports de servidor (fs, prisma, bcrypt, server-only) — pode ser importado
// por Client Components.

import type { ConsultaStatus } from './index';
import type { CobrancaConsulta } from './pagamento';

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
  /** Fase 6: preenchido quando a psicóloga agendou pedindo confirmação ao paciente e ele ainda
   *  não confirmou (status `agendada`). null = fluxo normal (visitante → psicóloga confirma). */
  confirmacaoSolicitadaEm: string | null;
  /** Link da videochamada (consulta online). Visível à psicóloga e ao próprio paciente. */
  linkReuniao: string | null;
  paciente: PacienteNaConsulta;
  /** Fase 5a: status de cobrança (valor efetivo, pago/em aberto). Presente para psicóloga e paciente. */
  cobranca: CobrancaConsulta;
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
  /** Fase 6 · Bloco 4: true = nasce `agendada` e o paciente confirma pelo link (e-mail e/ou wa.me);
   *  false/ausente = registro de atendimento já combinado: nasce `confirmada`. */
  pedirConfirmacao?: boolean;
  quantidade?: number; // 1..12, default 1. 1 = consulta única; N = N consultas consecutivas.
  valor?: number | null; // aplicado a todas as consultas do lote; null/ausente = valor padrão
};

export type ResultadoLote = {
  criadas: ConsultaDto[];
  puladas: { data: string; motivo: 'sem_horario' | 'excecao' | 'ocupado' }[];
  /** Fase 6: link único de confirmação (cobre todas as `criadas`) quando `pedirConfirmacao`.
   *  Só volta para a psicóloga autenticada, para ela copiar e mandar por wa.me. */
  linkConfirmacao?: string | null;
  /** true quando o paciente tem e-mail e o pedido de confirmação foi enviado. */
  emailConfirmacaoEnviado?: boolean;
};

/** Resposta de POST /api/consultas/[id]/link-confirmacao (psicóloga): gera um NOVO link e invalida o anterior. */
export type LinkConfirmacaoResposta = { link: string; expiraEm: string; emailEnviado: boolean };

/** Resposta pública de GET/POST /api/confirmacao (token no body/query, sem login). Só o necessário
 *  para a tela: nada de id de paciente, nome completo, motivo ou observações. */
export type ConfirmacaoPublicaDto = {
  estado: 'pendente' | 'confirmada' | 'ja_confirmada';
  primeiroNome: string;
  consultas: { id: string; inicio: string; modalidade: Modalidade | null }[];
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

/** Body de PATCH /api/consultas/[id]/link-reuniao (psicóloga). `link: null` remove o link. */
export type LinkReuniaoEntrada = { link: string | null; enviarEmail?: boolean };
/** Resposta: a consulta atualizada e se o e-mail saiu (false quando o paciente não tem e-mail). */
export type LinkReuniaoResposta = { consulta: ConsultaDto; emailEnviado: boolean };

/** Provedores aceitos para o link da videochamada (validação no servidor e dica na tela). */
export const PROVEDORES_REUNIAO = ['meet.google.com', 'zoom.us', 'teams.microsoft.com', 'teams.live.com'] as const;
