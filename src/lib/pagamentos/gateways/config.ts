import 'server-only';
import { ErroConfiguracaoGateway } from './tipos';

/** Lê uma env obrigatória; lança `ErroConfiguracaoGateway` (nunca fallback) se ausente/vazia. */
export function envObrigatoria(nome: string): string {
  const valor = process.env[nome];
  if (!valor || valor.trim().length === 0) {
    throw new ErroConfiguracaoGateway(nome);
  }
  return valor;
}

/** URL pública base da aplicação, usada em back_urls/notification_url/callback dos gateways.
 *  Sem fallback localhost: falha explícita se `NEXT_PUBLIC_URL` faltar. Em produção exige https. */
export function baseUrlPublica(): string {
  const url = envObrigatoria('NEXT_PUBLIC_URL');
  let normalizada: URL;
  try {
    normalizada = new URL(url);
  } catch {
    throw new ErroConfiguracaoGateway('NEXT_PUBLIC_URL');
  }
  if (process.env.NODE_ENV === 'production' && normalizada.protocol !== 'https:') {
    throw new ErroConfiguracaoGateway('NEXT_PUBLIC_URL');
  }
  return url.replace(/\/+$/, '');
}
