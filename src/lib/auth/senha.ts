import 'server-only';
import bcrypt from 'bcrypt';

const CUSTO = 12;

// Hash dummy gerado uma vez no import; usado para equalizar tempo de resposta
// quando o usuário não existe (evita enumeração de email por timing).
export const HASH_DUMMY = bcrypt.hashSync('dummy-timing', CUSTO);

export async function hashSenha(senha: string): Promise<string> {
  return bcrypt.hash(senha, CUSTO);
}

export async function compararSenha(senha: string, hash: string): Promise<boolean> {
  return bcrypt.compare(senha, hash);
}

export function validarForcaSenha(senha: string): string | null {
  if (typeof senha !== 'string' || senha.length < 8) {
    return 'A senha deve ter no mínimo 8 caracteres';
  }
  return null;
}
