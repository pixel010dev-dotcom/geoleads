import { NextResponse } from 'next/server';
import { getAuthUser, createAdminSupabaseClient } from '@/lib/server-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const auth = await getAuthUser(request);
  if (!auth) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });

  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from('autovendas_campaigns')
    .select('*')
    .eq('user_id', auth.user.id)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, campaigns: data });
}

export async function POST(request: Request) {
  const auth = await getAuthUser(request);
  if (!auth) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });

  const supabase = createAdminSupabaseClient();
  const body = await request.json();

  if (!body.nicho || !body.regiao || !body.mensagem_template) {
    return NextResponse.json({ error: 'Preencha nicho, região e mensagem.' }, { status: 400 });
  }
  const nicho = String(body.nicho).trim();
  const regiao = String(body.regiao).trim();
  const mensagem_template = String(body.mensagem_template).trim();

  const AUTOVENDAS_PRICE_PER_LEAD = Number(process.env.AUTOVENDAS_PRICE_PER_LEAD) || 0.5;
  const leadsAlvo = Math.min(200, Math.max(10, Number(body.leads_alvo) || 50));
  const price = leadsAlvo * AUTOVENDAS_PRICE_PER_LEAD;

  const { data, error } = await supabase.from('autovendas_campaigns').insert({
    user_id: auth.user.id,
    nicho,
    regiao,
    mensagem_template,
    leads_alvo: leadsAlvo,
    status: 'draft',
    payment_status: 'pending',
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, campaign: data, price });
}
