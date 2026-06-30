import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const CRON_SECRET = process.env.CRON_SECRET || '';

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')?.replace('Bearer ', '') || '';
  const querySecret = req.nextUrl.searchParams.get('secret') || '';
  if (CRON_SECRET && authHeader !== CRON_SECRET && querySecret !== CRON_SECRET) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  if (!SUPABASE_SERVICE_KEY || !SUPABASE_URL) {
    return NextResponse.json({ error: 'Missing env vars' }, { status: 500 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const now = new Date().toISOString();

  const { data: campaigns, error } = await supabase
    .from('whatsapp_campaigns')
    .select('*')
    .eq('status', 'scheduled')
    .lte('scheduled_at', now)
    .limit(5);

  if (error) {
    console.error('[CAMPAIGN] Erro ao buscar campanhas:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!campaigns || campaigns.length === 0) {
    return NextResponse.json({ processed: 0 });
  }

  const results: { campaignId: string; sent: number; failed: number }[] = [];

  for (const campaign of campaigns) {
    await supabase.from('whatsapp_campaigns').update({ status: 'sending' }).eq('id', campaign.id);

    const sessionStore = (globalThis as any).__geoleadsChatbotSessions as Map<string, any>;
    if (!sessionStore) {
      console.error('[CAMPAIGN] Session store not available');
      await supabase.from('whatsapp_campaigns').update({ status: 'cancelled' }).eq('id', campaign.id);
      continue;
    }

    const session = sessionStore.get(campaign.user_id);
    if (!session || session.status !== 'connected' || !session.socket) {
      console.error(`[CAMPAIGN] User ${campaign.user_id} WhatsApp not connected`);
      await supabase.from('whatsapp_campaigns').update({ status: 'cancelled' }).eq('id', campaign.id);
      continue;
    }

    const leadKeys: string[] = campaign.lead_keys || [];
    if (leadKeys.length === 0) {
      await supabase.from('whatsapp_campaigns').update({ status: 'sent', sent_count: 0 }).eq('id', campaign.id);
      continue;
    }

    let sentCount = 0;
    let failCount = 0;

    for (let i = 0; i < leadKeys.length; i++) {
      const leadKey = leadKeys[i];
      const parts = leadKey.split('||');
      const leadName = parts[0] || 'Lead';
      const leadPhone = parts[1] || '';

      if (!leadPhone || leadPhone.length < 10) {
        failCount++;
        continue;
      }

      const jid = `${leadPhone.replace(/\D/g, '')}@s.whatsapp.net`;
      let message = campaign.message_template;
      message = message.replace(/{Nome}/g, leadName);
      message = message.replace(/{Telefone}/g, leadPhone);

      try {
        await session.socket.sendMessage(jid, { text: message });
        sentCount++;

        await supabase.from('wa_campaign_leads').insert({
          campaign_id: campaign.id,
          lead_jid: jid,
          lead_name: leadName,
          lead_phone: leadPhone,
          status: 'sent',
          sent_at: new Date().toISOString(),
        });

        await supabase.from('whatsapp_messages').insert({
          user_id: campaign.user_id,
          lead_id: null,
          lead_name: leadName,
          lead_phone: leadPhone,
          message,
          status: 'sent',
          sent_at: new Date().toISOString(),
        });
      } catch (err: any) {
        failCount++;
        await supabase.from('wa_campaign_leads').insert({
          campaign_id: campaign.id,
          lead_jid: jid,
          lead_name: leadName,
          lead_phone: leadPhone,
          status: 'failed',
          error_message: err?.message || 'Erro ao enviar',
        });
      }

      if (i < leadKeys.length - 1) {
        const delay = 20000 + Math.random() * 40000;
        await new Promise(r => setTimeout(r, delay));
      }
    }

    await supabase.from('whatsapp_campaigns').update({
      status: 'sent',
      sent_count: sentCount,
      fail_count: failCount,
      sent_at: new Date().toISOString(),
    }).eq('id', campaign.id);

    results.push({ campaignId: campaign.id, sent: sentCount, failed: failCount });
  }

  return NextResponse.json({ processed: results.length, results });
}
