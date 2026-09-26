import 'server-only';
import { LOGO_EMAIL_CONTENT_ID, LOGO_EMAIL_LARGURA, LOGO_EMAIL_ALTURA } from './logo';

const COR_TERRACOTA = '#A65A40';
const COR_FUNDO = '#FAF6F0';
const COR_TEXTO = '#3D322C';

export type ConteudoEmail = { assunto: string; html: string; texto: string };

/** Escapa caracteres especiais de HTML. Todo dado vindo do banco/usuário (nome de
 *  paciente, motivo, etc.) DEVE passar por aqui antes de entrar em um template. */
export function escaparHtml(valor: string): string {
  return valor
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Primeiro nome, só se for "nome de gente": letras (com acento), hífen e apóstrofo, até 30
 *  caracteres. O nome chega do visitante no autocadastro público e o e-mail sai pelo nosso domínio
 *  para um endereço ainda não verificado — sem este filtro, um "nome" como `acesse bit.ly/x` viraria
 *  link clicável na saudação (relay de phishing, M29). Qualquer outra coisa vira saudação neutra. */
export function primeiroNomeSeguro(nome: string): string {
  const primeiro = nome.trim().split(/\s+/)[0] ?? '';
  return /^\p{L}[\p{L}'-]{0,29}$/u.test(primeiro) ? primeiro : '';
}

/** Nome completo sem nada que vire link: só letras, espaço, hífen e apóstrofo (até 80). Usado no
 *  aviso à PSICÓLOGA, que recebe o nome digitado por um visitante anônimo — sem isto, um "nome" com
 *  URL chegaria clicável na caixa da conta mais sensível do sistema (M29). */
export function nomeSemLinks(nome: string): string {
  const limpo = nome.replace(/[^\p{L}\s'-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 80);
  return limpo || 'Paciente';
}

function saudacao(nome: string): string {
  const n = primeiroNomeSeguro(nome);
  return n ? `Olá, ${n}!` : 'Olá!';
}

/** Valida que um link recebido já é absoluto (http/https) e o escapa para uso em
 *  atributo HTML. Lança se o link não vier em formato absoluto — quem chama os
 *  templates é responsável por montar o link com `urlAbsoluta` antes. */
function validarLinkAbsoluto(url: string): string {
  if (!/^https?:\/\//i.test(url)) {
    throw new Error('Link de e-mail deve ser absoluto (http:// ou https://)');
  }
  return escaparHtml(url);
}

function formatarDataHoraBr(data: Date): string {
  return data.toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Layout base compartilhado por todos os e-mails. `corpoHtml` já deve vir com os
 *  dados dinâmicos escapados pelo chamador. */
export function layoutBase(params: {
  titulo: string;
  corpoHtml: string;
  botao?: { texto: string; url: string };
}): string {
  const { titulo, corpoHtml, botao } = params;

  const botaoHtml = botao
    ? `
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 24px 0;">
        <tr>
          <td style="border-radius: 6px; background-color: ${COR_TERRACOTA};">
            <a href="${validarLinkAbsoluto(botao.url)}"
               style="display: inline-block; padding: 12px 24px; font-family: Arial, sans-serif; font-size: 15px; font-weight: bold; color: #FFFFFF; text-decoration: none; border-radius: 6px;">
              ${escaparHtml(botao.texto)}
            </a>
          </td>
        </tr>
      </table>`
    : '';

  return `<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escaparHtml(titulo)}</title>
  </head>
  <body style="margin: 0; padding: 0; background-color: ${COR_FUNDO}; font-family: Arial, sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: ${COR_FUNDO}; padding: 32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" style="max-width: 560px; background-color: #FFFFFF; border-radius: 10px; overflow: hidden;">
            <tr>
              <td align="center" style="background-color: #FFFFFF; padding: 28px 32px 20px 32px; border-bottom: 3px solid ${COR_TERRACOTA};">
                <img src="cid:${LOGO_EMAIL_CONTENT_ID}" width="${LOGO_EMAIL_LARGURA}" height="${LOGO_EMAIL_ALTURA}" alt="Maria Cristina · Psicóloga" style="display: block; border: 0; outline: none; text-decoration: none;" />
              </td>
            </tr>
            <tr>
              <td style="padding: 32px; color: ${COR_TEXTO}; font-size: 15px; line-height: 1.6;">
                <h1 style="font-size: 20px; margin: 0 0 16px 0; color: ${COR_TEXTO};">${escaparHtml(titulo)}</h1>
                ${corpoHtml}
                ${botaoHtml}
              </td>
            </tr>
            <tr>
              <td style="padding: 20px 32px; background-color: ${COR_FUNDO}; color: #8A7D73; font-size: 12px; text-align: center;">
                Maria Cristina · Psicóloga Clínica<br />
                <a href="https://www.instagram.com/psimariacristina_/" style="color: #8A7D73; text-decoration: underline;">Instagram: @psimariacristina_</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export function emailTeste(): ConteudoEmail {
  const assunto = 'Teste de envio';
  const html = layoutBase({
    titulo: 'Teste de envio',
    corpoHtml: '<p>Este é um e-mail de teste para validar a configuração do módulo de e-mail.</p>',
  });
  const texto = 'Teste de envio.\n\nEste é um e-mail de teste para validar a configuração do módulo de e-mail.';
  return { assunto, html, texto };
}

export function emailPrimeiroAcesso(params: { nome: string; link: string }): ConteudoEmail {
  const nome = escaparHtml(saudacao(params.nome));
  const assunto = 'Bem-vindo(a) — defina sua senha de acesso';
  const html = layoutBase({
    titulo: 'Bem-vindo(a)!',
    corpoHtml: `
      <p>${nome}</p>
      <p>Sua conta na área do paciente foi criada. Para acessá-la pela primeira vez, defina sua senha clicando no botão abaixo.</p>
    `,
    botao: { texto: 'Definir minha senha', url: params.link },
  });
  const texto = `${saudacao(params.nome)}\n\nSua conta na área do paciente foi criada. Para acessá-la pela primeira vez, defina sua senha através do link abaixo:\n${params.link}`;
  return { assunto, html, texto };
}

export function emailRedefinicaoSenha(params: {
  nome: string;
  link: string;
  validadeMinutos: number;
}): ConteudoEmail {
  const nome = escaparHtml(saudacao(params.nome));
  const assunto = 'Redefinição de senha';
  const html = layoutBase({
    titulo: 'Redefinição de senha',
    corpoHtml: `
      <p>${nome}</p>
      <p>Recebemos um pedido para redefinir sua senha. Clique no botão abaixo para escolher uma nova senha.</p>
      <p>Este link é válido por ${params.validadeMinutos} minutos. Se você não pediu essa redefinição, pode ignorar este e-mail com segurança.</p>
    `,
    botao: { texto: 'Redefinir senha', url: params.link },
  });
  const texto = `${saudacao(params.nome)}\n\nRecebemos um pedido para redefinir sua senha. Acesse o link abaixo para escolher uma nova senha (válido por ${params.validadeMinutos} minutos):\n${params.link}\n\nSe você não pediu essa redefinição, pode ignorar este e-mail com segurança.`;
  return { assunto, html, texto };
}

export function emailPedidoConfirmacao(params: {
  nome: string;
  inicio: Date;
  modalidade: string;
  link: string;
}): ConteudoEmail {
  const nome = escaparHtml(saudacao(params.nome));
  const modalidade = escaparHtml(params.modalidade);
  const dataFormatada = formatarDataHoraBr(params.inicio);
  const assunto = 'Confirme sua consulta';
  const html = layoutBase({
    titulo: 'Confirme sua consulta',
    corpoHtml: `
      <p>${nome}</p>
      <p>Uma consulta foi agendada para você:</p>
      <p><strong>Data:</strong> ${escaparHtml(dataFormatada)}<br />
      <strong>Modalidade:</strong> ${modalidade}</p>
      <p>Por favor, confirme sua presença clicando no botão abaixo.</p>
    `,
    botao: { texto: 'Confirmar consulta', url: params.link },
  });
  const texto = `${saudacao(params.nome)}\n\nUma consulta foi agendada para você:\nData: ${dataFormatada}\nModalidade: ${params.modalidade}\n\nPor favor, confirme sua presença através do link abaixo:\n${params.link}`;
  return { assunto, html, texto };
}

export function emailConsultaConfirmada(params: {
  nome: string;
  inicio: Date;
  modalidade: string;
  linkGoogleCalendar: string;
}): ConteudoEmail {
  const nome = escaparHtml(saudacao(params.nome));
  const modalidade = escaparHtml(params.modalidade);
  const dataFormatada = formatarDataHoraBr(params.inicio);
  const linkGoogle = validarLinkAbsoluto(params.linkGoogleCalendar);
  const assunto = 'Consulta confirmada';
  const html = layoutBase({
    titulo: 'Consulta confirmada',
    corpoHtml: `
      <p>${nome}</p>
      <p>Sua consulta foi confirmada:</p>
      <p><strong>Data:</strong> ${escaparHtml(dataFormatada)}<br />
      <strong>Modalidade:</strong> ${modalidade}</p>
      <p>O convite está anexado (.ics) — abra para salvar em qualquer calendário. Você também pode
      <a href="${linkGoogle}" style="color: ${COR_TERRACOTA};">adicionar ao Google Calendar</a>.
      </p>
    `,
  });
  const texto = `${saudacao(params.nome)}\n\nSua consulta foi confirmada:\nData: ${dataFormatada}\nModalidade: ${params.modalidade}\n\nO convite está anexado (.ics) — abra para salvar em qualquer calendário.\nGoogle Calendar: ${params.linkGoogleCalendar}`;
  return { assunto, html, texto };
}

/** Fase 6 · Bloco 6: enviado ao visitante logo após o autoagendamento (antes da confirmação
 *  da psicóloga). Não é convite de calendário — só avisa que o pedido foi recebido. */
export function emailAgendamentoRecebido(params: { nome: string; inicio: Date; modalidade: string }): ConteudoEmail {
  const nome = escaparHtml(saudacao(params.nome));
  const modalidade = escaparHtml(params.modalidade);
  const dataFormatada = formatarDataHoraBr(params.inicio);
  const assunto = 'Recebemos seu pedido de agendamento';
  const html = layoutBase({
    titulo: 'Pedido de agendamento recebido',
    corpoHtml: `
      <p>${nome}</p>
      <p>Recebemos seu pedido de agendamento:</p>
      <p><strong>Data:</strong> ${escaparHtml(dataFormatada)}<br />
      <strong>Modalidade:</strong> ${modalidade}</p>
      <p>A psicóloga vai confirmar e você receberá outro e-mail assim que isso acontecer.</p>
    `,
  });
  const texto = `${saudacao(params.nome)}\n\nRecebemos seu pedido de agendamento:\nData: ${dataFormatada}\nModalidade: ${params.modalidade}\n\nA psicóloga vai confirmar e você receberá outro e-mail assim que isso acontecer.`;
  return { assunto, html, texto };
}

/** Enviado ao ENDEREÇO ANTIGO quando a psicóloga troca o e-mail de login pelo Perfil — alerta de
 *  segurança, não uma confirmação de ação do próprio usuário (a troca já foi feita). O novo
 *  endereço chega mascarado (ex.: `ma***@gmail.com`); nunca expomos o e-mail completo aqui. */
export function emailAlteracaoEmailAcesso(params: { nome: string; emailNovoMascarado: string }): ConteudoEmail {
  const nome = escaparHtml(saudacao(params.nome));
  const emailMascarado = escaparHtml(params.emailNovoMascarado);
  const assunto = 'Seu e-mail de acesso foi alterado';
  const html = layoutBase({
    titulo: 'Seu e-mail de acesso foi alterado',
    corpoHtml: `
      <p>${nome}</p>
      <p>O e-mail usado para acessar sua conta foi alterado para <strong>${emailMascarado}</strong>.</p>
      <p>Se foi você quem fez essa alteração, não precisa fazer nada.</p>
      <p><strong>Se não foi você, sua conta pode ter sido acessada por outra pessoa: avise o responsável técnico do site imediatamente.</strong></p>
    `,
  });
  const texto = `${saudacao(params.nome)}\n\nO e-mail usado para acessar sua conta foi alterado para ${params.emailNovoMascarado}.\n\nSe foi você quem fez essa alteração, não precisa fazer nada.\nSe não foi você, sua conta pode ter sido acessada por outra pessoa: avise o responsável técnico do site imediatamente.`;
  return { assunto, html, texto };
}

export function emailLinkReuniao(params: { nome: string; inicio: Date; link: string }): ConteudoEmail {
  const nome = escaparHtml(saudacao(params.nome));
  const dataFormatada = formatarDataHoraBr(params.inicio);
  const link = validarLinkAbsoluto(params.link);
  const assunto = 'Link da sua consulta online';
  const html = layoutBase({
    titulo: 'Sua consulta online',
    corpoHtml: `
      <p>${nome}</p>
      <p>Sua consulta online está marcada para <strong>${escaparHtml(dataFormatada)}</strong>.</p>
      <p>Na hora marcada, é só clicar no botão abaixo para entrar na sala.</p>
      <p>Este link é só seu — não compartilhe.</p>
    `,
    botao: { texto: 'Entrar na consulta', url: link },
  });
  const texto = `${saudacao(params.nome)}\n\nSua consulta online está marcada para ${dataFormatada}.\n\nNa hora marcada, é só acessar o link abaixo para entrar na sala:\n${params.link}\n\nEste link é só seu — não compartilhe.`;
  return { assunto, html, texto };
}

export function emailNovoAgendamentoPsicologa(params: {
  nomePaciente: string;
  inicio: Date;
  modalidade: string;
  linkAgenda: string;
}): ConteudoEmail {
  const nomePaciente = escaparHtml(nomeSemLinks(params.nomePaciente));
  const modalidade = escaparHtml(params.modalidade);
  const dataFormatada = formatarDataHoraBr(params.inicio);
  const assunto = 'Novo agendamento';
  const html = layoutBase({
    titulo: 'Novo agendamento',
    corpoHtml: `
      <p>Um novo agendamento foi realizado:</p>
      <p><strong>Paciente:</strong> ${nomePaciente}<br />
      <strong>Data:</strong> ${escaparHtml(dataFormatada)}<br />
      <strong>Modalidade:</strong> ${modalidade}</p>
    `,
    botao: { texto: 'Ver agenda', url: params.linkAgenda },
  });
  const texto = `Um novo agendamento foi realizado:\nPaciente: ${nomeSemLinks(params.nomePaciente)}\nData: ${dataFormatada}\nModalidade: ${params.modalidade}\n\nVer agenda: ${params.linkAgenda}`;
  return { assunto, html, texto };
}
