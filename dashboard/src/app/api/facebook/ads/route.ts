import { NextResponse } from 'next/server';
import { getAuthUser, createAdminSupabaseClient } from '@/lib/server-auth';

const FB_GRAPH = 'https://graph.facebook.com/v21.0';

async function callFacebook(path: string, token: string, options?: RequestInit) {
  if (!token) throw new Error('Facebook token não disponível');
  const url = `${FB_GRAPH}${path}`;
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${token}`,
    ...(options?.headers as Record<string, string> || {}),
  };
  const res = await fetch(url, { ...options, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Erro Facebook: ${res.status}`);
  }
  return res.json();
}

async function getUserFacebookConfig(userId: string) {
  const supabase = createAdminSupabaseClient();
  const { data: profile } = await supabase
    .from('profiles')
    .select('facebook_access_token, facebook_ad_account')
    .eq('id', userId)
    .maybeSingle();
  return {
    token: profile?.facebook_access_token || process.env.FACEBOOK_ACCESS_TOKEN || '',
    adAccount: profile?.facebook_ad_account || process.env.FACEBOOK_AD_ACCOUNT || '',
  };
}

export async function GET(request: Request) {
  try {
    const auth = await getAuthUser(request);
    if (!auth) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const fb = await getUserFacebookConfig(auth.user.id);
    if (!fb.adAccount) return NextResponse.json({ error: 'Conta de anúncio não configurada' }, { status: 400 });

    const data = await callFacebook(
      `/act_${fb.adAccount}/campaigns?fields=id,name,status,daily_budget,lifetime_budget,spend,impressions,reach,start_time,stop_time,objective,created_time&limit=50`,
      fb.token
    );

    return NextResponse.json({ campaigns: data.data || [] });
  } catch (err: any) {
    console.error('[FACEBOOK ADS] GET error:', err);
    return NextResponse.json({ error: err.message || 'Erro ao buscar campanhas' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await getAuthUser(request);
    if (!auth) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const { campaignId, status } = await request.json();
    if (!campaignId || !['ACTIVE', 'PAUSED'].includes(status)) {
      return NextResponse.json({ error: 'campaignId e status (ACTIVE|PAUSED) obrigatórios' }, { status: 400 });
    }

    const fb = await getUserFacebookConfig(auth.user.id);
    const data = await callFacebook(`/${campaignId}`, fb.token, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    console.error('[FACEBOOK ADS] PATCH error:', err);
    return NextResponse.json({ error: err.message || 'Erro ao atualizar campanha' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await getAuthUser(request);
    if (!auth) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const { campaignId } = await request.json();
    if (!campaignId) return NextResponse.json({ error: 'campaignId obrigatório' }, { status: 400 });

    const fb = await getUserFacebookConfig(auth.user.id);
    await callFacebook(`/${campaignId}`, fb.token, { method: 'DELETE' });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[FACEBOOK ADS] DELETE error:', err);
    return NextResponse.json({ error: err.message || 'Erro ao excluir campanha' }, { status: 500 });
  }
}
