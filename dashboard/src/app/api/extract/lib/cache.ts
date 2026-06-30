import type { EnrichmentData } from './types';

const queryCache = new Map<string, { leads: any[]; timestamp: number }>();
const CACHE_TTL = 24 * 60 * 60 * 1000;
const ENRICH_CACHE_TTL = 24 * 60 * 60 * 1000;
const enrichCache = new Map<string, EnrichmentData & { timestamp: number }>();
const MAX_QUERY_CACHE_SIZE = 200;

export function getCachedQuery(key: string): any[] | null {
  const cached = queryCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) return cached.leads;
  return null;
}

export function setCachedQuery(key: string, leads: any[]) {
  queryCache.set(key, { leads, timestamp: Date.now() });
  if (queryCache.size > MAX_QUERY_CACHE_SIZE) {
    const firstKey = queryCache.keys().next().value;
    if (firstKey !== undefined) queryCache.delete(firstKey);
  }
}

export function generateQueryCacheKey(keyword: string, location: string): string {
  return `${keyword.toLowerCase()}|${location.toLowerCase()}`;
}

export function getCacheSize(): number {
  return queryCache.size;
}

export function clearExpiredCache() {
  const now = Date.now();
  for (const [key, value] of queryCache) {
    if (now - value.timestamp >= CACHE_TTL) queryCache.delete(key);
  }
  for (const [key, value] of enrichCache) {
    if (now - value.timestamp >= ENRICH_CACHE_TTL) enrichCache.delete(key);
  }
}

export function getEnrichCache(domain: string): EnrichmentData | undefined {
  const cached = enrichCache.get(domain);
  if (cached && Date.now() - cached.timestamp < ENRICH_CACHE_TTL) {
    const { ...data } = cached;
    return data as EnrichmentData;
  }
  return undefined;
}

export function setEnrichCache(domain: string, data: EnrichmentData) {
  enrichCache.set(domain, { ...data, timestamp: Date.now() });
}

const CLEANUP_INTERVAL_MS = 10 * 60 * 1000;
function startCleanupTimer() {
  if (typeof globalThis !== 'undefined' && !(globalThis as any).__geoleadsCacheCleanupSet) {
    (globalThis as any).__geoleadsCacheCleanupSet = true;
    setInterval(clearExpiredCache, CLEANUP_INTERVAL_MS);
  }
}

startCleanupTimer();
