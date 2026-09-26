import 'server-only';
import crypto from 'crypto';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@/generated/prisma/client';

/** Deriva uma chave de LimiteTaxa a partir de um valor sensível (e-mail, etc.) sem
 *  jamais guardar o valor em claro: `${prefixo}:${sha256(valor normalizado)}`. */
export function chaveHash(prefixo: string, valor: string): string {
  const normalizado = valor.toLowerCase().trim();
  const digest = crypto.createHash('sha256').update(normalizado).digest('hex');
  return `${prefixo}:${digest}`;
}

/** Extrai o IP do cliente. Ordem de confiança:
 *  1. `x-real-ip` — o Nginx do deploy define `X-Real-IP $remote_addr`, SOBRESCREVENDO qualquer
 *     valor enviado pelo cliente (deploy/nginx-*.conf).
 *  2. ÚLTIMO item de `x-forwarded-for` — é o que o proxy mais próximo acrescentou. O PRIMEIRO item
 *     é controlado pelo cliente (`$proxy_add_x_forwarded_for` só acrescenta), então nunca é usado:
 *     um `X-Forwarded-For` forjado por requisição anularia o limite por IP (M28).
 *  Chamada direta ao Next, sem Nginx, continua forjável — por isso o limite por e-mail também existe. */
export function ipDaRequisicao(request: NextRequest): string {
  const real = request.headers.get('x-real-ip')?.trim();
  if (real) return real;
  const ultimo = request.headers.get('x-forwarded-for')?.split(',').pop()?.trim();
  if (ultimo) return ultimo;
  return 'desconhecido';
}

/** Chave de limite por IP com o IP em SHA-256 — IP é dado pessoal (LGPD) e não fica em claro
 *  na tabela `limite_taxa`, conforme o comentário do schema. */
export function chaveIp(prefixo: string, request: NextRequest): string {
  return chaveHash(`${prefixo}:ip`, ipDaRequisicao(request));
}

export type ResultadoLimite = { permitido: boolean; restante: number };

/** Limite de taxa de janela fixa sobre a tabela LimiteTaxa. Atômico: lê e escreve dentro
 *  de uma transação Serializable, então uma corrida entre duas requisições concorrentes
 *  para a mesma chave faz uma delas falhar com P2034 (conflito de serialização) — nesse
 *  caso, e também em eventual P2002 de criação concorrente, tratamos como "não permitido"
 *  em vez de propagar o erro (falha fechada: mais seguro para um limite anti-abuso do que
 *  deixar passar). */
export async function consumirLimite(
  chave: string,
  { max, janelaMs }: { max: number; janelaMs: number }
): Promise<ResultadoLimite> {
  try {
    return await prisma.$transaction(
      async (tx) => {
        const agora = new Date();
        const registro = await tx.limiteTaxa.findUnique({ where: { chave } });

        if (!registro || agora.getTime() - registro.janelaInicio.getTime() >= janelaMs) {
          await tx.limiteTaxa.upsert({
            where: { chave },
            create: { chave, janelaInicio: agora, contagem: 1 },
            update: { janelaInicio: agora, contagem: 1 },
          });
          return { permitido: true, restante: max - 1 };
        }

        if (registro.contagem >= max) {
          return { permitido: false, restante: 0 };
        }

        await tx.limiteTaxa.update({
          where: { chave },
          data: { contagem: { increment: 1 } },
        });
        return { permitido: true, restante: max - (registro.contagem + 1) };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 5000, timeout: 10000 }
    );
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === 'P2034' || error.code === 'P2002')
    ) {
      return { permitido: false, restante: 0 };
    }
    throw error;
  }
}
