'use client';

import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import Form from 'react-bootstrap/Form';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import Button from 'react-bootstrap/Button';
import Spinner from 'react-bootstrap/Spinner';
import type { PacienteEntrada } from '@/types/paciente';

export type PacienteFormValores = PacienteEntrada & { senha?: string; senhaAtual?: string };

type CamposObrigatorios = { email?: boolean; dataNascimento?: boolean };

type PacienteFormProps = {
  valorInicial?: Partial<PacienteEntrada>;
  modo: 'cadastro' | 'edicao';
  mostrarSenha?: boolean;
  mostrarObservacoes?: boolean;
  /** Quais campos são obrigatórios. Por padrão (modo psicóloga), e-mail e nascimento são opcionais
   * — o agendamento do visitante deve passar `{ email: true, dataNascimento: true }`. */
  camposObrigatorios?: CamposObrigatorios;
  /** Só nome/telefone/nascimento/observações — usado no modal de nova consulta. */
  compacto?: boolean;
  /** Quando true, o campo CPF fica somente leitura (usado na área do paciente). */
  cpfSomenteLeitura?: boolean;
  /** Substitui a dica padrão do campo e-mail ("Sem e-mail…"). `null` = sem dica. */
  textoAjudaEmail?: string | null;
  /** Quando true, exige "Senha atual" se o e-mail digitado divergir de `valorInicial.email`
   * (usado na área do paciente, onde trocar o e-mail de acesso exige confirmar a senha). */
  exigirSenhaAtualSeEmailMudar?: boolean;
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
  camposObrigatorios,
  compacto = false,
  cpfSomenteLeitura = false,
  textoAjudaEmail,
  exigirSenhaAtualSeEmailMudar = false,
  onSubmit,
  errosServidor,
  enviando = false,
}: PacienteFormProps) {
  const emailObrigatorio = camposObrigatorios?.email ?? false;
  const dataNascimentoObrigatoria = camposObrigatorios?.dataNascimento ?? false;
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
  const [senhaAtual, setSenhaAtual] = useState('');
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
  const menorDeIdade = !compacto && idade !== null && idade < 18;

  const emailAtualNormalizado = (valorInicial?.email ?? '').trim().toLowerCase();
  const emailMudou =
    exigirSenhaAtualSeEmailMudar && email.trim().toLowerCase() !== emailAtualNormalizado;

  const erros = { ...errosLocais, ...errosServidor };

  const validar = (): Record<string, string> => {
    const novosErros: Record<string, string> = {};
    if (!nome.trim()) novosErros.nome = 'Informe o nome completo.';
    if (!compacto && emailObrigatorio && !email.trim()) novosErros.email = 'Informe o e-mail.';
    if (apenasDigitos(telefone).length < 10) novosErros.telefone = 'Informe um telefone válido.';
    if (dataNascimentoObrigatoria && !dataNascimento) novosErros.dataNascimento = 'Informe a data de nascimento.';
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
    if (emailMudou && !senhaAtual.trim()) {
      novosErros.senhaAtual = 'Informe sua senha atual para confirmar a troca de e-mail.';
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
      email: compacto ? null : email.trim() ? email.trim() : null,
      telefone: apenasDigitos(telefone),
      dataNascimento: dataNascimento || null,
      cpf: compacto || !cpf ? null : apenasDigitos(cpf),
      responsavel: compacto || !responsavel.trim() ? null : responsavel.trim(),
      telefoneResponsavel: compacto || !telefoneResponsavel ? null : apenasDigitos(telefoneResponsavel),
      observacoesCadastro: observacoesCadastro.trim() ? observacoesCadastro.trim() : null,
    };
    if (mostrarSenha) {
      dados.senha = senha;
    }
    if (emailMudou) {
      dados.senhaAtual = senhaAtual;
    }
    await onSubmit(dados);
    if (emailMudou) {
      setSenhaAtual('');
    }
  };

  return (
    <Form onSubmit={handleSubmit} noValidate>
      <span className="pmc-rotulo d-block mb-3">Dados pessoais</span>
      <Row>
        <Col md={compacto ? 12 : 6}>
          <Form.Group className="mb-3" controlId="pacienteNome">
            <Form.Label>Nome completo</Form.Label>
            <Form.Control value={nome} onChange={(e) => setNome(e.target.value)} isInvalid={!!erros.nome} />
            <Form.Control.Feedback type="invalid">{erros.nome}</Form.Control.Feedback>
          </Form.Group>
        </Col>
        {!compacto && (
          <Col md={6}>
            <Form.Group className="mb-3" controlId="pacienteEmail">
              <Form.Label>E-mail{!emailObrigatorio && ' (opcional)'}</Form.Label>
              <Form.Control
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                isInvalid={!!erros.email}
              />
              <Form.Control.Feedback type="invalid">{erros.email}</Form.Control.Feedback>
              {textoAjudaEmail !== undefined
                ? textoAjudaEmail !== null && (
                    <Form.Text className="pmc-texto-2">{textoAjudaEmail}</Form.Text>
                  )
                : !emailObrigatorio && (
                    <Form.Text className="pmc-texto-2">
                      Sem e-mail, o paciente não terá acesso ao site — a agenda continua sendo gerida por você.
                    </Form.Text>
                  )}
            </Form.Group>
          </Col>
        )}
      </Row>

      {emailMudou && (
        <Row>
          <Col md={6}>
            <Form.Group className="mb-3" controlId="pacienteSenhaAtual">
              <Form.Label>Senha atual</Form.Label>
              <Form.Control
                type="password"
                autoComplete="current-password"
                value={senhaAtual}
                onChange={(e) => setSenhaAtual(e.target.value)}
                isInvalid={!!erros.senhaAtual}
              />
              <Form.Control.Feedback type="invalid">{erros.senhaAtual}</Form.Control.Feedback>
              <Form.Text className="pmc-texto-2">
                Para alterar o e-mail de acesso, confirme sua senha atual.
              </Form.Text>
            </Form.Group>
          </Col>
        </Row>
      )}

      <Row>
        <Col md={compacto ? 6 : 6}>
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
        <Col md={compacto ? 6 : 3}>
          <Form.Group className="mb-3" controlId="pacienteDataNascimento">
            <Form.Label>Data de nascimento{!dataNascimentoObrigatoria && ' (opcional)'}</Form.Label>
            <Form.Control
              type="date"
              value={dataNascimento}
              onChange={(e) => setDataNascimento(e.target.value)}
              isInvalid={!!erros.dataNascimento}
            />
            <Form.Control.Feedback type="invalid">{erros.dataNascimento}</Form.Control.Feedback>
          </Form.Group>
        </Col>
        {!compacto && (
          <Col md={3}>
            <Form.Group className="mb-3" controlId="pacienteCpf">
              <Form.Label>CPF{!cpfSomenteLeitura && ' (opcional)'}</Form.Label>
              {cpfSomenteLeitura ? (
                <>
                  <Form.Control value={cpf || 'Não informado'} readOnly plaintext disabled />
                  <Form.Text className="pmc-texto-2">Para alterar o CPF, fale com a psicóloga.</Form.Text>
                </>
              ) : (
                <>
                  <Form.Control
                    value={cpf}
                    onChange={(e) => setCpf(formatarCpf(e.target.value))}
                    isInvalid={!!erros.cpf}
                    placeholder="000.000.000-00"
                  />
                  <Form.Control.Feedback type="invalid">{erros.cpf}</Form.Control.Feedback>
                </>
              )}
            </Form.Group>
          </Col>
        )}
      </Row>

      {menorDeIdade && (
        <>
        <span className="pmc-rotulo d-block mb-3">Responsável</span>
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
        </>
      )}

      {mostrarObservacoes && (
        <Form.Group className="mb-3" controlId="pacienteObservacoes">
          <span className="pmc-rotulo d-block mb-2">Observações</span>
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
        <>
        <span className="pmc-rotulo d-block mb-3">Acesso</span>
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
        </>
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
