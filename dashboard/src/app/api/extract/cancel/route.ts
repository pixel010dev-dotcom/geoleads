import { NextResponse } from 'next/server';
import { createRequestSupabaseClient, getAuthUser, createAdminSupabaseClient } from '@/lib/server-auth';
import { refundReservation } from '@/lib/billing';

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

    // Verifica se o job pertence ao usuario e esta running
    const { data: job, error: jobError } = await supabase
      .from('extraction_jobs')
      .select('id, status, reservation_id')
      .eq('id', jobId)
      .eq('user_id', auth.user.id)
      .single();

    if (jobError || !job) {
      return NextResponse.json({ error: 'Job não encontrado' }, { status: 404 });
    }

    if (job.status !== 'running' && job.status !== 'pending') {
      return NextResponse.json({ error: 'Job já foi finalizado' }, { status: 409 });
    }

    // Reembolso atômico da reserva
    if (job.reservation_id) {
      const refundResult = await refundReservation(job.reservation_id);
      if ('error' in refundResult) {
        console.error('[CANCEL] Falha ao reembolsar:', refundResult.error);
        return NextResponse.json({ error: 'Falha ao processar reembolso' }, { status: 500 });
      }
    }

    // Marca job como cancelado
    const { data: updatedJob, error: updateError } = await supabase
      .from('extraction_jobs')
      .update({
        status: 'cancelled',
        completed_at: new Date().toISOString(),
        message: 'Extração cancelada pelo usuário. Tokens reembolsados.',
      })
      .eq('id', jobId)
      .eq('user_id', auth.user.id)
      .select()
      .single();

    if (updateError) {
      console.error('[CANCEL] Falha ao atualizar job:', updateError.message);
      return NextResponse.json({ error: 'Falha ao cancelar extração' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Extração cancelada e tokens reembolsados.',
      job: updatedJob,
    });
  } catch (err: any) {
    console.error('[CANCEL] Erro:', err.message);
    return NextResponse.json({ error: err.message || 'Erro interno' }, { status: 500 });
  }
}
