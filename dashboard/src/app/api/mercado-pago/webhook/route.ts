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
    const userIdFromRef = externalRef.split(':')[3] || '';

    const planId = ((metadata?.plan_id as string) || planIdFromRef) as PlanId;
    const tokens = (metadata?.tokens as number) ?? tokensFromRef;
    const userId = (metadata?.user_id as string) || userIdFromRef;

    if (!planId || !paidPlanIds.includes(planId)) {
      console.error('Webhook: plano invalido', planId);
      return NextResponse.json({ error: 'Plano invalido' }, { status: 400 });
    }

    const plan = getPlanById(planId);
    const planTokens = typeof tokens === 'number' && tokens > 0 ? tokens : plan.tokens;

    const { data: existingPayment } = await supabase
      .from('payment_history')
      .select('id, user_id')
      .eq('mp_payment_id', event.data.id)
      .maybeSingle();

    if (existingPayment) {
      return NextResponse.json({
        success: true,
        duplicated: true,
        userId: existingPayment.user_id,
        action: 'already_credited'
      });
    }

    const payerEmail = payment.payer?.email || '';
    let targetUserId = userId;
    let profile = null as null | { id: string; tokens: number; plan_id: string };

    if (targetUserId) {
      const { data } = await supabase
        .from('profiles')
        .select('id, tokens, plan_id')
        .eq('id', targetUserId)
        .maybeSingle();
      profile = data;
    }

    if (!profile && payerEmail) {
      const { data } = await supabase
        .from('profiles')
        .select('id, tokens, plan_id')
        .eq('email', payerEmail)
        .maybeSingle();
      profile = data;
      targetUserId = data?.id || targetUserId;
    }

    if (!profile && payerEmail) {
      const { data: users } = await supabase.auth.admin.listUsers({ perPage: 100 });
      const matchedUser = users?.users?.find(u => u.email === payerEmail);
      targetUserId = matchedUser?.id || targetUserId;
    }

    if (!targetUserId) {
      console.error('Webhook: usuario nao identificado para pagamento', event.data.id);
      return NextResponse.json({ error: 'Usuario nao identificado' }, { status: 404 });
    }

    if (!profile) {
      const { data } = await supabase
        .from('profiles')
        .select('id, tokens, plan_id')
        .eq('id', targetUserId)
        .maybeSingle();
      profile = data;
    }

    if (!profile) {
      const { data: createdProfile, error: createProfileError } = await supabase
        .from('profiles')
        .upsert({
          id: targetUserId,
          email: payerEmail || null,
          tokens: 0,
          plan_id: 'free',
          updated_at: new Date().toISOString()
        }, { onConflict: 'id' })
        .select('id, tokens, plan_id')
        .single();

      if (createProfileError || !createdProfile) {
        console.error('Webhook: erro ao criar perfil para pagamento', createProfileError?.message);
        return NextResponse.json({ error: 'Erro ao criar perfil' }, { status: 500 });
      }

      profile = createdProfile;
    }

    const previousTokens = profile?.tokens || 0;
    const newTokens = previousTokens + planTokens;

    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        tokens: newTokens,
        plan_id: planId,
        updated_at: new Date().toISOString()
      })
      .eq('id', targetUserId);

    if (updateError) {
      console.error('Webhook: erro ao atualizar tokens', updateError.message);
      return NextResponse.json({ error: 'Erro ao atualizar tokens' }, { status: 500 });
    }

    const { error: historyError } = await supabase.from('payment_history').insert({
      user_id: targetUserId,
      mp_payment_id: event.data.id,
      plan_id: planId,
      tokens_added: planTokens,
      amount: payment.transaction_amount || plan.price,
      status: 'approved'
    });

    if (historyError) {
      console.error('Webhook: pagamento creditado, mas historico falhou', historyError.message);
    }

    return NextResponse.json({
      success: true,
      userId: targetUserId,
      planId,
      previousTokens,
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
