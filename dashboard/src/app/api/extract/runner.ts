import type { SearchLead } from './lib/types';
import { scoreLeadQuality, cleanLeadName } from './lib/types';
import { extractFromGoogleSearch } from './strategies/google-search-via-cf';
import { extractFromOpenStreetMap } from './strategies/alternative-sources';
import { extractFromDuckDuckGo } from './strategies/duckduckgo';
import { extractFromBingMaps } from './strategies/bing-maps';
import { extractFromGoogleMapsMobile } from './strategies/google-maps-mobile';
import { extractFromPlaywrightMaps } from './strategies/maps-scraper';
import { getCachedQuery, setCachedQuery, generateQueryCacheKey } from './lib/cache';
import { MAJOR_CITIES, getCityBairros, getNicheVariations } from './lib/normalizers';
import { getRandomUserAgent, getRandomViewport, getRandomTimezone, getRandomGeolocation } from './lib/stealth';

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
    linkedin: existing.linkedin || incoming.linkedin,
    cnpj: existing.cnpj || incoming.cnpj,
  };
}

// City "weight" based on population — cidades maiores contribuem mais leads
const CITY_WEIGHT: Record<string, number> = {
  'São Paulo, SP': 8, 'Rio de Janeiro, RJ': 6, 'Belo Horizonte, MG': 5,
  'Brasília, DF': 5, 'Salvador, BA': 4, 'Fortaleza, CE': 4,
  'Curitiba, PR': 4, 'Manaus, AM': 3, 'Recife, PE': 4, 'Porto Alegre, RS': 4,
  'Belém, PA': 3, 'Goiânia, GO': 3, 'Campinas, SP': 3, 'São Luís, MA': 2,
  'Maceió, AL': 2, 'Natal, RN': 2, 'Campo Grande, MS': 2, 'Teresina, PI': 2,
  'João Pessoa, PB': 2, 'São José dos Campos, SP': 2, 'Ribeirão Preto, SP': 2,
};

