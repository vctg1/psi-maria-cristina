'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import Container from 'react-bootstrap/Container';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import Card from 'react-bootstrap/Card';
import Form from 'react-bootstrap/Form';
import Button from 'react-bootstrap/Button';
import Navbar from 'react-bootstrap/Navbar';
import CalendarioAgendamento from '@/components/CalendarioAgendamento';

interface HorarioDisponivel {
  id: string;
  data: string;
  hora: string;
  tipo: string;
}

interface AgendamentoRealizado {
  consulta: { id: string; data: string; hora: string };
  paciente: { nome: string };
  acessoAreaRestrita: { email: string; senha: string };
}

const passos = [
  { numero: 1, rotulo: 'Horário', icone: 'bi-calendar-check' },
  { numero: 2, rotulo: 'Seus dados', icone: 'bi-person-vcard' },
  { numero: 3, rotulo: 'Confirmação', icone: 'bi-check-circle' },
];

export default function AgendamentoPage() {
  const [step, setStep] = useState(1);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [, setAvailableTimes] = useState<HorarioDisponivel[]>([]);
  const [loading, setLoading] = useState(false);
  const [agendamentoRealizado, setAgendamentoRealizado] = useState<AgendamentoRealizado | null>(null);

  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    telefone: '',
    dataNascimento: '',
    cpf: '',
    responsavel: '',
    telefoneResponsavel: '',
    tipo: '',
    motivo: '',
    observacoes: ''
  });

  const [errors, setErrors] = useState<{[key: string]: string}>({});

  // Buscar horários disponíveis para a data selecionada
  useEffect(() => {
    if (selectedDate) {
      fetchAvailableTimes(selectedDate);
    }
  }, [selectedDate]);

  const fetchAvailableTimes = async (date: string) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/horarios?data=${date}&disponiveis=true`);
      const times = await response.json();
      setAvailableTimes(times);
    } catch (error) {
      console.error('Erro ao buscar horários:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDateSelect = (date: string) => {
    setSelectedDate(date);
    setSelectedTime('');
  };

  const handleTimeSelect = (time: string) => {
    setSelectedTime(time);
    setStep(2); // Pula direto para os dados do paciente
  };

  const validateForm = () => {
    const newErrors: {[key: string]: string} = {};

    if (!formData.nome) newErrors.nome = 'Nome é obrigatório';
    if (!formData.email) newErrors.email = 'Email é obrigatório';
    if (!formData.telefone) newErrors.telefone = 'Telefone é obrigatório';
    if (!formData.dataNascimento) newErrors.dataNascimento = 'Data de nascimento é obrigatória';
    if (!formData.cpf) newErrors.cpf = 'CPF é obrigatório';
    if (!formData.motivo) newErrors.motivo = 'Motivo é obrigatório';
    if (!formData.tipo) newErrors.tipo = 'Tipo é obrigatório';

    // Validar se é menor de idade
    const birthDate = new Date(formData.dataNascimento);
    const today = new Date();
    const age = today.getFullYear() - birthDate.getFullYear();

    if (age < 18) {
      if (!formData.responsavel) newErrors.responsavel = 'Nome do responsável é obrigatório para menores de idade';
      if (!formData.telefoneResponsavel) newErrors.telefoneResponsavel = 'Telefone do responsável é obrigatório para menores de idade';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    // try {
    //   setLoading(true);
    //   const response = await fetch('/api/agendamento', {
    //     method: 'POST',
    //     headers: {
    //       'Content-Type': 'application/json',
    //     },
    //     body: JSON.stringify({
    //       paciente: formData,
    //       data: selectedDate,
    //       hora: selectedTime
    //     })
    //   });

    //   const result = await response.json();

    //   if (response.ok) {
    //     setAgendamentoRealizado(result);
    //     setStep(3);
    //   } else {
    //     alert(result.error || 'Erro ao realizar agendamento');
    //   }
    // } catch (error) {
    //   console.error('Erro:', error);
    //   alert('Erro ao realizar agendamento');
    // } finally {
    //   setLoading(false);
    // }
    // Enviar a pessoa para o whatsapp com os dados do agendamento
    const whatsappNumber = '5561995391540';
    const message = `Olá, gostaria de agendar uma consulta.\n\nDados do Paciente:
      Nome: ${formData.nome}
      Email: ${formData.email}
      Telefone: ${formData.telefone}
      Data de Nascimento: ${new Date(formData.dataNascimento + 'T12:00:00').toLocaleDateString('pt-BR')}
      CPF: ${formData.cpf}\n\nConsulta:
      Data: ${new Date(selectedDate + 'T12:00:00').toLocaleDateString('pt-BR')}
      Horário: ${selectedTime}
      Tipo: ${formData.tipo}
      Motivo: ${formData.motivo}
      ${formData.observacoes?`Observações: ${formData.observacoes}` : ''}`;
    const whatsappURL = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;
    window.open(whatsappURL, '_blank');
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));

    // Limpar erro do campo quando usuário começar a digitar
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const menorDeIdade = Boolean(
    formData.dataNascimento &&
    new Date().getFullYear() - new Date(formData.dataNascimento).getFullYear() < 18
  );

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
                  selectedDate={selectedDate}
                  onDateSelect={handleDateSelect}
                  onTimeSelect={handleTimeSelect}
                />
              </Card.Body>
            </Card>
          )}

          {/* Passo 2: Dados do paciente */}
          {step === 2 && (
            <Card>
              <Card.Body>
                <h2 className="mb-3">Dados do Paciente</h2>
                <p className="text-secondary mb-1">
                  Consulta agendada para: {new Date(selectedDate + 'T12:00:00').toLocaleDateString('pt-BR')} às {selectedTime}
                </p>
                <p className="fw-semibold mb-4">Valor da consulta: R$ 150,00</p>

                <Form onSubmit={handleSubmit} noValidate>
                  <Row className="g-3">
                    <Col md={12}>
                      <Form.Group controlId="nome">
                        <Form.Label>Nome Completo</Form.Label>
                        <Form.Control
                          type="text"
                          name="nome"
                          value={formData.nome}
                          onChange={handleInputChange}
                          isInvalid={!!errors.nome}
                        />
                        <Form.Control.Feedback type="invalid">{errors.nome}</Form.Control.Feedback>
                      </Form.Group>
                    </Col>

                    <Col md={6}>
                      <Form.Group controlId="email">
                        <Form.Label>Email</Form.Label>
                        <Form.Control
                          type="email"
                          name="email"
                          value={formData.email}
                          onChange={handleInputChange}
                          isInvalid={!!errors.email}
                        />
                        <Form.Control.Feedback type="invalid">{errors.email}</Form.Control.Feedback>
                      </Form.Group>
                    </Col>
                    <Col md={6}>
                      <Form.Group controlId="telefone">
                        <Form.Label>Telefone</Form.Label>
                        <Form.Control
                          type="tel"
                          name="telefone"
                          value={formData.telefone.replace(/\D/g, '').replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2')}
                          onChange={handleInputChange}
                          maxLength={15}
                          isInvalid={!!errors.telefone}
                        />
                        <Form.Control.Feedback type="invalid">{errors.telefone}</Form.Control.Feedback>
                      </Form.Group>
                    </Col>

                    <Col md={6}>
                      <Form.Group controlId="dataNascimento">
                        <Form.Label>Data de Nascimento</Form.Label>
                        <Form.Control
                          type="date"
                          name="dataNascimento"
                          value={formData.dataNascimento || '2000-01-01'}
                          onChange={handleInputChange}
                          isInvalid={!!errors.dataNascimento}
                        />
                        <Form.Control.Feedback type="invalid">{errors.dataNascimento}</Form.Control.Feedback>
                      </Form.Group>
                    </Col>
                    <Col md={6}>
                      <Form.Group controlId="cpf">
                        <Form.Label>CPF</Form.Label>
                        <Form.Control
                          type="text"
                          name="cpf"
                          value={formData.cpf.replace(/\D/g, '').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2')}
                          onChange={handleInputChange}
                          maxLength={14}
                          isInvalid={!!errors.cpf}
                        />
                        <Form.Control.Feedback type="invalid">{errors.cpf}</Form.Control.Feedback>
                      </Form.Group>
                    </Col>

                    {/* Campos do responsável (aparecem se menor de idade) */}
                    {menorDeIdade && (
                      <Col md={12}>
                        <Card className="card--areia">
                          <Card.Body>
                            <h3 className="h5 mb-3">Dados do Responsável</h3>
                            <Row className="g-3">
                              <Col md={6}>
                                <Form.Group controlId="responsavel">
                                  <Form.Label>Nome do Responsável</Form.Label>
                                  <Form.Control
                                    type="text"
                                    name="responsavel"
                                    value={formData.responsavel}
                                    onChange={handleInputChange}
                                    isInvalid={!!errors.responsavel}
                                  />
                                  <Form.Control.Feedback type="invalid">{errors.responsavel}</Form.Control.Feedback>
                                </Form.Group>
                              </Col>
                              <Col md={6}>
                                <Form.Group controlId="telefoneResponsavel">
                                  <Form.Label>Telefone do Responsável</Form.Label>
                                  <Form.Control
                                    type="tel"
                                    name="telefoneResponsavel"
                                    value={formData.telefoneResponsavel}
                                    onChange={handleInputChange}
                                    isInvalid={!!errors.telefoneResponsavel}
                                  />
                                  <Form.Control.Feedback type="invalid">{errors.telefoneResponsavel}</Form.Control.Feedback>
                                </Form.Group>
                              </Col>
                            </Row>
                          </Card.Body>
                        </Card>
                      </Col>
                    )}

                    <Col md={6}>
                      <Form.Group controlId="tipo">
                        <Form.Label>Tipo</Form.Label>
                        <Form.Select
                          name="tipo"
                          value={formData.tipo}
                          onChange={handleInputChange}
                          isInvalid={!!errors.tipo}
                        >
                          <option value="">...</option>
                          <option value="Presencial">Presencial</option>
                          <option value="Online">Online</option>
                        </Form.Select>
                        <Form.Control.Feedback type="invalid">{errors.tipo}</Form.Control.Feedback>
                      </Form.Group>
                    </Col>
                    <Col md={6}>
                      <Form.Group controlId="motivo">
                        <Form.Label>Motivo</Form.Label>
                        <Form.Select
                          name="motivo"
                          value={formData.motivo}
                          onChange={handleInputChange}
                          isInvalid={!!errors.motivo}
                        >
                          <option value="">...</option>
                          <option value="Dificuldade de Aprendizagem">Dificuldades de Aprendizagem</option>
                          <option value="Terapia Infantil">Terapia Infantil</option>
                          <option value="Orientação para pais">Orientação para Pais</option>
                          <option value="Ansiedade">Ansiedade</option>
                          <option value="Depressão">Depressão</option>
                          <option value="Outro">Outro</option>
                        </Form.Select>
                        <Form.Control.Feedback type="invalid">{errors.motivo}</Form.Control.Feedback>
                      </Form.Group>
                    </Col>

                    <Col md={12}>
                      <Form.Group controlId="observacoes">
                        <Form.Label>Observações</Form.Label>
                        <Form.Control
                          as="textarea"
                          name="observacoes"
                          value={formData.observacoes}
                          onChange={handleInputChange}
                          maxLength={500}
                          rows={5}
                        />
                        <Form.Text className="d-block text-end">{formData.observacoes.length}/500</Form.Text>
                      </Form.Group>
                    </Col>
                  </Row>

                  <div className="d-flex gap-3 mt-4">
                    <Button type="button" variant="outline-secondary" onClick={() => setStep(1)}>
                      <i className="bi bi-arrow-left me-2" />
                      Voltar
                    </Button>
                    <Button type="submit" variant="primary" disabled={loading} className="ms-auto">
                      <i className="bi bi-whatsapp me-2" />
                      {loading ? 'Agendando...' : 'Continuar no WhatsApp'}
                    </Button>
                  </div>
                </Form>
              </Card.Body>
            </Card>
          )}

          {/* Passo 3: Confirmação (fluxo antigo, hoje inalcançável — ver comentário no submit) */}
          {step === 3 && agendamentoRealizado && (
            <Card>
              <Card.Body>
                <div className="text-center mb-4">
                  <div className="pmc-icone pmc-icone--salvia mx-auto mb-3 fs-1">
                    <i className="bi bi-check-lg" />
                  </div>
                  <h2>Agendamento Realizado com Sucesso!</h2>
                </div>

                <Card className="card--areia mb-4">
                  <Card.Body>
                    <h3 className="h5 mb-3">Dados do Agendamento:</h3>
                    <p><strong>Data:</strong> {new Date(agendamentoRealizado.consulta.data + 'T12:00:00').toLocaleDateString('pt-BR')}</p>
                    <p><strong>Horário:</strong> {agendamentoRealizado.consulta.hora}</p>
                    <p><strong>Paciente:</strong> {agendamentoRealizado.paciente.nome}</p>
                    <p className="mb-0"><strong>ID da Consulta:</strong> {agendamentoRealizado.consulta.id}</p>
                  </Card.Body>
                </Card>

                <Card bg="info" className="mb-4">
                  <Card.Body>
                    <h3 className="h5 mb-3">Pagamento:</h3>
                    <p><strong>Valor:</strong> R$ 150,00</p>
                    <p className="mb-3"><strong>Status:</strong> Pendente</p>
                    <p className="mb-0">
                      <i className="bi bi-credit-card me-2" />
                      O pagamento deve ser realizado na área do paciente após o agendamento.
                    </p>
                  </Card.Body>
                </Card>

                <Card bg="warning" className="mb-4">
                  <Card.Body>
                    <h3 className="h5 mb-3">Acesso à Área Restrita:</h3>
                    <p><strong>Email:</strong> {agendamentoRealizado.acessoAreaRestrita.email}</p>
                    <p><strong>Senha:</strong> {agendamentoRealizado.acessoAreaRestrita.senha}</p>
                    <p className="small mb-0">
                      Use estes dados para acessar sua área restrita e receber o link da consulta.
                    </p>
                  </Card.Body>
                </Card>

                <div className="d-flex flex-wrap justify-content-center gap-3">
                  <Link href="/area-restrita">
                    <Button variant="primary">Acessar Área Restrita</Button>
                  </Link>
                  <Link href="/">
                    <Button variant="outline-secondary">Voltar ao Início</Button>
                  </Link>
                </div>

                <div className="alert alert-success mt-4 mb-0">
                  <i className="bi bi-envelope me-2" />
                  <strong>Importante:</strong> Você receberá um email com todas essas informações e o link para a consulta será enviado na sua área restrita próximo ao horário agendado.
                </div>
              </Card.Body>
            </Card>
          )}
        </Container>
      </section>
    </div>
  );
}
