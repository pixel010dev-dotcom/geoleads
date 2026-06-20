import type { SearchLead } from '../lib/types';
import { createEmptySearchLead } from '../lib/types';
import { normalizePhone, isBusinessWebsiteCandidate } from '../lib/validation';
import { getRandomHeaders } from '../lib/stealth';

const BLOCKED_KEYWORDS = ['captcha', 'sorry', 'unusual traffic', 'tráfego incomum', 'please show you\'re not a robot', 'robô', 'consent'];

function isBlockedPage(html: string, url: string): boolean {
  const lower = html.toLowerCase();
  if (url.includes('sorry') || url.includes('captcha')) return true;
  for (const kw of BLOCKED_KEYWORDS) {
    if (lower.includes(kw)) return true;
  }
  return false;
}

function parseLdJsonFromSearch(html: string): SearchLead[] {
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
    } catch (e) { console.error(e); }
  }
  return leads;
}

function parseSearchResultHtml(html: string): SearchLead[] {
  const leads: SearchLead[] = [];
  const seen = new Set<string>();

  const nameRegex = /<h3[^>]*>([\s\S]*?)<\/h3>/gi;
  let match: RegExpExecArray | null;

  while ((match = nameRegex.exec(html)) !== null) {
    const name = match[1].replace(/<[^>]*>/g, '').trim();
    if (!name || name.length < 3 || name.length > 200 || seen.has(name.toLowerCase())) continue;
    if (/google|maps|search|login|sign|account|privacy|terms/i.test(name)) continue;
    seen.add(name.toLowerCase());

    const lead = createEmptySearchLead();
    lead.nome = name;

    const afterH3 = html.slice(match.index + match[0].length, match.index + match[0].length + 1500);
    const phoneMatch = afterH3.match(/\(?\d{2}\)?\s?\d{4,5}[\s-]?\d{4}/);
    if (phoneMatch) lead.telefone = normalizePhone(phoneMatch[0]);

    const siteMatch = afterH3.match(/href="(https?:\/\/[^"]+)"/);
    if (siteMatch && isBusinessWebsiteCandidate(siteMatch[1])) {
      lead.site = siteMatch[1];
    }

    const addrMatch = afterH3.match(/((?:Rua|Av\.?|Avenida|Travessa|Praça|Alameda|Rodovia|Estrada)\s[^<]{5,80})/i);
    if (addrMatch) lead.endereco = addrMatch[1].trim();

    leads.push(lead);
  }

  return leads;
}

function parseGoogleMapsSearch(html: string): SearchLead[] {
  const leads: SearchLead[] = [];
  const seen = new Set<string>();

  const dataMatch = html.match(/\["(https:\/\/www\.google\.com\/maps\/place[^"]+)",\[(\d+\.?\d*),(-?\d+\.?\d*)\]/g);
  if (dataMatch) {
    for (const dm of dataMatch) {
      const urlMatch = dm.match(/"(https:\/\/www\.google\.com\/maps\/place[^"]+)"/);
      const latMatch = dm.match(/\[(-?\d+\.?\d*),(-?\d+\.?\d*)\]/);
      if (urlMatch) {
        const nameMatch = urlMatch[1].match(/maps\/place\/([^/@]+)/);
        if (nameMatch) {
          const name = decodeURIComponent(nameMatch[1]).replace(/\+/g, ' ').trim();
          if (name && !seen.has(name.toLowerCase()) && name.length > 2 && name.length < 200) {
            seen.add(name.toLowerCase());
            const lead = createEmptySearchLead();
            lead.nome = name;
            if (latMatch) {
              lead.placeUrl = `https://www.google.com/maps/search/?api=1&query=${latMatch[1]},${latMatch[2]}`;
            }
            leads.push(lead);
          }
        }
      }
    }
  }

  const jsonRegex = /\["([^"]{3,80})"\s*,\s*"(https?:\/\/[^"]+)"\s*,\s*\[([^\]]*)\]/g;
  let jm: RegExpExecArray | null;
  while ((jm = jsonRegex.exec(html)) !== null) {
    const name = jm[1].replace(/\\u[\da-f]{4}/gi, '').trim();
    const url = jm[2];
    if (!name || name.length < 3 || seen.has(name.toLowerCase())) continue;
    if (/google|maps|search|login|sign|account/i.test(name)) continue;
    if (!url.includes('maps.place') && !url.includes('g.page') && !url.includes('goo.gl')) continue;

    seen.add(name.toLowerCase());
    const lead = createEmptySearchLead();
    lead.nome = name;
    if (url.includes('maps.place')) lead.placeUrl = url;
    leads.push(lead);
  }

  return leads;
}

