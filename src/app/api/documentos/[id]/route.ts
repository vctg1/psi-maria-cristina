import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/guard';
import { DOCUMENTO_TITULO_MAX } from '@/types/documento';
import { SELECT_DOCUMENTO, paraDocumentoDto, removerArquivo } from '@/lib/documentos/armazenamento';

type Contexto = { params: Promise<{ id: string }> };

// PATCH /api/documentos/[id] — edição pela psicóloga. Whitelist estrita montada campo a
// campo (nunca spread do body): pacienteId, nomeArquivo, mimeType etc. nunca são alteráveis aqui.
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

    const obj = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
    const campos: Record<string, string> = {};
    const data: { titulo?: string; visivelParaPaciente?: boolean } = {};

    if (obj.titulo !== undefined) {
      if (typeof obj.titulo !== 'string') {
        campos.titulo = 'Título inválido';
      } else {
        const titulo = obj.titulo.trim();
        if (!titulo || titulo.length > DOCUMENTO_TITULO_MAX) {
          campos.titulo = `Título deve ter entre 1 e ${DOCUMENTO_TITULO_MAX} caracteres`;
        } else {
          data.titulo = titulo;
        }
      }
    }

    if (obj.visivelParaPaciente !== undefined) {
      if (typeof obj.visivelParaPaciente !== 'boolean') {
        campos.visivelParaPaciente = 'Deve ser verdadeiro ou falso';
      } else {
        data.visivelParaPaciente = obj.visivelParaPaciente;
      }
    }

    if (Object.keys(campos).length > 0) {
      return NextResponse.json({ error: 'Dados inválidos', campos }, { status: 400 });
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'Nenhum campo válido para atualizar' }, { status: 400 });
    }

    const existente = await prisma.documento.findUnique({ where: { id }, select: { id: true } });
    if (!existente) {
      return NextResponse.json({ error: 'Documento não encontrado' }, { status: 404 });
    }

    const atualizado = await prisma.documento.update({ where: { id }, data, select: SELECT_DOCUMENTO });

    return NextResponse.json(paraDocumentoDto(atualizado));
  } catch {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

// DELETE /api/documentos/[id] — remove o registro primeiro (nunca deixa registro apontando
// para arquivo removido) e só então o arquivo no disco. Se o unlink falhar por motivo diferente
// de "já não existe", loga só o id e responde 200 mesmo assim: um arquivo órfão em disco é o
// menor dos dois males frente a um registro fantasma no banco.
export async function DELETE(request: NextRequest, { params }: Contexto) {
  try {
    const r = await requireAuth(request, 'psicologa');
    if ('erro' in r) return r.erro;

    const { id } = await params;

    const existente = await prisma.documento.findUnique({ where: { id }, select: { id: true, nomeArquivo: true } });
    if (!existente) {
      return NextResponse.json({ error: 'Documento não encontrado' }, { status: 404 });
    }

    await prisma.documento.delete({ where: { id } });

    try {
      await removerArquivo(existente.nomeArquivo);
    } catch {
      console.error('Falha ao remover arquivo do documento', id);
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
