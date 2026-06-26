import { NextResponse } from 'next/server';
import { createRequestSupabaseClient, getAuthUser, requireFeature, createAdminSupabaseClient } from '@/lib/server-auth';
import { type FeatureKey } from '@/lib/plans';
import { runExtraction } from './runner';
import { smartNormalizeQuery, isBroadLocation } from './lib/normalizers';
import { checkExtractionRateLimit } from '@/lib/rate-limit';
import { enrichLead } from './enrichment/website';
import type { SearchLead } from './lib/types';

export const runtime = 'nodejs';

const activeExtractions = new Map<string, number>();
const MAX_CONCURRENT_PER_USER = 2;
const MAX_GLOBAL_CONCURRENT = 10;

function parseFilterRules(filterRule: string): string[] {
  if (!filterRule || filterRule === 'none') return [];
  return filterRule.split(',').map(r => r.trim()).filter(Boolean);
}

function getConcurrentCount(userId: string): number {
  return activeExtractions.get(userId) || 0;
}

function getGlobalConcurrent(): number {
  let total = 0;
  for (const count of activeExtractions.values()) total += count;
  return total;
}

async function updateJob(jobId: string, updates: Record<string, any>): Promise<void> {
  const supabase = createAdminSupabaseClient();
  console.log(`[EXTRACT] updateJob: setting status=${updates.status} delivered=${updates.delivered} for job ${jobId}`);
  try {
    const { error } = await Promise.race([
      supabase.from('extraction_jobs').update(updates).eq('id', jobId),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('updateJob timeout after 30s')), 30000)),
    ]);
    if (error) throw error;
    console.log(`[EXTRACT] updateJob: SUCCESS for job ${jobId}`);
  } catch (e: any) {
    console.error(`[EXTRACT] updateJob: FAILED for job ${jobId}:`, e.message || e);
    throw e; // Propagar erro para que as retentativas funcionem
  }
}

