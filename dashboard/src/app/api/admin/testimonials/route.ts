import { NextResponse } from 'next/server';
import { createAdminSupabaseClient, getAuthUser } from '@/lib/server-auth';

const ADMIN_EMAIL = 'pixel010dv@gmail.com';

export async function GET(request: Request) {
  const auth = await getAuthUser(request);
  if (!auth || auth.user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 });
  }

  try {
    const client = createAdminSupabaseClient();
    const { data, error } = await client
      .from('testimonials')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[ADMIN TESTIMONIALS] Fetch error:', error);
      return NextResponse.json({ testimonials: [], error: error.message }, { status: 500 });
    }

    return NextResponse.json({ testimonials: data || [] });
  } catch (err) {
    console.error('[ADMIN TESTIMONIALS] Error:', err);
    return NextResponse.json({ testimonials: [], error: 'Erro interno' }, { status: 500 });
  }
}
