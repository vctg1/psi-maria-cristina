'use client';

import React, { useState } from 'react';
import Modal from 'react-bootstrap/Modal';
import Button from 'react-bootstrap/Button';

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

const configPorTipo: Record<NonNullable<ModalConfirmacaoProps['tipo']>, { icone: string; classe: string }> = {
  confirmacao: { icone: 'bi-question-circle', classe: '' },
  aviso: { icone: 'bi-exclamation-triangle', classe: '' },
  erro: { icone: 'bi-x-octagon', classe: 'text-danger' }
};

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
  const { icone, classe } = configPorTipo[tipo];

  return (
    <Modal show={aberto} onHide={onCancelar} centered>
      <Modal.Header closeButton>
        <div className="pmc-icone me-3">
          <i className={`bi ${icone} ${classe}`} />
        </div>
        <Modal.Title as="h3" className="mb-0">{titulo}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p className="mb-0">{mensagem}</p>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="outline-secondary" onClick={onCancelar}>
          {textoBotaoCancelar}
        </Button>
        <Button variant="primary" onClick={onConfirmar}>
          {textoBotaoConfirmar}
        </Button>
      </Modal.Footer>
    </Modal>
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
