import 'server-only';
import { SignJWT, jwtVerify } from 'jose';

export const COOKIE_SESSAO = 'psi_sessao';
export const DURACAO_S = 8 * 60 * 60;

export type Sessao = { sub: string; papel: 'psicologa' | 'paciente'; pacienteId?: string };

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET ausente ou curto');
  }
  return new TextEncoder().encode(secret);
}

export async function assinarSessao(s: Sessao): Promise<string> {
  const secret = getSecret();
  return new SignJWT({ papel: s.papel, pacienteId: s.pacienteId })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(s.sub)
    .setIssuedAt()
    .setExpirationTime('8h')
    .sign(secret);
}

export async function verificarSessao(token: string): Promise<Sessao | null> {
  try {
    const secret = getSecret();
    const { payload } = await jwtVerify(token, secret, { algorithms: ['HS256'] });
    const sub = payload.sub;
    const papel = payload.papel;
    if (typeof sub !== 'string' || (papel !== 'psicologa' && papel !== 'paciente')) {
      return null;
    }
    const pacienteId = typeof payload.pacienteId === 'string' ? payload.pacienteId : undefined;
    return { sub, papel, pacienteId };
  } catch {
    return null;
  }
}
