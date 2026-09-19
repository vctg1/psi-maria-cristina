'use client';

import { useCallback, useEffect, useState } from 'react';
import Card from 'react-bootstrap/Card';
import Spinner from 'react-bootstrap/Spinner';
import Alert from 'react-bootstrap/Alert';
import LayoutPaciente from '@/components/area-paciente/LayoutPaciente';
import PacienteForm, { type PacienteFormValores } from '@/components/area-restrita/PacienteForm';
import type { PacienteMeDto } from '@/types/paciente';
import { useNotificacao } from '@/components/NotificacaoProvider';

type EdicaoPaciente = {
  nome?: string;
  telefone?: string;
  dataNascimento?: string | null;
  cpf?: string | null;
  responsavel?: string | null;
  telefoneResponsavel?: string | null;
};

export default function DadosPacientePage() {
  const { mostrarNotificacao } = useNotificacao();
  const [paciente, setPaciente] = useState<PacienteMeDto | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erroFormulario, setErroFormulario] = useState<string | null>(null);
  const [errosServidor, setErrosServidor] = useState<Record<string, string> | undefined>(undefined);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const response = await fetch('/api/paciente/me');
      const dados = await response.json().catch(() => null);
      if (!response.ok) {
        setErro(dados?.error ?? 'Não foi possível carregar seus dados.');
        return;
      }
      setPaciente(dados as PacienteMeDto);
    } catch {
      setErro('Não foi possível carregar seus dados.');
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const handleSubmit = async (dados: PacienteFormValores) => {
    if (!paciente) return;
    setEnviando(true);
    setErroFormulario(null);
    setErrosServidor(undefined);
    try {
      const alterados: EdicaoPaciente = {};
      if (dados.nome !== paciente.nome) alterados.nome = dados.nome;
      if (dados.telefone !== paciente.telefone) alterados.telefone = dados.telefone;
      if ((dados.dataNascimento ?? null) !== (paciente.dataNascimento ?? null)) {
        alterados.dataNascimento = dados.dataNascimento ?? null;
      }
      if ((dados.cpf ?? null) !== (paciente.cpf ?? null)) alterados.cpf = dados.cpf ?? null;
      if ((dados.responsavel ?? null) !== (paciente.responsavel ?? null)) {
        alterados.responsavel = dados.responsavel ?? null;
      }
      if ((dados.telefoneResponsavel ?? null) !== (paciente.telefoneResponsavel ?? null)) {
        alterados.telefoneResponsavel = dados.telefoneResponsavel ?? null;
      }

      if (Object.keys(alterados).length === 0) {
        mostrarNotificacao({ tipo: 'info', titulo: 'Nada para salvar' });
        return;
      }

      const response = await fetch('/api/paciente/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(alterados),
      });
      const resultado = await response.json().catch(() => null);
      if (!response.ok) {
        if (response.status === 400 && resultado?.campos) {
          setErrosServidor(resultado.campos);
        }
        setErroFormulario(resultado?.error ?? 'Não foi possível salvar as alterações.');
        return;
      }
      setPaciente(resultado as PacienteMeDto);
      mostrarNotificacao({ tipo: 'sucesso', titulo: 'Dados atualizados' });
    } catch {
      setErroFormulario('Não foi possível salvar as alterações.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <LayoutPaciente>
      <span className="pmc-rotulo d-block mb-1">Sua área</span>
      <h1 className="h3 mb-4">Meus dados</h1>

      {carregando ? (
        <div className="text-center py-5">
          <Spinner animation="border" role="status" />
        </div>
      ) : erro ? (
        <Alert variant="danger">{erro}</Alert>
      ) : paciente ? (
        <Card>
          <Card.Body>
            {paciente.email && (
              <p className="pmc-texto-2 mb-4">
                E-mail de acesso: <strong>{paciente.email}</strong> — para alterar, fale com a psicóloga.
              </p>
            )}
            {erroFormulario && <Alert variant="danger">{erroFormulario}</Alert>}
            <PacienteForm
              modo="edicao"
              valorInicial={paciente}
              camposObrigatorios={{ email: false, dataNascimento: false }}
              onSubmit={handleSubmit}
              errosServidor={errosServidor}
              enviando={enviando}
            />
          </Card.Body>
        </Card>
      ) : null}
    </LayoutPaciente>
  );
}
