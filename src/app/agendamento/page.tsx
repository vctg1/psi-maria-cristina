'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import Container from 'react-bootstrap/Container';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import Card from 'react-bootstrap/Card';
import Form from 'react-bootstrap/Form';
import Button from 'react-bootstrap/Button';
import Navbar from 'react-bootstrap/Navbar';
import Alert from 'react-bootstrap/Alert';
import Tabs from 'react-bootstrap/Tabs';
import Tab from 'react-bootstrap/Tab';
import Spinner from 'react-bootstrap/Spinner';
import CalendarioAgendamento from '@/components/CalendarioAgendamento';
import PacienteForm from '@/components/area-restrita/PacienteForm';
import type { PacienteFormValores } from '@/components/area-restrita/PacienteForm';
import LoginForm from '@/components/LoginForm';
import { useAuth } from '@/contexts/AuthContext';
import type { AgendamentoEntrada, AgendamentoResposta, Modalidade, ErroApi } from '@/types/agenda';

const passos = [
  { numero: 1, rotulo: 'Horário', icone: 'bi-calendar-check' },
  { numero: 2, rotulo: 'Seus dados', icone: 'bi-person-vcard' },
  { numero: 3, rotulo: 'Confirmação', icone: 'bi-check-circle' },
];

const opcoesMotivo = [
  'Dificuldade de Aprendizagem',
  'Terapia Infantil',
  'Orientação para pais',
  'Ansiedade',
  'Depressão',
  'Outro',
];

type ConfirmacaoAgendamento = {
  data: string;
  hora: string;
  modalidade: Modalidade;
};

