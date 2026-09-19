'use client';

import { useEffect, useState } from 'react';
import Modal from 'react-bootstrap/Modal';
import Form from 'react-bootstrap/Form';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import Button from 'react-bootstrap/Button';
import Alert from 'react-bootstrap/Alert';
import Spinner from 'react-bootstrap/Spinner';
import ListGroup from 'react-bootstrap/ListGroup';
import type { PacienteResumo } from '@/types/paciente';
import type { Modalidade, NovaConsultaEntrada, ResultadoLote } from '@/types/agenda';
import { hojeLocalISO } from './formatos';

type ModalNovaConsultaProps = {
  show: boolean;
  dataInicial?: string;
  onHide: () => void;
  onCriado: () => void;
};

type TipoPaciente = 'existente' | 'novo';

const MOTIVO_PULADA: Record<string, string> = {
  sem_horario: 'sem horário de atendimento',
  excecao: 'data bloqueada',
  ocupado: 'horário já ocupado',
};

function apenasDigitos(valor: string): string {
  return valor.replace(/\D/g, '');
}

function formatarTelefone(valor: string): string {
  const digitos = apenasDigitos(valor).slice(0, 11);
  if (digitos.length <= 2) return digitos;
  if (digitos.length <= 6) return `(${digitos.slice(0, 2)}) ${digitos.slice(2)}`;
  if (digitos.length <= 10) return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 6)}-${digitos.slice(6)}`;
  return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 7)}-${digitos.slice(7)}`;
}

