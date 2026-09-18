import 'server-only';
import type { PacienteDetalhe, PacienteResumo } from '@/types/paciente';

export type ResultadoValidacao<T> = { ok: true; dados: T } | { ok: false; campos: Record<string, string> };

export type PacienteEntradaValidada = {
  nome: string;
  email: string;
  telefone: string;
  dataNascimento: string;
  cpf: string | null;
  responsavel: string | null;
  telefoneResponsavel: string | null;
  observacoesCadastro: string | null;
};

export type PacienteEdicaoValidada = {
  nome?: string;
  email?: string;
  telefone?: string;
  dataNascimento?: string;
  cpf?: string | null;
  responsavel?: string | null;
  telefoneResponsavel?: string | null;
  observacoesCadastro?: string | null;
  ativo?: boolean;
};

/** Formato mínimo retornado pelo Prisma (via `select`) necessário para montar PacienteResumo. */
export type PacienteParaResumo = {
  id: string;
  usuarioId: string;
  nome: string;
  telefone: string;
  criadoEm: Date;
  usuario: { email: string; ativo: boolean; senhaHash: string | null };
};

/** Formato mínimo retornado pelo Prisma (via `select`) necessário para montar PacienteDetalhe. */
export type PacienteParaDetalhe = PacienteParaResumo & {
  dataNascimento: Date;
  cpf: string | null;
  responsavel: string | null;
  telefoneResponsavel: string | null;
  observacoesCadastro: string | null;
  origemCadastro: 'psicologa' | 'autocadastro';
  atualizadoEm: Date;
  usuario: PacienteParaResumo['usuario'] & { ultimoLoginEm: Date | null };
};

const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const REGEX_DATA = /^\d{4}-\d{2}-\d{2}$/;

function isString(v: unknown): v is string {
  return typeof v === 'string';
}

function limparDigitos(v: string): string {
  return v.replace(/\D/g, '');
}

/** Algoritmo padrão de dígitos verificadores do CPF (módulo 11). */
function cpfValido(digitos: string): boolean {
  if (digitos.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(digitos)) return false;

  const calcularDigito = (base: string, pesoInicial: number): number => {
    let soma = 0;
    for (let i = 0; i < base.length; i++) {
      soma += parseInt(base[i], 10) * (pesoInicial - i);
    }
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };

  const digito1 = calcularDigito(digitos.slice(0, 9), 10);
  const digito2 = calcularDigito(digitos.slice(0, 10), 11);
  return digito1 === parseInt(digitos[9], 10) && digito2 === parseInt(digitos[10], 10);
}

function calcularIdade(dataISO: string): number {
  const hoje = new Date();
  const nascimento = new Date(dataISO + 'T12:00:00');
  let idade = hoje.getFullYear() - nascimento.getFullYear();
  const diffMes = hoje.getMonth() - nascimento.getMonth();
  if (diffMes < 0 || (diffMes === 0 && hoje.getDate() < nascimento.getDate())) {
    idade--;
  }
  return idade;
}

type CampoResultado<T> = { valor?: T; erro?: string };

function validarNomeCampo(v: unknown): CampoResultado<string> {
  if (!isString(v)) return { erro: 'Nome é obrigatório' };
  const nome = v.trim();
  if (nome.length < 2 || nome.length > 120) {
    return { erro: 'Nome deve ter entre 2 e 120 caracteres' };
  }
  return { valor: nome };
}

function validarEmailCampo(v: unknown): CampoResultado<string> {
  if (!isString(v)) return { erro: 'E-mail é obrigatório' };
  const email = v.trim().toLowerCase();
  if (!email || email.length > 254 || !REGEX_EMAIL.test(email)) {
    return { erro: 'E-mail inválido' };
  }
  return { valor: email };
}

function validarTelefoneCampo(v: unknown, obrigatorio: boolean): CampoResultado<string | null> {
  if (v === undefined || v === null || v === '') {
    if (obrigatorio) return { erro: 'Telefone é obrigatório' };
    return { valor: null };
  }
  if (!isString(v)) return { erro: 'Telefone inválido' };
  const digitos = limparDigitos(v);
  if (digitos.length < 10 || digitos.length > 13) {
    return { erro: 'Telefone deve ter entre 10 e 13 dígitos' };
  }
  return { valor: digitos };
}

