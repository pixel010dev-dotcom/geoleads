import { chromium } from 'playwright';
import type { SearchLead } from './lib/types';
import { scoreLeadQuality } from './lib/types';
import { extractFromGoogleSearch } from './strategies/google-search';
import { extractFromPlaywrightMaps, extractMapsPlaceDetails } from './strategies/maps-scraper';
import { extractFromBingMaps } from './strategies/bing-maps';
import { extractFromOpenStreetMap, searchByCnaeAndCity, enrichLeadFromBrasilApi } from './strategies/alternative-sources';
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

interface StrategyResult {
  leads: SearchLead[];
  scanned: number;
  source: string;
  blocked: boolean;
  error?: string;
}

function parseFilterRules(filterRule: string): string[] {
  if (!filterRule || filterRule === 'none') return [];
  return filterRule.split(',').map(r => r.trim()).filter(Boolean);
}

function postFilter(lead: SearchLead, filterRule: string): boolean {
  const rules = parseFilterRules(filterRule);
  if (rules.length === 0) return true;
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

function applyMapsPlaceExtraDataToLead(lead: any, extraData: any): boolean {
  let changed = false;
  if (extraData.telefone && isValidBrazilianPhone(extraData.telefone) && lead.telefone === 'Não informado') {
    lead.telefone = normalizePhone(extraData.telefone);
    changed = true;
  }
  if (extraData.site && extraData.site.includes('instagram.com') && !lead.instagram) {
    lead.instagram = extraData.site; changed = true;
  } else if (extraData.site && (extraData.site.includes('facebook.com') || extraData.site.includes('fb.com')) && !lead.facebook) {
    lead.facebook = extraData.site; changed = true;
  } else if (extraData.site && extraData.site.includes('tiktok.com') && !lead.tiktok) {
    lead.tiktok = extraData.site; changed = true;
  }
  if (extraData.site && !extraData.site.includes('instagram.com') && !extraData.site.includes('facebook.com') &&
      !extraData.site.includes('tiktok.com') && (!lead.site || lead.site === 'Sem site')) {
    lead.site = extraData.site;
    changed = true;
  }
  if (extraData.instagram && !lead.instagram) { lead.instagram = extraData.instagram; changed = true; }
  if (extraData.facebook && !lead.facebook) { lead.facebook = extraData.facebook; changed = true; }
  if (extraData.tiktok && !lead.tiktok) { lead.tiktok = extraData.tiktok; changed = true; }
  if (extraData.endereco && !lead.endereco) { lead.endereco = extraData.endereco; changed = true; }
  if (extraData.horarios && !lead.horarios) { lead.horarios = extraData.horarios; changed = true; }
  return changed;
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
    maxTimeMs = isBroadRegion ? 1800000 : Math.min(1800000, Math.max(45000, targetLimit * 3000))
  } = config;

  const startTime = Date.now();
  const allLeads: SearchLead[] = [];
  const leadsByName = new Map<string, SearchLead>();
  const scrapedNames = new Set<string>(existingLeadKeys.map(k => k.split('|')[0]).filter(Boolean));
  const scrapedPhones = new Set<string>(existingLeadKeys.map(k => k.split('|')[1]).filter(Boolean));
  let scannedTotal = 0;
  let citiesDone = 0;
  let blockedDetected = false;
  let googleSucceeded = false;

  const maxTimeReached = () => (Date.now() - startTime) >= maxTimeMs;
  const cancelled = async () => shouldCancel ? await shouldCancel() : false;

  function addLead(lead: SearchLead): void {
    const key = lead.nome.toLowerCase();
    if (scrapedNames.has(key)) return;
    if (lead.telefone !== 'Não informado' && scrapedPhones.has(lead.telefone)) return;

    if (leadsByName.has(key)) {
      const existing = leadsByName.get(key)!;
      const merged = mergeLeadsData(existing, lead);
      leadsByName.set(key, merged);
    } else {
      leadsByName.set(key, lead);
    }

    scrapedNames.add(key);
    if (lead.telefone !== 'Não informado') scrapedPhones.add(lead.telefone);
  }

  function rebuildAllLeads(): void {
    allLeads.length = 0;
    for (const lead of leadsByName.values()) {
      allLeads.push(lead);
    }
  }

  const notify = (message?: string) => {
    rebuildAllLeads();
    if (onProgress) {
      onProgress(
        allLeads,
        scannedTotal,
        citiesDone,
        message || `${allLeads.length} leads encontrados em ${citiesDone} locais`
      );
    }
  };

  async function processStrategyResult(result: StrategyResult): Promise<number> {
    let added = 0;
    for (const lead of result.leads) {
      const key = lead.nome.toLowerCase();
      if (scrapedNames.has(key)) {
        const existing = leadsByName.get(key);
        if (existing) {
          const merged = mergeLeadsData(existing, lead);
          leadsByName.set(key, merged);
          added++;
        }
        continue;
      }
      if (lead.telefone !== 'Não informado' && scrapedPhones.has(lead.telefone)) continue;
      addLead(lead);
      added++;
    }
    scannedTotal += result.scanned;
    rebuildAllLeads();
    return added;
  }

  async function batchEnrichLeads(leads: SearchLead[]): Promise<void> {
    const batchSize = 5;
    for (let i = 0; i < leads.length && !maxTimeReached() && !(await cancelled()); i += batchSize) {
      const batch = leads.slice(i, i + batchSize);
      await Promise.all(batch.map(l => enrichLead(l)));
      rebuildAllLeads();
    }
  }

  const needsMore = () => targetLimit - allLeads.length;

  try {
    // =========================================================================
    // PHASE 0: Non-blocking sources (OSM + Brasil API) — immediate results
    // =========================================================================
    {
      notify('Buscando em fontes abertas (OSM + Brasil API)...');
      const existingForAlt = new Set<string>(Array.from(scrapedNames));

      const [osmResult, cnaeResult] = await Promise.all([
        extractFromOpenStreetMap(keyword, location, Math.max(needsMore(), targetLimit), existingForAlt),
        searchByCnaeAndCity(keyword, location, Math.max(needsMore(), targetLimit), existingForAlt),
      ]);

      const altResults: StrategyResult[] = [
        { leads: osmResult, scanned: osmResult.length, source: 'osm', blocked: false },
        { leads: cnaeResult, scanned: cnaeResult.length, source: 'brasil-api', blocked: false },
      ];

      for (const result of altResults) {
        const added = await processStrategyResult(result);
        if (added > 0) citiesDone++;
      }

      notify(`Fontes abertas: ${allLeads.length} leads encontrados`);

      if (allLeads.length > 0) {
        await batchEnrichLeads(allLeads.slice(0, Math.min(allLeads.length, 20)));
        notify(`Enriquecimento em andamento: ${allLeads.length} leads`);
      }
    }

    // =========================================================================
    // PHASE 1: Google Search (via CF Worker, Tor, proxy, or Places API)
    // =========================================================================
    if (needsMore() > 0 && !maxTimeReached() && !(await cancelled())) {
      notify(`Complementando via Google... (${allLeads.length}/${targetLimit})`);

      const cfWorkerUrl = process.env.CF_WORKER_URL || '';
      const existingForGoogle = new Set<string>(Array.from(scrapedNames));

      const searchResult = await extractFromGoogleSearch(
        keyword, location,
        Math.max(needsMore(), targetLimit),
        existingForGoogle,
        cfWorkerUrl ? { cfWorkerUrl } as any : undefined
      );

      if (!searchResult.blocked && searchResult.leads.length > 0) {
        const added = await processStrategyResult({
          leads: searchResult.leads, scanned: searchResult.leads.length,
          source: 'google-search', blocked: false,
        });
        googleSucceeded = true;
        notify(`Google: +${added} leads (total: ${allLeads.length})`);
      } else if (searchResult.blocked) {
        blockedDetected = true;

        const placesLeads = await extractFromGooglePlacesApi(
          keyword, location, needsMore(), existingForGoogle
        );

        if (placesLeads.length > 0) {
          await processStrategyResult({
            leads: placesLeads, scanned: placesLeads.length,
            source: 'google-places-api', blocked: false,
          });
          googleSucceeded = true;
          notify(`Google Places API: +${placesLeads.length} leads (total: ${allLeads.length})`);
        }
      }
    }

    // =========================================================================
    // PHASE 2: Playwright Maps (with Tor proxy if available)
    // =========================================================================
    if (needsMore() > 0 && !maxTimeReached() && !(await cancelled())) {
      let searchLocations: string[];

      if (isBroadRegion) {
        searchLocations = shuffleArray([...MAJOR_CITIES]);
      } else if (targetLimit >= 100) {
        const bairros = getCityBairros(location);
        if (bairros.length > 1) {
          const mainCity = location.replace(/,?\s*(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)$/i, '').trim();
          searchLocations = [location, ...shuffleArray(bairros).map(b => `${b}, ${mainCity}`)];
        } else {
          searchLocations = [location];
        }
      } else {
        searchLocations = [location];
      }

      const maxScrollPerCity = isBroadRegion ? 15 : Math.max(15, Math.min(60, targetLimit));
      const kwVariations = getNicheVariations(keyword);
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
              browser, kwVar, searchLoc,
              needsMore(),
              existingForScrape,
              maxScrollPerCity
            );

            if (mapsResult.blocked) {
              blockedDetected = true;
              continue;
            }
            if (mapsResult.leads.length > 0) {
              await processStrategyResult({
                leads: mapsResult.leads,
                scanned: mapsResult.leads.length,
                source: 'maps-scraper', blocked: false,
              });
            }
          }

          if (!isBroadRegion) citiesDone++;
          notify(`${allLeads.length} leads encontrados`);
        }
      } finally {
        if (browser) try { await browser.close(); } catch {}
      }
    }

    // =========================================================================
    // PHASE 2b: Place page enrichment
    // =========================================================================
    if (allLeads.length > 0 && !maxTimeReached() && !(await cancelled())) {
      const candidates = allLeads.filter(
        l => (l.telefone === 'Não informado' || !l.site || l.site === 'Sem site') && l.placeUrl
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
                const extraData = await extractMapsPlaceDetails(tab, lead.placeUrl);
                applyMapsPlaceExtraDataToLead(lead, extraData);
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
    // PHASE 3: Bing Maps (last resort)
    // =========================================================================
    if (needsMore() > 0 && !maxTimeReached() && !(await cancelled())) {
      const existingForAlt = new Set<string>(Array.from(scrapedNames));
      const bingLeads = await extractFromBingMaps(keyword, location, needsMore(), existingForAlt);

      if (bingLeads.length > 0) {
        await processStrategyResult({
          leads: bingLeads, scanned: bingLeads.length,
          source: 'bing', blocked: false,
        });
        notify(`Bing: +${bingLeads.length} leads`);
      }
    }

    // =========================================================================
    // FINAL: Post-filter, scoring, and dedup
    // =========================================================================
    rebuildAllLeads();

    const scoredLeads = allLeads.map(l => ({ lead: l, score: scoreLeadQuality(l) }));
    scoredLeads.sort((a, b) => b.score.score - a.score.score);

    const validLeads = scoredLeads
      .filter(s => s.score.tier !== 'trash')
      .map(s => s.lead)
      .filter(l => postFilter(l, filterRule))
      .slice(0, targetLimit);

    let error: string | undefined;
    if (validLeads.length === 0 && blockedDetected) {
      error = 'Google bloqueou a busca. Tente novamente em alguns minutos.';
    } else if (validLeads.length === 0 && allLeads.length === 0) {
      error = 'Nenhum lead encontrado. Verifique o termo e a localização.';
    } else if (validLeads.length === 0 && allLeads.length > 0) {
      error = 'Leads encontrados, mas nenhum passou pelos filtros aplicados.';
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
    rebuildAllLeads();
    const partialLeads = allLeads.filter(l => postFilter(l, filterRule)).slice(0, targetLimit);
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
