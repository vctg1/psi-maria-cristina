'use client';

import Image from "next/image";
import Link from "next/link";
import Button from 'react-bootstrap/Button';
import Container from 'react-bootstrap/Container';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import Navbar from 'react-bootstrap/Navbar';
import Nav from 'react-bootstrap/Nav';
import Offcanvas from 'react-bootstrap/Offcanvas';
import { useAuth } from '@/contexts/AuthContext';

const especialidades = [
  'Terapia Cognitivo-Comportamental',
  'Psicoterapia Infantil',
  'Psicoterapia do Adolescente',
  'Terapia Familiar',
  'Transtornos de Ansiedade',
  'Depressão',
  'Dificuldades de Aprendizagem',
];

function OndaBaixo({ cor }: { cor: string }) {
  return (
    <div className="pmc-onda" aria-hidden="true">
      <svg viewBox="0 0 1440 64" preserveAspectRatio="none">
        <path
          d="M0,32 C240,64 480,0 720,16 C960,32 1200,64 1440,32 L1440,64 L0,64 Z"
          fill={cor}
        />
      </svg>
    </div>
  );
}

export default function Home() {
  const { usuario, logout } = useAuth();

  return (
    <div>
      {/* Header */}
      <Navbar expand="md" className="pmc-header" as="header">
        <Container className="pmc-container">
          <Navbar.Brand as={Link} href="/">
            <Image
              src="/maria-cristina-logo.png"
              alt="Psicóloga Maria Cristina"
              width={84}
              height={80}
              style={{ objectFit: 'contain' }}
              priority
            />
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
                <Link href={usuario?.papel === 'paciente' ? '/area-paciente' : '/area-restrita'} className="d-grid text-decoration-none">
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

      {/* Hero */}
      <section className="pmc-secao">
        <Container className="pmc-container">
          <Row className="align-items-center g-5">
            <Col md={7} className="order-2 order-md-1">
              <span className="pmc-rotulo">Psicologia clínica · Planaltina-DF e online</span>
              <h1 className="mt-3">Um lugar para respirar, entender e recomeçar.</h1>
              <p className="lead">
                Atendimento psicológico para crianças, adolescentes e adultos, com terapia
                cognitivo-comportamental e psicoterapia familiar — presencial em Planaltina-DF
                ou online, no seu tempo.
              </p>
              <div className="d-flex flex-wrap gap-3 mt-4">
                <Link href="/agendamento">
                  <Button variant="primary" size="lg">Agendar consulta</Button>
                </Link>
                <a
                  href="https://wa.me/5561995391540"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Falar com a psicóloga Maria Cristina pelo WhatsApp"
                >
                  <Button variant="outline-primary" size="lg">
                    <i className="bi bi-whatsapp me-2" />
                    Falar no WhatsApp
                  </Button>
                </a>
              </div>
            </Col>
            <Col md={5} className="order-1 order-md-2">
              <div className="position-relative">
                <div className="pmc-mancha pmc-mancha--salvia pmc-mancha--hero" />
                <div className="pmc-blob pmc-acima">
                  <Image
                    src="/CristinaLivro.jpeg"
                    alt="Psicóloga Maria Cristina sorrindo, segurando um livro"
                    width={480}
                    height={560}
                    style={{ width: '100%', height: 'auto' }}
                    priority
                  />
                </div>
              </div>
            </Col>
          </Row>
        </Container>
      </section>

      <OndaBaixo cor="var(--pmc-areia)" />

      {/* Sobre */}
      <section className="pmc-secao pmc-secao--areia">
        <Container className="pmc-container">
          <Row className="align-items-center g-5">
            <Col md={7}>
              <span className="pmc-rotulo">Sobre a psicóloga</span>
              <h2 className="mt-3">Sobre a Psicóloga</h2>
              <p>
                Psicóloga clínica com experiência no atendimento de crianças,
                adolescentes e adultos. Terapia cognitivo-comportamental e psicoterapia familiar.
              </p>
              <div className="d-flex flex-wrap gap-2 mt-4">
                {especialidades.map((especialidade) => (
                  <span key={especialidade} className="pmc-chip">
                    {especialidade}
                  </span>
                ))}
              </div>
            </Col>
            <Col md={5} className="d-none d-md-block">
              <div className="pmc-blob">
                <Image
                  src="/CristinaVestido.jpeg"
                  alt="Psicóloga Maria Cristina em pé, sorrindo"
                  width={400}
                  height={480}
                  style={{ width: '100%', height: 'auto' }}
                />
              </div>
            </Col>
          </Row>
        </Container>
      </section>

      <OndaBaixo cor="var(--pmc-fundo)" />

      {/* Como funciona */}
      <section className="pmc-secao">
        <Container className="pmc-container text-center">
          <h2>Como Funciona</h2>
          <Row className="g-4 mt-2">
            <Col md={4}>
              <div className="pmc-icone mx-auto mb-3">
                <i className="bi bi-calendar-check" />
              </div>
              <span className="pmc-rotulo">Passo 1</span>
              <h3>Agendamento Online</h3>
              <p className="mx-auto">
                Escolha o dia e horário disponível que melhor se adequa à sua rotina.
              </p>
            </Col>
            <Col md={4}>
              <div className="pmc-icone mx-auto mb-3">
                <i className="bi bi-check2-circle" />
              </div>
              <span className="pmc-rotulo">Passo 2</span>
              <h3>Confirmação</h3>
              <p className="mx-auto">
                Você recebe a confirmação e pode acompanhar tudo na sua área.
              </p>
            </Col>
            <Col md={4}>
              <div className="pmc-icone mx-auto mb-3">
                <i className="bi bi-camera-video" />
              </div>
              <span className="pmc-rotulo">Passo 3</span>
              <h3>Consulta Online / Presencial</h3>
              <p className="mx-auto">
                Participe da consulta no horário agendado via Google Meet.<br /> OU <br />
                Compareça ao consultório para atendimento presencial.
              </p>
            </Col>
          </Row>
          <Link href="/agendamento">
            <Button variant="primary" size="lg" className="mt-5">
              <i className="bi bi-calendar-plus me-2" />
              Agendar Consulta
            </Button>
          </Link>
        </Container>
      </section>

      {/* Footer */}
      <footer className="pmc-secao pmc-secao--escura">
        <Container className="pmc-container">
          <Row className="g-5">
            <Col md={5}>
              <h3>Contato</h3>
              <address className="mb-0">
                <p className="mb-2">
                  <i className="bi bi-telephone me-2" />
                  <a href="tel:+5561995391540">(61) 99539-1540</a>
                </p>
                <p className="mb-3">
                  <i className="bi bi-envelope me-2" />
                  <a href="mailto:mariacriscassia02@gmail.com">mariacriscassia02@gmail.com</a>
                </p>
              </address>
              <p className="mb-0">Atendimento online • Crianças, Adolescentes e Adultos</p>
            </Col>
            <Col md={7}>
              <div className="pmc-mapa ratio ratio-16x9">
                <iframe
                  src="https://www.google.com/maps/embed?pb=!1m14!1m8!1m3!1d246113.82756486596!2d-47.603239!3d-15.455976!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x935a133ab4a4a4dd%3A0x5f4b18fb11591ca3!2sPlanaltina%2C%20Bras%C3%ADlia%20-%20DF!5e0!3m2!1spt-BR!2sbr!4v1789690332483!5m2!1spt-BR!2sbr"
                  allowFullScreen
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  title="Localização do consultório em Planaltina-DF"
                />
              </div>
            </Col>
          </Row>
          <p className="text-center mt-5 mb-0">
            © {new Date().getFullYear()} Psicóloga Maria Cristina - Todos os direitos reservados
          </p>
        </Container>
      </footer>
    </div>
  );
}
