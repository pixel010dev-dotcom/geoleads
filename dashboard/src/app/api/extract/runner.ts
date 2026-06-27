import type { SearchLead } from './lib/types';
import { scoreLeadQuality, cleanLeadName } from './lib/types';
import { extractFromGoogleSearch } from './strategies/google-search-via-cf';
import { extractFromOpenStreetMap } from './strategies/alternative-sources';
import { extractFromDuckDuckGo } from './strategies/duckduckgo';
import { extractFromBingMaps } from './strategies/bing-maps';
import { extractFromGoogleMapsMobile } from './strategies/google-maps-mobile';
import { extractFromPlaywrightMaps } from './strategies/maps-scraper';
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
  onDone?: (result: RunnerResult) => void | Promise<void>;
  shouldCancel?: () => Promise<boolean>;
  maxTimeMs?: number;
}

function postFilter(lead: SearchLead, filterRule: string): boolean {
  if (!filterRule || filterRule === 'none') return true;
  const score = scoreLeadQuality(lead);
  if (score.score >= 25) return true;

  const hasSite = lead.site !== undefined && lead.site !== '' && lead.site !== 'Sem site';

  const rules = filterRule.split(',').map(r => r.trim()).filter(Boolean);
  return rules.every(rule => {
    if (rule === 'phone') return lead.telefone && lead.telefone !== 'Não informado';
    if (rule === 'site') return hasSite;
    // Filtros de enriquecimento: se o lead tem site, tem potencial
    // de ser enriquecido (email/redes/CNPJ via website scraping)
    if (rule === 'email') return !!lead.email || hasSite;
    if (rule === 'insta') return !!lead.instagram || hasSite;
    if (rule === 'face') return !!lead.facebook || hasSite;
    if (rule === 'tiktok') return !!lead.tiktok || hasSite;
    if (rule === 'cnpj') return !!lead.cnpj || hasSite;
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
  const MAX_TOTAL_MS = 1800000;
  const hardDeadline = startTime + MAX_TOTAL_MS;
  let finalized = false;
  const leadsByName = new Map<string, SearchLead>();
  const scrapedNames = new Set<string>(existingLeadKeys.map(k => k.split('|')[0].toLowerCase()).filter(Boolean));
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
      if (!lead.nome || lead.nome.trim() === '') continue;
      const key = lead.nome.toLowerCase();
      if (scrapedNames.has(key)) {
        if (leadsByName.has(key)) {
          leadsByName.set(key, mergeLeadsData(leadsByName.get(key)!, lead));
          added++;
        }
        continue;
      }
      if (lead.telefone !== 'Não informado' && scrapedPhones.has(lead.telefone)) continue;
      lead.nome = cleanLeadName(lead.nome);
      if (!lead.nome) continue;
      addLead(lead);
      added++;
    }
    scannedTotal += leads.length;
    if (added > 0) console.log(`[EXTRACT] ${source}: +${added} leads (total: ${leadsByName.size})`);
    return added;
  }

  const notify = (message?: string) => {
    if (onProgress) {
      onProgress(getLeadsArray(), scannedTotal, citiesDone, message || `${leadsByName.size} leads encontrados`);
    }
  };

  const finalize = async (leads: SearchLead[], error?: string) => {
    if (finalized) return leads.slice(0, targetLimit);
    finalized = true;

    const scoredLeads = leads.map(l => ({ lead: l, score: scoreLeadQuality(l) }));
    const validLeads = scoredLeads
      .filter(s => s.score.tier !== 'trash')
      .map(s => s.lead)
      .filter(l => postFilter(l, filterRule))
      .slice(0, targetLimit);

    console.log(`[EXTRACT] Finalizing: ${validLeads.length} valid leads from ${leadsByName.size} unique (${scoredLeads.filter(s => s.score.tier === 'trash').length} trash) in ${elapsed()}s`);

    if (onDone) {
      try {
        await onDone({ leads: validLeads, scanned: scannedTotal, citiesDone, totalTimeMs: Date.now() - startTime, error });
      } catch (e: any) {
        console.error('[EXTRACT] onDone error:', e?.message || e);
      }
    }
    return validLeads;
  };

  async function runAllStrategies(): Promise<number> {
    const roundStart = leadsByName.size;

    const stratTimeout = Math.min(15000 + targetLimit * 2, 45000);

    const fetchWithTimeout = (name: string, fn: () => Promise<SearchLead[]>, timeoutMs: number): Promise<SearchLead[]> =>
      new Promise<SearchLead[]>((resolve) => {
        let done = false;
        const timer = setTimeout(() => {
          if (!done) { done = true; console.log(`[EXTRACT] ${name}: TIMEOUT after ${timeoutMs}ms`); resolve([]); }
        }, timeoutMs);
        fn().then(leads => {
          if (!done) { done = true; clearTimeout(timer); console.log(`[EXTRACT] ${name}: ${leads.length} leads in ${elapsed()}s`); resolve(leads); }
        }).catch(() => {
          if (!done) { done = true; clearTimeout(timer); console.log(`[EXTRACT] ${name}: FAILED`); resolve([]); }
        });
      });

    const existingForFetch = new Set<string>(Array.from(scrapedNames));
    const existingForMobile = new Set<string>(Array.from(scrapedNames));

    const strategyPromises = [
      { name: 'GoogleSearch', promise: fetchWithTimeout('GoogleSearch', () => extractFromGoogleSearch(keyword, location, targetLimit, existingForFetch).then(r => r.leads), stratTimeout) },
      { name: 'GoogleMobile', promise: fetchWithTimeout('GoogleMobile', () => extractFromGoogleMapsMobile(keyword, location, targetLimit, existingForMobile), stratTimeout) },
      { name: 'BingMaps', promise: fetchWithTimeout('BingMaps', () => extractFromBingMaps(keyword, location, targetLimit, existingForFetch), stratTimeout) },
      { name: 'DuckDuckGo', promise: fetchWithTimeout('DuckDuckGo', () => extractFromDuckDuckGo(keyword, location, targetLimit, existingForFetch), stratTimeout) },
      { name: 'OSM', promise: fetchWithTimeout('OSM', () => extractFromOpenStreetMap(keyword, location, targetLimit, existingForFetch), stratTimeout) },
    ];

    const remaining = [...strategyPromises];
    while (remaining.length > 0 && Date.now() < hardDeadline) {
      if (await cancelled()) break;
      const result = await Promise.race(remaining.map(s =>
        s.promise.then(leads => ({ name: s.name, leads, done: true }))
      ));
      const idx = remaining.findIndex(s => s.name === result.name);
      if (idx !== -1) remaining.splice(idx, 1);
      const added = processResults(result.leads, result.name);
      if (added > 0) citiesDone++;
      notify(`${leadsByName.size} leads (${result.name})`);
      if (leadsByName.size >= targetLimit) {
        remaining.length = 0;
        break;
      }
    }

    if (remaining.length > 0) {
      try { await Promise.race([Promise.all(remaining.map(s => s.promise)), new Promise(r => setTimeout(r, 2000))]); } catch { }
    }

    return leadsByName.size - roundStart;
  }

  try {
    const cacheKey = generateQueryCacheKey(keyword, location);
    const cachedLeads = getCachedQuery(cacheKey);
    if (cachedLeads && cachedLeads.length >= targetLimit) {
      console.log(`[EXTRACT] Cache HIT: ${cachedLeads.length} leads`);
      for (const lead of cachedLeads) {
        if (leadsByName.size >= targetLimit) break;
        processResults([lead], 'cache');
      }
      return finalize(getLeadsArray());
    }

    console.log(`[EXTRACT] Starting: "${keyword}" in "${location}" limit=${targetLimit}`);

    // ROUND 1: all HTTP strategies in parallel
    notify(`Buscando ${targetLimit} leads em multiplas fontes...`);
    await runAllStrategies();
    notify(`${leadsByName.size}/${targetLimit} leads (HTTP)`);

    // ROUND 2: if target not met, try again (some strategies may have different cached results)
    if (leadsByName.size < targetLimit && Date.now() < hardDeadline && !(await cancelled())) {
      console.log(`[EXTRACT] Round 2: target ${targetLimit} not met (${leadsByName.size}), retrying strategies...`);
      notify(`Rodada 2: refinando busca...`);
      await runAllStrategies();
      notify(`${leadsByName.size}/${targetLimit} leads (apos 2 rodadas)`);
    }

    // PHASE 2: Playwright — only if target still not met (falha silenciosamente sem Chromium)
    if (leadsByName.size < targetLimit && Date.now() < hardDeadline && !(await cancelled())) {
      console.log(`[EXTRACT] Playwright: target ${targetLimit} not met (${leadsByName.size}), starting browser...`);
      notify(`Abrindo navegador para coletar mais leads (${leadsByName.size}/${targetLimit})...`);
      try {
        const { chromium } = require('playwright');
        const browser = await chromium.launch({
          headless: true,
          args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--single-process'],
        });
        const pwResult = await extractFromPlaywrightMaps(browser, keyword, location, targetLimit, existingLeadKeys ? new Set(existingLeadKeys) : new Set());
        await browser.close();
        const pwAdded = processResults(pwResult.leads, 'Playwright');
        console.log(`[EXTRACT] Playwright: ${pwResult.leads.length} leads (+${pwAdded} new), total ${leadsByName.size}/${targetLimit}`);
        notify(`${leadsByName.size}/${targetLimit} leads (Playwright)`);
      } catch (e: any) {
        console.warn(`[EXTRACT] Playwright failed (non-critical):`, e?.message || e);
        notify(`Playwright indisponivel, continuando com ${leadsByName.size} leads...`);
      }
    }

    // Salva cache
    const finalCount = leadsByName.size;
    if (finalCount >= Math.max(3, Math.min(targetLimit, 5))) {
      setCachedQuery(cacheKey, getLeadsArray());
    }

    notify(`${leadsByName.size} leads encontrados em ${elapsed()}s`);
    return finalize(getLeadsArray());

  } catch (err: any) {
    console.error('[EXTRACT] Fatal error:', err);
    if (finalized) return getLeadsArray().slice(0, targetLimit);
    return finalize(getLeadsArray(), `Erro na extração: ${err?.message || 'Erro inesperado'}`);
  }
}
