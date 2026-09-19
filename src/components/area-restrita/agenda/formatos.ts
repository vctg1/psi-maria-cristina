// Formatação de data/hora para as telas de agenda/disponibilidade — client-safe
// (sem fs/prisma/server-only). `inicio` das consultas é sempre ISO UTC; aqui exibimos
// tudo em America/Sao_Paulo, seguindo o padrão do restante do projeto.

import type { DiaSemana } from '@/types/agenda';

const FUSO = 'America/Sao_Paulo';
const OFFSET = '-03:00'; // America/Sao_Paulo não observa horário de verão desde 2019.

/** Ordem indexada por `Date.getDay()` (0 = domingo), espelhando `src/lib/agenda/tempo.ts`. */
const DIAS_POR_INDICE: DiaSemana[] = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];

export const DIAS_SEMANA_ORDEM: { chave: DiaSemana; label: string; labelCurto: string }[] = [
  { chave: 'segunda', label: 'Segunda-feira', labelCurto: 'Seg' },
  { chave: 'terca', label: 'Terça-feira', labelCurto: 'Ter' },
  { chave: 'quarta', label: 'Quarta-feira', labelCurto: 'Qua' },
  { chave: 'quinta', label: 'Quinta-feira', labelCurto: 'Qui' },
  { chave: 'sexta', label: 'Sexta-feira', labelCurto: 'Sex' },
  { chave: 'sabado', label: 'Sábado', labelCurto: 'Sáb' },
  { chave: 'domingo', label: 'Domingo', labelCurto: 'Dom' },
];

/** Data (YYYY-MM-DD) de um `Date`/instante, sempre calculada no fuso America/Sao_Paulo. */
export function dataLocalISO(data: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: FUSO,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(data);
}

/** `Date` (instante UTC) a partir de uma data YYYY-MM-DD ao meio-dia no fuso local. */
function meioDiaLocal(dataISO: string): Date {
  return new Date(`${dataISO}T12:00:00${OFFSET}`);
}

export function hojeLocalISO(): string {
  return dataLocalISO(new Date());
}

export function diaSemanaDe(dataISO: string): DiaSemana {
  return DIAS_POR_INDICE[meioDiaLocal(dataISO).getDay()];
}

export function somarDiasISO(dataISO: string, dias: number): string {
  const resultado = new Date(meioDiaLocal(dataISO).getTime() + dias * 86400000);
  return dataLocalISO(resultado);
}

/** Segunda-feira da semana (America/Sao_Paulo) que contém `dataISO`. */
export function segundaDaSemana(dataISO: string): string {
  const diaSemana = meioDiaLocal(dataISO).getDay(); // 0=domingo..6=sábado (fixo, -03:00 sem DST)
  const deslocamento = diaSemana === 0 ? -6 : 1 - diaSemana;
  return somarDiasISO(dataISO, deslocamento);
}

export function domingoDaSemana(dataISO: string): string {
  return somarDiasISO(segundaDaSemana(dataISO), 6);
}

/** Lista as 7 datas (YYYY-MM-DD) da semana, de segunda a domingo. */
export function diasDaSemana(dataISO: string): string[] {
  const segunda = segundaDaSemana(dataISO);
  return Array.from({ length: 7 }, (_, i) => somarDiasISO(segunda, i));
}

export function formatarData(iso: string, opcoes?: Intl.DateTimeFormatOptions): string {
  return new Date(iso).toLocaleDateString('pt-BR', { timeZone: FUSO, ...opcoes });
}

export function formatarDataCurta(dataISO: string): string {
  return formatarData(meioDiaLocal(dataISO).toISOString(), { day: '2-digit', month: '2-digit' });
}

/** Formata uma data YYYY-MM-DD (sem componente de hora) com segurança de fuso horário. */
export function formatarDataDeISO(dataISO: string, opcoes?: Intl.DateTimeFormatOptions): string {
  return formatarData(meioDiaLocal(dataISO).toISOString(), opcoes);
}

export function formatarHora(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', {
    timeZone: FUSO,
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatarDiaSemanaCurto(dataISO: string): string {
  return formatarData(meioDiaLocal(dataISO).toISOString(), { weekday: 'short' });
}
