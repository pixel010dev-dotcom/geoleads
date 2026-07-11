import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';

let supabaseClient: SupabaseClient | null = null;

function getSupabase(): SupabaseClient | null {
  if (supabaseClient) return supabaseClient;
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      console.warn('[newsletter] Missing SUPABASE_SERVICE_ROLE_KEY, skipping DB');
      return null;
    }
    const { createClient } = require('@supabase/supabase-js') as typeof import('@supabase/supabase-js');
    supabaseClient = createClient(url, key);
    return supabaseClient;
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  try {
    const { email, source = 'blog' } = await req.json();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Email inválido' }, { status: 400 });
    }

    const supabase = getSupabase();
    if (!supabase) {
      return NextResponse.json({ ok: true, message: 'DB not configured' });
    }

    const { error } = await supabase
      .from('newsletter_subscriptions')
      .insert({ email, source } as any);

    if (error?.code === '23505') {
      return NextResponse.json({ ok: true, message: 'Email já cadastrado' });
    }

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
