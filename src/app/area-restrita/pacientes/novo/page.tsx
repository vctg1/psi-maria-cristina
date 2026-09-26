'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Card from 'react-bootstrap/Card';
import Alert from 'react-bootstrap/Alert';
import Modal from 'react-bootstrap/Modal';
import Button from 'react-bootstrap/Button';
import Form from 'react-bootstrap/Form';
import LayoutPsicologa from '@/components/area-restrita/LayoutPsicologa';
import PacienteForm, { type PacienteFormValores } from '@/components/area-restrita/PacienteForm';
import type { PacienteDetalhe } from '@/types/paciente';
import { useNotificacao } from '@/components/NotificacaoProvider';

function apenasDigitos(valor: string): string {
  return valor.replace(/\D/g, '');
}

function telefoneComDdi(telefone: string): string {
  const digitos = apenasDigitos(telefone);
  return digitos.startsWith('55') ? digitos : `55${digitos}`;
}

export default function NovoPacientePage() {
  const router = useRouter();
  const { mostrarNotificacao } = useNotificacao();
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [errosServidor, setErrosServidor] = useState<Record<string, string> | undefined>(undefined);
  const [pacienteCriado, setPacienteCriado] = useState<PacienteDetalhe | null>(null);
  const [linkGerado, setLinkGerado] = useState<string | null>(null);
  const [emailEnviado, setEmailEnviado] = useState(false);
  const [gerandoLink, setGerandoLink] = useState(false);
  const [enviarPorEmail, setEnviarPorEmail] = useState(true);

  const handleSubmit = async (dados: PacienteFormValores) => {
    setEnviando(true);
    setErro(null);
    setErrosServidor(undefined);
    try {
      const response = await fetch('/api/pacientes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dados),
      });
      const resultado = await response.json().catch(() => null);
      if (!response.ok) {
        if (response.status === 400 && resultado?.campos) {
          setErrosServidor(resultado.campos);
        }
        setErro(resultado?.error ?? 'Não foi possível cadastrar o paciente.');
        return;
      }
      setPacienteCriado(resultado as PacienteDetalhe);
      mostrarNotificacao({ tipo: 'sucesso', titulo: 'Paciente cadastrado' });
    } catch {
      setErro('Não foi possível cadastrar o paciente.');
    } finally {
      setEnviando(false);
    }
  };

  const gerarLink = async () => {
    if (!pacienteCriado) return;
    setGerandoLink(true);
    try {
      const response = await fetch('/api/auth/token-acesso', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          usuarioId: pacienteCriado.usuarioId,
          finalidade: 'primeiro_acesso',
          enviarPorEmail: !!pacienteCriado.email && enviarPorEmail,
        }),
      });
      const dados = await response.json().catch(() => null);
      if (!response.ok) {
        mostrarNotificacao({
          tipo: 'erro',
          titulo: 'Erro',
          mensagem: dados?.error ?? 'Não foi possível gerar o link.',
        });
        return;
      }
      setLinkGerado(dados.link);
      setEmailEnviado(!!dados.emailEnviado);
    } catch {
      mostrarNotificacao({ tipo: 'erro', titulo: 'Erro', mensagem: 'Não foi possível gerar o link.' });
    } finally {
      setGerandoLink(false);
    }
  };

  const enviarWhatsapp = () => {
    if (!pacienteCriado || !linkGerado) return;
    const mensagem = `Olá ${pacienteCriado.nome}, aqui é a Psicóloga Maria Cristina. Seu link de acesso à área do paciente: ${linkGerado} (válido por 7 dias)`;
    window.open(
      `https://wa.me/${telefoneComDdi(pacienteCriado.telefone)}?text=${encodeURIComponent(mensagem)}`,
      '_blank'
    );
  };

  return (
    <LayoutPsicologa>
      <div className="mb-4">
        <span className="pmc-rotulo">Área da psicóloga</span>
        <h1 className="h3 mb-0 mt-1">Novo paciente</h1>
      </div>
      {erro && <Alert variant="danger">{erro}</Alert>}
      <Card>
        <Card.Body>
          <PacienteForm
            modo="cadastro"
            mostrarObservacoes
            onSubmit={handleSubmit}
            errosServidor={errosServidor}
            enviando={enviando}
          />
        </Card.Body>
      </Card>

      <Modal show={pacienteCriado !== null} onHide={() => router.push('/area-restrita/pacientes')} centered>
        <Modal.Header closeButton>
          <Modal.Title>Paciente cadastrado</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>{pacienteCriado?.nome} foi cadastrado(a) com sucesso.</p>
          {pacienteCriado && !pacienteCriado.temLogin && (
            <p className="pmc-texto-2 mb-0">
              Este paciente foi cadastrado sem e-mail, portanto sem acesso ao site. Você pode criar o acesso
              depois, na página do paciente.
            </p>
          )}
          {!linkGerado && pacienteCriado?.temLogin && pacienteCriado.email && (
            <Form.Check
              type="checkbox"
              id="novo-paciente-enviar-por-email"
              className="mb-3"
              label="Enviar também por e-mail"
              checked={enviarPorEmail}
              onChange={(e) => setEnviarPorEmail(e.target.checked)}
            />
          )}
          {linkGerado && <p className="text-break">{linkGerado}</p>}
          {linkGerado && emailEnviado && pacienteCriado?.email && (
            <p className="pmc-texto-2 pmc-t-sm mb-0">E-mail enviado para {pacienteCriado.email}.</p>
          )}
        </Modal.Body>
        <Modal.Footer>
          {!linkGerado && pacienteCriado?.temLogin ? (
            <Button variant="primary" disabled={gerandoLink} onClick={gerarLink}>
              {gerandoLink ? 'Gerando...' : 'Gerar link de primeiro acesso'}
            </Button>
          ) : linkGerado ? (
            <Button variant="primary" onClick={enviarWhatsapp}>
              <i className="bi bi-whatsapp me-2" />
              Enviar por WhatsApp
            </Button>
          ) : null}
          <Button variant="outline-secondary" onClick={() => router.push('/area-restrita/pacientes')}>
            Ir para a lista
          </Button>
        </Modal.Footer>
      </Modal>
    </LayoutPsicologa>
  );
}
