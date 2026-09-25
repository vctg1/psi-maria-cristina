import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/guard';
import { reconciliarSePreciso } from '@/lib/pagamentos/conciliacao';
import type { CobrancaOnlineDto } from '@/types/pagamento';

type Contexto = { params: Promise<{ id: string }> };

// GET /api/pagamentos/[id]/cobranca — psicóloga vê qualquer; paciente só a própria. 404 idêntico
// em qualquer caso de não autorizado (não vaza existência do pagamento).
export async function GET(request: NextRequest, { params }: Contexto) {
  try {
    const r = await requireAuth(request);
    if ('erro' in r) return r.erro;
    const { auth } = r;

    const { id } = await params;

    const pagamento = await prisma.pagamento.findUnique({
      where: { id },
      select: {
        id: true,
        origem: true,
        gateway: true,
        status: true,
        valor: true,
        referenciaExterna: true,
        pagamentoExternoId: true,
        linkCheckout: true,
        expiraEm: true,
        pagoEm: true,
        criadoEm: true,
        ultimaReconciliacaoEm: true,
        consultas: { select: { id: true, inicio: true, pacienteId: true, paciente: { select: { id: true, nome: true } } } },
      },
    });

    if (!pagamento || pagamento.origem !== 'online' || pagamento.consultas.length === 0) {
      return NextResponse.json({ error: 'Pagamento não encontrado' }, { status: 404 });
    }

    const donoConfere =
      auth.papel === 'psicologa' || pagamento.consultas.some((c) => c.pacienteId === auth.pacienteId);
    if (!donoConfere) {
      return NextResponse.json({ error: 'Pagamento não encontrado' }, { status: 404 });
    }

    let statusFinal = pagamento.status;
    if (pagamento.gateway) {
      statusFinal = await reconciliarSePreciso({
        id: pagamento.id,
        status: pagamento.status,
        gateway: pagamento.gateway,
        referenciaExterna: pagamento.referenciaExterna,
        pagamentoExternoId: pagamento.pagamentoExternoId,
        ultimaReconciliacaoEm: pagamento.ultimaReconciliacaoEm,
      });
    }

    // Recarrega campos que a reconciliação pode ter alterado (linkCheckout não muda, mas pagoEm sim).
    const atualizado =
      statusFinal !== pagamento.status
        ? await prisma.pagamento.findUniqueOrThrow({
            where: { id },
            select: { status: true, linkCheckout: true, expiraEm: true, pagoEm: true },
          })
        : pagamento;

    const dto: CobrancaOnlineDto = {
      pagamentoId: pagamento.id,
      gateway: pagamento.gateway ?? 'mercadopago',
      status: atualizado.status,
      valor: Number(pagamento.valor),
      linkCheckout: atualizado.linkCheckout,
      expiraEm: atualizado.expiraEm ? atualizado.expiraEm.toISOString() : null,
      pagoEm: atualizado.pagoEm ? atualizado.pagoEm.toISOString() : null,
      criadoEm: pagamento.criadoEm.toISOString(),
      consultas: pagamento.consultas.map((c) => ({
        id: c.id,
        inicio: c.inicio.toISOString(),
        paciente: { id: c.paciente.id, nome: c.paciente.nome },
      })),
    };

    return NextResponse.json(dto);
  } catch {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
