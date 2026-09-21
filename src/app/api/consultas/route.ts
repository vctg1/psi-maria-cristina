import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/guard';
import { Prisma } from '@/generated/prisma/client';
import { formatoDataValido, montarInicio } from '@/lib/agenda/tempo';
import { validarPacienteNovoParaConsulta } from '@/lib/validacao/paciente';
import {
  SELECT_CONSULTA_COM_PACIENTE,
  criarConsultaComTrava,
  paraConsultaDto,
  paraConsultaDtoPaciente,
  HorarioIndisponivel,
} from '@/lib/agenda/consultas';
import { obterValorPadraoSessao } from '@/lib/pagamentos/cobranca';
import { CONSULTA_STATUS, type ConsultaStatus } from '@/types';
import type { Modalidade, NovaConsultaEntrada, ResultadoLote } from '@/types/agenda';

const MODALIDADES: Modalidade[] = ['presencial', 'online'];
const JANELA_MAX_DIAS = 62;

function comoObjeto(body: unknown): Record<string, unknown> {
  return body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
}

function diffDias(de: string, ate: string): number {
  const a = montarInicio(de, '00:00').getTime();
  const b = montarInicio(ate, '00:00').getTime();
  return Math.round((b - a) / 86400000);
}

// GET /api/consultas?de=&ate=&status=&pacienteId= (psicóloga) | própria agenda (paciente logado)
export async function GET(request: NextRequest) {
  try {
    const r = await requireAuth(request);
    if ('erro' in r) return r.erro;
    const { auth } = r;

    const { searchParams } = new URL(request.url);
    const de = searchParams.get('de');
    const ate = searchParams.get('ate');

    if (!formatoDataValido(de) || !formatoDataValido(ate)) {
      return NextResponse.json({ error: 'Parâmetros "de" e "ate" (YYYY-MM-DD) são obrigatórios' }, { status: 400 });
    }
    const dias = diffDias(de, ate);
    if (dias < 0 || dias > JANELA_MAX_DIAS) {
      return NextResponse.json({ error: `Janela máxima de ${JANELA_MAX_DIAS} dias` }, { status: 400 });
    }

    const gte = montarInicio(de, '00:00');
    const lt = new Date(montarInicio(ate, '00:00').getTime() + 86400000);

    if (auth.papel === 'paciente') {
      if (!auth.pacienteId) {
        return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
      }
      const [consultas, valorPadrao] = await Promise.all([
        prisma.consulta.findMany({
          where: { pacienteId: auth.pacienteId, inicio: { gte, lt } },
          select: SELECT_CONSULTA_COM_PACIENTE,
          orderBy: { inicio: 'asc' },
        }),
        obterValorPadraoSessao(),
      ]);
      return NextResponse.json(consultas.map((c) => paraConsultaDtoPaciente(c, valorPadrao)));
    }

    // Psicóloga: filtros adicionais de status e pacienteId.
    const statusParam = searchParams.get('status');
    const pacienteIdParam = searchParams.get('pacienteId');
    if (statusParam !== null && !CONSULTA_STATUS.includes(statusParam as ConsultaStatus)) {
      return NextResponse.json({ error: 'Status inválido' }, { status: 400 });
    }

    const [consultas, valorPadrao] = await Promise.all([
      prisma.consulta.findMany({
        where: {
          inicio: { gte, lt },
          ...(statusParam ? { status: statusParam as ConsultaStatus } : {}),
          ...(pacienteIdParam ? { pacienteId: pacienteIdParam } : {}),
        },
        select: SELECT_CONSULTA_COM_PACIENTE,
        orderBy: { inicio: 'asc' },
      }),
      obterValorPadraoSessao(),
    ]);
    return NextResponse.json(consultas.map((c) => paraConsultaDto(c, valorPadrao)));
  } catch {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

// POST /api/consultas (psicóloga) — cria consulta(s) avulsas ou com repetição semanal.
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
    const obj = comoObjeto(body) as Record<string, unknown> & Partial<NovaConsultaEntrada>;

    const temPacienteId = typeof obj.pacienteId === 'string' && obj.pacienteId.length > 0;
    const temPacienteNovo = obj.pacienteNovo !== undefined && obj.pacienteNovo !== null;
    if (temPacienteId === temPacienteNovo) {
      return NextResponse.json({ error: 'Informe exatamente um de pacienteId ou pacienteNovo' }, { status: 400 });
    }

    if (!formatoDataValido(obj.data)) {
      return NextResponse.json({ error: 'Data inválida (use YYYY-MM-DD)' }, { status: 400 });
    }
    const horaValida = typeof obj.hora === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(obj.hora);
    if (!horaValida) {
      return NextResponse.json({ error: 'Hora inválida (use HH:MM)' }, { status: 400 });
    }
    const hora = obj.hora as string;
    if (typeof obj.modalidade !== 'string' || !MODALIDADES.includes(obj.modalidade as Modalidade)) {
      return NextResponse.json({ error: 'Modalidade inválida' }, { status: 400 });
    }
    let motivo: string | null = null;
    if (obj.motivo !== undefined && obj.motivo !== null) {
      if (typeof obj.motivo !== 'string' || obj.motivo.trim().length > 200) {
        return NextResponse.json({ error: 'Motivo inválido (máximo 200 caracteres)' }, { status: 400 });
      }
      motivo = obj.motivo.trim() || null;
    }
    let observacoes: string | null = null;
    if (obj.observacoes !== undefined && obj.observacoes !== null) {
      if (typeof obj.observacoes !== 'string' || obj.observacoes.trim().length > 1000) {
        return NextResponse.json({ error: 'Observações inválidas (máximo 1000 caracteres)' }, { status: 400 });
      }
      observacoes = obj.observacoes.trim() || null;
    }
    let repetirSemanas = 0;
    if (obj.repetirSemanas !== undefined) {
      if (typeof obj.repetirSemanas !== 'number' || !Number.isInteger(obj.repetirSemanas) || obj.repetirSemanas < 0 || obj.repetirSemanas > 12) {
        return NextResponse.json({ error: 'repetirSemanas deve ser um inteiro entre 0 e 12' }, { status: 400 });
      }
      repetirSemanas = obj.repetirSemanas;
    }

    let pacienteId: string;
    if (temPacienteId) {
      const paciente = await prisma.paciente.findUnique({ where: { id: obj.pacienteId as string }, select: { id: true } });
      if (!paciente) {
        return NextResponse.json({ error: 'Paciente não encontrado' }, { status: 404 });
      }
      pacienteId = paciente.id;
    } else {
      const pacienteNovo = obj.pacienteNovo as Record<string, unknown>;
      const validado = validarPacienteNovoParaConsulta(pacienteNovo);
      if (!validado.ok) {
        return NextResponse.json({ error: 'Dados inválidos', campos: validado.campos }, { status: 400 });
      }
      const criado = await prisma.paciente.create({
        data: {
          nome: validado.dados.nome,
          telefone: validado.dados.telefone,
          dataNascimento: validado.dados.dataNascimento,
          observacoesCadastro: validado.dados.observacoesCadastro,
          origemCadastro: 'psicologa',
          usuarioId: null,
        },
        select: { id: true },
      });
      pacienteId = criado.id;
    }

    const criadas: ResultadoLote['criadas'] = [];
    const puladas: ResultadoLote['puladas'] = [];
    const valorPadrao = await obterValorPadraoSessao();

    for (let i = 0; i <= repetirSemanas; i++) {
      const dataOcorrencia = somarDias(obj.data, i * 7);
      const inicio = montarInicio(dataOcorrencia, hora);
      try {
        const consulta = await criarConsultaComTrava({
          pacienteId,
          inicio,
          modalidade: obj.modalidade as Modalidade,
          motivo,
          observacoes,
          criadaPor: 'psicologa',
        });
        criadas.push(paraConsultaDto(consulta, valorPadrao));
      } catch (error) {
        if (error instanceof HorarioIndisponivel) {
          puladas.push({ data: dataOcorrencia, motivo: error.motivo });
          continue;
        }
        throw error;
      }
    }

    const resposta: ResultadoLote = { criadas, puladas };
    return NextResponse.json(resposta, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json({ error: 'CPF já cadastrado' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

function somarDias(data: string, dias: number): string {
  if (dias === 0) return data;
  const base = montarInicio(data, '12:00');
  const resultado = new Date(base.getTime() + dias * 86400000);
  const ano = resultado.getUTCFullYear();
  const mes = String(resultado.getUTCMonth() + 1).padStart(2, '0');
  const dia = String(resultado.getUTCDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}
