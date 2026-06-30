import { NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/server-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = createAdminSupabaseClient();
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const [
      jobsToday,
      jobsWeek,
      jobsMonth,
      usersRes,
      payments,
      chatbotMsgs,
    ] = await Promise.all([
      supabase.from('extraction_jobs').select('id, status, leads_count, search_time_seconds, keyword, location, created_at')
        .gte('created_at', today),
      supabase.from('extraction_jobs').select('id, status, leads_count, keyword, location, created_at')
        .gte('created_at', weekAgo),
      supabase.from('extraction_jobs').select('id, status, leads_count, created_at')
        .gte('created_at', monthAgo),
      supabase.from('profiles').select('id, tokens, plan_id'),
      supabase.from('payment_history').select('id, amount, plan_id, created_at')
        .gte('created_at', monthAgo),
      supabase.from('chatbot_conversations').select('id, direction, created_at')
        .gte('created_at', weekAgo),
    ]);

    const todayJobs = jobsToday.data || [];
    const weekJobs = jobsWeek.data || [];
    const monthJobs = jobsMonth.data || [];
    const users = usersRes.data || [];

    // Métricas hoje
    const extractedToday = todayJobs.filter(j => j.status === 'completed').length;
    const failedToday = todayJobs.filter(j => j.status === 'failed').length;
    const leadsToday = todayJobs.reduce((sum, j) => sum + (j.leads_count || 0), 0);
    const avgTime = todayJobs.length > 0
      ? Math.round(todayJobs.reduce((sum, j) => sum + (j.search_time_seconds || 0), 0) / todayJobs.length)
      : 0;

    // Métricas semana
    const extractedWeek = weekJobs.filter(j => j.status === 'completed').length;
    const leadsWeek = weekJobs.reduce((sum, j) => sum + (j.leads_count || 0), 0);

    // Métricas mês
    const extractedMonth = monthJobs.filter(j => j.status === 'completed').length;
    const leadsMonth = monthJobs.reduce((sum, j) => sum + (j.leads_count || 0), 0);

    // Usuários
    const totalUsers = users.length;
    const totalTokens = users.reduce((sum, u) => sum + (u.tokens || 0), 0);
    const paidUsers = users.filter(u => u.plan_id && u.plan_id !== 'free').length;

    // Pagamentos
    const revenue = payments.data?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0;
    const paymentCount = payments.data?.length || 0;

    // Chatbot
    const chatbotIncoming = chatbotMsgs.data?.filter(m => m.direction === 'incoming').length || 0;
    const chatbotOutgoing = chatbotMsgs.data?.filter(m => m.direction === 'outgoing').length || 0;

    // Top nichos (últimos 7 dias)
    const nicheCount: Record<string, number> = {};
    weekJobs.forEach(j => {
      const kw = j.keyword || 'outro';
      nicheCount[kw] = (nicheCount[kw] || 0) + 1;
    });
    const topNichos = Object.entries(nicheCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([niche, count]) => ({ niche, count }));

    // Últimos jobs
    const recentJobs = todayJobs.slice(0, 10).map(j => ({
      id: j.id,
      keyword: j.keyword,
      location: j.location,
      status: j.status,
      leads: j.leads_count || 0,
      time: j.search_time_seconds || 0,
      created: j.created_at,
    }));

    // Health score (0-100)
    const successRate = extractedWeek > 0 ? extractedWeek / (extractedWeek + failedToday) : 1;
    const utilization = totalUsers > 0 ? extractedWeek / (totalUsers * 3) : 0;
    const healthScore = Math.min(100, Math.round(
      successRate * 40 +
      Math.min(1, utilization) * 30 +
      (totalTokens > 0 ? 15 : 0) +
      (revenue > 0 ? 15 : 0)
    ));

    return NextResponse.json({
      success: true,
      timestamp: now.toISOString(),
      health: {
        score: healthScore,
        label: healthScore >= 80 ? 'Saudável' : healthScore >= 50 ? 'Atenção' : 'Crítico',
      },
      today: {
        extractions: extractedToday,
        failed: failedToday,
        leads: leadsToday,
        avgTimeSeconds: avgTime,
      },
      week: {
        extractions: extractedWeek,
        leads: leadsWeek,
      },
      month: {
        extractions: extractedMonth,
        leads: leadsMonth,
        revenue,
        payments: paymentCount,
      },
      users: {
        total: totalUsers,
        paid: paidUsers,
        totalTokens,
      },
      chatbot: {
        incoming: chatbotIncoming,
        outgoing: chatbotOutgoing,
      },
      topNichos,
      recentJobs,
    });
  } catch (err: any) {
    console.error('[ANALYTICS] Error:', err);
    return NextResponse.json({ error: 'Erro ao buscar analytics' }, { status: 500 });
  }
}
