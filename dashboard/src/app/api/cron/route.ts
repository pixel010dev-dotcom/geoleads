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
  // Tenta criar user via API admin do Supabase (precisa de service_role key)
  try {
    const { data: existingByEmail } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', 'cron@geoleads.app')
      .maybeSingle();
    if (existingByEmail?.id) return existingByEmail.id;

    // Cria user via REST API admin (usa service_role key no header)
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    if (serviceKey && supabaseUrl) {
      const res = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
        method: 'POST',
        headers: {
          'apikey': serviceKey,
          'Authorization': `Bearer ${serviceKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: 'cron@geoleads.app',
          password: 'cron-geoleads-2026',
          email_confirm: true,
          user_metadata: { full_name: 'Cron Bot', role: 'admin' },
        }),
      });
      if (res.ok) {
        const newUser = await res.json();
        if (newUser?.id) {
          // Cria profile
          await supabase.from('profiles').upsert({
            id: newUser.id,
            email: 'cron@geoleads.app',
            full_name: 'Cron Bot',
            role: 'admin',
            credits: 99999,
          }, { onConflict: 'id' }).maybeSingle();
          return newUser.id;
        }
      }
    }
  } catch (e) {
    console.error('[CRON] Erro ao criar user:', e);
  }

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