function validarDataNascimentoCampo(v: unknown): CampoResultado<string> {
  if (!isString(v) || !REGEX_DATA.test(v)) return { erro: 'Data de nascimento inválida' };

  const [anoStr, mesStr, diaStr] = v.split('-');
  const ano = parseInt(anoStr, 10);
  const mes = parseInt(mesStr, 10);
  const dia = parseInt(diaStr, 10);
  if (ano < 1900) return { erro: 'Data de nascimento inválida' };

  const data = new Date(v + 'T12:00:00');
  if (isNaN(data.getTime())) return { erro: 'Data de nascimento inválida' };
  // Detecta datas de calendário inválidas (ex.: 2024-02-30) que o Date "normaliza".
  if (data.getFullYear() !== ano || data.getMonth() + 1 !== mes || data.getDate() !== dia) {
    return { erro: 'Data de nascimento inválida' };
  }

  const hoje = new Date();
  hoje.setHours(23, 59, 59, 999);
  if (data > hoje) return { erro: 'Data de nascimento não pode ser futura' };

  return { valor: v };
}

function validarCpfCampo(v: unknown): CampoResultado<string | null> {
  if (v === undefined || v === null || v === '') return { valor: null };
  if (!isString(v)) return { erro: 'CPF inválido' };
  const digitos = limparDigitos(v);
  if (!cpfValido(digitos)) return { erro: 'CPF inválido' };
  return { valor: digitos };
}

function validarTextoOpcional(v: unknown, max: number, label: string): CampoResultado<string | null> {
  if (v === undefined || v === null || v === '') return { valor: null };
  if (!isString(v)) return { erro: `${label} inválido` };
  const texto = v.trim();
  if (texto === '') return { valor: null };
  if (texto.length > max) return { erro: `${label} deve ter no máximo ${max} caracteres` };
  return { valor: texto };
}

function comoObjeto(body: unknown): Record<string, unknown> {
  return body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
}

/** Cadastro de paciente (nome, email, telefone, dataNascimento obrigatórios). Whitelist explícita:
 *  qualquer chave fora das tratadas abaixo é ignorada (nunca copiada para o resultado). */
export function validarPacienteEntrada(body: unknown): ResultadoValidacao<PacienteEntradaValidada> {
  const obj = comoObjeto(body);
  const campos: Record<string, string> = {};

  const nome = validarNomeCampo(obj.nome);
  if (nome.erro) campos.nome = nome.erro;

  const email = validarEmailCampo(obj.email);
  if (email.erro) campos.email = email.erro;

  const telefone = validarTelefoneCampo(obj.telefone, true);
  if (telefone.erro) campos.telefone = telefone.erro;

  const dataNascimento = validarDataNascimentoCampo(obj.dataNascimento);
  if (dataNascimento.erro) campos.dataNascimento = dataNascimento.erro;

  const cpf = validarCpfCampo(obj.cpf);
  if (cpf.erro) campos.cpf = cpf.erro;

  const responsavel = validarTextoOpcional(obj.responsavel, 120, 'Responsável');
  if (responsavel.erro) campos.responsavel = responsavel.erro;

  const telefoneResponsavel = validarTelefoneCampo(obj.telefoneResponsavel, false);
  if (telefoneResponsavel.erro) campos.telefoneResponsavel = telefoneResponsavel.erro;

  if (!dataNascimento.erro && dataNascimento.valor && calcularIdade(dataNascimento.valor) < 18) {
    if (!responsavel.erro && !responsavel.valor) campos.responsavel = 'Obrigatório para menor de idade';
    if (!telefoneResponsavel.erro && !telefoneResponsavel.valor) {
      campos.telefoneResponsavel = 'Obrigatório para menor de idade';
    }
  }

  const observacoesCadastro = validarTextoOpcional(obj.observacoesCadastro, 2000, 'Observações');
  if (observacoesCadastro.erro) campos.observacoesCadastro = observacoesCadastro.erro;

  if (Object.keys(campos).length > 0) return { ok: false, campos };

  return {
    ok: true,
    dados: {
      nome: nome.valor as string,
      email: email.valor as string,
      telefone: telefone.valor as string,
      dataNascimento: dataNascimento.valor as string,
      cpf: cpf.valor ?? null,
      responsavel: responsavel.valor ?? null,
      telefoneResponsavel: telefoneResponsavel.valor ?? null,
      observacoesCadastro: observacoesCadastro.valor ?? null,
    },
  };
}

/** Edição de paciente: todos os campos opcionais; só o que vier no body é validado/retornado.
 *  Whitelist explícita — `id`, `usuarioId`, `senhaHash`, `papel`, `origemCadastro`, `criadoEm` etc.
 *  nunca são lidos do body (não existe branch para eles). */
