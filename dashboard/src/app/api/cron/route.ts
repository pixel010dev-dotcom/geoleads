import { NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/server-auth';

export const runtime = 'nodejs';

/**
 * CRON endpoint — roda extrações automáticas de leads
 * Chamado por cron-job.org, cronhub.io ou similar a cada 30min
 * 
 * HEADERS obrigatórios:
 *   x-cron-secret: <CRON_SECRET>
 */

const PIPELINE_CONFIG = [
  { niche: 'dentista', cities: ['São Paulo', 'Curitiba', 'Rio de Janeiro'], limit: 20 },
  { niche: 'academia', cities: ['São Paulo', 'Curitiba'], limit: 15 },
  { niche: 'restaurante', cities: ['São Paulo'], limit: 15 },
  { niche: 'advogado', cities: ['Curitiba', 'São Paulo'], limit: 15 },
  { niche: 'petshop', cities: ['Curitiba'], limit: 10 },
];

const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000000';

export async function GET(request: Request) {
  const cronSecret = request.headers.get('x-cron-secret');
  const expectedSecret = process.env.CRON_SECRET;

  if (!cronSecret || !expectedSecret || cronSecret !== expectedSecret) {
    return NextResponse.json({ error: 'cron-secret inválido' }, { status: 401 });
  }

  const supabase = createAdminSupabaseClient();
  const results: any[] = [];
  let totalCreated = 0;

  for (const cfg of PIPELINE_CONFIG) {
    for (const city of cfg.cities) {
      try {
        const { error } = await supabase.from('extraction_jobs').insert({
          user_id: SYSTEM_USER_ID,
          status: 'pending',
          keyword: cfg.niche,
          location: city,
          filter_rule: '',
          leads_count: cfg.limit,
          scanned: 0,
          cities_scanned: 0,
          search_time_seconds: 0,
          started_at: new Date().toISOString(),
          source: 'auto-cron',
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
      const pending = await supabase
        .from('extraction_jobs')
        .select('id, keyword, location, leads_count')
        .eq('status', 'pending')
        .eq('source', 'auto-cron')
        .order('created_at', { ascending: true })
        .limit(3);

      if (pending.data) {
        for (const job of pending.data) {
          try {
            await fetch(`${appUrl}/api/extract`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-cron-secret': expectedSecret,
              },
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

export async function POST(request: Request) {
  return GET(request);
}
