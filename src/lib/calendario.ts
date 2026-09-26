// Fase 6 · Bloco 6: "Adicionar ao Google Calendar" (link) e arquivo .ics.
// Sem OAuth, sem API do Google, sem token: só um link/arquivo que a própria pessoa abre e salva.
// Funções PURAS, sem imports de servidor — usadas pelo servidor (anexo do e-mail) e pelo navegador
// (download do .ics via Blob). Nunca coloque dado clínico (motivo, observações, relatório) no evento:
// ele sai do nosso sistema para o calendário da pessoa.

export type EventoCalendario = {
  /** Identificador estável (ex.: id da consulta) — vira o UID do .ics, evitando eventos duplicados. */
  uid: string;
  titulo: string;
  inicio: Date;
  fim: Date;
  descricao?: string;
  local?: string;
};

/** Duração padrão usada quando só o início é conhecido (Configuracao.duracaoSessaoMin é informativo). */
export const DURACAO_PADRAO_MIN = 50;

export function fimPorDuracao(inicio: Date, minutos = DURACAO_PADRAO_MIN): Date {
  return new Date(inicio.getTime() + minutos * 60_000);
}

/** YYYYMMDDTHHMMSSZ (UTC), formato aceito pelo Google Calendar e pelo iCalendar. */
function formatoUtc(d: Date): string {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

export function linkGoogleCalendar(e: EventoCalendario): string {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: e.titulo,
    dates: `${formatoUtc(e.inicio)}/${formatoUtc(e.fim)}`,
    ctz: 'America/Sao_Paulo',
  });
  if (e.descricao) params.set('details', e.descricao);
  if (e.local) params.set('location', e.local);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/** Escapa texto conforme RFC 5545 (\\ ; , e quebras de linha). */
function escaparIcs(texto: string): string {
  return texto.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

/** Dobra linhas longas (RFC 5545: máx. 75 octetos; continuação começa com espaço). */
function dobrar(linha: string): string {
  if (linha.length <= 74) return linha;
  const partes: string[] = [];
  for (let i = 0; i < linha.length; i += 73) partes.push((i === 0 ? '' : ' ') + linha.slice(i, i + 73));
  return partes.join('\r\n');
}

export function gerarIcs(e: EventoCalendario): string {
  const linhas = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Maria Cristina Psicologa//Agenda//PT-BR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${escaparIcs(e.uid)}@psi-maria-cristina`,
    `DTSTAMP:${formatoUtc(new Date())}`,
    `DTSTART:${formatoUtc(e.inicio)}`,
    `DTEND:${formatoUtc(e.fim)}`,
    `SUMMARY:${escaparIcs(e.titulo)}`,
    ...(e.descricao ? [`DESCRIPTION:${escaparIcs(e.descricao)}`] : []),
    ...(e.local ? [`LOCATION:${escaparIcs(e.local)}`] : []),
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    'DESCRIPTION:Lembrete da consulta',
    'TRIGGER:-PT1H',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return linhas.map(dobrar).join('\r\n') + '\r\n';
}

/** Evento visto pelo PACIENTE: sem nome de terceiros nem dado clínico. */
export function eventoConsultaPaciente(c: { id: string; inicio: Date; modalidade: 'presencial' | 'online' | null }): EventoCalendario {
  return {
    uid: c.id,
    titulo: 'Consulta com Maria Cristina · Psicóloga',
    inicio: c.inicio,
    fim: fimPorDuracao(c.inicio),
    descricao: c.modalidade === 'online' ? 'Atendimento online.' : 'Atendimento presencial.',
    local: c.modalidade === 'online' ? 'Online' : 'Planaltina-DF',
  };
}

/** Evento visto pela PSICÓLOGA: só o PRIMEIRO nome do paciente (minimização — o evento vai para
 *  um serviço de terceiros), sem motivo/observações/relatório. */
export function eventoConsultaPsicologa(c: {
  id: string;
  inicio: Date;
  modalidade: 'presencial' | 'online' | null;
  pacienteNome: string;
}): EventoCalendario {
  const primeiroNome = c.pacienteNome.trim().split(/\s+/)[0] || 'Paciente';
  return {
    uid: `${c.id}-psicologa`,
    titulo: `Consulta · ${primeiroNome}`,
    inicio: c.inicio,
    fim: fimPorDuracao(c.inicio),
    descricao: c.modalidade === 'online' ? 'Atendimento online.' : 'Atendimento presencial.',
  };
}
