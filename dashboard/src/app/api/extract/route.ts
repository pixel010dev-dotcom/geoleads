import { NextResponse } from 'next/server';
import { createRequestSupabaseClient, getAuthUser, requireFeature, createAdminSupabaseClient } from '@/lib/server-auth';
import { type FeatureKey } from '@/lib/plans';
import { runExtraction } from './runner';
import { smartNormalizeQuery, isBroadLocation } from './lib/normalizers';
import { checkExtractionRateLimit } from '@/lib/rate-limit';
import type { SearchLead } from './lib/types';

export const runtime = 'nodejs';

const activeExtractions = new Map<string, number>();
const MAX_CONCURRENT_PER_USER = 2;
const MAX_GLOBAL_CONCURRENT = 10;
const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000000';
const SYSTEM_PLAN_ID = 'enterprise' as any;

function parseFilterRules(filterRule: string): string[] {
  if (!filterRule || filterRule === 'none') return [];
  return filterRule.split(',').map(r => r.trim()).filter(Boolean);
}

function getGlobalConcurrent(): number {
  let total = 0;
  for (const count of activeExtractions.values()) total += count;
  return total;
}

async function updateJob(jobId: string, updates: Record<string, any>): Promise<void> {
  const supabase = createAdminSupabaseClient();
  try {
    const { error } = await Promise.race([
      supabase.from('extraction_jobs').update(updates).eq('id', jobId),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('updateJob timeout')), 15000)),
    ]);
    if (error) throw error;
  } catch (e: any) {
    console.error(`[EXTRACT] updateJob FAILED:`, e?.message || e);
  }
}

