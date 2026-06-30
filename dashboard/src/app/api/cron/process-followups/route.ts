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

  const { data: pending, error } = await supabase
    .from('wa_followups')
    .select('*')
    .eq('status', 'pending')
    .lte('scheduled_at', now)
    .limit(30);

  if (error) {
    console.error('[FOLLOWUP] Erro ao buscar follow-ups:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!pending || pending.length === 0) {
    return NextResponse.json({ processed: 0 });
  }

  const results: { id: string; ok: boolean }[] = [];

  for (const item of pending) {
    const sessionStore = (globalThis as any).__geoleadsChatbotSessions as Map<string, any>;
    const session = sessionStore?.get(item.user_id);

    if (!session || session.status !== 'connected' || !session.socket) {
      await supabase.from('wa_followups').update({ status: 'skipped' }).eq('id', item.id);
      results.push({ id: item.id, ok: false });
      continue;
    }

    try {
      let message = item.message_template;
      message = message.replace(/{Nome}/g, item.lead_name || '');
      message = message.replace(/{Telefone}/g, item.lead_phone || '');

      await session.socket.sendMessage(item.lead_jid, { text: message });

      await supabase.from('wa_followups').update({
        status: 'sent',
        sent_at: new Date().toISOString(),
      }).eq('id', item.id);

      results.push({ id: item.id, ok: true });
    } catch {
      await supabase.from('wa_followups').update({
        status: 'failed',
      }).eq('id', item.id);

      results.push({ id: item.id, ok: false });
    }

    await new Promise(r => setTimeout(r, 15000 + Math.random() * 25000));
  }

  return NextResponse.json({ processed: results.length, results });
}
