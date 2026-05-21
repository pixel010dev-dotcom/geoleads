import { NextResponse } from 'next/server';
import { MercadoPagoConfig, Preference } from 'mercadopago';
import { getPlanById, paidPlanIds, type PlanId } from '@/lib/plans';

const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

const client = new MercadoPagoConfig({
  accessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN || ''
});

export async function POST(request: Request) {
  try {
    const { email, planId } = await request.json();
    const selectedPlanId = String(planId || '').trim() as PlanId;

    if (!paidPlanIds.includes(selectedPlanId)) {
      return NextResponse.json({ error: 'Plano inválido.' }, { status: 400 });
    }

    const plan = getPlanById(selectedPlanId);
    const preference = new Preference(client);

    const result = await preference.create({
      body: {
        items: [
          {
            id: `geoleads-${plan.id}`,
            title: `${plan.name} - ${plan.tokens.toLocaleString('pt-BR')} tokens GeoLeads`,
            quantity: 1,
            unit_price: plan.price,
            currency_id: 'BRL'
          }
        ],
        payer: email ? { email } : undefined,
        external_reference: `geoleads:${plan.id}:${plan.tokens}`,
        metadata: {
          plan_id: plan.id,
          tokens: plan.tokens,
          source: 'geoleads_dashboard'
        },
        back_urls: {
          success: `${appUrl}/?checkout=success`,
          failure: `${appUrl}/pricing?checkout=failure`,
          pending: `${appUrl}/pricing?checkout=pending`
        }
      }
    });

    return NextResponse.json({
      success: true,
      plan: {
        id: plan.id,
        tokens: plan.tokens,
        price: plan.price
      },
      url: result.init_point
    });
  } catch (error: any) {
    console.error('ERRO MERCADO PAGO:', error);
    return NextResponse.json({ error: error.message || 'Erro interno ao gerar checkout.' }, { status: 500 });
  }
}
