import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/server-auth';

const FB_GRAPH = 'https://graph.facebook.com/v21.0';

async function callFacebook(path: string, options?: RequestInit) {
  // TODO: All users currently share one FACEBOOK_ACCESS_TOKEN. This needs per-user tokens.
  const token = process.env.FACEBOOK_ACCESS_TOKEN;
  if (!token) throw new Error('FACEBOOK_ACCESS_TOKEN não configurado');
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

export async function GET(request: Request) {
  try {
    const auth = await getAuthUser(request);
    if (!auth) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const accountId = process.env.FACEBOOK_AD_ACCOUNT;
    if (!accountId) return NextResponse.json({ error: 'FACEBOOK_AD_ACCOUNT não configurado' }, { status: 400 });

    const data = await callFacebook(
      `/act_${accountId}/campaigns?fields=id,name,status,daily_budget,lifetime_budget,spend,impressions,reach,start_time,stop_time,objective,created_time&limit=50`
    );

    return NextResponse.json({ campaigns: data.data || [] });
  } catch (err: any) {
    console.error('[FACEBOOK ADS] GET error:', err);
    return NextResponse.json({ error: 'Erro ao buscar campanhas' }, { status: 500 });
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

    const data = await callFacebook(`/${campaignId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    console.error('[FACEBOOK ADS] PATCH error:', err);
    return NextResponse.json({ error: 'Erro ao atualizar campanha' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await getAuthUser(request);
    if (!auth) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const { campaignId } = await request.json();
    if (!campaignId) return NextResponse.json({ error: 'campaignId obrigatório' }, { status: 400 });

    await callFacebook(`/${campaignId}`, {
      method: 'DELETE',
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[FACEBOOK ADS] DELETE error:', err);
    return NextResponse.json({ error: 'Erro ao excluir campanha' }, { status: 500 });
  }
}
