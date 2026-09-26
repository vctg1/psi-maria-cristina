'use client';

import Image from "next/image";
import Link from "next/link";
import Button from 'react-bootstrap/Button';
import Container from 'react-bootstrap/Container';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import SiteHeader from '@/components/SiteHeader';

const areasAtuacao = [
  'Terapia Cognitivo-Comportamental',
  'Psicanálise',
  'Psicoterapia Infantil',
  'Psicoterapia do Adolescente',
  'Transtornos de Ansiedade',
  'Estresse e esgotamento',
  'Autoconhecimento',
];

const metodo = [
  {
    icone: 'bi-chat-heart',
    titulo: 'Escuta sem julgamento',
    texto:
      'A sessão é um espaço seguro para falar livremente, no seu ritmo, sobre o que pesa e o que importa.',
  },
  {
    icone: 'bi-search-heart',
    titulo: 'Compreender a raiz',
    texto:
      'Muitas das nossas reações acontecem sem que a gente perceba. Entender esses mecanismos ajuda a enxergar por que certas situações nos afetam tanto.',
  },
  {
    icone: 'bi-tools',
    titulo: 'Recursos para o dia a dia',
    texto:
      'Com a terapia cognitivo-comportamental, construímos estratégias práticas para lidar com a ansiedade, o estresse e os pensamentos que paralisam.',
  },
  {
    icone: 'bi-flower1',
    titulo: 'Transformar tensão em crescimento',
    texto:
      'A energia do estresse pode ser direcionada para o que faz sentido: trabalho, estudos, criação, relações. É o que a psicanálise chama de sublimação.',
  },
];

const pontosTcc = [
  'O estresse não é só cansaço: ele também mexe com a forma como sentimos e nos relacionamos.',
  'Nossas defesas nos protegem, mas, quando usadas em excesso, podem nos afastar do que precisamos resolver.',
  'Entender o que se passa por dentro abre caminho para respostas mais conscientes e para o crescimento pessoal.',
];

const etapasConsulta = [
  {
    titulo: 'Agendamento',
    texto: 'Escolha um horário pelo site ou fale pelo WhatsApp.',
  },
  {
    titulo: 'Primeiro encontro',
    texto:
      'Um momento de acolhimento para entender o que te trouxe e o que você espera da terapia.',
  },
  {
    titulo: 'Caminho combinado',
    texto: 'Juntos, definimos a frequência e os objetivos do acompanhamento.',
  },
  {
    titulo: 'Sessões',
    texto:
      'Encontros de cerca de 50 minutos, presenciais em Planaltina-DF ou online.',
  },
];

const galeriaConsultorio = [
  {
    src: '/site/consultorio-poltrona.webp',
    alt: 'Poltrona de atendimento junto à janela do consultório',
    legenda: 'Sala de atendimento',
    classeExtra: '',
  },
  {
    src: '/site/consultorio-poltrona-larga.webp',
    alt: 'Detalhe da poltrona de atendimento com planta e orquídea',
    legenda: 'Um lugar para respirar',
    classeExtra: '',
  },
  {
    src: '/site/consultorio-infantil.webp',
    alt: 'Canto lúdico preparado para o atendimento infantil',
    legenda: 'Espaço para as crianças',
    classeExtra: 'pmc-galeria-foto--baixo',
  },
];

const paraQuem = [
  {
    icone: 'bi-balloon-heart',
    titulo: 'Crianças',
    texto: 'Um espaço lúdico para expressar sentimentos e orientar os pais.',
  },
  {
    icone: 'bi-person-arms-up',
    titulo: 'Adolescentes',
    texto: 'Escuta para as mudanças, pressões e descobertas dessa fase.',
  },
  {
    icone: 'bi-person-heart',
    titulo: 'Adultos',
    texto: 'Ansiedade, estresse, esgotamento e autoconhecimento.',
  },
];

function OndaBaixo({ corCima, corBaixo }: { corCima: string; corBaixo: string }) {
  return (
    <div className="pmc-onda" style={{ background: corCima }} aria-hidden="true">
      <svg viewBox="0 0 1440 64" preserveAspectRatio="none">
        <path
          d="M0,32 C240,64 480,0 720,16 C960,32 1200,64 1440,32 L1440,64 L0,64 Z"
          fill={corBaixo}
        />
      </svg>
    </div>
  );
}

