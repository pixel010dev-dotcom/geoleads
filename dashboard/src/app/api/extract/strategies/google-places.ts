// Google Places API (New) — Motor de Extração Turbo
// Paralelo, auto-descoberta de keywords, delay adaptativo
// Nível Apify+ :speed:

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
  isMobile: boolean;
}

// FieldMask otimizada — só o essencial
const FIELD_MASK = [
  'places.id', 'places.displayName', 'places.formattedAddress',
  'places.internationalPhoneNumber', 'places.nationalPhoneNumber',
  'places.websiteUri', 'places.googleMapsUri', 'places.rating',
  'places.userRatingCount', 'places.primaryTypeDisplayName',
  'places.types', 'places.businessStatus',
].join(',');

function isMobilePhone(phone: string): boolean {
  const digits = phone.replace(/\D/g, '');
  const local = digits.startsWith('55') ? digits.slice(2) : digits;
  if (local.length === 11 && local.startsWith('9')) return true;
  if (local.length === 10) return false;
  if (local.length > 11) return true;
  return false;
}

/** Busca UMA página da API */
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

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(PLACES_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': FIELD_MASK,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (response.status === 429) {
      // Rate limit — retorna sinal pra esperar mais
      console.warn('[Places] 429 rate limited');
      return null;
    }

    if (!response.ok) {
      const err = await response.text().catch(() => '');
      console.error(`[Places] HTTP ${response.status}: ${err.slice(0, 200)}`);
      return null;
    }

    const data = await response.json();
    return {
      places: data.places || [],
      nextPageToken: data.nextPageToken,
    };
  } catch (err: any) {
    if (err?.name === 'AbortError') return null;
    console.error(`[Places] Error:`, err?.message || err);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/** Paginação turbo de UMA query — delay adaptativo (só em 429) */
async function fetchQueryPages(
  apiKey: string,
  query: string,
  targetLimit: number,
  seenIds: Set<string>,
  results: PlacesApiResult[],
): Promise<void> {
  let pageToken: string | undefined;
  let pageCount = 0;
  let emptyPages = 0;
  const MAX_PAGES = Math.min(30, Math.ceil(targetLimit / 10) + 5);

  while (results.length < targetLimit && pageCount < MAX_PAGES) {
    pageCount++;

    const fetched = await fetchPage(apiKey, query, pageToken);
    if (!fetched) {
      // Erro de rede ou 429 → espera adaptativa e tenta de novo
      await new Promise(r => setTimeout(r, 500 + Math.random() * 500));
      const retry = await fetchPage(apiKey, query, pageToken);
      if (!retry) break;
      pageToken = retry.nextPageToken;
      continue;
    }

    let added = 0;
    for (const place of fetched.places) {
      if (seenIds.has(place.id)) continue;
      seenIds.add(place.id);

      const phone = place.internationalPhoneNumber || place.nationalPhoneNumber || '';
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

    // 3 páginas vazias seguidas = acabou pra essa query (1 extra pra garantir)
    if (emptyPages >= 3) break;

    pageToken = fetched.nextPageToken;
    if (!pageToken || results.length >= targetLimit || pageCount >= MAX_PAGES) break;

    // Delay adaptativo: mínimo entre páginas (sem delay fixo de 2s!)
    if (pageCount % 3 === 0) {
      await new Promise(r => setTimeout(r, 300));
    }
  }
}

/** Extrai tipos/categorias da primeira página pra gerar keywords relacionadas */
function extractRelatedTypes(places: any[]): string[] {
  const types = new Set<string>();
  const skip = new Set([
    'establishment', 'point_of_interest', 'place', 'premise',
    'neighborhood', 'locality', 'administrative_area_level_1',
    'administrative_area_level_2', 'country', 'political',
    'route', 'street_address', 'street_number', 'postal_code',
  ]);

  for (const place of places) {
    // primaryTypeDisplayName é o nome legível
    if (place.primaryTypeDisplayName?.text) {
      const name = place.primaryTypeDisplayName.text.toLowerCase().trim();
      if (!skip.has(name) && name.length > 3) types.add(name);
    }
    // types[] são os IDs técnicos do Google
    if (Array.isArray(place.types)) {
      for (const t of place.types) {
        const cleaned = t.replace(/_/g, ' ').toLowerCase().trim();
        if (!skip.has(cleaned) && cleaned.length > 3) types.add(cleaned);
      }
    }
  }

  return Array.from(types).slice(0, 12); // max 12 variações
}

/** Gera queries expandidas a partir da keyword original + tipos descobertos */
function generateExpandedQueries(keyword: string, location: string, relatedTypes: string[]): string[] {
  const queries = new Set<string>();

  // A original SEMPRE vai primeiro
  queries.add(`${keyword} ${location}`);

  // Só a keyword
  queries.add(keyword);

  // Tipos descobertos com localização
  for (const type of relatedTypes) {
    queries.add(`${type} ${location}`);
    // Variação sem local também
    if (type !== keyword.toLowerCase()) {
      queries.add(type);
    }
  }

  // Variações com "melhor" se fizer sentido
  if (!keyword.toLowerCase().includes('melhor') && keyword.split(' ').length <= 3) {
    queries.add(`melhor ${keyword} ${location}`);
  }

  return Array.from(queries).slice(0, 15); // cap pra evitar excesso
}

/**
 * Extração TURBO: descobre, expande, executa em paralelo
 * - Primeira página revela tipos → gera keywords relacionadas
 * - Todas as queries rodam em PARALELO com pool controlado
 * - Delay adaptativo: só espera se tomar 429
 * - Dedup global por placeId
 */
export async function extractFromGooglePlaces(
  keyword: string,
  location: string,
  targetLimit: number,
): Promise<PlacesApiResult[]> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    console.error('[Places] GOOGLE_PLACES_API_KEY não configurada!');
    return [];
  }

  // ===== FASE 1: DESCOBERTA (1 página rápida) =====
  const discoveryResult = await fetchPage(apiKey, `${keyword} ${location}`);
  const relatedTypes = discoveryResult?.places
    ? extractRelatedTypes(discoveryResult.places)
    : [];

  console.log(`[Places] Descoberta: ${relatedTypes.length} variações relacionadas`);

  // ===== FASE 2: EXPANDIR QUERIES =====
  const queries = generateExpandedQueries(keyword, location, relatedTypes);
  console.log(`[Places] ${queries.length} queries: [${queries.slice(0, 5).join(', ')}${queries.length > 5 ? '...' : ''}]`);

  // ===== FASE 3: EXECUÇÃO PARALELA =====
  const results: PlacesApiResult[] = [];
  const seenIds = new Set<string>();

  // Já temos os resultados da descoberta — reaproveita!
  if (discoveryResult?.places) {
    for (const place of discoveryResult.places) {
      if (seenIds.has(place.id)) continue;
      seenIds.add(place.id);
      const phone = place.internationalPhoneNumber || place.nationalPhoneNumber || '';
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
    }
  }

  // Se não tem tipos pra expandir, executa as queries manuais em paralelo
  const targetResults = results.length;
  if (targetResults >= targetLimit) return results.slice(0, targetLimit);

  // Pool de concorrência: max 4 queries simultâneas
  const CONCURRENCY = 4;
  const queryChunks: string[][] = [];
  for (let i = 0; i < queries.length; i += CONCURRENCY) {
    queryChunks.push(queries.slice(i, i + CONCURRENCY));
  }

  let queriesDone = 0;
  for (const chunk of queryChunks) {
    if (results.length >= targetLimit) break;

    await Promise.all(
      chunk.map(async (query) => {
        if (results.length >= targetLimit) return;
        await fetchQueryPages(apiKey, query, targetLimit, seenIds, results);
        queriesDone++;
      })
    );

    console.log(`[Places] ${Math.min(results.length, targetLimit)}/${targetLimit} leads (${queriesDone}/${queries.length} queries)`);
  }

  return results.slice(0, targetLimit);
}
