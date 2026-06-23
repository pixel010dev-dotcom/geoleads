import type { SearchLead } from '../lib/types';
import { createEmptySearchLead } from '../lib/types';
import { normalizePhone, isBusinessWebsiteCandidate } from '../lib/validation';

const BLOCKED_KEYWORDS = ['duckduckgo', 'privacy', 'terms', 'login', 'sign up'];
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const BAD_EMAIL = /sentry|wix|example|schema|wordpress|localhost|noreply|no-reply/i;
const CNPJ_REGEX = /\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}/;

export async function extractFromDuckDuckGo(
  keyword: string,
  location: string,
  targetLimit: number,
  existingKeys: Set<string>,
  signal?: AbortSignal
): Promise<SearchLead[]> {
  const leads: SearchLead[] = [];
  const seenNames = new Set<string>(Array.from(existingKeys).map(k => k.toLowerCase()));

  const queryVariants = [
    `${keyword} ${location} endereço telefone contato`,
    `${keyword} em ${location} telefone site`,
    `${keyword} ${location} email whatsapp`,
  ];

  for (const query of queryVariants) {
    if (leads.length >= targetLimit) break;

    if (signal?.aborted) break;

    try {
      const encodedQuery = encodeURIComponent(query);
      const url = `https://html.duckduckgo.com/html/?q=${encodedQuery}&kl=br-pt`;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000);

      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'pt-BR,pt;q=0.9',
        },
        redirect: 'follow',
      });

      clearTimeout(timeout);

      if (!response.ok) continue;

      const html = await response.text();

      const resultRegex = /<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
      const snippetRegex = /<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;

      const urls: string[] = [];
      const titles: string[] = [];
      const snippets: string[] = [];

      let match: RegExpExecArray | null;
      while ((match = resultRegex.exec(html)) !== null) {
        const title = match[2].replace(/<[^>]*>/g, '').trim();
        if (title && !BLOCKED_KEYWORDS.some(kw => title.toLowerCase().includes(kw))) {
          urls.push(match[1]);
          titles.push(title);
        }
      }

      while ((match = snippetRegex.exec(html)) !== null) {
        snippets.push(match[1].replace(/<[^>]*>/g, '').trim());
      }

      for (let i = 0; i < titles.length && leads.length < targetLimit; i++) {
        let name = titles[i];
        if (!name || name.length < 3 || name.length > 200) continue;

        name = name.split(/[\-–—|]/)[0].trim();
        name = name.split(/\s*[-–—]\s*(?:PR|SP|RJ|MG|SC|RS|BA|PE|CE|GO|DF|ES|PA|AM|MT|MS|MA|PB|RN|SE|AL|TO|AC|AP|RO|RR)\b/)[0].trim();
        if (name.length < 3 || name.length > 100) continue;
        if (seenNames.has(name.toLowerCase())) continue;
        if (/^(road|aerial|hybrid|satellite|terrain|street|roadmap|JSWarning|\+n)$/i.test(name)) continue;

        const snippet = snippets[i] || '';
        const combined = `${name} ${snippet}`;

        const phoneMatch = combined.match(/\+?55\s?\(?\d{2}\)?\s?\d{4,5}[\s-]?\d{4}/) ||
          combined.match(/\(?\d{2}\)?\s?\d{4,5}[\s-]?\d{4}/) ||
          combined.match(/\d{2}\s?\d{4,5}[\s-]?\d{4}/) ||
          combined.match(/Fone[:\s]*(\(?\d{2}\)?\s?\d{4,5}[\s-]?\d{4})/i) ||
          combined.match(/Tel[:\s]*(\(?\d{2}\)?\s?\d{4,5}[\s-]?\d{4})/i) ||
          combined.match(/Cel[:\s]*(\(?\d{2}\)?\s?\d{4,5}[\s-]?\d{4})/i) ||
          combined.match(/WhatsApp[:\s]*(\(?\d{2}\)?\s?\d{4,5}[\s-]?\d{4})/i) ||
          combined.match(/Whats[:\s]*(\(?\d{2}\)?\s?\d{4,5}[\s-]?\d{4})/i);
        const phone = phoneMatch ? normalizePhone(phoneMatch[0]) : 'Não informado';

        const lead = createEmptySearchLead();
        lead.nome = name;

        if (phone !== 'Não informado') {
          lead.telefone = phone;
        }

        const url = urls[i] || '';
        if (url && !url.includes('duckduckgo') && !url.includes('google.com')) {
          try {
            const decoded = decodeURIComponent(url);
            if (decoded.startsWith('http') && isBusinessWebsiteCandidate(decoded)) {
              lead.site = decoded;
            } else if (decoded.includes('http')) {
              const httpMatch = decoded.match(/(https?:\/\/[^\s"<>]+)/);
              if (httpMatch && isBusinessWebsiteCandidate(httpMatch[1])) {
                lead.site = httpMatch[1];
              }
            }
          } catch {}
        }

        const addrMatch = combined.match(/((?:Rua|Av\.?|Avenida|Travessa|Praça|Alameda|Rodovia|Estrada|R\.|Av\.|Rod\.|Estr\.|Tv\.|Pça\.)\s[^,]{5,80})/i) ||
          combined.match(/(Centro|Bairro\s+\w+|Zona\s+\w+)\s*[-–—,]\s*\w+/i) ||
          combined.match(/(\d{5}-?\d{3})/);
        if (addrMatch) lead.endereco = addrMatch[1].trim();

        const emailMatch = combined.match(EMAIL_REGEX);
        if (emailMatch) {
          const email = emailMatch.find(e => !BAD_EMAIL.test(e));
          if (email) lead.email = email;
        }

        const cnpjMatch = combined.match(CNPJ_REGEX);
        if (cnpjMatch) lead.cnpj = cnpjMatch[0];

        const instaMatch = combined.match(/instagram\.com\/([a-zA-Z0-9._]+)/i);
        if (instaMatch) lead.instagram = `https://www.instagram.com/${instaMatch[1]}`;

        const fbMatch = combined.match(/facebook\.com\/([a-zA-Z0-9._]+)/i) ||
          combined.match(/fb\.com\/([a-zA-Z0-9._]+)/i);
        if (fbMatch) lead.facebook = `https://www.facebook.com/${fbMatch[1]}`;

        const ttMatch = combined.match(/tiktok\.com\/@([a-zA-Z0-9._]+)/i);
        if (ttMatch) lead.tiktok = `https://www.tiktok.com/@${ttMatch[1]}`;

        const ratingMatch = combined.match(/(\d[.,]\d)\s*(?:estrela|star|avalia)/i);
        if (ratingMatch) lead.avaliacao = ratingMatch[1].replace(',', '.');

        seenNames.add(name.toLowerCase());
        leads.push(lead);
      }

      await new Promise(r => setTimeout(r, 500 + Math.random() * 500));
    } catch (e) {
      console.error('[DuckDuckGo]', e);
    }
  }

  return leads;
}
