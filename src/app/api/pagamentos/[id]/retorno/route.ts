import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { consumirLimite, chaveIp } from '@/lib/limite-taxa';
import { reconciliarSePreciso } from '@/lib/pagamentos/conciliacao';
import type { CobrancaRetornoDto } from '@/types/pagamento';

type Contexto = { params: Promise<{ id: string }> };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NAO_ENCONTRADA = { error: 'Cobrança não encontrada' };

// GET /api/pagamentos/[id]/retorno — PÚBLICA. Usada pelas páginas /pagamento/* quando quem volta
// do checkout não está logado (caso comum: paciente paga pelo link do WhatsApp). O id é o nosso
// UUID que o próprio gateway devolve na back_url. Confere o status no gateway e devolve SÓ o status
// (e o link para tentar de novo): nada de valor, paciente ou consulta.
export async function GET(request: NextRequest, { params }: Contexto) {
  try {
    const limite = await consumirLimite(chaveIp('retorno-pagamento', request), { max: 30, janelaMs: 10 * 60 * 1000 });
    if (!limite.permitido) {
      return NextResponse.json({ error: 'Muitas tentativas. Aguarde alguns minutos.' }, { status: 429 });
    }

    const { id } = await params;
    if (!UUID.test(id)) {
      return NextResponse.json(NAO_ENCONTRADA, { status: 404 });
    }

    const pagamento = await prisma.pagamento.findUnique({
      where: { id },
      select: {
        id: true,
        origem: true,
        status: true,
        gateway: true,
        referenciaExterna: true,
        pagamentoExternoId: true,
        ultimaReconciliacaoEm: true,
        linkCheckout: true,
      },
    });
    if (!pagamento || pagamento.origem !== 'online') {
      return NextResponse.json(NAO_ENCONTRADA, { status: 404 });
    }

    // Mesma reconciliação da rota autenticada (com intervalo mínimo entre consultas ao gateway).
    const status = pagamento.gateway
      ? await reconciliarSePreciso({
          id: pagamento.id,
          status: pagamento.status,
          gateway: pagamento.gateway,
          referenciaExterna: pagamento.referenciaExterna,
          pagamentoExternoId: pagamento.pagamentoExternoId,
          ultimaReconciliacaoEm: pagamento.ultimaReconciliacaoEm,
        })
      : pagamento.status;

    const dto: CobrancaRetornoDto = {
      status,
      linkCheckout: status === 'pendente' || status === 'falhou' ? pagamento.linkCheckout : null,
    };
    return NextResponse.json(dto);
  } catch {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
