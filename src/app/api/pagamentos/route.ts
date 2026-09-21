import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/guard';
import { formatoDataValido, montarInicio } from '@/lib/agenda/tempo';
import { SELECT_PAGAMENTO, paraPagamentoDto } from '@/lib/pagamentos/cobranca';
import type { PagamentoStatus } from '@/types/pagamento';

const LIMITE = 200;
const STATUS_VALIDOS: PagamentoStatus[] = ['pendente', 'pago', 'falhou', 'expirado', 'estornado'];

// GET /api/pagamentos?status=&de=&ate=&pacienteId= — psicóloga. Histórico de pagamentos.
export async function GET(request: NextRequest) {
  try {
    const r = await requireAuth(request, 'psicologa');
    if ('erro' in r) return r.erro;

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const pacienteId = searchParams.get('pacienteId');
    const de = searchParams.get('de');
    const ate = searchParams.get('ate');

    if (status !== null && !STATUS_VALIDOS.includes(status as PagamentoStatus)) {
      return NextResponse.json({ error: 'Status inválido' }, { status: 400 });
    }
    if (de !== null && !formatoDataValido(de)) {
      return NextResponse.json({ error: 'Parâmetro "de" inválido (use YYYY-MM-DD)' }, { status: 400 });
    }
    if (ate !== null && !formatoDataValido(ate)) {
      return NextResponse.json({ error: 'Parâmetro "ate" inválido (use YYYY-MM-DD)' }, { status: 400 });
    }

    const criadoEmFiltro: { gte?: Date; lt?: Date } = {};
    if (de) criadoEmFiltro.gte = montarInicio(de, '00:00');
    if (ate) criadoEmFiltro.lt = new Date(montarInicio(ate, '00:00').getTime() + 86400000);

    const pagamentos = await prisma.pagamento.findMany({
      where: {
        ...(status ? { status: status as PagamentoStatus } : {}),
        ...(de || ate ? { criadoEm: criadoEmFiltro } : {}),
        ...(pacienteId ? { consultas: { some: { pacienteId } } } : {}),
      },
      select: SELECT_PAGAMENTO,
      orderBy: { criadoEm: 'desc' },
      take: LIMITE,
    });

    return NextResponse.json({ pagamentos: pagamentos.map(paraPagamentoDto) });
  } catch {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
