import type { SearchLead } from '../lib/types';
import { createEmptySearchLead } from '../lib/types';
import { normalizePhone, isBusinessWebsiteCandidate } from '../lib/validation';
import { getRandomHeaders } from '../lib/stealth';

const BLOCKED_KEYWORDS = ['captcha', 'sorry', 'unusual traffic', 'tráfego incomum', "please show you're not a robot", 'robô', 'automated queries'];

function isBlocked(html: string, url: string): boolean {
  const lower = html.toLowerCase();
  if (url.includes('sorry') || url.includes('captcha')) return true;
  return BLOCKED_KEYWORDS.some(kw => lower.includes(kw));
}

function parseLdJson(html: string): SearchLead[] {
  const leads: SearchLead[] = [];
  const regex = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(html)) !== null) {
    try {
      const data = JSON.parse(match[1].trim());
      const items = Array.isArray(data) ? data : [data];
      for (const item of items) {
        const types = Array.isArray(item['@type']) ? item['@type'] : [item['@type']];
        const isBiz = types.some((t: string) =>
          t && typeof t === 'string' && (
            t.includes('LocalBusiness') || t.includes('Organization') ||
            t.includes('Store') || t.includes('Restaurant') ||
            t.includes('Dentist') || t.includes('Physician') ||
            t.includes('HealthClub') || t.includes('SportsActivityLocation') ||
            t.includes('Hotel') || t.includes('ProfessionalService')
          )
        );
        if (!isBiz && !item.name) continue;

        const lead = createEmptySearchLead();
        if (item.name && typeof item.name === 'string' && item.name.length > 1 && item.name.length < 200) {
          lead.nome = item.name.trim();
        }
        if (item.telephone) lead.telefone = normalizePhone(String(item.telephone));
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
        if (item.description) lead.categoria = String(item.description).slice(0, 100);
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
    } catch { /* skip invalid JSON */ }
  }
  return leads;
}

function parseHtmlResults(html: string): SearchLead[] {
  const leads: SearchLead[] = [];
  const seen = new Set<string>();

  // Try to find business names in result titles
  const titleRegex = /<h3[^>]*>([\s\S]*?)<\/h3>/gi;
  let match: RegExpExecArray | null;

  while ((match = titleRegex.exec(html)) !== null) {
    const name = match[1].replace(/<[^>]*>/g, '').trim();
    if (!name || name.length < 2 || name.length > 200 || seen.has(name)) continue;
    if (/^(sign in|login|register|create account|google|maps|search|privacy|terms)/i.test(name)) continue;
    seen.add(name);

    const lead = createEmptySearchLead();
    lead.nome = name;
    leads.push(lead);
  }

  return leads;
}

async function fetchViaUrl(url: string, signal?: AbortSignal): Promise<{ html: string; blocked: boolean }> {
  try {
    const response = await fetch(url, {
      signal,
      headers: getRandomHeaders(),
      redirect: 'follow',
    });
    if (!response.ok) return { html: '', blocked: false };
    const html = await response.text();
    const blocked = isBlocked(html, url);
    return { html, blocked };
  } catch {
    return { html: '', blocked: false };
  }
}

async function fetchViaCfWorker(url: string, cfWorkerUrl: string, signal?: AbortSignal): Promise<{ html: string; blocked: boolean }> {
  try {
    const proxyUrl = `${cfWorkerUrl.replace(/\/$/, '')}/?url=${encodeURIComponent(url)}`;
    const response = await fetch(proxyUrl, {
      signal,
      headers: {
        'User-Agent': 'GeoLeads/1.0',
        'Accept': 'text/html',
      },
      redirect: 'follow',
    });
    if (!response.ok) return { html: '', blocked: false };
    const html = await response.text();
    const blocked = isBlocked(html, url);
    return { html, blocked };
  } catch {
    return { html: '', blocked: false };
  }
}

