import type { SearchLead } from './lib/types';
import { scoreLeadQuality } from './lib/types';
import { extractFromGoogleSearch } from './strategies/google-search-via-cf';
import { extractFromOpenStreetMap } from './strategies/alternative-sources';
import { extractFromDuckDuckGo } from './strategies/duckduckgo';
import { extractFromBingMaps } from './strategies/bing-maps';
import { getPlaywrightProxyConfig } from './lib/proxy';

export interface RunnerResult {
  leads: SearchLead[];
  scanned: number;
  citiesDone: number;
  totalTimeMs: number;
  error?: string;
}

export interface RunnerConfig {
  keyword: string;
  location: string;
  targetLimit: number;
  filterRule: string;
  isBroadRegion: boolean;
  existingLeadKeys: string[];
  onProgress?: (leads: SearchLead[], scanned: number, citiesDone: number, message: string) => void;
  onDone?: (result: RunnerResult) => void;
  shouldCancel?: () => Promise<boolean>;
  maxTimeMs?: number;
}

function postFilter(lead: SearchLead, filterRule: string): boolean {
  if (!filterRule || filterRule === 'none') return true;
  const score = scoreLeadQuality(lead);
  if (score.score >= 25) return true;

  const rules = filterRule.split(',').map(r => r.trim()).filter(Boolean);
  return rules.every(rule => {
    if (rule === 'phone') return lead.telefone && lead.telefone !== 'Não informado';
    if (rule === 'site') return lead.site && lead.site !== 'Sem site';
    if (rule === 'email') return !!lead.email;
    if (rule === 'insta') return !!lead.instagram;
    if (rule === 'face') return !!lead.facebook;
    if (rule === 'tiktok') return !!lead.tiktok;
    if (rule === 'cnpj') return !!lead.cnpj;
    return true;
  });
}

function mergeLeadsData(existing: SearchLead, incoming: SearchLead): SearchLead {
  return {
    nome: existing.nome,
    telefone: existing.telefone !== 'Não informado' ? existing.telefone : incoming.telefone,
    site: existing.site !== 'Sem site' ? existing.site : incoming.site,
    endereco: existing.endereco || incoming.endereco,
    avaliacao: existing.avaliacao !== 'N/A' ? existing.avaliacao : incoming.avaliacao,
    reviewCount: existing.reviewCount || incoming.reviewCount,
    categoria: existing.categoria || incoming.categoria,
    horarios: existing.horarios || incoming.horarios,
    cep: existing.cep || incoming.cep,
    placeUrl: existing.placeUrl || incoming.placeUrl,
    email: existing.email || incoming.email,
    instagram: existing.instagram || incoming.instagram,
    facebook: existing.facebook || incoming.facebook,
    tiktok: existing.tiktok || incoming.tiktok,
    cnpj: existing.cnpj || incoming.cnpj,
  };
}

