'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Card from 'react-bootstrap/Card';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import Spinner from 'react-bootstrap/Spinner';
import Alert from 'react-bootstrap/Alert';
import Button from 'react-bootstrap/Button';
import Form from 'react-bootstrap/Form';
import Modal from 'react-bootstrap/Modal';
import LayoutPsicologa from '@/components/area-restrita/LayoutPsicologa';
import PacienteForm, { type PacienteFormValores } from '@/components/area-restrita/PacienteForm';
import PainelDocumentos from '@/components/area-restrita/documentos/PainelDocumentos';
import type { PacienteDetalhe, PacienteEdicao } from '@/types/paciente';
import { useNotificacao } from '@/components/NotificacaoProvider';

function apenasDigitos(valor: string): string {
  return valor.replace(/\D/g, '');
}

function telefoneComDdi(telefone: string): string {
  const digitos = apenasDigitos(telefone);
  return digitos.startsWith('55') ? digitos : `55${digitos}`;
}

type ModalLink = { link: string; finalidade: 'primeiro_acesso'; emailEnviado: boolean };

export default function DetalhePacientePage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const router = useRouter();
  const { mostrarNotificacao } = useNotificacao();

  const [paciente, setPaciente] = useState<PacienteDetalhe | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [errosServidor, setErrosServidor] = useState<Record<string, string> | undefined>(undefined);
  const [erroFormulario, setErroFormulario] = useState<string | null>(null);
  const [modalLink, setModalLink] = useState<ModalLink | null>(null);
  const [gerandoLink, setGerandoLink] = useState(false);
  const [alterandoAtivo, setAlterandoAtivo] = useState(false);
  const [emailAcesso, setEmailAcesso] = useState('');
  const [criandoAcesso, setCriandoAcesso] = useState(false);
  const [erroAcesso, setErroAcesso] = useState<string | null>(null);
  const [enviarPorEmail, setEnviarPorEmail] = useState(true);

  const carregar = useCallback(async () => {
    if (!id) return;
    setCarregando(true);
    setErro(null);
    try {
      const response = await fetch(`/api/pacientes/${id}`);
      const dados = await response.json().catch(() => null);
      if (!response.ok) {
        setErro(dados?.error ?? 'Não foi possível carregar o paciente.');
        return;
      }
      setPaciente(dados as PacienteDetalhe);
    } catch {
      setErro('Não foi possível carregar o paciente.');
    } finally {
      setCarregando(false);
    }
  }, [id]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const gerarLink = async () => {
    if (!paciente) return;
    setGerandoLink(true);
    try {
      const response = await fetch('/api/auth/token-acesso', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          usuarioId: paciente.usuarioId,
          finalidade: 'primeiro_acesso',
          enviarPorEmail: !!paciente.email && enviarPorEmail,
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
      setModalLink({ link: dados.link, finalidade: 'primeiro_acesso', emailEnviado: !!dados.emailEnviado });
    } catch {
      mostrarNotificacao({ tipo: 'erro', titulo: 'Erro', mensagem: 'Não foi possível gerar o link.' });
    } finally {
      setGerandoLink(false);
    }
  };

  const copiarLink = async () => {
    if (!modalLink) return;
    try {
      await navigator.clipboard.writeText(modalLink.link);
      mostrarNotificacao({ tipo: 'sucesso', titulo: 'Link copiado' });
    } catch {
      mostrarNotificacao({ tipo: 'erro', titulo: 'Não foi possível copiar o link' });
    }
  };

  const enviarWhatsapp = () => {
    if (!modalLink || !paciente) return;
    const mensagem = `Olá ${paciente.nome}, aqui é a Psicóloga Maria Cristina. Seu link de acesso à área do paciente: ${modalLink.link} (válido por 7 dias)`;
    window.open(`https://wa.me/${telefoneComDdi(paciente.telefone)}?text=${encodeURIComponent(mensagem)}`, '_blank');
  };

  const alternarAtivo = async () => {
    if (!paciente) return;
    setAlterandoAtivo(true);
    try {
      const response = await fetch(`/api/pacientes/${paciente.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ativo: !paciente.ativo }),
      });
      const dados = await response.json().catch(() => null);
      if (!response.ok) {
        mostrarNotificacao({
          tipo: 'erro',
          titulo: 'Erro',
          mensagem: dados?.error ?? 'Não foi possível atualizar o status.',
        });
        return;
      }
      setPaciente(dados as PacienteDetalhe);
      mostrarNotificacao({ tipo: 'sucesso', titulo: 'Status atualizado' });
    } catch {
      mostrarNotificacao({ tipo: 'erro', titulo: 'Erro', mensagem: 'Não foi possível atualizar o status.' });
    } finally {
      setAlterandoAtivo(false);
    }
  };

  const criarAcesso = async () => {
    if (!paciente) return;
    setCriandoAcesso(true);
    setErroAcesso(null);
    try {
      const response = await fetch(`/api/pacientes/${paciente.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailAcesso.trim() }),
      });
      const resultado = await response.json().catch(() => null);
      if (!response.ok) {
        setErroAcesso(resultado?.error ?? 'Não foi possível criar o acesso.');
        return;
      }
      setPaciente(resultado as PacienteDetalhe);
      setEmailAcesso('');
      mostrarNotificacao({ tipo: 'sucesso', titulo: 'Acesso criado' });
    } catch {
      setErroAcesso('Não foi possível criar o acesso.');
    } finally {
      setCriandoAcesso(false);
    }
  };

  const handleSubmitEdicao = async (dados: PacienteFormValores) => {
    if (!paciente) return;
    setEnviando(true);
    setErroFormulario(null);
    setErrosServidor(undefined);
    try {
      const alterados: PacienteEdicao = {};
      if (dados.nome !== paciente.nome) alterados.nome = dados.nome;
      if (paciente.temLogin && (dados.email ?? undefined) !== (paciente.email ?? undefined)) {
        alterados.email = dados.email ?? undefined;
      }
      if (dados.telefone !== paciente.telefone) alterados.telefone = dados.telefone;
      if (dados.dataNascimento !== paciente.dataNascimento) alterados.dataNascimento = dados.dataNascimento;
      if ((dados.cpf ?? null) !== (paciente.cpf ?? null)) alterados.cpf = dados.cpf ?? null;
      if ((dados.responsavel ?? null) !== (paciente.responsavel ?? null)) alterados.responsavel = dados.responsavel ?? null;
      if ((dados.telefoneResponsavel ?? null) !== (paciente.telefoneResponsavel ?? null)) {
        alterados.telefoneResponsavel = dados.telefoneResponsavel ?? null;
      }
      if ((dados.observacoesCadastro ?? null) !== (paciente.observacoesCadastro ?? null)) {
        alterados.observacoesCadastro = dados.observacoesCadastro ?? null;
      }

      if (Object.keys(alterados).length === 0) {
        mostrarNotificacao({ tipo: 'info', titulo: 'Nada para salvar' });
        return;
      }

      const response = await fetch(`/api/pacientes/${paciente.id}`, {
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
      setPaciente(resultado as PacienteDetalhe);
      mostrarNotificacao({ tipo: 'sucesso', titulo: 'Paciente atualizado' });
    } catch {
      setErroFormulario('Não foi possível salvar as alterações.');
    } finally {
      setEnviando(false);
    }
  };

  if (carregando) {
    return (
      <LayoutPsicologa>
        <div className="text-center py-5">
          <Spinner animation="border" role="status" />
        </div>
      </LayoutPsicologa>
    );
  }

  if (erro || !paciente) {
    return (
      <LayoutPsicologa>
        <Alert variant="danger">{erro ?? 'Paciente não encontrado.'}</Alert>
        <Button variant="outline-secondary" onClick={() => router.push('/area-restrita/pacientes')}>
          Voltar para a lista
        </Button>
      </LayoutPsicologa>
    );
  }

  return (
    <LayoutPsicologa>
      <div className="d-flex justify-content-between align-items-end flex-wrap gap-3 mb-4">
        <div>
          <span className="pmc-rotulo">Área da psicóloga</span>
          <h1 className="h3 mb-1 mt-1">{paciente.nome}</h1>
          <div>
            {!paciente.temLogin && <span className="pmc-badge-neutro me-2">Sem acesso</span>}
            {paciente.temLogin && paciente.primeiroAcessoPendente && (
              <span className="pmc-badge-aviso me-2">Primeiro acesso pendente</span>
            )}
            {paciente.temLogin && (
              <span className={paciente.ativo ? 'pmc-badge-ok' : 'pmc-badge-neutro'}>
                {paciente.ativo ? 'Ativo' : 'Inativo'}
              </span>
            )}
          </div>
        </div>
        {paciente.temLogin && (
          <div className="d-flex align-items-center gap-3 flex-wrap">
            {paciente.primeiroAcessoPendente ? (
              <div className="d-flex flex-column gap-1">
                <Button
                  id="botao-gerar-link-primeiro-acesso"
                  variant="outline-primary"
                  disabled={gerandoLink}
                  onClick={gerarLink}
                >
                  Gerar/reenviar link de primeiro acesso
                </Button>
                {paciente.email && (
                  <Form.Check
                    type="checkbox"
                    id="paciente-enviar-por-email"
                    label="Enviar também por e-mail"
                    checked={enviarPorEmail}
                    onChange={(e) => setEnviarPorEmail(e.target.checked)}
                  />
                )}
              </div>
            ) : (
              <p className="pmc-texto-2 pmc-t-sm mb-0">
                Se o paciente esquecer a senha, ele mesmo pode redefinir em &ldquo;Esqueci minha senha&rdquo; na tela de
                login.
              </p>
            )}
            <Form.Check
              type="switch"
              id="paciente-ativo"
              label="Ativo"
              checked={paciente.ativo}
              disabled={alterandoAtivo}
              onChange={alternarAtivo}
            />
          </div>
        )}
      </div>

      <Card className="mb-4">
        <Card.Body>
          <span className="pmc-rotulo d-block mb-3">Dados de contato</span>
          <Row>
            <Col md={4}>
              <strong>CPF:</strong> {paciente.cpf ?? 'Não informado'}
            </Col>
            <Col md={4}>
              <strong>E-mail:</strong> {paciente.email ?? '—'}
            </Col>
            <Col md={4}>
              <strong>Telefone:</strong> {paciente.telefone}
            </Col>
          </Row>
        </Card.Body>
      </Card>

      <PainelDocumentos pacienteId={paciente.id} />

      {!paciente.temLogin && (
        <Card className="mb-4 card--areia">
          <Card.Body>
            <span className="pmc-rotulo d-block mb-2">Acesso ao site</span>
            <h2 className="h5">Este paciente não tem acesso ao site</h2>
            <p className="pmc-texto-2">
              A agenda deste paciente continua sendo gerida por você. Para dar acesso, informe um e-mail.
            </p>
            {erroAcesso && <Alert variant="danger">{erroAcesso}</Alert>}
            <Row className="align-items-end g-2">
              <Col md={8}>
                <Form.Group controlId="pacienteEmailAcesso">
                  <Form.Label>E-mail</Form.Label>
                  <Form.Control
                    type="email"
                    value={emailAcesso}
                    onChange={(e) => setEmailAcesso(e.target.value)}
                  />
                </Form.Group>
              </Col>
              <Col md={4}>
                <Button variant="primary" disabled={criandoAcesso || !emailAcesso.trim()} onClick={criarAcesso}>
                  {criandoAcesso ? 'Criando...' : 'Criar acesso'}
                </Button>
              </Col>
            </Row>
          </Card.Body>
        </Card>
      )}

      <Card>
        <Card.Body>
          {erroFormulario && <Alert variant="danger">{erroFormulario}</Alert>}
          <PacienteForm
            modo="edicao"
            mostrarObservacoes
            valorInicial={paciente}
            onSubmit={handleSubmitEdicao}
            errosServidor={errosServidor}
            enviando={enviando}
          />
        </Card.Body>
      </Card>

      <Modal show={modalLink !== null} onHide={() => setModalLink(null)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Link gerado</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form.Control readOnly value={modalLink?.link ?? ''} />
          {modalLink?.emailEnviado && paciente.email && (
            <p className="pmc-texto-2 pmc-t-sm mt-2 mb-0">E-mail enviado para {paciente.email}.</p>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={copiarLink}>
            Copiar
          </Button>
          <Button variant="primary" onClick={enviarWhatsapp}>
            <i className="bi bi-whatsapp me-2" />
            Enviar por WhatsApp
          </Button>
        </Modal.Footer>
      </Modal>
    </LayoutPsicologa>
  );
}
