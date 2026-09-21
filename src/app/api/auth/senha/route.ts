import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/guard';
import { compararSenha, hashSenha, validarForcaSenha } from '@/lib/auth/senha';
import { respostaErroAuth } from '@/lib/auth/erros';

// PATCH /api/auth/senha — troca de senha pelo próprio usuário logado (psicóloga ou paciente).
// NOTA: ainda não invalida outras sessões ativas do usuário ao trocar a senha (M14 do
// checklist de segurança não está implementado).
export async function PATCH(request: NextRequest) {
  try {
    const r = await requireAuth(request);
    if ('erro' in r) return r.erro;
    const { auth } = r;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
    }

    const obj = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
    const { senhaAtual, novaSenha } = obj;

    const campos: Record<string, string> = {};
    if (typeof senhaAtual !== 'string' || senhaAtual === '') {
      campos.senhaAtual = 'Informe a senha atual';
    }
    if (typeof novaSenha !== 'string' || novaSenha === '') {
      campos.novaSenha = 'Informe a nova senha';
    } else {
      const erroForca = validarForcaSenha(novaSenha);
      if (erroForca) campos.novaSenha = erroForca;
    }
    if (
      typeof senhaAtual === 'string' &&
      typeof novaSenha === 'string' &&
      !campos.senhaAtual &&
      !campos.novaSenha &&
      novaSenha === senhaAtual
    ) {
      campos.novaSenha = 'A nova senha deve ser diferente da atual';
    }

    if (Object.keys(campos).length > 0) {
      return NextResponse.json({ error: 'Dados inválidos', campos }, { status: 400 });
    }

    const usuario = await prisma.usuario.findUnique({
      where: { id: auth.usuarioId },
      select: { senhaHash: true, ativo: true },
    });

    if (!usuario || !usuario.ativo) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    if (usuario.senhaHash === null) {
      return NextResponse.json(
        { error: 'Dados inválidos', campos: { senhaAtual: 'Cadastro sem senha definida' } },
        { status: 400 },
      );
    }

    const senhaConfere = await compararSenha(senhaAtual as string, usuario.senhaHash);
    if (!senhaConfere) {
      return NextResponse.json(
        { error: 'Senha atual incorreta', campos: { senhaAtual: 'Senha atual incorreta' } },
        { status: 401 },
      );
    }

    const novoHash = await hashSenha(novaSenha as string);
    await prisma.usuario.update({
      where: { id: auth.usuarioId },
      data: { senhaHash: novoHash },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return respostaErroAuth(error);
  }
}
