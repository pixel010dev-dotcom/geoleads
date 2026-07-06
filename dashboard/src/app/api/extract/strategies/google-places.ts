// Google Places API (New) — extração rápida, confiável, sem scraping
// API Key SERVER-SIDE apenas. NUNCA prefixar com NEXT_PUBLIC_.
// Documentação: https://developers.google.com/maps/documentation/places/web-service/overview

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

/**
 * Busca lugares no Google Places API (New) por texto.
 * Retorna leads estruturados com nome, telefone, site, avaliação, endereço.
 *
 * @param keyword - Nicho de negócio (ex: "padarias", "dentistas")
 * @param location - Cidade/região (ex: "Foz do Iguaçu, PR")
 * @param targetLimit - Máximo de resultados desejados
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
  let pageToken: string | undefined;

  const textQuery = `${keyword} ${location}`;

  // FieldMask mínimo — só o que precisamos (reduz latência e custo)
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

  while (results.length < targetLimit) {
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
        console.error(`[Places API] Erro HTTP ${response.status}: ${errorText.slice(0, 300)}`);
        break; // Não insiste — se falhar, entrega o que já coletou
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

      // Se tem mais páginas, delay de ~2s (obrigatório — API processa nextPageToken async)
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

  console.log(`[Places API] Extraídos ${results.length} resultados para "${textQuery}"`);
  return results.slice(0, targetLimit);
}