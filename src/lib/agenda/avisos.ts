import 'server-only';
import { prisma } from '@/lib/prisma';
import { enviarEmail } from '@/lib/email/enviar';
import { emailConsultaConfirmada, emailAgendamentoRecebido, emailNovoAgendamentoPsicologa } from '@/lib/email/templates';
import { eventoConsultaPaciente, linkGoogleCalendar, gerarIcs } from '@/lib/calendario';
import { urlAbsoluta } from '@/lib/url-publica';
import { partesLocais } from './tempo';
import type { Modalidade } from '@/types/agenda';

/** Fase 6 · Bloco 6: avisos por e-mail/notificação em volta do ciclo de vida da consulta.
 *  Tudo aqui é tolerante a falha — nunca lança, nunca desfaz a consulta/notificação que já
 *  foi persistida. Chamado a partir de rotas via `after()` (não atrasa a resposta ao cliente). */

/** Envia ao PACIENTE o e-mail de "consulta confirmada" com o convite de calendário anexado
 *  (.ics) e o link do Google Calendar. Não faz nada se o paciente não tiver e-mail (sem login). */
export async function enviarConfirmacaoAoPaciente(consultaId: string): Promise<void> {
  try {
    const consulta = await prisma.consulta.findUnique({
      where: { id: consultaId },
      select: {
        id: true,
        inicio: true,
        modalidade: true,
        paciente: { select: { nome: true, usuario: { select: { email: true } } } },
      },
    });
    if (!consulta) return;
    const email = consulta.paciente.usuario?.email;
    if (!email) return;

    const evento = eventoConsultaPaciente({
      id: consulta.id,
      inicio: consulta.inicio,
      modalidade: consulta.modalidade as Modalidade | null,
    });
    const ics = gerarIcs(evento);
    const conteudo = emailConsultaConfirmada({
      nome: consulta.paciente.nome,
      inicio: consulta.inicio,
      modalidade: consulta.modalidade ?? 'presencial',
      linkGoogleCalendar: linkGoogleCalendar(evento),
    });

    await enviarEmail({
      para: email,
      assunto: conteudo.assunto,
      html: conteudo.html,
      texto: conteudo.texto,
      anexos: [
        {
          nomeArquivo: 'consulta.ics',
          conteudo: Buffer.from(ics, 'utf-8').toString('base64'),
          tipo: 'text/calendar',
        },
      ],
    });
  } catch (erro) {
    console.error('[agenda/avisos] falha ao enviar confirmação ao paciente', erro instanceof Error ? erro.message : erro);
  }
}

/** Notifica a psicóloga (in-app + e-mail) de um novo agendamento feito por um visitante/paciente,
 *  e avisa o paciente (se tiver e-mail) que o pedido foi recebido e aguarda confirmação. */
export async function avisarNovoAgendamento(consultaId: string): Promise<void> {
  try {
    const consulta = await prisma.consulta.findUnique({
      where: { id: consultaId },
      select: {
        id: true,
        inicio: true,
        modalidade: true,
        paciente: { select: { nome: true, usuario: { select: { email: true } } } },
      },
    });
    if (!consulta) return;

    const { data, hora } = partesLocais(consulta.inicio);
    const dataBr = `${data.slice(8, 10)}/${data.slice(5, 7)}/${data.slice(0, 4)}`;
    const primeiroNome = consulta.paciente.nome.trim().split(/\s+/)[0] || 'Paciente';
    const mensagem = `${primeiroNome} agendou para ${dataBr} às ${hora}`;

    await prisma.notificacao.create({
      data: {
        tipo: 'novo_agendamento',
        titulo: 'Novo agendamento',
        mensagem,
        consultaId: consulta.id,
        lida: false,
      },
    });

    const psicologas = await prisma.usuario.findMany({
      where: { papel: 'psicologa', ativo: true },
      select: { email: true },
    });

    const linkAgenda = urlAbsoluta(`/area-restrita/agenda?semana=${data}`);
    for (const p of psicologas) {
      const conteudo = emailNovoAgendamentoPsicologa({
        nomePaciente: consulta.paciente.nome,
        inicio: consulta.inicio,
        modalidade: consulta.modalidade ?? 'presencial',
        linkAgenda,
      });
      await enviarEmail({ para: p.email, assunto: conteudo.assunto, html: conteudo.html, texto: conteudo.texto });
    }

    const emailPaciente = consulta.paciente.usuario?.email;
    if (emailPaciente) {
      const conteudo = emailAgendamentoRecebido({
        nome: consulta.paciente.nome,
        inicio: consulta.inicio,
        modalidade: consulta.modalidade ?? 'presencial',
      });
      await enviarEmail({ para: emailPaciente, assunto: conteudo.assunto, html: conteudo.html, texto: conteudo.texto });
    }
  } catch (erro) {
    console.error('[agenda/avisos] falha ao avisar novo agendamento', erro instanceof Error ? erro.message : erro);
  }
}
