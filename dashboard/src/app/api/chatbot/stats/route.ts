import { NextResponse } from 'next/server';
import { getAuthUser, createAdminSupabaseClient } from '@/lib/server-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const auth = await getAuthUser(request);
  if (!auth) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });

  const supabase = createAdminSupabaseClient();
  const userId = auth.user.id;

  const today = new Date();
  // Ajusta para BRT (UTC-3) — Brasil não usa horário de verão
  today.setHours(today.getHours() - 3, 0, 0, 0);
  const todayStr = today.toISOString();

  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  const [msgRes, convRes, todayMsgRes, weekMsgRes] = await Promise.all([
    supabase.from('whatsapp_messages').select('status, sent_at', { count: 'exact' }).eq('user_id', userId),
    supabase.from('chatbot_conversations').select('id, created_at', { count: 'exact' }).eq('user_id', userId),
    supabase.from('whatsapp_messages').select('id', { count: 'exact' }).eq('user_id', userId).gte('created_at', todayStr),
    supabase.from('chatbot_conversations').select('id, direction').eq('user_id', userId).gte('created_at', weekAgo.toISOString()),
  ]);

  const totalSent = msgRes.data?.length || 0;
  const totalFailed = msgRes.data?.filter(m => m.status === 'failed').length || 0;
  const totalConversations = convRes.count || 0;
  const todaySent = todayMsgRes.count || 0;
  const weekIncoming = weekMsgRes.data?.filter(m => m.direction === 'incoming').length || 0;
  const weekOutgoing = weekMsgRes.data?.filter(m => m.direction === 'outgoing').length || 0;

  return NextResponse.json({
    success: true,
    stats: {
      totalSent,
      totalFailed,
      successRate: totalSent > 0 ? Math.round((totalSent - totalFailed) / totalSent * 100) : 100,
      totalConversations,
      todaySent,
      weekIncoming,
      weekOutgoing,
    }
  });
}
