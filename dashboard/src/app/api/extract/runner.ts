import { chromium } from 'playwright';
import type { SearchLead } from './lib/types';
import { scoreLeadQuality } from './lib/types';
import { extractFromGoogleSearch } from './strategies/google-search';
import { extractFromPlaywrightMaps, extractMapsPlaceDetails } from './strategies/maps-scraper';
import { extractFromBingMaps } from './strategies/bing-maps';
import { extractFromOpenStreetMap, searchByCnaeAndCity } from './strategies/alternative-sources';
import { extractFromGooglePlacesApi } from './strategies/google-places-api';
import { enrichLead } from './enrichment/website';
import { normalizePhone, isValidBrazilianPhone } from './lib/validation';
import { getNicheVariations, getCityBairros, shuffleArray, MAJOR_CITIES } from './lib/normalizers';
import { getWorkingProxy } from './lib/proxy-pool';
import { isTorEnabled, getPlaywrightProxyConfig } from './lib/proxy';

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
    maxTimeMs = isBroadRegion ? 1800000 : Math.min(1800000, Math.max(30000, targetLimit * 2000))
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
    // PHASE 1: PARALLEL fetch (OSM + Google + Bing) — all are HTTP, no browser
    // =========================================================================
    notify('Buscando leads...');

    const fetchPromises = [
      extractFromOpenStreetMap(keyword, location, targetLimit, existingForFetch).then(leads => ({ source: 'osm', leads })),
      extractFromGoogleSearch(
        keyword, location, targetLimit, existingForFetch,
        cfWorkerUrl ? { cfWorkerUrl } : undefined
      ).then(result => {
        if (result.blocked) blockedDetected = true;
        return { source: 'google', leads: result.leads };
      }),
      extractFromBingMaps(keyword, location, targetLimit, existingForFetch).then(leads => ({ source: 'bing', leads })),
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
    // PHASE 2: Playwright Maps (only if targetLimit > 30 or broad region)
    // =========================================================================
    const usePlaywright = isBroadRegion || targetLimit > 30;

    if (usePlaywright && needsMore() > 0 && !maxTimeReached() && !(await cancelled())) {
      let searchLocations: string[];

      if (isBroadRegion) {
        searchLocations = shuffleArray([...MAJOR_CITIES]);
      } else if (targetLimit >= 100) {
        const bairros = getCityBairros(location);
        if (bairros.length > 1) {
          const mainCity = location.replace(/,?\s*(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)$/i, '').trim();
          searchLocations = [location, ...shuffleArray(bairros).slice(0, 5).map(b => `${b}, ${mainCity}`)];
        } else {
          searchLocations = [location];
        }
      } else {
        searchLocations = [location];
      }

      const maxScrollPerCity = isBroadRegion ? 10 : Math.max(10, Math.min(30, targetLimit));
      const kwVariations = getNicheVariations(keyword).slice(0, 2);
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
            }
          }

          if (!isBroadRegion) citiesDone++;
          notify(`${leadsByName.size} leads (${Math.round((Date.now() - startTime) / 1000)}s)`);
        }
      } finally {
        if (browser) try { await browser.close(); } catch {}
      }
    }

    // =========================================================================
    // PHASE 2b: Place page enrichment (only if we have Google Maps place URLs)
    // =========================================================================
    if (leadsByName.size > 0 && !maxTimeReached() && !(await cancelled())) {
      const candidates = getLeadsArray().filter(
        l => (l.telefone === 'Não informado' || !l.site || l.site === 'Sem site') && l.placeUrl && l.placeUrl.includes('google.com/maps')
      );
      if (candidates.length > 0) {
        const proxyConfig = getPlaywrightProxyConfig();
        let browser: any = null;
        try {
          browser = await chromium.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
            proxy: proxyConfig,
          });

          for (let i = 0; i < candidates.length && !maxTimeReached() && !(await cancelled()); i += 3) {
            const batch = candidates.slice(i, i + 3);
            const tab = await browser.newPage();
            for (const lead of batch) {
              try {
                const extra = await extractMapsPlaceDetails(tab, lead.placeUrl);
                if (extra.telefone && isValidBrazilianPhone(extra.telefone) && lead.telefone === 'Não informado') {
                  lead.telefone = normalizePhone(extra.telefone);
                }
                if (extra.site && !extra.site.includes('google.com') && (!lead.site || lead.site === 'Sem site')) {
                  lead.site = extra.site;
                }
                if (extra.instagram && !lead.instagram) lead.instagram = extra.instagram;
                if (extra.facebook && !lead.facebook) lead.facebook = extra.facebook;
              } catch {}
            }
            try { await tab.close(); } catch {}
          }
        } finally {
          if (browser) try { await browser.close(); } catch {}
        }
      }
    }

    // =========================================================================
    // PHASE 3: Google Places API (fallback if blocked)
    // =========================================================================
    if (blockedDetected && needsMore() > 0 && !maxTimeReached() && !(await cancelled())) {
      const existingForPlaces = new Set<string>(Array.from(scrapedNames));
      const placesLeads = await extractFromGooglePlacesApi(keyword, location, needsMore(), existingForPlaces);
      if (placesLeads.length > 0) {
        processResults(placesLeads, 'google-places-api');
      }
    }

    // =========================================================================
    // ENRICHMENT: Background, non-blocking
    // =========================================================================
    const leadsToEnrich = getLeadsArray().filter(l => l.site && l.site !== 'Sem site').slice(0, 15);
    if (leadsToEnrich.length > 0) {
      const batchSize = 5;
      for (let i = 0; i < leadsToEnrich.length && !maxTimeReached(); i += batchSize) {
        const batch = leadsToEnrich.slice(i, i + batchSize);
        await Promise.all(batch.map(l => enrichLead(l)));
      }
    }

    // =========================================================================
    // FINAL: Post-filter, scoring, and return
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
      onDone({
        leads: validLeads,
        scanned: scannedTotal,
        citiesDone,
        totalTimeMs: Date.now() - startTime,
        error,
      });
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
