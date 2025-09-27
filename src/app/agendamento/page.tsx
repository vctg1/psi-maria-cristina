
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import CalendarioAgendamento from '@/components/CalendarioAgendamento';

interface HorarioDisponivel {
  id: string;
  data: string;
  hora: string;
  tipo: string;
}

export default function AgendamentoPage() {
  const [step, setStep] = useState(1);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [availableTimes, setAvailableTimes] = useState<HorarioDisponivel[]>([]);
  const [loading, setLoading] = useState(false);
  const [agendamentoRealizado, setAgendamentoRealizado] = useState<any>(null);

  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    telefone: '',
    dataNascimento: '',
    cpf: '',
    responsavel: '',
    telefoneResponsavel: ''
  });

  const [errors, setErrors] = useState<{[key: string]: string}>({});

  // Gerar próximos 30 dias úteis (incluindo sábados)
  const generateAvailableDates = () => {
    const dates = [];
    const today = new Date();
    
    for (let i = 1; i <= 30; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      
      // Pular apenas domingos (domingo = 0)
      if (date.getDay() !== 0) {
        dates.push(date.toISOString().split('T')[0]);
      }
    }
    
    return dates;
  };

  const availableDates = generateAvailableDates();

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

    try {
      setLoading(true);
      const response = await fetch('/api/agendamento', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          paciente: formData,
          data: selectedDate,
          hora: selectedTime
        })
      });

      const result = await response.json();

      if (response.ok) {
        setAgendamentoRealizado(result);
        setStep(3);
      } else {
        alert(result.error || 'Erro ao realizar agendamento');
      }
    } catch (error) {
      console.error('Erro:', error);
      alert('Erro ao realizar agendamento');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Limpar erro do campo quando usuário começar a digitar
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8f9fa', fontFamily: 'Arial, sans-serif' }}>
      {/* Header */}
      <header style={{ 
        backgroundColor: '#ffffff', 
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)', 
        padding: '1rem 0' 
      }}>
        <nav style={{ 
          maxWidth: '1200px', 
          margin: '0 auto', 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          padding: '0 2rem'
        }}>
          <Link href="/" style={{ 
            fontSize: '1.5rem', 
            fontWeight: 'bold', 
            color: '#2c3e50',
            textDecoration: 'none'
          }}>
            Psicóloga Maria Cristina
          </Link>
        </nav>
      </header>

      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem' }}>
        <h1 style={{ textAlign: 'center', color: '#2c3e50', marginBottom: '2rem' }}>
          Agendamento de Consulta
        </h1>

        {/* Indicador de passos */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          marginBottom: '3rem',
          gap: '1rem'
        }}>
          {[1, 2, 3].map(num => (
            <div key={num} style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              backgroundColor: step >= num ? '#3498db' : '#ddd',
              color: step >= num ? 'white' : '#666',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 'bold'
            }}>
              {num}
            </div>
          ))}
        </div>

        {/* Passo 1: Seleção de data e horário */}
        {step === 1 && (
          <div style={{ backgroundColor: 'white', borderRadius: '10px', padding: '2rem', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
            <h2 style={{ marginBottom: '2rem', color: '#2c3e50' }}>Escolha a data e horário</h2>
            
            <CalendarioAgendamento
              selectedDate={selectedDate}
              onDateSelect={handleDateSelect}
              onTimeSelect={handleTimeSelect}
            />
          </div>
        )}

        {/* Passo 2: Dados do paciente */}
        {step === 2 && (
          <div style={{ backgroundColor: 'white', borderRadius: '10px', padding: '2rem', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
            <h2 style={{ marginBottom: '1rem', color: '#2c3e50' }}>Dados do Paciente</h2>
            <p style={{ marginBottom: '1rem', color: '#666' }}>
              Consulta agendada para: {new Date(selectedDate + 'T12:00:00').toLocaleDateString('pt-BR')} às {selectedTime}
            </p>
            <p style={{ marginBottom: '2rem', color: '#2c3e50', fontSize: '1.1rem', fontWeight: '600' }}>
              Valor da consulta: R$ 150,00 - <em>Pagamento será feito na área do paciente</em>
            </p>

            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>Nome Completo*</label>
                  <input
                    type="text"
                    name="nome"
                    value={formData.nome}
                    onChange={handleInputChange}
                    style={{
                      width: '100%',
                      padding: '12px',
                      border: errors.nome ? '1px solid #e74c3c' : '1px solid #ddd',
                      borderRadius: '5px',
                      fontSize: '16px'
                    }}
                  />
                  {errors.nome && <span style={{ color: '#e74c3c', fontSize: '14px' }}>{errors.nome}</span>}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>Email*</label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      style={{
                        width: '100%',
                        padding: '12px',
                        border: errors.email ? '1px solid #e74c3c' : '1px solid #ddd',
                        borderRadius: '5px',
                        fontSize: '16px'
                      }}
                    />
                    {errors.email && <span style={{ color: '#e74c3c', fontSize: '14px' }}>{errors.email}</span>}
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>Telefone*</label>
                    <input
                      type="tel"
                      name="telefone"
                      value={formData.telefone}
                      onChange={handleInputChange}
                      style={{
                        width: '100%',
                        padding: '12px',
                        border: errors.telefone ? '1px solid #e74c3c' : '1px solid #ddd',
                        borderRadius: '5px',
                        fontSize: '16px'
                      }}
                    />
                    {errors.telefone && <span style={{ color: '#e74c3c', fontSize: '14px' }}>{errors.telefone}</span>}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>Data de Nascimento*</label>
                    <input
                      type="date"
                      name="dataNascimento"
                      value={formData.dataNascimento}
                      onChange={handleInputChange}
                      style={{
                        width: '100%',
                        padding: '12px',
                        border: errors.dataNascimento ? '1px solid #e74c3c' : '1px solid #ddd',
                        borderRadius: '5px',
                        fontSize: '16px'
                      }}
                    />
                    {errors.dataNascimento && <span style={{ color: '#e74c3c', fontSize: '14px' }}>{errors.dataNascimento}</span>}
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>CPF*</label>
                    <input
                      type="text"
                      name="cpf"
                      value={formData.cpf}
                      onChange={handleInputChange}
                      style={{
                        width: '100%',
                        padding: '12px',
                        border: errors.cpf ? '1px solid #e74c3c' : '1px solid #ddd',
                        borderRadius: '5px',
                        fontSize: '16px'
                      }}
                    />
                    {errors.cpf && <span style={{ color: '#e74c3c', fontSize: '14px' }}>{errors.cpf}</span>}
                  </div>
                </div>

                {/* Campos do responsável (aparecem se menor de idade) */}
                {formData.dataNascimento && new Date().getFullYear() - new Date(formData.dataNascimento).getFullYear() < 18 && (
                  <>
                    <div>
                      <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>Nome do Responsável*</label>
                      <input
                        type="text"
                        name="responsavel"
                        value={formData.responsavel}
                        onChange={handleInputChange}
                        style={{
                          width: '100%',
                          padding: '12px',
                          border: errors.responsavel ? '1px solid #e74c3c' : '1px solid #ddd',
                          borderRadius: '5px',
                          fontSize: '16px'
                        }}
                      />
                      {errors.responsavel && <span style={{ color: '#e74c3c', fontSize: '14px' }}>{errors.responsavel}</span>}
                    </div>

                    <div>
                      <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>Telefone do Responsável*</label>
                      <input
                        type="tel"
                        name="telefoneResponsavel"
                        value={formData.telefoneResponsavel}
                        onChange={handleInputChange}
                        style={{
                          width: '100%',
                          padding: '12px',
                          border: errors.telefoneResponsavel ? '1px solid #e74c3c' : '1px solid #ddd',
                          borderRadius: '5px',
                          fontSize: '16px'
                        }}
                      />
                      {errors.telefoneResponsavel && <span style={{ color: '#e74c3c', fontSize: '14px' }}>{errors.telefoneResponsavel}</span>}
                    </div>
                  </>
                )}
              </div>

              <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  style={{
                    padding: '12px 24px',
                    border: '1px solid #ddd',
                    backgroundColor: 'white',
                    borderRadius: '5px',
                    cursor: 'pointer'
                  }}
                >
                  Voltar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    padding: '12px 24px',
                    border: 'none',
                    backgroundColor: loading ? '#ccc' : '#3498db',
                    color: 'white',
                    borderRadius: '5px',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    fontWeight: '500'
                  }}
                >
                  {loading ? 'Agendando...' : 'Confirmar Agendamento'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Passo 3: Confirmação */}
        {step === 3 && agendamentoRealizado && (
          <div style={{ backgroundColor: 'white', borderRadius: '10px', padding: '2rem', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
            <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
              <div style={{ 
                width: '80px', 
                height: '80px', 
                backgroundColor: '#27ae60', 
                borderRadius: '50%', 
                margin: '0 auto 1rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '2rem',
                color: 'white'
              }}>
                ✓
              </div>
              <h2 style={{ color: '#27ae60', marginBottom: '1rem' }}>Agendamento Realizado com Sucesso!</h2>
            </div>

            <div style={{ backgroundColor: '#f8f9fa', padding: '1.5rem', borderRadius: '8px', marginBottom: '2rem' }}>
              <h3 style={{ marginBottom: '1rem', color: '#2c3e50' }}>Dados do Agendamento:</h3>
              <p><strong>Data:</strong> {new Date(agendamentoRealizado.consulta.data + 'T12:00:00').toLocaleDateString('pt-BR')}</p>
              <p><strong>Horário:</strong> {agendamentoRealizado.consulta.hora}</p>
              <p><strong>Paciente:</strong> {agendamentoRealizado.paciente.nome}</p>
              <p><strong>ID da Consulta:</strong> {agendamentoRealizado.consulta.id}</p>
            </div>

            <div style={{ backgroundColor: '#e3f2fd', padding: '1.5rem', borderRadius: '8px', marginBottom: '2rem' }}>
              <h3 style={{ marginBottom: '1rem', color: '#1976d2' }}>Pagamento:</h3>
              <p><strong>Valor:</strong> R$ 150,00</p>
              <p><strong>Status:</strong> Pendente</p>
              
              <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: '#fff3cd', borderRadius: '5px', border: '1px solid #ffeaa7' }}>
                <p style={{ margin: 0, color: '#856404', fontWeight: '500' }}>
                  💳 O pagamento deve ser realizado na área do paciente após o agendamento.
                </p>
              </div>
            </div>

            <div style={{ backgroundColor: '#fff3cd', padding: '1.5rem', borderRadius: '8px', marginBottom: '2rem' }}>
              <h3 style={{ marginBottom: '1rem', color: '#856404' }}>Acesso à Área Restrita:</h3>
              <p><strong>Email:</strong> {agendamentoRealizado.acessoAreaRestrita.email}</p>
              <p><strong>Senha:</strong> {agendamentoRealizado.acessoAreaRestrita.senha}</p>
              <p style={{ fontSize: '14px', color: '#666', marginTop: '10px' }}>
                Use estes dados para acessar sua área restrita e receber o link da consulta.
              </p>
            </div>

            <div style={{ textAlign: 'center' }}>
              <Link href="/area-restrita" style={{
                display: 'inline-block',
                padding: '12px 24px',
                backgroundColor: '#3498db',
                color: 'white',
                textDecoration: 'none',
                borderRadius: '5px',
                fontWeight: '500',
                marginRight: '1rem'
              }}>
                Acessar Área Restrita
              </Link>
              <Link href="/" style={{
                display: 'inline-block',
                padding: '12px 24px',
                border: '1px solid #ddd',
                color: '#666',
                textDecoration: 'none',
                borderRadius: '5px'
              }}>
                Voltar ao Início
              </Link>
            </div>

            <div style={{ 
              marginTop: '2rem', 
              padding: '1rem', 
              backgroundColor: '#d4edda', 
              borderRadius: '8px',
              border: '1px solid #c3e6cb'
            }}>
              <p style={{ margin: 0, color: '#155724', fontSize: '14px' }}>
                <strong>📧 Importante:</strong> Você receberá um email com todas essas informações e o link para a consulta será enviado na sua área restrita próximo ao horário agendado.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}