import type { SearchLead } from '../lib/types';
import { createEmptySearchLead } from '../lib/types';
import { normalizePhone, isBusinessWebsiteCandidate } from '../lib/validation';
import { combineSignals } from '../lib/signals';

/**
 * Estrategia Google Maps Mobile
 * 
 * Diferencial: usa User-Agent mobile (iPhone/Android) que e menos bloqueado
 * que desktop. O HTML retornado e mais simples e rapido de parsear.
 * Timeout: 6s (mais rapido que as outras estrategias)
 */

const MOBILE_AGENTS = [
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (Linux; Android 14; SM-S928B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.6422.72 Mobile Safari/537.36',
  'Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.6422.72 Mobile Safari/537.36',
  'Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.43 Mobile Safari/537.36',
  'Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
];

const BLOCKED_KEYWORDS = [
  'captcha', 'sorry', 'unusual traffic', 'tráfego incomum',
  "please show you're not a robot", 'robô', 'automated queries',
  'nossos sistemas detectaram', 'consulta automatizada',
];

function isBlocked(html: string, url: string): boolean {
  const lower = html.toLowerCase();
  if (url.includes('sorry') || url.includes('captcha')) return true;
  return BLOCKED_KEYWORDS.some(kw => lower.includes(kw));
}

function cleanText(raw: string): string {
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

const BAD_NAMES = [
  /^(sign in|login|register|create account|google|maps|search|privacy|terms)/i,
  /^(entrar|criar conta|acessar)/i,
  /^(youtube|facebook|instagram|twitter|linkedin|tiktok)/i,
  /^(imagem|image|foto|photo|video)/i,
  /^\d+$/,
];

function isValidName(name: string): boolean {
  if (!name || name.length < 3 || name.length > 150) return false;
  return !BAD_NAMES.some(p => p.test(name));
}

/**
 * Parseia HTML mobile do Google Maps (tbm=lcl) que tem estrutura
 * mais simples que a versao desktop
 */
function parseMobileLocalResults(html: string): SearchLead[] {
  const leads: SearchLead[] = [];
  const seen = new Set<string>();

  // No mobile, os resultados de negocios vem em estrutura mais plana
  // Tenta extrair de dados JSON-LD primeiro (mais confiavel)
  const ldRegex = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;

  while ((match = ldRegex.exec(html)) !== null) {
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
            t.includes('HealthClub') || t.includes('Hotel') ||
            t.includes('ProfessionalService')
          )
        );
        if (!isBiz && !item.name) continue;

        const lead = createEmptySearchLead();
        if (item.name && typeof item.name === 'string' && isValidName(item.name)) {
          lead.nome = item.name.trim();
        } else continue;

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
    } catch { /* skip */ }
  }

  if (leads.length > 0) return leads;

  // Fallback: parse mobile HTML results com regex genérica
  // Google muda as classes constantemente, entao usamos padroes genericos
  const genericPatterns = [
    // aria-label em links/buttons de resultado
    /aria-label="([^"]{3,120})"[^>]*role="(?:link|button|article)"/gi,
    // role="heading" em titulos de resultado
    /role="heading"[^>]*>([\s\S]*?)<\/div>/gi,
    // div com data-attrid (padrao Google)
    /data-attrid="[^"]*title[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
    // span com padrao de nome de estabelecimento (BN* sao classes do Google)
    /<span[^>]*class="[^"]*BNeawe[^"]*"[^>]*>([\s\S]*?)<\/span>/gi,
    // role="heading" h3
    /<h3[^>]*role="heading"[^>]*>([\s\S]*?)<\/h3>/gi,
    // h3 generico
    /<h3[^>]*>([\s\S]*?)<\/h3>/gi,
  ];

  for (const nameRegex of genericPatterns) {
    if (leads.length > 0) break; // Já achou resultados, não precisa de mais padrões
    while ((match = nameRegex.exec(html)) !== null) {
      const name = cleanText(match[1]);
      if (!name || seen.has(name) || !isValidName(name)) continue;
      seen.add(name);

      const lead = createEmptySearchLead();
      lead.nome = name;

      const ctxStart = Math.max(0, match.index - 500);
      const ctxEnd = Math.min(html.length, match.index + match[0].length + 700);
      const ctx = html.slice(ctxStart, ctxEnd);

      const phoneMatch = ctx.match(/(?:(?:\+55\s?)?\(?\d{2}\)?\s?\d{4,5}[\s-]?\d{4})/);
      if (phoneMatch && phoneMatch[0].length >= 10) {
        lead.telefone = normalizePhone(phoneMatch[0]);
      }

      const siteHrefRegex = /href="(https?:\/\/(?:www\.)?(?!google)[^"']*?)"/gi;
      let siteMatch: RegExpExecArray | null;
      while ((siteMatch = siteHrefRegex.exec(ctx)) !== null) {
        if (isBusinessWebsiteCandidate(siteMatch[1])) {
          lead.site = siteMatch[1];
          break;
        }
      }

      const addrMatch = ctx.match(/((?:Rua|Av\.?|Avenida|Travessa|Praça|Alameda|Rodovia)\s[^,]{5,80})/i);
      if (addrMatch) lead.endereco = addrMatch[1].trim();

      const ratingMatch = ctx.match(/(\d[.,]\d)\s*(?:estrela|star|★)/i);
      if (ratingMatch) lead.avaliacao = ratingMatch[1].replace(',', '.');

      const catMatch = ctx.match(/(?:·)\s*([A-Za-zÀ-ÿ\u00C0-\u024F\s]{3,40})(?:\s*·|$)/);
      if (catMatch) lead.categoria = catMatch[1].trim();

      leads.push(lead);
    }
  }

  // Último recurso: procura por spans com texto que parece nome de negócio
  if (leads.length === 0) {
    const textBlocks = html.match(/>([A-ZÀ-ÿ][A-ZÀ-ÿa-zà-ÿ0-9\s]{5,60})<\//g);
    if (textBlocks) {
      for (const block of textBlocks) {
        const name = cleanText(block.replace(/^>/, ''));
        if (!name || name.length < 5 || name.length > 80 || seen.has(name) || !isValidName(name)) continue;
        // Pula textos genéricos que não são nomes de negócio
        if (/^(sobre|sobre nós|contato|produtos|serviços|home|início|blog|notícias|termos|privacidade|avaliações|fotos|vídeos|mapa)/i.test(name)) continue;
        seen.add(name);

        const lead = createEmptySearchLead();
        lead.nome = name;
        leads.push(lead);
      }
    }
  }

  return leads;
}

