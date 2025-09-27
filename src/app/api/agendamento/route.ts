import { NextRequest, NextResponse } from 'next/server';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { Paciente, Consulta } from '@/types';

const pacientesPath = join(process.cwd(), 'src/data/pacientes.json');
const consultasPath = join(process.cwd(), 'src/data/consultas.json');
const notificacoesPath = join(process.cwd(), 'src/data/notificacoes.json');

function getPacientes(): Paciente[] {
  try {
    const data = readFileSync(pacientesPath, 'utf8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

function savePacientes(pacientes: Paciente[]) {
  writeFileSync(pacientesPath, JSON.stringify(pacientes, null, 2));
}

function getConsultas(): Consulta[] {
  try {
    const data = readFileSync(consultasPath, 'utf8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

function saveConsultas(consultas: Consulta[]) {
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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { paciente, data, hora, metodoPagamento } = body;

    // Validação básica
    if (!paciente || !data || !hora) {
      return NextResponse.json({ error: 'Dados obrigatórios não fornecidos' }, { status: 400 });
    }

    const { nome, email, telefone, dataNascimento, cpf, responsavel, telefoneResponsavel } = paciente;

    if (!nome || !email || !telefone || !dataNascimento || !cpf) {
      return NextResponse.json({ error: 'Dados do paciente incompletos' }, { status: 400 });
    }

    // Verificar se já existe consulta neste horário
    const consultas = getConsultas();
    const consultaExistente = consultas.find(c => 
      c.data === data && 
      c.hora === hora && 
      ['agendada', 'confirmada'].includes(c.status)
    );

    if (consultaExistente) {
      return NextResponse.json({ error: 'Horário já está ocupado' }, { status: 409 });
    }

    // Buscar ou criar paciente
    let pacientes = getPacientes();
    let pacienteExistente = pacientes.find(p => p.email === email);

    if (!pacienteExistente) {
      pacienteExistente = {
        id: uuidv4(),
        nome,
        email,
        telefone,
        dataNascimento,
        cpf,
        responsavel,
        telefoneResponsavel,
        criadoEm: new Date().toISOString()
      };
      pacientes.push(pacienteExistente);
      savePacientes(pacientes);
    }

    // Criar consulta
    const novaConsulta: Consulta = {
      id: uuidv4(),
      pacienteId: pacienteExistente.id,
      data,
      hora,
      status: 'agendada',
      pagamento: 'pendente',
      criadaEm: new Date().toISOString(),
      atualizadaEm: new Date().toISOString()
    };

    consultas.push(novaConsulta);
    saveConsultas(consultas);

    // Criar notificação
    const notificacoes = getNotificacoes();
    const novaNotificacao = {
      id: uuidv4(),
      tipo: 'novo_agendamento',
      titulo: 'Novo Agendamento',
      mensagem: `${nome} agendou uma consulta para ${new Date(data).toLocaleDateString('pt-BR')} às ${hora}`,
      lida: false,
      criadaEm: new Date().toISOString()
    };

    notificacoes.unshift(novaNotificacao);
    saveNotificacoes(notificacoes);

    // Criar preferência de pagamento se especificado
    let dadosPagamento = null;
    if (metodoPagamento) {
      try {
        const responsePagamento = await fetch(`${process.env.NEXT_PUBLIC_URL || 'http://localhost:3000'}/api/pagamento`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            consultaId: novaConsulta.id,
            pacienteNome: pacienteExistente.nome,
            pacienteEmail: pacienteExistente.email,
            valor: 150, // Valor da consulta
            metodoPagamento
          })
        });

        if (responsePagamento.ok) {
          dadosPagamento = await responsePagamento.json();
        }
      } catch (error) {
        console.error('Erro ao criar pagamento:', error);
      }
    }

    // Retornar dados para confirmação
    return NextResponse.json({
      consulta: novaConsulta,
      paciente: pacienteExistente,
      acessoAreaRestrita: {
        email: pacienteExistente.email,
        senha: pacienteExistente.id.slice(-8) // Últimos 8 caracteres do ID como senha temporária
      },
      pagamento: dadosPagamento
    });

  } catch (error) {
    console.error('Erro ao criar agendamento:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}