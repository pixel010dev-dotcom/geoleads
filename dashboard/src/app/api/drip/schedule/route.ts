import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const DRIP_DAYS = [1, 3, 5, 7];

export async function POST(req: NextRequest) {
  if (!SUPABASE_SERVICE_KEY) {
    return NextResponse.json({ error: 'Service key not configured' }, { status: 500 });
  }

  const { userId, email, name } = await req.json();
  if (!userId || !email) {
    return NextResponse.json({ error: 'userId and email required' }, { status: 400 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  const schedules = DRIP_DAYS.map(day => {
    const scheduled_at = new Date(Date.now() + day * 24 * 60 * 60 * 1000).toISOString();
    return { user_id: userId, email, name: name || email.split('@')[0], day, scheduled_at, sent: false };
  });

  const { error } = await supabase.from('drip_schedule').insert(schedules);

  if (error) {
    console.error('[DRIP] Erro ao agendar:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, scheduled: DRIP_DAYS.length });
}
