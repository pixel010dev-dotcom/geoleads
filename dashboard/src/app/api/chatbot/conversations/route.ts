import { NextResponse } from 'next/server';
import { withErrorHandler } from '@/lib/api-error-handler';
import { getAuthUser, createAdminSupabaseClient } from '@/lib/server-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = withErrorHandler(async (request: Request) => {
  const auth = await getAuthUser(request);
  if (!auth) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const limit = Math.min(Number(searchParams.get('limit')) || 50, 200);
  const offset = Number(searchParams.get('offset')) || 0;

  const supabase = createAdminSupabaseClient();
  const { data, error, count } = await supabase
    .from('chatbot_conversations')
    .select('*', { count: 'exact' })
    .eq('user_id', auth.user.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) return NextResponse.json({ error: 'Erro ao buscar conversas' }, { status: 500 });
  return NextResponse.json({ success: true, conversations: data, total: count });
});

export const POST = withErrorHandler(async (request: Request) => {
  const auth = await getAuthUser(request);
  if (!auth) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });

  const supabase = createAdminSupabaseClient();
  const body = await request.json();

  const { data, error } = await supabase.from('chatbot_conversations').insert({
    user_id: auth.user.id,
    contact_jid: body.contactJid,
    contact_name: body.contactName || '',
    contact_phone: body.contactPhone || '',
    message_text: body.messageText,
    direction: body.direction || 'incoming',
    rule_id: body.ruleId || null,
  }).select().single();

  if (error) return NextResponse.json({ error: 'Erro ao salvar conversa' }, { status: 500 });
  return NextResponse.json({ success: true, conversation: data });
});
