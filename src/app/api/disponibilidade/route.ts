import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

interface HorarioDisponivel {
  id: string;
  diaSemana: number; // 1-7 (1=Segunda, 7=Domingo)
  hora: string;
  tipo: string;
  ativo: boolean;
}

interface ConsultaAgendada {
  id: string;
  pacienteId: string;
  data: string;
  hora: string;
  status: 'agendada' | 'confirmada' | 'cancelada' | 'realizada';
  pagamento?: string;
  criadaEm: string;
  atualizadaEm: string;
}

// Função para gerar todas as datas de um mês
function gerarDatasDoMes(ano: number, mes: number): string[] {
  const datas: string[] = [];
  const diasNoMes = new Date(ano, mes + 1, 0).getDate();
  
  for (let dia = 1; dia <= diasNoMes; dia++) {
    const data = new Date(ano, mes, dia);
    datas.push(data.toISOString().split('T')[0]);
  }
  
  return datas;
}

// Função para verificar se uma data tem horários disponíveis
function verificarDisponibilidadeData(
  dataStr: string,
  horariosDisponiveis: HorarioDisponivel[],
  consultasAgendadas: ConsultaAgendada[]
): string[] {
  const data = new Date(dataStr + 'T00:00:00');
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  
  // Não permitir datas passadas
  if (data < hoje) {
    return [];
  }
  
  // Não permitir domingos (JavaScript: 0=Domingo)
  if (data.getDay() === 0) {
    return [];
  }
  
  // Converter dia da semana do JavaScript (0=Domingo) para nosso sistema (1=Segunda)
  const dayOfWeekJS = data.getDay();
  const dayOfWeekOurSystem = dayOfWeekJS === 0 ? 7 : dayOfWeekJS;
  
  // Buscar horários disponíveis para este dia da semana
  const horariosParaEsteDia = horariosDisponiveis.filter(h => 
    h.diaSemana === dayOfWeekOurSystem && h.ativo
  );
  
  if (horariosParaEsteDia.length === 0) {
    return [];
  }
  
  // Verificar quais horários já estão ocupados nesta data específica
  const horariosOcupados = consultasAgendadas
    .filter(consulta => 
      consulta.data === dataStr && 
      consulta.status !== 'cancelada'
    )
    .map(consulta => consulta.hora);
  
  // Retornar horários livres
  const horariosLivres = horariosParaEsteDia
    .map(h => h.hora)
    .filter(horario => !horariosOcupados.includes(horario))
    .sort();
  
  return horariosLivres;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const ano = parseInt(searchParams.get('ano') || new Date().getFullYear().toString());
    const mes = parseInt(searchParams.get('mes') || new Date().getMonth().toString());
    
    // Validar parâmetros
    if (isNaN(ano) || isNaN(mes) || mes < 0 || mes > 11) {
      return NextResponse.json(
        { error: 'Parâmetros inválidos. Use ano (ex: 2025) e mes (0-11)' },
        { status: 400 }
      );
    }
    
    const dataPath = path.join(process.cwd(), 'src', 'data');
    
    // Ler horários disponíveis
    const horariosPath = path.join(dataPath, 'horarios-disponiveis.json');
    let horariosDisponiveis: HorarioDisponivel[] = [];
    
    if (fs.existsSync(horariosPath)) {
      const horariosData = fs.readFileSync(horariosPath, 'utf-8');
      horariosDisponiveis = JSON.parse(horariosData);
    }
    
    // Ler consultas agendadas
    const consultasPath = path.join(dataPath, 'consultas.json');
    let consultasAgendadas: ConsultaAgendada[] = [];
    
    if (fs.existsSync(consultasPath)) {
      const consultasData = fs.readFileSync(consultasPath, 'utf-8');
      consultasAgendadas = JSON.parse(consultasData);
    }
    
    // Gerar todas as datas do mês
    const datasDoMes = gerarDatasDoMes(ano, mes);
    
    // Verificar disponibilidade para cada data
    const disponibilidades: { [data: string]: string[] } = {};
    
    for (const dataStr of datasDoMes) {
      const horariosLivres = verificarDisponibilidadeData(
        dataStr,
        horariosDisponiveis,
        consultasAgendadas
      );
      
      if (horariosLivres.length > 0) {
        disponibilidades[dataStr] = horariosLivres;
      }
    }
    
    return NextResponse.json({
      ano,
      mes,
      disponibilidades,
      totalDatasDisponiveis: Object.keys(disponibilidades).length,
      periodo: `${ano}-${(mes + 1).toString().padStart(2, '0')}`
    });
    
  } catch (error) {
    console.error('Erro ao buscar disponibilidades do mês:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}