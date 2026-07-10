// Google Places API (New) — Extração primária de leads
// Otimizada para MÁXIMA performance e dados completos

const PLACES_API_URL = 'https://places.googleapis.com/v1/places:searchText';

export interface PlacesApiResult {
  nome: string;
  telefone: string;
  endereco: string;
  site: string;
  avaliacao: string;
  reviewCount: number;
  categoria: string;
  placeId: string;
  placeUrl: string;
  isMobile: boolean; // true = celular (WhatsApp funciona)
}

// FieldMask otimizada
const FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.internationalPhoneNumber',
  'places.nationalPhoneNumber',
  'places.websiteUri',
  'places.googleMapsUri',
  'places.rating',
  'places.userRatingCount',
  'places.primaryTypeDisplayName',
  'places.types',
  'places.businessStatus',
].join(',');

/**
 * Detecta se telefone é celular (9 dígitos após DDD)
 * Formato BR: +55 (XX) 9XXXX-XXXX = celular
 * Formato BR: +55 (XX) XXXX-XXXX = fixo
 */
function isMobilePhone(phone: string): boolean {
  const digits = phone.replace(/\D/g, '');
  const local = digits.startsWith('55') ? digits.slice(2) : digits;
  if (local.length === 11 && local.startsWith('9')) return true;
  if (local.length === 10) return false;
  if (local.length > 11) return true;
  return false;
}

/** Gera variações de busca pra maximizar resultados */
function generateQueries(keyword: string, location: string): string[] {
  const queries: string[] = [];

  // 1. Original
  queries.push(`${keyword} ${location}`);

  // 2. Só a keyword (Google aplica geo-localização automática)
  queries.push(keyword);

  // 3. Com "melhor" — costuma trazer resultados diferentes
  if (!keyword.toLowerCase().includes('melhor')) {
    queries.push(`melhor ${keyword} ${location}`);
  }

  // 4. Sem location — busca ampla
  if (keyword.split(' ').length <= 2) {
    queries.push(keyword);
  }

  return queries;
}

/** Busca uma página da API do Google Places */
async function fetchPage(
  apiKey: string,
  textQuery: string,
  pageToken?: string,
): Promise<{ places: any[]; nextPageToken?: string } | null> {
  const body: Record<string, unknown> = {
    textQuery,
    maxResultCount: 20,
  };
  if (pageToken) body.pageToken = pageToken;

  try {
    const response = await fetch(PLACES_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': FIELD_MASK,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      const err = await response.text().catch(() => '');
      console.error(`[Places API] HTTP ${response.status}: ${err.slice(0, 200)}`);
      return null;
    }

    const data = await response.json();
    return {
      places: data.places || [],
      nextPageToken: data.nextPageToken,
    };
  } catch (err: any) {
    console.error(`[Places API] Network error:`, err?.message || err);
    return null;
  }
}

/**
 * Extração máxima de leads via Google Places API (New)
 * Tenta múltiplas queries se a primeira não atingir o target
 */
export async function extractFromGooglePlaces(
  keyword: string,
  location: string,
  targetLimit: number,
): Promise<PlacesApiResult[]> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    console.error('[Places API] GOOGLE_PLACES_API_KEY não configurada!');
    return [];
  }

  const results: PlacesApiResult[] = [];
  const seenIds = new Set<string>();
  const queries = generateQueries(keyword, location);
  const MAX_PAGES = Math.ceil(targetLimit / 20) + 2;
  let usedQueries = 0;

  for (const query of queries) {
    if (results.length >= targetLimit) break;
    usedQueries++;
    let pageToken: string | undefined;
    let pageCount = 0;
    let emptyPages = 0;

    while (results.length < targetLimit && pageCount < MAX_PAGES) {
      pageCount++;

      const fetched = await fetchPage(apiKey, query, pageToken);
      if (!fetched) {
        // Falha na página: espera um pouco e tenta de novo
        if (pageCount > 1) break;
        await new Promise(r => setTimeout(r, 1000));
        const retry = await fetchPage(apiKey, query, pageToken);
        if (!retry) break;
        pageToken = retry.nextPageToken;
        continue;
      }

      let added = 0;
      for (const place of fetched.places) {
        if (seenIds.has(place.id)) continue;
        seenIds.add(place.id);

        const phone = place.internationalPhoneNumber
          || place.nationalPhoneNumber
          || '';

        const isOpen = place.businessStatus !== 'CLOSED_PERMANENTLY';
        if (!isOpen) continue;

        results.push({
          nome: place.displayName?.text || '',
          telefone: phone || 'Não informado',
          endereco: place.formattedAddress || '',
          site: place.websiteUri || '',
          avaliacao: place.rating ? String(place.rating) : 'N/A',
          reviewCount: place.userRatingCount || 0,
          categoria: place.primaryTypeDisplayName?.text || place.types?.[0] || '',
          placeId: place.id,
          placeUrl: place.googleMapsUri || '',
          isMobile: isMobilePhone(phone),
        });
        added++;
      }

      if (added === 0) emptyPages++;
      else emptyPages = 0;

      // 2 páginas consecutivas sem novos leads = acabou pra essa query
      if (emptyPages >= 2) break;

      pageToken = fetched.nextPageToken;
      if (pageToken && results.length < targetLimit && pageCount < MAX_PAGES) {
        await new Promise(r => setTimeout(r, 2000));
      } else {
        break;
      }
    }
  }

  const stats = {
    results: results.length,
    target: targetLimit,
    queriesUsed: usedQueries,
    totalPages: 'multi',
  };
  console.log(`[Places API] ${results.length}/${targetLimit} leads (${usedQueries} quer${usedQueries === 1 ? 'y' : 'ies'})`);
  return results.slice(0, targetLimit);
}
