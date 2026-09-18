'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import Container from 'react-bootstrap/Container';
import Card from 'react-bootstrap/Card';
import Spinner from 'react-bootstrap/Spinner';
import Button from 'react-bootstrap/Button';
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
    <div className="pmc-auth">
      <div className="pmc-mancha pmc-mancha--salvia" style={{ top: '-8%', left: '-10%', width: '46%', aspectRatio: 1 }} aria-hidden="true" />
      <div className="pmc-mancha" style={{ bottom: '-10%', right: '-8%', width: '40%', aspectRatio: 1 }} aria-hidden="true" />
      <Card className="pmc-auth-card pmc-acima">
        <Card.Body>
          <Image
            src="/maria-cristina-logo.png"
            alt="Psicóloga Maria Cristina"
            width={72}
            height={72}
            className="pmc-auth-logo mb-3"
            style={{ objectFit: 'contain' }}
          />
          <div className="text-center">
            <span className="pmc-rotulo">Área restrita</span>
            <h1 className="h3 mt-2">Bem-vinda de volta.</h1>
            <p className="mb-4 pmc-texto-2">
              Entre com seu e-mail e senha para acessar sua área.
            </p>
          </div>
          <LoginForm onSucesso={handleSucesso} />
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
