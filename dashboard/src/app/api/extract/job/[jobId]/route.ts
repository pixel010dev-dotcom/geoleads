import { NextResponse } from 'next/server';
import { createRequestSupabaseClient, getAuthUser, createAdminSupabaseClient } from '@/lib/server-auth';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const auth = await getAuthUser(_request);
    if (!auth) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const supabase = createRequestSupabaseClient(_request);
    const { jobId } = await params;

    const { data, error } = await supabase
      .from('extraction_jobs')
      .select('*')
      .eq('id', jobId)
      .eq('user_id', auth.user.id)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Job não encontrado' }, { status: 404 });
    }

    // So entrega leads se o job foi entregue (delivered = true)
    // Enquanto esta rodando, leads ficam ocultos ate o pagamento ser confirmado
    const leads = data.delivered ? (data.leads || []) : [];

    return NextResponse.json({
      success: true,
      job: {
        id: data.id,
        status: data.status,
        keyword: data.keyword,
        location: data.location,
        limit_requested: data.limit_requested,
        leads_count: data.leads_count,
        scanned: data.scanned,
        cities_scanned: data.cities_scanned,
        search_time_seconds: data.status === 'running' && data.started_at
          ? Math.floor((Date.now() - new Date(data.started_at).getTime()) / 1000)
          : data.search_time_seconds,
        message: data.message,
        error: data.error,
        leads,
        started_at: data.started_at,
        completed_at: data.completed_at,
        delivered: data.delivered,
      }
    });
  } catch (err: any) {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const auth = await getAuthUser(_request);
    if (!auth) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const supabase = createRequestSupabaseClient(_request);
    const adminSupabase = createAdminSupabaseClient();
    const { jobId } = await params;
    const body = await _request.json();

    // Valida campos permitidos - so aceita 'status' e 'cancelled'
    const allowedFields = ['status'];
    const invalidFields = Object.keys(body).filter(k => !allowedFields.includes(k));
    if (invalidFields.length > 0) {
      return NextResponse.json({ error: `Campos nao permitidos: ${invalidFields.join(', ')}` }, { status: 400 });
    }

    if (body.status === 'cancelled') {
      const { data: job } = await supabase
        .from('extraction_jobs')
        .select('leads_count')
        .eq('id', jobId)
        .eq('user_id', auth.user.id)
        .maybeSingle();
      const leadsConsumed = job?.leads_count || 0;
      if (leadsConsumed > 0) {
        try {
          await adminSupabase.rpc('credit_tokens_with_history', {
            p_user_id: auth.user.id,
            p_tokens_to_add: leadsConsumed,
            p_new_plan_id: 'free',
            p_mp_payment_id: `refund_patch_${jobId}`,
            p_amount: 0,
          });
        } catch (e: any) {
          console.error('[BILLING] Falha ao reembolsar no cancelamento:', e?.message || e);
        }
      }
    }

    const { data, error } = await adminSupabase
      .from('extraction_jobs')
      .update({
        status: body.status,
        completed_at: body.status === 'cancelled' ? new Date().toISOString() : undefined,
      })
      .eq('id', jobId)
      .eq('user_id', auth.user.id)
      .select()
      .single();

    if (error || !data) return NextResponse.json({ error: 'Erro ao atualizar job' }, { status: 500 });
    return NextResponse.json({ success: true, job: data });
  } catch (err: any) {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
