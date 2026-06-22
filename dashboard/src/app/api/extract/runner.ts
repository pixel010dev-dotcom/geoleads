import type { SearchLead } from './lib/types';
import { scoreLeadQuality } from './lib/types';
import { extractFromGoogleSearch } from './strategies/google-search';
import { extractFromBingMaps } from './strategies/bing-maps';
import { extractFromOpenStreetMap } from './strategies/alternative-sources';
import { extractFromDuckDuckGo } from './strategies/duckduckgo';

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
  } = config;

  const GLOBAL_TIMEOUT = 30000;
  const startTime = Date.now();
  const leadsByName = new Map<string, SearchLead>();
  const scrapedNames = new Set<string>(existingLeadKeys.map(k => k.split('|')[0]).filter(Boolean));
  const scrapedPhones = new Set<string>(existingLeadKeys.map(k => k.split('|')[1]).filter(Boolean));
  let scannedTotal = 0;
  let citiesDone = 0;
  let blockedDetected = false;

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

  const finalize = (leads: SearchLead[], error?: string) => {
    const validLeads = leads
      .map(l => ({ lead: l, score: scoreLeadQuality(l) }))
      .filter(s => s.score.tier !== 'trash')
      .map(s => s.lead)
      .filter(l => postFilter(l, filterRule))
      .slice(0, targetLimit);

    console.log(`[EXTRACT] Finalizing: ${validLeads.length} valid leads from ${scannedTotal} scanned in ${elapsed()}s`);

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
    const existingForFetch = new Set<string>(Array.from(scrapedNames));
    const cfWorkerUrl = process.env.CF_WORKER_URL || '';

    console.log(`[EXTRACT] Starting: "${keyword}" in "${location}" limit=${targetLimit}`);

    // Phase 1: Parallel fetch with GLOBAL timeout
    notify('Buscando leads...');

    const fetchWithTimeout = (name: string, fn: () => Promise<SearchLead[]>, timeoutMs: number) =>
      Promise.race([
        fn().then(leads => {
          console.log(`[EXTRACT] ${name}: ${leads.length} leads in ${elapsed()}s`);
          return leads;
        }),
        new Promise<SearchLead[]>((_, reject) => setTimeout(() => {
          console.log(`[EXTRACT] ${name}: TIMEOUT after ${timeoutMs}ms`);
          reject(new Error('timeout'));
        }, timeoutMs)),
      ]).catch(() => {
        console.log(`[EXTRACT] ${name}: FAILED`);
        return [] as SearchLead[];
      });

    const fetchResults = await Promise.all([
      fetchWithTimeout('OSM', () => extractFromOpenStreetMap(keyword, location, targetLimit, existingForFetch), 15000),
      fetchWithTimeout('Google', () => extractFromGoogleSearch(keyword, location, targetLimit, existingForFetch, cfWorkerUrl ? { cfWorkerUrl } : undefined).then(r => {
        if (r.blocked) blockedDetected = true;
        return r.leads;
      }), 15000),
      fetchWithTimeout('Bing', () => extractFromBingMaps(keyword, location, targetLimit, existingForFetch), 10000),
      fetchWithTimeout('DuckDuckGo', () => extractFromDuckDuckGo(keyword, location, targetLimit, existingForFetch), 10000),
    ]);

    // Global timeout guard
    if (elapsed() > 25) {
      console.log(`[EXTRACT] WARNING: Phase 1 took ${elapsed()}s, returning what we have`);
    }

    for (const leads of fetchResults) {
      const added = processResults(leads, 'fetch');
      if (added > 0) citiesDone++;
    }

    console.log(`[EXTRACT] Phase 1 done: ${leadsByName.size} leads in ${elapsed()}s`);

    notify(`${leadsByName.size} leads encontrados (${elapsed()}s)`);

    return finalize(getLeadsArray());

  } catch (err: any) {
    console.error('[EXTRACT] Fatal error:', err);
    return finalize(getLeadsArray(), `Erro na extração: ${err?.message || 'Erro inesperado'}`);
  }
}
