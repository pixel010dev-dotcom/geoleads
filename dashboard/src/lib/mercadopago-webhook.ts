import { MercadoPagoConfig, Payment } from 'mercadopago';
import { getPlanById, getPlanLevel, paidPlanIds, type PlanId } from '@/lib/plans';
import { createAdminSupabaseClient, hasSupabaseServiceRole } from '@/lib/server-auth';

const client = new MercadoPagoConfig({
  accessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN || ''
});

const supabase = createAdminSupabaseClient();

export type CreditPaymentResult =
  | { ok: true; duplicated?: boolean; userId: string; planId: PlanId; newTokens: number; addedTokens: number }
  | { ok: true; duplicated?: boolean; userId: string; campaignId: string; action: 'autovendas_paid' }
  | { ok: false; status: number; error: string };

export async function creditApprovedMercadoPagoPayment(paymentId: string): Promise<CreditPaymentResult> {
  if (!paymentId) {
    return { ok: false, status: 200, error: 'missing_payment_id' };
  }

  const paymentApi = new Payment(client);
  const payment = await paymentApi.get({ id: paymentId });

  if (payment.status !== 'approved') {
    return { ok: false, status: 200, error: `payment_status_${payment.status || 'unknown'}` };
  }

  if (!hasSupabaseServiceRole()) {
    console.error('Webhook: SUPABASE_SERVICE_ROLE_KEY ausente.');
    return { ok: false, status: 500, error: 'SUPABASE_SERVICE_ROLE_KEY ausente.' };
  }

  const externalRef = payment.external_reference || '';
  const metadata = payment.metadata as Record<string, unknown> | undefined;

  const planIdFromRef = externalRef.split(':')[1] as PlanId | undefined;
  const tokensFromRef = externalRef.split(':')[2] ? Number(externalRef.split(':')[2]) : null;
  const userIdFromRef = externalRef.split(':')[3] || '';

  const planIdRaw = (metadata?.plan_id as string) || planIdFromRef || '';
  const planId = planIdRaw as PlanId;
  const tokens = (metadata?.tokens as number) ?? tokensFromRef;
  const userId = (metadata?.user_id as string) || userIdFromRef;
  const source = String(metadata?.source || '');
  const campaignId = String(metadata?.campaign_id || externalRef.split(':')[2] || '');

  if (source === 'autovendas_campaign' || planIdRaw === 'autovendas') {
    if (!campaignId || !userId) {
      console.error('Webhook AutoVendas: campanha ou usuario ausente', { campaignId, userId });
      return { ok: false, status: 400, error: 'Campanha ou usuario ausente' };
    }

    const { data: campaign } = await supabase
      .from('autovendas_campaigns')
      .select('id, payment_status')
      .eq('id', campaignId)
      .eq('user_id', userId)
      .eq('payment_id', String(paymentId))
      .maybeSingle();

    if (!campaign) {
      console.error('Webhook AutoVendas: campanha nao encontrada para pagamento', paymentId);
      return { ok: false, status: 404, error: 'Campanha nao encontrada' };
    }

    if (campaign.payment_status === 'paid') {
      return { ok: true, duplicated: true, userId, campaignId, action: 'autovendas_paid' };
    }

    const { error: updateError } = await supabase
      .from('autovendas_campaigns')
      .update({
        payment_status: 'paid',
        status: 'paid'
      })
      .eq('id', campaignId)
      .eq('user_id', userId)
      .eq('payment_id', String(paymentId));

    if (updateError) {
      console.error('Webhook AutoVendas: erro ao aprovar campanha', updateError.message);
      return { ok: false, status: 500, error: 'Erro ao aprovar campanha' };
    }

    return { ok: true, userId, campaignId, action: 'autovendas_paid' };
  }

  if (!planId || !paidPlanIds.includes(planId)) {
    console.error('Webhook: plano invalido', planId);
    return { ok: false, status: 400, error: 'Plano invalido' };
  }

  const plan = getPlanById(planId);
  const planTokens = typeof tokens === 'number' && tokens > 0 ? tokens : plan.tokens;

  // Tenta inserir primeiro — se já existir, ON CONFLICT retorna sem creditar de novo
  const { data: existingPayment } = await supabase
    .from('payment_history')
    .select('id, user_id')
    .eq('mp_payment_id', paymentId)
    .maybeSingle();

  if (existingPayment) {
    return {
      ok: true,
      duplicated: true,
      userId: existingPayment.user_id,
      planId,
      newTokens: 0,
      addedTokens: 0
    };
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
    try {
      const { data: users } = await supabase.auth.admin.listUsers({ perPage: 100 });
      const matchedUser = users?.users?.find(u => u.email === payerEmail);
      targetUserId = matchedUser?.id || targetUserId;
    } catch (e: any) {
      console.warn('Webhook: admin.listUsers nao disponivel, continuando sem lookup por email:', e.message);
    }
  }

  if (!targetUserId) {
    console.error('Webhook: usuario nao identificado para pagamento', paymentId);
    return { ok: false, status: 404, error: 'Usuario nao identificado' };
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
      return { ok: false, status: 500, error: 'Erro ao criar perfil' };
    }

    profile = createdProfile;
  }

  const previousTokens = profile?.tokens || 0;
  const newTokens = previousTokens + planTokens;

  // Preserva o plan_id maior (nunca rebaixa)
  const currentLevel = getPlanLevel((profile?.plan_id || 'free') as PlanId);
  const newLevel = getPlanLevel(planId);
  const finalPlanId = newLevel > currentLevel ? planId : (profile?.plan_id || planId);

  const { error: updateError } = await supabase
    .from('profiles')
    .update({
      tokens: newTokens,
      plan_id: finalPlanId,
      updated_at: new Date().toISOString()
    })
    .eq('id', targetUserId);

  if (updateError) {
    console.error('Webhook: erro ao atualizar tokens', updateError.message);
    return { ok: false, status: 500, error: 'Erro ao atualizar tokens' };
  }

  const { error: historyError } = await supabase.from('payment_history').upsert({
    user_id: targetUserId,
    mp_payment_id: paymentId,
    plan_id: planId,
    tokens_added: planTokens,
    amount: payment.transaction_amount || plan.price,
    status: 'approved'
  }, { onConflict: 'mp_payment_id', ignoreDuplicates: true });

  if (historyError) {
    console.error('Webhook: pagamento creditado, mas historico falhou', historyError.message);
  }

  return {
    ok: true,
    userId: targetUserId,
    planId,
    newTokens,
    addedTokens: planTokens
  };
}
