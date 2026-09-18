'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Container from 'react-bootstrap/Container';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import Card from 'react-bootstrap/Card';
import Alert from 'react-bootstrap/Alert';
import DefinirSenhaForm from '@/components/DefinirSenhaForm';
import { useAuth } from '@/contexts/AuthContext';

export default function RedefinirSenhaPage() {
  const router = useRouter();
  const { recarregar } = useAuth();
  const [token, setToken] = useState<string | null>(null);
  const [prontoParaLer, setProntoParaLer] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    // StrictMode (dev) roda o efeito 2x: a 2a leitura ja ve a URL limpa — nunca sobrescrever um token ja lido com null.
    const t = new URLSearchParams(window.location.search).get('token');
    if (t) {
      setToken((prev) => prev ?? t);
      window.history.replaceState(null, '', window.location.pathname);
    }
    setProntoParaLer(true);
  }, []);

  const handleSubmit = async (senha: string) => {
    if (!token) return;
    setEnviando(true);
    setErro(null);
    try {
      const response = await fetch('/api/auth/redefinir-senha', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, senha }),
      });
      const dados = await response.json().catch(() => null);
      if (!response.ok) {
        setErro(dados?.error ?? 'Não foi possível concluir. Tente novamente.');
        return;
      }
      await recarregar();
      router.replace('/area-restrita');
    } catch {
      setErro('Não foi possível concluir. Tente novamente.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Container className="py-5">
      <Row className="justify-content-center">
        <Col xs={12} sm={10} md={6} lg={5}>
          <Card>
            <Card.Body>
              <Card.Title className="mb-4 text-center">Redefinir senha</Card.Title>
              {erro && <Alert variant="danger">{erro}</Alert>}
              {prontoParaLer && !token ? (
                <Alert variant="warning" className="mb-0">
                  Link inválido. Peça um novo link à psicóloga.
                </Alert>
              ) : (
                prontoParaLer && (
                  <DefinirSenhaForm onSubmit={handleSubmit} enviando={enviando} rotulo="Redefinir senha" />
                )
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
}
