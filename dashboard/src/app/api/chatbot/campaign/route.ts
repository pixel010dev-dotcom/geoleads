import { NextResponse } from 'next/server';
import { getAuthUser, requireFeature, createAdminSupabaseClient } from '@/lib/server-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const auth = await getAuthUser(request);
  if (!auth) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });

  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from('whatsapp_campaigns')
    .select('*')
    .eq('user_id', auth.user.id)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, campaigns: data });
}

export async function POST(request: Request) {
  const auth = await getAuthUser(request);
  if (!auth) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  if (!requireFeature(auth.planId, 'whatsappSender')) {
    return NextResponse.json({ error: 'Disparo WhatsApp exige plano Pro ou superior.' }, { status: 403 });
  }

  const supabase = createAdminSupabaseClient();
  const body = await request.json();
  const action = body.action;

  if (action === 'create') {
    const { data, error } = await supabase.from('whatsapp_campaigns').insert({
      user_id: auth.user.id,
      name: body.name || 'Campanha sem nome',
      message_template: body.messageTemplate || '',
      lead_keys: body.leadKeys || [],
      scheduled_at: body.scheduledAt || null,
      status: body.scheduledAt ? 'scheduled' : 'draft',
      total_leads: (body.leadKeys || []).length,
    }).select().single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, campaign: data });
  }

  if (action === 'update') {
    const { data, error } = await supabase.from('whatsapp_campaigns')
      .update({
        status: body.status,
        sent_count: body.sentCount,
        fail_count: body.failCount,
        sent_at: body.status === 'sent' ? new Date().toISOString() : undefined,
      })
      .eq('id', body.campaignId)
      .eq('user_id', auth.user.id)
      .select().single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, campaign: data });
  }

  if (action === 'delete') {
    const { error } = await supabase.from('whatsapp_campaigns')
      .delete().eq('id', body.campaignId).eq('user_id', auth.user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: 'Ação inválida.' }, { status: 400 });
}
