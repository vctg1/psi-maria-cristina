'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import Card from 'react-bootstrap/Card';
import Form from 'react-bootstrap/Form';
import Button from 'react-bootstrap/Button';
import Alert from 'react-bootstrap/Alert';
import Spinner from 'react-bootstrap/Spinner';
import type { EsqueciSenhaEntrada, EsqueciSenhaResposta } from '@/types/perfil';

export default function EsqueciSenhaPage() {
  const [email, setEmail] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      const payload: EsqueciSenhaEntrada = { email: email.trim() };
      const response = await fetch('/api/auth/esqueci-senha', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const resultado = await response.json().catch(() => null);
      if (!response.ok) {
        setErro(resultado?.error ?? 'Não foi possível concluir. Tente novamente.');
        return;
      }
      const dados = resultado as EsqueciSenhaResposta;
      setMensagem(dados.mensagem);
    } catch {
      setErro('Não foi possível concluir. Tente novamente.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="pmc-auth">
      <div className="pmc-mancha pmc-mancha--salvia" style={{ top: '-8%', left: '-10%', width: '46%', aspectRatio: 1 }} aria-hidden="true" />
      <div className="pmc-mancha" style={{ bottom: '-10%', right: '-8%', width: '40%', aspectRatio: 1 }} aria-hidden="true" />
      <Card className="pmc-auth-card pmc-acima">
        <Card.Body>
          <Image
            src="/maria-cristina-logo.png"
            alt="Psicóloga Maria Cristina"
            width={72}
            height={72}
            className="pmc-auth-logo mb-3"
            style={{ objectFit: 'contain' }}
          />
          <div className="text-center">
            <span className="pmc-rotulo">Esqueci minha senha</span>
            <h1 className="h3 mt-2">Vamos te ajudar a entrar de novo.</h1>
            <p className="mb-4 pmc-texto-2">
              Informe o e-mail cadastrado e enviaremos um link para redefinir sua senha.
            </p>
          </div>

          {erro && <Alert variant="danger">{erro}</Alert>}

          {mensagem ? (
            <Alert variant="info" className="mb-0">
              {mensagem}
            </Alert>
          ) : (
            <Form onSubmit={handleSubmit} noValidate>
              <Form.Group className="mb-3" controlId="esqueciSenhaEmail">
                <Form.Label>E-mail</Form.Label>
                <Form.Control
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                />
              </Form.Group>
              <div className="d-grid">
                <Button type="submit" variant="primary" disabled={enviando}>
                  {enviando ? (
                    <>
                      <Spinner as="span" animation="border" size="sm" className="me-2" />
                      Enviando...
                    </>
                  ) : (
                    'Enviar link'
                  )}
                </Button>
              </div>
            </Form>
          )}

          <div className="text-center mt-3">
            <Link href="/login">
              <Button variant="link" size="sm">Voltar ao login</Button>
            </Link>
          </div>
        </Card.Body>
      </Card>
    </div>
  );
}
