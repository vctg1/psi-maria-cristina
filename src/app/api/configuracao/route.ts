import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@/generated/prisma/client';
import { requireAuth } from '@/lib/auth/guard';
import { GATEWAYS, PAGAMENTO_VALOR_MAX, type ConfiguracaoDto, type Gateway } from '@/types/pagamento';

// GET /api/configuracao — psicóloga.
export async function GET(request: NextRequest) {
  try {
    const r = await requireAuth(request, 'psicologa');
    if ('erro' in r) return r.erro;

    const config = await prisma.configuracao.findUnique({
      where: { id: 1 },
      select: { valorPadraoSessao: true, duracaoSessaoMin: true, antecedenciaCancelamentoHoras: true, gatewayPadrao: true },
    });

    const dto: ConfiguracaoDto = {
      valorPadraoSessao: config ? Number(config.valorPadraoSessao) : 200,
      duracaoSessaoMin: config?.duracaoSessaoMin ?? 50,
      antecedenciaCancelamentoHoras: config?.antecedenciaCancelamentoHoras ?? 24,
      gatewayPadrao: config?.gatewayPadrao ?? 'mercadopago',
    };

    return NextResponse.json(dto);
  } catch {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

function comoObjeto(body: unknown): Record<string, unknown> {
  return body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
}

function valorValido(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v > 0 && v <= PAGAMENTO_VALOR_MAX && Math.round(v * 100) / 100 === v;
}

function inteiroEmFaixa(v: unknown, min: number, max: number): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;
}

function gatewayValido(v: unknown): v is Gateway {
  return typeof v === 'string' && (GATEWAYS as readonly string[]).includes(v);
}

// PATCH /api/configuracao — psicóloga. Body whitelist: gatewayPadrao, valorPadraoSessao,
// antecedenciaCancelamentoHoras, duracaoSessaoMin (todos opcionais, mas ao menos um válido).
export async function PATCH(request: NextRequest) {
  try {
    const r = await requireAuth(request, 'psicologa');
    if ('erro' in r) return r.erro;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
    }
    const obj = comoObjeto(body);

    const campos: Record<string, string> = {};
    const data: Prisma.ConfiguracaoUpdateInput & Prisma.ConfiguracaoCreateInput = {} as Prisma.ConfiguracaoUpdateInput &
      Prisma.ConfiguracaoCreateInput;

    if ('gatewayPadrao' in obj) {
      if (!gatewayValido(obj.gatewayPadrao)) campos.gatewayPadrao = 'Deve ser "mercadopago" ou "asaas"';
      else data.gatewayPadrao = obj.gatewayPadrao;
    }
    if ('valorPadraoSessao' in obj) {
      if (!valorValido(obj.valorPadraoSessao)) {
        campos.valorPadraoSessao = `Deve ser um número entre 0 e ${PAGAMENTO_VALOR_MAX} (até 2 casas decimais)`;
      } else {
        data.valorPadraoSessao = new Prisma.Decimal(obj.valorPadraoSessao);
      }
    }
    if ('antecedenciaCancelamentoHoras' in obj) {
      if (!inteiroEmFaixa(obj.antecedenciaCancelamentoHoras, 0, 168)) {
        campos.antecedenciaCancelamentoHoras = 'Deve ser um número inteiro entre 0 e 168';
      } else {
        data.antecedenciaCancelamentoHoras = obj.antecedenciaCancelamentoHoras;
      }
    }
    if ('duracaoSessaoMin' in obj) {
      if (!inteiroEmFaixa(obj.duracaoSessaoMin, 10, 240)) {
        campos.duracaoSessaoMin = 'Deve ser um número inteiro entre 10 e 240';
      } else {
        data.duracaoSessaoMin = obj.duracaoSessaoMin;
      }
    }

    if (Object.keys(campos).length > 0 || Object.keys(data).length === 0) {
      return NextResponse.json(
        {
          error: 'Dados inválidos',
          campos: Object.keys(campos).length > 0 ? campos : { _: 'Informe ao menos um campo válido' },
        },
        { status: 400 }
      );
    }

    const atualizado = await prisma.configuracao.upsert({
      where: { id: 1 },
      update: data,
      create: {
        id: 1,
        valorPadraoSessao: data.valorPadraoSessao ?? new Prisma.Decimal(200),
        duracaoSessaoMin: data.duracaoSessaoMin ?? 50,
        antecedenciaCancelamentoHoras: data.antecedenciaCancelamentoHoras ?? 24,
        gatewayPadrao: data.gatewayPadrao ?? 'mercadopago',
      },
      select: { valorPadraoSessao: true, duracaoSessaoMin: true, antecedenciaCancelamentoHoras: true, gatewayPadrao: true },
    });

    const dto: ConfiguracaoDto = {
      valorPadraoSessao: Number(atualizado.valorPadraoSessao),
      duracaoSessaoMin: atualizado.duracaoSessaoMin,
      antecedenciaCancelamentoHoras: atualizado.antecedenciaCancelamentoHoras,
      gatewayPadrao: atualizado.gatewayPadrao,
    };

    return NextResponse.json(dto);
  } catch {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
