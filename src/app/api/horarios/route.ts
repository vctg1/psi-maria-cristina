import { NextRequest, NextResponse } from 'next/server';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { HorarioDisponivel } from '@/types';

const horariosPath = join(process.cwd(), 'src/data/horarios-disponiveis.json');
const consultasPath = join(process.cwd(), 'src/data/consultas.json');

function getHorarios(): HorarioDisponivel[] {
  try {
    const data = readFileSync(horariosPath, 'utf8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

function saveHorarios(horarios: HorarioDisponivel[]) {
  writeFileSync(horariosPath, JSON.stringify(horarios, null, 2));
}

function getConsultas() {
  try {
    const data = readFileSync(consultasPath, 'utf8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const data = searchParams.get('data');
    const disponiveisApenas = searchParams.get('disponiveis') === 'true';

    let horarios = getHorarios();
    
    // Se for solicitado apenas horários disponíveis, filtrar os já agendados
    if (disponiveisApenas && data) {
      const consultas = getConsultas();
      
      // Criar mapa de consultas agendadas para a data específica
      const consultasNaData = consultas
        .filter((c: any) => ['agendada', 'confirmada'].includes(c.status) && c.data === data)
        .map((c: any) => c.hora);

      // Converter o dia da semana do JavaScript (0=domingo, 1=segunda) 
      // para o nosso sistema (1=segunda, 2=terça, etc.)
      const dataObj = new Date(data + 'T12:00:00'); // Adicionar hora para evitar problemas de timezone
      const dayOfWeekJS = dataObj.getDay(); // 0=domingo, 1=segunda, etc.
      const dayOfWeekOurSystem = dayOfWeekJS === 0 ? 7 : dayOfWeekJS; // 1=segunda, 7=domingo

      // Filtrar horários disponíveis para a data específica
      horarios = horarios.filter(h => {
        // Só horários ativos
        if (!h.ativo) return false;
        
        if (h.tipo === 'unico') {
          // Horário único: deve ser exatamente na data solicitada e não ter consulta agendada
          return h.data === data && !consultasNaData.includes(h.hora);
        } else {
          // Horário recorrente: deve coincidir com o dia da semana e não ter consulta agendada nesta data específica
          return h.diaSemana === dayOfWeekOurSystem && !consultasNaData.includes(h.hora);
        }
      });
    } else if (!disponiveisApenas) {
      // Se não for para filtrar disponíveis, retornar todos os horários
      horarios = horarios.filter(h => h.ativo);
    }

    return NextResponse.json(horarios);
  } catch (error) {
    console.error('Erro na API de horários:', error);
    return NextResponse.json({ error: 'Erro ao buscar horários' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { data, hora, tipo, diaSemana } = body;

    if (!hora || !tipo) {
      return NextResponse.json({ error: 'Dados obrigatórios não fornecidos' }, { status: 400 });
    }

    if (tipo === 'unico' && !data) {
      return NextResponse.json({ error: 'Data é obrigatória para horário único' }, { status: 400 });
    }

    if (tipo === 'recorrente' && diaSemana === undefined) {
      return NextResponse.json({ error: 'Dia da semana é obrigatório para horário recorrente' }, { status: 400 });
    }

    const horarios = getHorarios();

    const novoHorario: HorarioDisponivel = {
      id: uuidv4(),
      data: data || '',
      hora,
      tipo,
      diaSemana: tipo === 'recorrente' ? diaSemana : undefined,
      ativo: true,
      criadoEm: new Date().toISOString()
    };

    horarios.push(novoHorario);
    saveHorarios(horarios);

    return NextResponse.json(novoHorario);
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao criar horário' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID não fornecido' }, { status: 400 });
    }

    let horarios = getHorarios();
    horarios = horarios.filter(h => h.id !== id);
    saveHorarios(horarios);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao deletar horário' }, { status: 500 });
  }
}