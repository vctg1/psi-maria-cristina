import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@/generated/prisma/client';
import { requireAuth } from '@/lib/auth/guard';
import { CONSULTA_STATUS_COBRAVEL, obterValorPadraoSessao } from '@/lib/pagamentos/cobranca';
import { obterAdapter, ErroConfiguracaoGateway } from '@/lib/pagamentos/gateways';
import { GATEWAYS, PAGAMENTO_CONSULTAS_MAX, type CobrancaOnlineDto, type Gateway } from '@/types/pagamento';

function comoObjeto(body: unknown): Record<string, unknown> {
  return body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
}

class ConsultaNaoEncontrada extends Error {
  consultaIds: string[];
  constructor(consultaIds: string[]) {
    super('Consulta não encontrada');
    this.consultaIds = consultaIds;
  }
}
class ConsultaJaPaga extends Error {
  consultaIds: string[];
  constructor(consultaIds: string[]) {
    super('Consulta já paga ou com cobrança em aberto');
    this.consultaIds = consultaIds;
  }
}
class ConsultaNaoCobravel extends Error {
  consultaIds: string[];
  constructor(consultaIds: string[]) {
    super('Consulta não cobrável');
    this.consultaIds = consultaIds;
  }
}
class PacientesDiferentes extends Error {
  constructor() {
    super('Consultas de pacientes diferentes');
  }
}