export async function POST(request: Request) {
  let auth: Awaited<ReturnType<typeof getAuthUser>>;
  let extractionDone = false;

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
    auth = await getAuthUser(request);
    if (!auth) {
      return NextResponse.json({ error: 'Não autenticado. Faça login para extrair leads.' }, { status: 401 });
    }
    const authedUser = auth;

    const rateLimit = checkExtractionRateLimit(auth.user.id);
    if (!rateLimit.allowed) {
      return NextResponse.json({ error: 'Muitas extrações. Aguarde 1 minuto.' }, { status: 429 });
    }

    const { keyword: rawKeyword, location: rawLocation, limit, filterRule, existingLeadKeys } = await request.json();
    const requestSupabase = createRequestSupabaseClient(request);

    if (!rawKeyword || !rawLocation) {
      return NextResponse.json({ error: 'Preencha o termo e a cidade.' }, { status: 400 });
    }

    if (filterRule && filterRule !== 'none') {
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
        if (requiredFeature && !requireFeature(auth.planId, requiredFeature)) {
          return NextResponse.json({
            error: `Filtro "${rule}" exige plano superior. Faça upgrade para usar.`
          }, { status: 403 });
        }
      }
    }

    if (auth.tokens <= 0) {
      return NextResponse.json({ error: 'Sem tokens disponíveis. Compre mais tokens para continuar extraindo.' }, { status: 402 });
    }

    const { correctedKeyword, correctedLocation } = smartNormalizeQuery(rawKeyword, rawLocation);
    const keyword = correctedKeyword;
    const location = correctedLocation;
    const isBroadRegion = isBroadLocation(rawLocation) || isBroadLocation(correctedLocation);
    const requestedLimit = Math.max(1, Number(limit) || 10);
    // Sem limite maximo alem dos tokens do usuario
    // O motor rapido consegue processar grandes quantidades
    const targetLimit = Math.min(requestedLimit, auth.tokens);
    if (targetLimit === 0) {
      return NextResponse.json({ error: 'Saldo insuficiente. Compre mais tokens.' }, { status: 402 });
    }

    const current = activeExtractions.get(auth.user.id) || 0;
    if (current >= MAX_CONCURRENT_PER_USER) {
      return NextResponse.json({
        error: `Você já tem ${current} extrações em andamento. Aguarde uma finalizar antes de iniciar outra.`
      }, { status: 429 });
    }
    if (getGlobalConcurrent() >= MAX_GLOBAL_CONCURRENT) {
      return NextResponse.json({
        error: 'Sistema sobrecarregado. Tente novamente em alguns segundos.'
      }, { status: 503 });
    }
    activeExtractions.set(auth.user.id, current + 1);

    const { data: jobData, error: jobError } = await requestSupabase.from('extraction_jobs').insert({
      user_id: auth.user.id, status: 'running',
      keyword, location, filter_rule: filterRule || '',
      leads_count: 0, scanned: 0, cities_scanned: 0, search_time_seconds: 0,
      started_at: new Date().toISOString(),
    }).select('id').single();

    if (jobError || !jobData) {
      done();
      console.error('Falha ao criar job:', jobError);
      return NextResponse.json({ error: 'Falha ao iniciar extração. Tente novamente.' }, { status: 500 });
    }

    const jobId = jobData.id;
    const extractionStartTime = Date.now();

    runExtraction({
      keyword, location, targetLimit,
      filterRule: filterRule || '',
      isBroadRegion,
      existingLeadKeys: existingLeadKeys || [],
      onProgress: (leads, scanned, citiesDone, message) => {
        updateJob(jobId, {
          leads: leads.slice(0, targetLimit),
          leads_count: leads.length,
          scanned,
          cities_scanned: citiesDone,
          message,
          search_time_seconds: Math.round((Date.now() - extractionStartTime) / 1000),
        }).catch((e: any) => {
          console.warn('[EXTRACT] onProgress update failed (non-critical):', e.message || e);
        });
      },
      onDone: async (result) => {
        const gastos = result.leads.length;
        const totalTimeSec = Math.round(result.totalTimeMs / 1000);

        const jobUpdate = {
          status: result.error ? 'failed' : 'completed',
          error: result.error || undefined,
          leads: result.leads,
          leads_count: result.leads.length,
          scanned: result.scanned,
          cities_scanned: result.citiesDone,
          message: result.error || `Extração concluída: ${result.leads.length} leads em ${totalTimeSec}s`,
          search_time_seconds: totalTimeSec,
          completed_at: new Date().toISOString(),
          delivered: true,
        };

        const doFinalUpdate = async (retries = 3) => {
          try {
            await updateJob(jobId, jobUpdate);
          } catch (e: any) {
            console.error(`[EXTRACT] Final update failed for job ${jobId}, retries=${retries}:`, e.message || e);
            if (retries > 0) {
              await new Promise(r => setTimeout(r, 2000));
              return doFinalUpdate(retries - 1);
            }
            // Último recurso: tenta update sem leads pra pelo menos marcar como concluído
            console.error(`[EXTRACT] All retries exhausted for job ${jobId}, trying minimal update...`);
            try {
              await updateJob(jobId, {
                status: result.error ? 'failed' : 'completed',
                delivered: true,
                completed_at: new Date().toISOString(),
                error: result.error || `Leads salvos parcialmente. Tente atualizar a página.`,
              });
            } catch (e2: any) {
              console.error(`[EXTRACT] Even minimal update FAILED for job ${jobId}:`, e2.message || e2);
            }
          }
        };

        // Deduz tokens ANTES de marcar como entregue
        if (gastos > 0) {
          try {
            const { error: deductError } = await requestSupabase.rpc('deduct_tokens', {
              p_user_id: authedUser.user.id, p_amount: gastos
            });
            if (deductError) {
              await requestSupabase.from('profiles')
                .update({ tokens: Math.max(0, authedUser.tokens - gastos) })
                .eq('id', authedUser.user.id)
                .gte('tokens', gastos);
            }
          } catch (e: any) {
            console.error('[EXTRACT] token deduct failed:', e);
          }
        }

        // Salva histórico (via admin pra evitar RLS)
        try {
          const adminSupabase = createAdminSupabaseClient();
          await adminSupabase.from('extraction_history').insert({
            user_id: authedUser.user.id, keyword, location,
            filter_rule: filterRule || '',
            leads_found: result.leads.length,
            leads_requested: targetLimit,
            tokens_spent: gastos,
            search_time_seconds: totalTimeSec,
          });
        } catch (e: any) { console.error('[EXTRACT] history insert failed:', e); }

        // Agora marca como entregue (com tokens já deduzidos)
        try {
          await doFinalUpdate(3);
        } catch (e: any) {
          console.error(`[EXTRACT] onDone: all updates failed for job ${jobId}:`, e?.message || e);
        } finally {
          done();
        }

        // Enriquecimento em background (nao bloqueante)
        // Para cada lead com site, tenta extrair email + redes sociais
        // Para leads sem CNPJ, tenta BrasilAPI
        if (result.leads.length > 0) {
          (async () => {
            const enrichedLeads: SearchLead[] = [];
            for (const lead of result.leads) {
              try {
                // Enriquecimento via website (email, social) - somente se tiver site
                if (lead.site && lead.site !== 'Sem site' && (!lead.email || !lead.instagram || !lead.facebook)) {
                  const enriched = await enrichLead({ ...lead });
                  if (enriched.email) lead.email = enriched.email;
                  if (enriched.instagram) lead.instagram = enriched.instagram;
                  if (enriched.facebook) lead.facebook = enriched.facebook;
                  if (enriched.tiktok) lead.tiktok = enriched.tiktok;
                  console.log(`[ENRICH] Website: "${lead.nome}" email=${!!lead.email} insta=${!!lead.instagram} fb=${!!lead.facebook}`);
                }
                enrichedLeads.push(lead);
              } catch (e: any) {
                console.warn(`[ENRICH] Failed for "${lead.nome}":`, e?.message || e);
              }
            }

            // Salva leads enriquecidos no job
            if (enrichedLeads.length > 0) {
              try {
                await updateJob(jobId, {
                  leads: enrichedLeads,
                  leads_count: enrichedLeads.length,
                  message: `${enrichedLeads.length} leads com enriquecimento`,
                });
                console.log(`[ENRICH] Saved ${enrichedLeads.length} enriched leads`);
              } catch (e: any) {
                console.warn(`[ENRICH] Failed to save enriched leads:`, e?.message || e);
              }
            }
          })();
        }
      },
      shouldCancel: async () => {
        const supabase = createAdminSupabaseClient();
        const { data } = await supabase.from('extraction_jobs').select('status').eq('id', jobId).single();
        return data?.status === 'cancelled';
      },
    }).catch((err) => {
      console.error('[EXTRACT] Background extraction failed:', err);
      updateJob(jobId, {
        status: 'failed',
        error: err?.message || 'Erro inesperado',
        completed_at: new Date().toISOString(),
        delivered: true,
      });
      done();
    });

    return NextResponse.json({ success: true, jobId, message: 'Extração iniciada em segundo plano.' });

  } catch (error: any) {
    done();
    const msg = error instanceof Error ? error.message : String(error);
    console.error('ERRO AO CRIAR JOB:', msg);
    return NextResponse.json({ error: 'Erro ao iniciar extração. Tente novamente.' }, { status: 500 });
  }
}
