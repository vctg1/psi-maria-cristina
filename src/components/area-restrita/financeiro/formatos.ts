// Formatação de moeda para as telas de Financeiro — client-safe (sem fs/prisma/server-only).

export function formatarMoeda(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
