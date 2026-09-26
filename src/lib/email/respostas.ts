import 'server-only';
import { prisma } from '@/lib/prisma';

const REGEX_EMAIL_SIMPLES = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;

/** Endereço que recebe as respostas dos pacientes (Reply-To). Vem do cadastro da psicóloga
 *  (`PerfilPsicologa.emailRespostas`), não de uma env — cada psicóloga define o e-mail que ela
 *  realmente lê. `null` no cadastro = usa o e-mail de login (`Usuario.email`).
 *
 *  Sistema de uma psicóloga só: se um dia houver mais de uma conta com papel `psicologa`, usamos
 *  a mais antiga (a do seed), que é a psicóloga "dona" do sistema.
 *
 *  Nunca lança: qualquer erro de banco ou valor inválido no cadastro volta como `null`
 *  (o chamador simplesmente envia sem Reply-To). */
export async function emailParaRespostas(): Promise<string | null> {
  try {
    const usuario = await prisma.usuario.findFirst({
      where: { papel: 'psicologa', ativo: true },
      orderBy: { criadoEm: 'asc' },
      select: { email: true, perfilPsicologa: { select: { emailRespostas: true } } },
    });

    const candidato = usuario?.perfilPsicologa?.emailRespostas ?? usuario?.email;
    if (!candidato) return null;
    if (!REGEX_EMAIL_SIMPLES.test(candidato)) return null;

    return candidato;
  } catch {
    return null;
  }
}
