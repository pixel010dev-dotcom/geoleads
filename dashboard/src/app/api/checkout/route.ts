import { NextResponse } from 'next/server';
import { MercadoPagoConfig, Preference } from 'mercadopago';

const client = new MercadoPagoConfig({ 
  accessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN || '' 
});

export async function POST(request: Request) {
  try {
    const { email, amount, tokens } = await request.json();

    const preference = new Preference(client);
    
    // O "Preference" é o Checkout Completo (Cartão, PIX, Boleto)
    const result = await preference.create({
      body: {
        items: [
          {
            id: `pacote-${tokens}`,
            title: `Pacote de ${tokens} Tokens - GeoLeads`,
            quantity: 1,
            unit_price: amount,
            currency_id: 'BRL',
          }
        ],
        payer: { email: email }
      }
    });

    // Retorna o link de pagamento blindado do Mercado Pago
    return NextResponse.json({
      success: true,
      url: result.init_point
    });
  } catch (error: any) {
    console.error("ERRO MERCADO PAGO:", error);
    return NextResponse.json({ error: error.message || 'Erro interno ao gerar Checkout.' }, { status: 500 });
  }
}
