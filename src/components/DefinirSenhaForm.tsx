'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';
import Form from 'react-bootstrap/Form';
import Button from 'react-bootstrap/Button';
import Spinner from 'react-bootstrap/Spinner';
import Alert from 'react-bootstrap/Alert';

type DefinirSenhaFormProps = {
  onSubmit: (senha: string) => Promise<void>;
  enviando?: boolean;
  rotulo?: string;
};

export default function DefinirSenhaForm({
  onSubmit,
  enviando = false,
  rotulo = 'Definir senha',
}: DefinirSenhaFormProps) {
  const [senha, setSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (senha.length < 8) {
      setErro('A senha deve ter no mínimo 8 caracteres.');
      return;
    }
    if (senha !== confirmarSenha) {
      setErro('As senhas não coincidem.');
      return;
    }
    setErro(null);
    await onSubmit(senha);
  };

  return (
    <Form onSubmit={handleSubmit} noValidate>
      {erro && <Alert variant="danger">{erro}</Alert>}
      <Form.Group className="mb-3" controlId="definirSenhaNova">
        <Form.Label>Nova senha</Form.Label>
        <Form.Control
          type="password"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          minLength={8}
          required
        />
      </Form.Group>
      <Form.Group className="mb-3" controlId="definirSenhaConfirmar">
        <Form.Label>Confirmar senha</Form.Label>
        <Form.Control
          type="password"
          value={confirmarSenha}
          onChange={(e) => setConfirmarSenha(e.target.value)}
          minLength={8}
          required
        />
      </Form.Group>
      <div className="d-grid">
        <Button type="submit" variant="primary" disabled={enviando}>
          {enviando ? (
            <>
              <Spinner as="span" animation="border" size="sm" className="me-2" />
              Salvando...
            </>
          ) : (
            rotulo
          )}
        </Button>
      </div>
    </Form>
  );
}
