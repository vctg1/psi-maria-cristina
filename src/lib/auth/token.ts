import 'server-only';
import crypto from 'crypto';

export function gerarTokenBruto(): string {
  return crypto.randomBytes(32).toString('base64url');
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export const EXPIRACAO: Record<'primeiro_acesso' | 'redefinicao_senha', number> = {
  primeiro_acesso: 7 * 24 * 60 * 60 * 1000,
  redefinicao_senha: 60 * 60 * 1000,
};
