import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/guard';
import { SELECT_DOCUMENTO, paraDocumentoDtoPaciente } from '@/lib/documentos/armazenamento';

// GET /api/paciente/me/documentos — documentos do paciente logado marcados como visíveis.
export async function GET(request: NextRequest) {
  try {
    const r = await requireAuth(request, 'paciente');
    if ('erro' in r) return r.erro;
    const { auth } = r;

    if (!auth.pacienteId) {
      return NextResponse.json({ error: 'Paciente não encontrado' }, { status: 404 });
    }

    const documentos = await prisma.documento.findMany({
      where: { pacienteId: auth.pacienteId, visivelParaPaciente: true },
      select: SELECT_DOCUMENTO,
      orderBy: { criadoEm: 'desc' },
    });

    return NextResponse.json({ documentos: documentos.map(paraDocumentoDtoPaciente) });
  } catch {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
