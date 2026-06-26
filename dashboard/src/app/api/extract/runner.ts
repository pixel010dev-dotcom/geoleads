import type { SearchLead } from './lib/types';
import { scoreLeadQuality } from './lib/types';
import { extractFromGoogleSearch } from './strategies/google-search-via-cf';
import { extractFromOpenStreetMap } from './strategies/alternative-sources';
import { extractFromDuckDuckGo } from './strategies/duckduckgo';
import { extractFromBingMaps } from './strategies/bing-maps';
import { extractFromGoogleMapsMobile } from './strategies/google-maps-mobile';
import { getCachedQuery, setCachedQuery, generateQueryCacheKey } from './lib/cache';

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
  // Timeout adaptativo para grandes volumes
  // Com o motor rapido, conseguimos ~3 leads/s, entao: 300ms por lead + base de 30s
  const dynamicTimeout = Math.max(
    30000,
    Math.min(targetLimit * 300 + 15000, 300000) // ~300ms por lead + 15s base, max 5min
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
      // Bug #1: Ignora leads com nome vazio — vão para o Map com key="" e são filtrados como 'trash' no finalize
      if (!lead.nome || lead.nome.trim() === '') {
        continue;
      }
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

    // DEBUG: loga cada lead com score e tier antes de filtrar
    const scoredLeads = leads.map(l => ({ lead: l, score: scoreLeadQuality(l) }));
    for (const s of scoredLeads) {
      console.log(`[SCORE] "${s.lead.nome}" score=${s.score.score} tier=${s.score.tier} phone="${s.lead.telefone}" site="${s.lead.site}"`);
    }

    const validLeads = scoredLeads
      .filter(s => s.score.tier !== 'trash')
      .map(s => s.lead)
      .filter(l => postFilter(l, filterRule))
      .slice(0, targetLimit);

    console.log(`[EXTRACT] Finalizing: ${validLeads.length} valid leads from ${leadsByName.size} unique (${scoredLeads.filter(s => s.score.tier === 'trash').length} trash) in ${elapsed()}s`);

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
    // Verifica cache primeiro
    const cacheKey = generateQueryCacheKey(keyword, location);
    const cachedLeads = getCachedQuery(cacheKey);
    if (cachedLeads && cachedLeads.length >= targetLimit) {
      console.log(`[EXTRACT] Cache HIT: ${cachedLeads.length} leads for "${keyword}" in "${location}"`);
      for (const lead of cachedLeads) {
        if (leadsByName.size >= targetLimit) break;
        processResults([lead], 'cache');
      }
      notify(`${leadsByName.size} leads (cache)`);
      // Finaliza sem precisar rodar as estrategias
      return finalize(getLeadsArray());
    }

    const cfWorkerUrl = process.env.CF_WORKER_URL || '';
    console.log(`[EXTRACT] Starting: "${keyword}" in "${location}" limit=${targetLimit}`);
    console.log(`[EXTRACT] CF_WORKER_URL: ${cfWorkerUrl ? 'configured' : 'NOT SET'}`);

    notify('Buscando leads em múltiplas fontes...');

    // =========================================================================
    // SMART FETCH: estrategias em paralelo com abort inteligente
    // Cada estrategia tem timeout de 8s (exceto OSM que tem 12s)
    // Se uma estrategia ja achou leads suficientes, aborta as outras
    // =========================================================================

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

    const existingForFetch = new Set<string>(Array.from(scrapedNames));
    const existingForMobile = new Set<string>(Array.from(scrapedNames));

    // Timeouts otimizados para VELOCIDADE MAXIMA
    // Google e Bing sao rapidos (6s), DuckDuckGo medio (8s), OSM lento (12s)
    const googleTimeout = 8000;
    const mobileTimeout = 6000;
    const bingTimeout = 8000;
    const ddgTimeout = 8000;
    const osmTimeout = 12000;

    // Dispara todas as estrategias em paralelo
    const strategyPromises = [
      { name: 'GoogleSearch', promise: fetchWithTimeout('GoogleSearch', () => extractFromGoogleSearch(keyword, location, targetLimit, existingForFetch, globalAbort.signal).then(r => r.leads), googleTimeout) },
      { name: 'GoogleMobile', promise: fetchWithTimeout('GoogleMobile', () => extractFromGoogleMapsMobile(keyword, location, targetLimit, existingForMobile, globalAbort.signal), mobileTimeout) },
      { name: 'BingMaps', promise: fetchWithTimeout('BingMaps', () => extractFromBingMaps(keyword, location, targetLimit, existingForFetch, globalAbort.signal), bingTimeout) },
      { name: 'DuckDuckGo', promise: fetchWithTimeout('DuckDuckGo', () => extractFromDuckDuckGo(keyword, location, targetLimit, existingForFetch, globalAbort.signal), ddgTimeout) },
      { name: 'OSM', promise: fetchWithTimeout('OSM', () => extractFromOpenStreetMap(keyword, location, targetLimit, existingForFetch, globalAbort.signal), osmTimeout) },
    ];

    // Smart: processa resultados conforme chegam (nao espera todos)
    // A cada estrategia que completa, verifica se ja tem leads suficientes
    const remainingPromises = [...strategyPromises];
    const fetchResults: SearchLead[][] = [];

    while (remainingPromises.length > 0 && !isOverTime()) {
      const result = await Promise.race(remainingPromises.map(s => 
        s.promise.then(leads => ({ name: s.name, leads, done: true }))
      ));
      
      // Remove a que completou
      const idx = remainingPromises.findIndex(s => s.name === result.name);
      if (idx !== -1) remainingPromises.splice(idx, 1);

      // Processa os leads dessa estrategia IMEDIATAMENTE
      const added = processResults(result.leads, result.name);
      if (added > 0) citiesDone++;
      fetchResults.push(result.leads);

      console.log(`[EXTRACT] ${result.name}: ${result.leads.length} leads (+${added} new) total=${leadsByName.size}/${targetLimit}`);
      
      // SMART ABORT: se ja temos leads suficientes, cancela o resto
      if (leadsByName.size >= targetLimit || elapsed() >= 25) {
        console.log(`[EXTRACT] Target met (${leadsByName.size}/${targetLimit}) or time up (${elapsed()}s), aborting remaining strategies`);
        globalAbort.abort();
        remainingPromises.length = 0; // Clear remaining
        break;
      }
    }

    // Se ainda tem promises pendentes (porque abortamos), espera so mais 2s
    if (remainingPromises.length > 0) {
      try {
        await Promise.race([
          Promise.all(remainingPromises.map(s => s.promise)),
          new Promise(r => setTimeout(r, 2000)),
        ]);
      } catch {}
    }

    console.log(`[EXTRACT] All strategies done: ${leadsByName.size} leads in ${elapsed()}s`);

    // Salva no cache SOMENTE se tiver leads validos suficientes
    // Evita cache poisoning com resultados quebrados
    const finalLeadCount = leadsByName.size;
    if (finalLeadCount >= Math.max(3, Math.min(targetLimit, 5))) {
      setCachedQuery(cacheKey, getLeadsArray());
      console.log(`[EXTRACT] Cache set: ${finalLeadCount} leads for "${cacheKey}"`);
    } else {
      console.log(`[EXTRACT] Cache skipped: only ${finalLeadCount} leads (min ${Math.max(3, Math.min(targetLimit, 5))} needed)`);
    }

    // =========================================================================
    // PHASE 2: removida (Playwright Chromium era instavel no Railway)
    // Se precisar de mais leads, tente novamente com termo diferente
    // =========================================================================

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
