'use client';

import React, { useState } from 'react';
import ToastContainer from 'react-bootstrap/ToastContainer';
import Toast from 'react-bootstrap/Toast';

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

const variantePorTipo: Record<Notificacao['tipo'], string> = {
  sucesso: 'success',
  erro: 'danger',
  aviso: 'warning',
  info: 'info'
};

const iconePorTipo: Record<Notificacao['tipo'], string> = {
  sucesso: 'bi-check-circle',
  erro: 'bi-x-circle',
  aviso: 'bi-exclamation-triangle',
  info: 'bi-info-circle'
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

  return (
    <NotificacaoContext.Provider value={{ mostrarNotificacao }}>
      {children}

      <ToastContainer position="top-end" className="p-3" style={{ zIndex: 9999 }}>
        {notificacoes.map(notificacao => (
          <Toast
            key={notificacao.id}
            bg={variantePorTipo[notificacao.tipo]}
            onClose={() => removerNotificacao(notificacao.id)}
          >
            <Toast.Header closeButton>
              <i className={`bi ${iconePorTipo[notificacao.tipo]} me-2`} />
              <strong className="me-auto">{notificacao.titulo}</strong>
            </Toast.Header>
            {notificacao.mensagem && (
              <Toast.Body className={notificacao.tipo === 'sucesso' || notificacao.tipo === 'erro' ? 'text-white' : undefined}>
                {notificacao.mensagem}
              </Toast.Body>
            )}
          </Toast>
        ))}
      </ToastContainer>
    </NotificacaoContext.Provider>
  );
}
