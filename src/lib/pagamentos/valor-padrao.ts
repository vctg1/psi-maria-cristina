import 'server-only';
import { prisma } from '@/lib/prisma';

const VALOR_PADRAO_FALLBACK = 200;

export async function obterValorPadraoSessao(): Promise<number> {
  const configuracao = await prisma.configuracao.findUnique({
    where: { id: 1 },
    select: { valorPadraoSessao: true }
  });

  if (!configuracao) {
    return VALOR_PADRAO_FALLBACK;
  }

  return Number(configuracao.valorPadraoSessao);
}
