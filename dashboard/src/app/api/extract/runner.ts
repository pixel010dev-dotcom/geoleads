import { chromium } from 'playwright';
import type { SearchLead, ScoreQuality } from './lib/types';
import { scoreLeadQuality } from './lib/types';
import { extractFromGoogleSearch } from './strategies/google-search';
import { extractFromPlaywrightMaps, extractMapsPlaceDetails } from './strategies/maps-scraper';
import { extractFromBingMaps } from './strategies/bing-maps';
import { extractFromOpenStreetMap } from './strategies/alternative-sources';
import { enrichLead } from './enrichment/website';
import { normalizePhone, isValidBrazilianPhone } from './lib/validation';
import { getNicheVariations, getCityBairros, shuffleArray, MAJOR_CITIES } from './lib/normalizers';

export interface RunnerConfig {
  keyword: string;
  location: string;
  targetLimit: number;
  filterRule: string;
  isBroadRegion: boolean;
  existingLeadKeys: string[];
  onProgress?: (leads: SearchLead[], scanned: number, citiesDone: number, message: string) => void;
  onDone?: (leads: SearchLead[], scanned: number, citiesDone: number, totalTimeMs: number) => void;
  shouldCancel?: () => Promise<boolean>;
  maxTimeMs?: number;
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

export async function runExtraction(config: RunnerConfig): Promise<SearchLead[]> {
  const {
    keyword, location, targetLimit, filterRule, isBroadRegion,
    existingLeadKeys, onProgress, onDone, shouldCancel,
    maxTimeMs = isBroadRegion ? 1800000 : Math.min(1800000, Math.max(45000, targetLimit * 3000))
  } = config;

  const startTime = Date.now();
  const allEnrichedLeads: SearchLead[] = [];
  const scrapedNames = new Set<string>(existingLeadKeys.map(k => k.split('|')[0]).filter(Boolean));
  const scrapedPhones = new Set<string>(existingLeadKeys.map(k => k.split('|')[1]).filter(Boolean));
  const seenAll = new Set<string>();
  let citiesDone = 0;
  let scannedTotal = 0;

  const maxTimeReached = () => (Date.now() - startTime) >= maxTimeMs;
  const cancelled = async () => shouldCancel ? await shouldCancel() : false;

  const tryAddLeads = async (newLeads: SearchLead[], source: string) => {
    for (const lead of newLeads) {
      if (allEnrichedLeads.length >= targetLimit) break;
      const key = lead.nome.toLowerCase();
      if (seenAll.has(key)) continue;
      if (scrapedNames.has(lead.nome)) continue;
      if (lead.telefone !== 'Não informado' && scrapedPhones.has(lead.telefone)) continue;
      seenAll.add(key);
      scrapedNames.add(lead.nome);
      if (lead.telefone !== 'Não informado') scrapedPhones.add(lead.telefone);

      const enriched = await enrichLead(lead);
      allEnrichedLeads.push(enriched);
    }
  };

  const notify = (extra?: string) => {
    if (onProgress) {
      onProgress(
        allEnrichedLeads,
        scannedTotal,
        citiesDone,
        `${allEnrichedLeads.length} leads encontrados em ${citiesDone} locais${extra || ''}`
      );
    }
  };

  try {
    // =========================================================================
    // PHASE 1: Google Search tbm=map (fetch, no browser)
    // =========================================================================
    if (!maxTimeReached() && !(await cancelled()) && allEnrichedLeads.length < targetLimit) {
      const searchLeads = await extractFromGoogleSearch(
        keyword, location,
        Math.max(targetLimit, targetLimit * 2),
        new Set(existingLeadKeys)
      );
      await tryAddLeads(searchLeads, 'google-search');
      scannedTotal += searchLeads.length;
      notify(` (Google Search: ${searchLeads.length})`);
    }

    // =========================================================================
    // PHASE 2: Playwright Maps DOM Scraping
    // =========================================================================
    if (allEnrichedLeads.length < targetLimit && !maxTimeReached() && !(await cancelled())) {
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

      let browser: any = null;
      try {
        browser = await chromium.launch({
          headless: true,
          args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
        });

        for (const searchLoc of searchLocations) {
          if (allEnrichedLeads.length >= targetLimit) break;
          if (maxTimeReached()) break;
          if (await cancelled()) break;

          for (const kwVar of kwVariations) {
            if (allEnrichedLeads.length >= targetLimit) break;
            if (maxTimeReached()) break;
            if (await cancelled()) break;

            const existingForScrape = new Set<string>(Array.from(scrapedNames));

            const mapsLeads = await extractFromPlaywrightMaps(
              browser, kwVar, searchLoc,
              targetLimit - allEnrichedLeads.length,
              existingForScrape,
              maxScrollPerCity
            );

            if (mapsLeads.length > 0) {
              for (const lead of mapsLeads) {
                if (allEnrichedLeads.length >= targetLimit) break;
                if (seenAll.has(lead.nome.toLowerCase()) || scrapedNames.has(lead.nome)) continue;
                seenAll.add(lead.nome.toLowerCase());
                scrapedNames.add(lead.nome);
                if (lead.telefone !== 'Não informado') scrapedPhones.add(lead.telefone);

                allEnrichedLeads.push(lead);
                scannedTotal += mapsLeads.length;
              }
            }
          }

          if (!isBroadRegion) citiesDone++;
          notify();

          if (allEnrichedLeads.length > 0 && allEnrichedLeads.length % 10 === 0) {
            notify(` (${allEnrichedLeads.length} leads)`);
          }
        }
      } finally {
        if (browser) try { await browser.close(); } catch {}
      }
    }

    // =========================================================================
    // PHASE 2b: Second pass - place pages (only for leads without phone/site)
    // =========================================================================
    if (allEnrichedLeads.length > 0 && !maxTimeReached() && !(await cancelled())) {
      const candidates = allEnrichedLeads.filter(
        l => (l.telefone === 'Não informado' || !l.site || l.site === 'Sem site') && l.placeUrl
      );
      if (candidates.length > 0) {
        let browser: any = null;
        try {
          browser = await chromium.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
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
    // PHASE 3: Alternative sources (Bing Maps, OSM)
    // =========================================================================
    if (allEnrichedLeads.length < targetLimit && !maxTimeReached() && !(await cancelled())) {
      const existingForAlt = new Set<string>(Array.from(scrapedNames));

      const bingLeads = await extractFromBingMaps(keyword, location, targetLimit - allEnrichedLeads.length, existingForAlt);
      for (const lead of bingLeads) {
        if (allEnrichedLeads.length >= targetLimit) break;
        if (seenAll.has(lead.nome.toLowerCase()) || scrapedNames.has(lead.nome)) continue;
        seenAll.add(lead.nome.toLowerCase());
        scrapedNames.add(lead.nome);
        allEnrichedLeads.push(lead);
      }

      if (allEnrichedLeads.length < targetLimit && isBroadRegion) {
        const osmLeads = await extractFromOpenStreetMap(keyword, location, targetLimit - allEnrichedLeads.length, existingForAlt);
        for (const lead of osmLeads) {
          if (allEnrichedLeads.length >= targetLimit) break;
          if (seenAll.has(lead.nome.toLowerCase()) || scrapedNames.has(lead.nome)) continue;
          seenAll.add(lead.nome.toLowerCase());
          scrapedNames.add(lead.nome);
          allEnrichedLeads.push(lead);
        }
      }
    }

    // =========================================================================
    // FINAL: Apply post-filter and quality scoring
    // =========================================================================
    const validLeads = allEnrichedLeads.filter(l => postFilter(l, filterRule)).slice(0, targetLimit);

    if (onDone) {
      onDone(validLeads, scannedTotal, citiesDone, Date.now() - startTime);
    }

    return validLeads;
  } catch (err: any) {
    console.error('[EXTRACT RUNNER] Fatal error:', err);
    return allEnrichedLeads.filter(l => postFilter(l, filterRule)).slice(0, targetLimit);
  }
}
