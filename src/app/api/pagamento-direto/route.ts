import { NextRequest, NextResponse } from 'next/server';
import { MercadoPagoConfig, Payment } from 'mercadopago';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

function getClient(): MercadoPagoConfig | null {
  const accessToken = process.env.MP_ACCESS_TOKEN;
  if (!accessToken) {
    return null;
  }
  return new MercadoPagoConfig({ accessToken });
}

const consultasPath = join(process.cwd(), 'src/data/consultas.json');

function getConsultas() {
  try {
    const data = readFileSync(consultasPath, 'utf8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

function saveConsultas(consultas: any[]) {
  writeFileSync(consultasPath, JSON.stringify(consultas, null, 2));
}

// Processar pagamento direto (sem token)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      consultaId, 
      dadosCartao, 
      dadosPagador,
      valor = 150.00
    } = body;

    const client = getClient();
    if (!client) {
      console.error('MP_ACCESS_TOKEN ausente');
      return NextResponse.json({ error: 'Pagamento indisponível' }, { status: 500 });
    }

    const payment = new Payment(client);

    // Detectar tipo de cartão baseado no número
    const detectarTipoCartao = (numero: string) => {
      const numeroLimpo = numero.replace(/\s/g, '');
      if (numeroLimpo.startsWith('4')) return 'visa';
      if (numeroLimpo.startsWith('5') || numeroLimpo.startsWith('2')) return 'master';
      if (numeroLimpo.startsWith('3')) return 'amex';
      if (numeroLimpo.startsWith('6')) return 'elo';
      return 'visa';
    };

    const tipoCartao = detectarTipoCartao(dadosCartao.numero);

    console.log('Processando pagamento direto para consulta:', { consultaId, metodoPagamento: tipoCartao });

    const paymentData = {
      transaction_amount: valor,
      description: `Consulta Psicológica - Psicóloga Maria Cristina`,
      payment_method_id: tipoCartao,
      payer: {
        email: dadosPagador.email,
        identification: {
          type: 'CPF',
          number: dadosPagador.documento
        },
        first_name: dadosPagador.nome.split(' ')[0],
        last_name: dadosPagador.nome.split(' ').slice(1).join(' ') || dadosPagador.nome.split(' ')[0]
      },
      card: {
        number: dadosCartao.numero.replace(/\s/g, ''),
        security_code: dadosCartao.cvv,
        expiration_month: parseInt(dadosCartao.vencimento.split('/')[0]),
        expiration_year: parseInt(`20${dadosCartao.vencimento.split('/')[1]}`),
        cardholder: {
          name: dadosCartao.titular,
          identification: {
            type: 'CPF',
            number: dadosPagador.documento
          }
        }
      },
      installments: dadosCartao.parcelas,
      external_reference: consultaId
    };

    const response = await payment.create({ body: paymentData });

    console.log('Resposta do MercadoPago:', {
      id: response.id,
      status: response.status,
      status_detail: response.status_detail
    });

    // Atualizar status da consulta se o pagamento foi aprovado
    if (response.status === 'approved') {
      const consultas = getConsultas();
      const consultaIndex = consultas.findIndex((c: any) => c.id === consultaId);
      
      if (consultaIndex !== -1) {
        consultas[consultaIndex].pagamento = 'pago';
        consultas[consultaIndex].pagamentoId = response.id;
        consultas[consultaIndex].pagamentoData = new Date().toISOString();
        saveConsultas(consultas);
        console.log('Status da consulta atualizado para pago');
      }
    }

    return NextResponse.json({
      success: true,
      payment: {
        id: response.id,
        status: response.status,
        status_detail: response.status_detail
      },
      status: response.status,
      statusDetail: response.status_detail,
      paymentId: response.id
    });

  } catch (error: any) {
    console.error('Erro ao processar pagamento direto:', {
      message: error?.message,
      status: error?.status,
      cause: Array.isArray(error?.cause) ? error.cause.map((c: any) => ({ code: c?.code, description: c?.description })) : undefined
    });

    let errorMessage = 'Erro ao processar pagamento';
    let statusCode = 500;
    
    if (error.cause && error.cause.length > 0) {
      const cause = error.cause[0];
      errorMessage = cause.description || cause.message || errorMessage;
      statusCode = error.status || 400;
    } else if (error.message) {
      errorMessage = error.message;
    }

    return NextResponse.json({ 
      success: false,
      error: errorMessage,
      details: error.cause || error.message || 'Erro desconhecido'
    }, { status: statusCode });
  }
}