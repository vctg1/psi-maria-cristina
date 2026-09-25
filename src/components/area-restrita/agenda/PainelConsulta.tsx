'use client';

import { useEffect, useState } from 'react';
import Offcanvas from 'react-bootstrap/Offcanvas';
import Form from 'react-bootstrap/Form';
import Button from 'react-bootstrap/Button';
import Alert from 'react-bootstrap/Alert';
import Modal from 'react-bootstrap/Modal';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import type { ConsultaDto, Modalidade } from '@/types/agenda';
import type { CobrancaOnlineDto, PagamentoDto } from '@/types/pagamento';
import { GATEWAY_LABEL, METODO_LABEL } from '@/types/pagamento';
import { useNotificacao } from '@/components/NotificacaoProvider';
import { formatarData, formatarHora } from './formatos';
import { formatarMoeda } from '@/components/area-restrita/financeiro/formatos';
import ModalRegistrarPagamento from '@/components/area-restrita/financeiro/ModalRegistrarPagamento';
import ModalCobrancaOnline from '@/components/area-restrita/financeiro/ModalCobrancaOnline';

type PainelConsultaProps = {
  consulta: ConsultaDto | null;
  onHide: () => void;
  onAtualizado: () => void;
};

const STATUS_LABEL: Record<ConsultaDto['status'], string> = {
  agendada: 'A confirmar',
  confirmada: 'Confirmada',
  realizada: 'Realizada',
  cancelada: 'Cancelada',
  nao_compareceu: 'Não compareceu',
};