export default function AgendamentoPage() {
  const { usuario, carregando: carregandoAuth, recarregar } = useAuth();

  const [step, setStep] = useState(1);
  const [calendarioKey, setCalendarioKey] = useState(0);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [modalidade, setModalidade] = useState<Modalidade>('presencial');
  const [motivo, setMotivo] = useState('');
  const [observacoes, setObservacoes] = useState('');

  const [abaAtiva, setAbaAtiva] = useState<'cadastro' | 'login'>('cadastro');
  const [enviando, setEnviando] = useState(false);
  const [errosServidor, setErrosServidor] = useState<Record<string, string> | undefined>(undefined);
  const [erroGeral, setErroGeral] = useState<string | null>(null);

  const [confirmacao, setConfirmacao] = useState<ConfirmacaoAgendamento | null>(null);

  const handleDateSelect = (date: string) => {
    setSelectedDate(date);
    setSelectedTime('');
  };

  const handleTimeSelect = (time: string) => {
    setSelectedTime(time);
  };

  const reiniciarParaEscolhaDeHorario = () => {
    setSelectedDate('');
    setSelectedTime('');
    setCalendarioKey((chave) => chave + 1);
    setStep(1);
  };

  const enviarAgendamento = async (cadastro?: AgendamentoEntrada['cadastro']) => {
    setEnviando(true);
    setErroGeral(null);
    setErrosServidor(undefined);

    try {
      const body: AgendamentoEntrada = {
        data: selectedDate,
        hora: selectedTime,
        modalidade,
        motivo: motivo || undefined,
        observacoes: observacoes || undefined,
        ...(cadastro ? { cadastro } : {}),
      };

      const response = await fetch('/api/agendamento', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        const resultado: AgendamentoResposta = await response.json();
        if (resultado.novoCadastro) {
          await recarregar();
        }
        setConfirmacao({ data: selectedDate, hora: selectedTime, modalidade });
        setStep(3);
        return;
      }

      const erro: ErroApi = await response.json().catch(() => ({ error: 'Não foi possível concluir o agendamento.' }));

      if (response.status === 400 && erro.campos) {
        setErrosServidor(erro.campos);
        return;
      }

      if (response.status === 409 && erro.codigo === 'EMAIL_EXISTENTE') {
        setErroGeral("Esse e-mail já tem conta. Entre na aba \"Já tenho conta\" para agendar.");
        setAbaAtiva('login');
        return;
      }

      if (response.status === 409) {
        setErroGeral(erro.error || 'Esse horário acabou de ficar indisponível. Escolha outro horário.');
        reiniciarParaEscolhaDeHorario();
        return;
      }

      setErroGeral(erro.error || 'Não foi possível concluir o agendamento. Tente novamente.');
    } catch {
      setErroGeral('Não foi possível concluir o agendamento. Tente novamente.');
    } finally {
      setEnviando(false);
    }
  };

  const handleCadastroSubmit = async (dados: PacienteFormValores) => {
    await enviarAgendamento({
      nome: dados.nome,
      email: dados.email ?? '',
      telefone: dados.telefone,
      dataNascimento: dados.dataNascimento ?? '',
      cpf: dados.cpf ?? null,
      responsavel: dados.responsavel ?? null,
      telefoneResponsavel: dados.telefoneResponsavel ?? null,
      senha: dados.senha ?? '',
    });
  };

  const handleLoginSucesso = async () => {
    await enviarAgendamento();
  };

  const resumoDataHora = selectedDate
    ? new Date(selectedDate + 'T12:00:00').toLocaleDateString('pt-BR', {
        weekday: 'long',
        day: '2-digit',
        month: 'long',
      })
    : '';

  const confirmacaoDataHoraTexto = confirmacao
    ? new Date(confirmacao.data + 'T' + confirmacao.hora + ':00').toLocaleString('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        dateStyle: 'full',
        timeStyle: 'short',
      })
    : '';

  const whatsappMensagem = confirmacao
    ? `Olá, acabei de agendar uma consulta para ${new Date(confirmacao.data + 'T12:00:00').toLocaleDateString('pt-BR')} às ${confirmacao.hora}.`
    : '';
  const whatsappURL = `https://wa.me/5561995391540?text=${encodeURIComponent(whatsappMensagem)}`;

  return (
    <div>
      {/* Header */}
      <Navbar expand="md" className="pmc-header" as="header">
        <Container className="pmc-container justify-content-center">
          <Navbar.Brand as={Link} href="/">
            <Image
              src="/maria-cristina-logo.png"
              alt="Psicóloga Maria Cristina"
              width={140}
              height={140}
              style={{ objectFit: 'contain', maxWidth: '100%', height: 'auto' }}
              priority
            />
          </Navbar.Brand>
        </Container>
      </Navbar>

      <section className="pmc-secao pb-0">
        <Container className="pmc-container">
          <div className="text-center mb-5">
            <span className="pmc-rotulo">Agendamento</span>
            <h1 className="mt-2">Escolha um horário que caiba na sua semana.</h1>
          </div>

          {/* Indicador de passos */}
          <div className="d-flex justify-content-center gap-4 gap-md-5 mb-5">
            {passos.map((passo) => (
              <div key={passo.numero} className="text-center">
                <div
                  className={`pmc-icone mx-auto mb-2 fs-5 ${step >= passo.numero ? '' : 'pmc-icone--salvia opacity-50'}`}
                >
                  <i className={`bi ${passo.icone}`} />
                </div>
                <span className="pmc-rotulo d-block">{passo.rotulo}</span>
              </div>
            ))}
          </div>
        </Container>
      </section>

      <section className="pmc-secao pt-0">
        <Container className="pmc-container" style={{ maxWidth: '800px' }}>
          {/* Passo 1: Seleção de data e horário */}
          {step === 1 && (
            <Card>
              <Card.Body>
                <h2 className="mb-4">Escolha a data e horário</h2>
                <CalendarioAgendamento
                  key={calendarioKey}
                  selectedDate={selectedDate}
                  onDateSelect={handleDateSelect}
                  onTimeSelect={handleTimeSelect}
                  selectedTime={selectedTime}
                />

                {selectedDate && selectedTime && (
                  <Card className="card--areia mt-4">
                    <Card.Body>
                      <p className="fw-semibold mb-3">
                        {resumoDataHora} às {selectedTime}
                      </p>

                      <Form.Group className="mb-3">
                        <Form.Label className="pmc-rotulo d-block">Modalidade</Form.Label>
                        <div className="d-flex gap-4">
                          <Form.Check
                            type="radio"
                            id="modalidade-presencial"
                            name="modalidade"
                            label="Presencial"
                            checked={modalidade === 'presencial'}
                            onChange={() => setModalidade('presencial')}
                          />
                          <Form.Check
                            type="radio"
                            id="modalidade-online"
                            name="modalidade"
                            label="Online"
                            checked={modalidade === 'online'}
                            onChange={() => setModalidade('online')}
                          />
                        </div>
                      </Form.Group>

                      <Row className="g-3">
                        <Col md={6}>
                          <Form.Group controlId="motivo">
                            <Form.Label>Motivo</Form.Label>
                            <Form.Select value={motivo} onChange={(e) => setMotivo(e.target.value)}>
                              <option value="">...</option>
                              {opcoesMotivo.map((opcao) => (
                                <option key={opcao} value={opcao}>{opcao}</option>
                              ))}
                            </Form.Select>
                          </Form.Group>
                        </Col>
                        <Col md={12}>
                          <Form.Group controlId="observacoes">
                            <Form.Label>Observações (opcional)</Form.Label>
                            <Form.Control
                              as="textarea"
                              rows={3}
                              value={observacoes}
                              onChange={(e) => setObservacoes(e.target.value)}
                              maxLength={500}
                            />
                          </Form.Group>
                        </Col>
                      </Row>

                      <p className="text-secondary small mt-3 mb-0">
                        O horário só é reservado ao concluir o cadastro ou login.
                      </p>

                      <div className="d-flex justify-content-end mt-3">
                        <Button variant="primary" onClick={() => setStep(2)}>
                          Continuar
                          <i className="bi bi-arrow-right ms-2" />
                        </Button>
                      </div>
                    </Card.Body>
                  </Card>
                )}
              </Card.Body>
            </Card>
          )}

          {/* Passo 2: Seus dados */}
          {step === 2 && (
            <Card>
              <Card.Body>
                <h2 className="mb-3">Seus dados</h2>
                <p className="text-secondary mb-4">
                  Consulta para {resumoDataHora} às {selectedTime}
                </p>

                {erroGeral && <Alert variant="warning">{erroGeral}</Alert>}

                {carregandoAuth ? (
                  <div className="d-flex align-items-center gap-2">
                    <Spinner animation="border" size="sm" />
                    <span>Carregando...</span>
                  </div>
                ) : usuario?.papel === 'paciente' ? (
                  <div>
                    <Alert variant="info">Agendando como paciente logado.</Alert>
                    <div className="d-flex gap-3">
                      <Button variant="outline-secondary" onClick={() => setStep(1)} disabled={enviando}>
                        <i className="bi bi-arrow-left me-2" />
                        Voltar
                      </Button>
                      <Button
                        variant="primary"
                        className="ms-auto"
                        disabled={enviando}
                        onClick={() => enviarAgendamento()}
                      >
                        {enviando ? 'Agendando...' : 'Confirmar agendamento'}
                      </Button>
                    </div>
                  </div>
                ) : usuario?.papel === 'psicologa' ? (
                  <Alert variant="info">
                    Você está logada como psicóloga. Use a agenda da sua área para marcar consultas.{' '}
                    <Link href="/area-restrita">Ir para a área restrita</Link>
                  </Alert>
                ) : (
                  <Tabs
                    activeKey={abaAtiva}
                    onSelect={(k) => setAbaAtiva((k as 'cadastro' | 'login') ?? 'cadastro')}
                    className="mb-4"
                  >
                    <Tab eventKey="cadastro" title="Criar minha conta">
                      <div className="pt-3">
                        <PacienteForm
                          modo="cadastro"
                          mostrarSenha
                          camposObrigatorios={{ email: true, dataNascimento: true }}
                          onSubmit={handleCadastroSubmit}
                          errosServidor={errosServidor}
                          enviando={enviando}
                        />
                      </div>
                    </Tab>
                    <Tab eventKey="login" title="Já tenho conta">
                      <div className="pt-3">
                        <LoginForm onSucesso={handleLoginSucesso} />
                      </div>
                    </Tab>
                  </Tabs>
                )}

                {usuario?.papel !== 'paciente' && usuario?.papel !== 'psicologa' && (
                  <div className="d-flex mt-2">
                    <Button variant="outline-secondary" onClick={() => setStep(1)} disabled={enviando}>
                      <i className="bi bi-arrow-left me-2" />
                      Voltar
                    </Button>
                  </div>
                )}
              </Card.Body>
            </Card>
          )}

          {/* Passo 3: Confirmação */}
          {step === 3 && confirmacao && (
            <Card>
              <Card.Body className="text-center">
                <div className="pmc-icone pmc-icone--salvia mx-auto mb-3 fs-1">
                  <i className="bi bi-check2-circle" />
                </div>
                <h2>Consulta agendada</h2>
                <p className="mb-1">{confirmacaoDataHoraTexto}</p>
                <p className="text-secondary mb-4">
                  {confirmacao.modalidade === 'presencial' ? 'Presencial' : 'Online'}
                </p>
                <p className="mb-4">
                  A psicóloga vai confirmar e você pode acompanhar tudo na sua área.
                </p>

                <div className="d-flex flex-wrap justify-content-center gap-3">
                  <Link href="/area-restrita">
                    <Button variant="primary">Ir para minha área</Button>
                  </Link>
                  <a href={whatsappURL} target="_blank" rel="noopener noreferrer">
                    <Button variant="outline-primary">
                      <i className="bi bi-whatsapp me-2" />
                      Falar no WhatsApp
                    </Button>
                  </a>
                </div>
              </Card.Body>
            </Card>
          )}
        </Container>
      </section>
    </div>
  );
}
