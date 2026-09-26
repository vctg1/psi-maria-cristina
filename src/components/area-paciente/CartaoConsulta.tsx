'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Card from 'react-bootstrap/Card';
import Button from 'react-bootstrap/Button';
import Modal from 'react-bootstrap/Modal';
import Form from 'react-bootstrap/Form';
import Alert from 'react-bootstrap/Alert';
import type { ConsultaDtoPaciente, ConsultaStatus } from '@/types/agenda';
import { formatarData, formatarHora } from '@/components/area-restrita/agenda/formatos';
import { formatarMoeda } from '@/components/area-restrita/financeiro/formatos';
import { useNotificacao } from '@/components/NotificacaoProvider';
import { eventoConsultaPaciente, gerarIcs, linkGoogleCalendar } from '@/lib/calendario';

const WHATSAPP_PSICOLOGA = 'https://wa.me/5561995391540';

const STATUS_LABEL: Record<ConsultaStatus, string> = {
  agendada: 'Aguardando confirmação',
  confirmada: 'Confirmada',
  realizada: 'Realizada',
  cancelada: 'Cancelada',
  nao_compareceu: 'Não compareceu',
};

const STATUS_BADGE: Record<ConsultaStatus, string> = {
  agendada: 'pmc-badge-aviso',
  confirmada: 'pmc-badge-ok',
  realizada: 'pmc-badge-neutro',
  cancelada: 'pmc-badge-neutro',
  nao_compareceu: 'pmc-badge-neutro',
};

type CartaoConsultaProps = {
  consulta: ConsultaDtoPaciente;
  /** Quando informado junto com `permitirCancelamento`, habilita o fluxo de cancelamento. */
  antecedenciaCancelamentoHoras?: number;
  permitirCancelamento?: boolean;
  /** Chamado após cancelar com sucesso (ou após um 409, para recarregar a lista). */
  onAlterada?: () => void;
};

