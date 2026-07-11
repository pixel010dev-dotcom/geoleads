import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { email, name, source, product } = await req.json();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Email inválido' }, { status: 400 });
    }
    if (!name || name.length < 2) {
      return NextResponse.json({ error: 'Nome inválido' }, { status: 400 });
    }

    // Try existing table, fallback to newsletter
    const { error } = await supabase
      .from('newsletter_subscriptions')
      .insert({ email, source: `leadmagnet_${source}`, name, metadata: { product } })
      .maybeSingle();

    // Ignore duplicate errors
    if (error && error.code !== '23505') {
      console.error('lead-magnet insert error:', error);
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('lead-magnet api error:', e);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
