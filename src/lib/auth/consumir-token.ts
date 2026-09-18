import 'server-only';
import { prisma } from '@/lib/prisma';
import { hashSenha } from './senha';
import { hashToken } from './token';

export class TokenInvalido extends Error {
  constructor() {
    super('Link inválido, expirado ou já utilizado');
    this.name = 'TokenInvalido';
  }
}

/** Consome um TokenAcesso de uso único (primeiro acesso / redefinição de senha)
 *  e define a nova senha do usuário associado, em uma única transação.
 *  Retorna o id do usuário afetado. */
export async function consumirTokenEDefinirSenha(
  token: string,
  senha: string,
  finalidade: 'primeiro_acesso' | 'redefinicao_senha'
): Promise<string> {
  const hash = hashToken(token);
  const novaSenhaHash = await hashSenha(senha);

  return prisma.$transaction(async (tx) => {
    const r = await tx.tokenAcesso.updateMany({
      where: { tokenHash: hash, finalidade, usadoEm: null, expiraEm: { gt: new Date() }, usuario: { ativo: true } },
      data: { usadoEm: new Date() },
    });

    if (r.count !== 1) {
      throw new TokenInvalido();
    }

    const t = await tx.tokenAcesso.findUnique({
      where: { tokenHash: hash },
      select: { usuarioId: true },
    });

    if (!t) {
      throw new TokenInvalido();
    }

    await tx.usuario.update({
      where: { id: t.usuarioId },
      data: { senhaHash: novaSenhaHash },
    });

    return t.usuarioId;
  });
}
