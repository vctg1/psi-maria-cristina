'use client';

import Image from 'next/image';
import Link from 'next/link';
import Button from 'react-bootstrap/Button';
import Container from 'react-bootstrap/Container';
import Navbar from 'react-bootstrap/Navbar';
import Nav from 'react-bootstrap/Nav';
import Offcanvas from 'react-bootstrap/Offcanvas';
import { useAuth } from '@/contexts/AuthContext';

export default function SiteHeader() {
  const { usuario, logout } = useAuth();

  return (
    <Navbar expand="md" className="pmc-header" as="header">
      <Container className="pmc-container">
        <Navbar.Brand as={Link} href="/">
          <Image
            src="/maria-cristina-logo.png?v=original-20260926"
            alt="Psicóloga Maria Cristina"
            width={80}
            height={100}
            style={{ objectFit: 'contain' }}
            priority
          />
          <span className="pmc-logo-crp">CRP 01/29977</span>
        </Navbar.Brand>
        <Navbar.Toggle aria-controls="navbar-principal" aria-label="Abrir menu" />
        <Navbar.Offcanvas
          id="navbar-principal"
          aria-labelledby="navbar-principal-titulo"
          placement="end"
          className="pmc-menu-lateral"
        >
          <Offcanvas.Header closeButton closeLabel="Fechar menu">
            <Offcanvas.Title id="navbar-principal-titulo" className="pmc-rotulo">
              Menu
            </Offcanvas.Title>
          </Offcanvas.Header>
          <Offcanvas.Body className="justify-content-md-end">
            <Nav className="align-items-md-center gap-2">
              <Link href="/agendamento" className="d-grid text-decoration-none">
                <Button variant="primary">Agendar consulta</Button>
              </Link>
              <Link
                href={usuario?.papel === 'paciente' ? '/area-paciente' : '/area-restrita'}
                target="_blank"
                rel="noopener noreferrer"
                className="d-grid text-decoration-none"
              >
                <Button variant="outline-secondary">
                  <i className="bi bi-person-lock me-2" />
                  {usuario ? 'Minha área' : 'Área restrita'}
                </Button>
              </Link>
              {usuario && (
                <Button variant="outline-secondary" onClick={() => logout()}>
                  Sair
                </Button>
              )}
            </Nav>
          </Offcanvas.Body>
        </Navbar.Offcanvas>
      </Container>
    </Navbar>
  );
}
