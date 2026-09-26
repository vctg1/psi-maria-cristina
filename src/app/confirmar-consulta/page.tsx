'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import Card from 'react-bootstrap/Card';
import Alert from 'react-bootstrap/Alert';
import Button from 'react-bootstrap/Button';
import Spinner from 'react-bootstrap/Spinner';
import type { ConfirmacaoPublicaDto } from '@/types/agenda';
import { eventoConsultaPaciente, gerarIcs, linkGoogleCalendar } from '@/lib/calendario';
import { formatarData, formatarHora } from '@/components/area-restrita/agenda/formatos';

function baixarIcsConsulta(consulta: { id: string; inicio: string; modalidade: 'presencial' | 'online' | null }) {
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
}

export default function ConfirmarConsultaPage() {
  return (
    <Suspense fallback={null}>
      <ConfirmarConsultaConteudo />
    </Suspense>
  );
}

function ConfirmarConsultaConteudo() {
  const searchParams = useSearchParams();
  const [token, setToken] = useState<string | null>(null);
  const [prontoParaLer, setProntoParaLer] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [dados, setDados] = useState<ConfirmacaoPublicaDto | null>(null);
  const [confirmando, setConfirmando] = useState(false);

  useEffect(() => {
    const t = searchParams.get('token') ?? new URLSearchParams(window.location.search).get('token');
    if (t) {
      setToken((prev) => prev ?? t);
      window.history.replaceState(null, '', window.location.pathname);
    }
    setProntoParaLer(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!prontoParaLer) return;
    if (!token) {
      setCarregando(false);
      setErro('Link inválido ou expirado. Fale com a psicóloga.');
      return;
    }
    (async () => {
      setCarregando(true);
      try {
        const response = await fetch(`/api/confirmacao?token=${encodeURIComponent(token)}`);
        if (!response.ok) {
          setErro('Link inválido ou expirado. Fale com a psicóloga.');
          return;
        }
        const resultado = (await response.json()) as ConfirmacaoPublicaDto;
        setDados(resultado);
      } catch {
        setErro('Link inválido ou expirado. Fale com a psicóloga.');
      } finally {
        setCarregando(false);
      }
    })();
  }, [prontoParaLer, token]);

  const confirmar = async () => {
    if (!token) return;
    setConfirmando(true);
    setErro(null);
    try {
      const response = await fetch('/api/confirmacao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      if (!response.ok) {
        setErro('Link inválido ou expirado. Fale com a psicóloga.');
        return;
      }
      const resultado = (await response.json()) as ConfirmacaoPublicaDto;
      setDados(resultado);
    } catch {
      setErro('Link inválido ou expirado. Fale com a psicóloga.');
    } finally {
      setConfirmando(false);
    }
  };

  return (
    <div className="pmc-auth">
      <div className="pmc-mancha pmc-mancha--salvia" style={{ top: '-8%', left: '-10%', width: '46%', aspectRatio: 1 }} aria-hidden="true" />
      <div className="pmc-mancha" style={{ bottom: '-10%', right: '-8%', width: '40%', aspectRatio: 1 }} aria-hidden="true" />
      <Card className="pmc-auth-card pmc-acima">
        <Card.Body>
          <Image
            src="/maria-cristina-logo-crp.png"
            alt="Psicóloga Maria Cristina"
            width={72}
            height={72}
            className="pmc-auth-logo mb-3"
            style={{ objectFit: 'contain' }}
          />

          {carregando ? (
            <div className="text-center py-4">
              <Spinner animation="border" role="status" />
            </div>
          ) : erro ? (
            <Alert variant="warning" className="mb-0">
              {erro}
            </Alert>
          ) : dados ? (
            <div className="text-center">
              <span className="pmc-rotulo">Confirmação de consulta</span>
              <h1 className="h3 mt-2">Olá, {dados.primeiroNome}</h1>

              {dados.estado === 'ja_confirmada' && (
                <Alert variant="info">Esta consulta já estava confirmada.</Alert>
              )}
              {dados.estado === 'confirmada' && (
                <Alert variant="success">Consulta confirmada com sucesso.</Alert>
              )}

              <div className="text-start mb-4">
                {dados.consultas.map((c) => (
                  <p key={c.id} className="mb-1 pmc-texto-2">
                    {formatarData(c.inicio, { weekday: 'long', day: '2-digit', month: 'long' })} às{' '}
                    {formatarHora(c.inicio)} · {c.modalidade === 'online' ? 'Online' : 'Presencial'}
                  </p>
                ))}
              </div>

              {dados.estado === 'pendente' ? (
                <div className="d-grid">
                  <Button variant="primary" disabled={confirmando} onClick={confirmar}>
                    {confirmando ? 'Confirmando...' : 'Confirmar presença'}
                  </Button>
                </div>
              ) : (
                <div className="d-flex flex-column gap-2">
                  {dados.consultas.map((c) => (
                    <div key={c.id} className="d-flex flex-wrap gap-2 justify-content-center">
                      <a
                        id={`botao-google-calendar-${c.id}`}
                        className="btn btn-outline-secondary btn-sm"
                        target="_blank"
                        rel="noopener noreferrer"
                        href={linkGoogleCalendar(
                          eventoConsultaPaciente({ id: c.id, inicio: new Date(c.inicio), modalidade: c.modalidade })
                        )}
                      >
                        Adicionar ao Google Calendar
                      </a>
                      <Button
                        id={`botao-baixar-ics-${c.id}`}
                        variant="outline-secondary"
                        size="sm"
                        onClick={() => baixarIcsConsulta(c)}
                      >
                        Baixar .ics
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : null}

          <div className="text-center mt-3">
            <Link href="/">
              <Button variant="link" size="sm">Voltar ao início</Button>
            </Link>
          </div>
        </Card.Body>
      </Card>
    </div>
  );
}
