'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import Card from 'react-bootstrap/Card';
import Button from 'react-bootstrap/Button';
import Spinner from 'react-bootstrap/Spinner';
import Alert from 'react-bootstrap/Alert';
import Table from 'react-bootstrap/Table';
import LayoutPaciente from '@/components/area-paciente/LayoutPaciente';
import CartaoConsulta from '@/components/area-paciente/CartaoConsulta';
import { formatarData, formatarHora } from '@/components/area-restrita/agenda/formatos';
import type { ConsultaDtoPaciente, ConsultaStatus } from '@/types/agenda';
import type { PacienteMeDto } from '@/types/paciente';

const STATUS_LABEL: Record<ConsultaStatus, string> = {
  agendada: 'Aguardando confirmação',
  confirmada: 'Confirmada',
  realizada: 'Realizada',
  cancelada: 'Cancelada',
  nao_compareceu: 'Não compareceu',
};

type ConsultasResposta = {
  proximas: ConsultaDtoPaciente[];
  historico: ConsultaDtoPaciente[];
  antecedenciaCancelamentoHoras: number;
};

export default function AreaPacientePage() {
  const [paciente, setPaciente] = useState<PacienteMeDto | null>(null);
  const [consultas, setConsultas] = useState<ConsultasResposta | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const [respPaciente, respConsultas] = await Promise.all([
        fetch('/api/paciente/me'),
        fetch('/api/paciente/me/consultas'),
      ]);
      const dadosPaciente = await respPaciente.json().catch(() => null);
      const dadosConsultas = await respConsultas.json().catch(() => null);
      if (!respPaciente.ok) {
        setErro(dadosPaciente?.error ?? 'Não foi possível carregar seus dados.');
        return;
      }
      if (!respConsultas.ok) {
        setErro(dadosConsultas?.error ?? 'Não foi possível carregar suas consultas.');
        return;
      }
      setPaciente(dadosPaciente as PacienteMeDto);
      setConsultas(dadosConsultas as ConsultasResposta);
    } catch {
      setErro('Não foi possível carregar seus dados.');
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const primeiroNome = paciente?.nome?.trim().split(' ')[0] ?? '';

  return (
    <LayoutPaciente>
      {carregando ? (
        <div className="text-center py-5">
          <Spinner animation="border" role="status" />
        </div>
      ) : erro ? (
        <Alert variant="danger">{erro}</Alert>
      ) : (
        <>
          <span className="pmc-rotulo d-block mb-1">Sua área</span>
          <h1 className="h3 mb-4">Olá, {primeiroNome}</h1>

          <section className="mb-5">
            <h2 className="h5 mb-3">Próximas consultas</h2>
            {consultas && consultas.proximas.length > 0 ? (
              consultas.proximas.map((consulta) => (
                <CartaoConsulta
                  key={consulta.id}
                  consulta={consulta}
                  permitirCancelamento
                  antecedenciaCancelamentoHoras={consultas.antecedenciaCancelamentoHoras}
                  onAlterada={carregar}
                />
              ))
            ) : (
              <Card className="text-center">
                <Card.Body>
                  <div className="pmc-icone pmc-icone--salvia mx-auto mb-3">
                    <i className="bi bi-calendar-heart" />
                  </div>
                  <p className="pmc-texto-2 mb-3">Você ainda não tem consultas marcadas.</p>
                  <Link href="/agendamento">
                    <Button variant="primary">Agendar consulta</Button>
                  </Link>
                </Card.Body>
              </Card>
            )}
          </section>

          <section>
            <h2 className="h5 mb-3">Histórico</h2>
            {consultas && consultas.historico.length > 0 ? (
              <Table responsive className="pmc-tabela">
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Modalidade</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {consultas.historico.map((consulta) => (
                    <tr key={consulta.id}>
                      <td>
                        {formatarData(consulta.inicio, { day: '2-digit', month: '2-digit', year: 'numeric' })}{' '}
                        às {formatarHora(consulta.inicio)}
                      </td>
                      <td>{consulta.modalidade === 'online' ? 'Online' : 'Presencial'}</td>
                      <td>{STATUS_LABEL[consulta.status]}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            ) : (
              <p className="pmc-texto-2 mb-0">Nenhuma consulta anterior por aqui ainda.</p>
            )}
          </section>
        </>
      )}
    </LayoutPaciente>
  );
}