export default function ModalNovaConsulta({ show, dataInicial, onHide, onCriado }: ModalNovaConsultaProps) {
  const [passo, setPasso] = useState<'paciente' | 'horario'>('paciente');
  const [tipoPaciente, setTipoPaciente] = useState<TipoPaciente>('existente');

  const [busca, setBusca] = useState('');
  const [resultadosBusca, setResultadosBusca] = useState<PacienteResumo[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [pacienteSelecionado, setPacienteSelecionado] = useState<PacienteResumo | null>(null);

  const [novoNome, setNovoNome] = useState('');
  const [novoTelefone, setNovoTelefone] = useState('');
  const [novoNascimento, setNovoNascimento] = useState('');
  const [novaObservacao, setNovaObservacao] = useState('');

  const [data, setData] = useState(dataInicial ?? hojeLocalISO());
  const [hora, setHora] = useState('');
  const [horariosLivres, setHorariosLivres] = useState<string[]>([]);
  const [carregandoHorarios, setCarregandoHorarios] = useState(false);
  const [modalidade, setModalidade] = useState<Modalidade>('presencial');
  const [motivo, setMotivo] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [repetirSemanas, setRepetirSemanas] = useState(0);

  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<ResultadoLote | null>(null);

  useEffect(() => {
    if (!show) return;
    setPasso('paciente');
    setTipoPaciente('existente');
    setBusca('');
    setResultadosBusca([]);
    setPacienteSelecionado(null);
    setNovoNome('');
    setNovoTelefone('');
    setNovoNascimento('');
    setNovaObservacao('');
    setData(dataInicial ?? hojeLocalISO());
    setHora('');
    setHorariosLivres([]);
    setModalidade('presencial');
    setMotivo('');
    setObservacoes('');
    setRepetirSemanas(0);
    setErro(null);
    setResultado(null);
  }, [show, dataInicial]);

  useEffect(() => {
    if (!show || tipoPaciente !== 'existente') return;
    const handler = setTimeout(async () => {
      setBuscando(true);
      try {
        const params = new URLSearchParams();
        if (busca) params.set('q', busca);
        const response = await fetch(`/api/pacientes?${params.toString()}`);
        const dados = await response.json().catch(() => []);
        setResultadosBusca(response.ok ? (dados as PacienteResumo[]) : []);
      } catch {
        setResultadosBusca([]);
      } finally {
        setBuscando(false);
      }
    }, 300);
    return () => clearTimeout(handler);
  }, [busca, tipoPaciente, show]);

  useEffect(() => {
    if (passo !== 'horario' || !data) return;
    setCarregandoHorarios(true);
    setHora('');
    fetch(`/api/disponibilidade?data=${data}`)
      .then((r) => r.json())
      .then((dados) => setHorariosLivres(Array.isArray(dados?.horarios) ? dados.horarios : []))
      .catch(() => setHorariosLivres([]))
      .finally(() => setCarregandoHorarios(false));
  }, [passo, data]);

  const podeAvancar =
    tipoPaciente === 'existente' ? pacienteSelecionado !== null : novoNome.trim() && apenasDigitos(novoTelefone).length >= 10;

  const handleSubmit = async () => {
    if (!hora) {
      setErro('Escolha um horário.');
      return;
    }
    setEnviando(true);
    setErro(null);
    try {
      const entrada: NovaConsultaEntrada = {
        data,
        hora,
        modalidade,
        motivo: motivo.trim() || undefined,
        observacoes: observacoes.trim() || undefined,
        repetirSemanas,
      };
      if (tipoPaciente === 'existente' && pacienteSelecionado) {
        entrada.pacienteId = pacienteSelecionado.id;
      } else {
        entrada.pacienteNovo = {
          nome: novoNome.trim(),
          telefone: apenasDigitos(novoTelefone),
          dataNascimento: novoNascimento || undefined,
          observacoesCadastro: novaObservacao.trim() || undefined,
        };
      }

      const response = await fetch('/api/consultas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entrada),
      });
      const dados = await response.json().catch(() => null);
      if (!response.ok) {
        setErro(dados?.error ?? 'Não foi possível criar a consulta.');
        return;
      }
      setResultado(dados as ResultadoLote);
      onCriado();
    } catch {
      setErro('Não foi possível criar a consulta.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Modal show={show} onHide={onHide} centered size="lg">
      <Modal.Header closeButton>
        <Modal.Title>Nova consulta</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {resultado ? (
          <>
            <Alert variant="success">{resultado.criadas.length} consulta(s) criada(s).</Alert>
            {resultado.puladas.length > 0 && (
              <Alert variant="warning">
                <p className="mb-2">Algumas datas foram puladas:</p>
                <ul className="mb-0">
                  {resultado.puladas.map((p) => (
                    <li key={p.data}>
                      {p.data}: {MOTIVO_PULADA[p.motivo] ?? p.motivo}
                    </li>
                  ))}
                </ul>
              </Alert>
            )}
          </>
        ) : (
          <>
            {erro && <Alert variant="danger">{erro}</Alert>}

            {passo === 'paciente' && (
              <>
                <span className="pmc-rotulo d-block mb-3">Paciente</span>
                <Form.Check
                  type="radio"
                  name="tipoPaciente"
                  id="tipo-paciente-existente"
                  label="Paciente existente"
                  checked={tipoPaciente === 'existente'}
                  onChange={() => setTipoPaciente('existente')}
                  className="mb-2"
                />
                <Form.Check
                  type="radio"
                  name="tipoPaciente"
                  id="tipo-paciente-novo"
                  label="Novo paciente (sem acesso ao site)"
                  checked={tipoPaciente === 'novo'}
                  onChange={() => setTipoPaciente('novo')}
                  className="mb-3"
                />

                {tipoPaciente === 'existente' ? (
                  <>
                    <Form.Control
                      placeholder="Buscar por nome ou e-mail"
                      value={busca}
                      onChange={(e) => setBusca(e.target.value)}
                      className="mb-2"
                    />
                    {buscando && <Spinner animation="border" size="sm" />}
                    {!buscando && resultadosBusca.length > 0 && (
                      <ListGroup className="mb-2" style={{ maxHeight: 220, overflowY: 'auto' }}>
                        {resultadosBusca.map((p) => (
                          <ListGroup.Item
                            key={p.id}
                            action
                            active={pacienteSelecionado?.id === p.id}
                            onClick={() => setPacienteSelecionado(p)}
                          >
                            {p.nome} — {p.telefone}
                            {!p.temLogin && <span className="pmc-badge-neutro ms-2">Sem acesso</span>}
                          </ListGroup.Item>
                        ))}
                      </ListGroup>
                    )}
                    {pacienteSelecionado && (
                      <Alert variant="info" className="py-2">
                        Selecionado: {pacienteSelecionado.nome}
                      </Alert>
                    )}
                  </>
                ) : (
                  <Row>
                    <Col md={6}>
                      <Form.Group className="mb-3" controlId="novoPacienteNome">
                        <Form.Label>Nome</Form.Label>
                        <Form.Control value={novoNome} onChange={(e) => setNovoNome(e.target.value)} />
                      </Form.Group>
                    </Col>
                    <Col md={6}>
                      <Form.Group className="mb-3" controlId="novoPacienteTelefone">
                        <Form.Label>Telefone</Form.Label>
                        <Form.Control
                          value={novoTelefone}
                          onChange={(e) => setNovoTelefone(formatarTelefone(e.target.value))}
                          placeholder="(00) 00000-0000"
                        />
                      </Form.Group>
                    </Col>
                    <Col md={6}>
                      <Form.Group className="mb-3" controlId="novoPacienteNascimento">
                        <Form.Label>Data de nascimento (opcional)</Form.Label>
                        <Form.Control
                          type="date"
                          value={novoNascimento}
                          onChange={(e) => setNovoNascimento(e.target.value)}
                        />
                      </Form.Group>
                    </Col>
                    <Col md={12}>
                      <Form.Group className="mb-3" controlId="novoPacienteObservacoes">
                        <Form.Label>Observações (opcional)</Form.Label>
                        <Form.Control
                          as="textarea"
                          rows={2}
                          value={novaObservacao}
                          onChange={(e) => setNovaObservacao(e.target.value)}
                        />
                      </Form.Group>
                    </Col>
                  </Row>
                )}
              </>
            )}

            {passo === 'horario' && (
              <>
                <span className="pmc-rotulo d-block mb-3">Horário</span>
                <Row>
                  <Col md={4}>
                    <Form.Group className="mb-3" controlId="novaConsultaData">
                      <Form.Label>Data</Form.Label>
                      <Form.Control type="date" value={data} onChange={(e) => setData(e.target.value)} />
                    </Form.Group>
                  </Col>
                  <Col md={4}>
                    <Form.Group className="mb-3" controlId="novaConsultaHora">
                      <Form.Label>Horário</Form.Label>
                      <Form.Select value={hora} onChange={(e) => setHora(e.target.value)} disabled={carregandoHorarios}>
                        <option value="">Selecione</option>
                        {horariosLivres.map((h) => (
                          <option key={h} value={h}>
                            {h}
                          </option>
                        ))}
                      </Form.Select>
                      {!carregandoHorarios && horariosLivres.length === 0 && (
                        <Form.Text className="pmc-texto-2">Nenhum horário livre nessa data.</Form.Text>
                      )}
                    </Form.Group>
                  </Col>
                  <Col md={4}>
                    <Form.Group className="mb-3" controlId="novaConsultaModalidade">
                      <Form.Label>Modalidade</Form.Label>
                      <Form.Select value={modalidade} onChange={(e) => setModalidade(e.target.value as Modalidade)}>
                        <option value="presencial">Presencial</option>
                        <option value="online">Online</option>
                      </Form.Select>
                    </Form.Group>
                  </Col>
                </Row>
                <Form.Group className="mb-3" controlId="novaConsultaMotivo">
                  <Form.Label>Motivo (opcional)</Form.Label>
                  <Form.Control value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={200} />
                </Form.Group>
                <Form.Group className="mb-3" controlId="novaConsultaObservacoes">
                  <Form.Label>Observações (opcional)</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={2}
                    value={observacoes}
                    onChange={(e) => setObservacoes(e.target.value)}
                    maxLength={1000}
                  />
                </Form.Group>
                <Form.Group className="mb-3" controlId="novaConsultaRepetir">
                  <Form.Label>Repetir nas próximas semanas</Form.Label>
                  <Form.Select value={repetirSemanas} onChange={(e) => setRepetirSemanas(Number(e.target.value))}>
                    {Array.from({ length: 13 }, (_, n) => (
                      <option key={n} value={n}>
                        {n === 0 ? 'Não repetir' : `${n} semana(s)`}
                      </option>
                    ))}
                  </Form.Select>
                  <Form.Text className="pmc-texto-2">
                    Cria consultas independentes, uma por semana; pula semanas sem horário ou já ocupadas.
                  </Form.Text>
                </Form.Group>
              </>
            )}
          </>
        )}
      </Modal.Body>
      <Modal.Footer>
        {resultado ? (
          <Button variant="primary" onClick={onHide}>
            Fechar
          </Button>
        ) : passo === 'paciente' ? (
          <>
            <Button variant="outline-secondary" onClick={onHide}>
              Cancelar
            </Button>
            <Button variant="primary" disabled={!podeAvancar} onClick={() => setPasso('horario')}>
              Avançar
            </Button>
          </>
        ) : (
          <>
            <Button variant="outline-secondary" onClick={() => setPasso('paciente')}>
              Voltar
            </Button>
            <Button variant="primary" disabled={enviando || !hora} onClick={handleSubmit}>
              {enviando ? 'Criando...' : 'Criar consulta(s)'}
            </Button>
          </>
        )}
      </Modal.Footer>
    </Modal>
  );
}
