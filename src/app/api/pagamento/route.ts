import { NextRequest, NextResponse } from 'next/server';
import { MercadoPagoConfig, Preference } from 'mercadopago';

const client = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN!
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { consultaId, pacienteNome, pacienteEmail, valor, metodoPagamento } = body;

    const preference = new Preference(client);

    const preferenceData: any = {
      items: [
        {
          id: consultaId,
          title: `Consulta Psicológica - ${pacienteNome}`,
          quantity: 1,
          unit_price: valor,
          currency_id: 'BRL',
        }
      ],
      payer: {
        email: pacienteEmail,
        name: pacienteNome
      },
      back_urls: {
        success: `${process.env.NEXT_PUBLIC_URL || 'http://localhost:3000'}/area-restrita?pagamento=sucesso`,
        failure: `${process.env.NEXT_PUBLIC_URL || 'http://localhost:3000'}/area-restrita?pagamento=falhou`,
        pending: `${process.env.NEXT_PUBLIC_URL || 'http://localhost:3000'}/area-restrita?pagamento=pendente`
      },
      auto_return: 'approved',
      external_reference: consultaId,
      notification_url: `${process.env.NEXT_PUBLIC_URL || 'http://localhost:3000'}/api/pagamento/webhook`,
    };

    // Se for PIX, configurar para PIX apenas
    if (metodoPagamento === 'pix') {
      preferenceData.payment_methods = {
        excluded_payment_types: [
          { id: 'credit_card' },
          { id: 'debit_card' },
          { id: 'ticket' }
        ]
      };
    }

    const response = await preference.create({
      body: preferenceData
    });

    return NextResponse.json({
      preferenceId: response.id,
      initPoint: response.init_point,
      sandboxInitPoint: response.sandbox_init_point,
      qrCode: (response as any).qr_code
    });

  } catch (error) {
    console.error('Erro ao criar preferência:', error);
    return NextResponse.json({ error: 'Erro ao processar pagamento' }, { status: 500 });
  }
}

// Webhook para receber notificações do Mercado Pago
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, data } = body;

    if (action === 'payment.created' || action === 'payment.updated') {
      // Atualizar status do pagamento no banco de dados
      const paymentId = data.id;
      
      // Aqui você implementaria a lógica para atualizar o status da consulta
      // baseado no status do pagamento recebido do Mercado Pago
      
      console.log('Pagamento atualizado:', paymentId);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Erro no webhook:', error);
    return NextResponse.json({ error: 'Erro no webhook' }, { status: 500 });
  }
}