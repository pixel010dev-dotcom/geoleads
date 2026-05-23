import { NextResponse } from 'next/server';
import { createRequestSupabaseClient, getAuthUser, requireFeature } from '@/lib/server-auth';

export const runtime = 'nodejs';

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const BAD_EMAIL_REGEX = /sentry|wix|example|schema|wordpress|localhost|yourdomain|domain\.com|noreply|no-reply/i;
const CNPJ_REGEX = /\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}/;
const HREF_REGEX = /href=["']([^"']+)["']/gi;
const ABSOLUTE_SOCIAL_REGEX = /https?:\/\/(?:www\.)?(?:instagram\.com|facebook\.com|fb\.com|tiktok\.com)\/[^\s"'<>]+/gi;

const EMAIL_FALLBACK_PATTERNS = [
  (d: string) => `contato@${d}`, (d: string) => `comercial@${d}`,
  (d: string) => `sac@${d}`, (d: string) => `admin@${d}`,
  (d: string) => `vendas@${d}`, (d: string) => `adm@${d}`,
  (d: string) => `contato@www.${d}`,
];

const MAPS_UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.6422.165 Mobile Safari/537.36';
const SITE_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

async function fetchHtml(url: string, ua: string = SITE_UA) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4000);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { 'User-Agent': ua, 'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7' }, redirect: 'follow' });
    if (!res.ok) return '';
    const ct = res.headers.get('content-type') || '';
    if (ct && !ct.includes('text/html') && !ct.includes('application/json')) return '';
    return await res.text();
  } catch { return '' } finally { clearTimeout(timeout); }
}

function pickEmail(html: string) {
  const m = Array.from(html.matchAll(EMAIL_REGEX), m => m[0]);
  return m.find(e => !BAD_EMAIL_REGEX.test(e)) || '';
}

function normalizeCnpj(v: string) { return v.replace(/\D/g, '').slice(0, 14); }
function formatCnpj(v: string) {
  const d = normalizeCnpj(v);
  if (d.length !== 14) return '';
  return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12)}`;
}
function validateCnpjChecksum(c: string) {
  const d = c.replace(/\D/g, '').slice(0, 14);
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false;
  let s = 0; for (let i = 0; i < 12; i++) s += +d[i] * (i < 4 ? 5 - i : 13 - i);
  let d1 = 11 - s % 11; if (d1 >= 10) d1 = 0;
  if (+d[12] !== d1) return false;
  s = 0; for (let i = 0; i < 13; i++) s += +d[i] * (i < 5 ? 6 - i : 13 - i);
  let d2 = 11 - s % 11; if (d2 >= 10) d2 = 0;
  return +d[13] === d2;
}
function pickCnpj(html: string) {
  const m = html.match(CNPJ_REGEX);
  if (!m) return '';
  const f = formatCnpj(m[0]);
  return validateCnpjChecksum(f) ? f : '';
}

function normalizeSocialUrl(rawUrl: string, baseUrl: string) {
  try {
    if (!rawUrl || /^(mailto:|tel:|javascript:|#)/i.test(rawUrl)) return null;
    const url = new URL(rawUrl, baseUrl); url.hash = '';
    const host = url.hostname.replace(/^www\./, '').toLowerCase();
    const path = url.pathname.replace(/\/+$/, '');
    if (host === 'instagram.com' && /^\/[a-zA-Z0-9._]+$/.test(path) && !/^\/(p|reel|reels|stories|explore|accounts|privacy|terms)\b/i.test(path)) return { key: 'instagram', url: `https://instagram.com${path}` };
    if (['facebook.com', 'fb.com'].includes(host) && path.length > 1 && !/^\/(sharer|share|dialog|plugins|events|groups|login|privacy|help)\b/i.test(path)) return { key: 'facebook', url: `https://facebook.com${path}` };
    if (host === 'tiktok.com' && /^\/@[a-zA-Z0-9._]+$/.test(path)) return { key: 'tiktok', url: `https://www.tiktok.com${path}` };
  } catch {}
  return null;
}

function pickSocialLinks(html: string, baseUrl: string) {
  const socials: Record<string,string> = { instagram: '', facebook: '', tiktok: '' };
  const candidates = new Set<string>();
  let m: RegExpExecArray | null;
  HREF_REGEX.lastIndex = 0;
  while ((m = HREF_REGEX.exec(html))) candidates.add(m[1]);
  for (const sm of html.matchAll(ABSOLUTE_SOCIAL_REGEX)) candidates.add(sm[0]);
  for (const c of candidates) { const s = normalizeSocialUrl(c, baseUrl); if (s && !socials[s.key]) socials[s.key] = s.url; }
  return socials;
}

