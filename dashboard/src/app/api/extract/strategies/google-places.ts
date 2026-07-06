// Google Places API (New) — extração rápida, confiável, sem scraping
// API Key SERVER-SIDE apenas. NUNCA prefixar com NEXT_PUBLIC_.

const PLACES_API_URL = 'https://places.googleapis.com/v1/places:searchText';

export interface PlacesApiResult {
  nome: string;
  telefone: string;
  endereco: string;
  site?: string;
  avaliacao: string;
  reviewCount: number;
  categoria: string;
  placeId: string;
  placeUrl: string;
}

// Expande termos genéricos pra queries mais específicas
const KEYWORD_EXPANSIONS: Record<string, string[]> = {
  'clínica': ['clínica odontológica', 'clínica médica', 'clínica dermatológica'],
  'salão': ['salão de beleza', 'salão de estética'],
  'oficina': ['oficina mecânica', 'oficina de bicicleta'],
  'loja': ['loja de roupas', 'loja de materiais'],
  'academia': ['academia', 'crossfit', 'studio de pilates'],
  'restaurante': ['restaurante', 'restaurante self-service'],
  'pet': ['petshop', 'pet shop', 'veterinária'],
  'hotel': ['hotel', 'pousada'],
  'escola': ['escola', 'colégio', 'curso'],
};

function expandKeyword(keyword: string): string[] {
  const lower = keyword.toLowerCase().trim();
  const expansions = KEYWORD_EXPANSIONS[lower];
  if (expansions) return expansions;
  return [keyword];
}

/**
 * Busca lugares no Google Places API (New) por texto.
 */
export async function extractFromGooglePlaces(
  keyword: string,
  location: string,
  targetLimit: number,
): Promise<PlacesApiResult[]> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    console.warn('[Places API] GOOGLE_PLACES_API_KEY não configurada — pulando');
    return [];
  }

  const results: PlacesApiResult[] = [];
  const seenIds = new Set<string>();

  // Expande keyword genérica pra queries mais específicas
  const keywords = expandKeyword(keyword);

  const FIELD_MASK = [
    'places.id',
    'places.displayName',
    'places.formattedAddress',
    'places.internationalPhoneNumber',
    'places.websiteUri',
    'places.rating',
    'places.userRatingCount',
    'places.primaryTypeDisplayName',
    'places.googleMapsUri',
  ].join(',');

  for (const kw of keywords) {
    if (results.length >= targetLimit) break;

    const textQuery = `${kw} ${location}`;
    let pageToken: string | undefined;
    let attempts = 0;

    while (results.length < targetLimit && attempts < 3) {
      attempts++;
      const body: Record<string, unknown> = {
        textQuery,
        pageSize: Math.min(20, targetLimit - results.length),
      };
      if (pageToken) body.pageToken = pageToken;

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': FIELD_MASK,
      };

      try {
        const response = await fetch(PLACES_API_URL, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(10000),
        });

        if (!response.ok) {
          const errorText = await response.text().catch(() => '');
          console.error(`[Places API] Erro HTTP ${response.status}: ${errorText.slice(0, 200)}`);
          break;
        }

        const data = await response.json();
        const places: any[] = data.places || [];

        for (const place of places) {
          if (seenIds.has(place.id)) continue;
          seenIds.add(place.id);

          results.push({
            nome: place.displayName?.text || '',
            telefone: place.internationalPhoneNumber || 'Não informado',
            endereco: place.formattedAddress || '',
            site: place.websiteUri || undefined,
            avaliacao: place.rating ? String(place.rating) : 'N/A',
            reviewCount: place.userRatingCount || 0,
            categoria: place.primaryTypeDisplayName?.text || '',
            placeId: place.id,
            placeUrl: place.googleMapsUri || '',
          });
        }

        pageToken = data.nextPageToken;
        if (pageToken && results.length < targetLimit) {
          await new Promise(resolve => setTimeout(resolve, 2500));
        } else {
          break;
        }
      } catch (err: any) {
        console.error('[Places API] Erro de rede:', err?.message || err);
        break;
      }
    }

    // Delay entre keywords
    if (keywords.length > 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  console.log(`[Places API] Extraídos ${results.length} resultados para "${keyword} ${location}"`);
  return results.slice(0, targetLimit);
}