export interface GoogleSearchResult {
  leads: SearchLead[];
  blocked: boolean;
}

export async function extractFromGoogleSearch(
  keyword: string,
  location: string,
  targetLimit: number,
  existingKeys: Set<string>,
  options?: { cfWorkerUrl?: string; signal?: AbortSignal }
): Promise<GoogleSearchResult> {
  const allLeads: SearchLead[] = [];
  const seenNames = new Set<string>();
  let blocked = false;

  const cfWorkerUrl = options?.cfWorkerUrl;
  const signal = options?.signal;

  const queryFormats = [
    `${keyword} ${location}`,
  ];

  function rewriteUrl(originalUrl: string): string {
    if (cfWorkerUrl) {
      return `${cfWorkerUrl}?url=${encodeURIComponent(originalUrl)}`;
    }
    return originalUrl;
  }

  for (const queryFormat of queryFormats) {
    if (allLeads.length >= targetLimit) break;
    if (signal?.aborted) break;

    const query = queryFormat.replace(/\s+/g, ' ').trim();
    const encodedQuery = encodeURIComponent(query);

    const urls = [
      rewriteUrl(`https://www.google.com.br/maps/search/${encodedQuery}?hl=pt-BR&gl=br`),
      rewriteUrl(`https://www.google.com/search?q=${encodedQuery}+endereço+telefone&hl=pt-BR&gl=br`),
    ];

    for (const url of urls) {
      if (allLeads.length >= targetLimit) break;
      if (signal?.aborted) break;
      if (blocked) break;

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 12000);

        const response = await fetch(url, {
          signal: signal ? signalCombinator(signal, controller.signal) : controller.signal,
          headers: getRandomHeaders(),
          redirect: 'follow',
        });

        clearTimeout(timeout);
        if (!response.ok) continue;

        const html = await response.text();

        if (isBlockedPage(html, url)) {
          blocked = true;
          continue;
        }

        let newLeads: SearchLead[] = [];

        const ldLeads = parseLdJsonFromSearch(html);
        if (ldLeads.length > 0) newLeads.push(...ldLeads);

        const mapsLeads = parseGoogleMapsSearch(html);
        if (mapsLeads.length > 0) newLeads.push(...mapsLeads);

        if (newLeads.length === 0) {
          const htmlLeads = parseSearchResultHtml(html);
          newLeads.push(...htmlLeads);
        }

        for (const lead of newLeads) {
          if (allLeads.length >= targetLimit) break;
          const nameKey = lead.nome.toLowerCase();
          if (seenNames.has(nameKey)) continue;
          if (existingKeys.has(nameKey)) continue;

          seenNames.add(nameKey);
        allLeads.push(lead);
      }
    } catch (e) { console.error(e); }

    await new Promise(r => setTimeout(r, 500 + Math.random() * 1000));
    }
  }

  return { leads: allLeads, blocked };
}

function signalCombinator(signal1: AbortSignal, signal2: AbortSignal): AbortSignal {
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal1.addEventListener('abort', abort, { once: true });
  signal2.addEventListener('abort', abort, { once: true });
  return controller.signal;
}