export default function PainelConsulta({ consulta, onHide, onAtualizado }: PainelConsultaProps) {
  const { mostrarNotificacao } = useNotificacao();
  const [atual, setAtual] = useState<ConsultaDto | null>(consulta);

  const [modalidade, setModalidade] = useState<Modalidade>('presencial');
  const [motivo, setMotivo] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [relatorio, setRelatorio] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const [reagendarAberto, setReagendarAberto] = useState(false);
  const [novaData, setNovaData] = useState('');
  const [novaHora, setNovaHora] = useState('');
  const [horariosLivres, setHorariosLivres] = useState<string[]>([]);
  const [reagendando, setReagendando] = useState(false);

  const [modalCancelar, setModalCancelar] = useState(false);
  const [motivoCancelamento, setMotivoCancelamento] = useState('');
  const [processando, setProcessando] = useState(false);

  const [valorInput, setValorInput] = useState('');
  const [salvandoValor, setSalvandoValor] = useState(false);
  const [erroValor, setErroValor] = useState<string | null>(null);
  const [modalPagamentoAberto, setModalPagamentoAberto] = useState(false);
  const [modalEstornar, setModalEstornar] = useState(false);
  const [estornando, setEstornando] = useState(false);
  const [modalCobrancaOnlineAberto, setModalCobrancaOnlineAberto] = useState(false);
  const [atualizandoStatusOnline, setAtualizandoStatusOnline] = useState(false);
  const [erroStatusOnline, setErroStatusOnline] = useState<string | null>(null);
  const [gatewayCobrancaOnline, setGatewayCobrancaOnline] = useState<CobrancaOnlineDto['gateway'] | null>(null);

  useEffect(() => {
    setAtual(consulta);
    setModalidade(consulta?.modalidade ?? 'presencial');
    setMotivo(consulta?.motivo ?? '');
    setObservacoes(consulta?.observacoes ?? '');
    setRelatorio(consulta?.relatorio ?? '');
    setErro(null);
    setReagendarAberto(false);
    setModalCancelar(false);
    setMotivoCancelamento('');
    setValorInput(consulta ? consulta.cobranca.valor.toFixed(2) : '');
    setErroValor(null);
    setModalPagamentoAberto(false);
    setModalEstornar(false);
    setModalCobrancaOnlineAberto(false);
    setErroStatusOnline(null);
    setGatewayCobrancaOnline(null);
  }, [consulta]);

  useEffect(() => {
    if (!reagendarAberto || !novaData) return;
    fetch(`/api/disponibilidade?data=${novaData}`)
      .then((r) => r.json())
      .then((d) => setHorariosLivres(Array.isArray(d?.horarios) ? d.horarios : []))
      .catch(() => setHorariosLivres([]));
  }, [reagendarAberto, novaData]);

  if (!atual) return null;

  const inicioPassou = new Date(atual.inicio).getTime() <= Date.now();

  const salvarEdicao = async () => {
    setSalvando(true);
    setErro(null);
    try {
      const response = await fetch(`/api/consultas/${atual.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modalidade,
          motivo: motivo.trim() || null,
          observacoes: observacoes.trim() || null,
          relatorio: relatorio.trim() || null,
        }),
      });
      const dados = await response.json().catch(() => null);
      if (!response.ok) {
        setErro(dados?.error ?? 'Não foi possível salvar.');
        return;
      }
      setAtual(dados as ConsultaDto);
      mostrarNotificacao({ tipo: 'sucesso', titulo: 'Consulta atualizada' });
      onAtualizado();
    } catch {
      setErro('Não foi possível salvar.');
    } finally {
      setSalvando(false);
    }
  };

  const confirmarReagendamento = async () => {
    if (!novaData || !novaHora) return;
    setReagendando(true);
    setErro(null);
    try {
      const response = await fetch(`/api/consultas/${atual.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: novaData, hora: novaHora }),
      });
      const dados = await response.json().catch(() => null);
      if (!response.ok) {
        mostrarNotificacao({ tipo: 'erro', titulo: 'Erro', mensagem: dados?.error ?? 'Horário indisponível.' });
        return;
      }
      setAtual(dados as ConsultaDto);
      setReagendarAberto(false);
      mostrarNotificacao({ tipo: 'sucesso', titulo: 'Consulta reagendada' });
      onAtualizado();
    } catch {
      mostrarNotificacao({ tipo: 'erro', titulo: 'Erro', mensagem: 'Não foi possível reagendar.' });
    } finally {
      setReagendando(false);
    }
  };

  const confirmarConsulta = async () => {
    setProcessando(true);
    try {
      const response = await fetch(`/api/consultas/${atual.id}/confirmar`, { method: 'POST' });
      const dados = await response.json().catch(() => null);
      if (!response.ok) {
        mostrarNotificacao({ tipo: 'erro', titulo: 'Erro', mensagem: dados?.error ?? 'Não foi possível confirmar.' });
        return;
      }
      setAtual(dados as ConsultaDto);
      mostrarNotificacao({ tipo: 'sucesso', titulo: 'Consulta confirmada' });
      onAtualizado();
    } catch {
      mostrarNotificacao({ tipo: 'erro', titulo: 'Erro', mensagem: 'Não foi possível confirmar.' });
    } finally {
      setProcessando(false);
    }
  };

  const cancelarConsulta = async () => {
    setProcessando(true);
    try {
      const response = await fetch(`/api/consultas/${atual.id}/cancelar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ motivo: motivoCancelamento.trim() || undefined }),
      });
      const dados = await response.json().catch(() => null);
      if (!response.ok) {
        mostrarNotificacao({ tipo: 'erro', titulo: 'Erro', mensagem: dados?.error ?? 'Não foi possível cancelar.' });
        return;
      }
      setAtual(dados as ConsultaDto);
      setModalCancelar(false);
      mostrarNotificacao({ tipo: 'sucesso', titulo: 'Consulta cancelada' });
      onAtualizado();
    } catch {
      mostrarNotificacao({ tipo: 'erro', titulo: 'Erro', mensagem: 'Não foi possível cancelar.' });
    } finally {
      setProcessando(false);
    }
  };

  const encerrarConsulta = async (status: 'realizada' | 'nao_compareceu') => {
    setProcessando(true);
    try {
      const response = await fetch(`/api/consultas/${atual.id}/encerrar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const dados = await response.json().catch(() => null);
      if (!response.ok) {
        mostrarNotificacao({ tipo: 'erro', titulo: 'Erro', mensagem: dados?.error ?? 'Não foi possível atualizar.' });
        return;
      }
      setAtual(dados as ConsultaDto);
      mostrarNotificacao({ tipo: 'sucesso', titulo: 'Status atualizado' });
      onAtualizado();
    } catch {
      mostrarNotificacao({ tipo: 'erro', titulo: 'Erro', mensagem: 'Não foi possível atualizar.' });
    } finally {
      setProcessando(false);
    }
  };

  const salvarValor = async () => {
    setSalvandoValor(true);
    setErroValor(null);
    try {
      const valorNumerico = Number(valorInput);
      const response = await fetch(`/api/consultas/${atual.id}/valor`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ valor: valorNumerico }),
      });
      const dados = await response.json().catch(() => null);
      if (!response.ok) {
        setErroValor(dados?.error ?? 'Não foi possível salvar o valor.');
        return;
      }
      setAtual(dados as ConsultaDto);
      setValorInput((dados as ConsultaDto).cobranca.valor.toFixed(2));
      mostrarNotificacao({ tipo: 'sucesso', titulo: 'Valor atualizado' });
      onAtualizado();
    } catch {
      setErroValor('Não foi possível salvar o valor.');
    } finally {
      setSalvandoValor(false);
    }
  };

  const aoGerarCobrancaOnline = (cobranca: CobrancaOnlineDto) => {
    setAtual({
      ...atual,
      cobranca: {
        ...atual.cobranca,
        situacao: 'aguardando',
        pagamentoId: cobranca.pagamentoId,
        linkCheckout: cobranca.linkCheckout,
        metodo: null,
        recebidoEm: null,
      },
    });
    setGatewayCobrancaOnline(cobranca.gateway);
    setModalCobrancaOnlineAberto(false);
    onAtualizado();
  };

  const atualizarStatusOnline = async () => {
    if (!atual.cobranca.pagamentoId) return;
    setAtualizandoStatusOnline(true);
    setErroStatusOnline(null);
    try {
      const response = await fetch(`/api/pagamentos/${atual.cobranca.pagamentoId}/cobranca`);
      const dados = await response.json().catch(() => null);
      if (!response.ok) {
        setErroStatusOnline(dados?.error ?? 'Não foi possível atualizar o status.');
        return;
      }
      const cobranca = dados as CobrancaOnlineDto;
      const situacao = cobranca.status === 'pago' ? 'pago' : cobranca.status === 'pendente' ? 'aguardando' : 'em_aberto';
      setGatewayCobrancaOnline(situacao === 'em_aberto' ? null : cobranca.gateway);
      setAtual({
        ...atual,
        cobranca: {
          ...atual.cobranca,
          situacao,
          pagamentoId: situacao === 'em_aberto' ? null : cobranca.pagamentoId,
          linkCheckout: situacao === 'aguardando' ? cobranca.linkCheckout : null,
          recebidoEm: cobranca.pagoEm,
        },
      });
      mostrarNotificacao({ tipo: 'sucesso', titulo: 'Status atualizado' });
      onAtualizado();
    } catch {
      setErroStatusOnline('Não foi possível atualizar o status.');
    } finally {
      setAtualizandoStatusOnline(false);
    }
  };

  const aoRegistrarPagamento = (pagamento: PagamentoDto) => {
    setAtual({
      ...atual,
      cobranca: {
        ...atual.cobranca,
        situacao: 'pago',
        pagamentoId: pagamento.id,
        metodo: pagamento.metodo,
        recebidoEm: pagamento.recebidoEm,
      },
    });
    setModalPagamentoAberto(false);
    onAtualizado();
  };

  const desfazerPagamento = async () => {
    if (!atual.cobranca.pagamentoId) return;
    setEstornando(true);
    try {
      const response = await fetch(`/api/pagamentos/${atual.cobranca.pagamentoId}/estornar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const dados = await response.json().catch(() => null);
      if (!response.ok) {
        mostrarNotificacao({ tipo: 'erro', titulo: 'Erro', mensagem: dados?.error ?? 'Não foi possível estornar.' });
        return;
      }
      setAtual({
        ...atual,
        cobranca: { ...atual.cobranca, situacao: 'em_aberto', pagamentoId: null, metodo: null, recebidoEm: null },
      });
      setModalEstornar(false);
      mostrarNotificacao({ tipo: 'sucesso', titulo: 'Pagamento desfeito' });
      onAtualizado();
    } catch {
      mostrarNotificacao({ tipo: 'erro', titulo: 'Erro', mensagem: 'Não foi possível estornar.' });
    } finally {
      setEstornando(false);
    }
  };

  return (
    <>
      <Offcanvas show={consulta !== null} onHide={onHide} placement="end">
        <Offcanvas.Header closeButton>
          <Offcanvas.Title>{atual.paciente.nome}</Offcanvas.Title>
        </Offcanvas.Header>
        <Offcanvas.Body>
          <p className="pmc-texto-2 mb-1">
            {formatarData(atual.inicio, { weekday: 'long', day: '2-digit', month: 'long' })} às{' '}
            {formatarHora(atual.inicio)}
          </p>
          <div className="mb-3">
            <span className={`pmc-badge-${atual.status === 'agendada' ? 'aviso' : atual.status === 'confirmada' ? 'ok' : 'neutro'}`}>
              {STATUS_LABEL[atual.status]}
            </span>
            {!atual.paciente.temLogin && <span className="pmc-badge-neutro ms-2">Sem acesso</span>}
          </div>

          {erro && <Alert variant="danger">{erro}</Alert>}

          <span className="pmc-rotulo d-block mb-2">Dados</span>
          <Row>
            <Col md={6}>
              <Form.Group className="mb-3" controlId="painelModalidade">
                <Form.Label>Modalidade</Form.Label>
                <Form.Select value={modalidade ?? 'presencial'} onChange={(e) => setModalidade(e.target.value as Modalidade)}>
                  <option value="presencial">Presencial</option>
                  <option value="online">Online</option>
                </Form.Select>
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group className="mb-3" controlId="painelTelefone">
                <Form.Label>Telefone</Form.Label>
                <Form.Control readOnly value={atual.paciente.telefone} />
              </Form.Group>
            </Col>
          </Row>
          <Form.Group className="mb-3" controlId="painelMotivo">
            <Form.Label>Motivo</Form.Label>
            <Form.Control value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={200} />
          </Form.Group>
          <Form.Group className="mb-3" controlId="painelObservacoes">
            <Form.Label>Observações</Form.Label>
            <Form.Control as="textarea" rows={2} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} maxLength={1000} />
          </Form.Group>
          <Form.Group className="mb-3" controlId="painelRelatorio">
            <Form.Label>Relatório</Form.Label>
            <Form.Text className="d-block pmc-texto-2 mb-1">Anotações clínicas, só você vê.</Form.Text>
            <Form.Control as="textarea" rows={3} value={relatorio} onChange={(e) => setRelatorio(e.target.value)} maxLength={5000} />
          </Form.Group>
          <div className="d-grid mb-4">
            <Button variant="primary" disabled={salvando} onClick={salvarEdicao}>
              {salvando ? 'Salvando...' : 'Salvar alterações'}
            </Button>
          </div>

          <span className="pmc-rotulo d-block mb-2">Cobrança</span>
          <div className="mb-4">
            {erroValor && <Alert variant="danger">{erroValor}</Alert>}
            <Row className="align-items-end">
              <Col md={6}>
                <Form.Group className="mb-2" controlId="painelValorConsulta">
                  <Form.Label>Valor</Form.Label>
                  <Form.Control
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={valorInput}
                    disabled={atual.cobranca.situacao === 'pago'}
                    onChange={(e) => setValorInput(e.target.value)}
                  />
                </Form.Group>
              </Col>
              <Col md={6} className="mb-2">
                <div className="d-flex gap-2 flex-wrap">
                  <Button
                    id="botao-salvar-valor"
                    variant="outline-secondary"
                    size="sm"
                    disabled={salvandoValor || !valorInput.trim() || atual.cobranca.situacao === 'pago'}
                    onClick={() => salvarValor()}
                  >
                    {salvandoValor ? 'Salvando...' : 'Salvar valor'}
                  </Button>
                </div>
              </Col>
            </Row>

            <div className="mb-2">
              {atual.cobranca.situacao === 'pago' && <span className="pmc-badge-ok">Paga</span>}
              {atual.cobranca.situacao === 'aguardando' && <span className="pmc-badge-aviso">Aguardando pagamento</span>}
              {atual.cobranca.situacao === 'em_aberto' && <span className="pmc-badge-aviso">Em aberto</span>}
              {atual.cobranca.situacao === 'nao_cobravel' && <span className="pmc-badge-neutro">Não cobrável</span>}
            </div>

            {erroStatusOnline && <Alert variant="danger">{erroStatusOnline}</Alert>}

            {atual.cobranca.situacao === 'em_aberto' && (
              <div className="d-flex flex-wrap gap-2">
                <Button
                  id="botao-registrar-pagamento"
                  variant="primary"
                  size="sm"
                  onClick={() => setModalPagamentoAberto(true)}
                >
                  Registrar pagamento
                </Button>
                <Button
                  id="botao-gerar-cobranca-online"
                  variant="outline-primary"
                  size="sm"
                  onClick={() => setModalCobrancaOnlineAberto(true)}
                >
                  Gerar cobrança online
                </Button>
              </div>
            )}

            {atual.cobranca.situacao === 'aguardando' && (
              <div className="pmc-texto-2 pmc-t-sm">
                {gatewayCobrancaOnline && <div className="mb-2">Gateway: {GATEWAY_LABEL[gatewayCobrancaOnline]}</div>}
                {atual.cobranca.linkCheckout && (
                  <Form.Group className="mb-2" controlId="painelLinkCobrancaOnline">
                    <Form.Control id="input-link-cobranca-painel" readOnly value={atual.cobranca.linkCheckout} />
                  </Form.Group>
                )}
                <div className="d-flex flex-wrap gap-2">
                  {atual.cobranca.linkCheckout && (
                    <Button
                      id="botao-copiar-link-cobranca-painel"
                      variant="outline-secondary"
                      size="sm"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(atual.cobranca.linkCheckout ?? '');
                          mostrarNotificacao({ tipo: 'sucesso', titulo: 'Link copiado' });
                        } catch {
                          mostrarNotificacao({ tipo: 'erro', titulo: 'Não foi possível copiar o link' });
                        }
                      }}
                    >
                      Copiar link
                    </Button>
                  )}
                  {atual.cobranca.linkCheckout && (
                    <Button
                      id="botao-whatsapp-cobranca-painel"
                      variant="outline-secondary"
                      size="sm"
                      onClick={() => {
                        const mensagem = `Olá, ${atual.paciente.nome}! Segue o link para o pagamento da sua consulta: ${atual.cobranca.linkCheckout}`;
                        const digitos = atual.paciente.telefone.replace(/\D/g, '');
                        const comDdi = digitos.startsWith('55') ? digitos : `55${digitos}`;
                        window.open(`https://wa.me/${comDdi}?text=${encodeURIComponent(mensagem)}`, '_blank', 'noopener,noreferrer');
                      }}
                    >
                      <i className="bi bi-whatsapp me-2" />
                      WhatsApp
                    </Button>
                  )}
                  <Button
                    id="botao-atualizar-status-online"
                    variant="primary"
                    size="sm"
                    disabled={atualizandoStatusOnline}
                    onClick={atualizarStatusOnline}
                  >
                    {atualizandoStatusOnline ? 'Atualizando...' : 'Atualizar status'}
                  </Button>
                </div>
              </div>
            )}

            {atual.cobranca.situacao === 'pago' && (
              <div className="pmc-texto-2 pmc-t-sm">
                <div>
                  Método: {atual.cobranca.metodo ? METODO_LABEL[atual.cobranca.metodo] : '—'}
                </div>
                <div>
                  Recebido em:{' '}
                  {atual.cobranca.recebidoEm
                    ? formatarData(`${atual.cobranca.recebidoEm}T12:00:00`, { day: '2-digit', month: '2-digit', year: 'numeric' })
                    : '—'}
                </div>
                <Button
                  id="botao-desfazer-pagamento"
                  variant="outline-danger"
                  size="sm"
                  className="mt-2"
                  onClick={() => setModalEstornar(true)}
                >
                  Desfazer pagamento
                </Button>
              </div>
            )}
          </div>

          <span className="pmc-rotulo d-block mb-2">Reagendar</span>
          {!reagendarAberto ? (
            <Button variant="outline-secondary" className="mb-4" onClick={() => setReagendarAberto(true)}>
              Reagendar consulta
            </Button>
          ) : (
            <div className="mb-4">
              <Row>
                <Col md={6}>
                  <Form.Group className="mb-2" controlId="painelNovaData">
                    <Form.Label>Nova data</Form.Label>
                    <Form.Control type="date" value={novaData} onChange={(e) => setNovaData(e.target.value)} />
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group className="mb-2" controlId="painelNovaHora">
                    <Form.Label>Novo horário</Form.Label>
                    <Form.Select value={novaHora} onChange={(e) => setNovaHora(e.target.value)}>
                      <option value="">Selecione</option>
                      {horariosLivres.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </Form.Select>
                  </Form.Group>
                </Col>
              </Row>
              <div className="d-flex gap-2">
                <Button variant="outline-secondary" onClick={() => setReagendarAberto(false)}>
                  Cancelar
                </Button>
                <Button variant="primary" disabled={reagendando || !novaData || !novaHora} onClick={confirmarReagendamento}>
                  {reagendando ? 'Reagendando...' : 'Confirmar novo horário'}
                </Button>
              </div>
            </div>
          )}

          <span className="pmc-rotulo d-block mb-2">Ações</span>
          <div className="d-flex flex-wrap gap-2">
            {atual.status === 'agendada' && (
              <Button variant="primary" disabled={processando} onClick={confirmarConsulta}>
                Confirmar
              </Button>
            )}
            {(atual.status === 'agendada' || atual.status === 'confirmada') && (
              <Button variant="outline-danger" disabled={processando} onClick={() => setModalCancelar(true)}>
                Cancelar
              </Button>
            )}
            {atual.status === 'confirmada' && inicioPassou && (
              <>
                <Button variant="outline-primary" disabled={processando} onClick={() => encerrarConsulta('realizada')}>
                  Marcar realizada
                </Button>
                <Button variant="outline-secondary" disabled={processando} onClick={() => encerrarConsulta('nao_compareceu')}>
                  Não compareceu
                </Button>
              </>
            )}
          </div>
        </Offcanvas.Body>
      </Offcanvas>

      <Modal show={modalCancelar} onHide={() => setModalCancelar(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Cancelar consulta</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form.Group controlId="motivoCancelamento">
            <Form.Label>Motivo (opcional)</Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              value={motivoCancelamento}
              onChange={(e) => setMotivoCancelamento(e.target.value)}
              maxLength={300}
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={() => setModalCancelar(false)}>
            Voltar
          </Button>
          <Button variant="outline-danger" disabled={processando} onClick={cancelarConsulta}>
            {processando ? 'Cancelando...' : 'Confirmar cancelamento'}
          </Button>
        </Modal.Footer>
      </Modal>

      <ModalRegistrarPagamento
        show={modalPagamentoAberto}
        consultas={[
          {
            id: atual.id,
            inicio: atual.inicio,
            pacienteNome: atual.paciente.nome,
            valor: atual.cobranca.valor,
          },
        ]}
        onHide={() => setModalPagamentoAberto(false)}
        onRegistrado={aoRegistrarPagamento}
      />

      <ModalCobrancaOnline
        show={modalCobrancaOnlineAberto}
        consultas={[
          {
            id: atual.id,
            inicio: atual.inicio,
            pacienteNome: atual.paciente.nome,
            valor: atual.cobranca.valor,
            pacienteTelefone: atual.paciente.telefone,
          },
        ]}
        onHide={() => setModalCobrancaOnlineAberto(false)}
        onGerada={aoGerarCobrancaOnline}
      />

      <Modal show={modalEstornar} onHide={() => setModalEstornar(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Desfazer pagamento</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="mb-0">Tem certeza que deseja desfazer o pagamento desta consulta?</p>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={() => setModalEstornar(false)}>
            Voltar
          </Button>
          <Button variant="outline-danger" disabled={estornando} onClick={desfazerPagamento}>
            {estornando ? 'Desfazendo...' : 'Confirmar'}
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}
