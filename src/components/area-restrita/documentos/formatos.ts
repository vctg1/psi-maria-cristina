// Utilitário puro de formatação para telas de documentos clínicos.
// Sem 'use client': pode ser importado tanto por componentes da área da psicóloga
// quanto pela área do paciente.

/** Formata um tamanho em bytes para uma string legível em pt-BR (ex.: "850 KB", "1,2 MB"). */
export function formatarTamanho(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '—';
  if (bytes < 1024) return `${bytes} B`;

  const unidades = ['KB', 'MB', 'GB'];
  let valor = bytes / 1024;
  let indice = 0;
  while (valor >= 1024 && indice < unidades.length - 1) {
    valor /= 1024;
    indice += 1;
  }

  const casasDecimais = valor < 10 && indice > 0 ? 1 : 0;
  const texto = valor.toLocaleString('pt-BR', {
    minimumFractionDigits: casasDecimais,
    maximumFractionDigits: casasDecimais,
  });
  return `${texto} ${unidades[indice]}`;
}
