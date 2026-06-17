import type { SearchLead } from '../lib/types';
import { createEmptySearchLead } from '../lib/types';
import { normalizePhone, isBusinessWebsiteCandidate } from '../lib/validation';
import { getRandomHeaders } from '../lib/stealth';

function parseLdJsonFromSearch(html: string, pageUrl: string): SearchLead[] {
  const leads: SearchLead[] = [];
  const ldJsonRegex = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;

  while ((match = ldJsonRegex.exec(html)) !== null) {
    try {
      const jsonStr = match[1].trim();
      const data = JSON.parse(jsonStr);
      const items = Array.isArray(data) ? data : [data];

      for (const item of items) {
        const types = Array.isArray(item['@type']) ? item['@type'] : [item['@type']];
        const isBusiness = types.some((t: string) =>
          t && typeof t === 'string' && (
            t.includes('LocalBusiness') || t.includes('Organization') ||
            t.includes('Store') || t.includes('Restaurant') ||
            t.includes('Dentist') || t.includes('Physician') ||
            t.includes('HealthClub') || t.includes('SportsActivityLocation') ||
            t.includes('Hotel') || t.includes('LodgingBusiness') ||
            t.includes('AutomotiveBusiness') || t.includes('EntertainmentBusiness') ||
            t.includes('FoodEstablishment') || t.includes('MedicalBusiness') ||
            t.includes('ProfessionalService') || t.includes('HomeAndConstructionBusiness')
          )
        );
        if (!isBusiness && !item.name) continue;

        const lead = createEmptySearchLead();

        if (item.name && typeof item.name === 'string' && item.name.length > 1 && item.name.length < 200) {
          lead.nome = item.name.trim();
        }
        if (item.telephone) {
          lead.telefone = normalizePhone(String(item.telephone));
        }
        if (item.url && typeof item.url === 'string' && isBusinessWebsiteCandidate(item.url)) {
          lead.site = item.url;
        }
        if (item.address) {
          const addr = typeof item.address === 'string' ? item.address :
            [item.address.streetAddress, item.address.addressLocality, item.address.addressRegion, item.address.postalCode]
              .filter(Boolean).join(', ');
          if (addr) lead.endereco = addr;
        }
        if (item.aggregateRating) {
          lead.avaliacao = String(item.aggregateRating.ratingValue || 'N/A');
          lead.reviewCount = String(item.aggregateRating.reviewCount || '');
        }
        if (item.description) {
          lead.categoria = String(item.description).slice(0, 100);
        }
        if (item.openingHours) {
          lead.horarios = Array.isArray(item.openingHours) ? item.openingHours.join('; ') : String(item.openingHours);
        }
        if (item.sameAs && Array.isArray(item.sameAs)) {
          for (const url of item.sameAs) {
            if (url.includes('instagram.com') && !lead.instagram) lead.instagram = url;
            if (url.includes('facebook.com') && !lead.facebook) lead.facebook = url;
            if (url.includes('tiktok.com') && !lead.tiktok) lead.tiktok = url;
          }
        }
        if (lead.nome) leads.push(lead);
      }
    } catch {}
  }
  return leads;
}

export async function extractFromGoogleSearch(
  keyword: string,
  location: string,
  targetLimit: number,
  existingKeys: Set<string>,
  signal?: AbortSignal
): Promise<SearchLead[]> {
  const allLeads: SearchLead[] = [];
  const seenNames = new Set<string>();

  const queryFormats = [
    `${keyword} ${location}`,
    `${keyword} em ${location}`,
    `${keyword}, ${location}`,
    `${keyword} na região de ${location}`,
    `${keyword} perto de ${location}`,
    `melhor ${keyword} ${location}`,
    `top ${keyword} ${location}`,
    `${keyword} na cidade de ${location}`,
    `${keyword} endereço telefone ${location}`,
  ];

  for (const queryFormat of queryFormats) {
    if (allLeads.length >= targetLimit) break;
    if (signal?.aborted) break;

    const query = queryFormat.replace(/\s+/g, ' ').trim();
    const encodedQuery = encodeURIComponent(query);
    const url = `https://www.google.com/search?q=${encodedQuery}&tbm=map&hl=pt-BR&gl=br&num=30`;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20000);

      const response = await fetch(url, {
        signal: signal ? signalCombinator(signal, controller.signal) : controller.signal,
        headers: getRandomHeaders(),
        redirect: 'follow',
      });

      clearTimeout(timeout);
      if (!response.ok) continue;

      const html = await response.text();
      const ldLeads = parseLdJsonFromSearch(html, url);

      for (const lead of ldLeads) {
        if (allLeads.length >= targetLimit) break;
        if (seenNames.has(lead.nome.toLowerCase())) continue;
        if (existingKeys.has(lead.nome)) continue;

        seenNames.add(lead.nome.toLowerCase());
        allLeads.push(lead);
      }

      await new Promise(r => setTimeout(r, 1500 + Math.random() * 3000));
    } catch {}
  }

  return allLeads;
}

function signalCombinator(signal1: AbortSignal, signal2: AbortSignal): AbortSignal {
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal1.addEventListener('abort', abort, { once: true });
  signal2.addEventListener('abort', abort, { once: true });
  return controller.signal;
}
