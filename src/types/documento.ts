// Tipos de contrato compartilhados entre cliente e servidor para /api/documentos.
// Sem imports de servidor (fs, prisma, server-only) — pode ser importado por Client Components.
// NUNCA inclui `nomeArquivo` (nome no disco) nem qualquer caminho: o cliente só conhece o `id`.

export const DOCUMENTO_MIME_PERMITIDOS = ['application/pdf', 'image/png', 'image/jpeg'] as const;
export type DocumentoMime = (typeof DOCUMENTO_MIME_PERMITIDOS)[number];

export const DOCUMENTO_TITULO_MAX = 120;

/** Visão da psicóloga: todos os documentos de um paciente. */
export type DocumentoDto = {
  id: string;
  pacienteId: string;
  titulo: string;
  nomeOriginal: string;
  mimeType: DocumentoMime;
  tamanhoBytes: number;
  visivelParaPaciente: boolean;
  criadoEm: string; // ISO
};

/** Visão do paciente: só os próprios com visivelParaPaciente=true. Sem pacienteId nem flag. */
export type DocumentoDtoPaciente = {
  id: string;
  titulo: string;
  nomeOriginal: string;
  mimeType: DocumentoMime;
  tamanhoBytes: number;
  criadoEm: string; // ISO
};

/** Body do PATCH /api/documentos/[id] — whitelist; pacienteId NÃO é alterável. */
export type DocumentoEdicao = {
  titulo?: string;
  visivelParaPaciente?: boolean;
};
