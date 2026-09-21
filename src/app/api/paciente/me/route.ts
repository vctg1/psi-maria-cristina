import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@/generated/prisma/client';
import { requireAuth } from '@/lib/auth/guard';
import { compararSenha } from '@/lib/auth/senha';
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

// PATCH /api/paciente/me — edição do próprio cadastro. Whitelist estrita (sem cpf/ativo/
// observacoesCadastro — CPF só é alterável pela psicóloga via /api/pacientes/[id]; email é
// editável, mas nunca vazio). `data` do Prisma é montado campo a campo, nunca spread do body.
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

    let usuarioId: string | null = null;
    if (dados.email !== undefined) {
      if (dados.senhaAtual === undefined) {
        return NextResponse.json(
          { error: 'Dados inválidos', campos: { senhaAtual: 'Informe a senha atual para alterar o e-mail' } },
          { status: 400 },
        );
      }

      const existente = await prisma.paciente.findUnique({
        where: { id: auth.pacienteId },
        select: { usuarioId: true, usuario: { select: { senhaHash: true } } },
      });
      if (!existente) {
        return NextResponse.json({ error: 'Paciente não encontrado' }, { status: 404 });
      }
      if (existente.usuarioId === null) {
        return NextResponse.json(
          { error: 'Dados inválidos', campos: { email: 'Cadastro sem acesso' } },
          { status: 400 },
        );
      }
      const senhaHash = existente.usuario?.senhaHash ?? null;
      if (senhaHash === null) {
        return NextResponse.json(
          { error: 'Dados inválidos', campos: { senhaAtual: 'Cadastro sem senha definida' } },
          { status: 400 },
        );
      }
      const senhaConfere = await compararSenha(dados.senhaAtual, senhaHash);
      if (!senhaConfere) {
        return NextResponse.json(
          { error: 'Senha atual incorreta', campos: { senhaAtual: 'Senha atual incorreta' } },
          { status: 401 },
        );
      }
      usuarioId = existente.usuarioId;

      const emailEmUso = await prisma.usuario.findUnique({
        where: { email: dados.email },
        select: { id: true },
      });
      if (emailEmUso && emailEmUso.id !== usuarioId) {
        return NextResponse.json(
          { error: 'E-mail já cadastrado', campos: { email: 'E-mail já cadastrado' } },
          { status: 409 },
        );
      }
    }

    const atualizado = await prisma.$transaction(async (tx) => {
      if (dados.email !== undefined && usuarioId !== null) {
        await tx.usuario.update({
          where: { id: usuarioId },
          data: { email: dados.email },
        });
      }

      return tx.paciente.update({
        where: { id: auth.pacienteId as string },
        data: {
          ...(dados.nome !== undefined ? { nome: dados.nome } : {}),
          ...(dados.telefone !== undefined ? { telefone: dados.telefone } : {}),
          ...(dados.dataNascimento !== undefined
            ? { dataNascimento: new Date(dados.dataNascimento + 'T12:00:00') }
            : {}),
          ...(dados.responsavel !== undefined ? { responsavel: dados.responsavel } : {}),
          ...(dados.telefoneResponsavel !== undefined
            ? { telefoneResponsavel: dados.telefoneResponsavel }
            : {}),
        },
        select: SELECT_ME,
      });
    });

    return NextResponse.json(paraMeDto(atualizado));
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const alvo = (error.meta?.target as string[] | undefined) ?? [];
      if (alvo.some((campo) => campo.includes('email'))) {
        return NextResponse.json({ error: 'E-mail já cadastrado' }, { status: 409 });
      }
      return NextResponse.json({ error: 'Dado já cadastrado' }, { status: 409 });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return NextResponse.json({ error: 'Paciente não encontrado' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
