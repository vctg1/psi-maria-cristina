'use client';

import React, { useState } from 'react';

interface Notificacao {
  id: string;
  tipo: 'sucesso' | 'erro' | 'aviso' | 'info';
  titulo: string;
  mensagem?: string;
  duracao?: number; // em milissegundos
}

interface NotificacaoManagerProps {
  children: React.ReactNode;
}

const NotificacaoContext = React.createContext<{
  mostrarNotificacao: (notificacao: Omit<Notificacao, 'id'>) => void;
}>({
  mostrarNotificacao: () => {}
});

export const useNotificacao = () => {
  const context = React.useContext(NotificacaoContext);
  if (!context) {
    throw new Error('useNotificacao deve ser usado dentro de NotificacaoProvider');
  }
  return context;
};

export default function NotificacaoProvider({ children }: NotificacaoManagerProps) {
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([]);

  const mostrarNotificacao = (novaNotificacao: Omit<Notificacao, 'id'>) => {
    const id = Math.random().toString(36).substring(2, 15);
    const notificacao: Notificacao = {
      ...novaNotificacao,
      id,
      duracao: novaNotificacao.duracao || 5000
    };

    setNotificacoes(prev => [...prev, notificacao]);

    // Auto remover após o tempo especificado
    setTimeout(() => {
      removerNotificacao(id);
    }, notificacao.duracao);
  };

  const removerNotificacao = (id: string) => {
    setNotificacoes(prev => prev.filter(n => n.id !== id));
  };

  const getIcone = (tipo: string) => {
    switch (tipo) {
      case 'sucesso': return '✅';
      case 'erro': return '❌';
      case 'aviso': return '⚠️';
      case 'info': return 'ℹ️';
      default: return 'ℹ️';
    }
  };

  const getCor = (tipo: string) => {
    switch (tipo) {
      case 'sucesso': return { bg: '#d4edda', border: '#c3e6cb', text: '#155724' };
      case 'erro': return { bg: '#f8d7da', border: '#f5c6cb', text: '#721c24' };
      case 'aviso': return { bg: '#fff3cd', border: '#ffeaa7', text: '#856404' };
      case 'info': return { bg: '#d1ecf1', border: '#bee5eb', text: '#0c5460' };
      default: return { bg: '#d1ecf1', border: '#bee5eb', text: '#0c5460' };
    }
  };

  return (
    <NotificacaoContext.Provider value={{ mostrarNotificacao }}>
      {children}
      
      {/* Container de notificações */}
      <div style={{
        position: 'fixed',
        top: '20px',
        right: '20px',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        maxWidth: '400px'
      }}>
        {notificacoes.map(notificacao => {
          const cores = getCor(notificacao.tipo);
          return (
            <div
              key={notificacao.id}
              style={{
                backgroundColor: cores.bg,
                border: `2px solid ${cores.border}`,
                borderRadius: '8px',
                padding: '1rem',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
                minWidth: '300px',
                maxWidth: '400px',
                animation: 'slideIn 0.3s ease-out',
                position: 'relative'
              }}
            >
              <div style={{ 
                fontSize: '1.2rem',
                marginTop: '2px',
                flexShrink: 0
              }}>
                {getIcone(notificacao.tipo)}
              </div>
              
              <div style={{ flex: 1 }}>
                <h4 style={{ 
                  margin: '0 0 4px 0', 
                  color: cores.text,
                  fontSize: '1rem',
                  fontWeight: '600'
                }}>
                  {notificacao.titulo}
                </h4>
                {notificacao.mensagem && (
                  <p style={{ 
                    margin: 0, 
                    color: cores.text,
                    fontSize: '0.9rem',
                    lineHeight: 1.4
                  }}>
                    {notificacao.mensagem}
                  </p>
                )}
              </div>
              
              <button
                onClick={() => removerNotificacao(notificacao.id)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '1.2rem',
                  cursor: 'pointer',
                  color: cores.text,
                  padding: '0',
                  width: '20px',
                  height: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '50%',
                  opacity: 0.7,
                  flexShrink: 0
                }}
                onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                onMouseLeave={(e) => e.currentTarget.style.opacity = '0.7'}
              >
                ×
              </button>
            </div>
          );
        })}
      </div>

      <style jsx>{`
        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
    </NotificacaoContext.Provider>
  );
}