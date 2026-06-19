import { NextResponse } from 'next/server';
import { createAdminSupabaseClient, getAuthUser } from '@/lib/server-auth';

export async function POST(request: Request) {
  try {
    const auth = await getAuthUser(request);
    if (!auth) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const { ref } = await request.json();
    if (!ref || typeof ref !== 'string') {
      return NextResponse.json({ error: 'Código de indicação inválido' }, { status: 400 });
    }

    const supabase = createAdminSupabaseClient();

    // Check if user already has a referrer
    const { data: profile } = await supabase.from('profiles').select('referred_by').eq('id', auth.user.id).maybeSingle();
    if (profile?.referred_by) {
      return NextResponse.json({ error: 'Você já foi indicado por alguém' }, { status: 400 });
    }

    // Check if referrer exists (ref is a valid user UUID)
    const { data: referrer } = await supabase.from('profiles').select('id').eq('id', ref).maybeSingle();
    if (!referrer) {
      return NextResponse.json({ error: 'Código de indicação não encontrado' }, { status: 404 });
    }

    // Don't allow self-referral
    if (referrer.id === auth.user.id) {
      return NextResponse.json({ error: 'Você não pode indicar a si mesmo' }, { status: 400 });
    }

    const { error } = await supabase.from('profiles').update({ referred_by: ref }).eq('id', auth.user.id);
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: 'Erro ao processar indicação' }, { status: 500 });
  }
}
