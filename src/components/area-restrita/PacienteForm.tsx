'use client';

import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import Form from 'react-bootstrap/Form';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import Button from 'react-bootstrap/Button';
import Spinner from 'react-bootstrap/Spinner';
import type { PacienteEntrada } from '@/types/paciente';

export type PacienteFormValores = PacienteEntrada & { senha?: string };

type PacienteFormProps = {
  valorInicial?: Partial<PacienteEntrada>;
  modo: 'cadastro' | 'edicao';
  mostrarSenha?: boolean;
  mostrarObservacoes?: boolean;
  onSubmit: (dados: PacienteFormValores) => Promise<void>;
  errosServidor?: Record<string, string>;
  enviando?: boolean;
};

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

function formatarCpf(valor: string): string {
  const digitos = apenasDigitos(valor).slice(0, 11);
  if (digitos.length <= 3) return digitos;
  if (digitos.length <= 6) return `${digitos.slice(0, 3)}.${digitos.slice(3)}`;
  if (digitos.length <= 9) return `${digitos.slice(0, 3)}.${digitos.slice(3, 6)}.${digitos.slice(6)}`;
  return `${digitos.slice(0, 3)}.${digitos.slice(3, 6)}.${digitos.slice(6, 9)}-${digitos.slice(9)}`;
}

function calcularIdade(dataNascimento: string): number | null {
  if (!dataNascimento) return null;
  const nascimento = new Date(dataNascimento + 'T12:00:00');
  if (Number.isNaN(nascimento.getTime())) return null;
  const hoje = new Date();
  let idade = hoje.getFullYear() - nascimento.getFullYear();
  const aindaNaoFezAniversario =
    hoje.getMonth() < nascimento.getMonth() ||
    (hoje.getMonth() === nascimento.getMonth() && hoje.getDate() < nascimento.getDate());
  if (aindaNaoFezAniversario) idade -= 1;
  return idade;
}