function getTargetPerCity(city: string, totalRemaining: number, citiesRemaining: number): number {
  const weight = CITY_WEIGHT[city] || 1;
  const totalWeight = citiesRemaining > 0
    ? Object.values(CITY_WEIGHT).slice(0, citiesRemaining).reduce((a, b) => a + b, 0) + citiesRemaining
    : citiesRemaining;
  const baseTarget = Math.max(5, Math.ceil(totalRemaining / Math.max(1, citiesRemaining)));
  return Math.min(totalRemaining, Math.ceil(baseTarget * (weight / 2)));
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

  // Busca uma cidade com múltiplas variações de keyword + bairros
  // USA UM ÚNICO CONTEXTO DO PLAYWRIGHT — Google vê como UM usuário, não varios bots
  async function searchCity(
    ctx: any,
    city: string,
    cityTarget: number,
  ): Promise<number> {
    if (cityTarget <= 0) return 0;
    const before = leadsByName.size;

    // 1. Tenta a keyword principal primeiro
    const mainResult = await extractFromPlaywrightMaps(null, keyword, city, cityTarget, scrapedNames, 20, undefined, ctx);
    const mainAdded = processResults(mainResult.leads, `PW:${city.split(',')[0]}`);
    let foundFromCity = mainAdded;
    let wasBlocked = mainResult.blocked;

    // 2. Se não atingiu o target, tenta variações do nicho — MESMO CONTEXTO
    if (!wasBlocked && foundFromCity < cityTarget && !(await cancelled())) {
      const variations = getNicheVariations(keyword).filter(v => v.toLowerCase() !== keyword.toLowerCase());
      if (variations.length > 0) {
        const maxVars = Math.min(variations.length, 4);
        const varTarget = Math.ceil((cityTarget - foundFromCity) / maxVars);

        for (let vi = 0; vi < maxVars && !wasBlocked && foundFromCity < cityTarget && !(await cancelled()); vi++) {
          const kw = variations[vi];
          const vr = await extractFromPlaywrightMaps(
            null, kw, city,
            Math.min(varTarget, cityTarget - foundFromCity),
            scrapedNames, 12, undefined, ctx,
          ).catch(() => ({ leads: [] as SearchLead[], blocked: false }));
          if (vr.leads.length > 0) {
            const added = processResults(vr.leads, `PW:${city.split(',')[0]}/${kw.slice(0, 12)}`);
            foundFromCity += added;
          }
          wasBlocked = vr.blocked;
          await new Promise(r => setTimeout(r, 600 + Math.random() * 400));
        }
      }
    }

    // 3. Se ainda não atingiu e a cidade tem bairros, busca por bairro — MESMO CONTEXTO
    if (!wasBlocked && foundFromCity < cityTarget && !(await cancelled())) {
      const bairros = getCityBairros(city);
      if (bairros.length > 0) {
        const bairroTarget = Math.max(3, Math.ceil((cityTarget - foundFromCity) / bairros.length));
        const BATCH = 4;

        for (let bi = 0; bi < bairros.length && !wasBlocked && foundFromCity < cityTarget && !(await cancelled()); bi += BATCH) {
          const batch = bairros.slice(bi, bi + BATCH);

          for (const bairro of batch) {
            if (wasBlocked || foundFromCity >= cityTarget) break;
            const br = await extractFromPlaywrightMaps(
              null, keyword, `${bairro}, ${city}`,
              bairroTarget, scrapedNames, 8, undefined, ctx,
            ).catch(() => ({ leads: [] as SearchLead[], blocked: false }));
            if (br.leads.length > 0) {
              const added = processResults(br.leads, `PW:${city.split(',')[0]}/${bairro}`);
              foundFromCity += added;
            }
            wasBlocked = br.blocked;
            await new Promise(r => setTimeout(r, 400 + Math.random() * 300));
          }
        }
      }
    }

    return leadsByName.size - before;
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

    console.log(`[EXTRACT] Starting: "${keyword}" in "${location}" limit=${targetLimit} broad=${isBroadRegion}`);

    if (isBroadRegion) {
      notify(`Buscando "${keyword}" em todo o Brasil (${MAJOR_CITIES.length} cidades, variações de nicho + bairros)...`);

      // Rodada 1: HTTP (rápido, garante resultado mesmo se Playwright falhar)
      await runAllStrategies();
      notify(`${leadsByName.size}/${targetLimit} leads (fontes HTTP)`);

      // Rodada 2: Playwright com cidade × variação × bairro (aprofunda)
      // Só as top cidades (peso >= 2 em CITY_WEIGHT) — 20 cidades com maior população
      const TOP_CITIES = MAJOR_CITIES.filter(c => (CITY_WEIGHT as any)[c] >= 2 || MAJOR_CITIES.indexOf(c) < 20);
      const targetCities = TOP_CITIES.slice(0, 30);
      if (leadsByName.size < targetLimit && Date.now() < hardDeadline && !(await cancelled())) {
        notify(`Reforçando com navegador em ${targetCities.length} cidades...`);
        const { chromium } = require('playwright');
        const browser = await chromium.launch({
          headless: true,
          args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--single-process'],
        });
        try {
          for (let i = 0; i < targetCities.length && leadsByName.size < targetLimit && Date.now() < hardDeadline; i++) {
            if (await cancelled()) break;

            const city = targetCities[i];
            const citiesLeft = targetCities.length - i;
            const remainingForBatch = targetLimit - leadsByName.size;
            const cityTarget = getTargetPerCity(city, remainingForBatch, citiesLeft);

            notify(`${leadsByName.size}/${targetLimit} leads — cidade ${i + 1}/${targetCities.length}: ${city.split(',')[0]}`);

            // Cria UM contexto por cidade, reusa pra keyword + variações + bairros
            const ctx = await browser.newContext({
              userAgent: getRandomUserAgent(),
              viewport: getRandomViewport(),
              locale: 'pt-BR',
              timezoneId: getRandomTimezone(),
              geolocation: getRandomGeolocation(),
              permissions: ['geolocation'],
            });
            await ctx.addInitScript(() => {
              Object.defineProperty(navigator, 'webdriver', { get: () => false });
              Object.defineProperty(navigator, 'languages', { get: () => ['pt-BR', 'pt', 'en'] });
              Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
            });
            await ctx.route('**/*.{png,jpg,jpeg,gif,svg,woff,woff2,ttf,eot}', (route: any) => route.fulfill({ status: 204, body: '' }));
            await ctx.route('**/maps/vt**', (route: any) => route.fulfill({ status: 204, body: '' }));
            await ctx.addCookies([{ name: 'CONSENT', value: 'YES+', domain: '.google.com', path: '/' }]);

            try {
              const added = await searchCity(ctx, city, cityTarget);
              if (added > 0) citiesDone++;
            } finally {
              await ctx.close().catch(() => {});
            }

            notify(`${leadsByName.size}/${targetLimit} leads (${i + 1}/${targetCities.length} cidades)`);
            await new Promise(r => setTimeout(r, 1000 + Math.random() * 1000));
          }
        } finally {
          await browser.close().catch(() => {});
        }
      }

      // Rodada 3: HTTP round 2 (coleta o que sobrou)
      if (leadsByName.size < targetLimit && Date.now() < hardDeadline && !(await cancelled())) {
        notify(`Rodada final de refinamento...`);
        await runAllStrategies();
        notify(`${leadsByName.size}/${targetLimit} leads (após rodada final)`);
      }
    } else {
      notify(`Buscando ${targetLimit} leads em ${location} com variações de nicho...`);

      // Tenta HTTP primeiro (rápido, pode complementar)
      await runAllStrategies();
      notify(`${leadsByName.size}/${targetLimit} leads (fontes HTTP)`);

      // Playwright com variações + bairros se precisar
      if (leadsByName.size < targetLimit && Date.now() < hardDeadline && !(await cancelled())) {
        notify(`Reforçando com navegador + variações...`);
        try {
          const { chromium } = require('playwright');
          const pwBrowser = await chromium.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--single-process'],
          });
          try {
            const ctx = await pwBrowser.newContext({
              userAgent: getRandomUserAgent(),
              viewport: getRandomViewport(),
              locale: 'pt-BR',
              timezoneId: getRandomTimezone(),
              geolocation: getRandomGeolocation(),
              permissions: ['geolocation'],
            });
            await ctx.addInitScript(() => {
              Object.defineProperty(navigator, 'webdriver', { get: () => false });
              Object.defineProperty(navigator, 'languages', { get: () => ['pt-BR', 'pt', 'en'] });
              Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
            });
            await ctx.route('**/*.{png,jpg,jpeg,gif,svg,woff,woff2,ttf,eot}', (route: any) => route.fulfill({ status: 204, body: '' }));
            await ctx.route('**/maps/vt**', (route: any) => route.fulfill({ status: 204, body: '' }));
            await ctx.addCookies([{ name: 'CONSENT', value: 'YES+', domain: '.google.com', path: '/' }]);
            try {
              await searchCity(ctx, location, targetLimit - leadsByName.size);
            } finally {
              await ctx.close().catch(() => {});
            }
          } finally {
            await pwBrowser.close().catch(() => {});
          }
        } catch (e: any) {
          console.warn(`[EXTRACT] Playwright failed (non-critical):`, e?.message || e);
        }
      }

      // Último recurso: HTTP round 2
      if (leadsByName.size < targetLimit && Date.now() < hardDeadline && !(await cancelled())) {
        notify(`Rodada final de refinamento...`);
        await runAllStrategies();
        notify(`${leadsByName.size}/${targetLimit} leads (após rodada final)`);
      }
    }

    const finalCount = leadsByName.size;
    if (finalCount >= Math.max(3, Math.min(targetLimit, 5))) {
      const leadsToCache = getLeadsArray().filter(l => scoreLeadQuality(l).tier !== 'trash');
      if (leadsToCache.length > 0) {
        setCachedQuery(cacheKey, leadsToCache);
      }
    }

    notify(`${leadsByName.size} leads encontrados em ${elapsed()}s`);
    return finalize(getLeadsArray());

  } catch (err: any) {
    console.error('[EXTRACT] Fatal error:', err);
    if (finalized) return getLeadsArray().slice(0, targetLimit);
    return finalize(getLeadsArray(), `Erro na extração: ${err?.message || 'Erro inesperado'}`);
  }
}
