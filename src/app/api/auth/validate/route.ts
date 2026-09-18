import { NextRequest, NextResponse } from 'next/server';
import { autenticar } from '@/lib/auth/guard';
import { respostaErroAuth } from '@/lib/auth/erros';

export async function GET(request: NextRequest) {
  try {
    const auth = await autenticar(request);
    if (!auth) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }
    return NextResponse.json({
      usuario: {
        id: auth.usuarioId,
        papel: auth.papel,
        ...(auth.pacienteId ? { pacienteId: auth.pacienteId } : {}),
      },
    });
  } catch (error) {
    return respostaErroAuth(error);
  }
}
