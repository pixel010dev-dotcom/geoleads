import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/server-auth';

export const runtime = 'nodejs';

/**
 * CRON endpoint — roda extrações automáticas de leads
 * Chamado por cron-job.org, cronhub.io ou similar a cada 30min
 * 
 * Autenticação (qualquer uma):
 *   - Header: x-cron-secret
 *   - Query: ?secret=
 *   - Local dev: ?secret=gl-dev-2026 ou header x-cron-secret: gl-dev-2026
 */

const PIPELINE_CONFIG = [
  { niche: 'dentista', cities: ['São Paulo', 'Curitiba', 'Rio de Janeiro'], limit: 20 },
  { niche: 'academia', cities: ['São Paulo', 'Curitiba'], limit: 15 },
  { niche: 'restaurante', cities: ['São Paulo'], limit: 15 },
  { niche: 'advogado', cities: ['Curitiba', 'São Paulo'], limit: 15 },
  { niche: 'petshop', cities: ['Curitiba'], limit: 10 },
];

const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000000';

// Garante que o user do cron existe no banco
async function ensureCronUser(supabase: any): Promise<string> {
  // Tenta criar o user no auth (admin client = service_role)
  const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
    email: 'cron@geoleads.app',
    password: 'cron-auto-' + Date.now(),
    email_confirm: true,
    user_metadata: { full_name: 'Cron Bot', role: 'admin' },
  });

  // Se criou ou já existe, usa o ID
  if (authUser?.user?.id) {
    // Garante que o profile existe
    await supabase.from('profiles').upsert({
      id: authUser.user.id,
      email: 'cron@geoleads.app',
      full_name: 'Cron Bot',
      role: 'admin',
      credits: 99999,
    }, { onConflict: 'id' }).maybeSingle();
    return authUser.user.id;
  }

  // Fallback: tenta buscar user existente pelo email
  const { data: existing } = await supabase.from('profiles')
    .select('id').eq('email', 'cron@geoleads.app').maybeSingle();
  if (existing?.id) return existing.id;

  // Último fallback: usa o SYSTEM_USER_ID mesmo (pode dar FK error)
  console.error('[CRON] Não conseguiu criar/auth user:', authError);
  return SYSTEM_USER_ID;
}

export async function GET(request: NextRequest) {
  const cronSecret = request.headers.get('x-cron-secret');
  const querySecret = request.nextUrl.searchParams.get('secret') || '';
  const expectedSecret = process.env.CRON_SECRET;
  const localDevSecret = process.env.LOCAL_CRON_SECRET || 'gl-dev-2026';

  if (!(
    (cronSecret && expectedSecret && cronSecret === expectedSecret) ||
    (querySecret && expectedSecret && querySecret === expectedSecret) ||
    (localDevSecret && (cronSecret === localDevSecret || querySecret === localDevSecret))
  )) {
    return NextResponse.json({ error: 'cron-secret inválido' }, { status: 401 });
  }

  const supabase = createAdminSupabaseClient();
  
  // Garante que o user do cron existe no banco
  const cronUserId = await ensureCronUser(supabase);
  
  const results: any[] = [];
  let totalCreated = 0;

  for (const cfg of PIPELINE_CONFIG) {
    for (const city of cfg.cities) {
      try {
        const { error } = await supabase.from('extraction_jobs').insert({
          user_id: cronUserId,
          status: 'pending',
          keyword: cfg.niche,
          location: city,
          filter_rule: '',
          leads_count: cfg.limit,
          scanned: 0,
          cities_scanned: 0,
          search_time_seconds: 0,
          started_at: new Date().toISOString(),
        });
        if (!error) {
          totalCreated++;
          results.push({ niche: cfg.niche, city, status: 'created' });
        } else {
          results.push({ niche: cfg.niche, city, status: 'error', error: error.message });
        }
      } catch (e: any) {
        results.push({ niche: cfg.niche, city, status: 'exception', error: e?.message });
      }
    }
  }

  // Tenta processar jobs pendentes chamando a API interna
  const appUrl = process.env.APP_URL || '';
  let processed = 0;
  if (appUrl) {
    try {
      const secret = expectedSecret || localDevSecret;
      const pending = await supabase
        .from('extraction_jobs')
        .select('id, keyword, location, leads_count')
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
        .limit(3);

      if (pending.data) {
        for (const job of pending.data) {
          try {
            const headers: Record<string, string> = {
                'Content-Type': 'application/json',
                'x-cron-secret': secret!,
              };
            await fetch(`${appUrl}/api/extract`, {
              method: 'POST',
              headers,
              body: JSON.stringify({
                keyword: job.keyword,
                location: job.location,
                limit: job.leads_count || 20,
              }),
            });
            processed++;
          } catch {}
        }
      }
    } catch {}
  }

  return NextResponse.json({
    success: true,
    jobs_created: totalCreated,
    jobs_processed: processed,
    details: results,
  });
}

export async function POST(request: NextRequest) {
  return GET(request);
}
