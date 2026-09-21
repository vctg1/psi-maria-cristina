import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/guard';
import { DOCUMENTO_TITULO_MAX } from '@/types/documento';
import {
  SELECT_DOCUMENTO,
  detectarMime,
  gerarNomeArquivo,
  limiteBytes,
  paraDocumentoDto,
  removerArquivo,
  salvarArquivo,
  sanitizarNomeOriginal,
} from '@/lib/documentos/armazenamento';

const REGEX_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// POST /api/documentos — upload de documento clínico pela psicóloga (multipart/form-data).
export async function POST(request: NextRequest) {
  try {
    const r = await requireAuth(request, 'psicologa');
    if ('erro' in r) return r.erro;
    const { auth } = r;

    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return NextResponse.json({ error: 'JSON/form inválido' }, { status: 400 });
    }

    const tituloRaw = form.get('titulo');
    const pacienteIdRaw = form.get('pacienteId');
    const visivelRaw = form.get('visivelParaPaciente');
    const arquivo = form.get('arquivo');

    const campos: Record<string, string> = {};

    const titulo = typeof tituloRaw === 'string' ? tituloRaw.trim() : '';
    if (!titulo) campos.titulo = 'Título é obrigatório';
    else if (titulo.length > DOCUMENTO_TITULO_MAX) {
      campos.titulo = `Título deve ter no máximo ${DOCUMENTO_TITULO_MAX} caracteres`;
    }

    const pacienteId = typeof pacienteIdRaw === 'string' ? pacienteIdRaw : '';
    if (!pacienteId || !REGEX_UUID.test(pacienteId)) campos.pacienteId = 'Paciente inválido';

    if (Object.keys(campos).length > 0) {
      return NextResponse.json({ error: 'Dados inválidos', campos }, { status: 400 });
    }

    const paciente = await prisma.paciente.findUnique({ where: { id: pacienteId }, select: { id: true } });
    if (!paciente) {
      return NextResponse.json({ error: 'Paciente não encontrado' }, { status: 404 });
    }

    if (!(arquivo instanceof File) || arquivo.size <= 0) {
      return NextResponse.json({ error: 'Arquivo é obrigatório' }, { status: 400 });
    }

    if (arquivo.size > limiteBytes()) {
      const limiteMb = Math.floor(limiteBytes() / (1024 * 1024));
      return NextResponse.json({ error: `Arquivo excede o limite de ${limiteMb} MB` }, { status: 413 });
    }

    const buffer = Buffer.from(await arquivo.arrayBuffer());
    const mime = detectarMime(buffer);
    if (!mime) {
      return NextResponse.json(
        { error: 'Tipo de arquivo não permitido. Envie PDF, PNG ou JPG.' },
        { status: 415 }
      );
    }
    if (arquivo.type && arquivo.type !== mime) {
      return NextResponse.json(
        { error: 'Tipo de arquivo não permitido. Envie PDF, PNG ou JPG.' },
        { status: 415 }
      );
    }

    const visivelParaPaciente = visivelRaw === 'true';

    const nomeArquivo = gerarNomeArquivo(mime);
    await salvarArquivo(nomeArquivo, buffer);

    try {
      const documento = await prisma.documento.create({
        data: {
          pacienteId,
          titulo,
          nomeArquivo,
          nomeOriginal: sanitizarNomeOriginal(arquivo.name),
          mimeType: mime,
          tamanhoBytes: buffer.length,
          visivelParaPaciente,
          enviadoPorId: auth.usuarioId,
        },
        select: SELECT_DOCUMENTO,
      });

      return NextResponse.json(paraDocumentoDto(documento), { status: 201 });
    } catch (error) {
      await removerArquivo(nomeArquivo);
      throw error;
    }
  } catch {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
