import { NextRequest, NextResponse, after } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@/generated/prisma/client';
import { autenticar } from '@/lib/auth/guard';
import { assinarSessao } from '@/lib/auth/jwt';
import { cookieSessao } from '@/lib/auth/cookie';
import { hashSenha, validarForcaSenha } from '@/lib/auth/senha';
import { validarPacienteEntrada } from '@/lib/validacao/paciente';
import { formatoDataValido, formatoHoraValido, montarInicio } from '@/lib/agenda/tempo';
import { criarConsultaComTrava, HorarioIndisponivel } from '@/lib/agenda/consultas';
import { avisarNovoAgendamento } from '@/lib/agenda/avisos';
import { verificarLivreNaTransacao } from '@/lib/agenda/disponibilidade';
import type { AgendamentoEntrada, AgendamentoResposta, Modalidade } from '@/types/agenda';

const MODALIDADES: Modalidade[] = ['presencial', 'online'];

function comoObjeto(body: unknown): Record<string, unknown> {
  return body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
}

// POST /api/agendamento — rota pública. Visitante se autocadastra e agenda, ou paciente já
// logado agenda direto. Nunca devolve dados de paciente/CPF/e-mail na resposta.
export async function POST(request: NextRequest) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
    }
    const obj = comoObjeto(body) as Record<string, unknown> & Partial<AgendamentoEntrada>;

    if (!formatoDataValido(obj.data)) {
      return NextResponse.json({ error: 'Data inválida (use YYYY-MM-DD)' }, { status: 400 });
    }
    if (!formatoHoraValido(obj.hora)) {
      return NextResponse.json({ error: 'Hora inválida (use HH:MM)' }, { status: 400 });
    }

    let modalidade: Modalidade = 'presencial';
    if (obj.modalidade !== undefined) {
      if (typeof obj.modalidade !== 'string' || !MODALIDADES.includes(obj.modalidade as Modalidade)) {
        return NextResponse.json({ error: 'Modalidade inválida' }, { status: 400 });
      }
      modalidade = obj.modalidade as Modalidade;
    }

    let motivo: string | null = null;
    if (obj.motivo !== undefined && obj.motivo !== null) {
      if (typeof obj.motivo !== 'string' || obj.motivo.trim().length > 200) {
        return NextResponse.json({ error: 'Motivo inválido (máximo 200 caracteres)' }, { status: 400 });
      }
      motivo = obj.motivo.trim() || null;
    }

    let observacoes: string | null = null;
    if (obj.observacoes !== undefined && obj.observacoes !== null) {
      if (typeof obj.observacoes !== 'string' || obj.observacoes.trim().length > 1000) {
        return NextResponse.json({ error: 'Observações inválidas (máximo 1000 caracteres)' }, { status: 400 });
      }
      observacoes = obj.observacoes.trim() || null;
    }

    const inicio = montarInicio(obj.data, obj.hora);
    if (inicio.getTime() <= Date.now()) {
      return NextResponse.json({ error: 'Não é possível agendar em uma data/horário passado' }, { status: 400 });
    }

    const auth = await autenticar(request);

    // Paciente já logado: agenda direto, ignora qualquer bloco de cadastro enviado.
    if (auth?.papel === 'paciente' && auth.pacienteId) {
      try {
        const consulta = await criarConsultaComTrava({
          pacienteId: auth.pacienteId,
          inicio,
          modalidade,
          motivo,
          observacoes,
          criadaPor: 'paciente',
        });
        const resposta: AgendamentoResposta = {
          consulta: { id: consulta.id, inicio: consulta.inicio.toISOString(), status: consulta.status },
          novoCadastro: false,
        };
        after(() => avisarNovoAgendamento(consulta.id));
        return NextResponse.json(resposta, { status: 201 });
      } catch (error) {
        if (error instanceof HorarioIndisponivel) {
          return NextResponse.json({ error: 'Horário indisponível' }, { status: 409 });
        }
        throw error;
      }
    }

    if (auth?.papel === 'psicologa') {
      return NextResponse.json({ error: 'Use a agenda da área da psicóloga' }, { status: 400 });
    }

    // Visitante sem sessão: exige cadastro completo (com senha).
    const cadastro = obj.cadastro;
    if (!cadastro || typeof cadastro !== 'object') {
      return NextResponse.json({ error: 'Dados de cadastro são obrigatórios' }, { status: 400 });
    }

    const resultado = validarPacienteEntrada(cadastro, { exigirEmail: true });
    if (!resultado.ok) {
      return NextResponse.json({ error: 'Dados inválidos', campos: resultado.campos }, { status: 400 });
    }
    const dados = resultado.dados;
    const email = dados.email as string;

    const cadastroObj = cadastro as Record<string, unknown>;
    const senha = cadastroObj.senha;
    if (typeof senha !== 'string') {
      return NextResponse.json({ error: 'Senha é obrigatória' }, { status: 400 });
    }
    const erroSenha = validarForcaSenha(senha);
    if (erroSenha) {
      return NextResponse.json({ error: erroSenha }, { status: 400 });
    }

    // Pré-cheque: nunca revela dados do registro existente, só que o e-mail já está em uso.
    const emailExistente = await prisma.usuario.findUnique({ where: { email }, select: { id: true } });
    if (emailExistente) {
      return NextResponse.json(
        { error: 'E-mail já cadastrado. Faça login para agendar.', codigo: 'EMAIL_EXISTENTE' },
        { status: 409 }
      );
    }

    const senhaHash = await hashSenha(senha);

    try {
      const resultadoTx = await prisma.$transaction(
        async (tx) => {
          const disponivel = await verificarLivreNaTransacao(tx, inicio);
          if (disponivel !== 'livre') throw new HorarioIndisponivel(disponivel);

          const usuario = await tx.usuario.create({
            data: { email, senhaHash, papel: 'paciente' },
          });

          const paciente = await tx.paciente.create({
            data: {
              usuarioId: usuario.id,
              nome: dados.nome,
              telefone: dados.telefone,
              dataNascimento: dados.dataNascimento ? new Date(dados.dataNascimento + 'T12:00:00') : null,
              cpf: dados.cpf,
              responsavel: dados.responsavel,
              telefoneResponsavel: dados.telefoneResponsavel,
              observacoesCadastro: dados.observacoesCadastro,
              origemCadastro: 'autocadastro',
            },
          });

          const consulta = await tx.consulta.create({
            data: {
              pacienteId: paciente.id,
              inicio,
              modalidade,
              motivo,
              observacoes,
              criadaPor: 'paciente',
              status: 'agendada',
            },
          });

          return { usuario, paciente, consulta };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 5000, timeout: 10000 }
      );

      const token = await assinarSessao({
        sub: resultadoTx.usuario.id,
        papel: 'paciente',
        pacienteId: resultadoTx.paciente.id,
      });

      const resposta: AgendamentoResposta = {
        consulta: {
          id: resultadoTx.consulta.id,
          inicio: resultadoTx.consulta.inicio.toISOString(),
          status: resultadoTx.consulta.status,
        },
        novoCadastro: true,
      };
      const response = NextResponse.json(resposta, { status: 201 });
      response.cookies.set(cookieSessao(token));
      after(() => avisarNovoAgendamento(resultadoTx.consulta.id));
      return response;
    } catch (error) {
      if (error instanceof HorarioIndisponivel) {
        return NextResponse.json({ error: 'Horário indisponível' }, { status: 409 });
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          return NextResponse.json(
            { error: 'E-mail já cadastrado. Faça login para agendar.', codigo: 'EMAIL_EXISTENTE' },
            { status: 409 }
          );
        }
        if (error.code === 'P2034') {
          return NextResponse.json({ error: 'Horário indisponível' }, { status: 409 });
        }
      }
      throw error;
    }
  } catch {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
