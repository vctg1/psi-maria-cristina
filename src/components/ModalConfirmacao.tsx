'use client';

import React, { useState } from 'react';

interface ModalConfirmacaoProps {
  aberto: boolean;
  titulo: string;
  mensagem: string;
  tipo?: 'confirmacao' | 'aviso' | 'erro';
  textoBotaoConfirmar?: string;
  textoBotaoCancelar?: string;
  onConfirmar: () => void;
  onCancelar: () => void;
}

const ModalConfirmacao: React.FC<ModalConfirmacaoProps> = ({
  aberto,
  titulo,
  mensagem,
  tipo = 'confirmacao',
  textoBotaoConfirmar = 'Confirmar',
  textoBotaoCancelar = 'Cancelar',
  onConfirmar,
  onCancelar
}) => {
  if (!aberto) return null;

  const getIcone = () => {
    switch (tipo) {
      case 'aviso': return '⚠️';
      case 'erro': return '❌';
      default: return '❓';
    }
  };

  const getCorBotao = () => {
    switch (tipo) {
      case 'aviso': return '#f39c12';
      case 'erro': return '#e74c3c';
      default: return '#3498db';
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10000,
      padding: '1rem'
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        padding: '2rem',
        maxWidth: '500px',
        width: '100%',
        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.3)',
        animation: 'modalSlideIn 0.3s ease-out'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          marginBottom: '1.5rem'
        }}>
          <div style={{ fontSize: '2rem' }}>
            {getIcone()}
          </div>
          <h3 style={{
            margin: 0,
            color: '#2c3e50',
            fontSize: '1.3rem',
            fontWeight: '600'
          }}>
            {titulo}
          </h3>
        </div>

        <p style={{
          margin: '0 0 2rem 0',
          color: '#666',
          fontSize: '1rem',
          lineHeight: 1.5
        }}>
          {mensagem}
        </p>

        <div style={{
          display: 'flex',
          gap: '1rem',
          justifyContent: 'flex-end'
        }}>
          <button
            onClick={onCancelar}
            style={{
              padding: '12px 24px',
              border: '2px solid #ddd',
              backgroundColor: 'white',
              color: '#666',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: '500',
              fontSize: '1rem',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#f8f9fa';
              e.currentTarget.style.borderColor = '#adb5bd';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'white';
              e.currentTarget.style.borderColor = '#ddd';
            }}
          >
            {textoBotaoCancelar}
          </button>

          <button
            onClick={onConfirmar}
            style={{
              padding: '12px 24px',
              border: 'none',
              backgroundColor: getCorBotao(),
              color: 'white',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: '500',
              fontSize: '1rem',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            {textoBotaoConfirmar}
          </button>
        </div>
      </div>

      <style jsx>{`
        @keyframes modalSlideIn {
          from {
            transform: scale(0.9) translateY(-20px);
            opacity: 0;
          }
          to {
            transform: scale(1) translateY(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
};

// Hook para usar modais de confirmação
export const useModalConfirmacao = () => {
  const [modalConfig, setModalConfig] = useState<{
    aberto: boolean;
    titulo: string;
    mensagem: string;
    tipo?: 'confirmacao' | 'aviso' | 'erro';
    textoBotaoConfirmar?: string;
    textoBotaoCancelar?: string;
    onConfirmar?: () => void;
  }>({
    aberto: false,
    titulo: '',
    mensagem: ''
  });

  const mostrarModal = (config: Omit<typeof modalConfig, 'aberto'>) => {
    setModalConfig({ ...config, aberto: true });
  };

  const fecharModal = () => {
    setModalConfig(prev => ({ ...prev, aberto: false }));
  };

  const confirmar = () => {
    modalConfig.onConfirmar?.();
    fecharModal();
  };

  const Modal = () => (
    <ModalConfirmacao
      aberto={modalConfig.aberto}
      titulo={modalConfig.titulo}
      mensagem={modalConfig.mensagem}
      tipo={modalConfig.tipo}
      textoBotaoConfirmar={modalConfig.textoBotaoConfirmar}
      textoBotaoCancelar={modalConfig.textoBotaoCancelar}
      onConfirmar={confirmar}
      onCancelar={fecharModal}
    />
  );

  return { mostrarModal, Modal };
};

export default ModalConfirmacao;