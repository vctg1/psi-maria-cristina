import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@/generated/prisma/client';
import { requireAuth } from '@/lib/auth/guard';
import { validarPacienteEdicao, paraDetalhe } from '@/lib/validacao/paciente';

const SELECT_DETALHE = {
  id: true,
  usuarioId: true,
  nome: true,
  telefone: true,
  criadoEm: true,
  dataNascimento: true,
  cpf: true,
  responsavel: true,
  telefoneResponsavel: true,
  observacoesCadastro: true,
  origemCadastro: true,
  atualizadoEm: true,
  usuario: { select: { email: true, ativo: true, senhaHash: true, ultimoLoginEm: true } },
} as const;

type Contexto = { params: Promise<{ id: string }> };

// GET /api/pacientes/[id] — detalhe completo (com CPF), só para a psicóloga.
export async function GET(request: NextRequest, { params }: Contexto) {
  try {
    const r = await requireAuth(request, 'psicologa');
    if ('erro' in r) return r.erro;

    const { id } = await params;

    const paciente = await prisma.paciente.findUnique({ where: { id }, select: SELECT_DETALHE });
    if (!paciente) {
      return NextResponse.json({ error: 'Paciente não encontrado' }, { status: 404 });
    }

    return NextResponse.json(paraDetalhe(paciente));
  } catch {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

// PATCH /api/pacientes/[id] — edição pela psicóloga. `data` do Prisma é montado campo a
// campo (nunca spread do body): id/usuarioId/origemCadastro/senhaHash nunca são alteráveis aqui.
export async function PATCH(request: NextRequest, { params }: Contexto) {
  try {
    const r = await requireAuth(request, 'psicologa');
    if ('erro' in r) return r.erro;

    const { id } = await params;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
    }

    const resultado = validarPacienteEdicao(body);
    if (!resultado.ok) {
      return NextResponse.json({ error: 'Dados inválidos', campos: resultado.campos }, { status: 400 });
    }
    const dados = resultado.dados;

    const existente = await prisma.paciente.findUnique({
      where: { id },
      select: { id: true, usuarioId: true },
    });
    if (!existente) {
      return NextResponse.json({ error: 'Paciente não encontrado' }, { status: 404 });
    }

    if (dados.ativo !== undefined && existente.usuarioId === null) {
      return NextResponse.json({ error: 'Paciente sem acesso' }, { status: 400 });
    }

    if (dados.email !== undefined) {
      const emailEmUso = await prisma.usuario.findUnique({
        where: { email: dados.email },
        select: { id: true },
      });
      if (emailEmUso && emailEmUso.id !== existente.usuarioId) {
        return NextResponse.json({ error: 'E-mail já cadastrado' }, { status: 409 });
      }
    }

    if (dados.cpf) {
      const cpfEmUso = await prisma.paciente.findUnique({
        where: { cpf: dados.cpf },
        select: { id: true },
      });
      if (cpfEmUso && cpfEmUso.id !== id) {
        return NextResponse.json({ error: 'CPF já cadastrado' }, { status: 409 });
      }
    }

    const atualizado = await prisma.$transaction(async (tx) => {
      let usuarioId = existente.usuarioId;

      if (usuarioId === null && dados.email !== undefined) {
        // Paciente sem login recebendo e-mail: cria o acesso (Usuario sem senha —
        // primeiro acesso pendente, igual ao cadastro direto pela psicóloga).
        const usuario = await tx.usuario.create({
          data: { email: dados.email, papel: 'paciente', senhaHash: null },
        });
        usuarioId = usuario.id;
        await tx.paciente.update({ where: { id }, data: { usuarioId } });
      } else if (usuarioId !== null && (dados.email !== undefined || dados.ativo !== undefined)) {
        await tx.usuario.update({
          where: { id: usuarioId },
          data: {
            ...(dados.email !== undefined ? { email: dados.email } : {}),
            ...(dados.ativo !== undefined ? { ativo: dados.ativo } : {}),
          },
        });
      }

      return tx.paciente.update({
        where: { id },
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
          ...(dados.observacoesCadastro !== undefined
            ? { observacoesCadastro: dados.observacoesCadastro }
            : {}),
        },
        select: SELECT_DETALHE,
      });
    });

    return NextResponse.json(paraDetalhe(atualizado));
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const alvo = (error.meta?.target as string[] | undefined) ?? [];
      if (alvo.some((campo) => campo.includes('cpf'))) {
        return NextResponse.json({ error: 'CPF já cadastrado' }, { status: 409 });
      }
      return NextResponse.json({ error: 'E-mail já cadastrado' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
