import 'server-only';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@/generated/prisma/client';
import type { ConsultaStatus } from '@/types';
import type { ConsultaDto, ConsultaDtoPaciente, Modalidade } from '@/types/agenda';
import { verificarLivreNaTransacao, type ResultadoVerificacao } from './disponibilidade';

export class HorarioIndisponivel extends Error {
  motivo: Exclude<ResultadoVerificacao, 'livre'>;
  constructor(motivo: Exclude<ResultadoVerificacao, 'livre'>) {
    super('Horário indisponível');
    this.motivo = motivo;
  }
}

export const SELECT_CONSULTA_COM_PACIENTE = {
  id: true,
  inicio: true,
  status: true,
  modalidade: true,
  motivo: true,
  observacoes: true,
  relatorio: true,
  criadaPor: true,
  confirmadaEm: true,
  encerradaEm: true,
  canceladaEm: true,
  canceladaPor: true,
  motivoCancelamento: true,
  criadaEm: true,
  pacienteId: true,
  paciente: { select: { id: true, nome: true, telefone: true, usuarioId: true } },
} as const;

export type ConsultaComPaciente = Prisma.ConsultaGetPayload<{ select: typeof SELECT_CONSULTA_COM_PACIENTE }>;

type NovaConsulta = {
  pacienteId: string;
  inicio: Date;
  modalidade: Modalidade;
  motivo?: string | null;
  observacoes?: string | null;
  criadaPor: 'paciente' | 'psicologa';
};

/** Cria a consulta revalidando a disponibilidade dentro de uma transação serializável. */
export async function criarConsultaComTrava(dados: NovaConsulta): Promise<ConsultaComPaciente> {
  try {
    return await prisma.$transaction(
      async (tx) => {
        const resultado = await verificarLivreNaTransacao(tx, dados.inicio);
        if (resultado !== 'livre') throw new HorarioIndisponivel(resultado);

        return tx.consulta.create({
          data: {
            pacienteId: dados.pacienteId,
            inicio: dados.inicio,
            modalidade: dados.modalidade,
            motivo: dados.motivo ?? null,
            observacoes: dados.observacoes ?? null,
            criadaPor: dados.criadaPor,
            status: 'agendada',
          },
          select: SELECT_CONSULTA_COM_PACIENTE,
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 5000, timeout: 10000 }
    );
  } catch (error) {
    if (error instanceof HorarioIndisponivel) throw error;
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
      throw new HorarioIndisponivel('ocupado');
    }
    throw error;
  }
}

export function paraConsultaDto(c: ConsultaComPaciente): ConsultaDto {
  return {
    id: c.id,
    inicio: c.inicio.toISOString(),
    status: c.status as ConsultaStatus,
    modalidade: c.modalidade as Modalidade | null,
    motivo: c.motivo,
    observacoes: c.observacoes,
    relatorio: c.relatorio,
    criadaPor: c.criadaPor,
    confirmadaEm: c.confirmadaEm ? c.confirmadaEm.toISOString() : null,
    encerradaEm: c.encerradaEm ? c.encerradaEm.toISOString() : null,
    canceladaEm: c.canceladaEm ? c.canceladaEm.toISOString() : null,
    canceladaPor: c.canceladaPor,
    motivoCancelamento: c.motivoCancelamento,
    criadaEm: c.criadaEm.toISOString(),
    paciente: {
      id: c.paciente.id,
      nome: c.paciente.nome,
      telefone: c.paciente.telefone,
      temLogin: c.paciente.usuarioId !== null,
    },
  };
}

export function paraConsultaDtoPaciente(c: ConsultaComPaciente): ConsultaDtoPaciente {
  const dto = paraConsultaDto(c);
  return {
    id: dto.id,
    inicio: dto.inicio,
    status: dto.status,
    modalidade: dto.modalidade,
    motivo: dto.motivo,
    observacoes: dto.observacoes,
    criadaPor: dto.criadaPor,
    confirmadaEm: dto.confirmadaEm,
    encerradaEm: dto.encerradaEm,
    canceladaEm: dto.canceladaEm,
    canceladaPor: dto.canceladaPor,
    motivoCancelamento: dto.motivoCancelamento,
    criadaEm: dto.criadaEm,
    paciente: { id: c.paciente.id, nome: c.paciente.nome },
  };
}
