import { NextResponse } from 'next/server';
import { getPlanById, getPlanIdFromTokens, getPlanLevel, type PlanId } from '@/lib/plans';
import {
  createAdminSupabaseClient,
  createRequestSupabaseClient,
  getAuthUser,
  hasSupabaseServiceRole
} from '@/lib/server-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function resolvePlanId(savedPlanId: string | null | undefined, tokens: number): PlanId {
  const saved = getPlanById(savedPlanId).id;
  const inferred = getPlanIdFromTokens(tokens);
  return getPlanLevel(saved) >= getPlanLevel(inferred) ? saved : inferred;
}

export async function GET(request: Request) {
  const auth = await getAuthUser(request);
  if (!auth) {
    return NextResponse.json({ error: 'Nao autorizado.' }, { status: 401 });
  }

  const supabase = hasSupabaseServiceRole()
    ? createAdminSupabaseClient()
    : createRequestSupabaseClient(request);

  let { data: profile, error } = await supabase
    .from('profiles')
    .select('tokens, plan_id, chatbot_auto_capture')
    .eq('id', auth.user.id)
    .maybeSingle();

  if (error && (error.code === '42703' || error.code === 'PGRST204')) {
    const fallback = await supabase
      .from('profiles')
      .select('tokens, plan_id')
      .eq('id', auth.user.id)
      .maybeSingle();
    profile = fallback.data ? { ...fallback.data, chatbot_auto_capture: false } : null;
    error = fallback.error;
  }

  if (error) {
    console.error('[PROFILE] Error:', error);
    return NextResponse.json({ error: 'Erro ao buscar perfil' }, { status: 500 });
  }

  const tokens = typeof profile?.tokens === 'number' ? profile.tokens : auth.tokens;
  const savedPlanId = (profile?.plan_id as PlanId | undefined) || auth.planId;
  const planId = resolvePlanId(savedPlanId, tokens);

  return NextResponse.json({
    success: true,
    profile: {
      userId: auth.user.id,
      email: auth.user.email,
      tokens,
      planId,
      savedPlanId: getPlanById(savedPlanId).id,
      inferredPlanId: getPlanIdFromTokens(tokens),
      chatbotAutoCapture: profile?.chatbot_auto_capture ?? false
    }
  });
}
