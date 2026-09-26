import 'server-only';
import { prisma } from '@/lib/prisma';
import { montarInicio, partesLocais } from './tempo';
import type { Alerta, AlertaCancelamento, AlertaNovoAgendamento, AlertasResposta } from '@/types/alertas';
import type { Modalidade } from '@/types/agenda';

/** Monta a lista de alertas da psicóloga: lembretes de véspera (derivados, sem job) +
 *  cancelamentos feitos pelo paciente (notificações não lidas).
 *  Ordem: lembretes primeiro (ação hoje, para avisar a véspera), depois cancelamentos
 *  por data de criação decrescente (mais recente primeiro). */
export async function listarAlertas(): Promise<AlertasResposta> {
  const hoje = partesLocais(new Date()).data;
  const amanha = somarUmDia(hoje);
  const inicioJanela = montarInicio(amanha, '00:00');
  const fimJanela = montarInicio(somarUmDia(amanha), '00:00');

  const [consultasAmanha, notificacoesNaoLidas] = await Promise.all([
    prisma.consulta.findMany({
      where: {
        status: 'confirmada',
        lembreteEnviadoEm: null,
        inicio: { gte: inicioJanela, lt: fimJanela },
      },
      select: {
        id: true,
        inicio: true,
        modalidade: true,
        paciente: { select: { nome: true, telefone: true, usuarioId: true } },
      },
      orderBy: { inicio: 'asc' },
    }),
    prisma.notificacao.findMany({
      where: { lida: false },
      include: {
        consulta: {
          select: {
            id: true,
            inicio: true,
            paciente: { select: { nome: true, telefone: true } },
          },
        },
      },
      orderBy: { criadaEm: 'desc' },
    }),
  ]);

  const lembretes: Alerta[] = consultasAmanha.map((c) => ({
    tipo: 'lembrete',
    id: c.id,
    consulta: {
      id: c.id,
      inicio: c.inicio.toISOString(),
      modalidade: c.modalidade as Modalidade | null,
      pacienteNome: c.paciente.nome,
      pacienteTelefone: c.paciente.telefone,
      temLogin: c.paciente.usuarioId !== null,
    },
  }));

  const cancelamentos: AlertaCancelamento[] = [];
  const novosAgendamentos: AlertaNovoAgendamento[] = [];

  for (const n of notificacoesNaoLidas) {
    const consulta = n.consulta
      ? {
          id: n.consulta.id,
          inicio: n.consulta.inicio.toISOString(),
          pacienteNome: n.consulta.paciente.nome,
          pacienteTelefone: n.consulta.paciente.telefone,
        }
      : null;

    if (n.tipo === 'novo_agendamento') {
      novosAgendamentos.push({
        tipo: 'novo_agendamento',
        id: n.id,
        titulo: n.titulo,
        mensagem: n.mensagem,
        criadaEm: n.criadaEm.toISOString(),
        consulta,
      });
    } else if (n.tipo === 'cancelamento') {
      cancelamentos.push({
        tipo: 'cancelamento',
        id: n.id,
        titulo: n.titulo,
        mensagem: n.mensagem,
        criadaEm: n.criadaEm.toISOString(),
        consulta,
      });
    }
    // outros tipos (ex.: pagamento_recebido) não têm alerta próprio ainda — ignorados aqui.
  }

  return {
    alertas: [...lembretes, ...cancelamentos, ...novosAgendamentos],
    totais: { cancelamentos: cancelamentos.length, lembretes: lembretes.length, novosAgendamentos: novosAgendamentos.length },
  };
}

function somarUmDia(data: string): string {
  const base = montarInicio(data, '12:00');
  const resultado = new Date(base.getTime() + 86400000);
  const ano = resultado.getUTCFullYear();
  const mes = String(resultado.getUTCMonth() + 1).padStart(2, '0');
  const dia = String(resultado.getUTCDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}
