import 'server-only';
import { Resend } from 'resend';
import { LOGO_EMAIL_BASE64, LOGO_EMAIL_CONTENT_ID } from './logo';
import { resendApiKey, emailRemetente, ErroConfiguracaoEmail } from './config';
import { emailParaRespostas } from './respostas';

const REGEX_EMAIL_SIMPLES = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type ResultadoEnvioEmail =
  | { ok: true; id: string }
  | { ok: false; motivo: 'configuracao' | 'rejeitado' | 'falha' };

export type AnexoEmail = {
  /** Nome do arquivo exibido ao destinatário (ex.: "consulta.ics"). */
  nomeArquivo: string;
  /** Conteúdo do arquivo em base64. */
  conteudo: string;
  /** MIME type (ex.: "text/calendar"). */
  tipo: string;
};

type ParametrosEnviarEmail = {
  para: string;
  assunto: string;
  html: string;
  texto: string;
  anexos?: AnexoEmail[];
};

/** Envia um e-mail via Resend. Nunca lança para o chamador — fluxos como "esqueci a
 *  senha" precisam responder de forma idêntica exista ou não o destinatário, então
 *  qualquer falha (configuração, validação ou erro do provedor) volta como
 *  `{ ok: false, motivo }` em vez de exceção. */
export async function enviarEmail(params: ParametrosEnviarEmail): Promise<ResultadoEnvioEmail> {
  const { para, assunto, html, texto, anexos } = params;

  if (!REGEX_EMAIL_SIMPLES.test(para)) {
    console.error('Falha ao enviar e-mail', { motivo: 'rejeitado', assunto });
    return { ok: false, motivo: 'rejeitado' };
  }

  let apiKey: string;
  let remetente: string;
  try {
    apiKey = resendApiKey();
    remetente = emailRemetente();
  } catch (erro) {
    if (erro instanceof ErroConfiguracaoEmail) {
      console.error('Falha ao enviar e-mail', { motivo: 'configuracao', assunto });
      return { ok: false, motivo: 'configuracao' };
    }
    console.error('Falha ao enviar e-mail', { motivo: 'falha', assunto });
    return { ok: false, motivo: 'falha' };
  }

  // Reply-To vem do cadastro da psicóloga (banco). Uma falha aqui (banco fora, dado malformado)
  // nunca deve impedir o envio do e-mail — só envia sem Reply-To.
  let responderPara: string | null;
  try {
    responderPara = await emailParaRespostas();
  } catch {
    responderPara = null;
  }

  try {
    const resend = new Resend(apiKey);
    const resposta = await resend.emails.send({
      from: remetente,
      to: para,
      ...(responderPara ? { replyTo: responderPara } : {}),
      subject: assunto,
      html,
      text: texto,
      // A logo vai sempre como imagem inline (CID), referenciada por `cid:` no layout — aparece
      // mesmo em clientes que bloqueiam imagens externas e não vira "anexo" visível.
      attachments: [
        { filename: 'logo.png', content: LOGO_EMAIL_BASE64, contentType: 'image/png', contentId: LOGO_EMAIL_CONTENT_ID },
        ...(anexos ?? []).map((a) => ({
          filename: a.nomeArquivo,
          content: a.conteudo,
          contentType: a.tipo,
        })),
      ],
    });

    if (resposta.error || !resposta.data?.id) {
      console.error('Falha ao enviar e-mail', { motivo: 'falha', assunto });
      return { ok: false, motivo: 'falha' };
    }

    return { ok: true, id: resposta.data.id };
  } catch {
    console.error('Falha ao enviar e-mail', { motivo: 'falha', assunto });
    return { ok: false, motivo: 'falha' };
  }
}
