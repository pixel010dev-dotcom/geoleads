import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { createAdminSupabaseClient } from '@/lib/server-auth';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { rating, feedback, name, userId } = body;

    if (!rating || rating < 1 || rating > 5) {
      return NextResponse.json({ error: 'Nota inválida (1-5)' }, { status: 400 });
    }

    const client = createAdminSupabaseClient();
    const { error } = await client.from('testimonials').insert({
      user_id: userId || null,
      name: name || 'Usuário',
      rating,
      feedback: feedback || null,
      approved: false,
    });

    if (error) {
      console.error('[FEEDBACK] Insert error:', error);
      return NextResponse.json({ error: 'Erro ao salvar feedback' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[FEEDBACK] Error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
