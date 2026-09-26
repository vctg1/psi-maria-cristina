'use client';

import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import Card from 'react-bootstrap/Card';
import Form from 'react-bootstrap/Form';
import Button from 'react-bootstrap/Button';
import Spinner from 'react-bootstrap/Spinner';
import Alert from 'react-bootstrap/Alert';
import LayoutPsicologa from '@/components/area-restrita/LayoutPsicologa';
import AlterarSenhaForm from '@/components/area-paciente/AlterarSenhaForm';
import type { PerfilPsicologaDto, PerfilPsicologaEdicao } from '@/types/perfil';
import { useNotificacao } from '@/components/NotificacaoProvider';

function apenasDigitos(valor: string): string {
  return valor.replace(/\D/g, '');
}

function formatarTelefone(valor: string): string {
  const digitos = apenasDigitos(valor).slice(0, 11);
  if (digitos.length <= 2) return digitos;
  if (digitos.length <= 6) return `(${digitos.slice(0, 2)}) ${digitos.slice(2)}`;
  if (digitos.length <= 10) return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 6)}-${digitos.slice(6)}`;
  return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 7)}-${digitos.slice(7)}`;
}

export default function PerfilPsicologaPage() {
  const { mostrarNotificacao } = useNotificacao();
  const [perfil, setPerfil] = useState<PerfilPsicologaDto | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [crp, setCrp] = useState('');
  const [email, setEmail] = useState('');
  const [senhaAtual, setSenhaAtual] = useState('');
  const [emailRespostas, setEmailRespostas] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erroFormulario, setErroFormulario] = useState<string | null>(null);
  const [errosCampos, setErrosCampos] = useState<Record<string, string>>({});

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const response = await fetch('/api/perfil');
      const dados = await response.json().catch(() => null);
      if (!response.ok) {
        setErro(dados?.error ?? 'Não foi possível carregar seus dados.');
        return;
      }
      const resultado = dados as PerfilPsicologaDto;
      setPerfil(resultado);
      setNome(resultado.nome);
      setTelefone(formatarTelefone(resultado.telefone ?? ''));
      setCrp(resultado.crp ?? '');
      setEmail(resultado.email);
      setSenhaAtual('');
      setEmailRespostas(resultado.emailRespostas ?? '');
    } catch {
      setErro('Não foi possível carregar seus dados.');
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!perfil) return;
    setSalvando(true);
    setErroFormulario(null);
    setErrosCampos({});
    const emailMudou = email.trim().toLowerCase() !== perfil.email.trim().toLowerCase();
    try {
      const payload: PerfilPsicologaEdicao = {
        nome: nome.trim(),
        telefone: apenasDigitos(telefone) || null,
        crp: crp.trim() || null,
        emailRespostas: emailRespostas.trim() || null,
      };
      if (emailMudou) {
        payload.email = email.trim();
        payload.senhaAtual = senhaAtual;
      }
      const response = await fetch('/api/perfil', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const resultado = await response.json().catch(() => null);
      if (!response.ok) {
        if (resultado?.campos) setErrosCampos(resultado.campos);
        setErroFormulario(resultado?.error ?? 'Não foi possível salvar as alterações.');
        return;
      }
      const perfilAtualizado = resultado as PerfilPsicologaDto;
      setPerfil(perfilAtualizado);
      setTelefone(formatarTelefone(perfilAtualizado.telefone ?? ''));
      setEmail(perfilAtualizado.email);
      setSenhaAtual('');
      setEmailRespostas(perfilAtualizado.emailRespostas ?? '');
      if (emailMudou) {
        mostrarNotificacao({
          tipo: 'sucesso',
          titulo: 'E-mail de acesso alterado. Use o novo e-mail no próximo login.',
        });
      } else {
        mostrarNotificacao({ tipo: 'sucesso', titulo: 'Dados atualizados' });
      }
    } catch {
      setErroFormulario('Não foi possível salvar as alterações.');
    } finally {
      setSalvando(false);
    }
  };

  const emailMudou = perfil ? email.trim().toLowerCase() !== perfil.email.trim().toLowerCase() : false;

  return (
    <LayoutPsicologa>
      <span className="pmc-rotulo d-block mb-1">Área da psicóloga</span>
      <h1 className="h3 mb-4">Meu perfil</h1>

      {carregando ? (
        <div className="text-center py-5">
          <Spinner animation="border" role="status" />
        </div>
      ) : erro ? (
        <Alert variant="danger">{erro}</Alert>
      ) : perfil ? (
        <>
          <Card className="mb-4">
            <Card.Body>
              <span className="pmc-rotulo d-block mb-3">Seus dados</span>
              {erroFormulario && <Alert variant="danger">{erroFormulario}</Alert>}
              <Form onSubmit={handleSubmit} noValidate>
                <Form.Group className="mb-3" controlId="perfilNome">
                  <Form.Label>Nome</Form.Label>
                  <Form.Control
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    isInvalid={!!errosCampos.nome}
                  />
                  <Form.Control.Feedback type="invalid">{errosCampos.nome}</Form.Control.Feedback>
                </Form.Group>
                <Form.Group className="mb-3" controlId="perfilTelefone">
                  <Form.Label>Telefone</Form.Label>
                  <Form.Control
                    value={telefone}
                    onChange={(e) => setTelefone(formatarTelefone(e.target.value))}
                    placeholder="(00) 00000-0000"
                    isInvalid={!!errosCampos.telefone}
                  />
                  <Form.Control.Feedback type="invalid">{errosCampos.telefone}</Form.Control.Feedback>
                </Form.Group>
                <Form.Group className="mb-3" controlId="perfilCrp">
                  <Form.Label>CRP</Form.Label>
                  <Form.Control
                    value={crp}
                    onChange={(e) => setCrp(e.target.value)}
                    isInvalid={!!errosCampos.crp}
                  />
                  <Form.Control.Feedback type="invalid">{errosCampos.crp}</Form.Control.Feedback>
                </Form.Group>
                <Form.Group className="mb-3" controlId="perfilEmailRespostas">
                  <Form.Label>E-mail para respostas dos pacientes</Form.Label>
                  <Form.Control
                    type="email"
                    value={emailRespostas}
                    onChange={(e) => setEmailRespostas(e.target.value)}
                    placeholder={perfil.email}
                    isInvalid={!!errosCampos.emailRespostas}
                  />
                  <Form.Control.Feedback type="invalid">{errosCampos.emailRespostas}</Form.Control.Feedback>
                  <Form.Text className="pmc-texto-2">
                    Quando um paciente responder a um e-mail do sistema, a resposta chega neste endereço. Em
                    branco, usamos seu e-mail de login.
                  </Form.Text>
                </Form.Group>
                <Form.Group className="mb-3" controlId="perfilEmail">
                  <Form.Label>E-mail de login</Form.Label>
                  <Form.Control
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    isInvalid={!!errosCampos.email}
                  />
                  <Form.Control.Feedback type="invalid">{errosCampos.email}</Form.Control.Feedback>
                </Form.Group>
                {emailMudou && (
                  <Form.Group className="mb-3" controlId="perfilSenhaAtual">
                    <Form.Label>Senha atual</Form.Label>
                    <Form.Control
                      type="password"
                      autoComplete="current-password"
                      value={senhaAtual}
                      onChange={(e) => setSenhaAtual(e.target.value)}
                      isInvalid={!!errosCampos.senhaAtual}
                    />
                    <Form.Control.Feedback type="invalid">{errosCampos.senhaAtual}</Form.Control.Feedback>
                    <Form.Text className="pmc-texto-2">
                      Para alterar o e-mail de acesso, confirme sua senha atual. Enviaremos um aviso para o
                      e-mail antigo.
                    </Form.Text>
                  </Form.Group>
                )}
                <div className="d-grid d-md-flex justify-content-md-end">
                  <Button type="submit" variant="primary" disabled={salvando}>
                    {salvando ? 'Salvando...' : 'Salvar alterações'}
                  </Button>
                </div>
              </Form>
            </Card.Body>
          </Card>

          <Card>
            <Card.Body>
              <span className="pmc-rotulo d-block mb-3">Segurança</span>
              <h2 className="h5 mb-3">Alterar senha</h2>
              <AlterarSenhaForm />
            </Card.Body>
          </Card>
        </>
      ) : null}
    </LayoutPsicologa>
  );
}
