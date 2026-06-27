import { NextResponse } from 'next/server';
import { createRequestSupabaseClient, getAuthUser, createAdminSupabaseClient } from '@/lib/server-auth';

export async function POST(request: Request) {
  try {
    const auth = await getAuthUser(request);
    if (!auth) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const { jobId } = await request.json();
    if (!jobId) {
      return NextResponse.json({ error: 'jobId é obrigatório' }, { status: 400 });
    }

    const supabase = createRequestSupabaseClient(request);
    const adminSupabase = createAdminSupabaseClient();

    // Verifica se o job pertence ao usuario e esta running (usa admin pra evitar RLS issues)
    const { data: job, error: jobError } = await adminSupabase
      .from('extraction_jobs')
      .select('id, status, leads_count')
      .eq('id', jobId)
      .eq('user_id', auth.user.id)
      .single();

    if (jobError || !job) {
      return NextResponse.json({ error: 'Job não encontrado' }, { status: 404 });
    }

    if (job.status !== 'running' && job.status !== 'pending') {
      return NextResponse.json({ error: 'Job já foi finalizado' }, { status: 409 });
    }

    // Reembolsa tokens via admin client
    const leadsConsumed = job.leads_count || 0;
    if (leadsConsumed > 0) {
      const { error: refundError } = await adminSupabase.rpc('credit_tokens_with_history', {
        p_user_id: auth.user.id,
        p_tokens_to_add: leadsConsumed,
        p_new_plan_id: auth.planId || 'free',
        p_mp_payment_id: `refund_cancel_${jobId}`,
        p_amount: 0,
      });
      if (refundError) {
        console.error('[CANCEL] Falha ao reembolsar tokens:', refundError);
      }
    }

    // Marca job como cancelado
    const { data: updatedJob, error: updateError } = await supabase
      .from('extraction_jobs')
      .update({
        status: 'cancelled',
        completed_at: new Date().toISOString(),
        message: leadsConsumed > 0 ? 'Extração cancelada. Tokens reembolsados.' : 'Extração cancelada.',
      })
      .eq('id', jobId)
      .eq('user_id', auth.user.id)
      .select()
      .single();

    if (updateError) {
      console.error('[CANCEL] Falha ao atualizar job:', updateError?.message || updateError);
      return NextResponse.json({ error: 'Falha ao cancelar extração' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: leadsConsumed > 0 ? 'Extração cancelada e tokens reembolsados.' : 'Extração cancelada.',
      job: updatedJob,
    });
  } catch (err: any) {
    console.error('[CANCEL] Erro:', err?.message || err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
