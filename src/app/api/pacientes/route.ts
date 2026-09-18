import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@/generated/prisma/client';
import { requireAuth } from '@/lib/auth/guard';
import { validarPacienteEntrada, paraDetalhe, paraResumo } from '@/lib/validacao/paciente';

const SELECT_RESUMO = {
  id: true,
  usuarioId: true,
  nome: true,
  telefone: true,
  criadoEm: true,
  usuario: { select: { email: true, ativo: true, senhaHash: true } },
} as const;

const SELECT_DETALHE = {
  ...SELECT_RESUMO,
  dataNascimento: true,
  cpf: true,
  responsavel: true,
  telefoneResponsavel: true,
  observacoesCadastro: true,
  origemCadastro: true,
  atualizadoEm: true,
  usuario: { select: { email: true, ativo: true, senhaHash: true, ultimoLoginEm: true } },
} as const;

// GET /api/pacientes?q=&incluirInativos= — lista resumida, só para a psicóloga.
export async function GET(request: NextRequest) {
  try {
    const r = await requireAuth(request, 'psicologa');
    if ('erro' in r) return r.erro;

    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q')?.trim().slice(0, 100) || undefined;
    const incluirInativos = searchParams.get('incluirInativos') === 'true';

    const pacientes = await prisma.paciente.findMany({
      where: {
        usuario: incluirInativos ? undefined : { ativo: true },
        ...(q
          ? {
              OR: [
                { nome: { contains: q, mode: 'insensitive' as const } },
                { usuario: { email: { contains: q, mode: 'insensitive' as const } } },
              ],
            }
          : {}),
      },
      select: SELECT_RESUMO,
      orderBy: { nome: 'asc' },
    });

    return NextResponse.json(pacientes.map(paraResumo));
  } catch {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

// POST /api/pacientes — cadastro pela psicóloga (primeiro acesso via token, não por senha aqui).
export async function POST(request: NextRequest) {
  try {
    const r = await requireAuth(request, 'psicologa');
    if ('erro' in r) return r.erro;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
    }

    const resultado = validarPacienteEntrada(body);
    if (!resultado.ok) {
      return NextResponse.json({ error: 'Dados inválidos', campos: resultado.campos }, { status: 400 });
    }
    const dados = resultado.dados;

    const emailExistente = await prisma.usuario.findUnique({
      where: { email: dados.email },
      select: { id: true },
    });
    if (emailExistente) {
      return NextResponse.json({ error: 'E-mail já cadastrado' }, { status: 409 });
    }

    if (dados.cpf) {
      const cpfExistente = await prisma.paciente.findUnique({
        where: { cpf: dados.cpf },
        select: { id: true },
      });
      if (cpfExistente) {
        return NextResponse.json({ error: 'CPF já cadastrado' }, { status: 409 });
      }
    }

    const criado = await prisma.$transaction(async (tx) => {
      const usuario = await tx.usuario.create({
        data: { email: dados.email, papel: 'paciente', senhaHash: null },
      });

      return tx.paciente.create({
        data: {
          usuarioId: usuario.id,
          nome: dados.nome,
          telefone: dados.telefone,
          dataNascimento: new Date(dados.dataNascimento + 'T12:00:00'),
          cpf: dados.cpf,
          responsavel: dados.responsavel,
          telefoneResponsavel: dados.telefoneResponsavel,
          observacoesCadastro: dados.observacoesCadastro,
          origemCadastro: 'psicologa',
        },
        select: SELECT_DETALHE,
      });
    });

    return NextResponse.json(paraDetalhe(criado), { status: 201 });
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
