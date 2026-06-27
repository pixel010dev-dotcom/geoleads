import { NextResponse } from 'next/server';
import { createAdminSupabaseClient, getAuthUser } from '@/lib/server-auth';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const auth = await getAuthUser(request);
    if (!auth) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const supabase = createAdminSupabaseClient();

    // Total de pessoas que usaram o link de indicação
    const { count: totalReferred, error: countError } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('referred_by', auth.user.id);

    if (countError) throw countError;

    // Quantas dessas pessoas já fizeram pagamento
    const { data: referredUsers } = await supabase
      .from('profiles')
      .select('id')
      .eq('referred_by', auth.user.id);

    let paidConversions = 0;
    if (referredUsers && referredUsers.length > 0) {
      const referredIds = referredUsers.map(r => r.id);
      const { count: paidCount, error: paidError } = await supabase
        .from('payment_history')
        .select('id', { count: 'exact', head: true })
        .in('user_id', referredIds);

      if (!paidError) paidConversions = paidCount || 0;
    }

    // Total de tokens ganhos via indicação
    const { data: refPayments, error: refPayError } = await supabase
      .from('payment_history')
      .select('tokens_added')
      .eq('user_id', auth.user.id)
      .like('mp_payment_id', 'ref_%');

    if (refPayError) throw refPayError;
    const totalTokensEarned = refPayments?.reduce((sum, p) => sum + (p.tokens_added || 0), 0) || 0;

    const total = totalReferred ?? 0;
    return NextResponse.json({
      success: true,
      stats: {
        totalReferred: total,
        paidConversions,
        conversionRate: total > 0 ? Math.round((paidConversions / total) * 100) : 0,
        totalTokensEarned,
      },
    });
  } catch (err: any) {
    console.error('[REFERRAL STATS] Error:', err);
    return NextResponse.json({ error: 'Erro ao buscar estatísticas' }, { status: 500 });
  }
}
