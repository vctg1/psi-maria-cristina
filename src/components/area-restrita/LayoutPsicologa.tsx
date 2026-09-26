'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import Navbar from 'react-bootstrap/Navbar';
import Nav from 'react-bootstrap/Nav';
import Badge from 'react-bootstrap/Badge';
import Button from 'react-bootstrap/Button';
import Container from 'react-bootstrap/Container';
import Spinner from 'react-bootstrap/Spinner';
import Offcanvas from 'react-bootstrap/Offcanvas';
import { useAuth } from '@/contexts/AuthContext';
import PainelAlertas from '@/components/area-restrita/alertas/PainelAlertas';
import type { AlertasResposta } from '@/types/alertas';

type LayoutPsicologaProps = {
  children: ReactNode;
};

export default function LayoutPsicologa({ children }: LayoutPsicologaProps) {
  const { usuario, carregando, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [totalAlertas, setTotalAlertas] = useState(0);
  const [painelAberto, setPainelAberto] = useState(false);

  useEffect(() => {
    if (carregando) return;
    if (!usuario) {
      router.replace(`/login?next=${encodeURIComponent(pathname || '/area-restrita/pacientes')}`);
      return;
    }
    // Logado com outro papel: manda para a área dele, nunca de volta ao /login (evita loop).
    if (usuario.papel !== 'psicologa') {
      router.replace('/area-paciente');
    }
  }, [carregando, usuario, router, pathname]);

  const carregarTotais = useCallback(async () => {
    if (!usuario || usuario.papel !== 'psicologa') return;
    try {
      const response = await fetch('/api/alertas');
      if (!response.ok) return;
      const dados = (await response.json()) as AlertasResposta;
      setTotalAlertas(dados.totais.cancelamentos + dados.totais.lembretes + dados.totais.novosAgendamentos);
    } catch {
      // silencioso: a badge só deixa de atualizar, sem impacto no resto da tela
    }
  }, [usuario]);

  useEffect(() => {
    carregarTotais();
    const intervalo = setInterval(carregarTotais, 60000);
    return () => clearInterval(intervalo);
  }, [carregarTotais]);

  if (carregando || !usuario || usuario.papel !== 'psicologa') {
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
          <Navbar.Brand as={Link} href="/area-restrita/agenda">
            <Image
              src="/maria-cristina-logo-crp.png"
              alt="Psicóloga Maria Cristina"
              width={80}
              height={100}
              style={{ objectFit: 'contain' }}
            />
            <span className="pmc-logo-crp">CRP 01/29977</span>
          </Navbar.Brand>
          <Navbar.Toggle aria-controls="navbar-psicologa" />
          <Navbar.Collapse id="navbar-psicologa">
            <Nav className="me-auto">
              <Nav.Link as={Link} href="/area-restrita/agenda" active={pathname?.startsWith('/area-restrita/agenda')}>
                Agenda
              </Nav.Link>
              <Nav.Link as={Link} href="/area-restrita/pacientes" active={pathname?.startsWith('/area-restrita/pacientes')}>
                Pacientes
              </Nav.Link>
              <Nav.Link
                as={Link}
                href="/area-restrita/disponibilidade"
                active={pathname?.startsWith('/area-restrita/disponibilidade')}
              >
                Disponibilidade
              </Nav.Link>
              <Nav.Link
                as={Link}
                href="/area-restrita/financeiro"
                active={pathname?.startsWith('/area-restrita/financeiro')}
              >
                Financeiro
              </Nav.Link>
              <Nav.Link
                as={Link}
                href="/area-restrita/configuracao"
                active={pathname?.startsWith('/area-restrita/configuracao')}
              >
                Configuração
              </Nav.Link>
              <Nav.Link
                as={Link}
                href="/area-restrita/perfil"
                active={pathname?.startsWith('/area-restrita/perfil')}
              >
                Perfil
              </Nav.Link>
            </Nav>
            <Nav className="align-items-md-center gap-2">
              <span className="pmc-sino">
                <Button
                  variant="link"
                  className="text-decoration-none p-1"
                  aria-label="Alertas"
                  onClick={() => setPainelAberto(true)}
                >
                  <i className="bi bi-bell fs-5" />
                </Button>
                {totalAlertas > 0 && <Badge className="pmc-badge-aviso">{totalAlertas}</Badge>}
              </span>
              <Link href="/area-restrita/perfil" className="text-decoration-none">
                <Badge bg="light" text="dark" className="align-self-center">
                  Psicóloga
                </Badge>
              </Link>
              <Button variant="outline-secondary" size="sm" onClick={() => logout()}>
                Sair
              </Button>
            </Nav>
          </Navbar.Collapse>
        </Container>
      </Navbar>
      <Container className="pmc-container pmc-area-conteudo">
        {children}
      </Container>

      <Offcanvas show={painelAberto} onHide={() => setPainelAberto(false)} placement="end">
        <Offcanvas.Header closeButton>
          <Offcanvas.Title>Alertas</Offcanvas.Title>
        </Offcanvas.Header>
        <Offcanvas.Body>
          {painelAberto && (
            <PainelAlertas
              modo="painel"
              aoFechar={() => setPainelAberto(false)}
              aoTotalMudar={setTotalAlertas}
            />
          )}
        </Offcanvas.Body>
      </Offcanvas>
    </>
  );
}
