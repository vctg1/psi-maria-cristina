'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Tabs from 'react-bootstrap/Tabs';
import Tab from 'react-bootstrap/Tab';
import Table from 'react-bootstrap/Table';
import Form from 'react-bootstrap/Form';
import Button from 'react-bootstrap/Button';
import Spinner from 'react-bootstrap/Spinner';
import Alert from 'react-bootstrap/Alert';
import Modal from 'react-bootstrap/Modal';
import OverlayTrigger from 'react-bootstrap/OverlayTrigger';
import Tooltip from 'react-bootstrap/Tooltip';
import LayoutPsicologa from '@/components/area-restrita/LayoutPsicologa';
import ModalRegistrarPagamento from '@/components/area-restrita/financeiro/ModalRegistrarPagamento';
import ModalCobrancaOnline from '@/components/area-restrita/financeiro/ModalCobrancaOnline';
import type { CobrancaOnlineDto, ConsultaCobrancaDto, PagamentoDto } from '@/types/pagamento';
import { METODO_LABEL } from '@/types/pagamento';
import { formatarData, formatarHora } from '@/components/area-restrita/agenda/formatos';
import { formatarMoeda } from '@/components/area-restrita/financeiro/formatos';
import { useNotificacao } from '@/components/NotificacaoProvider';

const STATUS_CONSULTA_LABEL: Record<ConsultaCobrancaDto['status'], string> = {
  agendada: 'A confirmar',
  confirmada: 'Confirmada',
  realizada: 'Realizada',
  cancelada: 'Cancelada',
  nao_compareceu: 'Não compareceu',
};

