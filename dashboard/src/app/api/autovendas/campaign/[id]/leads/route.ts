import { NextResponse } from 'next/server';
import { getAuthUser, createAdminSupabaseClient } from '@/lib/server-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthUser(request);
  if (!auth) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });

  const { id } = await params;
  const supabase = createAdminSupabaseClient();

  const { data: campaign } = await supabase
    .from('autovendas_campaigns')
    .select('user_id')
    .eq('id', id)
    .single();

  if (!campaign || campaign.user_id !== auth.user.id) {
    return NextResponse.json({ error: 'Campanha não encontrada.' }, { status: 404 });
  }

  const { data, error } = await supabase
    .from('autovendas_leads')
    .select('*')
    .eq('campaign_id', id)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, leads: data });
}
