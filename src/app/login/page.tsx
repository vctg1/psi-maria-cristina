'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
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
  return usuario.papel === 'psicologa' ? '/area-restrita/agenda' : '/area-paciente';
}

// O `next` só é honrado se for uma rota do próprio papel. Sem isso, um `next=/area-restrita/...`
// deixado pelo logout da psicóloga mandava o paciente recém-logado para a área dela, cujo guard
// devolvia ao /login com o mesmo `next` — loop infinito de redirecionamentos.
function nextCabeNoPapel(next: string, usuario: Usuario): boolean {
  const areaDoPapel = usuario.papel === 'psicologa' ? '/area-restrita' : '/area-paciente';
  const areaDoOutro = usuario.papel === 'psicologa' ? '/area-paciente' : '/area-restrita';
  if (next === areaDoOutro || next.startsWith(areaDoOutro + '/')) return false;
  return next === areaDoPapel || next.startsWith(areaDoPapel + '/') || !next.startsWith('/area-');
}

function destinoFinal(next: string | null, usuario: Usuario): string {
  const seguro = destinoSeguro(next);
  if (seguro === '/area-restrita' && usuario.papel === 'psicologa') return '/area-restrita/agenda';
  return seguro && nextCabeNoPapel(seguro, usuario) ? seguro : destinoPorPapel(usuario);
}

export default function LoginPage() {
  const { usuario, carregando } = useAuth();
  const redirecionando = useRef(false);

  useEffect(() => {
    if (carregando || !usuario || redirecionando.current) return;
    redirecionando.current = true;
    const next = new URLSearchParams(window.location.search).get('next');
    window.location.replace(destinoFinal(next, usuario));
  }, [carregando, usuario]);

  const handleSucesso = (usuarioLogado: Usuario) => {
    if (redirecionando.current) return;
    redirecionando.current = true;
    const next = new URLSearchParams(window.location.search).get('next');
    window.location.replace(destinoFinal(next, usuarioLogado));
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
