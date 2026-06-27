import { NextResponse } from 'next/server';
import { getAuthUser, createAdminSupabaseClient } from '@/lib/server-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthUser(request);
  if (!auth) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });

  const { id } = await params;
  const supabase = createAdminSupabaseClient();
  const body = await request.json();

  const { data: campaign, error: findError } = await supabase
    .from('autovendas_campaigns')
    .select('*')
    .eq('id', id)
    .eq('user_id', auth.user.id)
    .maybeSingle();

  if (findError) return NextResponse.json({ error: 'Erro ao buscar campanha.' }, { status: 500 });
  if (!campaign) return NextResponse.json({ error: 'Campanha não encontrada.' }, { status: 404 });

  let update: Record<string, any> = {};
  const action = body.action;

  if (action === 'start') {
    if (campaign.payment_status !== 'paid') {
      return NextResponse.json({ error: 'Pagamento ainda não aprovado.' }, { status: 400 });
    }
    update = { status: 'running', started_at: new Date().toISOString() };
  } else if (action === 'pause') {
    update = { status: 'paused' };
  } else if (action === 'cancel') {
    update = { status: 'cancelled' };
  } else {
    return NextResponse.json({ error: 'Ação inválida.' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('autovendas_campaigns')
    .update(update)
    .eq('id', id)
    .eq('user_id', auth.user.id)
    .select()
    .single();

  if (error || !data) return NextResponse.json({ error: error?.message || 'Erro ao atualizar campanha' }, { status: 500 });
  return NextResponse.json({ success: true, campaign: data });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthUser(request);
  if (!auth) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });

  const { id } = await params;
  const supabase = createAdminSupabaseClient();

  const { data: campaign } = await supabase
    .from('autovendas_campaigns')
    .select('status')
    .eq('id', id)
    .eq('user_id', auth.user.id)
    .maybeSingle();

  if (!campaign) return NextResponse.json({ error: 'Campanha não encontrada.' }, { status: 404 });
  if (campaign.status === 'running') {
    return NextResponse.json({ error: 'Não é possível excluir uma campanha em execução.' }, { status: 400 });
  }

  const { error } = await supabase
    .from('autovendas_campaigns')
    .delete()
    .eq('id', id)
    .eq('user_id', auth.user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