export function validarPacienteEdicao(body: unknown): ResultadoValidacao<PacienteEdicaoValidada> {
  const obj = comoObjeto(body);
  const campos: Record<string, string> = {};
  const dados: PacienteEdicaoValidada = {};

  let dataNascimentoValor: string | undefined;
  let responsavelInformado = false;
  let responsavelValor: string | null | undefined;
  let telefoneRespInformado = false;
  let telefoneRespValor: string | null | undefined;

  if (obj.nome !== undefined) {
    const nome = validarNomeCampo(obj.nome);
    if (nome.erro) campos.nome = nome.erro;
    else dados.nome = nome.valor;
  }

  if (obj.email !== undefined) {
    const email = validarEmailCampo(obj.email);
    if (email.erro) campos.email = email.erro;
    else dados.email = email.valor;
  }

  if (obj.telefone !== undefined) {
    const telefone = validarTelefoneCampo(obj.telefone, true);
    if (telefone.erro) campos.telefone = telefone.erro;
    else dados.telefone = telefone.valor as string;
  }

  if (obj.dataNascimento !== undefined) {
    const dataNascimento = validarDataNascimentoCampo(obj.dataNascimento);
    if (dataNascimento.erro) campos.dataNascimento = dataNascimento.erro;
    else {
      dados.dataNascimento = dataNascimento.valor;
      dataNascimentoValor = dataNascimento.valor;
    }
  }

  if (obj.cpf !== undefined) {
    const cpf = validarCpfCampo(obj.cpf);
    if (cpf.erro) campos.cpf = cpf.erro;
    else dados.cpf = cpf.valor ?? null;
  }

  if (obj.responsavel !== undefined) {
    const responsavel = validarTextoOpcional(obj.responsavel, 120, 'Responsável');
    if (responsavel.erro) campos.responsavel = responsavel.erro;
    else {
      dados.responsavel = responsavel.valor ?? null;
      responsavelInformado = true;
      responsavelValor = responsavel.valor ?? null;
    }
  }

  if (obj.telefoneResponsavel !== undefined) {
    const telefoneResponsavel = validarTelefoneCampo(obj.telefoneResponsavel, false);
    if (telefoneResponsavel.erro) campos.telefoneResponsavel = telefoneResponsavel.erro;
    else {
      dados.telefoneResponsavel = telefoneResponsavel.valor ?? null;
      telefoneRespInformado = true;
      telefoneRespValor = telefoneResponsavel.valor ?? null;
    }
  }

  // Regra de menor de idade só é verificável aqui quando dataNascimento vem no próprio body
  // (esta função é pura e não tem acesso ao registro já salvo no banco).
  if (dataNascimentoValor && calcularIdade(dataNascimentoValor) < 18) {
    if (responsavelInformado && !responsavelValor) campos.responsavel = 'Obrigatório para menor de idade';
    if (telefoneRespInformado && !telefoneRespValor) {
      campos.telefoneResponsavel = 'Obrigatório para menor de idade';
    }
  }

  if (obj.observacoesCadastro !== undefined) {
    const observacoesCadastro = validarTextoOpcional(obj.observacoesCadastro, 2000, 'Observações');
    if (observacoesCadastro.erro) campos.observacoesCadastro = observacoesCadastro.erro;
    else dados.observacoesCadastro = observacoesCadastro.valor ?? null;
  }

  if (obj.ativo !== undefined) {
    if (typeof obj.ativo !== 'boolean') campos.ativo = 'Ativo deve ser verdadeiro ou falso';
    else dados.ativo = obj.ativo;
  }

  if (Object.keys(campos).length > 0) return { ok: false, campos };
  return { ok: true, dados };
}

export function paraResumo(p: PacienteParaResumo): PacienteResumo {
  return {
    id: p.id,
    usuarioId: p.usuarioId,
    nome: p.nome,
    telefone: p.telefone,
    email: p.usuario.email,
    primeiroAcessoPendente: p.usuario.senhaHash === null,
    ativo: p.usuario.ativo,
    criadoEm: p.criadoEm.toISOString(),
  };
}

export function paraDetalhe(p: PacienteParaDetalhe): PacienteDetalhe {
  return {
    ...paraResumo(p),
    dataNascimento: p.dataNascimento.toISOString().slice(0, 10),
    cpf: p.cpf,
    responsavel: p.responsavel,
    telefoneResponsavel: p.telefoneResponsavel,
    observacoesCadastro: p.observacoesCadastro,
    origemCadastro: p.origemCadastro,
    ultimoLoginEm: p.usuario.ultimoLoginEm ? p.usuario.ultimoLoginEm.toISOString() : null,
    atualizadoEm: p.atualizadoEm.toISOString(),
  };
}
