// Util client-safe para montar links wa.me a partir de um telefone brasileiro.
// Mesma lógica usada em src/app/area-restrita/pacientes/[id]/page.tsx — mantida
// aqui para não criar dependência cruzada entre pastas de telas distintas.

function apenasDigitos(valor: string): string {
  return valor.replace(/\D/g, '');
}

export function telefoneComDdi(telefone: string): string {
  const digitos = apenasDigitos(telefone);
  return digitos.startsWith('55') ? digitos : `55${digitos}`;
}
