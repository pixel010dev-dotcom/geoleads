import type { SearchLead } from '../lib/types';
import { createEmptySearchLead } from '../lib/types';
import { normalizePhone, isBusinessWebsiteCandidate } from '../lib/validation';
import { getRandomHeaders } from '../lib/stealth';
import { combineSignals } from '../lib/signals';

const BLOCKED_KEYWORDS = ['captcha', 'sorry', 'unusual traffic', 'tráfego incomum', "please show you're not a robot", 'robô', 'automated queries', 'our systems have detected', 'nossos sistemas detectaram', 'automated queries', 'consulta automatizada', 'enter the code', 'digite o código'];

function isBlocked(html: string, url: string): boolean {
  const lower = html.toLowerCase();
  if (url.includes('sorry') || url.includes('captcha') || url.includes('consent')) return true;
  return BLOCKED_KEYWORDS.some(kw => lower.includes(kw));
}

function cleanName(raw: string): string {
  return raw
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

const BAD_TITLE_PATTERNS = [
  /^(sign in|login|register|create account|google|maps|search|privacy|terms|sign up|entrar|criar conta|acessar)/i,
  /\b(redirecionando|redirecting|carregando|loading)\b/i,
  /^\d+$/,
  /^(youtube|facebook|instagram|twitter|linkedin|tiktok|whatsapp|telegram)/i,
  /^(imagem|image|foto|photo|video|vídeo)/i,
];

function isValidBusinessName(name: string): boolean {
  if (!name || name.length < 2 || name.length > 200) return false;
  return !BAD_TITLE_PATTERNS.some(p => p.test(name));
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

  // Múltiplos padrões de título para capturar diferentes estruturas HTML do Google
  const titlePatterns = [
    /<h3[^>]*>([\s\S]*?)<\/h3>/gi,
    /<div[^>]*class="[^"]*BNeawe[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
    /<span[^>]*class="[^"]*OSrXXb[^"]*"[^>]*>([\s\S]*?)<\/span>/gi,
    /<a[^>]*class="[^"]*pstlQe[^"]*"[^>]*>([\s\S]*?)<\/a>/gi,
    /aria-label="([^"]{3,200})"[^>]*role="link"/gi,
  ];

  for (const pattern of titlePatterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(html)) !== null) {
      const name = cleanName(match[1]);
      if (!name || seen.has(name) || !isValidBusinessName(name)) continue;
      seen.add(name);

      const lead = createEmptySearchLead();
      lead.nome = name;

      // Tenta extrair telefone do contexto próximo ao nome
      const contextStart = Math.max(0, match.index - 300);
      const contextEnd = Math.min(html.length, match.index + match[0].length + 500);
      const context = html.slice(contextStart, contextEnd);

      const phoneMatch = context.match(/\(?\d{2}\)?\s?\d{4,5}[\s-]?\d{4}/);
      if (phoneMatch) lead.telefone = normalizePhone(phoneMatch[0]);

      // Tenta extrair site dos links próximos
      const siteMatch = context.match(/href="(https?:\/\/[^"]+)"[^>]*>/gi);
      if (siteMatch) {
        for (const sm of siteMatch) {
          const hrefMatch = sm.match(/href="([^"]+)"/);
          if (hrefMatch && isBusinessWebsiteCandidate(hrefMatch[1])) {
            lead.site = hrefMatch[1];
            break;
          }
        }
      }

      // Tenta extrair endereço
      const addrMatch = context.match(/((?:Rua|Av\.?|Avenida|Travessa|Praça|Alameda)\s[^,]{5,80})/i);
      if (addrMatch) lead.endereco = addrMatch[1].trim();

      leads.push(lead);
    }
    if (leads.length > 0) break; // Se um padrão funcionou, não precisa dos outros
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
  } catch (e: any) {
    console.warn('[GoogleSearch] fetchViaUrl failed:', e?.message || e);
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
  } catch (e: any) {
    console.warn('[GoogleSearch] fetchViaCfWorker failed:', e?.message || e);
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

  // Múltiplos TLDs e variações de query para maximizar resultados
  const tlds = ['com.br', 'com'];

  // Gera múltiplas variações de busca
  const queries = [
    `${keyword} ${location}`,
    `${keyword} em ${location}`,
    `${keyword} ${location} telefone endereço`,
    `${keyword} ${location} site contato`,
    `${keyword} ${location} whatsapp email`,
  ];

  const BATCH_DELAY = 1200; // ms entre batches de requisições

  for (const query of queries) {
    if (allLeads.length >= targetLimit) break;
    if (signal?.aborted) break;
    if (blocked) break;

    const encoded = encodeURIComponent(query);
    let foundInThisQuery = false;

    for (const tld of tlds) {
      if (allLeads.length >= targetLimit) break;
      if (signal?.aborted) break;
      if (blocked) break;
      if (foundInThisQuery) break; // Se uma TLD retornou resultados, não precisa da outra

      // Tenta com Google Local primeiro (mais dados estruturados)
      const localUrl = `https://www.google.${tld}/search?q=${encoded}&tbm=lcl&hl=pt-BR&gl=br&num=10`;

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 12000);
        const combinedSignal = signal ? combineSignals(signal, controller.signal) : controller.signal;

        const { html, blocked: wasBlocked } = await fetchFn(localUrl, combinedSignal);
        clearTimeout(timeout);

        if (wasBlocked) {
          blocked = true;
          console.log(`[GoogleSearch] Blocked on ${tld} (local)`);
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

        if (newLeads.length > 0) {
          foundInThisQuery = true;
          
          // Se tivemos sucesso, tenta paginação para mais resultados
          if (allLeads.length < targetLimit && newLeads.length >= 8) {
            try {
              await new Promise(r => setTimeout(r, 800 + Math.random() * 500));
              if (signal?.aborted) break;
              
              const pageUrl = `https://www.google.${tld}/search?q=${encoded}&tbm=lcl&hl=pt-BR&gl=br&num=20&start=0`;
              const { html: page2Html } = await fetchFn(pageUrl);
              if (page2Html) {
                const page2Leads = parseLdJson(page2Html);
                const htmlPage2Leads = page2Leads.length === 0 ? parseHtmlResults(page2Html) : [];
                const allPage2 = [...page2Leads, ...htmlPage2Leads];
                for (const lead of allPage2) {
                  if (allLeads.length >= targetLimit) break;
                  const key = lead.nome.toLowerCase();
                  if (seenNames.has(key)) continue;
                  seenNames.add(key);
                  allLeads.push(lead);
                }
              }
            } catch (e: any) { console.warn('[GoogleSearch] pagination failed:', e?.message || e); }
          }
        }
      } catch (e: any) { console.warn('[GoogleSearch] TLD request failed:', e?.message || e); }
    }

    if (!blocked && !foundInThisQuery) {
      // Se não encontrou com Google Local, tenta busca web normal
      try {
        const encodedWeb = encodeURIComponent(`${query} endereço telefone`);
        const webUrl = `https://www.google.${tlds[0]}/search?q=${encodedWeb}&hl=pt-BR&gl=br&num=10`;
        
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);
        const combinedSignal = signal ? combineSignals(signal, controller.signal) : controller.signal;

        const { html: webHtml } = await fetchFn(webUrl, combinedSignal);
        clearTimeout(timeout);

        if (webHtml) {
          const webLeads = parseHtmlResults(webHtml);
          for (const lead of webLeads) {
            if (allLeads.length >= targetLimit) break;
            const key = lead.nome.toLowerCase();
            if (seenNames.has(key)) continue;
            seenNames.add(key);
            allLeads.push(lead);
          }
        }
      } catch (e: any) { console.warn('[GoogleSearch] web search failed:', e?.message || e); }
    }

    if (!blocked) await new Promise(r => setTimeout(r, BATCH_DELAY * (0.5 + Math.random())));
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
    } catch (e: any) { console.warn('[GoogleSearch] CF fallback failed:', e?.message || e); }
  }

  console.log(`[GoogleSearch] ${usedCfWorker ? '(via CF)' : '(direct)'}: ${allLeads.length} leads, blocked=${blocked}`);
  return { leads: allLeads, blocked };
}

