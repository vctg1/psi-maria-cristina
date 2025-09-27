import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

interface Consulta {
  id: string;
  pacienteId: string;
  data: string;
  hora: string;
  status: 'agendada' | 'realizada' | 'cancelada' | 'nao_compareceu';
  pagamento: string;
  criadaEm: string;
  atualizadaEm: string;
  pagamentoId?: number;
  pagamentoData?: string;
}

// PUT - Atualizar status da consulta
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await request.json();
    const { status, observacao } = body;

    // Validar status
    const statusValidos = ['agendada', 'realizada', 'cancelada', 'nao_compareceu'];
    if (!statusValidos.includes(status)) {
      return NextResponse.json(
        { error: 'Status inválido' },
        { status: 400 }
      );
    }

    const dataPath = path.join(process.cwd(), 'src', 'data');
    const consultasPath = path.join(dataPath, 'consultas.json');

    // Ler consultas
    let consultas: Consulta[] = [];
    if (fs.existsSync(consultasPath)) {
      const consultasData = fs.readFileSync(consultasPath, 'utf-8');
      consultas = JSON.parse(consultasData);
    }

    // Encontrar a consulta
    const consultaIndex = consultas.findIndex(c => c.id === id);
    if (consultaIndex === -1) {
      return NextResponse.json(
        { error: 'Consulta não encontrada' },
        { status: 404 }
      );
    }

    // Atualizar consulta
    consultas[consultaIndex] = {
      ...consultas[consultaIndex],
      status: status,
      atualizadaEm: new Date().toISOString(),
      ...(observacao && { observacao })
    };

    // Salvar arquivo
    fs.writeFileSync(consultasPath, JSON.stringify(consultas, null, 2));

    return NextResponse.json({
      success: true,
      consulta: consultas[consultaIndex],
      message: `Consulta ${status} com sucesso`
    });

  } catch (error) {
    console.error('Erro ao atualizar consulta:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// DELETE - Cancelar/Deletar consulta
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    const dataPath = path.join(process.cwd(), 'src', 'data');
    const consultasPath = path.join(dataPath, 'consultas.json');

    // Ler consultas
    let consultas: Consulta[] = [];
    if (fs.existsSync(consultasPath)) {
      const consultasData = fs.readFileSync(consultasPath, 'utf-8');
      consultas = JSON.parse(consultasData);
    }

    // Encontrar a consulta
    const consultaIndex = consultas.findIndex(c => c.id === id);
    if (consultaIndex === -1) {
      return NextResponse.json(
        { error: 'Consulta não encontrada' },
        { status: 404 }
      );
    }

    const consultaRemovida = consultas[consultaIndex];

    // Remover consulta (para liberar horário)
    consultas.splice(consultaIndex, 1);

    // Salvar arquivo
    fs.writeFileSync(consultasPath, JSON.stringify(consultas, null, 2));

    return NextResponse.json({
      success: true,
      consultaRemovida,
      message: 'Consulta removida com sucesso. Horário liberado.'
    });

  } catch (error) {
    console.error('Erro ao deletar consulta:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}