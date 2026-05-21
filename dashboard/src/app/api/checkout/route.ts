import { NextResponse } from 'next/server';
import { MercadoPagoConfig, Preference } from 'mercadopago';
import { createClient } from '@supabase/supabase-js';
import { getPlanById, paidPlanIds, type PlanId } from '@/lib/plans';

const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

const client = new MercadoPagoConfig({
  accessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN || ''
});

const getAuthUser = async (request: Request) => {
  const authHeader = request.headers.get('authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  );
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
};

export async function POST(request: Request) {
  try {
    const user = await getAuthUser(request);
    const body = await request.json();
    const selectedPlanId = String(body.planId || '').trim() as PlanId;

    if (!paidPlanIds.includes(selectedPlanId)) {
      return NextResponse.json({ error: 'Plano invalido.' }, { status: 400 });
    }

    const plan = getPlanById(selectedPlanId);
    const payerEmail = user?.email || body.email || '';

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
    );

    let profileTokens = 0;
    let currentPlanId = 'free';
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('tokens, plan_id')
        .eq('id', user.id)
        .maybeSingle();
      if (profile) {
        profileTokens = profile.tokens;
        currentPlanId = profile.plan_id || 'free';
      }
    }

    const externalRef = user
      ? `geoleads:${selectedPlanId}:${plan.tokens}:${user.id}`
      : `geoleads:${selectedPlanId}:${plan.tokens}`;

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
        payer: payerEmail ? { email: payerEmail } : undefined,
        external_reference: externalRef,
        metadata: {
          plan_id: plan.id,
          tokens: plan.tokens,
          user_id: user?.id || '',
          source: 'geoleads_dashboard'
        },
        back_urls: {
          success: `${appUrl}/?checkout=success&plan=${plan.id}`,
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
      url: result.init_point,
      currentPlan: currentPlanId,
      currentTokens: profileTokens
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro interno';
    console.error('ERRO MERCADO PAGO:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
