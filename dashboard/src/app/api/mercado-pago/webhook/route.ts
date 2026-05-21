import { NextResponse } from 'next/server';
import { MercadoPagoConfig, Payment } from 'mercadopago';
import { getPlanById, paidPlanIds, type PlanId } from '@/lib/plans';
import { createAdminSupabaseClient, hasSupabaseServiceRole } from '@/lib/server-auth';

const client = new MercadoPagoConfig({
  accessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN || ''
});

const supabase = createAdminSupabaseClient();

type MpEvent = {
  action: string;
  data: { id: string };
  type?: string;
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const event: MpEvent = body.data ? body : { action: body.action, data: { id: String(body.id || '') } };

    if (!event.data?.id) {
      return NextResponse.json({ received: true }, { status: 200 });
    }

    if (event.action !== 'payment.updated' && event.action !== 'payment.created') {
      return NextResponse.json({ received: true }, { status: 200 });
    }

    const paymentApi = new Payment(client);
    const payment = await paymentApi.get({ id: event.data.id });

    if (payment.status !== 'approved') {
      return NextResponse.json({ received: true, status: payment.status }, { status: 200 });
    }

    if (!hasSupabaseServiceRole()) {
      console.error('Webhook: SUPABASE_SERVICE_ROLE_KEY ausente.');
      return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY ausente.' }, { status: 500 });
    }

    const externalRef = payment.external_reference || '';
    const metadata = payment.metadata as Record<string, unknown> | undefined;

    const planIdFromRef = externalRef.split(':')[1] as PlanId | undefined;
    const tokensFromRef = externalRef.split(':')[2] ? Number(externalRef.split(':')[2]) : null;

    const planId = ((metadata?.plan_id as string) || planIdFromRef) as PlanId;
    const tokens = (metadata?.tokens as number) ?? tokensFromRef;

    if (!planId || !paidPlanIds.includes(planId)) {
      console.error('Webhook: plano invalido', planId);
      return NextResponse.json({ error: 'Plano invalido' }, { status: 400 });
    }

    const plan = getPlanById(planId);
    const planTokens = typeof tokens === 'number' && tokens > 0 ? tokens : plan.tokens;

    const payerEmail = payment.payer?.email || '';

    if (!payerEmail) {
      console.error('Webhook: sem email do pagador');
      return NextResponse.json({ error: 'Sem email' }, { status: 400 });
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, tokens, plan_id')
      .eq('email', payerEmail)
      .maybeSingle();

    if (profileError || !profile) {
      const { data: users } = await supabase.auth.admin.listUsers({ perPage: 100 });
      const matchedUser = users?.users?.find(u => u.email === payerEmail);

      if (!matchedUser) {
        console.error('Webhook: usuario nao encontrado para', payerEmail);
        return NextResponse.json({ error: 'Usuario nao encontrado' }, { status: 404 });
      }

      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          tokens: planTokens,
          plan_id: planId,
          updated_at: new Date().toISOString()
        })
        .eq('id', matchedUser.id);

      if (updateError) {
        console.error('Webhook: erro ao atualizar perfil', updateError.message);
        return NextResponse.json({ error: 'Erro ao atualizar' }, { status: 500 });
      }

      await supabase.from('payment_history').insert({
        user_id: matchedUser.id,
        mp_payment_id: event.data.id,
        plan_id: planId,
        tokens_added: planTokens,
        amount: payment.transaction_amount || plan.price,
        status: 'approved'
      });

      return NextResponse.json({
        success: true,
        userId: matchedUser.id,
        planId,
        tokens: planTokens,
        action: 'created_and_updated'
      });
    }

    const newTokens = profile.tokens + planTokens;

    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        tokens: newTokens,
        plan_id: planId,
        updated_at: new Date().toISOString()
      })
      .eq('id', profile.id);

    if (updateError) {
      console.error('Webhook: erro ao atualizar tokens', updateError.message);
      return NextResponse.json({ error: 'Erro ao atualizar tokens' }, { status: 500 });
    }

    await supabase.from('payment_history').insert({
      user_id: profile.id,
      mp_payment_id: event.data.id,
      plan_id: planId,
      tokens_added: planTokens,
      amount: payment.transaction_amount || plan.price,
      status: 'approved'
    });

    return NextResponse.json({
      success: true,
      userId: profile.id,
      planId,
      previousTokens: profile.tokens,
      addedTokens: planTokens,
      newTokens,
      action: 'tokens_credited'
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'erro desconhecido';
    console.error('ERRO WEBHOOK MERCADO PAGO:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const topic = url.searchParams.get('topic');
  const id = url.searchParams.get('id');

  if (topic === 'payment' && id) {
    return NextResponse.json({ received: true }, { status: 200 });
  }

  return NextResponse.json({ received: true }, { status: 200 });
}
