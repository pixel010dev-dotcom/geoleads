import { NextResponse } from 'next/server';
import { createRequestSupabaseClient, getAuthUser } from '@/lib/server-auth';

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
        search_time_seconds: data.search_time_seconds,
        message: data.message,
        error: data.error,
        leads: data.status === 'completed' ? data.leads : [],
        started_at: data.started_at,
        completed_at: data.completed_at,
      }
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
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
    const { jobId } = await params;
    const body = await _request.json();

    const { data, error } = await supabase
      .from('extraction_jobs')
      .update({ ...body, completed_at: body.status === 'cancelled' ? new Date().toISOString() : undefined })
      .eq('id', jobId)
      .eq('user_id', auth.user.id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, job: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