function pickMapsData(html: string) {
  const result: any = {};

  // 1. Parse ALL LD+JSON scripts
  const ldRegex = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi;
  let ldMatch: RegExpExecArray | null;
  while ((ldMatch = ldRegex.exec(html)) !== null) {
    try {
      const parsed = JSON.parse(ldMatch[1]);
      const items = Array.isArray(parsed) ? parsed : (parsed['@graph'] || [parsed]);
      for (const item of items) {
        if (!item || !item['@type']) continue;
        const types = Array.isArray(item['@type']) ? item['@type'] : [item['@type']];
        const isBusiness = types.some((t: string) => /LocalBusiness|Organization|Place|Restaurant|Store|Hospital|Clinic|School/i.test(t));
        if (!isBusiness) continue;
        if (item.telephone && !result.telefone) result.telefone = item.telephone;
        if (item.url && !result.site) result.site = item.url;
        if (item.email && !result.email) result.email = item.email;
        if (item.image) {
          const imgs = Array.isArray(item.image) ? item.image : [item.image];
          for (const img of imgs) {
            const src = typeof img === 'string' ? img : img.url;
            if (src && src.startsWith('http')) { result.image = src; break; }
          }
        }
        if (item.sameAs && Array.isArray(item.sameAs)) {
          for (const url of item.sameAs) {
            try {
              const host = new URL(url).hostname.replace('www.', '');
              if (host.startsWith('instagram') && !result.instagram) result.instagram = url;
              else if ((host.startsWith('facebook') || host.startsWith('fb.com')) && !result.facebook) result.facebook = url;
              else if (host.startsWith('tiktok') && !result.tiktok) result.tiktok = url;
            } catch {}
          }
        }
      }
    } catch {}
  }

  // 2. HTML meta/link fallbacks (when LD+JSON doesn't have everything)
  if (!result.telefone) {
    const phoneMeta = html.match(/<meta[^>]+(?:name|property)="?(?:telephone|phone|telefone|contact|dados-de-contato)"?[^>]+content="?([^">]+)"?/i);
    if (phoneMeta) result.telefone = phoneMeta[1].trim();
  }
  if (!result.telefone) {
    const phoneAnchor = html.match(/<a[^>]+href="tel:([^"]+)"[^>]*>/i);
    if (phoneAnchor) result.telefone = phoneAnchor[1];
  }
  if (!result.site) {
    const ogUrl = html.match(/<meta[^>]+property="?og:url"?[^>]+content="?([^">]+)"?/i);
    if (ogUrl) result.site = ogUrl[1];
  }
  if (!result.email) {
    const emailLink = html.match(/<a[^>]+href="mailto:([^"]+)"[^>]*>/i);
    if (emailLink) result.email = emailLink[1];
  }

  return result;
}

export async function POST(request: Request) {
  try {
    const auth = await getAuthUser(request);
    if (!auth) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const { nome, site, cidade, placeUrl } = await request.json();
    let enriched: any = {};

    // 1. Enrich from Maps placeUrl (LD+JSON + HTML fallbacks)
    if (placeUrl && !placeUrl.includes('Sem site')) {
      const mapsHtml = await fetchHtml(placeUrl, MAPS_UA);
      if (mapsHtml) {
        const mapsData = pickMapsData(mapsHtml);
        if (mapsData.telefone) enriched.telefone = mapsData.telefone;
        if (mapsData.site && (!site || site === 'Sem site')) enriched.site = mapsData.site;
        if (mapsData.email) enriched.email = mapsData.email;
        if (mapsData.instagram) enriched.instagram = mapsData.instagram;
        if (mapsData.facebook) enriched.facebook = mapsData.facebook;
        if (mapsData.tiktok) enriched.tiktok = mapsData.tiktok;
        if (mapsData.image) enriched.image = mapsData.image;
      }
    }

    // 2. Enrich from site (if available and different from Maps)
    const finalSite = enriched.site || site;
    if (finalSite && finalSite !== 'Sem site') {
      const domain = (() => { try { const u = new URL(finalSite); return u.hostname.replace(/^www\./, '').toLowerCase(); } catch { return null; } })();
      const html = await fetchHtml(finalSite, SITE_UA);
      if (html) {
        const email = pickEmail(html);
        const cnpj = pickCnpj(html);
        const socials = pickSocialLinks(html, site);
        if (email) enriched.email = email;
        if (cnpj) enriched.cnpj = cnpj;
        if (socials.instagram) enriched.instagram = socials.instagram;
        if (socials.facebook) enriched.facebook = socials.facebook;
        if (socials.tiktok) enriched.tiktok = socials.tiktok;
        // Email fallback
        if (!enriched.email && domain) {
          for (const fn of EMAIL_FALLBACK_PATTERNS) {
            const e = fn(domain);
            if (!BAD_EMAIL_REGEX.test(e)) { enriched.email = e; break; }
          }
        }
      } else if (domain && !enriched.email) {
        for (const fn of EMAIL_FALLBACK_PATTERNS) {
          const e = fn(domain);
          if (!BAD_EMAIL_REGEX.test(e)) { enriched.email = e; break; }
        }
      }
    }

    return NextResponse.json({ success: true, enriched, site, placeUrl });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro interno' }, { status: 500 });
  }
}
