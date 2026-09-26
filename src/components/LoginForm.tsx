'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';
import Link from 'next/link';
import Form from 'react-bootstrap/Form';
import Button from 'react-bootstrap/Button';
import Alert from 'react-bootstrap/Alert';
import Spinner from 'react-bootstrap/Spinner';
import { useAuth, type Usuario } from '@/contexts/AuthContext';

type LoginFormProps = {
  onSucesso: (usuario: Usuario) => void;
};

export default function LoginForm({ onSucesso }: LoginFormProps) {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErro(null);
    setEnviando(true);
    const resultado = await login(email, senha);
    setEnviando(false);

    if (resultado.ok) {
      onSucesso(resultado.usuario);
      return;
    }

    if (resultado.status === 401) {
      setErro('E-mail ou senha inválidos');
    } else if (resultado.status === 403) {
      setErro('Sua conta ainda não tem senha. Use o link de primeiro acesso enviado pela psicóloga.');
    } else {
      setErro('Não foi possível entrar. Tente novamente.');
    }
  };

  return (
    <Form onSubmit={handleSubmit} noValidate>
      {erro && <Alert variant="danger">{erro}</Alert>}
      <Form.Group className="mb-3" controlId="loginEmail">
        <Form.Label>E-mail</Form.Label>
        <Form.Control
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
        />
      </Form.Group>
      <Form.Group className="mb-3" controlId="loginSenha">
        <Form.Label>Senha</Form.Label>
        <Form.Control
          type="password"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          autoComplete="current-password"
          required
        />
      </Form.Group>
      <div className="text-end mb-3">
        <Link href="/esqueci-senha" className="pmc-texto-2 pmc-t-sm">
          Esqueci minha senha
        </Link>
      </div>
      <div className="d-grid">
        <Button type="submit" variant="primary" disabled={enviando}>
          {enviando ? (
            <>
              <Spinner as="span" animation="border" size="sm" className="me-2" />
              Entrando...
            </>
          ) : (
            'Entrar'
          )}
        </Button>
      </div>
    </Form>
  );
}
