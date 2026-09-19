import { NextRequest, NextResponse } from 'next/server';
import { horariosLivresDoDia, livresDoMes } from '@/lib/agenda/disponibilidade';
import { formatoDataValido } from '@/lib/agenda/tempo';
import type { LivresDia, LivresMes } from '@/types/agenda';

// GET /api/disponibilidade?ano=&mes= (mes 1-12) → LivresMes
// GET /api/disponibilidade?data=YYYY-MM-DD → LivresDia
// Rota pública. Nenhum dado de paciente é exposto aqui.
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const dataParam = searchParams.get('data');

    if (dataParam !== null) {
      if (!formatoDataValido(dataParam)) {
        return NextResponse.json({ error: 'Data inválida (use YYYY-MM-DD)' }, { status: 400 });
      }
      const horarios = await horariosLivresDoDia(dataParam);
      const resposta: LivresDia = { data: dataParam, horarios };
      return NextResponse.json(resposta);
    }

    const anoParam = searchParams.get('ano');
    const mesParam = searchParams.get('mes');
    const ano = anoParam !== null ? parseInt(anoParam, 10) : new Date().getFullYear();
    const mes = mesParam !== null ? parseInt(mesParam, 10) : new Date().getMonth() + 1;

    if (!Number.isInteger(ano) || ano < 1900 || ano > 2999 || !Number.isInteger(mes) || mes < 1 || mes > 12) {
      return NextResponse.json({ error: 'Parâmetros inválidos. Use ano (ex: 2025) e mes (1-12)' }, { status: 400 });
    }

    const disponibilidades = await livresDoMes(ano, mes);
    const resposta: LivresMes = { ano, mes, disponibilidades };
    return NextResponse.json(resposta);
  } catch {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
