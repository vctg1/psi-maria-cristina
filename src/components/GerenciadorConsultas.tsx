'use client';

import { useState, useEffect } from 'react';
import CalendarioAgendamento from './CalendarioAgendamento';
import { useNotificacao } from './NotificacaoProvider';
import { useModalConfirmacao } from './ModalConfirmacao';

interface Consulta {
  id: string;
  pacienteId: string;
  data: string;
  hora: string;
  status: 'agendada' | 'realizada' | 'cancelada' | 'nao_compareceu';
  pagamento: string;
  criadaEm: string;
  atualizadaEm: string;
  pacienteNome?: string;
  linkMeet?: string;
}

interface GerenciadorConsultasProps {
  consulta: Consulta;
  onConsultaAtualizada: () => void;
  mostrarPaciente?: boolean; // Para área da psicóloga
  onPagarConsulta?: (consulta: Consulta) => void; // Callback para pagamento
}

export default function GerenciadorConsultas({ 
  consulta, 
  onConsultaAtualizada,
  mostrarPaciente = false,
  onPagarConsulta 
}: GerenciadorConsultasProps) {
  const [mostrarRemarcar, setMostrarRemarcar] = useState(false);
  const [novaData, setNovaData] = useState('');
  const [novoHorario, setNovoHorario] = useState('');
  const [loading, setLoading] = useState(false);
  const [screenSize, setScreenSize] = useState('desktop');

  useEffect(() => {
    const checkScreenSize = () => {
      if (window.innerWidth <= 768) {
        setScreenSize('mobile');
      } else if (window.innerWidth <= 1024) {
        setScreenSize('tablet');
      } else {
        setScreenSize('desktop');
      }
    };

    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  const isMobile = screenSize === 'mobile';
  const isTablet = screenSize === 'tablet';
  
  const { mostrarNotificacao } = useNotificacao();
  const { mostrarModal, Modal } = useModalConfirmacao();

  const formatarData = (data: string) => {
    return new Date(data + 'T00:00:00').toLocaleDateString('pt-BR');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'agendada': return '#2E8B57';
      case 'realizada': return '#4CAF50';
      case 'cancelada': return '#f44336';
      case 'nao_compareceu': return '#FF9800';
      default: return '#666';
    }
  };

  const getStatusTexto = (status: string) => {
    switch (status) {
      case 'agendada': return 'Agendada';
      case 'realizada': return 'Realizada';
      case 'cancelada': return 'Cancelada';
      case 'nao_compareceu': return 'Não Compareceu';
      default: return status;
    }
  };

  const atualizarStatus = async (novoStatus: string) => {
    mostrarModal({
      titulo: 'Confirmar Alteração',
      mensagem: `Confirma alterar status para "${getStatusTexto(novoStatus)}"?`,
      tipo: 'confirmacao',
      textoBotaoConfirmar: 'Alterar Status',
      onConfirmar: async () => {
        setLoading(true);
        try {
          const response = await fetch(`/api/consultas/${consulta.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: novoStatus })
          });

          if (response.ok) {
            mostrarNotificacao({
              tipo: 'sucesso',
              titulo: 'Status Atualizado!',
              mensagem: `Consulta marcada como "${getStatusTexto(novoStatus)}"`
            });
            onConsultaAtualizada();
          } else {
            const error = await response.json();
            mostrarNotificacao({
              tipo: 'erro',
              titulo: 'Erro ao Atualizar',
              mensagem: error.error || 'Falha na atualização do status'
            });
          }
        } catch (error) {
          console.error('Erro:', error);
          mostrarNotificacao({
            tipo: 'erro',
            titulo: 'Erro de Conexão',
            mensagem: 'Não foi possível conectar ao servidor'
          });
        } finally {
          setLoading(false);
        }
      }
    });
  };

  const cancelarConsulta = async () => {
    mostrarModal({
      titulo: 'Cancelar Consulta',
      mensagem: 'Confirma o cancelamento desta consulta? O horário ficará disponível novamente.',
      tipo: 'aviso',
      textoBotaoConfirmar: 'Sim, Cancelar',
      onConfirmar: async () => {
        setLoading(true);
        try {
          const response = await fetch(`/api/consultas/${consulta.id}`, {
            method: 'DELETE'
          });

          if (response.ok) {
            mostrarNotificacao({
              tipo: 'sucesso',
              titulo: 'Consulta Cancelada!',
              mensagem: 'Horário liberado e disponível para agendamento'
            });
            onConsultaAtualizada();
          } else {
            const error = await response.json();
            mostrarNotificacao({
              tipo: 'erro',
              titulo: 'Erro ao Cancelar',
              mensagem: error.error || 'Falha no cancelamento'
            });
          }
        } catch (error) {
          console.error('Erro:', error);
          mostrarNotificacao({
            tipo: 'erro',
            titulo: 'Erro de Conexão',
            mensagem: 'Não foi possível conectar ao servidor'
          });
        } finally {
          setLoading(false);
        }
      }
    });
  };

  const remarcarConsulta = async () => {
    if (!novaData || !novoHorario) {
      mostrarNotificacao({
        tipo: 'aviso',
        titulo: 'Dados Incompletos',
        mensagem: 'Selecione uma nova data e horário para remarcar'
      });
      return;
    }

    mostrarModal({
      titulo: 'Remarcar Consulta',
      mensagem: `Confirma remarcar para ${formatarData(novaData)} às ${novoHorario}?`,
      tipo: 'confirmacao',
      textoBotaoConfirmar: 'Sim, Remarcar',
      onConfirmar: async () => {
        setLoading(true);
        try {
          // 1. Deletar consulta atual para liberar horário
          const deleteResponse = await fetch(`/api/consultas/${consulta.id}`, {
            method: 'DELETE'
          });

          if (!deleteResponse.ok) {
            throw new Error('Erro ao liberar horário atual');
          }

          // 2. Criar nova consulta
          const createResponse = await fetch('/api/consultas', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              pacienteId: consulta.pacienteId,
              data: novaData,
              hora: novoHorario,
              // Manter informações de pagamento se já foi pago
              pagamento: consulta.pagamento === 'pago' ? 'pago' : 'pendente'
            })
          });

          if (createResponse.ok) {
            mostrarNotificacao({
              tipo: 'sucesso',
              titulo: 'Consulta Remarcada!',
              mensagem: `Nova data: ${formatarData(novaData)} às ${novoHorario}`
            });
            setMostrarRemarcar(false);
            onConsultaAtualizada();
          } else {
            const error = await createResponse.json();
            mostrarNotificacao({
              tipo: 'erro',
              titulo: 'Erro ao Remarcar',
              mensagem: error.error || 'Falha na remarcação'
            });
            
            // Tentar recriar consulta original em caso de falha
            await fetch('/api/consultas', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(consulta)
            });
          }
        } catch (error) {
          console.error('Erro:', error);
          mostrarNotificacao({
            tipo: 'erro',
            titulo: 'Erro de Conexão',
            mensagem: 'Não foi possível remarcar a consulta'
          });
        } finally {
          setLoading(false);
        }
      }
    });
  };

  // Não mostrar ações para consultas já realizadas ou antigas
  const podeGerenciar = consulta.status === 'agendada';
  const dataConsulta = new Date(consulta.data + 'T00:00:00');
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const ehFutura = dataConsulta >= hoje;

  return (
    <div style={{
      backgroundColor: 'white',
      borderRadius: '8px',
      padding: isMobile ? '1rem' : '1.5rem',
      marginBottom: '1rem',
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: isMobile ? 'stretch' : 'flex-start',
        flexDirection: isMobile ? 'column' : 'row',
        gap: isMobile ? '1rem' : '0'
      }}>
        <div style={{ flex: 1 }}>
          {mostrarPaciente && (
            <p style={{ 
              margin: '0 0 0.5rem 0', 
              fontWeight: 'bold', 
              color: '#333',
              fontSize: isMobile ? '0.9rem' : '1rem'
            }}>
              Paciente: {consulta.pacienteNome || 'Nome não informado'}
            </p>
          )}
          
          <p style={{ 
            margin: '0 0 0.5rem 0', 
            fontSize: isMobile ? '1rem' : '1.1rem', 
            fontWeight: 'bold' 
          }}>
            📅 {formatarData(consulta.data)} às {consulta.hora}
          </p>
          
          <p style={{ 
            margin: '0 0 0.5rem 0', 
            color: getStatusColor(consulta.status),
            fontWeight: 'bold',
            fontSize: isMobile ? '0.9rem' : '1rem'
          }}>
            Status: {getStatusTexto(consulta.status)}
          </p>
          
          <p style={{ 
            margin: '0 0 0.5rem 0', 
            color: '#666', 
            fontSize: isMobile ? '0.8rem' : '0.9rem' 
          }}>
            Pagamento: {consulta.pagamento === 'pago' ? '✅ Pago' : '⏳ Pendente'}
          </p>
        </div>

        {podeGerenciar && ehFutura && (
          <div style={{ 
            display: 'flex', 
            gap: isMobile ? '0.3rem' : '0.5rem', 
            flexWrap: 'wrap',
            justifyContent: isMobile ? 'center' : 'flex-end'
          }}>
            {/* Botões de Status (apenas para psicóloga) */}
            {mostrarPaciente && (
              <>
                <button
                  onClick={() => atualizarStatus('realizada')}
                  disabled={loading}
                  style={{
                    padding: '6px 12px',
                    backgroundColor: '#4CAF50',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '0.85rem'
                  }}
                >
                  Realizada
                </button>
                
                <button
                  onClick={() => atualizarStatus('nao_compareceu')}
                  disabled={loading}
                  style={{
                    padding: '6px 12px',
                    backgroundColor: '#FF9800',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '0.85rem'
                  }}
                >
                  Não Compareceu
                </button>
              </>
            )}

            {/* Botão Remarcar */}
            <button
              onClick={() => setMostrarRemarcar(!mostrarRemarcar)}
              disabled={loading}
              style={{
                padding: '6px 12px',
                backgroundColor: '#2196F3',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.85rem'
              }}
            >
              {mostrarRemarcar ? 'Cancelar' : 'Remarcar'}
            </button>

            {/* Botão Cancelar */}
            <button
              onClick={cancelarConsulta}
              disabled={loading}
              style={{
                padding: '6px 12px',
                backgroundColor: '#f44336',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.85rem'
              }}
            >
              Cancelar
            </button>
          </div>
        )}
      </div>

      {/* Seção Valor e Pagamento */}
      <div style={{ 
        marginTop: '1rem', 
        paddingTop: '1rem', 
        borderTop: '1px solid #eee',
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <p style={{ margin: 0, color: '#666', fontSize: '0.9rem' }}>
            <strong>Valor:</strong> R$ 150,00
          </p>
          
          {consulta.linkMeet && consulta.status === 'agendada' && (
            <a 
              href={consulta.linkMeet} 
              target="_blank" 
              rel="noopener noreferrer"
              style={{
                padding: '6px 12px',
                backgroundColor: '#27ae60',
                color: 'white',
                textDecoration: 'none',
                borderRadius: '4px',
                fontWeight: '500',
                fontSize: '0.8rem'
              }}
            >
              Entrar na Consulta
            </a>
          )}
        </div>
        
        {consulta.pagamento === 'pendente' && onPagarConsulta && (
          <button
            style={{
              padding: '8px 16px',
              backgroundColor: '#007bff',
              color: 'white',
              borderRadius: '4px',
              fontSize: '0.85rem',
              cursor: 'pointer',
              border: 'none',
              fontWeight: '500'
            }}
            onClick={() => onPagarConsulta(consulta)}
          >
            Pagar Consulta
          </button>
        )}
      </div>



      {/* Interface de Remarcação */}
      {mostrarRemarcar && podeGerenciar && ehFutura && (
        <div style={{ marginTop: '1.5rem', padding: '1rem', backgroundColor: '#f8f9fa', borderRadius: '6px' }}>
          <h4 style={{ margin: '0 0 1rem 0', color: '#333' }}>Remarcar Consulta</h4>
          
          <CalendarioAgendamento
            selectedDate={novaData}
            onDateSelect={setNovaData}
            onTimeSelect={setNovoHorario}
          />
          
          {novaData && (
            <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <span style={{ color: '#666' }}>
                Nova data: {formatarData(novaData)} {novoHorario && `às ${novoHorario}`}
              </span>
              
              {novoHorario && (
                <button
                  onClick={remarcarConsulta}
                  disabled={loading}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#2E8B57',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    marginLeft: 'auto'
                  }}
                >
                  {loading ? 'Processando...' : 'Confirmar Remarcação'}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      <Modal />
    </div>
  );
}