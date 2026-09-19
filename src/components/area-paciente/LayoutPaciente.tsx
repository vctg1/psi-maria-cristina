'use client';

import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import Navbar from 'react-bootstrap/Navbar';
import Nav from 'react-bootstrap/Nav';
import Button from 'react-bootstrap/Button';
import Container from 'react-bootstrap/Container';
import Spinner from 'react-bootstrap/Spinner';
import { useAuth } from '@/contexts/AuthContext';

type LayoutPacienteProps = {
  children: ReactNode;
};

export default function LayoutPaciente({ children }: LayoutPacienteProps) {
  const { usuario, carregando, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (carregando) return;
    if (!usuario) {
      router.replace('/login?next=/area-paciente');
      return;
    }
    if (usuario.papel === 'psicologa') {
      router.replace('/area-restrita/agenda');
    }
  }, [carregando, usuario, router]);

  if (carregando || !usuario || usuario.papel !== 'paciente') {
    return (
      <Container className="py-5 text-center">
        <Spinner animation="border" role="status" />
        <p className="pmc-texto-2 mt-3 mb-0">Carregando…</p>
      </Container>
    );
  }

  return (
    <>
      <Navbar expand="md" className="pmc-header mb-4" as="header">
        <Container className="pmc-container">
          <Navbar.Brand as={Link} href="/area-paciente">
            <Image
              src="/maria-cristina-logo.png"
              alt="Psicóloga Maria Cristina"
              width={120}
              height={40}
              style={{ objectFit: 'contain' }}
            />
          </Navbar.Brand>
          <Navbar.Toggle aria-controls="navbar-paciente" />
          <Navbar.Collapse id="navbar-paciente">
            <Nav className="me-auto">
              <Nav.Link as={Link} href="/area-paciente" active={pathname === '/area-paciente'}>
                Minhas consultas
              </Nav.Link>
              <Nav.Link
                as={Link}
                href="/area-paciente/dados"
                active={pathname?.startsWith('/area-paciente/dados')}
              >
                Meus dados
              </Nav.Link>
              <Nav.Link as={Link} href="/agendamento">
                Agendar
              </Nav.Link>
            </Nav>
            <Nav className="align-items-md-center gap-2">
              <Button variant="outline-secondary" size="sm" onClick={() => logout()}>
                Sair
              </Button>
            </Nav>
          </Navbar.Collapse>
        </Container>
      </Navbar>
      <Container className="pmc-container pmc-area-conteudo">{children}</Container>
    </>
  );
}