export async function runExtraction(config: RunnerConfig): Promise<SearchLead[]> {
  const {
    keyword, location, targetLimit, filterRule, isBroadRegion,
    existingLeadKeys, onProgress, onDone, shouldCancel,
  } = config;

  const startTime = Date.now();
  // Timeout adaptativo baseado na quantidade de leads solicitados
  const dynamicTimeout = Math.max(
    30000,
    Math.min(targetLimit * 1500, 120000) // 1.5s por lead, max 2min
  );
  const GLOBAL_TIMEOUT = Math.max(config.maxTimeMs || dynamicTimeout, 45000);
  const hardDeadline = startTime + GLOBAL_TIMEOUT;
  let finalized = false;
  const globalAbort = new AbortController();
  const leadsByName = new Map<string, SearchLead>();
  const scrapedNames = new Set<string>(existingLeadKeys.map(k => k.split('|')[0]).filter(Boolean));
  const scrapedPhones = new Set<string>(existingLeadKeys.map(k => k.split('|')[1]).filter(Boolean));
  let scannedTotal = 0;
  let citiesDone = 0;

  const elapsed = () => Math.round((Date.now() - startTime) / 1000);
  const cancelled = async () => shouldCancel ? await shouldCancel() : false;

  function addLead(lead: SearchLead): void {
    const key = lead.nome.toLowerCase();
    if (scrapedNames.has(key)) return;
    if (lead.telefone !== 'Não informado' && scrapedPhones.has(lead.telefone)) return;
    if (leadsByName.has(key)) {
      leadsByName.set(key, mergeLeadsData(leadsByName.get(key)!, lead));
    } else {
      leadsByName.set(key, lead);
    }
    scrapedNames.add(key);
    if (lead.telefone !== 'Não informado') scrapedPhones.add(lead.telefone);
  }

  function getLeadsArray(): SearchLead[] {
    return Array.from(leadsByName.values());
  }

  function processResults(leads: SearchLead[], source: string): number {
    let added = 0;
    for (const lead of leads) {
      const key = lead.nome.toLowerCase();
      if (scrapedNames.has(key)) {
        if (leadsByName.has(key)) {
          leadsByName.set(key, mergeLeadsData(leadsByName.get(key)!, lead));
          added++;
        }
        continue;
      }
      if (lead.telefone !== 'Não informado' && scrapedPhones.has(lead.telefone)) continue;
      addLead(lead);
      added++;
    }
    scannedTotal += leads.length;
    if (added > 0) console.log(`[EXTRACT] ${source}: +${added} leads (total: ${leadsByName.size})`);
    return added;
  }

  const notify = (message?: string) => {
    if (onProgress) {
      onProgress(
        getLeadsArray(),
        scannedTotal,
        citiesDone,
        message || `${leadsByName.size} leads encontrados`
      );
    }
  };

  const isOverTime = () => Date.now() >= hardDeadline;

  const finalize = (leads: SearchLead[], error?: string) => {
    if (finalized) return leads.slice(0, targetLimit); // already finalized
    finalized = true;

    const validLeads = leads
      .map(l => ({ lead: l, score: scoreLeadQuality(l) }))
      .filter(s => s.score.tier !== 'trash')
      .map(s => s.lead)
      .filter(l => postFilter(l, filterRule))
      .slice(0, targetLimit);

    console.log(`[EXTRACT] Finalizing: ${validLeads.length} valid leads from ${leadsByName.size} unique in ${elapsed()}s`);

    if (onDone) {
      onDone({
        leads: validLeads,
        scanned: scannedTotal,
        citiesDone,
        totalTimeMs: Date.now() - startTime,
        error,
      });
    }
    return validLeads;
  };

  try {
    const cfWorkerUrl = process.env.CF_WORKER_URL || '';
    console.log(`[EXTRACT] Starting: "${keyword}" in "${location}" limit=${targetLimit}`);
    console.log(`[EXTRACT] CF_WORKER_URL: ${cfWorkerUrl ? 'configured (' + cfWorkerUrl + ')' : 'NOT SET - Google Search will be direct'}`);

    notify('Buscando leads em múltiplas fontes...');

    const fetchWithTimeout = (name: string, fn: () => Promise<SearchLead[]>, timeoutMs: number): Promise<SearchLead[]> =>
      new Promise<SearchLead[]>((resolve) => {
        let done = false;
        const timer = setTimeout(() => {
          if (!done) {
            done = true;
            console.log(`[EXTRACT] ${name}: TIMEOUT after ${timeoutMs}ms`);
            resolve([]);
          }
        }, timeoutMs);

        fn().then(leads => {
          if (!done) {
            done = true;
            clearTimeout(timer);
            console.log(`[EXTRACT] ${name}: ${leads.length} leads in ${elapsed()}s`);
            resolve(leads);
          }
        }).catch(() => {
          if (!done) {
            done = true;
            clearTimeout(timer);
            console.log(`[EXTRACT] ${name}: FAILED`);
            resolve([]);
          }
        });
      });

    // =========================================================================
    // PHASE 1: Fetch-based strategies (parallel)
    // =========================================================================
    const existingForFetch = new Set<string>(Array.from(scrapedNames));

    // Calcula timeouts adaptativos baseados no deadline global
    const remaining = () => Math.max(5000, hardDeadline - Date.now() - 2000);
    const googleTimeout = Math.min(15000, remaining());
    const bingTimeout = Math.min(15000, remaining());
    const ddgTimeout = Math.min(15000, remaining());
    const osmTimeout = Math.min(20000, remaining());

    // Passa o AbortSignal para as estratégias permitirem cancelamento real
    const fetchResults = await Promise.all([
      fetchWithTimeout('GoogleSearch', () => extractFromGoogleSearch(keyword, location, targetLimit, existingForFetch, globalAbort.signal).then(r => r.leads), googleTimeout),
      fetchWithTimeout('BingMaps', () => extractFromBingMaps(keyword, location, targetLimit, existingForFetch, globalAbort.signal), bingTimeout),
      fetchWithTimeout('DuckDuckGo', () => extractFromDuckDuckGo(keyword, location, targetLimit, existingForFetch, globalAbort.signal), ddgTimeout),
      fetchWithTimeout('OSM', () => extractFromOpenStreetMap(keyword, location, targetLimit, existingForFetch, globalAbort.signal), osmTimeout),
    ]);

    // Aborta qualquer estratégia que ainda esteja rodando em background
    globalAbort.abort();

    if (elapsed() > 55) {
      console.log(`[EXTRACT] WARNING: Phase 1 took ${elapsed()}s, returning what we have`);
    }

    for (const leads of fetchResults) {
      const added = processResults(leads, 'fetch');
      if (added > 0) citiesDone++;
    }

    console.log(`[EXTRACT] Phase 1 done: ${leadsByName.size} leads in ${elapsed()}s`);

    // =========================================================================
    // PHASE 2: Playwright as fallback (only if needed and time permits)
    // Usa AbortController proprio para evitar conflito com o sinal do Phase 1
    // =========================================================================
    const remainingTime = hardDeadline - Date.now();
    if (leadsByName.size < targetLimit && remainingTime > 10000 && !isOverTime()) {
      console.log(`[EXTRACT] Phase 1 found ${leadsByName.size}/${targetLimit} leads, trying Playwright Maps...`);
      notify('Buscando mais leads via Maps...');

      const PW_TIMEOUT = Math.min(60000, Math.max(15000, remainingTime - 5000)); // Pelo menos 15s, max 60s

      // AbortController DEDICADO para o Playwright (sem conflito com globalAbort)
      const pwAbort = new AbortController();
      const pwTimeoutId = setTimeout(() => {
        pwAbort.abort();
        console.log(`[EXTRACT] Playwright: TIMEOUT after ${PW_TIMEOUT}ms, aborting...`);
      }, PW_TIMEOUT);

      try {
        const pw = await import('playwright');
        // Timeout HARD no launch do browser (nao pode travar a extracao)
        const browser = await Promise.race([
          pw.chromium.launch({
            headless: true,
            proxy: getPlaywrightProxyConfig(),
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
          }),
          new Promise<any>((_, reject) =>
            setTimeout(() => reject(new Error('Browser launch timeout after 30s')), 30000)
          ),
        ]);

        try {
          const { extractFromPlaywrightMaps } = await import('./strategies/maps-scraper');
          const pwResult = await extractFromPlaywrightMaps(
            browser, keyword, location,
            targetLimit - leadsByName.size,
            new Set(Array.from(scrapedNames)),
            25,
            pwAbort.signal, // Usa sinal DEDICADO (nao o globalAbort ja abortado)
          );

          if (pwResult.blocked) {
            console.log(`[EXTRACT] Playwright: blocked by Google`);
          } else {
            const pwAdded = processResults(pwResult.leads, 'playwright');
            console.log(`[EXTRACT] Playwright: ${pwAdded} new leads (${pwResult.leads.length} total) in ${elapsed()}s`);
          }
        } finally {
          await browser.close().catch(() => {});
        }
      } catch (e: any) {
        console.log(`[EXTRACT] Playwright failed: ${e?.message || e}`);
      } finally {
        clearTimeout(pwTimeoutId);
      }
    }

    if (isOverTime()) {
      console.warn(`[EXTRACT] GLOBAL_TIMEOUT reached (${GLOBAL_TIMEOUT}ms). Forcing finalization with ${leadsByName.size} leads.`);
      notify(`${leadsByName.size} leads (timeout ${Math.round(GLOBAL_TIMEOUT/1000)}s)`);
      return finalize(getLeadsArray(), `Tempo limite de ${Math.round(GLOBAL_TIMEOUT/1000)}s atingido. Resultados parciais.`);
    }

    notify(`${leadsByName.size} leads encontrados (${elapsed()}s)`);

    return finalize(getLeadsArray());

  } catch (err: any) {
    console.error('[EXTRACT] Fatal error:', err);
    if (finalized) return getLeadsArray().slice(0, targetLimit);
    return finalize(getLeadsArray(), `Erro na extração: ${err?.message || 'Erro inesperado'}`);
  }
}
