import type { SearchLead } from '../lib/types';
import { createEmptySearchLead } from '../lib/types';
import { normalizePhone } from '../lib/validation';

const PLACES_API_BASE = 'https://places.googleapis.com/v1';

interface PlacesApiConfig {
  apiKey: string;
  targetLimit: number;
  keyword: string;
  location: string;
}

export async function extractFromGooglePlacesApi(
  keyword: string,
  location: string,
  targetLimit: number,
  existingKeys: Set<string>
): Promise<SearchLead[]> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY || '';
  if (!apiKey) return [];

  const leads: SearchLead[] = [];
  const seenNames = new Set<string>(Array.from(existingKeys).map(k => k.toLowerCase()));
  const seenPlaceIds = new Set<string>();

  const maxResultsPerPage = Math.min(targetLimit, 20);
  const textQuery = `${keyword} ${location}`;
  let nextPageToken: string | undefined;

  for (let page = 0; page < 3; page++) {
    if (leads.length >= targetLimit) break;

    try {
      const body: any = {
        textQuery,
        maxResultCount: maxResultsPerPage,
        languageCode: 'pt-BR',
        regionCode: 'BR',
      };
      if (nextPageToken) body.pageToken = nextPageToken;

      const res = await fetch(`${PLACES_API_BASE}/places:searchText`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.internationalPhoneNumber,places.websiteUri,places.rating,places.userRatingCount,places.regularOpeningHours,places.googleMapsUri,places.businessStatus,places.socialMedia,places.primaryType,places.primaryTypeDisplayName',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15000),
      });

      if (!res.ok) {
        if (res.status === 429) break;
        continue;
      }

      const data = await res.json();
      const places = data.places || [];

      for (const place of places) {
        if (leads.length >= targetLimit) break;
        if (seenPlaceIds.has(place.id)) continue;
        seenPlaceIds.add(place.id);

        const name = place.displayName?.text || '';
        if (!name || seenNames.has(name.toLowerCase())) continue;
        seenNames.add(name.toLowerCase());

        if (place.businessStatus === 'CLOSED_PERMANENTLY') continue;

        const lead = createEmptySearchLead();
        lead.nome = name;
        lead.endereco = place.formattedAddress || '';
        if (place.internationalPhoneNumber) {
          lead.telefone = normalizePhone(place.internationalPhoneNumber);
        }
        if (place.websiteUri) {
          lead.site = place.websiteUri;
        }
        if (place.rating) {
          lead.avaliacao = String(place.rating);
          lead.reviewCount = String(place.userRatingCount || '');
        }
        if (place.regularOpeningHours?.weekdayDescriptions) {
          lead.horarios = place.regularOpeningHours.weekdayDescriptions.join('; ');
        }
        if (place.primaryTypeDisplayName?.text) {
          lead.categoria = place.primaryTypeDisplayName.text;
        }
        if (place.primaryType) {
          if (!lead.categoria) lead.categoria = place.primaryType;
        }
        if (place.googleMapsUri) {
          lead.placeUrl = place.googleMapsUri;
        }

        const social = place.socialMedia || {};
        if (social.instagram) lead.instagram = `https://instagram.com/${social.instagram}`;
        if (social.facebook) lead.facebook = `https://facebook.com/${social.facebook}`;

        leads.push(lead);
      }

      nextPageToken = data.nextPageToken;
      if (!nextPageToken) break;

      await new Promise(r => setTimeout(r, 500));
    } catch {
      break;
    }
  }

  return leads;
}
