import { isSafeUrl } from '../lib/validation';
import { isGoogleOwnedHost, pickEmail, pickCnpj, pickSocialLinks, pickContactUrls } from '../lib/validation';
import { extractDomain } from '../lib/normalizers';
import { applySignalsToLead } from '../lib/validation';
import { getEnrichCache, setEnrichCache } from '../lib/cache';
import type { SearchLead } from '../lib/types';

export async function fetchHtml(url: string): Promise<string> {
  if (!isSafeUrl(url)) return '';

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'pt-BR,pt;q=0.9',
      },
      redirect: 'follow',
    });
    if (!res.ok) return '';
    const contentType = res.headers.get('content-type') || '';
    if (contentType && !contentType.includes('text/html')) return '';
    return await res.text();
  } catch {
    return '';
  } finally {
    clearTimeout(timeout);
  }
}

export async function enrichLead(lead: any): Promise<any> {
  lead.email = lead.email || '';
  lead.instagram = lead.instagram || '';
  lead.facebook = lead.facebook || '';
  lead.tiktok = lead.tiktok || '';
  lead.cnpj = lead.cnpj || '';

  if (!lead.site || lead.site === 'Sem site') return lead;

  try {
    const siteHost = new URL(lead.site).hostname.replace(/^www\./, '').toLowerCase();
    if (isGoogleOwnedHost(siteHost)) {
      lead.site = 'Sem site';
      lead.email = '';
      return lead;
    }
  } catch {
    lead.site = 'Sem site';
    return lead;
  }

  try {
    const domain = extractDomain(lead.site);
    if (domain && getEnrichCache(domain)) {
      const cached = getEnrichCache(domain)!;
      if (!lead.email) lead.email = cached.email;
      if (!lead.cnpj) lead.cnpj = cached.cnpj;
      if (!lead.instagram) lead.instagram = cached.instagram;
      if (!lead.facebook) lead.facebook = cached.facebook;
      if (!lead.tiktok) lead.tiktok = cached.tiktok;
      return lead;
    }

    const homeHtml = await fetchHtml(lead.site);
    if (!homeHtml) return lead;

    applySignalsToLead(lead, homeHtml, lead.site);

    const contactUrls = pickContactUrls(homeHtml, lead.site);
    if (contactUrls.length > 0 && (!lead.email || !lead.cnpj || !lead.instagram || !lead.facebook || !lead.tiktok)) {
      const extraPages = await Promise.all(contactUrls.map(url => fetchHtml(url)));
      extraPages.forEach((html, index) => {
        if (html) applySignalsToLead(lead, html, contactUrls[index]);
      });
    }

    if (!lead.email && domain) {
      const emailPatterns = ['contato', 'comercial', 'sac', 'vendas', 'admin', 'info', 'adm', 'suporte'];
      const safeDomain = domain.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const allContent = [homeHtml, ...contactUrls.map(u => fetchHtml(u))];
      const fullText = (await Promise.all(allContent)).join(' ');
      for (const prefix of emailPatterns) {
        const regex = new RegExp(`(${prefix}@${safeDomain})`, 'gi');
        const match = fullText.match(regex);
        if (match) {
          lead.email = match[0].toLowerCase();
          break;
        }
      }
      if (!lead.email) {
        const emailRegex = new RegExp(`[a-zA-Z0-9._%+-]+@${safeDomain}`, 'g');
        const matches = fullText.match(emailRegex);
        if (matches) lead.email = matches[0].toLowerCase();
      }
    }

    if (domain) {
      setEnrichCache(domain, {
        email: lead.email,
        cnpj: lead.cnpj,
        instagram: lead.instagram,
        facebook: lead.facebook,
        tiktok: lead.tiktok,
      });
    }
  } catch (e) { console.error(e); }

  return lead;
}
