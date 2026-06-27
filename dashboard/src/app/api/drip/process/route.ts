import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendDripEmail } from '@/lib/email';

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

  // Find due drip emails (limit 50 por execução pra não sobrecarregar)
  const now = new Date().toISOString();
  const { data: due, error } = await supabase
    .from('drip_schedule')
    .select('id, user_id, email, name, day')
    .eq('sent', false)
    .lte('scheduled_at', now)
    .limit(50);

  if (error) {
    console.error('[DRIP] Erro ao buscar agendamentos:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const results: { id: string; ok: boolean }[] = [];

  // Envia emails em paralelo (max 5 simultâneos)
  const CONCURRENCY = 5;
  for (let i = 0; i < (due || []).length; i += CONCURRENCY) {
    const batch = (due || []).slice(i, i + CONCURRENCY);
    const batchResults = await Promise.all(batch.map(async (item) => {
      const ok = await sendDripEmail(item.email, item.name, item.day);
      if (ok) {
        await supabase.from('drip_schedule').update({ sent: true, sent_at: now }).eq('id', item.id);
      }
      return { id: item.id, ok };
    }));
    results.push(...batchResults);
  }

  return NextResponse.json({ processed: results.length, results });
}
