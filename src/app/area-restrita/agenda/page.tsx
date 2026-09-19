'use client';

import { useCallback, useEffect, useState } from 'react';
import Button from 'react-bootstrap/Button';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import Card from 'react-bootstrap/Card';
import Spinner from 'react-bootstrap/Spinner';
import Alert from 'react-bootstrap/Alert';
import LayoutPsicologa from '@/components/area-restrita/LayoutPsicologa';
import ModalNovaConsulta from '@/components/area-restrita/agenda/ModalNovaConsulta';
import PainelConsulta from '@/components/area-restrita/agenda/PainelConsulta';
import type { ConsultaDto } from '@/types/agenda';
import {
  DIAS_SEMANA_ORDEM,
  dataLocalISO,
  diasDaSemana,
  formatarDataCurta,
  formatarHora,
  hojeLocalISO,
  somarDiasISO,
} from '@/components/area-restrita/agenda/formatos';

const STATUS_CLASSE: Record<ConsultaDto['status'], string> = {
  agendada: 'pmc-badge-aviso',
  confirmada: 'pmc-badge-ok',
  realizada: 'pmc-badge-neutro',
  cancelada: 'pmc-badge-neutro',
  nao_compareceu: 'pmc-badge-neutro',
};

const STATUS_LABEL: Record<ConsultaDto['status'], string> = {
  agendada: 'A confirmar',
  confirmada: 'Confirmada',
  realizada: 'Realizada',
  cancelada: 'Cancelada',
  nao_compareceu: 'Não compareceu',
};

export default function AgendaPage() {
  const [referencia, setReferencia] = useState(hojeLocalISO());
  const [consultas, setConsultas] = useState<ConsultaDto[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [modalNovaAberto, setModalNovaAberto] = useState(false);
  const [dataParaNovaConsulta, setDataParaNovaConsulta] = useState<string | undefined>(undefined);
  const [consultaSelecionada, setConsultaSelecionada] = useState<ConsultaDto | null>(null);

  const dias = diasDaSemana(referencia);
  const segunda = dias[0];
  const domingo = dias[6];
  const hoje = hojeLocalISO();

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const response = await fetch(`/api/consultas?de=${segunda}&ate=${domingo}`);
      const dados = await response.json().catch(() => null);
      if (!response.ok) {
        setErro(dados?.error ?? 'Não foi possível carregar a agenda.');
        setConsultas([]);
        return;
      }
      setConsultas(dados as ConsultaDto[]);
    } catch {
      setErro('Não foi possível carregar a agenda.');
    } finally {
      setCarregando(false);
    }
  }, [segunda, domingo]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const consultasDoDia = (diaISO: string) => {
    return consultas
      .filter((c) => dataLocalISO(new Date(c.inicio)) === diaISO)
      .sort((a, b) => new Date(a.inicio).getTime() - new Date(b.inicio).getTime());
  };

  const abrirNovaConsulta = (diaISO?: string) => {
    setDataParaNovaConsulta(diaISO);
    setModalNovaAberto(true);
  };

  return (
    <LayoutPsicologa>
      <div className="d-flex justify-content-between align-items-end flex-wrap gap-3 mb-4">
        <div>
          <span className="pmc-rotulo">Agenda</span>
          <h1 className="h3 mb-0 mt-1">Sua semana</h1>
        </div>
        <Button variant="primary" onClick={() => abrirNovaConsulta(hoje)}>
          <i className="bi bi-plus-lg me-2" />
          Nova consulta
        </Button>
      </div>

      <div className="d-flex align-items-center gap-2 mb-4">
        <Button variant="outline-secondary" size="sm" onClick={() => setReferencia(somarDiasISO(segunda, -7))}>
          ‹ Semana anterior
        </Button>
        <Button variant="outline-secondary" size="sm" onClick={() => setReferencia(hoje)}>
          Hoje
        </Button>
        <Button variant="outline-secondary" size="sm" onClick={() => setReferencia(somarDiasISO(segunda, 7))}>
          Próxima ›
        </Button>
      </div>

      {erro && <Alert variant="danger">{erro}</Alert>}

      {carregando ? (
        <div className="text-center py-5">
          <Spinner animation="border" role="status" />
        </div>
      ) : (
        <Row className="g-3">
          {dias.map((diaISO, indice) => {
            const consultasDia = consultasDoDia(diaISO);
            const ehHoje = diaISO === hoje;
            return (
              <Col key={diaISO} xs={12} md={6} lg={4} xl={3}>
                <Card className={ehHoje ? 'card--areia h-100' : 'h-100'}>
                  <Card.Body>
                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <div>
                        <span className="pmc-texto-2 pmc-t-sm d-block">{DIAS_SEMANA_ORDEM[indice].label}</span>
                        <span className="pmc-peso-medio">{formatarDataCurta(diaISO)}</span>
                        {ehHoje && <span className="pmc-badge-ok ms-2">Hoje</span>}
                      </div>
                      <Button variant="outline-secondary" size="sm" onClick={() => abrirNovaConsulta(diaISO)}>
                        <i className="bi bi-plus-lg" />
                      </Button>
                    </div>

                    {consultasDia.length === 0 ? (
                      <p className="pmc-texto-2 pmc-t-sm mb-0">Sem consultas.</p>
                    ) : (
                      <div className="d-flex flex-column gap-2">
                        {consultasDia.map((consulta) => (
                          <Card
                            key={consulta.id}
                            className="card--areia"
                            role="button"
                            onClick={() => setConsultaSelecionada(consulta)}
                          >
                            <Card.Body className="p-2">
                              <div className="d-flex justify-content-between align-items-center">
                                <span className="pmc-peso-medio">{formatarHora(consulta.inicio)}</span>
                                <i className={`bi ${consulta.modalidade === 'online' ? 'bi-camera-video' : 'bi-geo-alt'}`} />
                              </div>
                              <div className="pmc-t-sm">{consulta.paciente.nome}</div>
                              <div className="mt-1">
                                <span className={STATUS_CLASSE[consulta.status]}>{STATUS_LABEL[consulta.status]}</span>
                                {!consulta.paciente.temLogin && (
                                  <span className="pmc-badge-neutro ms-1">sem acesso</span>
                                )}
                              </div>
                            </Card.Body>
                          </Card>
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

      <ModalNovaConsulta
        show={modalNovaAberto}
        dataInicial={dataParaNovaConsulta}
        onHide={() => setModalNovaAberto(false)}
        onCriado={carregar}
      />

      <PainelConsulta
        consulta={consultaSelecionada}
        onHide={() => setConsultaSelecionada(null)}
        onAtualizado={carregar}
      />
    </LayoutPsicologa>
  );
}
