'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Spinner from 'react-bootstrap/Spinner';
import Card from 'react-bootstrap/Card';
import Button from 'react-bootstrap/Button';
import Badge from 'react-bootstrap/Badge';
import Collapse from 'react-bootstrap/Collapse';
import Alert from 'react-bootstrap/Alert';
import type { Alerta, AlertasResposta } from '@/types/alertas';
import { useNotificacao } from '@/components/NotificacaoProvider';
import { telefoneComDdi } from './telefone';
import { dataLocalISO, formatarData, formatarHora } from '@/components/area-restrita/agenda/formatos';

type PainelAlertasProps = {
  modo: 'painel' | 'inline';
  /** Fecha o Offcanvas que hospeda o painel (usado só em modo="painel"). */
  aoFechar?: () => void;
  /** Notifica o total (cancelamentos + lembretes) sempre que a lista muda. */
  aoTotalMudar?: (total: number) => void;
};

const MODALIDADE_LABEL: Record<'presencial' | 'online', string> = {
  presencial: 'presencial',
  online: 'online',
};

export default function PainelAlertas({ modo, aoFechar, aoTotalMudar }: PainelAlertasProps) {
  const router = useRouter();
  const { mostrarNotificacao } = useNotificacao();

  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [totais, setTotais] = useState<{ cancelamentos: number; lembretes: number }>({
    cancelamentos: 0,
    lembretes: 0,
  });
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [aberto, setAberto] = useState(true);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const response = await fetch('/api/alertas');
      const dados = await response.json().catch(() => null);
      if (!response.ok) {
        setErro(dados?.error ?? 'Não foi possível carregar os alertas.');
        return;
      }
      const resposta = dados as AlertasResposta;
      setAlertas(resposta.alertas);
      setTotais(resposta.totais);
      aoTotalMudar?.(resposta.totais.cancelamentos + resposta.totais.lembretes);
    } catch {
      setErro('Não foi possível carregar os alertas.');
    } finally {
      setCarregando(false);
    }
    // aoTotalMudar é estável o suficiente vindo do pai; não incluir para não recarregar em loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const removerDaLista = (alerta: Alerta) => {
    setAlertas((prev) => prev.filter((item) => !(item.tipo === alerta.tipo && item.id === alerta.id)));
    setTotais((prev) => {
      const chave = alerta.tipo === 'lembrete' ? 'lembretes' : 'cancelamentos';
      const novo = { ...prev, [chave]: Math.max(0, prev[chave] - 1) };
      aoTotalMudar?.(novo.cancelamentos + novo.lembretes);
      return novo;
    });
  };

  const tratarAlerta = async (alerta: Alerta, mensagemJaTratado: string) => {
    removerDaLista(alerta);
    try {
      const response = await fetch(`/api/alertas/${alerta.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo: alerta.tipo }),
      });
      if (!response.ok && response.status === 404) {
        mostrarNotificacao({ tipo: 'aviso', titulo: mensagemJaTratado });
      } else if (!response.ok) {
        mostrarNotificacao({ tipo: 'erro', titulo: 'Não foi possível atualizar o alerta.' });
        carregar();
      }
    } catch {
      mostrarNotificacao({ tipo: 'erro', titulo: 'Não foi possível atualizar o alerta.' });
      carregar();
    }
  };

  const enviarLembrete = (alerta: Extract<Alerta, { tipo: 'lembrete' }>) => {
    const data = formatarData(alerta.consulta.inicio, { day: '2-digit', month: '2-digit' });
    const hora = formatarHora(alerta.consulta.inicio);
    const modalidadeLabel = alerta.consulta.modalidade === 'online' ? MODALIDADE_LABEL.online : MODALIDADE_LABEL.presencial;
    const mensagem = `Olá ${alerta.consulta.pacienteNome}, aqui é a Psicóloga Maria Cristina. Lembrete da sua consulta amanhã, ${data} às ${hora} (${modalidadeLabel}). Até lá!`;
    window.open(`https://wa.me/${telefoneComDdi(alerta.consulta.pacienteTelefone)}?text=${encodeURIComponent(mensagem)}`, '_blank');
    tratarAlerta(alerta, 'Este lembrete já foi tratado.');
  };

  const marcarComoVisto = (alerta: Extract<Alerta, { tipo: 'cancelamento' }>) => {
    tratarAlerta(alerta, 'Este cancelamento já foi tratado.');
  };

  const verNaAgenda = (consulta: { inicio: string }) => {
    const semana = dataLocalISO(new Date(consulta.inicio));
    aoFechar?.();
    router.push(`/area-restrita/agenda?semana=${semana}`);
  };

  if (modo === 'inline') {
    if (carregando || (!erro && alertas.length === 0)) return null;
    return (
      <Card className="card--areia mb-4">
        <Card.Body>
          <div className="d-flex justify-content-between align-items-center">
            <div>
              <span className="pmc-rotulo">Alertas</span>
              <p className="pmc-texto-2 pmc-t-sm mb-0 mt-1">
                {totais.lembretes} lembrete{totais.lembretes === 1 ? '' : 's'} para amanhã · {totais.cancelamentos} cancelamento
                {totais.cancelamentos === 1 ? '' : 's'}
              </p>
            </div>
            <Button
              variant="link"
              size="sm"
              className="text-decoration-none"
              onClick={() => setAberto((v) => !v)}
              aria-expanded={aberto}
            >
              {aberto ? 'Recolher' : 'Expandir'}
              <i className={`bi ${aberto ? 'bi-chevron-up' : 'bi-chevron-down'} ms-1`} />
            </Button>
          </div>
          <Collapse in={aberto}>
            <div className="mt-3">
              {erro && <Alert variant="danger">{erro}</Alert>}
              <ListaAlertas
                alertas={alertas}
                onEnviarLembrete={enviarLembrete}
                onMarcarVisto={marcarComoVisto}
                onVerNaAgenda={verNaAgenda}
              />
            </div>
          </Collapse>
        </Card.Body>
      </Card>
    );
  }

  return (
    <div>
      <span className="pmc-rotulo">Alertas</span>
      <p className="pmc-texto-2 pmc-t-sm mt-1">
        {totais.lembretes} lembrete{totais.lembretes === 1 ? '' : 's'} para amanhã · {totais.cancelamentos} cancelamento
        {totais.cancelamentos === 1 ? '' : 's'}
      </p>

      {erro && <Alert variant="danger">{erro}</Alert>}

      {carregando ? (
        <div className="text-center py-5">
          <Spinner animation="border" role="status" />
        </div>
      ) : alertas.length === 0 ? (
        <div className="text-center py-5">
          <div className="pmc-icone pmc-icone--salvia mx-auto mb-3">
            <i className="bi bi-check2-circle" />
          </div>
          <p className="pmc-texto-2 mb-0">Nenhum alerta. Tudo em dia.</p>
        </div>
      ) : (
        <ListaAlertas
          alertas={alertas}
          onEnviarLembrete={enviarLembrete}
          onMarcarVisto={marcarComoVisto}
          onVerNaAgenda={verNaAgenda}
        />
      )}
    </div>
  );
}

type ListaAlertasProps = {
  alertas: Alerta[];
  onEnviarLembrete: (alerta: Extract<Alerta, { tipo: 'lembrete' }>) => void;
  onMarcarVisto: (alerta: Extract<Alerta, { tipo: 'cancelamento' }>) => void;
  onVerNaAgenda: (consulta: { inicio: string }) => void;
};

function ListaAlertas({ alertas, onEnviarLembrete, onMarcarVisto, onVerNaAgenda }: ListaAlertasProps) {
  return (
    <div className="d-flex flex-column gap-3">
      {alertas.map((alerta) =>
        alerta.tipo === 'lembrete' ? (
          <Card key={`lembrete-${alerta.id}`} className="card--areia">
            <Card.Body className="d-flex gap-3">
              <div className="pmc-icone pmc-icone--salvia flex-shrink-0">
                <i className="bi bi-alarm" />
              </div>
              <div className="flex-grow-1">
                <p className="pmc-peso-medio mb-1">
                  Amanhã, {formatarData(alerta.consulta.inicio, { day: '2-digit', month: '2-digit' })} às{' '}
                  {formatarHora(alerta.consulta.inicio)} ·{' '}
                  {alerta.consulta.modalidade === 'online' ? 'Online' : 'Presencial'}
                </p>
                <p className="pmc-texto-2 pmc-t-sm mb-2">
                  {alerta.consulta.pacienteNome}
                  {!alerta.consulta.temLogin && <Badge className="pmc-badge-neutro ms-2">sem acesso</Badge>}
                </p>
                <Button variant="primary" size="sm" onClick={() => onEnviarLembrete(alerta)}>
                  <i className="bi bi-whatsapp me-1" />
                  Enviar lembrete
                </Button>
              </div>
            </Card.Body>
          </Card>
        ) : (
          <Card key={`cancelamento-${alerta.id}`}>
            <Card.Body className="d-flex gap-3">
              <div className="pmc-icone flex-shrink-0">
                <i className="bi bi-calendar-x text-danger" />
              </div>
              <div className="flex-grow-1">
                <p className="pmc-peso-medio mb-1">{alerta.titulo}</p>
                <p className="pmc-texto-2 pmc-t-sm mb-1">{alerta.mensagem}</p>
                <p className="pmc-texto-2 pmc-t-sm mb-2">
                  {formatarData(alerta.criadaEm, {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
                <div className="d-flex gap-2 flex-wrap">
                  <Button variant="outline-secondary" size="sm" onClick={() => onMarcarVisto(alerta)}>
                    Marcar como visto
                  </Button>
                  {alerta.consulta && (
                    <Button variant="outline-secondary" size="sm" onClick={() => onVerNaAgenda(alerta.consulta!)}>
                      Ver na agenda
                    </Button>
                  )}
                </div>
              </div>
            </Card.Body>
          </Card>
        )
      )}
    </div>
  );
}
