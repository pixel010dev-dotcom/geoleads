// GET /api/v1/extract — API pública para extração via API Key
import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/server-auth';
import { extractFromGooglePlaces } from '@/app/api/extract/strategies/google-places';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const RATE_LIMIT_WINDOW = 60000; // 1 minuto
const rateLimits = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(key: string, maxReq: number): boolean {
  const now = Date.now();
  const entry = rateLimits.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimits.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return true;
  }
  if (entry.count >= maxReq) return false;
  entry.count++;
  return true;
}

export async function GET(request: NextRequest) {
  const apiKey = request.headers.get('x-api-key');
  if (!apiKey) {
    return NextResponse.json({ error: 'API key é obrigatória (header x-api-key).' }, { status: 401 });
  }

  const keyword = request.nextUrl.searchParams.get('keyword');
  const location = request.nextUrl.searchParams.get('location');
  const limit = Math.min(50, parseInt(request.nextUrl.searchParams.get('limit') || '10', 10));

  if (!keyword || !location) {
    return NextResponse.json({ error: 'keyword e location são obrigatórios.' }, { status: 400 });
  }

  try {
    const supabase = createAdminSupabaseClient();

    // Verifica API key
    const { data: keyData, error: keyError } = await supabase
      .from('api_keys')
      .select('id, user_id, revoked')
      .eq('key', apiKey)
      .single();

    if (keyError || !keyData) {
      return NextResponse.json({ error: 'API key inválida.' }, { status: 401 });
    }

    if (keyData.revoked) {
      return NextResponse.json({ error: 'API key revogada.' }, { status: 401 });
    }

    // Rate limit
    if (!checkRateLimit(apiKey, 30)) {
      return NextResponse.json({ error: 'Muitas requisições. Limite: 30/min.' }, { status: 429 });
    }

    // Atualiza last_used_at
    try { await supabase.from('api_keys').update({ last_used_at: new Date().toISOString() }).eq('id', keyData.id); } catch {}

    // Verifica tokens do usuário
    const { data: profile } = await supabase
      .from('profiles')
      .select('tokens')
      .eq('id', keyData.user_id)
      .single();

    const availableTokens = profile?.tokens || 0;
    const toSpend = Math.min(limit, availableTokens);

    if (toSpend <= 0) {
      return NextResponse.json({ error: 'Saldo de tokens insuficiente.' }, { status: 402 });
    }

    // Extrai
    const places = await extractFromGooglePlaces(keyword, location, toSpend);

    if (places.length === 0) {
      return NextResponse.json({ leads: [], message: 'Nenhum resultado encontrado.' }, { status: 200 });
    }

    // Deduz tokens
    try { await supabase.rpc('deduct_tokens', {
      p_user_id: keyData.user_id,
      p_amount: places.length,
    }); } catch {}

    return NextResponse.json({
      success: true,
      leads: places.map(p => ({
        nome: p.nome,
        telefone: p.telefone,
        endereco: p.endereco,
        site: p.site,
        avaliacao: p.avaliacao,
        categoria: p.categoria,
        placeUrl: p.placeUrl,
        isMobile: p.isMobile,
      })),
      total: places.length,
      tokens_used: places.length,
    });

  } catch (e: any) {
    console.error('[API V1] Error:', e);
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
  }
}
