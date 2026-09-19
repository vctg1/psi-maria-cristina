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
import { useNotificacao } from '@/components/NotificacaoProvider';
import { formatarData, formatarHora } from './formatos';

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
    </>
  );
}
