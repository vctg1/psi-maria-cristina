import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/guard';
import { abrirStream, nomeParaContentDisposition } from '@/lib/documentos/armazenamento';

const REGEX_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Contexto = { params: Promise<{ id: string }> };

const NAO_ENCONTRADO = () => NextResponse.json({ error: 'Documento não encontrado' }, { status: 404 });

// GET /api/documentos/[id]/download — a rota mais sensível: autorização acontece
// inteiramente ANTES de qualquer acesso ao disco, e a resposta de "não autorizado" é
// idêntica à de "não existe" (nunca vaza a existência de um documento a quem não pode vê-lo).
export async function GET(request: NextRequest, { params }: Contexto) {
  try {
    const r = await requireAuth(request);
    if ('erro' in r) return r.erro;
    const { auth } = r;

    const { id } = await params;
    if (!REGEX_UUID.test(id)) return NAO_ENCONTRADO();

    const doc = await prisma.documento.findUnique({
      where: { id },
      select: {
        id: true,
        pacienteId: true,
        visivelParaPaciente: true,
        nomeArquivo: true,
        nomeOriginal: true,
        mimeType: true,
        tamanhoBytes: true,
      },
    });

    const autorizado =
      doc !== null &&
      (auth.papel === 'psicologa' ||
        (auth.papel === 'paciente' &&
          auth.pacienteId !== undefined &&
          doc.pacienteId === auth.pacienteId &&
          doc.visivelParaPaciente === true));

    if (!autorizado || !doc) return NAO_ENCONTRADO();

    let stream: ReadableStream;
    try {
      stream = await abrirStream(doc.nomeArquivo);
    } catch {
      console.error('Documento sem arquivo físico', doc.id);
      return NAO_ENCONTRADO();
    }

    return new Response(stream, {
      status: 200,
      headers: {
        'Content-Type': doc.mimeType,
        'Content-Length': String(doc.tamanhoBytes),
        'Content-Disposition': nomeParaContentDisposition(doc.nomeOriginal),
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'private, no-store',
        'Content-Security-Policy': "default-src 'none'; sandbox",
      },
    });
  } catch {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