export default function CartaoConsulta({
  consulta,
  antecedenciaCancelamentoHoras,
  permitirCancelamento = false,
  onAlterada,
}: CartaoConsultaProps) {
  const router = useRouter();
  const { mostrarNotificacao } = useNotificacao();
  const [modalAberto, setModalAberto] = useState(false);
  const [estadoModal, setEstadoModal] = useState<'confirmar' | 'cancelada'>('confirmar');
  const [motivo, setMotivo] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const dataTexto = formatarData(consulta.inicio, {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    weekday: 'long',
  });
  const horaTexto = formatarHora(consulta.inicio);

  const podeCancelarAgora = useMemo(() => {
    if (!permitirCancelamento || antecedenciaCancelamentoHoras === undefined) return false;
    const horasRestantes = (new Date(consulta.inicio).getTime() - Date.now()) / 3_600_000;
    return horasRestantes >= antecedenciaCancelamentoHoras;
  }, [permitirCancelamento, antecedenciaCancelamentoHoras, consulta.inicio]);

  const abrirModal = () => {
    setEstadoModal('confirmar');
    setMotivo('');
    setErro(null);
    setModalAberto(true);
  };

  const fecharModal = () => {
    if (enviando) return;
    setModalAberto(false);
  };

  const confirmarCancelamento = async () => {
    setEnviando(true);
    setErro(null);
    try {
      const response = await fetch(`/api/consultas/${consulta.id}/cancelar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ motivo: motivo.trim() || undefined }),
      });
      const dados = await response.json().catch(() => null);
      if (!response.ok) {
        setErro(dados?.error ?? 'Não foi possível cancelar a consulta.');
        onAlterada?.();
        return;
      }
      setEstadoModal('cancelada');
      mostrarNotificacao({ tipo: 'sucesso', titulo: 'Consulta cancelada' });
      onAlterada?.();
    } catch {
      setErro('Não foi possível cancelar a consulta.');
    } finally {
      setEnviando(false);
    }
  };

  const avisarWhatsapp = () => {
    const texto = encodeURIComponent(`Olá, cancelei minha consulta de ${dataTexto} às ${horaTexto}.`);
    window.open(`${WHATSAPP_PSICOLOGA}?text=${texto}`, '_blank', 'noopener,noreferrer');
  };

  const futura = new Date(consulta.inicio).getTime() > Date.now();
  const mostrarBotoesCalendario = consulta.status === 'confirmada' && futura;

  const baixarIcs = () => {
    const evento = eventoConsultaPaciente({
      id: consulta.id,
      inicio: new Date(consulta.inicio),
      modalidade: consulta.modalidade,
    });
    const conteudo = gerarIcs(evento);
    const blob = new Blob([conteudo], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'consulta.ics';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <Card className="mb-3">
        <Card.Body>
          <div className="d-flex flex-wrap justify-content-between align-items-start gap-2">
            <div>
              <span className="pmc-rotulo d-block mb-1">{horaTexto}</span>
              <h3 className="h5 mb-1 text-capitalize">{dataTexto}</h3>
              <p className="mb-1 pmc-texto-2">
                <i
                  className={`bi ${consulta.modalidade === 'online' ? 'bi-camera-video' : 'bi-geo-alt'} me-2`}
                />
                {consulta.modalidade === 'online' ? 'Online' : 'Presencial'}
              </p>
              {consulta.motivo && <p className="mb-0 pmc-texto-2">{consulta.motivo}</p>}
              {consulta.cobranca.situacao !== 'nao_cobravel' && (
                <p className="mb-0 pmc-texto-2 small">{formatarMoeda(consulta.cobranca.valor)}</p>
              )}
            </div>
            <div className="d-flex flex-column align-items-end gap-1">
              <span className={STATUS_BADGE[consulta.status]}>{STATUS_LABEL[consulta.status]}</span>
              {consulta.cobranca.situacao === 'pago' && <span className="pmc-badge-ok">Paga</span>}
              {consulta.cobranca.situacao === 'em_aberto' && <span className="pmc-badge-aviso">Em aberto</span>}
              {consulta.cobranca.situacao === 'aguardando' && (
                <span className="pmc-badge-aviso">Aguardando pagamento</span>
              )}
              {consulta.cobranca.situacao === 'aguardando' && consulta.cobranca.linkCheckout && (
                <a
                  id={`botao-pagar-${consulta.id}`}
                  className="btn btn-primary btn-sm"
                  href={consulta.cobranca.linkCheckout}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Pagar
                </a>
              )}
            </div>
          </div>

          {mostrarBotoesCalendario && (
            <div className="mt-3 d-flex flex-wrap gap-2">
              <a
                id={`botao-google-calendar-${consulta.id}`}
                className="btn btn-outline-secondary btn-sm"
                target="_blank"
                rel="noopener noreferrer"
                href={linkGoogleCalendar(
                  eventoConsultaPaciente({
                    id: consulta.id,
                    inicio: new Date(consulta.inicio),
                    modalidade: consulta.modalidade,
                  })
                )}
              >
                Adicionar ao Google Calendar
              </a>
              <Button id={`botao-baixar-ics-${consulta.id}`} variant="outline-secondary" size="sm" onClick={baixarIcs}>
                Baixar .ics
              </Button>
            </div>
          )}

          {permitirCancelamento && (
            <div className="mt-3">
              {podeCancelarAgora ? (
                <Button variant="outline-danger" size="sm" onClick={abrirModal}>
                  Cancelar consulta
                </Button>
              ) : (
                <p className="mb-0 pmc-texto-2 small">
                  Cancelamento até {antecedenciaCancelamentoHoras}h antes — fale com a psicóloga no{' '}
                  <a href={WHATSAPP_PSICOLOGA} target="_blank" rel="noopener noreferrer">
                    WhatsApp
                  </a>
                  .
                </p>
              )}
            </div>
          )}
        </Card.Body>
      </Card>

      <Modal show={modalAberto} onHide={fecharModal} centered>
        {estadoModal === 'confirmar' ? (
          <>
            <Modal.Header closeButton>
              <Modal.Title as="h3" className="mb-0">
                Cancelar consulta
              </Modal.Title>
            </Modal.Header>
            <Modal.Body>
              <p>
                Tem certeza que deseja cancelar a consulta de {dataTexto} às {horaTexto}?
              </p>
              {erro && <Alert variant="danger">{erro}</Alert>}
              <Form.Group controlId="motivoCancelamento">
                <Form.Label>Motivo (opcional)</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={2}
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                />
              </Form.Group>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="outline-secondary" onClick={fecharModal} disabled={enviando}>
                Manter consulta
              </Button>
              <Button variant="danger" onClick={confirmarCancelamento} disabled={enviando}>
                {enviando ? 'Cancelando...' : 'Cancelar consulta'}
              </Button>
            </Modal.Footer>
          </>
        ) : (
          <>
            <Modal.Header closeButton>
              <Modal.Title as="h3" className="mb-0">
                Consulta cancelada
              </Modal.Title>
            </Modal.Header>
            <Modal.Body>
              <p className="mb-0">
                Sua consulta de {dataTexto} às {horaTexto} foi cancelada.
              </p>
            </Modal.Body>
            <Modal.Footer className="flex-wrap gap-2">
              <Button variant="outline-primary" onClick={avisarWhatsapp}>
                <i className="bi bi-whatsapp me-2" />
                Avisar a psicóloga no WhatsApp
              </Button>
              <Button variant="primary" onClick={() => router.push('/agendamento')}>
                Remarcar agora
              </Button>
              <Button variant="outline-secondary" onClick={fecharModal}>
                Fechar
              </Button>
            </Modal.Footer>
          </>
        )}
      </Modal>
    </>
  );
}
