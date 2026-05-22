import { NextResponse } from 'next/server';
import { getAuthUser, requireFeature, createAdminSupabaseClient } from '@/lib/server-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const auth = await getAuthUser(request);
  if (!auth) {
    return NextResponse.json({ error: 'Nao autenticado.' }, { status: 401 });
  }

  if (!requireFeature(auth.planId, 'whatsappSender')) {
    return NextResponse.json({ error: 'Disparo WhatsApp exige plano Pro ou superior.' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(Number(searchParams.get('limit')) || 50, 200);
  const offset = Number(searchParams.get('offset')) || 0;

  const supabase = createAdminSupabaseClient();
  const { data, error, count } = await supabase
    .from('whatsapp_messages')
    .select('*', { count: 'exact' })
    .eq('user_id', auth.user.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, messages: data || [], total: count || 0 });
}
