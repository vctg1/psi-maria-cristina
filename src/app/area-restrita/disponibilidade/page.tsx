'use client';

import { useCallback, useEffect, useState } from 'react';
import Card from 'react-bootstrap/Card';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import Form from 'react-bootstrap/Form';
import Button from 'react-bootstrap/Button';
import Spinner from 'react-bootstrap/Spinner';
import ListGroup from 'react-bootstrap/ListGroup';
import LayoutPsicologa from '@/components/area-restrita/LayoutPsicologa';
import { useNotificacao } from '@/components/NotificacaoProvider';
import { useModalConfirmacao } from '@/components/ModalConfirmacao';
import type { DiaSemana, ExcecaoDto, HorarioAtendimentoDto } from '@/types/agenda';
import {
  DIAS_SEMANA_ORDEM,
  hojeLocalISO,
  somarDiasISO,
  formatarDataDeISO,
} from '@/components/area-restrita/agenda/formatos';

export default function DisponibilidadePage() {
  const { mostrarNotificacao } = useNotificacao();
  const { mostrarModal, Modal: ModalConfirmacao } = useModalConfirmacao();

  const [horarios, setHorarios] = useState<HorarioAtendimentoDto[]>([]);
  const [carregandoHorarios, setCarregandoHorarios] = useState(true);
  const [novoDia, setNovoDia] = useState<DiaSemana>('segunda');
  const [novaHora, setNovaHora] = useState('09:00');
  const [salvandoHorario, setSalvandoHorario] = useState(false);

  const [excecoes, setExcecoes] = useState<ExcecaoDto[]>([]);
  const [carregandoExcecoes, setCarregandoExcecoes] = useState(true);
  const [novaData, setNovaData] = useState('');
  const [diaInteiro, setDiaInteiro] = useState(true);
  const [novaHoraExcecao, setNovaHoraExcecao] = useState('09:00');
  const [novoMotivo, setNovoMotivo] = useState('');
  const [salvandoExcecao, setSalvandoExcecao] = useState(false);

  const carregarHorarios = useCallback(async () => {
    setCarregandoHorarios(true);
    try {
      const response = await fetch('/api/horarios');
      const dados = await response.json().catch(() => []);
      setHorarios(response.ok ? (dados as HorarioAtendimentoDto[]) : []);
    } finally {
      setCarregandoHorarios(false);
    }
  }, []);

  const carregarExcecoes = useCallback(async () => {
    setCarregandoExcecoes(true);
    try {
      const de = hojeLocalISO();
      const ate = somarDiasISO(de, 90);
      const response = await fetch(`/api/excecoes?de=${de}&ate=${ate}`);
      const dados = await response.json().catch(() => []);
      setExcecoes(response.ok ? (dados as ExcecaoDto[]) : []);
    } finally {
      setCarregandoExcecoes(false);
    }
  }, []);

  useEffect(() => {
    carregarHorarios();
    carregarExcecoes();
  }, [carregarHorarios, carregarExcecoes]);

  const adicionarHorario = async () => {
    setSalvandoHorario(true);
    try {
      const response = await fetch('/api/horarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ diaSemana: novoDia, hora: novaHora }),
      });
      const dados = await response.json().catch(() => null);
      if (!response.ok) {
        mostrarNotificacao({
          tipo: 'erro',
          titulo: response.status === 409 ? 'Esse horário já existe' : 'Erro',
          mensagem: response.status === 409 ? undefined : dados?.error,
        });
        return;
      }
      mostrarNotificacao({ tipo: 'sucesso', titulo: 'Horário adicionado' });
      carregarHorarios();
    } catch {
      mostrarNotificacao({ tipo: 'erro', titulo: 'Erro', mensagem: 'Não foi possível adicionar o horário.' });
    } finally {
      setSalvandoHorario(false);
    }
  };

  const alternarHorario = async (h: HorarioAtendimentoDto) => {
    try {
      const response = await fetch(`/api/horarios/${h.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ativo: !h.ativo }),
      });
      if (!response.ok) {
        mostrarNotificacao({ tipo: 'erro', titulo: 'Erro', mensagem: 'Não foi possível atualizar o horário.' });
        return;
      }
      carregarHorarios();
    } catch {
      mostrarNotificacao({ tipo: 'erro', titulo: 'Erro', mensagem: 'Não foi possível atualizar o horário.' });
    }
  };

  const removerHorario = (h: HorarioAtendimentoDto) => {
    mostrarModal({
      titulo: 'Remover horário',
      mensagem: `Remover o horário de ${h.hora}?`,
      tipo: 'aviso',
      textoBotaoConfirmar: 'Remover',
      onConfirmar: async () => {
        try {
          const response = await fetch(`/api/horarios/${h.id}`, { method: 'DELETE' });
          if (!response.ok && response.status !== 204) {
            mostrarNotificacao({ tipo: 'erro', titulo: 'Erro', mensagem: 'Não foi possível remover o horário.' });
            return;
          }
          mostrarNotificacao({ tipo: 'sucesso', titulo: 'Horário removido' });
          carregarHorarios();
        } catch {
          mostrarNotificacao({ tipo: 'erro', titulo: 'Erro', mensagem: 'Não foi possível remover o horário.' });
        }
      },
    });
  };

  const adicionarExcecao = async () => {
    if (!novaData) {
      mostrarNotificacao({ tipo: 'erro', titulo: 'Informe uma data' });
      return;
    }
    setSalvandoExcecao(true);
    try {
      const response = await fetch('/api/excecoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: novaData,
          hora: diaInteiro ? null : novaHoraExcecao,
          motivo: novoMotivo.trim() || undefined,
        }),
      });
      const dados = await response.json().catch(() => null);
      if (!response.ok) {
        mostrarNotificacao({ tipo: 'erro', titulo: 'Erro', mensagem: dados?.error ?? 'Não foi possível bloquear a data.' });
        return;
      }
      mostrarNotificacao({ tipo: 'sucesso', titulo: 'Bloqueio adicionado' });
      setNovaData('');
      setNovoMotivo('');
      carregarExcecoes();
    } catch {
      mostrarNotificacao({ tipo: 'erro', titulo: 'Erro', mensagem: 'Não foi possível bloquear a data.' });
    } finally {
      setSalvandoExcecao(false);
    }
  };

  const removerExcecao = (e: ExcecaoDto) => {
    mostrarModal({
      titulo: 'Remover bloqueio',
      mensagem: `Remover o bloqueio de ${formatarDataDeISO(e.data)}?`,
      tipo: 'aviso',
      textoBotaoConfirmar: 'Remover',
      onConfirmar: async () => {
        try {
          const response = await fetch(`/api/excecoes/${e.id}`, { method: 'DELETE' });
          if (!response.ok && response.status !== 204) {
            mostrarNotificacao({ tipo: 'erro', titulo: 'Erro', mensagem: 'Não foi possível remover o bloqueio.' });
            return;
          }
          mostrarNotificacao({ tipo: 'sucesso', titulo: 'Bloqueio removido' });
          carregarExcecoes();
        } catch {
          mostrarNotificacao({ tipo: 'erro', titulo: 'Erro', mensagem: 'Não foi possível remover o bloqueio.' });
        }
      },
    });
  };

  return (
    <LayoutPsicologa>
      <div className="mb-4">
        <span className="pmc-rotulo">Área da psicóloga</span>
        <h1 className="h3 mb-0 mt-1">Disponibilidade</h1>
      </div>

      <span className="pmc-rotulo d-block mb-3">Horários de atendimento</span>
      {carregandoHorarios ? (
        <div className="text-center py-4">
          <Spinner animation="border" role="status" />
        </div>
      ) : (
        <Row className="g-3 mb-4">
          {DIAS_SEMANA_ORDEM.map(({ chave, label }) => {
            const doDia = horarios.filter((h) => h.diaSemana === chave).sort((a, b) => a.hora.localeCompare(b.hora));
            return (
              <Col key={chave} xs={12} md={6} lg={4} xl={3}>
                <Card className="h-100">
                  <Card.Body>
                    <span className="pmc-peso-medio d-block mb-2">{label}</span>
                    {doDia.length === 0 ? (
                      <p className="pmc-texto-2 pmc-t-sm">Nenhum horário.</p>
                    ) : (
                      <div className="d-flex flex-column gap-2">
                        {doDia.map((h) => (
                          <div key={h.id} className="d-flex align-items-center justify-content-between pmc-chip">
                            <Form.Check
                              type="switch"
                              id={`horario-${h.id}`}
                              label={h.hora}
                              checked={h.ativo}
                              onChange={() => alternarHorario(h)}
                            />
                            <Button variant="link" className="text-danger p-0 ms-2" onClick={() => removerHorario(h)}>
                              <i className="bi bi-trash" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </Card.Body>
                </Card>
              </Col>
            );
          })}
        </Row>
      )}

      <Card className="mb-5">
        <Card.Body>
          <span className="pmc-rotulo d-block mb-3">Adicionar horário</span>
          <Row className="align-items-end g-2">
            <Col md={4}>
              <Form.Group controlId="novoHorarioDia">
                <Form.Label>Dia da semana</Form.Label>
                <Form.Select value={novoDia} onChange={(e) => setNovoDia(e.target.value as DiaSemana)}>
                  {DIAS_SEMANA_ORDEM.map(({ chave, label }) => (
                    <option key={chave} value={chave}>
                      {label}
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Col>
            <Col md={4}>
              <Form.Group controlId="novoHorarioHora">
                <Form.Label>Horário</Form.Label>
                <Form.Control
                  type="time"
                  step={300}
                  value={novaHora}
                  onChange={(e) => setNovaHora(e.target.value)}
                />
              </Form.Group>
            </Col>
            <Col md={4}>
              <Button variant="primary" disabled={salvandoHorario} onClick={adicionarHorario}>
                {salvandoHorario ? 'Adicionando...' : 'Adicionar horário'}
              </Button>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      <span className="pmc-rotulo d-block mb-3">Datas indisponíveis</span>
      {carregandoExcecoes ? (
        <div className="text-center py-4">
          <Spinner animation="border" role="status" />
        </div>
      ) : (
        <Card className="mb-4">
          <Card.Body className="p-0">
            {excecoes.length === 0 ? (
              <p className="pmc-texto-2 p-4 mb-0">Nenhuma data bloqueada nos próximos 90 dias.</p>
            ) : (
              <ListGroup variant="flush">
                {excecoes.map((e) => (
                  <ListGroup.Item key={e.id} className="d-flex justify-content-between align-items-center">
                    <div>
                      <span className="pmc-peso-medio">{formatarDataDeISO(e.data)}</span>{' '}
                      <span className="pmc-texto-2">{e.hora ? `às ${e.hora}` : '— dia inteiro'}</span>
                      {e.motivo && <div className="pmc-texto-2 pmc-t-sm">{e.motivo}</div>}
                    </div>
                    <Button variant="link" className="text-danger" onClick={() => removerExcecao(e)}>
                      <i className="bi bi-trash" />
                    </Button>
                  </ListGroup.Item>
                ))}
              </ListGroup>
            )}
          </Card.Body>
        </Card>
      )}

      <Card>
        <Card.Body>
          <span className="pmc-rotulo d-block mb-3">Bloquear data</span>
          <Row className="align-items-end g-2">
            <Col md={3}>
              <Form.Group controlId="novaExcecaoData">
                <Form.Label>Data</Form.Label>
                <Form.Control type="date" value={novaData} onChange={(e) => setNovaData(e.target.value)} />
              </Form.Group>
            </Col>
            <Col md={2} className="d-flex align-items-center">
              <Form.Check
                type="checkbox"
                id="excecaoDiaInteiro"
                label="Dia inteiro"
                checked={diaInteiro}
                onChange={(e) => setDiaInteiro(e.target.checked)}
              />
            </Col>
            {!diaInteiro && (
              <Col md={2}>
                <Form.Group controlId="novaExcecaoHora">
                  <Form.Label>Horário</Form.Label>
                  <Form.Control
                    type="time"
                    step={300}
                    value={novaHoraExcecao}
                    onChange={(e) => setNovaHoraExcecao(e.target.value)}
                  />
                </Form.Group>
              </Col>
            )}
            <Col md={3}>
              <Form.Group controlId="novaExcecaoMotivo">
                <Form.Label>Motivo (opcional)</Form.Label>
                <Form.Control value={novoMotivo} onChange={(e) => setNovoMotivo(e.target.value)} maxLength={300} />
              </Form.Group>
            </Col>
            <Col md={2}>
              <Button variant="primary" disabled={salvandoExcecao} onClick={adicionarExcecao}>
                {salvandoExcecao ? 'Salvando...' : 'Bloquear'}
              </Button>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      <ModalConfirmacao />
    </LayoutPsicologa>
  );
}
