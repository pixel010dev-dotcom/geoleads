import type { SearchLead } from '../lib/types';
import { createEmptySearchLead } from '../lib/types';
import { normalizePhone, isBusinessWebsiteCandidate } from '../lib/validation';
import { getRandomUserAgent } from '../lib/stealth';

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const BAD_EMAIL = /sentry|wix|example|schema|wordpress|localhost|noreply|no-reply/i;
const CNPJ_REGEX = /\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}/;

export async function extractFromBingMaps(
  keyword: string,
  location: string,
  targetLimit: number,
  existingKeys: Set<string>,
  signal?: AbortSignal
): Promise<SearchLead[]> {
  const leads: SearchLead[] = [];
  const seenNames = new Set<string>(Array.from(existingKeys).map(k => k.toLowerCase()));

  const variants = [
    `${keyword} ${location}`,
    `${keyword} em ${location}`,
    `${keyword} ${location} telefone`,
  ];

  for (const query of variants) {
    if (leads.length >= targetLimit) break;

    if (signal?.aborted) break;

    try {
      const url = `https://www.bing.com/maps?q=${encodeURIComponent(query)}&lvl=15&setLang=pt-BR&style=g`;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000);

      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': getRandomUserAgent(),
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
          'Referer': 'https://www.bing.com/',
        },
        redirect: 'follow',
      });

      clearTimeout(timeout);
      if (!response.ok) continue;

      const html = await response.text();

      // Try to extract from JSON entity data embedded in the page
      const entityRegex = /"localEntityResult|"entities":\s*\[([\s\S]*?)\]/g;
      const businessRegex = /"name"\s*:\s*"([^"]{2,100})"/g;
      const phoneRegex = /"phone"\s*:\s*"([^"]+)"/g;
      const siteRegex = /"website"\s*:\s*"([^"]+)"/g;
      const addrRegex = /"address"\s*:\s*"([^"]+)"/g;
      const ratingRegex = /"rating"\s*:\s*([\d.]+)/g;

      const names: string[] = [];
      const phones: string[] = [];
      const sites: string[] = [];
      const addresses: string[] = [];
      const ratings: string[] = [];

      let m: RegExpExecArray | null;
      while ((m = businessRegex.exec(html)) !== null) {
        const name = m[1].replace(/\\u[0-9a-fA-F]{4}/g, '').trim();
        if (name.length >= 2 && !seenNames.has(name.toLowerCase())) {
          names.push(name);
        }
      }

      const phoneMatches: string[] = [];
      while ((m = phoneRegex.exec(html)) !== null) phoneMatches.push(m[1]);
      while ((m = siteRegex.exec(html)) !== null) sites.push(m[1]);
      while ((m = addrRegex.exec(html)) !== null) addresses.push(m[1]);
      while ((m = ratingRegex.exec(html)) !== null) ratings.push(m[1]);

      // Also try parsing from HTML structure
      const htmlNameRegex = /aria-label="([^"]{3,100})"\s*(?:role|class)/g;
      while ((m = htmlNameRegex.exec(html)) !== null) {
        const name = m[1].trim();
        if (!seenNames.has(name.toLowerCase())) {
          names.push(name);
        }
      }

      for (let i = 0; i < names.length && leads.length < targetLimit; i++) {
        const name = names[i];
        const nameKey = name.toLowerCase();
        if (seenNames.has(nameKey)) continue;
        seenNames.add(nameKey);

        const lead = createEmptySearchLead();
        lead.nome = name;

        if (i < phoneMatches.length && phoneMatches[i]) {
          lead.telefone = normalizePhone(phoneMatches[i]);
        }

        if (i < sites.length && sites[i] && isBusinessWebsiteCandidate(sites[i])) {
          lead.site = sites[i].startsWith('http') ? sites[i] : `https://${sites[i]}`;
        }

        if (i < addresses.length && addresses[i]) {
          lead.endereco = addresses[i].replace(/\\u[0-9a-fA-F]{4}/g, '');
        }

        if (i < ratings.length && ratings[i]) {
          lead.avaliacao = ratings[i];
        }

        // Extract email/CNPJ/social from combined text context
        const contextStart = Math.max(0, html.indexOf(name) - 200);
        const contextEnd = Math.min(html.length, html.indexOf(name) + 500);
        const context = html.slice(contextStart, contextEnd);

        const emailMatch = context.match(EMAIL_REGEX);
        if (emailMatch) {
          const email = emailMatch.find(e => !BAD_EMAIL.test(e));
          if (email) lead.email = email;
        }

        const cnpjMatch = context.match(CNPJ_REGEX);
        if (cnpjMatch) lead.cnpj = cnpjMatch[0];

        const instaMatch = context.match(/instagram\.com\/([a-zA-Z0-9._]+)/i);
        if (instaMatch) lead.instagram = `https://www.instagram.com/${instaMatch[1]}`;

        const fbMatch = context.match(/facebook\.com\/([a-zA-Z0-9._]+)/i);
        if (fbMatch) lead.facebook = `https://www.facebook.com/${fbMatch[1]}`;

        leads.push(lead);
      }

      await new Promise(r => setTimeout(r, 500 + Math.random() * 500));
    } catch {
      // Bing failed, continue to next variant
    }
  }

  return leads;
}
