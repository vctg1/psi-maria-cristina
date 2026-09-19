import 'server-only';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@/generated/prisma/client';
import { CONSULTA_STATUS_OCUPA_HORARIO } from '@/types';
import { DIAS, montarInicio, partesLocais } from './tempo';

type TxOuClient = Prisma.TransactionClient | typeof prisma;

/** Horários livres (HH:MM, ordenados) de um dia específico. Datas passadas (ou horário já
 *  passado hoje) retornam sempre []. */
export async function horariosLivresDoDia(data: string, tx: TxOuClient = prisma): Promise<string[]> {
  const agora = new Date();
  const inicioDoDia = montarInicio(data, '00:00');
  const fimDoDia = montarInicio(data, '23:59');
  if (fimDoDia < agora) return [];

  const diaSemana = DIAS[new Date(`${data}T12:00:00-03:00`).getDay()];

  const horarios = await tx.horarioAtendimento.findMany({
    where: { diaSemana, ativo: true },
    select: { hora: true },
    orderBy: { hora: 'asc' },
  });
  if (horarios.length === 0) return [];

  const excecoes = await tx.excecaoDisponibilidade.findMany({
    where: { data: montarDataColuna(data) },
    select: { hora: true },
  });
  if (excecoes.some((e) => e.hora === null)) return []; // dia inteiro bloqueado

  const horasExcluidasPorExcecao = new Set(excecoes.map((e) => e.hora).filter((h): h is string => h !== null));

  const candidatos = horarios
    .map((h) => h.hora)
    .filter((hora) => !horasExcluidasPorExcecao.has(hora))
    .filter((hora) => montarInicio(data, hora) > agora);

  if (candidatos.length === 0) return [];

  const inicios = candidatos.map((hora) => montarInicio(data, hora));
  const ocupadas = await tx.consulta.findMany({
    where: { inicio: { in: inicios }, status: { in: [...CONSULTA_STATUS_OCUPA_HORARIO] } },
    select: { inicio: true },
  });
  const horasOcupadas = new Set(ocupadas.map((c) => partesLocais(c.inicio).hora));

  return candidatos.filter((hora) => !horasOcupadas.has(hora)).sort();
}

/** Dias com pelo menos um horário livre no mês, em no máximo 3 queries. */
export async function livresDoMes(
  ano: number,
  mes1a12: number,
  tx: TxOuClient = prisma
): Promise<Record<string, string[]>> {
  const agora = new Date();
  const ultimoDia = new Date(ano, mes1a12, 0).getDate();
  const datasDoMes: string[] = [];
  for (let dia = 1; dia <= ultimoDia; dia++) {
    datasDoMes.push(`${ano}-${String(mes1a12).padStart(2, '0')}-${String(dia).padStart(2, '0')}`);
  }

  const inicioMes = montarInicio(datasDoMes[0], '00:00');
  const proximoMesAno = mes1a12 === 12 ? ano + 1 : ano;
  const proximoMesNum = mes1a12 === 12 ? 1 : mes1a12 + 1;
  const primeiroDiaProximoMes = `${proximoMesAno}-${String(proximoMesNum).padStart(2, '0')}-01`;
  const fimMes = montarInicio(primeiroDiaProximoMes, '00:00');

  // Query 1: horários ativos, agrupados por dia da semana.
  const horarios = await tx.horarioAtendimento.findMany({
    where: { ativo: true },
    select: { diaSemana: true, hora: true },
  });
  const horariosPorDia = new Map<string, string[]>();
  for (const h of horarios) {
    const lista = horariosPorDia.get(h.diaSemana) ?? [];
    lista.push(h.hora);
    horariosPorDia.set(h.diaSemana, lista);
  }

  // Query 2: exceções do mês.
  const excecoes = await tx.excecaoDisponibilidade.findMany({
    where: { data: { gte: montarDataColuna(datasDoMes[0]), lte: montarDataColuna(datasDoMes[datasDoMes.length - 1]) } },
    select: { data: true, hora: true },
  });
  const diaInteiroBloqueado = new Set<string>();
  const horaBloqueada = new Set<string>(); // chave `${data}|${hora}`
  for (const e of excecoes) {
    const dataStr = e.data.toISOString().slice(0, 10);
    if (e.hora === null) diaInteiroBloqueado.add(dataStr);
    else horaBloqueada.add(`${dataStr}|${e.hora}`);
  }

  // Query 3: consultas que ocupam horário no mês.
  const ocupantes = await tx.consulta.findMany({
    where: { inicio: { gte: inicioMes, lt: fimMes }, status: { in: [...CONSULTA_STATUS_OCUPA_HORARIO] } },
    select: { inicio: true },
  });
  const ocupado = new Set<string>(); // chave `${data}|${hora}`
  for (const c of ocupantes) {
    const partes = partesLocais(c.inicio);
    ocupado.add(`${partes.data}|${partes.hora}`);
  }

  const resultado: Record<string, string[]> = {};
  for (const data of datasDoMes) {
    if (diaInteiroBloqueado.has(data)) continue;
    const diaSemana = DIAS[new Date(`${data}T12:00:00-03:00`).getDay()];
    const candidatos = horariosPorDia.get(diaSemana) ?? [];
    if (candidatos.length === 0) continue;

    const livres = candidatos
      .filter((hora) => !horaBloqueada.has(`${data}|${hora}`))
      .filter((hora) => !ocupado.has(`${data}|${hora}`))
      .filter((hora) => montarInicio(data, hora) > agora)
      .sort();

    if (livres.length > 0) resultado[data] = livres;
  }

  return resultado;
}

export type ResultadoVerificacao = 'livre' | 'sem_horario' | 'excecao' | 'ocupado';

/** Mesma checagem de `horariosLivresDoDia`, mas para um instante específico dentro de uma
 *  transação (revalidação antes de gravar). `ignorarConsultaId` exclui a própria consulta
 *  (usado no reagendamento). */
export async function verificarLivreNaTransacao(
  tx: Prisma.TransactionClient,
  inicio: Date,
  ignorarConsultaId?: string
): Promise<ResultadoVerificacao> {
  const { data, hora, diaSemana } = partesLocais(inicio);

  const horario = await tx.horarioAtendimento.findUnique({
    where: { diaSemana_hora: { diaSemana, hora } },
    select: { ativo: true },
  });
  if (!horario || !horario.ativo) return 'sem_horario';

  const excecoes = await tx.excecaoDisponibilidade.findMany({
    where: { data: montarDataColuna(data), OR: [{ hora: null }, { hora }] },
    select: { id: true },
  });
  if (excecoes.length > 0) return 'excecao';

  const ocupante = await tx.consulta.findFirst({
    where: {
      inicio,
      status: { in: [...CONSULTA_STATUS_OCUPA_HORARIO] },
      ...(ignorarConsultaId ? { id: { not: ignorarConsultaId } } : {}),
    },
    select: { id: true },
  });
  if (ocupante) return 'ocupado';

  return 'livre';
}

/** Constrói o valor a comparar/gravar em colunas `@db.Date` (mesma convenção do restante do
 *  código: meio-dia sem offset explícito, para não sofrer deslocamento de dia). */
export function montarDataColuna(data: string): Date {
  return new Date(data + 'T12:00:00');
}
