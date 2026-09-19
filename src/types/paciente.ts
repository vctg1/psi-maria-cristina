// Tipos de contrato compartilhados entre cliente e servidor para /api/pacientes.
// Sem imports de servidor (fs, prisma, bcrypt, server-only) — pode ser importado
// por Client Components.

export type PacienteResumo = {
  id: string;
  usuarioId: string | null;
  nome: string;
  telefone: string;
  email: string | null;
  temLogin: boolean;
  primeiroAcessoPendente: boolean;
  ativo: boolean;
  criadoEm: string;
};

export type PacienteDetalhe = PacienteResumo & {
  dataNascimento: string | null; // YYYY-MM-DD
  cpf: string | null;
  responsavel: string | null;
  telefoneResponsavel: string | null;
  observacoesCadastro: string | null;
  origemCadastro: 'psicologa' | 'autocadastro';
  ultimoLoginEm: string | null;
  atualizadoEm: string;
};

export type PacienteEntrada = {
  nome: string;
  email?: string | null;
  telefone: string;
  dataNascimento?: string | null;
  cpf?: string | null;
  responsavel?: string | null;
  telefoneResponsavel?: string | null;
  observacoesCadastro?: string | null;
};

export type PacienteEdicao = Partial<Omit<PacienteEntrada, 'email'>> & {
  email?: string;
  ativo?: boolean;
};

export type ErroApi = { error: string; campos?: Record<string, string> };
