import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@/generated/prisma/client';
import { requireAuth } from '@/lib/auth/guard';
import { validarPacienteEdicaoPropria, SELECT_ME, paraMeDto } from '@/lib/validacao/paciente';

// GET /api/paciente/me — dados do próprio cadastro (paciente logado).
export async function GET(request: NextRequest) {
  try {
    const r = await requireAuth(request, 'paciente');
    if ('erro' in r) return r.erro;
    const { auth } = r;

    if (!auth.pacienteId) {
      return NextResponse.json({ error: 'Paciente não encontrado' }, { status: 404 });
    }

    const paciente = await prisma.paciente.findUnique({ where: { id: auth.pacienteId }, select: SELECT_ME });
    if (!paciente) {
      return NextResponse.json({ error: 'Paciente não encontrado' }, { status: 404 });
    }

    return NextResponse.json(paraMeDto(paciente));
  } catch {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

// PATCH /api/paciente/me — edição do próprio cadastro. Whitelist estrita (sem email/ativo/
// observacoesCadastro). `data` do Prisma é montado campo a campo, nunca spread do body.
export async function PATCH(request: NextRequest) {
  try {
    const r = await requireAuth(request, 'paciente');
    if ('erro' in r) return r.erro;
    const { auth } = r;

    if (!auth.pacienteId) {
      return NextResponse.json({ error: 'Paciente não encontrado' }, { status: 404 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
    }

    const resultado = validarPacienteEdicaoPropria(body);
    if (!resultado.ok) {
      return NextResponse.json({ error: 'Dados inválidos', campos: resultado.campos }, { status: 400 });
    }
    const dados = resultado.dados;

    const atualizado = await prisma.paciente.update({
      where: { id: auth.pacienteId },
      data: {
        ...(dados.nome !== undefined ? { nome: dados.nome } : {}),
        ...(dados.telefone !== undefined ? { telefone: dados.telefone } : {}),
        ...(dados.dataNascimento !== undefined
          ? { dataNascimento: new Date(dados.dataNascimento + 'T12:00:00') }
          : {}),
        ...(dados.cpf !== undefined ? { cpf: dados.cpf } : {}),
        ...(dados.responsavel !== undefined ? { responsavel: dados.responsavel } : {}),
        ...(dados.telefoneResponsavel !== undefined
          ? { telefoneResponsavel: dados.telefoneResponsavel }
          : {}),
      },
      select: SELECT_ME,
    });

    return NextResponse.json(paraMeDto(atualizado));
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json({ error: 'CPF já cadastrado' }, { status: 409 });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return NextResponse.json({ error: 'Paciente não encontrado' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
