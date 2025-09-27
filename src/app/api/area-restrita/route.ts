import { NextRequest, NextResponse } from 'next/server';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const pacientesPath = join(process.cwd(), 'src/data/pacientes.json');
const consultasPath = join(process.cwd(), 'src/data/consultas.json');
const notificacoesPath = join(process.cwd(), 'src/data/notificacoes.json');

function getPacientes() {
  try {
    const data = readFileSync(pacientesPath, 'utf8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

function getConsultas() {
  try {
    const data = readFileSync(consultasPath, 'utf8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

function saveConsultas(consultas: any[]) {
  writeFileSync(consultasPath, JSON.stringify(consultas, null, 2));
}

function getNotificacoes() {
  try {
    const data = readFileSync(notificacoesPath, 'utf8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

function saveNotificacoes(notificacoes: any[]) {
  writeFileSync(notificacoesPath, JSON.stringify(notificacoes, null, 2));
}

// Login para área restrita
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, senha, tipo } = body;

    if (tipo === 'psicologa') {
      // Login da psicóloga (credenciais fixas para este exemplo)
      if (email === 'psicologa@mariacristina.com' && senha === 'admin123') {
        return NextResponse.json({
          success: true,
          tipo: 'psicologa',
          nome: 'Maria Cristina'
        });
      }
    } else {
      // Login do paciente
      const pacientes = getPacientes();
      const paciente = pacientes.find((p: any) => p.email === email);
      
      if (paciente && senha === paciente.id.slice(-8)) {
        const consultas = getConsultas();
        const consultasPaciente = consultas.filter((c: any) => c.pacienteId === paciente.id);
        
        return NextResponse.json({
          success: true,
          tipo: 'paciente',
          paciente,
          consultas: consultasPaciente
        });
      }
    }

    return NextResponse.json({ error: 'Credenciais inválidas' }, { status: 401 });
  } catch (error) {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

// Endpoints para área restrita da psicóloga
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const id = searchParams.get('id');

    switch (action) {
      case 'dashboard': {
        const consultas = getConsultas();
        const pacientes = getPacientes();
        const notificacoes = getNotificacoes();

        const hoje = new Date().toISOString().split('T')[0];
        const proximosSete = new Date();
        proximosSete.setDate(proximosSete.getDate() + 7);
        const proximosSeteDias = proximosSete.toISOString().split('T')[0];

        const consultasHoje = consultas.filter((c: any) => c.data === hoje);
        const consultasProximas = consultas.filter((c: any) => c.data > hoje && c.data <= proximosSeteDias);

        return NextResponse.json({
          consultas,
          pacientes,
          notificacoes: notificacoes.slice(0, 10), // Últimas 10 notificações
          consultasHoje,
          consultasProximas
        });
      }

      case 'consultas': {
        const consultas = getConsultas();
        const pacientes = getPacientes();

        const consultasComPaciente = consultas.map((consulta: any) => {
          const paciente = pacientes.find((p: any) => p.id === consulta.pacienteId);
          return { ...consulta, paciente };
        });

        return NextResponse.json(consultasComPaciente);
      }

      case 'pacientes': {
        const pacientes = getPacientes();
        const consultas = getConsultas();

        if (id) {
          const paciente = pacientes.find((p: any) => p.id === id);
          if (paciente) {
            const consultasPaciente = consultas.filter((c: any) => c.pacienteId === id);
            return NextResponse.json({ ...paciente, consultas: consultasPaciente });
          }
          return NextResponse.json({ error: 'Paciente não encontrado' }, { status: 404 });
        }

        return NextResponse.json(pacientes);
      }

      case 'notificacoes': {
        const notificacoes = getNotificacoes();
        return NextResponse.json(notificacoes);
      }

      default:
        return NextResponse.json({ error: 'Ação não reconhecida' }, { status: 400 });
    }
  } catch (error) {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

// Atualizar consulta (adicionar link do Meet, alterar status, etc.)
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { consultaId, updates } = body;

    let consultas = getConsultas();
    const consultaIndex = consultas.findIndex((c: any) => c.id === consultaId);

    if (consultaIndex === -1) {
      return NextResponse.json({ error: 'Consulta não encontrada' }, { status: 404 });
    }

    consultas[consultaIndex] = {
      ...consultas[consultaIndex],
      ...updates,
      atualizadaEm: new Date().toISOString()
    };

    saveConsultas(consultas);

    return NextResponse.json(consultas[consultaIndex]);
  } catch (error) {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

// Marcar notificação como lida ou todas como lidas
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { notificacaoId, marcarTodas } = body;

    let notificacoes = getNotificacoes();
    
    if (marcarTodas) {
      // Marcar todas as notificações como lidas
      notificacoes = notificacoes.map((n: any) => ({ ...n, lida: true }));
    } else if (notificacaoId) {
      // Marcar uma notificação específica como lida
      const notificacaoIndex = notificacoes.findIndex((n: any) => n.id === notificacaoId);
      if (notificacaoIndex !== -1) {
        notificacoes[notificacaoIndex].lida = true;
      }
    }

    saveNotificacoes(notificacoes);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}