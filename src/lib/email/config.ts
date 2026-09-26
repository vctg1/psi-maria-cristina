import 'server-only';

/** Lança quando uma variável de ambiente exigida pelo módulo de e-mail está
 *  ausente ou vazia. Nunca há fallback literal no código. */
export class ErroConfiguracaoEmail extends Error {
  constructor(nomeEnv: string) {
    super(`Configuração de e-mail ausente: ${nomeEnv}`);
    this.name = 'ErroConfiguracaoEmail';
  }
}

function envObrigatoria(nome: string): string {
  const valor = process.env[nome];
  if (!valor || valor.trim().length === 0) {
    throw new ErroConfiguracaoEmail(nome);
  }
  return valor;
}

/** Chave de API do Resend. Server-only; nunca deve chegar ao cliente, log ou resposta JSON. */
export function resendApiKey(): string {
  return envObrigatoria('RESEND_API_KEY');
}

/** Remetente usado em todos os envios, no formato `Nome <email@dominio>`.
 *  Em dev, use o sandbox do Resend: `Maria Cristina · Psicóloga <onboarding@resend.dev>`. */
export function emailRemetente(): string {
  return envObrigatoria('EMAIL_REMETENTE');
}