export async function extractFromGoogleSearch(
  keyword: string,
  location: string,
  targetLimit: number,
  existingKeys: Set<string>,
  signal?: AbortSignal
): Promise<{ leads: SearchLead[]; blocked: boolean }> {
  const allLeads: SearchLead[] = [];
  const seenNames = new Set<string>(Array.from(existingKeys).map(k => k.toLowerCase()));
  let blocked = false;
  let usedCfWorker = false;

  const cfWorkerUrl = process.env.CF_WORKER_URL || '';
  const fetchFn = cfWorkerUrl ? (url: string, sig?: AbortSignal) => {
    usedCfWorker = true;
    return fetchViaCfWorker(url, cfWorkerUrl, sig);
  } : fetchViaUrl;

  // Apenas .com.br e .com - .com.mx removido (muito lento e raramente retorna leads BR)
  const tlds = ['com.br', 'com'];
  const hls = ['pt-BR', 'pt'];

  const queries = [
    `${keyword} ${location}`,
    `${keyword} em ${location}`,
  ];

  for (const query of queries) {
    if (allLeads.length >= targetLimit) break;
    if (signal?.aborted) break;
    if (blocked) break;

    const encoded = encodeURIComponent(query);

    for (const tld of tlds) {
      if (allLeads.length >= targetLimit) break;
      if (signal?.aborted) break;
      if (blocked) break;

      // Tenta primeiro com tbm=lcl (Google Local), que tem mais dados estruturados
      const url = `https://www.google.${tld}/search?q=${encoded}&tbm=lcl&hl=pt-BR&gl=br&num=10`;

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);
        const combinedSignal = signal ? combineSignals(signal, controller.signal) : controller.signal;

        const { html, blocked: wasBlocked } = await fetchFn(url, combinedSignal);
        clearTimeout(timeout);

        if (wasBlocked) {
          blocked = true;
          console.log(`[GoogleSearch] Blocked on ${tld}`);
          continue;
        }
        if (!html) continue;

        let newLeads = parseLdJson(html);
        if (newLeads.length === 0) {
          newLeads = parseHtmlResults(html);
        }

        for (const lead of newLeads) {
          if (allLeads.length >= targetLimit) break;
          const key = lead.nome.toLowerCase();
          if (seenNames.has(key)) continue;
          seenNames.add(key);
          allLeads.push(lead);
        }

        if (newLeads.length > 0) break; // Found results, no need more TLDs
      } catch { /* continue to next TLD */ }
    }

    if (!blocked) await new Promise(r => setTimeout(r, 800 + Math.random() * 1200));
  }

  // If blocked directly and CF worker is available, try one more query via CF
  if (blocked && cfWorkerUrl && !usedCfWorker) {
    console.log(`[GoogleSearch] Direct blocked, trying via Cloudflare Worker...`);
    const encoded = encodeURIComponent(`${keyword} ${location}`);
    const url = `https://www.google.com/search?q=${encoded}&tbm=lcl&hl=pt-BR&gl=br&num=20`;

    try {
      const { html, blocked: cfBlocked } = await fetchViaCfWorker(url, cfWorkerUrl);
      if (!cfBlocked && html) {
        let newLeads = parseLdJson(html);
        if (newLeads.length === 0) newLeads = parseHtmlResults(html);
        for (const lead of newLeads) {
          if (allLeads.length >= targetLimit) break;
          const key = lead.nome.toLowerCase();
          if (seenNames.has(key)) continue;
          seenNames.add(key);
          allLeads.push(lead);
        }
        blocked = false; // CF worker worked!
        console.log(`[GoogleSearch] Cloudflare Worker bypassed block: ${newLeads.length} leads`);
      }
    } catch { /* CF also failed */ }
  }

  console.log(`[GoogleSearch] ${usedCfWorker ? '(via CF)' : '(direct)'}: ${allLeads.length} leads, blocked=${blocked}`);
  return { leads: allLeads, blocked };
}

function combineSignals(s1: AbortSignal, s2: AbortSignal): AbortSignal {
  const c = new AbortController();
  const abort = () => c.abort();
  s1.addEventListener('abort', abort, { once: true });
  s2.addEventListener('abort', abort, { once: true });
  return c.signal;
}
