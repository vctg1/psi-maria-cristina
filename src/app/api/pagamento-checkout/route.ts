import { NextRequest, NextResponse } from 'next/server';
import { MercadoPagoConfig, Payment } from 'mercadopago';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const client = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN || 'TEST-8724684112931840-092709-233ebae00e8e040b90e3c382f2699742-727330925'
});

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

// Processar pagamento com cartão de crédito
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      consultaId, 
      metodoPagamento, 
      dadosCartao, 
      dadosPagador,
      valor = 150.00
    } = body;

    console.log('Dados recebidos para pagamento:', {
      consultaId,
      metodoPagamento,
      dadosCartao: { ...dadosCartao, token: dadosCartao.token ? 'TOKEN_PRESENTE' : 'TOKEN_AUSENTE' },
      dadosPagador,
      valor
    });

    const payment = new Payment(client);
    
    let paymentData: any = {
      transaction_amount: valor,
      description: `Consulta Psicológica - Psicóloga Maria Cristina`,
      payment_method_id: metodoPagamento,
      payer: {
        email: dadosPagador.email,
        identification: {
          type: 'CPF',
          number: dadosPagador.documento
        },
        first_name: dadosPagador.nome.split(' ')[0],
        last_name: dadosPagador.nome.split(' ').slice(1).join(' ') || dadosPagador.nome.split(' ')[0]
      },
      external_reference: consultaId
    };

    // Se for cartão de crédito
    if (metodoPagamento !== 'pix') {
      paymentData.token = dadosCartao.token;
      paymentData.installments = dadosCartao.parcelas;
      
      // Só adicionar issuer_id se estiver presente
      if (dadosCartao.issuerId) {
        paymentData.issuer_id = dadosCartao.issuerId;
      }
    }

    console.log('PaymentData enviado para MercadoPago:', paymentData);

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
      payment: response,
      status: response.status,
      statusDetail: response.status_detail,
      paymentId: response.id
    });

  } catch (error: any) {
    console.error('Erro ao processar pagamento:', error);
    
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

// Gerar PIX QR Code
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const consultaId = searchParams.get('consultaId');
    const email = searchParams.get('email');
    const nome = searchParams.get('nome');

    if (!consultaId || !email || !nome) {
      return NextResponse.json({ error: 'Parâmetros obrigatórios faltando' }, { status: 400 });
    }

    const payment = new Payment(client);
    
    const paymentData = {
      transaction_amount: 150.00,
      description: `Consulta Psicológica - Psicóloga Maria Cristina`,
      payment_method_id: 'pix',
      payer: {
        email: email,
        first_name: nome.split(' ')[0],
        last_name: nome.split(' ').slice(1).join(' ')
      },
      external_reference: consultaId
    };

    const response = await payment.create({ body: paymentData });

    return NextResponse.json({
      success: true,
      paymentId: response.id,
      qrCode: response.point_of_interaction?.transaction_data?.qr_code,
      qrCodeBase64: response.point_of_interaction?.transaction_data?.qr_code_base64,
      pixCopiaECola: response.point_of_interaction?.transaction_data?.qr_code
    });

  } catch (error) {
    console.error('Erro ao gerar PIX:', error);
    return NextResponse.json({ 
      success: false,
      error: 'Erro ao gerar PIX' 
    }, { status: 500 });
  }
}

// Verificar status do pagamento
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { paymentId, consultaId } = body;

    const payment = new Payment(client);
    const response = await payment.get({ id: paymentId });

    // Atualizar status da consulta se o pagamento foi aprovado
    if (response.status === 'approved') {
      const consultas = getConsultas();
      const consultaIndex = consultas.findIndex((c: any) => c.id === consultaId);
      
      if (consultaIndex !== -1) {
        consultas[consultaIndex].pagamento = 'pago';
        consultas[consultaIndex].pagamentoId = response.id;
        consultas[consultaIndex].pagamentoData = new Date().toISOString();
        saveConsultas(consultas);
      }
    }

    return NextResponse.json({
      success: true,
      status: response.status,
      statusDetail: response.status_detail
    });

  } catch (error) {
    console.error('Erro ao verificar pagamento:', error);
    return NextResponse.json({ 
      success: false,
      error: 'Erro ao verificar pagamento' 
    }, { status: 500 });
  }
}