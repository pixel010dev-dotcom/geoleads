import { NextResponse } from 'next/server';
import { createAdminSupabaseClient, getAuthUser } from '@/lib/server-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const WEBHOOK_SECRET = process.env.AUTOVENDAS_WEBHOOK_SECRET || '';

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!WEBHOOK_SECRET || authHeader !== `Bearer ${WEBHOOK_SECRET}`) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { campaignId, leadPhone, responseText } = body;

    if (!campaignId || !leadPhone) {
      return NextResponse.json({ received: true }, { status: 200 });
    }

    const supabase = createAdminSupabaseClient();

    const { data: lead, error: findError } = await supabase
      .from('autovendas_leads')
      .select('*')
      .eq('campaign_id', campaignId)
      .eq('telefone', leadPhone)
      .maybeSingle();

    if (findError || !lead) {
      return NextResponse.json({ received: true, note: 'Lead não encontrado.' }, { status: 200 });
    }

    await supabase
      .from('autovendas_leads')
      .update({
        status: 'responded',
        responded_at: new Date().toISOString(),
        response_text: responseText || 'Resposta recebida via WhatsApp',
      })
      .eq('id', lead.id);

    const { data: camp } = await supabase
      .from('autovendas_campaigns')
      .select('total_responses')
      .eq('id', campaignId)
      .single();
    if (camp) {
      await supabase
        .from('autovendas_campaigns')
        .update({ total_responses: (camp.total_responses || 0) + 1 })
        .eq('id', campaignId);
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ received: true }, { status: 200 });
  }
}
