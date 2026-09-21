import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/guard';
import { SELECT_DOCUMENTO, paraDocumentoDto } from '@/lib/documentos/armazenamento';

type Contexto = { params: Promise<{ id: string }> };

// GET /api/pacientes/[id]/documentos — lista completa (todos os documentos) para a psicóloga.
export async function GET(request: NextRequest, { params }: Contexto) {
  try {
    const r = await requireAuth(request, 'psicologa');
    if ('erro' in r) return r.erro;

    const { id } = await params;

    const paciente = await prisma.paciente.findUnique({ where: { id }, select: { id: true } });
    if (!paciente) {
      return NextResponse.json({ error: 'Paciente não encontrado' }, { status: 404 });
    }

    const documentos = await prisma.documento.findMany({
      where: { pacienteId: id },
      select: SELECT_DOCUMENTO,
      orderBy: { criadoEm: 'desc' },
    });

    return NextResponse.json({ documentos: documentos.map(paraDocumentoDto) });
  } catch {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
