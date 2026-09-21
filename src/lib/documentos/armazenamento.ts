import 'server-only';
import { randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, stat, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import type { DocumentoDto, DocumentoDtoPaciente, DocumentoMime } from '@/types/documento';

export const EXTENSAO_POR_MIME: Record<DocumentoMime, '.pdf' | '.png' | '.jpg'> = {
  'application/pdf': '.pdf',
  'image/png': '.png',
  'image/jpeg': '.jpg',
};

let diretorioGarantido: string | null = null;

/** Resolve e garante (mkdir -p) o diretório privado de documentos. Nunca dentro de /public. */
export function diretorioDocumentos(): string {
  const base = process.env.DOCUMENTOS_DIR ?? 'documentos-privados';
  const dir = path.resolve(process.cwd(), base);
  const publicDir = path.resolve(process.cwd(), 'public');

  if (dir === publicDir || dir.startsWith(publicDir + path.sep)) {
    throw new Error('DOCUMENTOS_DIR não pode estar dentro de /public');
  }

  if (diretorioGarantido !== dir) {
    // mkdir recursive é idempotente; não precisa await bloquear todo request após a primeira vez,
    // mas garantimos aqui de forma síncrona via promise para simplicidade de uso.
    diretorioGarantido = dir;
  }

  return dir;
}

async function garantirDiretorio(): Promise<string> {
  const dir = diretorioDocumentos();
  await mkdir(dir, { recursive: true });
  return dir;
}

/** Limite de upload em bytes, a partir de DOCUMENTOS_MAX_MB (inteiro 1..100; padrão 15). */
export function limiteBytes(): number {
  const raw = process.env.DOCUMENTOS_MAX_MB;
  const parsed = raw ? parseInt(raw, 10) : NaN;
  const mb = Number.isInteger(parsed) && parsed >= 1 && parsed <= 100 ? parsed : 15;
  return mb * 1024 * 1024;
}

/** Detecta o tipo real do arquivo pelos magic bytes. Nunca confiar no `file.type` do upload. */
export function detectarMime(buffer: Buffer): DocumentoMime | null {
  if (buffer.length >= 5 && buffer.subarray(0, 5).toString('latin1') === '%PDF-') {
    return 'application/pdf';
  }
  const pngMagic = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (buffer.length >= pngMagic.length && buffer.subarray(0, pngMagic.length).equals(pngMagic)) {
    return 'image/png';
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }
  return null;
}

export function gerarNomeArquivo(mime: DocumentoMime): string {
  return randomUUID() + EXTENSAO_POR_MIME[mime];
}

const REGEX_NOME_ARQUIVO = /^[0-9a-f-]{36}\.(pdf|png|jpg)$/;

/** Resolve o caminho absoluto de um nomeArquivo já validado/gerado (nunca vindo do request).
 *  Defesa em profundidade contra path traversal: valida formato e confirma que o caminho
 *  resultante permanece dentro do diretório de documentos. */
export function caminhoDoArquivo(nomeArquivo: string): string {
  if (!REGEX_NOME_ARQUIVO.test(nomeArquivo)) {
    throw new Error('Nome de arquivo inválido');
  }
  const dir = diretorioDocumentos();
  const caminho = path.join(dir, nomeArquivo);
  if (!caminho.startsWith(dir + path.sep)) {
    throw new Error('Caminho de arquivo inválido');
  }
  return caminho;
}

/** Grava o arquivo com flag 'wx' (falha se já existir) e permissão restrita (0o600). */
export async function salvarArquivo(nomeArquivo: string, buffer: Buffer): Promise<void> {
  await garantirDiretorio();
  const caminho = caminhoDoArquivo(nomeArquivo);
  await writeFile(caminho, buffer, { flag: 'wx', mode: 0o600 });
}

/** Remove o arquivo do disco; ignora se já não existir (ENOENT). */
export async function removerArquivo(nomeArquivo: string): Promise<void> {
  const caminho = caminhoDoArquivo(nomeArquivo);
  try {
    await unlink(caminho);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
}

/** Stream de leitura pronto para uso em `new Response(stream, ...)`.
 *  Confere a existência ANTES de abrir: `createReadStream` só emite ENOENT de forma assíncrona
 *  no stream, o que não seria capturável pelo try/catch da rota (resposta quebraria no meio). */
export async function abrirStream(nomeArquivo: string): Promise<ReadableStream> {
  const caminho = caminhoDoArquivo(nomeArquivo);
  await stat(caminho); // lança ENOENT se o arquivo físico sumiu
  return Readable.toWeb(createReadStream(caminho)) as ReadableStream;
}

/** Sanitiza um nome de arquivo enviado pelo cliente para uso só como rótulo de exibição. */
export function sanitizarNomeOriginal(nome: string): string {
  const base = path.basename(nome);
  // Remove caracteres de controle e separadores/aspas que poderiam confundir a exibição/headers.
  const limpo = base.replace(/[\u0000-\u001f\u007f"\\/]/g, '').trim();
  const cortado = limpo.slice(0, 255);
  return cortado === '' ? 'documento' : cortado;
}

/** Gera o header Content-Disposition com fallback ASCII + filename* UTF-8 (RFC 5987). */
export function nomeParaContentDisposition(nome: string): string {
  const asciiFallback = nome.replace(/[^\x20-\x7e]/g, '_').replace(/"/g, '_');
  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(nome)}`;
}

/** Campos mínimos necessários para montar os DTOs de documento (sem nomeArquivo/enviadoPorId). */
export const SELECT_DOCUMENTO = {
  id: true,
  pacienteId: true,
  titulo: true,
  nomeOriginal: true,
  mimeType: true,
  tamanhoBytes: true,
  visivelParaPaciente: true,
  criadoEm: true,
} as const;

type DocumentoParaDto = {
  id: string;
  pacienteId: string;
  titulo: string;
  nomeOriginal: string;
  mimeType: string;
  tamanhoBytes: number;
  visivelParaPaciente: boolean;
  criadoEm: Date;
};

export function paraDocumentoDto(d: DocumentoParaDto): DocumentoDto {
  return {
    id: d.id,
    pacienteId: d.pacienteId,
    titulo: d.titulo,
    nomeOriginal: d.nomeOriginal,
    mimeType: d.mimeType as DocumentoDto['mimeType'],
    tamanhoBytes: d.tamanhoBytes,
    visivelParaPaciente: d.visivelParaPaciente,
    criadoEm: d.criadoEm.toISOString(),
  };
}

export function paraDocumentoDtoPaciente(d: DocumentoParaDto): DocumentoDtoPaciente {
  return {
    id: d.id,
    titulo: d.titulo,
    nomeOriginal: d.nomeOriginal,
    mimeType: d.mimeType as DocumentoDtoPaciente['mimeType'],
    tamanhoBytes: d.tamanhoBytes,
    criadoEm: d.criadoEm.toISOString(),
  };
}