// POST /api/pagamentos/online { consultaIds, gateway? } — psicóloga. Gera cobrança hospedada
// (Checkout Pro / link) para 1+ consultas do MESMO paciente. Valor NUNCA vem do body.
export async function POST(request: NextRequest) {
  try {
    const r = await requireAuth(request, 'psicologa');
    if ('erro' in r) return r.erro;
    const { auth } = r;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
    }
    const obj = comoObjeto(body);
    const campos: Record<string, string> = {};

    let consultaIds: string[] = [];
    if (
      !Array.isArray(obj.consultaIds) ||
      obj.consultaIds.length < 1 ||
      obj.consultaIds.length > PAGAMENTO_CONSULTAS_MAX ||
      !obj.consultaIds.every((v) => typeof v === 'string' && v.length > 0)
    ) {
      campos.consultaIds = `Informe de 1 a ${PAGAMENTO_CONSULTAS_MAX} ids de consulta`;
    } else {
      const unicos = new Set(obj.consultaIds as string[]);
      if (unicos.size !== obj.consultaIds.length) {
        campos.consultaIds = 'IDs de consulta duplicados';
      } else {
        consultaIds = obj.consultaIds as string[];
      }
    }

    let gateway: Gateway | undefined;
    if (obj.gateway !== undefined) {
      if (typeof obj.gateway !== 'string' || !GATEWAYS.includes(obj.gateway as Gateway)) {
        campos.gateway = 'Gateway inválido';
      } else {
        gateway = obj.gateway as Gateway;
      }
    }

    if (Object.keys(campos).length > 0) {
      return NextResponse.json({ error: 'Dados inválidos', campos }, { status: 400 });
    }

    const resultado = await prisma.$transaction(
      async (tx) => {
        const consultasExistentes = await tx.consulta.findMany({
          where: { id: { in: consultaIds } },
          select: {
            id: true,
            status: true,
            valor: true,
            pagamentoId: true,
            inicio: true,
            pacienteId: true,
            paciente: { select: { id: true, nome: true, usuario: { select: { email: true } } } },
          },
        });

        if (consultasExistentes.length !== consultaIds.length) {
          const encontrados = new Set(consultasExistentes.map((c) => c.id));
          throw new ConsultaNaoEncontrada(consultaIds.filter((id) => !encontrados.has(id)));
        }

        const pacientesUnicos = new Set(consultasExistentes.map((c) => c.pacienteId));
        if (pacientesUnicos.size > 1) {
          throw new PacientesDiferentes();
        }

        const jaCobradas = consultasExistentes.filter((c) => c.pagamentoId !== null).map((c) => c.id);
        if (jaCobradas.length > 0) {
          throw new ConsultaJaPaga(jaCobradas);
        }

        const naoCobraveis = consultasExistentes
          .filter((c) => !CONSULTA_STATUS_COBRAVEL.includes(c.status))
          .map((c) => c.id);
        if (naoCobraveis.length > 0) {
          throw new ConsultaNaoCobravel(naoCobraveis);
        }

        const configuracao = await tx.configuracao.findUnique({ where: { id: 1 }, select: { gatewayPadrao: true } });
        const gatewayEscolhido: Gateway = gateway ?? configuracao?.gatewayPadrao ?? 'mercadopago';

        const valorPadrao = await obterValorPadraoSessao(tx);
        const somaEfetiva = consultasExistentes.reduce((soma, c) => {
          const v = c.valor !== null ? Number(c.valor) : valorPadrao;
          return soma + v;
        }, 0);
        const valorFinal = Math.round(somaEfetiva * 100) / 100;

        const paciente = consultasExistentes[0].paciente;

        const criado = await tx.pagamento.create({
          data: {
            origem: 'online',
            status: 'pendente',
            gateway: gatewayEscolhido,
            valor: new Prisma.Decimal(valorFinal),
            geradoPorId: auth.usuarioId,
          },
        });

        const atualizadas = await tx.consulta.updateMany({
          where: { id: { in: consultaIds }, pagamentoId: null },
          data: { pagamentoId: criado.id },
        });
        if (atualizadas.count !== consultaIds.length) {
          throw new ConsultaJaPaga(consultaIds);
        }

        return {
          pagamentoId: criado.id,
          valor: valorFinal,
          gateway: gatewayEscolhido,
          criadoEm: criado.criadoEm,
          paciente,
          consultas: consultasExistentes.map((c) => ({ id: c.id, inicio: c.inicio })),
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 5000, timeout: 10000 }
    );

    // Chamada de rede fora da transação (não pode segurar lock de banco).
    try {
      const adapter = obterAdapter(resultado.gateway);
      const descricao =
        resultado.consultas.length === 1 ? 'Consulta psicológica' : `${resultado.consultas.length} consultas psicológicas`;

      const cobranca = await adapter.gerarCobranca({
        pagamentoId: resultado.pagamentoId,
        valor: resultado.valor,
        descricao,
        pagador: { nome: resultado.paciente.nome, email: resultado.paciente.usuario?.email ?? null },
      });

      const atualizado = await prisma.pagamento.update({
        where: { id: resultado.pagamentoId },
        data: {
          referenciaExterna: cobranca.referenciaExterna,
          linkCheckout: cobranca.linkCheckout,
          expiraEm: cobranca.expiraEm ?? null,
        },
        select: { id: true, status: true, valor: true, linkCheckout: true, expiraEm: true, pagoEm: true, criadoEm: true },
      });

      const dto: CobrancaOnlineDto = {
        pagamentoId: atualizado.id,
        gateway: resultado.gateway,
        status: atualizado.status,
        valor: Number(atualizado.valor),
        linkCheckout: atualizado.linkCheckout,
        expiraEm: atualizado.expiraEm ? atualizado.expiraEm.toISOString() : null,
        pagoEm: atualizado.pagoEm ? atualizado.pagoEm.toISOString() : null,
        criadoEm: atualizado.criadoEm.toISOString(),
        consultas: resultado.consultas.map((c) => ({
          id: c.id,
          inicio: c.inicio.toISOString(),
          paciente: { id: resultado.paciente.id, nome: resultado.paciente.nome },
        })),
      };

      return NextResponse.json(dto, { status: 201 });
    } catch (erroGateway) {
      console.error('Falha ao gerar cobrança no gateway (ids omitidos do log)');
      await prisma.$transaction([
        prisma.pagamento.update({ where: { id: resultado.pagamentoId }, data: { status: 'falhou' } }),
        prisma.consulta.updateMany({ where: { pagamentoId: resultado.pagamentoId }, data: { pagamentoId: null } }),
      ]);
      if (erroGateway instanceof ErroConfiguracaoGateway) {
        console.error('Gateway de pagamento sem configuração de ambiente');
      }
      return NextResponse.json({ error: 'Não foi possível gerar a cobrança agora' }, { status: 502 });
    }
  } catch (error) {
    if (error instanceof ConsultaNaoEncontrada) {
      return NextResponse.json({ error: 'Consulta não encontrada', consultaIds: error.consultaIds }, { status: 404 });
    }
    if (error instanceof PacientesDiferentes) {
      return NextResponse.json({ error: 'As consultas devem ser do mesmo paciente' }, { status: 400 });
    }
    if (error instanceof ConsultaJaPaga) {
      return NextResponse.json(
        { error: 'Consulta já paga ou com cobrança em aberto', codigo: 'JA_PAGA', consultaIds: error.consultaIds },
        { status: 409 }
      );
    }
    if (error instanceof ConsultaNaoCobravel) {
      return NextResponse.json(
        {
          error: 'Consulta cancelada/sem comparecimento não pode ser cobrada',
          codigo: 'NAO_COBRAVEL',
          consultaIds: error.consultaIds,
        },
        { status: 409 }
      );
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
      return NextResponse.json({ error: 'Consulta já paga ou com cobrança em aberto', codigo: 'JA_PAGA' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
