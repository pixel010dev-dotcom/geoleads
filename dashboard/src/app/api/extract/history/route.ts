import { NextResponse } from 'next/server';
import { createRequestSupabaseClient, getAuthUser } from '@/lib/server-auth';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const auth = await getAuthUser(request);
    if (!auth) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const supabase = createRequestSupabaseClient(request);
    const { data, error } = await supabase
      .from('extraction_history')
      .select('*')
      .eq('user_id', auth.user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;
    return NextResponse.json({ success: true, history: data || [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
