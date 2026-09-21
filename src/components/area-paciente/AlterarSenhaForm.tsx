'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';
import Form from 'react-bootstrap/Form';
import Button from 'react-bootstrap/Button';
import Spinner from 'react-bootstrap/Spinner';
import Alert from 'react-bootstrap/Alert';
import type { TrocaSenhaEntrada } from '@/types/paciente';
import { useNotificacao } from '@/components/NotificacaoProvider';

export default function AlterarSenhaForm() {
  const { mostrarNotificacao } = useNotificacao();
  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarNovaSenha, setConfirmarNovaSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [errosCampos, setErrosCampos] = useState<Record<string, string>>({});
  const [enviando, setEnviando] = useState(false);

  const validar = (): Record<string, string> => {
    const novosErros: Record<string, string> = {};
    if (!senhaAtual) novosErros.senhaAtual = 'Informe sua senha atual.';
    if (novaSenha.length < 8) novosErros.novaSenha = 'A nova senha deve ter no mínimo 8 caracteres.';
    if (novaSenha && senhaAtual && novaSenha === senhaAtual) {
      novosErros.novaSenha = 'A nova senha deve ser diferente da senha atual.';
    }
    if (novaSenha !== confirmarNovaSenha) novosErros.confirmarNovaSenha = 'As senhas não coincidem.';
    return novosErros;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErro(null);
    const novosErros = validar();
    setErrosCampos(novosErros);
    if (Object.keys(novosErros).length > 0) return;

    setEnviando(true);
    try {
      const payload: TrocaSenhaEntrada = { senhaAtual, novaSenha };
      const response = await fetch('/api/auth/senha', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const resultado = await response.json().catch(() => null);
      if (!response.ok) {
        if (resultado?.campos) setErrosCampos(resultado.campos);
        setErro(resultado?.error ?? 'Não foi possível alterar a senha.');
        return;
      }
      setSenhaAtual('');
      setNovaSenha('');
      setConfirmarNovaSenha('');
      setErrosCampos({});
      mostrarNotificacao({ tipo: 'sucesso', titulo: 'Senha alterada' });
    } catch {
      setErro('Não foi possível alterar a senha.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Form onSubmit={handleSubmit} noValidate>
      {erro && <Alert variant="danger">{erro}</Alert>}
      <Form.Group className="mb-3" controlId="alterarSenhaAtual">
        <Form.Label>Senha atual</Form.Label>
        <Form.Control
          type="password"
          autoComplete="current-password"
          value={senhaAtual}
          onChange={(e) => setSenhaAtual(e.target.value)}
          isInvalid={!!errosCampos.senhaAtual}
        />
        <Form.Control.Feedback type="invalid">{errosCampos.senhaAtual}</Form.Control.Feedback>
      </Form.Group>
      <Form.Group className="mb-3" controlId="alterarSenhaNova">
        <Form.Label>Nova senha</Form.Label>
        <Form.Control
          type="password"
          autoComplete="new-password"
          value={novaSenha}
          onChange={(e) => setNovaSenha(e.target.value)}
          isInvalid={!!errosCampos.novaSenha}
        />
        <Form.Control.Feedback type="invalid">{errosCampos.novaSenha}</Form.Control.Feedback>
      </Form.Group>
      <Form.Group className="mb-3" controlId="alterarSenhaConfirmar">
        <Form.Label>Confirmar nova senha</Form.Label>
        <Form.Control
          type="password"
          autoComplete="new-password"
          value={confirmarNovaSenha}
          onChange={(e) => setConfirmarNovaSenha(e.target.value)}
          isInvalid={!!errosCampos.confirmarNovaSenha}
        />
        <Form.Control.Feedback type="invalid">{errosCampos.confirmarNovaSenha}</Form.Control.Feedback>
      </Form.Group>
      <div className="d-grid d-md-flex justify-content-md-end">
        <Button type="submit" variant="primary" disabled={enviando}>
          {enviando ? (
            <>
              <Spinner as="span" animation="border" size="sm" className="me-2" />
              Salvando...
            </>
          ) : (
            'Alterar senha'
          )}
        </Button>
      </div>
    </Form>
  );
}
