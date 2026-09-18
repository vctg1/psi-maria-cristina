'use client';

import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import Navbar from 'react-bootstrap/Navbar';
import Nav from 'react-bootstrap/Nav';
import Container from 'react-bootstrap/Container';
import Spinner from 'react-bootstrap/Spinner';
import { useAuth } from '@/contexts/AuthContext';

type LayoutPsicologaProps = {
  children: ReactNode;
};

export default function LayoutPsicologa({ children }: LayoutPsicologaProps) {
  const { usuario, carregando, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (carregando) return;
    if (!usuario || usuario.papel !== 'psicologa') {
      router.replace('/login?next=/area-restrita/pacientes');
    }
  }, [carregando, usuario, router]);

  if (carregando || !usuario || usuario.papel !== 'psicologa') {
    return (
      <Container className="py-5 text-center">
        <Spinner animation="border" role="status" />
      </Container>
    );
  }

  return (
    <>
      <Navbar bg="white" expand="md" className="shadow-sm mb-4">
        <Container>
          <Navbar.Brand as={Link} href="/area-restrita/pacientes">
            <Image
              src="/maria-cristina-logo.png"
              alt="Psicóloga Maria Cristina"
              width={120}
              height={40}
              style={{ objectFit: 'contain' }}
            />
          </Navbar.Brand>
          <Navbar.Toggle aria-controls="navbar-psicologa" />
          <Navbar.Collapse id="navbar-psicologa">
            <Nav className="me-auto">
              <Nav.Link as={Link} href="/area-restrita/pacientes">
                Pacientes
              </Nav.Link>
            </Nav>
            <Nav>
              <Nav.Link onClick={() => logout()}>Sair</Nav.Link>
            </Nav>
          </Navbar.Collapse>
        </Container>
      </Navbar>
      <Container className="pb-5">{children}</Container>
    </>
  );
}