export default function Home() {
  return (
    <div>
      <SiteHeader />

      {/* Hero */}
      <section className="pmc-secao pmc-secao--hero">
        <Container className="pmc-container">
          <Row className="align-items-center g-5">
            <Col md={7} className="order-2 order-md-1">
              <span className="pmc-rotulo">Psicologia clínica · Planaltina-DF e online</span>
              <h1 className="mt-3">Um lugar para respirar, entender e recomeçar.</h1>
              <p className="lead">
                Atendimento psicológico para crianças, adolescentes e adultos, integrando a
                terapia cognitivo-comportamental — presencial em Planaltina-DF
                ou online, no seu tempo.
              </p>
              <div className="mt-3">
                <p className="pmc-titulos mb-1">
                  <i className="bi bi-patch-check" />
                  Especialista em Psicologia Clínica
                </p>
                <p className="pmc-titulos mb-0">
                  <i className="bi bi-patch-check" />
                  Especialista em Docência do Ensino Superior
                </p>
              </div>
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
                    src="/site/cristina-retrato-hero.webp"
                    alt="Psicóloga Maria Cristina, de braços cruzados, sorrindo"
                    width={900}
                    height={1125}
                    style={{ width: '100%', height: 'auto' }}
                    priority
                  />
                </div>
              </div>
            </Col>
          </Row>
        </Container>
      </section>

      {/* Faixa-manifesto */}
      <section className="pmc-faixa-manifesto">
        <div className="pmc-faixa-manifesto__fundo">
          <Image
            src="/site/consultorio-desfoque.webp"
            alt=""
            fill
            sizes="100vw"
            style={{ objectFit: 'cover' }}
          />
        </div>
        <Container className="pmc-container">
          <p className="pmc-faixa-manifesto__citacao">
            &ldquo;Um espaço seguro para falar livremente, compreender o que você sente e
            transformar tensão em crescimento.&rdquo;
          </p>
          <span className="pmc-faixa-manifesto__assinatura text-center d-block">
            Maria Cristina
          </span>
        </Container>
      </section>

      {/* Sobre / formação */}
      <section className="pmc-secao pmc-secao--areia">
        <Container className="pmc-container">
          <Row className="align-items-center g-5">
            <Col md={5}>
              <div className="pmc-blob">
                <Image
                  src="/site/cristina-leitura.webp"
                  alt="Maria Cristina lendo em uma biblioteca"
                  width={775}
                  height={1040}
                  style={{ width: '100%', height: 'auto' }}
                />
              </div>
            </Col>
            <Col md={7}>
              <span className="pmc-rotulo">Quem vai te acompanhar</span>
              <h2 className="mt-3">Maria Cristina Cassiano de Oliveira</h2>
              <p>
                Psicóloga formada pelas Faculdades Integradas IESGO, especialista em Psicologia
                Clínica e em Docência do Ensino Superior. Atendo crianças, adolescentes e
                adultos, unindo duas formas de olhar para o sofrimento: a terapia
                cognitivo-comportamental, que oferece recursos práticos para o dia a dia, e a
                psicologia social, que ajuda a entender de onde vêm os padrões que se repetem.
              </p>
              <div className="d-flex flex-wrap gap-2 mt-4">
                {areasAtuacao.map((area) => (
                  <span key={area} className="pmc-chip">
                    {area}
                  </span>
                ))}
              </div>
              <p className="pmc-texto-2 mt-3 mb-0">
                <a
                  href="https://www.instagram.com/psimariacristina_/"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Instagram da psicóloga Maria Cristina (@psimariacristina_)"
                >
                  <i className="bi bi-instagram me-2" />
                  Acompanhe no Instagram: @psimariacristina_
                </a>
              </p>
            </Col>
          </Row>
        </Container>
      </section>

      <OndaBaixo corCima="var(--pmc-areia)" corBaixo="var(--pmc-fundo)" />

      {/* Como eu trabalho */}
      <section className="pmc-secao">
        <Container className="pmc-container text-center">
          <span className="pmc-rotulo">Método</span>
          <h2 className="mt-3">Como eu trabalho</h2>
          <p className="lead mx-auto">
            Cada pessoa chega com uma história. O cuidado começa por escutá-la.
          </p>
          <Row className="g-4 mt-2 text-start">
            {metodo.map((item) => (
              <Col md={6} lg={3} key={item.titulo}>
                <div className="pmc-cartao-metodo">
                  <div className="pmc-icone mb-3">
                    <i className={item.icone} />
                  </div>
                  <h3>{item.titulo}</h3>
                  <p className="mb-0">{item.texto}</p>
                </div>
              </Col>
            ))}
          </Row>
        </Container>
      </section>

      <OndaBaixo corCima="var(--pmc-fundo)" corBaixo="var(--pmc-areia)" />

      {/* Destaque do TCC */}
      <section className="pmc-secao pmc-secao--areia">
        <Container className="pmc-container">
          <Row className="align-items-center g-5">
            <Col lg={6}>
              <div className="pmc-blob">
                <Image
                  src="/site/consultorio-ambiente.webp"
                  alt="Ambiente do consultório com poltrona e luz natural da janela"
                  width={900}
                  height={1000}
                  style={{ width: '100%', height: 'auto' }}
                />
              </div>
            </Col>
            <Col lg={6}>
              <span className="pmc-rotulo">Pesquisa</span>
              <h2 className="mt-3">Estresse: do alívio à compreensão</h2>
              <p>
                No trabalho de conclusão de curso, Maria Cristina estudou como a mente se
                defende do estresse e como essa energia pode ser transformada em algo
                construtivo.
              </p>
              <div className="pmc-cartao-citacao mb-4">
                <p>
                  &ldquo;Uma análise da sublimação como mecanismo de defesa inconsciente para
                  lidar com situações de estresse&rdquo;
                </p>
                <span>Faculdades Integradas IESGO · 2024</span>
              </div>
              <ul className="pmc-lista-check">
                {pontosTcc.map((ponto) => (
                  <li key={ponto}>
                    <i className="bi bi-check-circle-fill" />
                    <span>{ponto}</span>
                  </li>
                ))}
              </ul>
            </Col>
          </Row>
        </Container>
      </section>

      <OndaBaixo corCima="var(--pmc-areia)" corBaixo="var(--pmc-fundo)" />

      {/* Como é a consulta */}
      <section className="pmc-secao">
        <Container className="pmc-container text-center">
          <span className="pmc-rotulo">Passo a passo</span>
          <h2 className="mt-3">Como é a consulta</h2>
          <div className="pmc-linha-tempo mt-5 text-start">
            {etapasConsulta.map((etapa, indice) => (
              <div className="pmc-linha-tempo__item" key={etapa.titulo}>
                <span className="pmc-linha-tempo__numero">{indice + 1}</span>
                <h3>{etapa.titulo}</h3>
                <p className="mb-0">{etapa.texto}</p>
              </div>
            ))}
          </div>
          <Link href="/agendamento">
            <Button variant="primary" size="lg" className="mt-5">
              <i className="bi bi-calendar-plus me-2" />
              Agendar consulta
            </Button>
          </Link>
        </Container>
      </section>

      <OndaBaixo corCima="var(--pmc-fundo)" corBaixo="var(--pmc-areia)" />

      {/* O consultório */}
      <section className="pmc-secao pmc-secao--areia">
        <Container className="pmc-container text-center">
          <span className="pmc-rotulo">Onde acontece</span>
          <h2 className="mt-3">Um ambiente pensado para o cuidado</h2>
          <p className="lead mx-auto">
            Luz natural, silêncio e conforto para que você se sinta à vontade desde o primeiro
            minuto.
          </p>
          <Row className="g-4 mt-2">
            {galeriaConsultorio.map((foto) => (
              <Col md={4} key={foto.src}>
                <div className={`pmc-galeria-foto ${foto.classeExtra}`.trim()}>
                  <Image src={foto.src} alt={foto.alt} width={900} height={600} />
                </div>
                <p className="pmc-galeria-legenda">{foto.legenda}</p>
              </Col>
            ))}
          </Row>
          <p className="pmc-texto-2 mt-3 mb-0">
            O atendimento online acontece com o mesmo cuidado, de onde você estiver.
          </p>
        </Container>
      </section>

      <OndaBaixo corCima="var(--pmc-areia)" corBaixo="var(--pmc-fundo)" />

      {/* Para quem */}
      <section className="pmc-secao">
        <Container className="pmc-container text-center">
          <span className="pmc-rotulo">Atendimento</span>
          <h2 className="mt-3 mb-4">Para quem é</h2>
          <Row className="g-4 text-start">
            {paraQuem.map((item) => (
              <Col md={4} key={item.titulo}>
                <div className="pmc-cartao-metodo text-center h-100">
                  <div className="pmc-icone pmc-icone--salvia mx-auto mb-3">
                    <i className={item.icone} />
                  </div>
                  <h3>{item.titulo}</h3>
                  <p className="mb-0">{item.texto}</p>
                </div>
              </Col>
            ))}
          </Row>
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
                <p className="mb-3">
                  <i className="bi bi-instagram me-2" />
                  <a
                    href="https://www.instagram.com/psimariacristina_/"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Instagram da psicóloga Maria Cristina (@psimariacristina_)"
                  >
                    @psimariacristina_
                  </a>
                </p>
              </address>
              <p className="mb-0">
                Atendimento presencial em Planaltina-DF e online • Crianças, adolescentes e
                adultos
              </p>
            </Col>
            <Col md={7}>
              <div className="pmc-mapa ratio ratio-4x3">
                <iframe
                  src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3842.449675972523!2d-47.6590154!3d-15.621024900000002!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x935a13a8f1cb33b3%3A0x563cfb76e7e84007!2sPsic%C3%B3loga%20Maria%20Cristina!5e0!3m2!1spt-BR!2sbr!4v1790455178240!5m2!1spt-BR!2sbr"
                  title="Localização do consultório da psicóloga Maria Cristina"
                  allowFullScreen
                  loading="lazy"
                  referrerPolicy="strict-origin-when-cross-origin"
                />
              </div>
              <a
                href="https://maps.app.goo.gl/H6k7QzPuavFjRjZN7?g_st=aw"
                target="_blank"
                rel="noopener noreferrer"
                className="d-inline-block mt-3"
              >
                Abrir no Google Maps
              </a>
            </Col>
          </Row>
          <p className="text-center mx-auto mt-5 mb-0">
            © {new Date().getFullYear()} Psicóloga Maria Cristina - Todos os direitos reservados
          </p>
        </Container>
      </footer>
    </div>
  );
}
