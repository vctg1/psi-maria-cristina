import 'server-only';

/** Lança quando `NEXT_PUBLIC_URL` está ausente, vazia, malformada ou não atende
 *  às regras exigidas (https em produção). Nunca há fallback para localhost. */
export class ErroConfiguracaoUrlPublica extends Error {
  constructor(motivo: string) {
    super(`Configuração de URL pública inválida: ${motivo}`);
    this.name = 'ErroConfiguracaoUrlPublica';
  }
}

/** URL pública base da aplicação (sem barra final), usada em links de e-mail,
 *  back_urls/notification_url/callback de gateways etc.
 *  Sem fallback localhost: falha explícita se `NEXT_PUBLIC_URL` faltar.
 *  Em produção (`NODE_ENV === 'production'`) exige `https`. */
export function baseUrlPublica(): string {
  const valor = process.env.NEXT_PUBLIC_URL;
  if (!valor || valor.trim().length === 0) {
    throw new ErroConfiguracaoUrlPublica('NEXT_PUBLIC_URL ausente');
  }

  let normalizada: URL;
  try {
    normalizada = new URL(valor);
  } catch {
    throw new ErroConfiguracaoUrlPublica('NEXT_PUBLIC_URL não é uma URL válida');
  }

  if (process.env.NODE_ENV === 'production' && normalizada.protocol !== 'https:') {
    throw new ErroConfiguracaoUrlPublica('NEXT_PUBLIC_URL deve usar https em produção');
  }

  return valor.replace(/\/+$/, '');
}

/** Monta uma URL absoluta a partir de um caminho relativo (`/agendamento?x=1`).
 *  Rejeita caminhos que não comecem com uma única barra (`/`) — em particular
 *  caminhos que comecem com `//` são recusados, pois seriam interpretados como
 *  URL para outro host. */
export function urlAbsoluta(caminho: string): string {
  if (!caminho.startsWith('/') || caminho.startsWith('//')) {
    throw new Error('Caminho inválido para urlAbsoluta: deve começar com "/" e não com "//"');
  }
  return `${baseUrlPublica()}${caminho}`;
}
