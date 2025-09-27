'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Calendario from '@/components/Calendario';
import CheckoutTransparente from '@/components/CheckoutTransparente';
import CalendarioAgendamento from '@/components/CalendarioAgendamento';
import GerenciadorConsultas from '@/components/GerenciadorConsultas';
import NotificacaoProvider from '@/components/NotificacaoProvider';


export default function AreaRestritaPage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userType, setUserType] = useState<'paciente' | 'psicologa' | null>(null);
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [loginForm, setLoginForm] = useState({
    email: '',
    senha: '',
    tipo: 'paciente'
  });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch('/api/area-restrita', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(loginForm)
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setIsLoggedIn(true);
        setUserType(result.tipo);
        setUserData(result);
      } else {
        alert(result.error || 'Credenciais inválidas');
      }
    } catch (error) {
      console.error('Erro no login:', error);
      alert('Erro ao fazer login');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setUserType(null);
    setUserData(null);
    setLoginForm({ email: '', senha: '', tipo: 'paciente' });
  };

  const recarregarDados = async () => {
    if (userData?.paciente?.email) {
      try {
        const response = await fetch('/api/area-restrita', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: userData.paciente.email,
            senha: userData.paciente.id.slice(-8),
            tipo: 'paciente'
          })
        });

        const result = await response.json();
        if (response.ok && result.success) {
          setUserData(result);
        }
      } catch (error) {
        console.error('Erro ao recarregar dados:', error);
      }
    }
  };

  const recarregarDadosPaciente = async () => {
    if (userType === 'paciente' && userData?.paciente?.email) {
      try {
        const response = await fetch('/api/area-restrita', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: userData.paciente.email,
            senha: userData.paciente.id.slice(-8), // Usar a mesma lógica de senha
            tipo: 'paciente'
          })
        });

        if (response.ok) {
          const result = await response.json();
          setUserData(result); // Atualizar dados sem perder o login
        }
      } catch (error) {
        console.error('Erro ao recarregar dados do paciente:', error);
      }
    }
  };

  // Componente de Login
  if (!isLoggedIn) {
    return (
      <NotificacaoProvider>
        <div style={{ minHeight: '100vh', backgroundColor: '#f8f9fa', fontFamily: 'Arial, sans-serif' }}>
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

        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          minHeight: 'calc(100vh - 80px)',
          padding: '2rem'
        }}>
          <div style={{ 
            backgroundColor: 'white', 
            borderRadius: '10px', 
            padding: '3rem', 
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
            width: '100%',
            maxWidth: '400px'
          }}>
            <h1 style={{ textAlign: 'center', marginBottom: '2rem', color: '#2c3e50' }}>
              Área Restrita
            </h1>

            <form onSubmit={handleLogin}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>
                  Tipo de Acesso
                </label>
                <select
                  value={loginForm.tipo}
                  onChange={(e) => setLoginForm(prev => ({ ...prev, tipo: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '1px solid #ddd',
                    borderRadius: '5px',
                    fontSize: '16px'
                  }}
                >
                  <option value="paciente">Paciente</option>
                  <option value="psicologa">Psicóloga</option>
                </select>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>
                  Email
                </label>
                <input
                  type="email"
                  value={loginForm.email}
                  onChange={(e) => setLoginForm(prev => ({ ...prev, email: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '1px solid #ddd',
                    borderRadius: '5px',
                    fontSize: '16px'
                  }}
                  required
                />
              </div>

              <div style={{ marginBottom: '2rem' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>
                  Senha
                </label>
                <input
                  type="password"
                  value={loginForm.senha}
                  onChange={(e) => setLoginForm(prev => ({ ...prev, senha: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '1px solid #ddd',
                    borderRadius: '5px',
                    fontSize: '16px'
                  }}
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '12px',
                  backgroundColor: loading ? '#ccc' : '#3498db',
                  color: 'white',
                  border: 'none',
                  borderRadius: '5px',
                  fontSize: '16px',
                  fontWeight: '500',
                  cursor: loading ? 'not-allowed' : 'pointer'
                }}
              >
                {loading ? 'Entrando...' : 'Entrar'}
              </button>
            </form>

            <div style={{ 
              marginTop: '2rem', 
              padding: '1rem', 
              backgroundColor: '#f8f9fa', 
              borderRadius: '8px',
              fontSize: '14px',
              color: '#666'
            }}>
              <p style={{ margin: '0 0 10px 0' }}><strong>Para Pacientes:</strong></p>
              <p style={{ margin: '0 0 10px 0' }}>Use o email e senha enviados após o agendamento.</p>
              
              <p style={{ margin: '10px 0 10px 0' }}><strong>Para Psicóloga:</strong></p>
              <p style={{ margin: 0 }}>Email: psicologa@mariacristina.com</p>
              <p style={{ margin: 0 }}>Senha: admin123</p>
            </div>
          </div>
        </div>
      </div>
      </NotificacaoProvider>
    );
  }

  // Área Restrita do Paciente
  if (userType === 'paciente') {
    return (
      <NotificacaoProvider>
        <AreaPaciente 
          userData={userData} 
          onLogout={handleLogout} 
          onAtualizarDados={recarregarDadosPaciente}
        />
      </NotificacaoProvider>
    );
  }

  // Área Restrita da Psicóloga
  if (userType === 'psicologa') {
    return (
      <NotificacaoProvider>
        <AreaPsicologa userData={userData} onLogout={handleLogout} />
      </NotificacaoProvider>
    );
  }

  return null;
}

// Componente da Área do Paciente
function AreaPaciente({ 
  userData, 
  onLogout, 
  onAtualizarDados 
}: { 
  userData: any, 
  onLogout: () => void,
  onAtualizarDados: () => void
}) {
  const [abaSelecionada, setAbaSelecionada] = useState('consultas');
  const [checkoutAberto, setCheckoutAberto] = useState(false);
  const [consultaSelecionada, setConsultaSelecionada] = useState<any>(null);

  // Separar consultas por status
  const consultasProximas = userData.consultas.filter((c: any) => 
    ['agendada', 'confirmada'].includes(c.status) && new Date(c.data) >= new Date()
  );
  
  const consultasHistorico = userData.consultas.filter((c: any) => 
    ['realizada', 'cancelada', 'nao_compareceu'].includes(c.status) || new Date(c.data) < new Date()
  );

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8f9fa', fontFamily: 'Arial, sans-serif' }}>
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
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <span style={{ color: '#666' }}>Olá, {userData.paciente.nome}</span>
            <button 
              onClick={onLogout}
              style={{
                padding: '8px 16px',
                backgroundColor: '#e74c3c',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer'
              }}
            >
              Sair
            </button>
          </div>
        </nav>
      </header>

      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem' }}>
        {/* Menu de navegação */}
        <div style={{ 
          backgroundColor: 'white', 
          borderRadius: '10px', 
          padding: '1rem',
          marginBottom: '2rem',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          <div style={{ display: 'flex', gap: '1rem' }}>
            {[
              { key: 'consultas', label: 'Próximas Consultas' },
              { key: 'historico', label: 'Histórico' },
              { key: 'pagamentos', label: 'Pagamentos' },
              { key: 'nova-consulta', label: 'Nova Consulta' }
            ].map(aba => (
              <button
                key={aba.key}
                onClick={() => setAbaSelecionada(aba.key)}
                style={{
                  padding: '10px 20px',
                  backgroundColor: abaSelecionada === aba.key ? '#3498db' : 'transparent',
                  color: abaSelecionada === aba.key ? 'white' : '#666',
                  border: 'none',
                  borderRadius: '5px',
                  cursor: 'pointer',
                  fontWeight: abaSelecionada === aba.key ? '600' : '400'
                }}
              >
                {aba.label}
              </button>
            ))}
          </div>
        </div>

        {/* Próximas Consultas */}
        {abaSelecionada === 'consultas' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
              <h1 style={{ margin: 0, color: '#2c3e50' }}>Próximas Consultas</h1>
              <button 
                onClick={() => setAbaSelecionada('nova-consulta')}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#27ae60',
                  color: 'white',
                  border: 'none',
                  borderRadius: '5px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                + Nova Consulta
              </button>
            </div>
            
            {consultasProximas.length === 0 ? (
              <div style={{ 
                backgroundColor: 'white', 
                padding: '3rem', 
                borderRadius: '10px', 
                textAlign: 'center',
                boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
              }}>
                <p style={{ fontSize: '1.2rem', color: '#666' }}>Você não possui consultas agendadas.</p>
                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '1rem' }}>
                  <button onClick={() => setAbaSelecionada('nova-consulta')} style={{
                    padding: '12px 24px',
                    backgroundColor: '#27ae60',
                    color: 'white',
                    border: 'none',
                    borderRadius: '5px',
                    fontWeight: '500',
                    cursor: 'pointer'
                  }}>
                    Nova Consulta (Rápida)
                  </button>
                  <Link href="/agendamento" style={{
                    display: 'inline-block',
                    padding: '12px 24px',
                    backgroundColor: '#3498db',
                    color: 'white',
                    textDecoration: 'none',
                    borderRadius: '5px',
                    fontWeight: '500'
                  }}>
                    Agendar Consulta Completa
                  </Link>
                </div>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: '1rem' }}>
                {consultasProximas.map((consulta: any) => (
                  <GerenciadorConsultas
                    key={consulta.id}
                    consulta={consulta}
                    onConsultaAtualizada={() => window.location.reload()}
                    mostrarPaciente={false}
                    onPagarConsulta={(consultaSelecionada) => {
                      setConsultaSelecionada(consultaSelecionada);
                      setCheckoutAberto(true);
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Histórico */}
        {abaSelecionada === 'historico' && (
          <div>
            <h1 style={{ marginBottom: '2rem', color: '#2c3e50' }}>Histórico de Consultas</h1>
            
            {consultasHistorico.length === 0 ? (
              <div style={{ 
                backgroundColor: 'white', 
                padding: '3rem', 
                borderRadius: '10px', 
                textAlign: 'center',
                boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
              }}>
                <p style={{ fontSize: '1.2rem', color: '#666' }}>Nenhuma consulta no histórico.</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: '1rem' }}>
                {consultasHistorico.map((consulta: any) => (
                  <div key={consulta.id} style={{ 
                    backgroundColor: 'white', 
                    padding: '1.5rem', 
                    borderRadius: '10px',
                    boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                    opacity: consulta.status === 'cancelada' ? 0.7 : 1
                  }}>
                    <div>
                      <h3 style={{ margin: '0 0 10px 0', color: '#2c3e50' }}>
                        {new Date(consulta.data + 'T12:00:00').toLocaleDateString('pt-BR')} - {consulta.hora}
                      </h3>
                      <p style={{ margin: '0 0 5px 0' }}>
                        <strong>Status:</strong> 
                        <span style={{ 
                          marginLeft: '8px',
                          padding: '4px 8px',
                          borderRadius: '4px',
                          fontSize: '12px',
                          backgroundColor: 
                            consulta.status === 'realizada' ? '#d1ecf1' : '#f8d7da',
                          color:
                            consulta.status === 'realizada' ? '#0c5460' : '#721c24'
                        }}>
                          {consulta.status.charAt(0).toUpperCase() + consulta.status.slice(1)}
                        </span>
                      </p>
                      <p style={{ margin: '0 0 5px 0' }}>
                        <strong>Pagamento:</strong> 
                        <span style={{ 
                          marginLeft: '8px',
                          padding: '4px 8px',
                          borderRadius: '4px',
                          fontSize: '12px',
                          backgroundColor: consulta.pagamento === 'pago' ? '#d4edda' : 
                                          consulta.pagamento === 'cancelado' ? '#f8d7da' : '#fff3cd',
                          color: consulta.pagamento === 'pago' ? '#155724' : 
                                consulta.pagamento === 'cancelado' ? '#721c24' : '#856404'
                        }}>
                          {consulta.pagamento.charAt(0).toUpperCase() + consulta.pagamento.slice(1)}
                        </span>
                      </p>
                      <p style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#666' }}>
                        <strong>Valor:</strong> R$ 150,00
                      </p>
                      
                      {consulta.relatorio && (
                        <div style={{
                          backgroundColor: '#f8f9fa',
                          padding: '1rem',
                          borderRadius: '5px',
                          marginTop: '10px'
                        }}>
                          <h4 style={{ margin: '0 0 10px 0', color: '#2c3e50', fontSize: '14px' }}>Relatório da Consulta:</h4>
                          <p style={{ margin: 0, fontSize: '14px', color: '#666', lineHeight: 1.5 }}>
                            {consulta.relatorio}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Pagamentos */}
        {abaSelecionada === 'pagamentos' && (
          <div>
            <h1 style={{ marginBottom: '2rem', color: '#2c3e50' }}>Pagamentos</h1>
            
            <div style={{ display: 'grid', gap: '1rem' }}>
              {userData.consultas.map((consulta: any) => (
                <div key={consulta.id} style={{ 
                  backgroundColor: 'white', 
                  padding: '1.5rem', 
                  borderRadius: '10px',
                  boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <h3 style={{ margin: '0 0 10px 0', color: '#2c3e50' }}>
                        Consulta - {new Date(consulta.data + 'T12:00:00').toLocaleDateString('pt-BR')}
                      </h3>
                      <p style={{ margin: '0 0 5px 0', fontSize: '14px', color: '#666' }}>
                        <strong>Horário:</strong> {consulta.hora}
                      </p>
                      <p style={{ margin: '0 0 5px 0', fontSize: '16px', fontWeight: '600' }}>
                        <strong>Valor:</strong> R$ 150,00
                      </p>
                      <p style={{ margin: 0 }}>
                        <strong>Status:</strong> 
                        <span style={{ 
                          marginLeft: '8px',
                          padding: '4px 8px',
                          borderRadius: '4px',
                          fontSize: '12px',
                          backgroundColor: 
                            consulta.pagamento === 'pago' ? '#d4edda' : 
                            consulta.pagamento === 'cancelado' ? '#f8d7da' : '#fff3cd',
                          color: 
                            consulta.pagamento === 'pago' ? '#155724' : 
                            consulta.pagamento === 'cancelado' ? '#721c24' : '#856404'
                        }}>
                          {consulta.pagamento === 'pago' ? 'Pago' : 
                           consulta.pagamento === 'cancelado' ? 'Cancelado' : 'Pendente'}
                        </span>
                      </p>
                    </div>
                    
                    <div>
                      {consulta.pagamento === 'pendente' && (
                        <div style={{ textAlign: 'center' }}>
                          <p style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#666' }}>
                            Vencimento: {new Date(consulta.data).toLocaleDateString('pt-BR')}
                          </p>
                          <button
                            onClick={() => {
                              setConsultaSelecionada(consulta);
                              setCheckoutAberto(true);
                            }}
                            style={{
                              padding: '10px 20px',
                              backgroundColor: '#007bff',
                              color: 'white',
                              border: 'none',
                              borderRadius: '5px',
                              cursor: 'pointer',
                              fontWeight: '500'
                            }}
                          >
                            Pagar Agora
                          </button>
                        </div>
                      )}
                      
                      {consulta.pagamento === 'pago' && (
                        <div style={{ textAlign: 'center' }}>
                          <div style={{
                            width: '50px',
                            height: '50px',
                            backgroundColor: '#28a745',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            margin: '0 auto 10px auto'
                          }}>
                            <span style={{ color: 'white', fontSize: '20px' }}>✓</span>
                          </div>
                          <p style={{ margin: 0, fontSize: '12px', color: '#666' }}>
                            Pago em {new Date(consulta.criadaEm).toLocaleDateString('pt-BR')}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            <div style={{
              backgroundColor: 'white',
              padding: '2rem',
              borderRadius: '10px',
              boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
              marginTop: '2rem'
            }}>
              <h3 style={{ marginBottom: '1rem', color: '#2c3e50' }}>Formas de Pagamento Aceitas</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '20px' }}>💳</span>
                  <span>PIX - Aprovação instantânea</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '20px' }}>💳</span>
                  <span>Cartão de Crédito - Até 12x</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Nova Consulta */}
        {abaSelecionada === 'nova-consulta' && (
          <NovaConsulta 
            paciente={userData.paciente} 
            onConsultaAgendada={onAtualizarDados}
            onMudarAba={setAbaSelecionada}
          />
        )}
      </div>

      {/* Checkout Transparente */}
      {checkoutAberto && consultaSelecionada && (
        <CheckoutTransparente
          consulta={consultaSelecionada}
          paciente={userData.paciente}
          onPagamentoSucesso={() => {
            setCheckoutAberto(false);
            setConsultaSelecionada(null);
            // Atualizar dados sem recarregar a página para manter o login
            onAtualizarDados();
          }}
          onFechar={() => {
            setCheckoutAberto(false);
            setConsultaSelecionada(null);
          }}
        />
      )}
    </div>
  );
}

// Componente para Nova Consulta
function NovaConsulta({ 
  paciente, 
  onConsultaAgendada,
  onMudarAba
}: { 
  paciente: any, 
  onConsultaAgendada: () => void,
  onMudarAba?: (aba: string) => void
}) {
  const [step, setStep] = useState(1);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [availableTimes, setAvailableTimes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [agendamentoRealizado, setAgendamentoRealizado] = useState<any>(null);

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
    setStep(2);
  };

  const handleConfirm = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/agendamento', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          paciente: {
            nome: paciente.nome,
            email: paciente.email,
            telefone: paciente.telefone,
            dataNascimento: paciente.dataNascimento,
            cpf: paciente.cpf,
            responsavel: paciente.responsavel || '',
            telefoneResponsavel: paciente.telefoneResponsavel || ''
          },
          data: selectedDate,
          hora: selectedTime
        })
      });

      const result = await response.json();

      if (response.ok) {
        setAgendamentoRealizado(result);
        setStep(3);
        onConsultaAgendada(); // Atualizar dados do paciente
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

  const resetForm = () => {
    setStep(1);
    setSelectedDate('');
    setSelectedTime('');
    setAvailableTimes([]);
    setAgendamentoRealizado(null);
  };

  return (
    <div>
      <h1 style={{ marginBottom: '2rem', color: '#2c3e50' }}>Agendar Nova Consulta</h1>
      
      {/* Informações do paciente */}
      <div style={{ 
        backgroundColor: 'white', 
        padding: '1.5rem', 
        borderRadius: '10px',
        marginBottom: '2rem',
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
      }}>
        <h3 style={{ marginBottom: '1rem', color: '#2c3e50' }}>Dados do Paciente</h3>
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(2, 1fr)', 
          gap: '1rem',
          backgroundColor: '#f8f9fa',
          padding: '1rem',
          borderRadius: '8px'
        }}>
          <div>
            <p style={{ margin: '0 0 5px 0' }}><strong>Nome:</strong> {paciente.nome}</p>
            <p style={{ margin: '0 0 5px 0' }}><strong>Email:</strong> {paciente.email}</p>
            <p style={{ margin: 0 }}><strong>Telefone:</strong> {paciente.telefone}</p>
          </div>
          <div>
            <p style={{ margin: '0 0 5px 0' }}><strong>CPF:</strong> {paciente.cpf}</p>
            <p style={{ margin: '0 0 5px 0' }}><strong>Data de Nascimento:</strong> {new Date(paciente.dataNascimento).toLocaleDateString('pt-BR')}</p>
            {paciente.responsavel && (
              <p style={{ margin: 0 }}><strong>Responsável:</strong> {paciente.responsavel}</p>
            )}
          </div>
        </div>
      </div>

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
        <div style={{ 
          backgroundColor: 'white', 
          borderRadius: '10px', 
          padding: '2rem', 
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)' 
        }}>
          <h2 style={{ marginBottom: '2rem', color: '#2c3e50' }}>Escolha a data e horário</h2>
          
          <CalendarioAgendamento
            selectedDate={selectedDate}
            onDateSelect={handleDateSelect}
            onTimeSelect={handleTimeSelect}
          />
        </div>
      )}

      {/* Passo 2: Confirmação */}
      {step === 2 && (
        <div style={{ 
          backgroundColor: 'white', 
          borderRadius: '10px', 
          padding: '2rem', 
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)' 
        }}>
          <h2 style={{ marginBottom: '2rem', color: '#2c3e50' }}>Confirmar Agendamento</h2>
          
          <div style={{ 
            backgroundColor: '#f8f9fa', 
            padding: '1.5rem', 
            borderRadius: '8px', 
            marginBottom: '2rem' 
          }}>
            <h3 style={{ marginBottom: '1rem', color: '#2c3e50' }}>Dados do Agendamento:</h3>
            <div style={{ display: 'grid', gap: '10px' }}>
              <p style={{ margin: 0 }}><strong>Data:</strong> {new Date(selectedDate + 'T12:00:00').toLocaleDateString('pt-BR')}</p>
              <p style={{ margin: 0 }}><strong>Horário:</strong> {selectedTime}</p>
              <p style={{ margin: 0 }}><strong>Paciente:</strong> {paciente.nome}</p>
              <p style={{ margin: 0 }}><strong>Valor:</strong> R$ 150,00</p>
            </div>
          </div>

          <div style={{ 
            backgroundColor: '#e3f2fd', 
            padding: '1.5rem', 
            borderRadius: '8px', 
            marginBottom: '2rem' 
          }}>
            <h3 style={{ marginBottom: '1rem', color: '#1976d2' }}>Informações Importantes:</h3>
            <ul style={{ margin: 0, paddingLeft: '20px', color: '#1976d2' }}>
              <li>O pagamento deve ser realizado na aba "Pagamentos" após a confirmação</li>
              <li>Você receberá o link da consulta próximo ao horário agendado</li>
              <li>Em caso de dúvidas, entre em contato conosco</li>
            </ul>
          </div>

          <div style={{ display: 'flex', gap: '1rem' }}>
            <button
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
              onClick={handleConfirm}
              disabled={loading}
              style={{
                padding: '12px 24px',
                border: 'none',
                backgroundColor: loading ? '#ccc' : '#27ae60',
                color: 'white',
                borderRadius: '5px',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontWeight: '500'
              }}
            >
              {loading ? 'Agendando...' : 'Confirmar Agendamento'}
            </button>
          </div>
        </div>
      )}

      {/* Passo 3: Sucesso */}
      {step === 3 && agendamentoRealizado && (
        <div style={{ 
          backgroundColor: 'white', 
          borderRadius: '10px', 
          padding: '2rem', 
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)' 
        }}>
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
            <h2 style={{ color: '#27ae60', marginBottom: '1rem' }}>Nova Consulta Agendada com Sucesso!</h2>
          </div>

          <div style={{ 
            backgroundColor: '#f8f9fa', 
            padding: '1.5rem', 
            borderRadius: '8px', 
            marginBottom: '2rem' 
          }}>
            <h3 style={{ marginBottom: '1rem', color: '#2c3e50' }}>Detalhes da Consulta:</h3>
            <div style={{ display: 'grid', gap: '10px' }}>
              <p style={{ margin: 0 }}><strong>Data:</strong> {new Date(agendamentoRealizado.consulta.data + 'T12:00:00').toLocaleDateString('pt-BR')}</p>
              <p style={{ margin: 0 }}><strong>Horário:</strong> {agendamentoRealizado.consulta.hora}</p>
              <p style={{ margin: 0 }}><strong>ID da Consulta:</strong> {agendamentoRealizado.consulta.id}</p>
              <p style={{ margin: 0 }}><strong>Valor:</strong> R$ 150,00</p>
              <p style={{ margin: 0 }}><strong>Status:</strong> Agendada</p>
            </div>
          </div>

          <div style={{ 
            backgroundColor: '#fff3cd', 
            padding: '1.5rem', 
            borderRadius: '8px', 
            marginBottom: '2rem',
            border: '1px solid #ffeaa7'
          }}>
            <h3 style={{ marginBottom: '1rem', color: '#856404' }}>Próximos Passos:</h3>
            <ol style={{ margin: 0, paddingLeft: '20px', color: '#856404' }}>
              <li>Acesse a aba "Pagamentos" para realizar o pagamento da consulta</li>
              <li>O link da consulta será disponibilizado próximo ao horário agendado</li>
              <li>Verifique suas consultas na aba "Próximas Consultas"</li>
            </ol>
          </div>

          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
            <button
              onClick={resetForm}
              style={{
                padding: '12px 24px',
                border: '1px solid #ddd',
                backgroundColor: 'white',
                borderRadius: '5px',
                cursor: 'pointer'
              }}
            >
              Agendar Outra Consulta
            </button>
            <button
              onClick={() => onMudarAba && onMudarAba('pagamentos')}
              style={{
                padding: '12px 24px',
                border: 'none',
                backgroundColor: '#3498db',
                color: 'white',
                borderRadius: '5px',
                cursor: 'pointer',
                fontWeight: '500'
              }}
            >
              Ir para Pagamentos
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Componente da Área da Psicóloga
function AreaPsicologa({ userData, onLogout }: { userData: any, onLogout: () => void }) {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/area-restrita?action=dashboard');
      const data = await response.json();
      setDashboardData(data);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  // Carregar dados do dashboard ao entrar
  useEffect(() => {
    if (activeTab === 'dashboard') {
      loadDashboardData();
    }
  }, [activeTab]);

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8f9fa', fontFamily: 'Arial, sans-serif' }}>
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
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <span style={{ color: '#666' }}>Olá, {userData.nome}</span>
            <button 
              onClick={onLogout}
              style={{
                padding: '8px 16px',
                backgroundColor: '#e74c3c',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer'
              }}
            >
              Sair
            </button>
          </div>
        </nav>
      </header>

      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem' }}>
        {/* Menu de navegação */}
        <div style={{ 
          backgroundColor: 'white', 
          borderRadius: '10px', 
          padding: '1rem',
          marginBottom: '2rem',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          <div style={{ display: 'flex', gap: '1rem' }}>
            {[
              { key: 'dashboard', label: 'Dashboard' },
              { key: 'consultas', label: 'Consultas' },
              { key: 'pacientes', label: 'Pacientes' },
              { key: 'horarios', label: 'Horários' },
              { key: 'calendario', label: 'Calendário' }
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                style={{
                  padding: '10px 20px',
                  backgroundColor: activeTab === tab.key ? '#3498db' : 'transparent',
                  color: activeTab === tab.key ? 'white' : '#666',
                  border: 'none',
                  borderRadius: '5px',
                  cursor: 'pointer',
                  fontWeight: activeTab === tab.key ? '600' : '400'
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Conteúdo das abas */}
        {activeTab === 'dashboard' && (
          <DashboardPsicologa 
            dashboardData={dashboardData} 
            loading={loading} 
            loadDashboardData={loadDashboardData}
          />
        )}
        
        {activeTab === 'consultas' && (
          <ConsultasPsicologa />
        )}
        
        {activeTab === 'pacientes' && (
          <PacientesPsicologa />
        )}
        
        {activeTab === 'horarios' && (
          <HorariosPsicologa />
        )}
        
        {activeTab === 'calendario' && (
          <CalendarioPsicologa />
        )}
      </div>
    </div>
  );
}

// Componentes das abas da psicóloga
function DashboardPsicologa({ 
  dashboardData, 
  loading, 
  loadDashboardData 
}: { 
  dashboardData: any, 
  loading: boolean,
  loadDashboardData: () => void 
}) {
  const marcarNotificacaoLida = async (notificacaoId?: string) => {
    try {
      await fetch('/api/area-restrita', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          notificacaoId, 
          marcarTodas: !notificacaoId 
        })
      });
      
      // Recarregar apenas os dados do dashboard sem recarregar a página
      loadDashboardData();
    } catch (error) {
      console.error('Erro ao marcar notificação como lida:', error);
    }
  };

  if (loading) return <div>Carregando...</div>;

  return (
    <div style={{ display: 'grid', gap: '2rem' }}>
      {/* Cards de estatísticas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
        <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '10px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', textAlign: 'center' }}>
          <h3 style={{ color: '#3498db', fontSize: '2rem', margin: '0 0 5px 0' }}>
            {dashboardData?.consultasHoje?.length || 0}
          </h3>
          <p style={{ margin: 0, color: '#666' }}>Consultas Hoje</p>
        </div>
        
        <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '10px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', textAlign: 'center' }}>
          <h3 style={{ color: '#27ae60', fontSize: '2rem', margin: '0 0 5px 0' }}>
            {dashboardData?.consultasProximas?.length || 0}
          </h3>
          <p style={{ margin: 0, color: '#666' }}>Próximos 7 dias</p>
        </div>
        
        <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '10px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', textAlign: 'center' }}>
          <h3 style={{ color: '#f39c12', fontSize: '2rem', margin: '0 0 5px 0' }}>
            {dashboardData?.pacientes?.length || 0}
          </h3>
          <p style={{ margin: 0, color: '#666' }}>Total Pacientes</p>
        </div>
        
        <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '10px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', textAlign: 'center' }}>
          <h3 style={{ color: '#e74c3c', fontSize: '2rem', margin: '0 0 5px 0' }}>
            {dashboardData?.notificacoes?.filter((n: any) => !n.lida).length || 0}
          </h3>
          <p style={{ margin: 0, color: '#666' }}>Notificações</p>
        </div>
      </div>

      {/* Consultas de hoje */}
      <div style={{ backgroundColor: 'white', padding: '2rem', borderRadius: '10px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
        <h2 style={{ marginBottom: '1rem', color: '#2c3e50' }}>Consultas de Hoje</h2>
        {dashboardData?.consultasHoje?.length > 0 ? (
          <div style={{ display: 'grid', gap: '1rem' }}>
            {dashboardData.consultasHoje.map((consulta: any) => {
              const paciente = dashboardData.pacientes.find((p: any) => p.id === consulta.pacienteId);
              const consultaComNome = {
                ...consulta,
                pacienteNome: paciente?.nome || 'Nome não disponível'
              };
              
              return (
                <GerenciadorConsultas
                  key={consulta.id}
                  consulta={consultaComNome}
                  onConsultaAtualizada={loadDashboardData}
                  mostrarPaciente={true}
                />
              );
            })}
          </div>
        ) : (
          <p style={{ color: '#666' }}>Nenhuma consulta agendada para hoje.</p>
        )}
      </div>

      {/* Notificações recentes */}
      <div style={{ backgroundColor: 'white', padding: '2rem', borderRadius: '10px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ margin: 0, color: '#2c3e50' }}>Notificações Recentes</h2>
          {dashboardData?.notificacoes?.some((n: any) => !n.lida) && (
            <button
              onClick={() => marcarNotificacaoLida()}
              style={{
                padding: '6px 12px',
                backgroundColor: '#17a2b8',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px'
              }}
            >
              Marcar Todas como Lidas
            </button>
          )}
        </div>
        
        {dashboardData?.notificacoes?.length > 0 ? (
          <div style={{ display: 'grid', gap: '1rem' }}>
            {dashboardData.notificacoes.slice(0, 5).map((notificacao: any) => (
              <div key={notificacao.id} style={{ 
                padding: '1rem', 
                backgroundColor: notificacao.lida ? '#f8f9fa' : '#fff3cd',
                borderRadius: '5px',
                border: '1px solid #ddd',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start'
              }}>
                <div style={{ flex: 1 }}>
                  <h4 style={{ margin: '0 0 5px 0', color: '#2c3e50' }}>{notificacao.titulo}</h4>
                  <p style={{ margin: '0 0 5px 0', color: '#666' }}>{notificacao.mensagem}</p>
                  <small style={{ color: '#999' }}>
                    {new Date(notificacao.criadaEm).toLocaleString('pt-BR')}
                  </small>
                </div>
                
                {!notificacao.lida && (
                  <button
                    onClick={() => marcarNotificacaoLida(notificacao.id)}
                    style={{
                      padding: '4px 8px',
                      backgroundColor: '#28a745',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '11px',
                      marginLeft: '10px'
                    }}
                  >
                    Marcar como Lida
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p style={{ color: '#666' }}>Nenhuma notificação.</p>
        )}
      </div>
    </div>
  );
}

function ConsultasPsicologa() {
  const [consultas, setConsultas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [consultaSelecionada, setConsultaSelecionada] = useState<any>(null);
  const [modalAberto, setModalAberto] = useState(false);

  useEffect(() => {
    carregarConsultas();
  }, []);

  const carregarConsultas = async () => {
    try {
      const response = await fetch('/api/area-restrita?action=consultas');
      const data = await response.json();
      setConsultas(data);
    } catch (error) {
      console.error('Erro ao carregar consultas:', error);
    } finally {
      setLoading(false);
    }
  };

  const atualizarConsulta = async (consultaId: string, updates: any) => {
    try {
      const response = await fetch('/api/area-restrita', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ consultaId, updates })
      });

      if (response.ok) {
        carregarConsultas();
        setModalAberto(false);
        setConsultaSelecionada(null);
        alert('Consulta atualizada com sucesso!');
      }
    } catch (error) {
      console.error('Erro ao atualizar consulta:', error);
      alert('Erro ao atualizar consulta');
    }
  };

  const iniciarConsulta = async (consulta: any) => {
    const linkMeet = `https://meet.google.com/${Math.random().toString(36).substring(2, 15)}`;
    await atualizarConsulta(consulta.id, {
      status: 'confirmada',
      linkMeet
    });
  };

  if (loading) return <div>Carregando...</div>;

  return (
    <div style={{ backgroundColor: 'white', padding: '2rem', borderRadius: '10px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
      <h2 style={{ marginBottom: '2rem', color: '#2c3e50' }}>Gerenciar Consultas</h2>
      
      <div style={{ display: 'grid', gap: '1rem' }}>
        {consultas.length === 0 ? (
          <p style={{ color: '#666' }}>Nenhuma consulta encontrada.</p>
        ) : (
          consultas.map((consulta: any) => (
            <div key={consulta.id} style={{
              border: '1px solid #ddd',
              borderRadius: '8px',
              padding: '1.5rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <h3 style={{ margin: '0 0 10px 0', color: '#2c3e50' }}>
                  {new Date(consulta.data + 'T12:00:00').toLocaleDateString('pt-BR')} - {consulta.hora}
                </h3>
                <p style={{ margin: '0 0 5px 0' }}>
                  <strong>Paciente:</strong> {consulta.paciente?.nome}
                </p>
                <p style={{ margin: '0 0 5px 0' }}>
                  <strong>Status:</strong> 
                  <span style={{
                    marginLeft: '8px',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    backgroundColor: 
                      consulta.status === 'agendada' ? '#fff3cd' :
                      consulta.status === 'confirmada' ? '#d4edda' :
                      consulta.status === 'realizada' ? '#d1ecf1' : '#f8d7da',
                    color:
                      consulta.status === 'agendada' ? '#856404' :
                      consulta.status === 'confirmada' ? '#155724' :
                      consulta.status === 'realizada' ? '#0c5460' : '#721c24'
                  }}>
                    {consulta.status.charAt(0).toUpperCase() + consulta.status.slice(1)}
                  </span>
                </p>
                <p style={{ margin: 0 }}>
                  <strong>Pagamento:</strong>
                  <span style={{
                    marginLeft: '8px',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    backgroundColor: consulta.pagamento === 'pago' ? '#d4edda' : '#fff3cd',
                    color: consulta.pagamento === 'pago' ? '#155724' : '#856404'
                  }}>
                    {consulta.pagamento.charAt(0).toUpperCase() + consulta.pagamento.slice(1)}
                  </span>
                </p>
              </div>
              
              <div style={{ display: 'flex', gap: '10px', flexDirection: 'column' }}>
                <button
                  onClick={() => {
                    setConsultaSelecionada(consulta);
                    setModalAberto(true);
                  }}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#3498db',
                    color: 'white',
                    border: 'none',
                    borderRadius: '5px',
                    cursor: 'pointer',
                    fontSize: '14px'
                  }}
                >
                  Editar
                </button>
                
                {consulta.status === 'agendada' && (
                  <button
                    onClick={() => iniciarConsulta(consulta)}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: '#27ae60',
                      color: 'white',
                      border: 'none',
                      borderRadius: '5px',
                      cursor: 'pointer',
                      fontSize: '14px'
                    }}
                  >
                    Iniciar
                  </button>
                )}
                
                {consulta.linkMeet && (
                  <a
                    href={consulta.linkMeet}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      padding: '8px 16px',
                      backgroundColor: '#f39c12',
                      color: 'white',
                      textDecoration: 'none',
                      borderRadius: '5px',
                      textAlign: 'center',
                      fontSize: '14px'
                    }}
                  >
                    Abrir Meet
                  </a>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal de edição */}
      {modalAberto && consultaSelecionada && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '2rem',
            borderRadius: '10px',
            minWidth: '500px',
            maxHeight: '80vh',
            overflow: 'auto'
          }}>
            <h3 style={{ marginBottom: '1rem' }}>Editar Consulta</h3>
            
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '5px' }}>Status:</label>
              <select
                value={consultaSelecionada.status}
                onChange={(e) => setConsultaSelecionada({...consultaSelecionada, status: e.target.value})}
                style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '5px' }}
              >
                <option value="agendada">Agendada</option>
                <option value="confirmada">Confirmada</option>
                <option value="realizada">Realizada</option>
                <option value="cancelada">Cancelada</option>
                <option value="nao_compareceu">Não Compareceu</option>
              </select>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '5px' }}>Pagamento:</label>
              <select
                value={consultaSelecionada.pagamento}
                onChange={(e) => setConsultaSelecionada({...consultaSelecionada, pagamento: e.target.value})}
                style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '5px' }}
              >
                <option value="pendente">Pendente</option>
                <option value="pago">Pago</option>
                <option value="cancelado">Cancelado</option>
              </select>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '5px' }}>Link do Meet:</label>
              <input
                type="url"
                value={consultaSelecionada.linkMeet || ''}
                onChange={(e) => setConsultaSelecionada({...consultaSelecionada, linkMeet: e.target.value})}
                placeholder="https://meet.google.com/..."
                style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '5px' }}
              />
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '5px' }}>Observações:</label>
              <textarea
                value={consultaSelecionada.observacoes || ''}
                onChange={(e) => setConsultaSelecionada({...consultaSelecionada, observacoes: e.target.value})}
                rows={3}
                style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '5px' }}
              />
            </div>

            <div style={{ marginBottom: '2rem' }}>
              <label style={{ display: 'block', marginBottom: '5px' }}>Relatório:</label>
              <textarea
                value={consultaSelecionada.relatorio || ''}
                onChange={(e) => setConsultaSelecionada({...consultaSelecionada, relatorio: e.target.value})}
                rows={4}
                style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '5px' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '1rem' }}>
              <button
                onClick={() => {
                  setModalAberto(false);
                  setConsultaSelecionada(null);
                }}
                style={{
                  padding: '10px 20px',
                  border: '1px solid #ddd',
                  backgroundColor: 'white',
                  borderRadius: '5px',
                  cursor: 'pointer'
                }}
              >
                Cancelar
              </button>
              <button
                onClick={() => atualizarConsulta(consultaSelecionada.id, {
                  status: consultaSelecionada.status,
                  pagamento: consultaSelecionada.pagamento,
                  linkMeet: consultaSelecionada.linkMeet,
                  observacoes: consultaSelecionada.observacoes,
                  relatorio: consultaSelecionada.relatorio
                })}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#3498db',
                  color: 'white',
                  border: 'none',
                  borderRadius: '5px',
                  cursor: 'pointer'
                }}
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PacientesPsicologa() {
  const [pacientes, setPacientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pacienteSelecionado, setPacienteSelecionado] = useState<any>(null);

  useEffect(() => {
    carregarPacientes();
  }, []);

  const carregarPacientes = async () => {
    try {
      const response = await fetch('/api/area-restrita?action=pacientes');
      const data = await response.json();
      setPacientes(data);
    } catch (error) {
      console.error('Erro ao carregar pacientes:', error);
    } finally {
      setLoading(false);
    }
  };

  const carregarDetalhesPaciente = async (pacienteId: string) => {
    try {
      const response = await fetch(`/api/area-restrita?action=pacientes&id=${pacienteId}`);
      const data = await response.json();
      setPacienteSelecionado(data);
    } catch (error) {
      console.error('Erro ao carregar detalhes do paciente:', error);
    }
  };

  if (loading) return <div>Carregando...</div>;

  return (
    <div style={{ backgroundColor: 'white', padding: '2rem', borderRadius: '10px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
      <h2 style={{ marginBottom: '2rem', color: '#2c3e50' }}>Pacientes</h2>
      
      {!pacienteSelecionado ? (
        <div>
          {pacientes.length === 0 ? (
            <p style={{ color: '#666' }}>Nenhum paciente cadastrado.</p>
          ) : (
            <div style={{ display: 'grid', gap: '1rem' }}>
              {pacientes.map((paciente: any) => (
                <div key={paciente.id} style={{
                  border: '1px solid #ddd',
                  borderRadius: '8px',
                  padding: '1.5rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div>
                    <h3 style={{ margin: '0 0 10px 0', color: '#2c3e50' }}>{paciente.nome}</h3>
                    <p style={{ margin: '0 0 5px 0', color: '#666' }}>
                      <strong>Email:</strong> {paciente.email}
                    </p>
                    <p style={{ margin: '0 0 5px 0', color: '#666' }}>
                      <strong>Telefone:</strong> {paciente.telefone}
                    </p>
                    <p style={{ margin: 0, color: '#666' }}>
                      <strong>Cadastrado em:</strong> {new Date(paciente.criadoEm).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                  
                  <button
                    onClick={() => carregarDetalhesPaciente(paciente.id)}
                    style={{
                      padding: '10px 20px',
                      backgroundColor: '#3498db',
                      color: 'white',
                      border: 'none',
                      borderRadius: '5px',
                      cursor: 'pointer'
                    }}
                  >
                    Ver Detalhes
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div>
          <button
            onClick={() => setPacienteSelecionado(null)}
            style={{
              padding: '8px 16px',
              backgroundColor: '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer',
              marginBottom: '2rem'
            }}
          >
            ← Voltar à Lista
          </button>

          <div style={{ marginBottom: '2rem' }}>
            <h3 style={{ color: '#2c3e50', marginBottom: '1rem' }}>Dados do Paciente</h3>
            <div style={{ 
              backgroundColor: '#f8f9fa', 
              padding: '1.5rem', 
              borderRadius: '8px',
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '1rem'
            }}>
              <div>
                <p><strong>Nome:</strong> {pacienteSelecionado.nome}</p>
                <p><strong>Email:</strong> {pacienteSelecionado.email}</p>
                <p><strong>Telefone:</strong> {pacienteSelecionado.telefone}</p>
              </div>
              <div>
                <p><strong>CPF:</strong> {pacienteSelecionado.cpf}</p>
                <p><strong>Data de Nascimento:</strong> {new Date(pacienteSelecionado.dataNascimento).toLocaleDateString('pt-BR')}</p>
                <p><strong>Cadastrado em:</strong> {new Date(pacienteSelecionado.criadoEm).toLocaleDateString('pt-BR')}</p>
              </div>
              
              {pacienteSelecionado.responsavel && (
                <>
                  <div>
                    <p><strong>Responsável:</strong> {pacienteSelecionado.responsavel}</p>
                  </div>
                  <div>
                    <p><strong>Tel. Responsável:</strong> {pacienteSelecionado.telefoneResponsavel}</p>
                  </div>
                </>
              )}
            </div>
          </div>

          <div>
            <h3 style={{ color: '#2c3e50', marginBottom: '1rem' }}>Histórico de Consultas</h3>
            {pacienteSelecionado.consultas?.length === 0 ? (
              <p style={{ color: '#666' }}>Nenhuma consulta encontrada para este paciente.</p>
            ) : (
              <div style={{ display: 'grid', gap: '1rem' }}>
                {pacienteSelecionado.consultas?.map((consulta: any) => (
                  <div key={consulta.id} style={{
                    border: '1px solid #ddd',
                    borderRadius: '8px',
                    padding: '1rem'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <h4 style={{ margin: '0 0 10px 0', color: '#2c3e50' }}>
                          {new Date(consulta.data + 'T12:00:00').toLocaleDateString('pt-BR')} - {consulta.hora}
                        </h4>
                        <p style={{ margin: '0 0 5px 0' }}>
                          <strong>Status:</strong>
                          <span style={{
                            marginLeft: '8px',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            fontSize: '12px',
                            backgroundColor: 
                              consulta.status === 'agendada' ? '#fff3cd' :
                              consulta.status === 'confirmada' ? '#d4edda' :
                              consulta.status === 'realizada' ? '#d1ecf1' : '#f8d7da'
                          }}>
                            {consulta.status.charAt(0).toUpperCase() + consulta.status.slice(1)}
                          </span>
                        </p>
                        {consulta.observacoes && (
                          <p style={{ margin: '5px 0', fontSize: '14px', color: '#666' }}>
                            <strong>Observações:</strong> {consulta.observacoes}
                          </p>
                        )}
                        {consulta.relatorio && (
                          <p style={{ margin: '5px 0', fontSize: '14px', color: '#666' }}>
                            <strong>Relatório:</strong> {consulta.relatorio}
                          </p>
                        )}
                      </div>
                      
                      <div>
                        <span style={{
                          padding: '4px 8px',
                          borderRadius: '4px',
                          fontSize: '12px',
                          backgroundColor: consulta.pagamento === 'pago' ? '#d4edda' : '#fff3cd',
                          color: consulta.pagamento === 'pago' ? '#155724' : '#856404'
                        }}>
                          {consulta.pagamento.charAt(0).toUpperCase() + consulta.pagamento.slice(1)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function HorariosPsicologa() {
  const [horarios, setHorarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [novoHorario, setNovoHorario] = useState({
    data: '',
    hora: '',
    tipo: 'unico',
    diaSemana: 1
  });
  const [modoRapido, setModoRapido] = useState(false);
  const [horariosRapidos, setHorariosRapidos] = useState('');

  useEffect(() => {
    carregarHorarios();
  }, []);

  const carregarHorarios = async () => {
    try {
      const response = await fetch('/api/horarios');
      const data = await response.json();
      setHorarios(data);
    } catch (error) {
      console.error('Erro ao carregar horários:', error);
    } finally {
      setLoading(false);
    }
  };

  // Função para agrupar horários por dia/tipo
  const agruparHorarios = (horarios: any[]) => {
    const grupos: { [key: string]: any[] } = {};
    
    horarios.forEach(horario => {
      let chave;
      if (horario.tipo === 'unico') {
        chave = `unico-${horario.data}`;
      } else {
        chave = `recorrente-${horario.diaSemana}`;
      }
      
      if (!grupos[chave]) {
        grupos[chave] = [];
      }
      grupos[chave].push(horario);
    });

    return grupos;
  };

  const criarHorario = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/horarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(novoHorario)
      });

      if (response.ok) {
        alert('Horário criado com sucesso!');
        setNovoHorario({ data: '', hora: '', tipo: 'unico', diaSemana: 1 });
        carregarHorarios();
      } else {
        const error = await response.json();
        alert(error.error);
      }
    } catch (error) {
      console.error('Erro:', error);
      alert('Erro ao criar horário');
    }
  };

  const criarHorariosRapidos = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!horariosRapidos.trim()) {
      alert('Digite os horários no formato correto');
      return;
    }

    try {
      setLoading(true);
      const horarios = horariosRapidos
        .split(',')
        .map(h => h.trim())
        .filter(h => h.match(/^\d{2}:\d{2}$/));

      if (horarios.length === 0) {
        alert('Nenhum horário válido encontrado. Use o formato HH:MM separado por vírgulas');
        return;
      }

      const promises = horarios.map(hora => 
        fetch('/api/horarios', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...novoHorario,
            hora
          })
        })
      );

      const responses = await Promise.all(promises);
      const sucessos = responses.filter(r => r.ok).length;
      
      alert(`${sucessos} de ${horarios.length} horários criados com sucesso!`);
      setHorariosRapidos('');
      setModoRapido(false);
      carregarHorarios();
    } catch (error) {
      console.error('Erro:', error);
      alert('Erro ao criar horários em lote');
    } finally {
      setLoading(false);
    }
  };

  const deletarHorario = async (id: string) => {
    if (confirm('Tem certeza que deseja deletar este horário?')) {
      try {
        const response = await fetch(`/api/horarios?id=${id}`, {
          method: 'DELETE'
        });

        if (response.ok) {
          alert('Horário deletado com sucesso!');
          carregarHorarios();
        } else {
          alert('Erro ao deletar horário');
        }
      } catch (error) {
        console.error('Erro:', error);
        alert('Erro ao deletar horário');
      }
    }
  };

  const diasSemana = ['', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];

  if (loading) return <div>Carregando...</div>;

  return (
    <div style={{ backgroundColor: 'white', padding: '2rem', borderRadius: '10px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
      <h2 style={{ marginBottom: '2rem', color: '#2c3e50' }}>Gerenciar Horários</h2>
      
      <div style={{ 
        marginBottom: '3rem', 
        backgroundColor: 'white', 
        border: '1px solid #e0e0e0',
        borderRadius: '12px',
        overflow: 'hidden',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
      }}>
        <div style={{
          backgroundColor: '#f8f9fa',
          padding: '1.5rem',
          borderBottom: '1px solid #e0e0e0'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ 
                margin: 0, 
                color: '#2c3e50',
                fontSize: '1.2rem',
                fontWeight: '600'
              }}>
                {modoRapido ? '⚡ Adição Rápida de Horários' : '➕ Adicionar Novo Horário'}
              </h3>
              <p style={{ 
                margin: '5px 0 0 0', 
                color: '#666', 
                fontSize: '14px' 
              }}>
                {modoRapido 
                  ? 'Adicione múltiplos horários de uma só vez (ex: 09:00, 10:00, 14:00)'
                  : 'Configure horários únicos para datas específicas ou recorrentes para dias da semana'
                }
              </p>
            </div>
            <button
              type="button"
              onClick={() => setModoRapido(!modoRapido)}
              style={{
                padding: '8px 16px',
                backgroundColor: modoRapido ? '#e74c3c' : '#3498db',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: '500'
              }}
            >
              {modoRapido ? '← Modo Simples' : '⚡ Modo Rápido'}
            </button>
          </div>
        </div>

        {!modoRapido ? (
          <form onSubmit={criarHorario} style={{ padding: '1.5rem' }}>
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
              gap: '1.5rem', 
              marginBottom: '1.5rem' 
            }}>
              <div>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '8px', 
                  fontWeight: '600',
                  color: '#2c3e50',
                  fontSize: '14px'
                }}>
                  📋 Tipo de Horário
                </label>
                <select
                  value={novoHorario.tipo}
                  onChange={(e) => setNovoHorario(prev => ({ ...prev, tipo: e.target.value }))}
                  style={{ 
                    width: '100%', 
                    padding: '12px', 
                    border: '1px solid #ddd', 
                    borderRadius: '8px',
                    fontSize: '14px',
                    backgroundColor: 'white',
                    cursor: 'pointer'
                  }}
                >
                  <option value="unico">📅 Único (data específica)</option>
                  <option value="recorrente">🔄 Recorrente (toda semana)</option>
                </select>
              </div>
              
              {novoHorario.tipo === 'unico' && (
                <div>
                  <label style={{ 
                    display: 'block', 
                    marginBottom: '8px', 
                    fontWeight: '600',
                    color: '#2c3e50',
                    fontSize: '14px'
                  }}>
                    📅 Data Específica
                  </label>
                  <input
                    type="date"
                    value={novoHorario.data}
                    onChange={(e) => setNovoHorario(prev => ({ ...prev, data: e.target.value }))}
                    style={{ 
                      width: '100%', 
                      padding: '12px', 
                      border: '1px solid #ddd', 
                      borderRadius: '8px',
                      fontSize: '14px'
                    }}
                    required={novoHorario.tipo === 'unico'}
                    min={new Date().toISOString().split('T')[0]}
                  />
                </div>
              )}
              
              {novoHorario.tipo === 'recorrente' && (
                <div>
                  <label style={{ 
                    display: 'block', 
                    marginBottom: '8px', 
                    fontWeight: '600',
                    color: '#2c3e50',
                    fontSize: '14px'
                  }}>
                    📆 Dia da Semana
                  </label>
                  <select
                    value={novoHorario.diaSemana}
                    onChange={(e) => setNovoHorario(prev => ({ ...prev, diaSemana: parseInt(e.target.value) }))}
                    style={{ 
                      width: '100%', 
                      padding: '12px', 
                      border: '1px solid #ddd', 
                      borderRadius: '8px',
                      fontSize: '14px',
                      backgroundColor: 'white',
                      cursor: 'pointer'
                    }}
                  >
                    <option value={1}>Segunda-feira</option>
                    <option value={2}>Terça-feira</option>
                    <option value={3}>Quarta-feira</option>
                    <option value={4}>Quinta-feira</option>
                    <option value={5}>Sexta-feira</option>
                    <option value={6}>Sábado</option>
                  </select>
                </div>
              )}
              
              <div>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '8px', 
                  fontWeight: '600',
                  color: '#2c3e50',
                  fontSize: '14px'
                }}>
                  🕐 Horário
                </label>
                <input
                  type="time"
                  value={novoHorario.hora}
                  onChange={(e) => setNovoHorario(prev => ({ ...prev, hora: e.target.value }))}
                  style={{ 
                    width: '100%', 
                    padding: '12px', 
                    border: '1px solid #ddd', 
                    borderRadius: '8px',
                    fontSize: '14px'
                  }}
                  required
                />
              </div>
            </div>
            
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '1rem',
              backgroundColor: '#f8f9fa',
              borderRadius: '8px',
              border: '1px solid #e0e0e0'
            }}>
              <div style={{ fontSize: '14px', color: '#666' }}>
                {novoHorario.tipo === 'unico' && novoHorario.data && novoHorario.hora && (
                  <span>
                    📅 Criando horário único para {new Date(novoHorario.data + 'T12:00:00').toLocaleDateString('pt-BR')} às {novoHorario.hora}
                  </span>
                )}
                {novoHorario.tipo === 'recorrente' && novoHorario.hora && (
                  <span>
                    🔄 Criando horário recorrente todas as {diasSemana[novoHorario.diaSemana]} às {novoHorario.hora}
                  </span>
                )}
              </div>
              
              <button
                type="submit"
                style={{
                  padding: '12px 24px',
                  backgroundColor: '#27ae60',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: '600',
                  fontSize: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'background-color 0.2s ease'
                }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#219a52'}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#27ae60'}
              >
                ✅ Adicionar Horário
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={criarHorariosRapidos} style={{ padding: '1.5rem' }}>
            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
                gap: '1.5rem', 
                marginBottom: '1.5rem' 
              }}>
                <div>
                  <label style={{ 
                    display: 'block', 
                    marginBottom: '8px', 
                    fontWeight: '600',
                    color: '#2c3e50',
                    fontSize: '14px'
                  }}>
                    📋 Tipo de Horário
                  </label>
                  <select
                    value={novoHorario.tipo}
                    onChange={(e) => setNovoHorario(prev => ({ ...prev, tipo: e.target.value }))}
                    style={{ 
                      width: '100%', 
                      padding: '12px', 
                      border: '1px solid #ddd', 
                      borderRadius: '8px',
                      fontSize: '14px',
                      backgroundColor: 'white',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="unico">📅 Único (data específica)</option>
                    <option value="recorrente">🔄 Recorrente (toda semana)</option>
                  </select>
                </div>
                
                {novoHorario.tipo === 'unico' && (
                  <div>
                    <label style={{ 
                      display: 'block', 
                      marginBottom: '8px', 
                      fontWeight: '600',
                      color: '#2c3e50',
                      fontSize: '14px'
                    }}>
                      📅 Data Específica
                    </label>
                    <input
                      type="date"
                      value={novoHorario.data}
                      onChange={(e) => setNovoHorario(prev => ({ ...prev, data: e.target.value }))}
                      style={{ 
                        width: '100%', 
                        padding: '12px', 
                        border: '1px solid #ddd', 
                        borderRadius: '8px',
                        fontSize: '14px'
                      }}
                      required={novoHorario.tipo === 'unico'}
                      min={new Date().toISOString().split('T')[0]}
                    />
                  </div>
                )}
                
                {novoHorario.tipo === 'recorrente' && (
                  <div>
                    <label style={{ 
                      display: 'block', 
                      marginBottom: '8px', 
                      fontWeight: '600',
                      color: '#2c3e50',
                      fontSize: '14px'
                    }}>
                      📆 Dia da Semana
                    </label>
                    <select
                      value={novoHorario.diaSemana}
                      onChange={(e) => setNovoHorario(prev => ({ ...prev, diaSemana: parseInt(e.target.value) }))}
                      style={{ 
                        width: '100%', 
                        padding: '12px', 
                        border: '1px solid #ddd', 
                        borderRadius: '8px',
                        fontSize: '14px',
                        backgroundColor: 'white',
                        cursor: 'pointer'
                      }}
                    >
                      <option value={1}>Segunda-feira</option>
                      <option value={2}>Terça-feira</option>
                      <option value={3}>Quarta-feira</option>
                      <option value={4}>Quinta-feira</option>
                      <option value={5}>Sexta-feira</option>
                      <option value={6}>Sábado</option>
                    </select>
                  </div>
                )}
              </div>

              <div>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '8px', 
                  fontWeight: '600',
                  color: '#2c3e50',
                  fontSize: '14px'
                }}>
                  ⚡ Múltiplos Horários (separados por vírgula)
                </label>
                <textarea
                  value={horariosRapidos}
                  onChange={(e) => setHorariosRapidos(e.target.value)}
                  placeholder="Exemplo: 09:00, 10:00, 11:00, 14:00, 15:00, 16:00"
                  style={{ 
                    width: '100%', 
                    height: '100px',
                    padding: '12px', 
                    border: '1px solid #ddd', 
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontFamily: 'monospace',
                    resize: 'vertical'
                  }}
                  required
                />
                <div style={{ 
                  marginTop: '8px', 
                  fontSize: '12px', 
                  color: '#666',
                  backgroundColor: '#f8f9fa',
                  padding: '8px',
                  borderRadius: '4px'
                }}>
                  💡 <strong>Dica:</strong> Digite os horários no formato HH:MM separados por vírgula. 
                  Exemplo: <code>09:00, 10:30, 14:00, 15:30</code>
                </div>
              </div>
            </div>
            
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '1rem',
              backgroundColor: '#f8f9fa',
              borderRadius: '8px',
              border: '1px solid #e0e0e0'
            }}>
              <div style={{ fontSize: '14px', color: '#666' }}>
                {horariosRapidos && (
                  <span>
                    ⚡ Criando {horariosRapidos.split(',').filter(h => h.trim().match(/^\d{2}:\d{2}$/)).length} horários em lote
                  </span>
                )}
              </div>
              
              <button
                type="submit"
                disabled={loading}
                style={{
                  padding: '12px 24px',
                  backgroundColor: loading ? '#ccc' : '#e67e22',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  fontWeight: '600',
                  fontSize: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'background-color 0.2s ease'
                }}
              >
                {loading ? '⏳ Criando...' : '⚡ Criar Todos'}
              </button>
            </div>
          </form>
        )}
      </div>

      <div>
        <h3 style={{ marginBottom: '1rem', color: '#2c3e50' }}>Horários Cadastrados</h3>
        
        {horarios.length === 0 ? (
          <p style={{ color: '#666' }}>Nenhum horário cadastrado.</p>
        ) : (
          <div style={{ display: 'grid', gap: '1.5rem' }}>
            {Object.entries(agruparHorarios(horarios)).map(([chave, grupoHorarios]) => {
              const primeiroHorario = grupoHorarios[0];
              const isRecorrente = primeiroHorario.tipo === 'recorrente';
              const titulo = isRecorrente 
                ? `${diasSemana[primeiroHorario.diaSemana]} (Recorrente)`
                : `${new Date(primeiroHorario.data + 'T12:00:00').toLocaleDateString('pt-BR')} (Único)`;
              
              return (
                <div key={chave} style={{
                  border: '1px solid #ddd',
                  borderRadius: '12px',
                  backgroundColor: 'white',
                  overflow: 'hidden',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                }}>
                  {/* Cabeçalho do grupo */}
                  <div style={{
                    backgroundColor: isRecorrente ? '#e3f2fd' : '#fff3e0',
                    padding: '1rem 1.5rem',
                    borderBottom: '1px solid #e0e0e0'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <h4 style={{ 
                          margin: 0, 
                          color: '#2c3e50',
                          fontSize: '1.1rem',
                          fontWeight: '600'
                        }}>
                          {titulo}
                        </h4>
                        <p style={{ 
                          margin: '5px 0 0 0', 
                          fontSize: '14px', 
                          color: '#666',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px'
                        }}>
                          <span style={{
                            padding: '2px 8px',
                            borderRadius: '12px',
                            fontSize: '12px',
                            fontWeight: '500',
                            backgroundColor: isRecorrente ? '#2196f3' : '#ff9800',
                            color: 'white'
                          }}>
                            {isRecorrente ? '🔄 Recorrente' : '📅 Único'}
                          </span>
                          <span>{grupoHorarios.length} horário{grupoHorarios.length > 1 ? 's' : ''}</span>
                        </p>
                      </div>
                      
                      <div style={{ 
                        display: 'flex', 
                        alignItems: 'center',
                        gap: '10px'
                      }}>
                        <span style={{
                          padding: '4px 12px',
                          borderRadius: '12px',
                          fontSize: '12px',
                          fontWeight: '500',
                          backgroundColor: grupoHorarios.every(h => h.ativo) ? '#d4edda' : 
                                          grupoHorarios.some(h => h.ativo) ? '#fff3cd' : '#f8d7da',
                          color: grupoHorarios.every(h => h.ativo) ? '#155724' : 
                                 grupoHorarios.some(h => h.ativo) ? '#856404' : '#721c24'
                        }}>
                          {grupoHorarios.every(h => h.ativo) ? '✅ Todos Ativos' : 
                           grupoHorarios.some(h => h.ativo) ? '⚠️ Parcial' : '❌ Inativos'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Lista de horários */}
                  <div style={{ padding: '1rem 1.5rem' }}>
                    <div style={{ 
                      display: 'grid', 
                      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                      gap: '1rem'
                    }}>
                      {grupoHorarios
                        .sort((a, b) => a.hora.localeCompare(b.hora))
                        .map((horario: any) => (
                        <div key={horario.id} style={{
                          padding: '1rem',
                          border: '1px solid #e0e0e0',
                          borderRadius: '8px',
                          backgroundColor: horario.ativo ? '#fafafa' : '#f5f5f5',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          transition: 'all 0.2s ease',
                          opacity: horario.ativo ? 1 : 0.7
                        }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ 
                              fontSize: '1.1rem', 
                              fontWeight: '600', 
                              color: '#2c3e50',
                              marginBottom: '4px'
                            }}>
                              🕐 {horario.hora}
                            </div>
                            <div style={{ 
                              fontSize: '12px', 
                              color: horario.ativo ? '#666' : '#999'
                            }}>
                              {horario.ativo ? 'Disponível' : 'Inativo'}
                            </div>
                          </div>
                          
                          <button
                            onClick={() => deletarHorario(horario.id)}
                            style={{
                              padding: '6px 12px',
                              backgroundColor: '#e74c3c',
                              color: 'white',
                              border: 'none',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              fontSize: '12px',
                              fontWeight: '500',
                              transition: 'background-color 0.2s ease'
                            }}
                            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#c0392b'}
                            onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#e74c3c'}
                          >
                            🗑️ Deletar
                          </button>
                        </div>
                      ))}
                    </div>
                    
                    {/* Estatísticas do grupo */}
                    <div style={{ 
                      marginTop: '1rem', 
                      padding: '0.75rem',
                      backgroundColor: '#f8f9fa',
                      borderRadius: '6px',
                      fontSize: '13px',
                      color: '#666'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                        <span>📊 Ativos: {grupoHorarios.filter(h => h.ativo).length}/{grupoHorarios.length}</span>
                        <span>⏰ Primeiro: {grupoHorarios.sort((a, b) => a.hora.localeCompare(b.hora))[0].hora}</span>
                        <span>� Último: {grupoHorarios.sort((a, b) => b.hora.localeCompare(a.hora))[0].hora}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function CalendarioPsicologa() {
  const [consultas, setConsultas] = useState([]);
  const [horarios, setHorarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dataSelecionada, setDataSelecionada] = useState('');
  const [consultasDia, setConsultasDia] = useState([]);

  useEffect(() => {
    carregarDadosCalendario();
  }, []);

  const carregarDadosCalendario = async () => {
    try {
      const [consultasRes, horariosRes] = await Promise.all([
        fetch('/api/area-restrita?action=consultas'),
        fetch('/api/horarios')
      ]);

      const consultasData = await consultasRes.json();
      const horariosData = await horariosRes.json();

      setConsultas(consultasData);
      setHorarios(horariosData);
    } catch (error) {
      console.error('Erro ao carregar dados do calendário:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDateSelect = (date: string) => {
    setDataSelecionada(date);
    const consultasData = consultas.filter((c: any) => c.data === date);
    setConsultasDia(consultasData);
  };

  // Preparar dados para o calendário
  const consultasData = consultas.map((c: any) => c.data);
  const disponibilidadesData = horarios
    .filter((h: any) => h.ativo)
    .map((h: any) => h.tipo === 'unico' ? h.data : null)
    .filter(Boolean);

  if (loading) return <div>Carregando...</div>;

  return (
    <div style={{ backgroundColor: 'white', padding: '2rem', borderRadius: '10px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
      <h2 style={{ marginBottom: '2rem', color: '#2c3e50' }}>Calendário</h2>
      
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '2rem' }}>
        <div>
          <Calendario 
            consultasData={consultasData} 
            disponibilidadesData={disponibilidadesData} 
            onDateSelect={handleDateSelect}
            selectedDate={dataSelecionada}
          />
        </div>

        <div>
          <h3 style={{ marginBottom: '1rem', color: '#2c3e50' }}>
            {dataSelecionada 
              ? `Consultas de ${new Date(dataSelecionada + 'T12:00:00').toLocaleDateString('pt-BR')}`
              : 'Selecione uma data'
            }
          </h3>

          {dataSelecionada && (
            <div style={{ display: 'grid', gap: '1rem' }}>
              {consultasDia.length === 0 ? (
                <p style={{ color: '#666' }}>Nenhuma consulta neste dia.</p>
              ) : (
                consultasDia.map((consulta: any) => (
                  <div key={consulta.id} style={{
                    border: '1px solid #ddd',
                    borderRadius: '8px',
                    padding: '1rem',
                    backgroundColor: '#f8f9fa'
                  }}>
                    <h4 style={{ margin: '0 0 10px 0', color: '#2c3e50' }}>
                      {consulta.hora} - {consulta.paciente?.nome}
                    </h4>
                    <p style={{ margin: '0 0 5px 0', fontSize: '14px' }}>
                      <strong>Status:</strong>
                      <span style={{
                        marginLeft: '8px',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        fontSize: '12px',
                        backgroundColor: 
                          consulta.status === 'agendada' ? '#fff3cd' :
                          consulta.status === 'confirmada' ? '#d4edda' :
                          consulta.status === 'realizada' ? '#d1ecf1' : '#f8d7da'
                      }}>
                        {consulta.status}
                      </span>
                    </p>
                    <p style={{ margin: 0, fontSize: '14px' }}>
                      <strong>Pagamento:</strong>
                      <span style={{
                        marginLeft: '8px',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        fontSize: '12px',
                        backgroundColor: consulta.pagamento === 'pago' ? '#d4edda' : '#fff3cd'
                      }}>
                        {consulta.pagamento}
                      </span>
                    </p>
                  </div>
                ))
              )}
            </div>
          )}

          {!dataSelecionada && (
            <div style={{
              padding: '2rem',
              textAlign: 'center',
              color: '#666',
              backgroundColor: '#f8f9fa',
              borderRadius: '8px',
              border: '2px dashed #ddd'
            }}>
              <p>Clique em uma data no calendário para ver as consultas do dia</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}