export default function PacienteForm({
  valorInicial,
  modo,
  mostrarSenha = false,
  mostrarObservacoes = false,
  onSubmit,
  errosServidor,
  enviando = false,
}: PacienteFormProps) {
  const [nome, setNome] = useState(valorInicial?.nome ?? '');
  const [email, setEmail] = useState(valorInicial?.email ?? '');
  const [telefone, setTelefone] = useState(formatarTelefone(valorInicial?.telefone ?? ''));
  const [dataNascimento, setDataNascimento] = useState(valorInicial?.dataNascimento ?? '');
  const [cpf, setCpf] = useState(formatarCpf(valorInicial?.cpf ?? ''));
  const [responsavel, setResponsavel] = useState(valorInicial?.responsavel ?? '');
  const [telefoneResponsavel, setTelefoneResponsavel] = useState(
    formatarTelefone(valorInicial?.telefoneResponsavel ?? '')
  );
  const [observacoesCadastro, setObservacoesCadastro] = useState(valorInicial?.observacoesCadastro ?? '');
  const [senha, setSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [errosLocais, setErrosLocais] = useState<Record<string, string>>({});

  useEffect(() => {
    setNome(valorInicial?.nome ?? '');
    setEmail(valorInicial?.email ?? '');
    setTelefone(formatarTelefone(valorInicial?.telefone ?? ''));
    setDataNascimento(valorInicial?.dataNascimento ?? '');
    setCpf(formatarCpf(valorInicial?.cpf ?? ''));
    setResponsavel(valorInicial?.responsavel ?? '');
    setTelefoneResponsavel(formatarTelefone(valorInicial?.telefoneResponsavel ?? ''));
    setObservacoesCadastro(valorInicial?.observacoesCadastro ?? '');
  }, [valorInicial]);

  const idade = useMemo(() => calcularIdade(dataNascimento), [dataNascimento]);
  const menorDeIdade = idade !== null && idade < 18;

  const erros = { ...errosLocais, ...errosServidor };

  const validar = (): Record<string, string> => {
    const novosErros: Record<string, string> = {};
    if (!nome.trim()) novosErros.nome = 'Informe o nome completo.';
    if (!email.trim()) novosErros.email = 'Informe o e-mail.';
    if (apenasDigitos(telefone).length < 10) novosErros.telefone = 'Informe um telefone válido.';
    if (!dataNascimento) novosErros.dataNascimento = 'Informe a data de nascimento.';
    if (menorDeIdade) {
      if (!responsavel.trim()) novosErros.responsavel = 'Informe o responsável.';
      if (apenasDigitos(telefoneResponsavel).length < 10) {
        novosErros.telefoneResponsavel = 'Informe o telefone do responsável.';
      }
    }
    if (mostrarSenha) {
      if (senha.length < 8) novosErros.senha = 'A senha deve ter no mínimo 8 caracteres.';
      if (senha !== confirmarSenha) novosErros.confirmarSenha = 'As senhas não coincidem.';
    }
    return novosErros;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const novosErros = validar();
    setErrosLocais(novosErros);
    if (Object.keys(novosErros).length > 0) return;

    const dados: PacienteFormValores = {
      nome: nome.trim(),
      email: email.trim(),
      telefone: apenasDigitos(telefone),
      dataNascimento,
      cpf: cpf ? apenasDigitos(cpf) : null,
      responsavel: responsavel.trim() ? responsavel.trim() : null,
      telefoneResponsavel: telefoneResponsavel ? apenasDigitos(telefoneResponsavel) : null,
      observacoesCadastro: observacoesCadastro.trim() ? observacoesCadastro.trim() : null,
    };
    if (mostrarSenha) {
      dados.senha = senha;
    }
    await onSubmit(dados);
  };

  return (
    <Form onSubmit={handleSubmit} noValidate>
      <Row>
        <Col md={6}>
          <Form.Group className="mb-3" controlId="pacienteNome">
            <Form.Label>Nome completo</Form.Label>
            <Form.Control value={nome} onChange={(e) => setNome(e.target.value)} isInvalid={!!erros.nome} />
            <Form.Control.Feedback type="invalid">{erros.nome}</Form.Control.Feedback>
          </Form.Group>
        </Col>
        <Col md={6}>
          <Form.Group className="mb-3" controlId="pacienteEmail">
            <Form.Label>E-mail</Form.Label>
            <Form.Control
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              isInvalid={!!erros.email}
            />
            <Form.Control.Feedback type="invalid">{erros.email}</Form.Control.Feedback>
          </Form.Group>
        </Col>
      </Row>

      <Row>
        <Col md={6}>
          <Form.Group className="mb-3" controlId="pacienteTelefone">
            <Form.Label>Telefone</Form.Label>
            <Form.Control
              value={telefone}
              onChange={(e) => setTelefone(formatarTelefone(e.target.value))}
              isInvalid={!!erros.telefone}
              placeholder="(00) 00000-0000"
            />
            <Form.Control.Feedback type="invalid">{erros.telefone}</Form.Control.Feedback>
          </Form.Group>
        </Col>
        <Col md={3}>
          <Form.Group className="mb-3" controlId="pacienteDataNascimento">
            <Form.Label>Data de nascimento</Form.Label>
            <Form.Control
              type="date"
              value={dataNascimento}
              onChange={(e) => setDataNascimento(e.target.value)}
              isInvalid={!!erros.dataNascimento}
            />
            <Form.Control.Feedback type="invalid">{erros.dataNascimento}</Form.Control.Feedback>
          </Form.Group>
        </Col>
        <Col md={3}>
          <Form.Group className="mb-3" controlId="pacienteCpf">
            <Form.Label>CPF (opcional)</Form.Label>
            <Form.Control
              value={cpf}
              onChange={(e) => setCpf(formatarCpf(e.target.value))}
              isInvalid={!!erros.cpf}
              placeholder="000.000.000-00"
            />
            <Form.Control.Feedback type="invalid">{erros.cpf}</Form.Control.Feedback>
          </Form.Group>
        </Col>
      </Row>

      {menorDeIdade && (
        <Row>
          <Col md={6}>
            <Form.Group className="mb-3" controlId="pacienteResponsavel">
              <Form.Label>Responsável</Form.Label>
              <Form.Control
                value={responsavel ?? ''}
                onChange={(e) => setResponsavel(e.target.value)}
                isInvalid={!!erros.responsavel}
              />
              <Form.Control.Feedback type="invalid">{erros.responsavel}</Form.Control.Feedback>
            </Form.Group>
          </Col>
          <Col md={6}>
            <Form.Group className="mb-3" controlId="pacienteTelefoneResponsavel">
              <Form.Label>Telefone do responsável</Form.Label>
              <Form.Control
                value={telefoneResponsavel}
                onChange={(e) => setTelefoneResponsavel(formatarTelefone(e.target.value))}
                isInvalid={!!erros.telefoneResponsavel}
              />
              <Form.Control.Feedback type="invalid">{erros.telefoneResponsavel}</Form.Control.Feedback>
            </Form.Group>
          </Col>
        </Row>
      )}

      {mostrarObservacoes && (
        <Form.Group className="mb-3" controlId="pacienteObservacoes">
          <Form.Label>Observações</Form.Label>
          <Form.Control
            as="textarea"
            rows={3}
            value={observacoesCadastro ?? ''}
            onChange={(e) => setObservacoesCadastro(e.target.value)}
            isInvalid={!!erros.observacoesCadastro}
          />
          <Form.Control.Feedback type="invalid">{erros.observacoesCadastro}</Form.Control.Feedback>
        </Form.Group>
      )}

      {mostrarSenha && (
        <Row>
          <Col md={6}>
            <Form.Group className="mb-3" controlId="pacienteSenha">
              <Form.Label>Senha</Form.Label>
              <Form.Control
                type="password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                isInvalid={!!erros.senha}
              />
              <Form.Control.Feedback type="invalid">{erros.senha}</Form.Control.Feedback>
            </Form.Group>
          </Col>
          <Col md={6}>
            <Form.Group className="mb-3" controlId="pacienteConfirmarSenha">
              <Form.Label>Confirmar senha</Form.Label>
              <Form.Control
                type="password"
                value={confirmarSenha}
                onChange={(e) => setConfirmarSenha(e.target.value)}
                isInvalid={!!erros.confirmarSenha}
              />
              <Form.Control.Feedback type="invalid">{erros.confirmarSenha}</Form.Control.Feedback>
            </Form.Group>
          </Col>
        </Row>
      )}

      <div className="d-grid d-md-flex justify-content-md-end">
        <Button type="submit" variant="primary" disabled={enviando}>
          {enviando ? (
            <>
              <Spinner as="span" animation="border" size="sm" className="me-2" />
              Salvando...
            </>
          ) : modo === 'cadastro' ? (
            'Cadastrar paciente'
          ) : (
            'Salvar alterações'
          )}
        </Button>
      </div>
    </Form>
  );
}
