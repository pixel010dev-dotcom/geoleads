import type { SearchLead } from '../lib/types';
import { createEmptySearchLead } from '../lib/types';
import { normalizePhone, isBusinessWebsiteCandidate } from '../lib/validation';

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const BAD_EMAIL = /sentry|wix|example|schema|wordpress|localhost|noreply|no-reply/i;
const CNPJ_REGEX = /\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}/;

const BING_UA = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:126.0) Gecko/20100101 Firefox/126.0',
];

function extractBingBusinessData(html: string): Array<{
  name: string;
  phone?: string;
  website?: string;
  address?: string;
  rating?: string;
  email?: string;
  cnpj?: string;
  instagram?: string;
  facebook?: string;
}> {
  const results: Array<any> = [];
  const seenNames = new Set<string>();

  // Tenta extrair de dados JSON embutidos
  const jsonBlobs: string[] = [];
  const entityRegex = /"entities":\s*\[/g;
  let m: RegExpExecArray | null;
  while ((m = entityRegex.exec(html)) !== null) {
    const start = m.index;
    let depth = 1;
    let pos = m.index + m[0].length;
    while (pos < html.length && depth > 0) {
      if (html[pos] === '[') depth++;
      else if (html[pos] === ']') depth--;
      pos++;
    }
    if (depth === 0) {
      jsonBlobs.push(html.slice(start, pos));
    }
  }

  // Processa JSON blobs
  for (const blob of jsonBlobs) {
    try {
      const match = blob.match(/\[([\s\S]*)\]/);
      if (!match) continue;
      // Tenta parsear cada entidade individualmente
      const entityRegex2 = /\{([^{}]*?(?:\{[^{}]*\}[^{}]*?)*?)\}/g;
      let em: RegExpExecArray | null;
      while ((em = entityRegex2.exec(match[1])) !== null) {
        try {
          const entity = JSON.parse(`{${em[1]}}`);
          if (entity.name && typeof entity.name === 'string' && entity.name.length >= 2) {
            const nameKey = entity.name.toLowerCase();
            if (!seenNames.has(nameKey)) {
              seenNames.add(nameKey);
              results.push({
                name: entity.name,
                phone: entity.phone || entity.telephone,
                website: entity.website || entity.url,
                address: entity.address,
                rating: entity.rating ? String(entity.rating) : undefined,
              });
            }
          }
        } catch { /* skip invalid entity JSON */ }
      }
    } catch { /* skip invalid blob */ }
  }

  // Fallback: extrai de dados de negócio do HTML
  if (results.length === 0) {
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

    while ((m = businessRegex.exec(html)) !== null) {
      const name = m[1].replace(/\\u[0-9a-fA-F]{4}/g, '').trim();
      if (name.length >= 2 && !seenNames.has(name.toLowerCase())) {
        seenNames.add(name.toLowerCase());
        names.push(name);
      }
    }

    while ((m = phoneRegex.exec(html)) !== null) phones.push(m[1]);
    while ((m = siteRegex.exec(html)) !== null) sites.push(m[1]);
    while ((m = addrRegex.exec(html)) !== null) addresses.push(m[1]);
    while ((m = ratingRegex.exec(html)) !== null) ratings.push(m[1]);

    // HTML aria-label names
    const htmlNameRegex = /aria-label="([^"]{3,100})"\s*(?:role|class)/g;
    while ((m = htmlNameRegex.exec(html)) !== null) {
      const name = m[1].trim();
      if (!seenNames.has(name.toLowerCase())) {
        seenNames.add(name.toLowerCase());
        names.push(name);
      }
    }

    for (let i = 0; i < names.length; i++) {
      const entry: any = { name: names[i] };
      if (i < phones.length) entry.phone = phones[i];
      if (i < sites.length) entry.website = sites[i];
      if (i < addresses.length) entry.address = addresses[i];
      if (i < ratings.length) entry.rating = ratings[i];
      results.push(entry);
    }
  }

  return results;
}

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
    `${keyword} ${location} contato`,
    `${keyword} ${location} site whatsapp`,
  ];

  for (const query of variants) {
    if (leads.length >= targetLimit) break;
    if (signal?.aborted) break;

    // Tenta diferentes níveis de zoom para maximizar resultados
    const zoomLevels = [15, 13, 17];
    let foundInQuery = false;

    for (const lvl of zoomLevels) {
      if (leads.length >= targetLimit) break;
      if (signal?.aborted) break;
      if (foundInQuery) break;

      try {
        const userAgent = BING_UA[Math.floor(Math.random() * BING_UA.length)];
        const url = `https://www.bing.com/maps?q=${encodeURIComponent(query)}&lvl=${lvl}&setLang=pt-BR&style=g`;

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 12000);

        const response = await fetch(url, {
          signal: controller.signal,
          headers: {
            'User-Agent': userAgent,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8,es;q=0.7',
            'Referer': 'https://www.bing.com/',
            'DNT': '1',
          },
          redirect: 'follow',
        });

        clearTimeout(timeout);
        if (!response.ok) continue;

        const html = await response.text();
        if (html.length < 500) continue; // Resposta muito curta = bloqueado

        const businesses = extractBingBusinessData(html);

        for (const biz of businesses) {
          if (leads.length >= targetLimit) break;
          const nameKey = biz.name.toLowerCase();
          if (seenNames.has(nameKey)) continue;
          seenNames.add(nameKey);

          const lead = createEmptySearchLead();
          lead.nome = biz.name;

          if (biz.phone) lead.telefone = normalizePhone(biz.phone);

          if (biz.website && isBusinessWebsiteCandidate(biz.website)) {
            lead.site = biz.website.startsWith('http') ? biz.website : `https://${biz.website}`;
          }

          if (biz.address) lead.endereco = biz.address.replace(/\\u[0-9a-fA-F]{4}/g, '');
          if (biz.rating) lead.avaliacao = biz.rating;

          // Extrai email/CNPJ/social do contexto HTML
          const contextStart = Math.max(0, html.indexOf(biz.name) - 300);
          const contextEnd = Math.min(html.length, html.indexOf(biz.name) + 600);
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

        if (businesses.length > 0) foundInQuery = true;

        // Delay entre tentativas
        await new Promise(r => setTimeout(r, 600 + Math.random() * 600));
      } catch (e: any) {
        console.warn('[BingMaps] request failed:', e?.message || e);
      }
    }

    await new Promise(r => setTimeout(r, 500 + Math.random() * 500));
  }

  return leads;
}
