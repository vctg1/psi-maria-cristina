import 'server-only';
import { ErroConfiguracaoGateway } from './tipos';
import { baseUrlPublica as baseUrlPublicaCentral, ErroConfiguracaoUrlPublica } from '@/lib/url-publica';

/** Lê uma env obrigatória; lança `ErroConfiguracaoGateway` (nunca fallback) se ausente/vazia. */
export function envObrigatoria(nome: string): string {
  const valor = process.env[nome];
  if (!valor || valor.trim().length === 0) {
    throw new ErroConfiguracaoGateway(nome);
  }
  return valor;
}

/** URL pública base da aplicação, usada em back_urls/notification_url/callback dos gateways.
 *  Implementação centralizada em `@/lib/url-publica`; aqui só adaptamos o tipo de erro
 *  para manter o contrato existente dos gateways (`ErroConfiguracaoGateway`). */
export function baseUrlPublica(): string {
  try {
    return baseUrlPublicaCentral();
  } catch (erro) {
    if (erro instanceof ErroConfiguracaoUrlPublica) {
      throw new ErroConfiguracaoGateway('NEXT_PUBLIC_URL');
    }
    throw erro;
  }
}