export async function extractFromGoogleMapsMobile(
  keyword: string,
  location: string,
  targetLimit: number,
  existingKeys: Set<string>,
  signal?: AbortSignal
): Promise<SearchLead[]> {
  const allLeads: SearchLead[] = [];
  const seenNames = new Set<string>(Array.from(existingKeys).map(k => k.toLowerCase()));

  // Query variations - so 2, rapidas
  const queries = [
    `${keyword} ${location}`,
    `${keyword} ${location} telefone`,
  ];

  for (const query of queries) {
    if (allLeads.length >= targetLimit) break;
    if (signal?.aborted) break;

    const encoded = encodeURIComponent(query);
    const userAgent = MOBILE_AGENTS[Math.floor(Math.random() * MOBILE_AGENTS.length)];

    // Tenta Google com tbm=lcl (local results) e mobile UA
    const urlsToTry = [
      `https://www.google.com/search?q=${encoded}&tbm=lcl&hl=pt-BR&gl=br&num=10`,
      `https://www.google.com.br/search?q=${encoded}&tbm=lcl&hl=pt-BR&gl=br&num=10`,
    ];

    for (const url of urlsToTry) {
      if (allLeads.length >= targetLimit) break;
      if (signal?.aborted) break;

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 6000); // 6s hard timeout
        const sig = signal ? combineSignals(signal, controller.signal) : controller.signal;

        const response = await fetch(url, {
          signal: sig,
          headers: {
            'User-Agent': userAgent,
            'Accept': 'text/html,application/xhtml+xml',
            'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
            'Referer': 'https://www.google.com/',
            'X-Requested-With': 'XMLHttpRequest',
          },
          redirect: 'follow',
        });

        clearTimeout(timeout);

        if (!response.ok) continue;
        const html = await response.text();
        if (html.length < 300) continue;

        if (isBlocked(html, url)) {
          console.log(`[GoogleMapsMobile] Blocked on ${url}`);
          continue;
        }

        const newLeads = parseMobileLocalResults(html);

        for (const lead of newLeads) {
          if (allLeads.length >= targetLimit) break;
          const key = lead.nome.toLowerCase();
          if (seenNames.has(key)) continue;
          seenNames.add(key);
          allLeads.push(lead);
        }

        if (newLeads.length > 0) break; // Found results, no need for other URL
      } catch (e: any) {
        console.warn('[GoogleMapsMobile] request failed:', e?.message || e);
        continue;
      }
    }

    // Delay pequeno entre queries
    if (!signal?.aborted) {
      await new Promise(r => setTimeout(r, 300 + Math.random() * 200));
    }
  }

  console.log(`[GoogleMapsMobile] ${allLeads.length} leads`);
  return allLeads;
}