export async function POST(request: Request) {
  let auth: Awaited<ReturnType<typeof getAuthUser>> | null = null;
  let extractionDone = false;
  let isCronJob = false;

  // ── Cron bypass: x-cron-secret permite execução sem usuário logado ──
  const cronSecret = request.headers.get('x-cron-secret');
  const expectedCronSecret = process.env.CRON_SECRET;
  if (cronSecret && expectedCronSecret && cronSecret === expectedCronSecret) {
    isCronJob = true;
  }

  function done() {
    if (!extractionDone) {
      extractionDone = true;
      if (auth) {
        const c = activeExtractions.get(auth.user.id) || 1;
        if (c <= 1) activeExtractions.delete(auth.user.id);
        else activeExtractions.set(auth.user.id, c - 1);
      }
    }
  }

  try {
    if (!isCronJob) {
      auth = await getAuthUser(request);
      if (!auth) {
        return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
      }
    }

    // ── Define o perfil do usuário (real ou sistema) ──
    const authedUser = isCronJob
      ? { user: { id: SYSTEM_USER_ID, email: 'system@geoleads.app' }, tokens: 999999, planId: SYSTEM_PLAN_ID }
      : auth!;

    // Rate limit — pula para cron jobs
    if (!isCronJob) {
      const rateLimit = checkExtractionRateLimit(authedUser.user.id);
      if (!rateLimit.allowed) {
        return NextResponse.json({ error: 'Muitas extrações. Aguarde 1 minuto.' }, { status: 429 });
      }
    }

    const { keyword: rawKeyword, location: rawLocation, limit, filterRule, existingLeadKeys } = await request.json();
    const requestSupabase = createRequestSupabaseClient(request);

    if (!rawKeyword || !rawLocation) {
      return NextResponse.json({ error: 'Preencha o termo e a cidade.' }, { status: 400 });
    }

    // Feature checks — pula para cron jobs
    if (!isCronJob && filterRule && filterRule !== 'none') {
      const featureMap: Record<string, FeatureKey> = {
        email: 'emailEnrichment',
        cnpj: 'cnpjEnrichment',
        insta: 'socialEnrichment',
        face: 'socialEnrichment',
        tiktok: 'socialEnrichment'
      };
      const rules = parseFilterRules(filterRule);
      for (const rule of rules) {
        const requiredFeature = featureMap[rule];
        if (requiredFeature && !requireFeature(authedUser.planId, requiredFeature)) {
          return NextResponse.json({
            error: `Filtro "${rule}" exige plano superior.`
          }, { status: 403 });
        }
      }
    }

    // Tokens — pula para cron jobs
    if (!isCronJob && authedUser.tokens <= 0) {
      return NextResponse.json({ error: 'Sem tokens disponíveis.' }, { status: 402 });
    }

    const { correctedKeyword, correctedLocation } = smartNormalizeQuery(rawKeyword, rawLocation);
    const keyword = correctedKeyword;
    const location = correctedLocation;
    const isBroadRegion = isBroadLocation(rawLocation) || isBroadLocation(correctedLocation);
    const requestedLimit = Math.max(1, Number(limit) || 10);
    const targetLimit = isCronJob ? Math.min(requestedLimit, 100) : Math.min(requestedLimit, authedUser.tokens);
    if (targetLimit === 0) {
      return NextResponse.json({ error: 'Saldo insuficiente.' }, { status: 402 });
    }

    // Concorrência — pula para cron jobs
    if (!isCronJob) {
      const current = activeExtractions.get(authedUser.user.id) || 0;
      if (current >= MAX_CONCURRENT_PER_USER) {
        return NextResponse.json({
          error: `Você já tem ${current} extrações em andamento.`
        }, { status: 429 });
      }
      if (getGlobalConcurrent() >= MAX_GLOBAL_CONCURRENT) {
        return NextResponse.json({ error: 'Sistema sobrecarregado.' }, { status: 503 });
      }
    }
    activeExtractions.set(authedUser.user.id, (activeExtractions.get(authedUser.user.id) || 0) + 1);

    // Cria job no banco
    const adminSupabase = createAdminSupabaseClient();
    const { data: jobData, error: jobError } = await adminSupabase.from('extraction_jobs').insert({
      user_id: authedUser.user.id,
      status: 'running',
      keyword, location,
      filter_rule: filterRule || '',
      leads_count: 0, scanned: 0, cities_scanned: 0,
      search_time_seconds: 0,
      started_at: new Date().toISOString(),
    }).select('id').single();

    if (jobError || !jobData) {
      done();
      return NextResponse.json({ error: 'Falha ao iniciar extração.' }, { status: 500 });
    }

    const jobId = jobData.id;
    const extractionStartTime = Date.now();

    // ==========================================
    // EXTRAÇÃO
    // ==========================================
    runExtraction({
      keyword, location, targetLimit,
      filterRule: filterRule || '',
      isBroadRegion,
      existingLeadKeys: existingLeadKeys || [],
      onProgress: (leads, scanned, citiesDone, message) => {
        updateJob(jobId, {
          leads: leads.slice(0, targetLimit),
          leads_count: leads.length,
          scanned, cities_scanned: citiesDone,
          message,
          search_time_seconds: Math.round((Date.now() - extractionStartTime) / 1000),
        }).catch(() => {});
      },
      onDone: async (result) => {
        const gastos = result.leads.length;
        const totalTimeSec = Math.round(result.totalTimeMs / 1000);

        // Deduz tokens (apenas para usuários reais)
        let deductFailed = false;
        if (!isCronJob && gastos > 0) {
          try {
            const { error: deductError } = await adminSupabase.rpc('deduct_tokens', {
              p_user_id: authedUser.user.id, p_amount: gastos
            });
            if (deductError) { console.error('[EXTRACT] deduct_tokens failed:', deductError); deductFailed = true; }
          } catch { deductFailed = true; }
        }

        // Salva histórico (apenas para usuários reais)
        if (!isCronJob) {
          try {
            await adminSupabase.from('extraction_history').insert({
              user_id: authedUser.user.id, keyword, location,
              filter_rule: filterRule || '',
              leads_found: result.leads.length,
              leads_requested: targetLimit,
              tokens_spent: gastos,
              search_time_seconds: totalTimeSec,
            });
          } catch { /* non-critical */ }
        }

        // Atualiza job
        const jobUpdate = {
          status: deductFailed ? 'payment_failed' : (result.error ? 'failed' : 'completed'),
          error: deductFailed ? 'Falha ao debitar tokens.' : (result.error || undefined),
          leads: result.leads,
          leads_count: result.leads.length,
          scanned: result.scanned,
          cities_scanned: result.citiesDone,
          message: `Extração concluída: ${result.leads.length} leads em ${totalTimeSec}s`,
          search_time_seconds: totalTimeSec,
          completed_at: new Date().toISOString(),
          delivered: !deductFailed,
        };

        try {
          await updateJob(jobId, jobUpdate);
          // Notifica Telegram
          try {
            const tgToken = process.env.TELEGRAM_BOT_TOKEN;
            const tgAdminId = process.env.TELEGRAM_ADMIN_ID;
            if (tgToken && tgAdminId && result.leads.length > 0) {
              fetch(`https://api.telegram.org/bot${tgToken}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  chat_id: tgAdminId,
                  text: `🎯 <b>${result.leads.length} leads</b> | ${keyword} em ${location}\n📱 Tel: ${result.leads.filter(l => l.telefone && l.telefone !== 'Não informado').length} | ⏱️ ${totalTimeSec}s`,
                  parse_mode: 'HTML'
                }),
              }).catch(() => {});
            }
          } catch {}
        } catch (e: any) {
          console.error(`[EXTRACT] Final update failed:`, e?.message || e);
        } finally {
          done();
        }
      },
      shouldCancel: async () => {
        try {
          const supabase = createAdminSupabaseClient();
          const { data, error } = await supabase.from('extraction_jobs').select('status').eq('id', jobId).maybeSingle();
          if (error || !data) return false;
          return data.status === 'cancelled';
        } catch { return false; }
      },
    }).catch((err) => {
      console.error('[EXTRACT] Background extraction failed:', err);
      updateJob(jobId, {
        status: 'failed',
        error: err?.message || 'Erro inesperado',
        completed_at: new Date().toISOString(),
        delivered: false,
      });
      done();
    });

    return NextResponse.json({ success: true, jobId, message: 'Extração iniciada.' });

  } catch (error: any) {
    done();
    return NextResponse.json({ error: 'Erro ao iniciar extração.' }, { status: 500 });
  }
}
