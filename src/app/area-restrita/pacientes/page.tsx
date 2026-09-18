'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Table from 'react-bootstrap/Table';
import Form from 'react-bootstrap/Form';
import Button from 'react-bootstrap/Button';
import Badge from 'react-bootstrap/Badge';
import Spinner from 'react-bootstrap/Spinner';
import Alert from 'react-bootstrap/Alert';
import Modal from 'react-bootstrap/Modal';
import InputGroup from 'react-bootstrap/InputGroup';
import LayoutPsicologa from '@/components/area-restrita/LayoutPsicologa';
import type { PacienteResumo } from '@/types/paciente';
import { useNotificacao } from '@/components/NotificacaoProvider';

function apenasDigitos(valor: string): string {
  return valor.replace(/\D/g, '');
}

function telefoneComDdi(telefone: string): string {
  const digitos = apenasDigitos(telefone);
  return digitos.startsWith('55') ? digitos : `55${digitos}`;
}

type ModalLink = { nome: string; telefone: string; link: string };

export default function ListaPacientesPage() {
  const router = useRouter();
  const { mostrarNotificacao } = useNotificacao();
  const [pacientes, setPacientes] = useState<PacienteResumo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const [modalLink, setModalLink] = useState<ModalLink | null>(null);
  const [gerandoLinkId, setGerandoLinkId] = useState<string | null>(null);

  const carregar = useCallback(async (q: string) => {
    setCarregando(true);
    setErro(null);
    try {
      const params = new URLSearchParams();
      if (q) params.set('q', q);
      const response = await fetch(`/api/pacientes?${params.toString()}`);
      const dados = await response.json().catch(() => null);
      if (!response.ok) {
        setErro((dados && dados.error) || 'Não foi possível carregar os pacientes.');
        setPacientes([]);
        return;
      }
      setPacientes(dados as PacienteResumo[]);
    } catch {
      setErro('Não foi possível carregar os pacientes.');
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    const handler = setTimeout(() => {
      carregar(busca);
    }, 300);
    return () => clearTimeout(handler);
  }, [busca, carregar]);

  const gerarLink = async (paciente: PacienteResumo) => {
    setGerandoLinkId(paciente.id);
    try {
      const response = await fetch('/api/auth/token-acesso', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usuarioId: paciente.usuarioId, finalidade: 'primeiro_acesso' }),
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
      setModalLink({ nome: paciente.nome, telefone: paciente.telefone, link: dados.link });
    } catch {
      mostrarNotificacao({ tipo: 'erro', titulo: 'Erro', mensagem: 'Não foi possível gerar o link.' });
    } finally {
      setGerandoLinkId(null);
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
    if (!modalLink) return;
    const mensagem = `Olá ${modalLink.nome}, aqui é a Psicóloga Maria Cristina. Seu link de acesso à área do paciente: ${modalLink.link} (válido por 7 dias)`;
    window.open(`https://wa.me/${telefoneComDdi(modalLink.telefone)}?text=${encodeURIComponent(mensagem)}`, '_blank');
  };

  return (
    <LayoutPsicologa>
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-4">
        <h1 className="h3 mb-0">Pacientes</h1>
        <Button variant="primary" onClick={() => router.push('/area-restrita/pacientes/novo')}>
          <i className="bi bi-plus-lg me-2" />
          Novo paciente
        </Button>
      </div>

      <InputGroup className="mb-3">
        <InputGroup.Text>
          <i className="bi bi-search" />
        </InputGroup.Text>
        <Form.Control
          placeholder="Buscar por nome ou e-mail"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
      </InputGroup>

      {erro && <Alert variant="danger">{erro}</Alert>}

      {carregando ? (
        <div className="text-center py-5">
          <Spinner animation="border" role="status" />
        </div>
      ) : (
        <Table responsive hover>
          <thead>
            <tr>
              <th>Nome</th>
              <th>Telefone</th>
              <th>E-mail</th>
              <th>Status</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {pacientes.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center text-muted py-4">
                  Nenhum paciente encontrado.
                </td>
              </tr>
            )}
            {pacientes.map((paciente) => (
              <tr
                key={paciente.id}
                onClick={() => router.push(`/area-restrita/pacientes/${paciente.id}`)}
                style={{ cursor: 'pointer' }}
              >
                <td>{paciente.nome}</td>
                <td>{paciente.telefone}</td>
                <td>{paciente.email}</td>
                <td>
                  {paciente.primeiroAcessoPendente && (
                    <Badge bg="warning" text="dark">
                      Primeiro acesso pendente
                    </Badge>
                  )}
                  {!paciente.ativo && (
                    <Badge bg="secondary" className="ms-1">
                      Inativo
                    </Badge>
                  )}
                </td>
                <td onClick={(e) => e.stopPropagation()}>
                  {paciente.primeiroAcessoPendente && (
                    <Button
                      size="sm"
                      variant="outline-primary"
                      disabled={gerandoLinkId === paciente.id}
                      onClick={() => gerarLink(paciente)}
                    >
                      {gerandoLinkId === paciente.id ? (
                        <Spinner animation="border" size="sm" />
                      ) : (
                        'Gerar link de acesso'
                      )}
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}

      <Modal show={modalLink !== null} onHide={() => setModalLink(null)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Link de acesso</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="text-break mb-0">{modalLink?.link}</p>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={copiarLink}>
            Copiar
          </Button>
          <Button variant="success" onClick={enviarWhatsapp}>
            <i className="bi bi-whatsapp me-2" />
            Enviar por WhatsApp
          </Button>
        </Modal.Footer>
      </Modal>
    </LayoutPsicologa>
  );
}
