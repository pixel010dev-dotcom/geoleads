import { chromium } from 'playwright';
import type { SearchLead } from './lib/types';
import { scoreLeadQuality } from './lib/types';
import { extractFromGoogleSearch } from './strategies/google-search';
import { extractFromPlaywrightMaps } from './strategies/maps-scraper';
import { extractFromBingMaps } from './strategies/bing-maps';
import { extractFromOpenStreetMap } from './strategies/alternative-sources';
import { extractFromGooglePlacesApi } from './strategies/google-places-api';
import { extractFromDuckDuckGo } from './strategies/duckduckgo';
import { enrichLead } from './enrichment/website';
import { getNicheVariations, getCityBairros, shuffleArray, MAJOR_CITIES } from './lib/normalizers';
import { getWorkingProxy } from './lib/proxy-pool';
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
    maxTimeMs = isBroadRegion ? 120000 : Math.min(90000, Math.max(25000, targetLimit * 1200))
  } = config;

  const startTime = Date.now();
  const leadsByName = new Map<string, SearchLead>();
  const scrapedNames = new Set<string>(existingLeadKeys.map(k => k.split('|')[0]).filter(Boolean));
  const scrapedPhones = new Set<string>(existingLeadKeys.map(k => k.split('|')[1]).filter(Boolean));
  let scannedTotal = 0;
  let citiesDone = 0;
  let blockedDetected = false;

  const maxTimeReached = () => (Date.now() - startTime) >= maxTimeMs;
  const cancelled = async () => shouldCancel ? await shouldCancel() : false;
  const needsMore = () => targetLimit - leadsByName.size;

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
    return added;
  }

  try {
    const existingForFetch = new Set<string>(Array.from(scrapedNames));
    const cfWorkerUrl = process.env.CF_WORKER_URL || '';

    // =========================================================================
    // PHASE 1: PARALLEL fetch (OSM + Google + Bing + DuckDuckGo) — all HTTP
    // =========================================================================
    notify('Buscando leads...');

    const fetchPromises = [
      Promise.race([
        extractFromOpenStreetMap(keyword, location, targetLimit, existingForFetch),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 15000)),
      ]).then(leads => ({ source: 'osm', leads: leads as SearchLead[] })).catch(() => ({ source: 'osm', leads: [] as SearchLead[] })),
      Promise.race([
        extractFromGoogleSearch(
          keyword, location, targetLimit, existingForFetch,
          cfWorkerUrl ? { cfWorkerUrl } : undefined
        ),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 15000)),
      ]).then(result => {
        if (result.blocked) blockedDetected = true;
        return { source: 'google', leads: result.leads };
      }).catch(() => ({ source: 'google', leads: [] as SearchLead[] })),
      Promise.race([
        extractFromBingMaps(keyword, location, targetLimit, existingForFetch),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 10000)),
      ]).then(leads => ({ source: 'bing', leads: leads as SearchLead[] })).catch(() => ({ source: 'bing', leads: [] as SearchLead[] })),
      Promise.race([
        extractFromDuckDuckGo(keyword, location, targetLimit, existingForFetch),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 10000)),
      ]).then(leads => ({ source: 'duckduckgo', leads: leads as SearchLead[] })).catch(() => ({ source: 'duckduckgo', leads: [] as SearchLead[] })),
    ];

    const fetchResults = await Promise.allSettled(fetchPromises);

    for (const result of fetchResults) {
      if (result.status === 'fulfilled') {
        const added = processResults(result.value.leads, result.value.source);
        if (added > 0) citiesDone++;
      }
    }

    notify(`${leadsByName.size} leads encontrados (${Math.round((Date.now() - startTime) / 1000)}s)`);

    // =========================================================================
    // EARLY EXIT: If we have enough leads, skip Playwright entirely
    // =========================================================================
    if (needsMore() <= 0) {
      const leads = getLeadsArray();
      const validLeads = leads
        .map(l => ({ lead: l, score: scoreLeadQuality(l) }))
        .filter(s => s.score.tier !== 'trash')
        .map(s => s.lead)
        .filter(l => postFilter(l, filterRule))
        .slice(0, targetLimit);

      if (onDone) {
        onDone({
          leads: validLeads,
          scanned: scannedTotal,
          citiesDone,
          totalTimeMs: Date.now() - startTime,
        });
      }
      return validLeads;
    }

    // =========================================================================
    // PHASE 2: Playwright Maps — fallback when fetch sources aren't enough
    // Tight limits: 3 scrolls max, 10s per page, single location only
    // =========================================================================
    const usePlaywright = needsMore() > 0 && !maxTimeReached() && !(await cancelled());

    if (usePlaywright) {
      let searchLocations: string[];

      if (isBroadRegion) {
        searchLocations = shuffleArray([...MAJOR_CITIES]).slice(0, 2);
      } else if (targetLimit >= 100) {
        const bairros = getCityBairros(location);
        if (bairros.length > 1) {
          const mainCity = location.replace(/,?\s*(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)$/i, '').trim();
          searchLocations = [location, ...shuffleArray(bairros).slice(0, 2).map(b => `${b}, ${mainCity}`)];
        } else {
          searchLocations = [location];
        }
      } else {
        searchLocations = [location];
      }

      const maxScrollPerCity = Math.min(3, Math.max(2, Math.ceil(targetLimit / 15)));
      const kwVariations = getNicheVariations(keyword).slice(0, 1);
      const proxyConfig = getPlaywrightProxyConfig();
      const proxyUrl = proxyConfig ? undefined : await getWorkingProxy();

      let browser: any = null;
      try {
        browser = await chromium.launch({
          headless: true,
          args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
          proxy: proxyConfig || (proxyUrl ? { server: proxyUrl } : undefined),
        });

        for (const searchLoc of searchLocations) {
          if (needsMore() <= 0) break;
          if (maxTimeReached()) break;
          if (await cancelled()) break;

          for (const kwVar of kwVariations) {
            if (needsMore() <= 0) break;
            if (maxTimeReached()) break;
            if (await cancelled()) break;

            const existingForScrape = new Set<string>(Array.from(scrapedNames));
            const mapsResult = await extractFromPlaywrightMaps(
              browser, kwVar, searchLoc, needsMore(), existingForScrape, maxScrollPerCity
            );

            if (mapsResult.blocked) {
              blockedDetected = true;
              continue;
            }
            if (mapsResult.leads.length > 0) {
              processResults(mapsResult.leads, 'maps-scraper');
              notify(`${leadsByName.size} leads (${Math.round((Date.now() - startTime) / 1000)}s)`);
            }
          }

          if (!isBroadRegion) citiesDone++;
        }
      } finally {
        if (browser) try { await browser.close(); } catch (e) { console.error(e); }
      }
    }

    // =========================================================================
    // PHASE 3: Google Places API (fallback if blocked and need more)
    // =========================================================================
    if (blockedDetected && needsMore() > 0 && !maxTimeReached() && !(await cancelled())) {
      const existingForPlaces = new Set<string>(Array.from(scrapedNames));
      const placesLeads = await extractFromGooglePlacesApi(keyword, location, needsMore(), existingForPlaces);
      if (placesLeads.length > 0) {
        processResults(placesLeads, 'google-places-api');
      }
    }

    // =========================================================================
    // FINAL: Post-filter, scoring, and deliver leads IMMEDIATELY
    // =========================================================================
    const leads = getLeadsArray();
    const validLeads = leads
      .map(l => ({ lead: l, score: scoreLeadQuality(l) }))
      .filter(s => s.score.tier !== 'trash')
      .map(s => s.lead)
      .filter(l => postFilter(l, filterRule))
      .slice(0, targetLimit);

    let error: string | undefined;
    if (validLeads.length === 0 && blockedDetected) {
      error = 'Google bloqueou a busca. Tente novamente em alguns minutos.';
    } else if (validLeads.length === 0 && leads.length === 0) {
      error = 'Nenhum lead encontrado. Verifique o termo e a localização.';
    } else if (validLeads.length === 0 && leads.length > 0) {
      error = 'Leads encontrados, mas nenhum passou pelos filtros.';
    }

    if (onDone) {
      try {
        await onDone({
          leads: validLeads,
          scanned: scannedTotal,
          citiesDone,
          totalTimeMs: Date.now() - startTime,
          error,
        });
      } catch (e) {
        console.error('[EXTRACT RUNNER] onDone failed:', e);
        if (onProgress) {
          onProgress(validLeads, scannedTotal, citiesDone, `Extração concluída: ${validLeads.length} leads`);
        }
      }
    }

    // =========================================================================
    // ENRICHMENT: Runs AFTER onDone — background, non-blocking
    // Updates job via onProgress so frontend sees enriched data live
    // =========================================================================
    const leadsToEnrich = validLeads.filter(l => l.site && l.site !== 'Sem site').slice(0, 10);
    if (leadsToEnrich.length > 0) {
      const batchSize = 5;
      for (let i = 0; i < leadsToEnrich.length; i += batchSize) {
        const batch = leadsToEnrich.slice(i, i + batchSize);
        await Promise.all(batch.map(l => enrichLead(l)));
        if (onProgress) {
          onProgress(validLeads, scannedTotal, citiesDone, `Enriquecendo sites (${Math.min(i + batchSize, leadsToEnrich.length)}/${leadsToEnrich.length})...`);
        }
      }
    }

    return validLeads;
  } catch (err: any) {
    console.error('[EXTRACT RUNNER] Fatal error:', err);
    const partialLeads = getLeadsArray()
      .filter(l => postFilter(l, filterRule))
      .slice(0, targetLimit);
    if (onDone) {
      onDone({
        leads: partialLeads,
        scanned: scannedTotal,
        citiesDone,
        totalTimeMs: Date.now() - startTime,
        error: `Erro na extração: ${err?.message || 'Erro inesperado'}`,
      });
    }
    return partialLeads;
  }
}
