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
}

// FieldMask otimizada — pega TUDO que precisamos
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
  'places.currentOpeningHours',
  'places.regularOpeningHours',
].join(',');

/**
 * Extração máxima de leads via Google Places API (New)
 * Returns: array de leads com dados completos
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
  let pageToken: string | undefined;
  let pageCount = 0;
  const MAX_PAGES = 3; // Máximo 3 páginas = até 60 resultados

  const textQuery = `${keyword} ${location}`;

  while (results.length < targetLimit && pageCount < MAX_PAGES) {
    pageCount++;

    const body: Record<string, unknown> = {
      textQuery,
      pageSize: Math.min(20, targetLimit * 2), // Pega mais pra ter margem
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
        break;
      }

      const data = await response.json();
      const places: any[] = data.places || [];

      for (const place of places) {
        if (seenIds.has(place.id)) continue;
        seenIds.add(place.id);

        // Pega telefone:优先 international, fallback national
        const phone = place.internationalPhoneNumber
          || place.nationalPhoneNumber
          || '';

        // Pega horários
        const hours = place.currentOpeningHours || place.regularOpeningHours;
        const horarios = hours?.weekdayDescriptions?.join('; ') || '';

        // Business status check
        const isOpen = place.businessStatus !== 'CLOSED_PERMANENTLY';

        if (!isOpen) continue; // Pula fechados permanentemente

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
        });
      }

      // Paginação
      pageToken = data.nextPageToken;
      if (pageToken && results.length < targetLimit && pageCount < MAX_PAGES) {
        await new Promise(r => setTimeout(r, 2000)); // Delay obrigatório
      } else {
        break;
      }

    } catch (err: any) {
      console.error(`[Places API] Erro:`, err?.message || err);
      break;
    }
  }

  console.log(`[Places API] ${results.length} leads em ${pageCount} páginas para "${textQuery}"`);
  return results.slice(0, targetLimit);
}
