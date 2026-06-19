import { NextResponse } from 'next/server';
import { createAdminSupabaseClient, getAuthUser } from '@/lib/server-auth';

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'pixel010dev@gmail.com';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUser(request);
  if (!auth || auth.user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 });
  }

  const { id } = await params;

  try {
    const body = await request.json();
    const { approved } = body;

    if (typeof approved !== 'boolean') {
      return NextResponse.json({ error: 'Campo "approved" deve ser boolean' }, { status: 400 });
    }

    const client = createAdminSupabaseClient();
    const { error } = await client
      .from('testimonials')
      .update({ approved })
      .eq('id', id);

    if (error) {
      console.error('[ADMIN TESTIMONIALS] Update error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[ADMIN TESTIMONIALS] Error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