export default function FinanceiroPage() {
  const { mostrarNotificacao } = useNotificacao();

  const [emAberto, setEmAberto] = useState<ConsultaCobrancaDto[]>([]);
  const [carregandoEmAberto, setCarregandoEmAberto] = useState(true);
  const [erroEmAberto, setErroEmAberto] = useState<string | null>(null);
  const [filtroPaciente, setFiltroPaciente] = useState('');
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());
  const [modalPagamentoAberto, setModalPagamentoAberto] = useState(false);
  const [modalCobrancaOnlineAberto, setModalCobrancaOnlineAberto] = useState(false);

  const [pagamentos, setPagamentos] = useState<PagamentoDto[]>([]);
  const [carregandoHistorico, setCarregandoHistorico] = useState(true);
  const [erroHistorico, setErroHistorico] = useState<string | null>(null);
  const [estornandoId, setEstornandoId] = useState<string | null>(null);
  const [modalConfirmarEstorno, setModalConfirmarEstorno] = useState<string | null>(null);
  const [atualizandoStatusId, setAtualizandoStatusId] = useState<string | null>(null);

  const carregarEmAberto = useCallback(async () => {
    setCarregandoEmAberto(true);
    setErroEmAberto(null);
    try {
      const response = await fetch('/api/pagamentos/em-aberto');
      const dados = await response.json().catch(() => null);
      if (!response.ok) {
        setErroEmAberto(dados?.error ?? 'Não foi possível carregar as consultas em aberto.');
        setEmAberto([]);
        return;
      }
      setEmAberto((dados?.consultas ?? []) as ConsultaCobrancaDto[]);
    } catch {
      setErroEmAberto('Não foi possível carregar as consultas em aberto.');
    } finally {
      setCarregandoEmAberto(false);
    }
  }, []);

  const carregarHistorico = useCallback(async () => {
    setCarregandoHistorico(true);
    setErroHistorico(null);
    try {
      const response = await fetch('/api/pagamentos');
      const dados = await response.json().catch(() => null);
      if (!response.ok) {
        setErroHistorico(dados?.error ?? 'Não foi possível carregar o histórico.');
        setPagamentos([]);
        return;
      }
      setPagamentos((dados?.pagamentos ?? []) as PagamentoDto[]);
    } catch {
      setErroHistorico('Não foi possível carregar o histórico.');
    } finally {
      setCarregandoHistorico(false);
    }
  }, []);

  useEffect(() => {
    carregarEmAberto();
    carregarHistorico();
  }, [carregarEmAberto, carregarHistorico]);

  const pacientesDistintos = useMemo(() => {
    const mapa = new Map<string, string>();
    emAberto.forEach((c) => mapa.set(c.paciente.id, c.paciente.nome));
    return Array.from(mapa.entries()).map(([id, nome]) => ({ id, nome })).sort((a, b) => a.nome.localeCompare(b.nome));
  }, [emAberto]);

  const emAbertoFiltradas = useMemo(() => {
    if (!filtroPaciente) return emAberto;
    return emAberto.filter((c) => c.paciente.id === filtroPaciente);
  }, [emAberto, filtroPaciente]);

  useEffect(() => {
    // remove seleções que saíram do filtro/lista
    setSelecionadas((atual) => {
      const idsValidos = new Set(emAbertoFiltradas.map((c) => c.id));
      const novo = new Set(Array.from(atual).filter((id) => idsValidos.has(id)));
      return novo.size === atual.size ? atual : novo;
    });
  }, [emAbertoFiltradas]);

  const alternarSelecao = (id: string) => {
    setSelecionadas((atual) => {
      const novo = new Set(atual);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  };

  const todasSelecionadas = emAbertoFiltradas.length > 0 && emAbertoFiltradas.every((c) => selecionadas.has(c.id));

  const alternarSelecionarTodas = () => {
    if (todasSelecionadas) {
      setSelecionadas(new Set());
    } else {
      setSelecionadas(new Set(emAbertoFiltradas.map((c) => c.id)));
    }
  };

  const consultasSelecionadas = useMemo(
    () => emAbertoFiltradas.filter((c) => selecionadas.has(c.id)),
    [emAbertoFiltradas, selecionadas]
  );

  const totalSelecionado = consultasSelecionadas.reduce((soma, c) => soma + c.cobranca.valor, 0);

  const pacientesDistintosNaSelecao = useMemo(
    () => new Set(consultasSelecionadas.map((c) => c.paciente.id)).size,
    [consultasSelecionadas]
  );
  const cobrancaOnlineDesabilitada = consultasSelecionadas.length === 0 || pacientesDistintosNaSelecao > 1;

  const aoRegistrarPagamento = (_pagamento: PagamentoDto) => {
    setModalPagamentoAberto(false);
    setSelecionadas(new Set());
    carregarEmAberto();
    carregarHistorico();
  };

  const aoGerarCobrancaOnline = (_cobranca: CobrancaOnlineDto) => {
    setModalCobrancaOnlineAberto(false);
    setSelecionadas(new Set());
    carregarEmAberto();
    carregarHistorico();
  };

  const atualizarStatusOnline = async (pagamentoId: string) => {
    setAtualizandoStatusId(pagamentoId);
    try {
      const response = await fetch(`/api/pagamentos/${pagamentoId}/cobranca`);
      const dados = await response.json().catch(() => null);
      if (!response.ok) {
        mostrarNotificacao({ tipo: 'erro', titulo: 'Erro', mensagem: dados?.error ?? 'Não foi possível atualizar o status.' });
        return;
      }
      mostrarNotificacao({ tipo: 'sucesso', titulo: 'Status atualizado' });
      carregarEmAberto();
      carregarHistorico();
    } catch {
      mostrarNotificacao({ tipo: 'erro', titulo: 'Erro', mensagem: 'Não foi possível atualizar o status.' });
    } finally {
      setAtualizandoStatusId(null);
    }
  };

  const confirmarEstorno = async (pagamentoId: string) => {
    setEstornandoId(pagamentoId);
    try {
      const response = await fetch(`/api/pagamentos/${pagamentoId}/estornar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const dados = await response.json().catch(() => null);
      if (!response.ok) {
        mostrarNotificacao({ tipo: 'erro', titulo: 'Erro', mensagem: dados?.error ?? 'Não foi possível estornar.' });
        return;
      }
      mostrarNotificacao({ tipo: 'sucesso', titulo: 'Pagamento desfeito' });
      setModalConfirmarEstorno(null);
      carregarEmAberto();
      carregarHistorico();
    } catch {
      mostrarNotificacao({ tipo: 'erro', titulo: 'Erro', mensagem: 'Não foi possível estornar.' });
    } finally {
      setEstornandoId(null);
    }
  };

  return (
    <LayoutPsicologa>
      <div className="mb-4">
        <span className="pmc-rotulo">Área da psicóloga</span>
        <h1 className="h3 mb-0 mt-1">Financeiro</h1>
      </div>

      <Tabs defaultActiveKey="em-aberto" className="mb-3" id="tabs-financeiro">
        <Tab eventKey="em-aberto" title="Em aberto">
          <div className="d-flex flex-wrap align-items-end gap-3 my-3">
            <Form.Group controlId="filtroPacienteFinanceiro" style={{ minWidth: 240 }}>
              <Form.Label>Paciente</Form.Label>
              <Form.Select value={filtroPaciente} onChange={(e) => setFiltroPaciente(e.target.value)}>
                <option value="">Todos</option>
                {pacientesDistintos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>
          </div>

          {erroEmAberto && <Alert variant="danger">{erroEmAberto}</Alert>}

          {carregandoEmAberto ? (
            <div className="text-center py-5">
              <Spinner animation="border" role="status" />
            </div>
          ) : emAbertoFiltradas.length === 0 ? (
            <p className="pmc-texto-2 mb-0">Nenhuma consulta em aberto.</p>
          ) : (
            <>
              <Table responsive hover className="pmc-tabela">
                <thead>
                  <tr>
                    <th>
                      <Form.Check
                        id="checkbox-selecionar-todas"
                        type="checkbox"
                        checked={todasSelecionadas}
                        onChange={alternarSelecionarTodas}
                        label="Todas"
                      />
                    </th>
                    <th>Data</th>
                    <th>Paciente</th>
                    <th>Status</th>
                    <th className="text-end">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {emAbertoFiltradas.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <Form.Check
                          id={`checkbox-consulta-${c.id}`}
                          type="checkbox"
                          checked={selecionadas.has(c.id)}
                          onChange={() => alternarSelecao(c.id)}
                        />
                      </td>
                      <td>
                        {formatarData(c.inicio, { day: '2-digit', month: '2-digit', year: 'numeric' })} às{' '}
                        {formatarHora(c.inicio)}
                      </td>
                      <td>{c.paciente.nome}</td>
                      <td>{STATUS_CONSULTA_LABEL[c.status]}</td>
                      <td className="text-end">{formatarMoeda(c.cobranca.valor)}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>

              <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mt-3">
                <span className="pmc-texto-2">
                  {consultasSelecionadas.length} selecionada{consultasSelecionadas.length === 1 ? '' : 's'} ·{' '}
                  total {formatarMoeda(totalSelecionado)}
                </span>
                <div className="d-flex gap-2">
                  <Button
                    id="botao-registrar-pagamento-financeiro"
                    variant="primary"
                    disabled={consultasSelecionadas.length === 0}
                    onClick={() => setModalPagamentoAberto(true)}
                  >
                    Registrar pagamento
                  </Button>
                  <OverlayTrigger
                    overlay={
                      pacientesDistintosNaSelecao > 1 ? (
                        <Tooltip id="tooltip-cobranca-online-desabilitada">
                          Selecione consultas de um único paciente para gerar a cobrança online.
                        </Tooltip>
                      ) : (
                        <span />
                      )
                    }
                  >
                    <span>
                      <Button
                        id="botao-gerar-cobranca-online-financeiro"
                        variant="outline-primary"
                        disabled={cobrancaOnlineDesabilitada}
                        onClick={() => setModalCobrancaOnlineAberto(true)}
                      >
                        Gerar cobrança online
                      </Button>
                    </span>
                  </OverlayTrigger>
                </div>
              </div>
            </>
          )}
        </Tab>

        <Tab eventKey="historico" title="Histórico">
          {erroHistorico && <Alert variant="danger">{erroHistorico}</Alert>}

          {carregandoHistorico ? (
            <div className="text-center py-5">
              <Spinner animation="border" role="status" />
            </div>
          ) : pagamentos.length === 0 ? (
            <p className="pmc-texto-2 mb-0 mt-3">Nenhum pagamento registrado ainda.</p>
          ) : (
            <Table responsive hover className="pmc-tabela mt-3">
              <thead>
                <tr>
                  <th>Criado em</th>
                  <th>Recebido em</th>
                  <th>Método</th>
                  <th>Origem</th>
                  <th className="text-end">Valor</th>
                  <th>Consultas</th>
                  <th>Status</th>
                  <th>Ação</th>
                </tr>
              </thead>
              <tbody>
                {pagamentos.map((p) => {
                  const primeiroPaciente = p.consultas[0]?.paciente.nome ?? '';
                  const resumo =
                    p.consultas.length > 1
                      ? `${p.consultas.length} consultas · ${primeiroPaciente}`
                      : `1 consulta · ${primeiroPaciente}`;
                  const listaTooltip = p.consultas
                    .map((c) => `${formatarData(c.inicio, { day: '2-digit', month: '2-digit' })} — ${c.paciente.nome}`)
                    .join(', ');
                  return (
                    <tr key={p.id}>
                      <td>{formatarData(p.criadoEm, { day: '2-digit', month: '2-digit', year: 'numeric' })}</td>
                      <td>
                        {p.recebidoEm
                          ? formatarData(`${p.recebidoEm}T12:00:00`, { day: '2-digit', month: '2-digit', year: 'numeric' })
                          : '—'}
                      </td>
                      <td>{p.metodo ? METODO_LABEL[p.metodo] : '—'}</td>
                      <td>{p.origem === 'online' ? 'Online' : 'Manual'}</td>
                      <td className="text-end">{formatarMoeda(p.valor)}</td>
                      <td>
                        <OverlayTrigger overlay={<Tooltip id={`tooltip-consultas-${p.id}`}>{listaTooltip}</Tooltip>}>
                          <span>{resumo}</span>
                        </OverlayTrigger>
                      </td>
                      <td>
                        {p.status === 'pago' && <span className="pmc-badge-ok">Pago</span>}
                        {p.status === 'estornado' && <span className="pmc-badge-neutro">Estornado</span>}
                        {p.status !== 'pago' && p.status !== 'estornado' && (
                          <span className="pmc-badge-neutro">{p.status}</span>
                        )}
                      </td>
                      <td>
                        {p.status === 'pago' && p.origem === 'manual' && (
                          <Button
                            id={`botao-desfazer-${p.id}`}
                            variant="outline-danger"
                            size="sm"
                            disabled={estornandoId === p.id}
                            onClick={() => setModalConfirmarEstorno(p.id)}
                          >
                            Desfazer
                          </Button>
                        )}
                        {p.origem === 'online' && p.status === 'pendente' && (
                          <Button
                            id={`botao-atualizar-status-${p.id}`}
                            variant="outline-primary"
                            size="sm"
                            disabled={atualizandoStatusId === p.id}
                            onClick={() => atualizarStatusOnline(p.id)}
                          >
                            {atualizandoStatusId === p.id ? 'Atualizando...' : 'Atualizar status'}
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          )}
        </Tab>
      </Tabs>

      <ModalRegistrarPagamento
        show={modalPagamentoAberto}
        consultas={consultasSelecionadas.map((c) => ({
          id: c.id,
          inicio: c.inicio,
          pacienteNome: c.paciente.nome,
          valor: c.cobranca.valor,
        }))}
        onHide={() => setModalPagamentoAberto(false)}
        onRegistrado={aoRegistrarPagamento}
      />

      <ModalCobrancaOnline
        show={modalCobrancaOnlineAberto}
        consultas={consultasSelecionadas.map((c) => ({
          id: c.id,
          inicio: c.inicio,
          pacienteNome: c.paciente.nome,
          valor: c.cobranca.valor,
        }))}
        onHide={() => setModalCobrancaOnlineAberto(false)}
        onGerada={aoGerarCobrancaOnline}
      />

      <Modal show={modalConfirmarEstorno !== null} onHide={() => setModalConfirmarEstorno(null)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Desfazer pagamento</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="mb-0">Tem certeza que deseja desfazer este pagamento?</p>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={() => setModalConfirmarEstorno(null)}>
            Voltar
          </Button>
          <Button
            variant="outline-danger"
            disabled={estornandoId !== null}
            onClick={() => modalConfirmarEstorno && confirmarEstorno(modalConfirmarEstorno)}
          >
            {estornandoId ? 'Desfazendo...' : 'Confirmar'}
          </Button>
        </Modal.Footer>
      </Modal>
    </LayoutPsicologa>
  );
}
