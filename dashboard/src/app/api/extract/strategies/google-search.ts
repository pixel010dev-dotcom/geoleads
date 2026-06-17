import type { SearchLead } from '../lib/types';
import { createEmptySearchLead } from '../lib/types';
import { normalizePhone, isBusinessWebsiteCandidate } from '../lib/validation';
import { getRandomHeaders } from '../lib/stealth';

const BLOCKED_KEYWORDS = ['captcha', 'sorry', 'unusual traffic', 'tráfego incomum', 'please show you\'re not a robot', 'robô'];

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
    } catch {}
  }
  return leads;
}

// Try extracting from regular HTML search results when tbm=map is not available
function parseSearchResultHtml(html: string): SearchLead[] {
  const leads: SearchLead[] = [];
  const seen = new Set<string>();

  const nameRegex = /<h3[^>]*class="[^"]*LC20lb[^"]*"[^>]*>([\s\S]*?)<\/h3>/gi;
  let match: RegExpExecArray | null;

  while ((match = nameRegex.exec(html)) !== null) {
    const name = match[1].replace(/<[^>]*>/g, '').trim();
    if (!name || name.length < 2 || name.length > 200 || seen.has(name)) continue;
    seen.add(name);

    const snippetMatch = html.slice(match.index).match(/<span[^>]*class="[^"]*aCOpRe[^"]*"[^>]*>([\s\S]*?)<\/span>/);
    const snippet = snippetMatch ? snippetMatch[1].replace(/<[^>]*>/g, '').trim() : '';
    const lead = createEmptySearchLead();
    lead.nome = name;
    lead.categoria = snippet.slice(0, 100);
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
  signal?: AbortSignal
): Promise<GoogleSearchResult> {
  const allLeads: SearchLead[] = [];
  const seenNames = new Set<string>();
  let blocked = false;

  const tlds = ['com', 'com.br', 'com.mx', 'co.uk', 'com.au'];
  const hls = ['pt-BR', 'pt', 'en', 'es'];
  const gls = ['br', 'us', 'mx', 'ar'];

  const queryFormats = [
    `${keyword} ${location}`,
    `${keyword} em ${location}`,
    `${keyword}, ${location}`,
    `${keyword} perto de ${location}`,
    `melhor ${keyword} ${location}`,
    `${keyword} endereço telefone ${location}`,
  ];

  interface QParams { tld: string; enc: string; hl: string; gl: string; }
  const urlModes: ((q: QParams) => string)[] = [
    (q: QParams) => `https://www.google.${q.tld}/search?q=${q.enc}&tbm=map&hl=${q.hl}&gl=${q.gl}&num=20`,
    (q: QParams) => `https://www.google.${q.tld}/search?q=${q.enc}&tbm=lcl&hl=${q.hl}&gl=${q.gl}`,
    (q: QParams) => `https://www.google.${q.tld}/search?q=${q.enc}&hl=${q.hl}&gl=${q.gl}`,
  ];

  for (const queryFormat of queryFormats) {
    if (allLeads.length >= targetLimit) break;
    if (signal?.aborted) break;

    const query = queryFormat.replace(/\s+/g, ' ').trim();
    const encodedQuery = encodeURIComponent(query);

    for (const mode of urlModes) {
      if (allLeads.length >= targetLimit) break;
      if (signal?.aborted) break;
      if (blocked) break;

      const tld = tlds[Math.floor(Math.random() * tlds.length)];
      const hl = hls[Math.floor(Math.random() * hls.length)];
      const gl = gls[Math.floor(Math.random() * gls.length)];
      const url = mode({ tld, enc: encodedQuery, hl, gl });

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 25000);

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

        let ldLeads = parseLdJsonFromSearch(html);
        if (ldLeads.length === 0) {
          ldLeads = parseSearchResultHtml(html);
        }

        for (const lead of ldLeads) {
          if (allLeads.length >= targetLimit) break;
          if (seenNames.has(lead.nome.toLowerCase())) continue;
          if (existingKeys.has(lead.nome)) continue;

          seenNames.add(lead.nome.toLowerCase());
          allLeads.push(lead);
        }
      } catch {}

      if (!blocked) await new Promise(r => setTimeout(r, 2000 + Math.random() * 3000));
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
