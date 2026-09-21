import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/guard';
import type { ConfiguracaoDto } from '@/types/pagamento';

// GET /api/configuracao — psicóloga.
export async function GET(request: NextRequest) {
  try {
    const r = await requireAuth(request, 'psicologa');
    if ('erro' in r) return r.erro;

    const config = await prisma.configuracao.findUnique({
      where: { id: 1 },
      select: { valorPadraoSessao: true, duracaoSessaoMin: true, antecedenciaCancelamentoHoras: true, gatewayPadrao: true },
    });

    const dto: ConfiguracaoDto = {
      valorPadraoSessao: config ? Number(config.valorPadraoSessao) : 200,
      duracaoSessaoMin: config?.duracaoSessaoMin ?? 50,
      antecedenciaCancelamentoHoras: config?.antecedenciaCancelamentoHoras ?? 24,
      gatewayPadrao: config?.gatewayPadrao ?? 'mercadopago',
    };

    return NextResponse.json(dto);
  } catch {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
