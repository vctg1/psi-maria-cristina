import 'server-only';
import type { DiaSemana } from '@/types/agenda';

/** Ordem indexada por `Date.getDay()` (0 = domingo). */
export const DIAS: DiaSemana[] = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];

const FUSO = 'America/Sao_Paulo';
const OFFSET = '-03:00'; // America/Sao_Paulo não observa horário de verão desde 2019.

const REGEX_DATA = /^\d{4}-\d{2}-\d{2}$/;
const REGEX_HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

export function formatoDataValido(v: unknown): v is string {
  if (typeof v !== 'string' || !REGEX_DATA.test(v)) return false;
  const [anoStr, mesStr, diaStr] = v.split('-');
  const ano = parseInt(anoStr, 10);
  const mes = parseInt(mesStr, 10);
  const dia = parseInt(diaStr, 10);
  const data = new Date(`${v}T12:00:00${OFFSET}`);
  if (isNaN(data.getTime())) return false;
  const partes = partesLocais(data);
  return (
    parseInt(partes.data.slice(0, 4), 10) === ano &&
    parseInt(partes.data.slice(5, 7), 10) === mes &&
    parseInt(partes.data.slice(8, 10), 10) === dia
  );
}

export function formatoHoraValido(v: unknown): v is string {
  return typeof v === 'string' && REGEX_HORA.test(v);
}

/** Monta um `Date` (instante UTC) a partir de data/hora no fuso America/Sao_Paulo. */
export function montarInicio(data: string, hora: string): Date {
  return new Date(`${data}T${hora}:00${OFFSET}`);
}

/** Extrai data (YYYY-MM-DD), hora (HH:MM) e dia da semana de um instante, no fuso local. */
export function partesLocais(inicio: Date): { data: string; hora: string; diaSemana: DiaSemana } {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: FUSO,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const partes = formatter.formatToParts(inicio);
  const obter = (tipo: string) => partes.find((p) => p.type === tipo)?.value ?? '';
  const ano = obter('year');
  const mes = obter('month');
  const dia = obter('day');
  let hora = obter('hour');
  const minuto = obter('minute');
  if (hora === '24') hora = '00';

  const data = `${ano}-${mes}-${dia}`;
  const horaStr = `${hora}:${minuto}`;

  // Dia da semana calculado a partir da data local ao meio-dia (-03:00), com margem segura
  // contra o fuso do processo Node (`getDay()` usa o fuso do sistema, não UTC).
  const dataParaDiaSemana = new Date(`${data}T12:00:00${OFFSET}`);
  const diaSemana = DIAS[dataParaDiaSemana.getDay()];

  return { data, hora: horaStr, diaSemana };
}

/** `Date` representando "agora" no fuso local, só para comparações de passado/futuro. */
export function agora(): Date {
  return new Date();
}
