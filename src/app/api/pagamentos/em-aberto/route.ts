import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/guard';
import { formatoDataValido, montarInicio } from '@/lib/agenda/tempo';
import { CONSULTA_STATUS_COBRAVEL, SELECT_COBRANCA, montarCobranca, obterValorPadraoSessao } from '@/lib/pagamentos/cobranca';
import type { ConsultaCobrancaDto } from '@/types/pagamento';
import type { Modalidade } from '@/types/agenda';
import type { ConsultaStatus } from '@/types';

const LIMITE = 500;

// GET /api/pagamentos/em-aberto?pacienteId=&de=&ate= — psicóloga.
export async function GET(request: NextRequest) {
  try {
    const r = await requireAuth(request, 'psicologa');
    if ('erro' in r) return r.erro;

    const { searchParams } = new URL(request.url);
    const pacienteId = searchParams.get('pacienteId');
    const de = searchParams.get('de');
    const ate = searchParams.get('ate');

    if (de !== null && !formatoDataValido(de)) {
      return NextResponse.json({ error: 'Parâmetro "de" inválido (use YYYY-MM-DD)' }, { status: 400 });
    }
    if (ate !== null && !formatoDataValido(ate)) {
      return NextResponse.json({ error: 'Parâmetro "ate" inválido (use YYYY-MM-DD)' }, { status: 400 });
    }

    const inicioFiltro: { gte?: Date; lt?: Date } = {};
    if (de) inicioFiltro.gte = montarInicio(de, '00:00');
    if (ate) inicioFiltro.lt = new Date(montarInicio(ate, '00:00').getTime() + 86400000);

    const [consultas, valorPadrao] = await Promise.all([
      prisma.consulta.findMany({
        where: {
          pagamentoId: null,
          status: { in: [...CONSULTA_STATUS_COBRAVEL] },
          ...(pacienteId ? { pacienteId } : {}),
          ...(de || ate ? { inicio: inicioFiltro } : {}),
        },
        select: {
          id: true,
          inicio: true,
          status: true,
          modalidade: true,
          // reusa o select canônico de cobrança (valor, pagamentoId, pagamento) — evita divergir
          // de `montarCobranca` quando o modelo de pagamento muda
          ...SELECT_COBRANCA,
          paciente: { select: { id: true, nome: true } },
        },
        orderBy: { inicio: 'asc' },
        take: LIMITE,
      }),
      obterValorPadraoSessao(),
    ]);

    const lista: ConsultaCobrancaDto[] = consultas.map((c) => ({
      id: c.id,
      inicio: c.inicio.toISOString(),
      status: c.status as ConsultaStatus,
      modalidade: c.modalidade as Modalidade | null,
      paciente: { id: c.paciente.id, nome: c.paciente.nome },
      cobranca: montarCobranca(c, valorPadrao),
    }));

    const total = lista.reduce((soma, c) => soma + c.cobranca.valor, 0);

    return NextResponse.json({ consultas: lista, total: Math.round(total * 100) / 100 });
  } catch {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
