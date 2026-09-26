// Fase 6 · Bloco 2 — contrato do perfil da psicóloga. Sem imports de servidor.

export type PerfilPsicologaDto = {
  nome: string;
  /** E-mail de LOGIN (Usuario.email). Só leitura nesta tela. */
  email: string;
  telefone: string | null;
  crp: string | null;
  /** E-mail que recebe as respostas dos pacientes (Reply-To). null = usa o e-mail de login. */
  emailRespostas: string | null;
};

/** Body de PATCH /api/perfil — whitelist estrita. Papel e id NÃO são editáveis aqui.
 *  `email` (e-mail de LOGIN) é editável, mas exige `senhaAtual` quando muda. */
export type PerfilPsicologaEdicao = {
  nome?: string;
  telefone?: string | null;
  crp?: string | null;
  /** null ou '' = voltar a usar o e-mail de login. */
  emailRespostas?: string | null;
  /** Novo e-mail de LOGIN (Usuario.email). Exige `senhaAtual` para ter efeito. */
  email?: string;
  /** Obrigatória quando `email` muda. Nunca gravada, logada ou devolvida na resposta. */
  senhaAtual?: string;
};

/** Body de POST /api/auth/esqueci-senha (público). A resposta é SEMPRE a mesma. */
export type EsqueciSenhaEntrada = { email: string };
export type EsqueciSenhaResposta = { ok: true; mensagem: string };
