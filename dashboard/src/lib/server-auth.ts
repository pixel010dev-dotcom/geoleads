import { createClient } from '@supabase/supabase-js';
import { hasFeature, type FeatureKey, type PlanId } from '@/lib/plans';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

export type AuthResult = {
  user: { id: string; email?: string };
  planId: PlanId;
  tokens: number;
};

export async function getAuthUser(request: Request): Promise<AuthResult | null> {
  const authHeader = request.headers.get('authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('tokens, plan_id')
    .eq('id', data.user.id)
    .maybeSingle();

  return {
    user: { id: data.user.id, email: data.user.email },
    planId: (profile?.plan_id as PlanId) || 'free',
    tokens: typeof profile?.tokens === 'number' ? profile.tokens : 10
  };
}

export function requireFeature(planId: PlanId, feature: FeatureKey): boolean {
  return hasFeature(planId, feature);
}

export function requirePlanLevel(planId: PlanId, requiredPlanId: PlanId): boolean {
  const order: PlanId[] = ['free', 'starter', 'pro', 'agency'];
  return order.indexOf(planId) >= order.indexOf(requiredPlanId);
}
