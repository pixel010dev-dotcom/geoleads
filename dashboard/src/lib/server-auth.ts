import { createClient } from '@supabase/supabase-js';
import { getPlanIdFromTokens, getPlanLevel, hasFeature, type FeatureKey, type PlanId } from '@/lib/plans';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('[SERVER-AUTH] NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY são obrigatórios');
}

const supabase = createClient(supabaseUrl || 'https://placeholder.supabase.co', supabaseAnonKey || 'placeholder');

export type AuthResult = {
  user: { id: string; email?: string };
  planId: PlanId;
  tokens: number;
};

export function getBearerToken(request: Request) {
  const authHeader = request.headers.get('authorization') || '';
  return authHeader.replace(/^Bearer\s+/i, '').trim();
}

export function createAuthedSupabaseClient(token: string) {
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`
      }
    }
  });
}

export function createRequestSupabaseClient(request: Request) {
  const token = getBearerToken(request);
  return token ? createAuthedSupabaseClient(token) : supabase;
}

export function createAdminSupabaseClient() {
  return createClient(supabaseUrl, supabaseServiceKey || supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}

export function hasSupabaseServiceRole() {
  return Boolean(supabaseServiceKey);
}

export async function getAuthUser(request: Request): Promise<AuthResult | null> {
  const token = getBearerToken(request);
  if (!token) return null;

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;

  const profileSupabase = hasSupabaseServiceRole()
    ? createAdminSupabaseClient()
    : createAuthedSupabaseClient(token);
  const { data: profile } = await profileSupabase
    .from('profiles')
    .select('tokens, plan_id')
    .eq('id', data.user.id)
    .maybeSingle();

  const tokens = typeof profile?.tokens === 'number' ? profile.tokens : 5;
  const savedPlanId = (profile?.plan_id as PlanId) || 'free';
  const inferredPlanId = getPlanIdFromTokens(tokens);

  return {
    user: { id: data.user.id, email: data.user.email },
    planId: getPlanLevel(savedPlanId) >= getPlanLevel(inferredPlanId) ? savedPlanId : inferredPlanId,
    tokens
  };
}

export function requireFeature(planId: PlanId, feature: FeatureKey): boolean {
  return hasFeature(planId, feature);
}

export function requirePlanLevel(planId: PlanId, requiredPlanId: PlanId): boolean {
  const order: PlanId[] = ['free', 'starter', 'pro', 'agency'];
  return order.indexOf(planId) >= order.indexOf(requiredPlanId);
}
