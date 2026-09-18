'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Container from 'react-bootstrap/Container';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import Card from 'react-bootstrap/Card';
import Spinner from 'react-bootstrap/Spinner';
import LoginForm from '@/components/LoginForm';
import { useAuth, type Usuario } from '@/contexts/AuthContext';

function destinoSeguro(next: string | null): string | null {
  if (!next || /[\\]/.test(next)) return null;
  try {
    const u = new URL(next, window.location.origin);
    if (u.origin !== window.location.origin || !u.pathname.startsWith('/')) return null;
    return u.pathname + u.search;
  } catch {
    return null;
  }
}

function destinoPorPapel(usuario: Usuario): string {
  return usuario.papel === 'psicologa' ? '/area-restrita/pacientes' : '/area-restrita';
}

export default function LoginPage() {
  const router = useRouter();
  const { usuario, carregando } = useAuth();
  const [next, setNext] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setNext(params.get('next'));
  }, []);

  useEffect(() => {
    if (carregando || !usuario) return;
    router.replace(destinoSeguro(next) ?? destinoPorPapel(usuario));
  }, [carregando, usuario, next, router]);

  const handleSucesso = (usuarioLogado: Usuario) => {
    router.replace(destinoSeguro(next) ?? destinoPorPapel(usuarioLogado));
  };

  if (carregando || usuario) {
    return (
      <Container className="py-5 text-center">
        <Spinner animation="border" role="status" />
      </Container>
    );
  }

  return (
    <Container className="py-5">
      <Row className="justify-content-center">
        <Col xs={12} sm={10} md={6} lg={5}>
          <Card>
            <Card.Body>
              <Card.Title className="mb-4 text-center">Entrar</Card.Title>
              <LoginForm onSucesso={handleSucesso} />
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
}
