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

async function fetchHtml(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4000);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { 'User-Agent': 'Mozilla/5.0' }, redirect: 'follow' });
    if (!res.ok) return '';
    const ct = res.headers.get('content-type') || '';
    if (ct && !ct.includes('text/html')) return '';
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

function pickMapsLdJson(html: string) {
  const ldMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/i);
  if (!ldMatch) return {};
  try {
    const parsed = JSON.parse(ldMatch[1]);
    const data = parsed['@graph'] ? parsed['@graph'].find((g: any) => g['@type'] === 'LocalBusiness') : parsed;
    if (!data) return {};
    const result: any = {};
    if (data.telephone) result.telefone = data.telephone;
    if (data.url) result.site = data.url;
    if (data.sameAs && Array.isArray(data.sameAs)) {
      for (const url of data.sameAs) {
        const host = (() => { try { return new URL(url).hostname; } catch { return ''; } })();
        if (host.includes('instagram')) result.instagram = url;
        else if (host.includes('facebook')) result.facebook = url;
        else if (host.includes('tiktok')) result.tiktok = url;
      }
    }
    if (data.email) result.email = data.email;
    return result;
  } catch { return {}; }
}

export async function POST(request: Request) {
  try {
    const auth = await getAuthUser(request);
    if (!auth) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const { nome, site, cidade, placeUrl } = await request.json();
    let enriched: any = {};

    // 1. Enrich from Maps placeUrl (LD+JSON)
    if (placeUrl && !placeUrl.includes('Sem site')) {
      const mapsHtml = await fetchHtml(placeUrl);
      if (mapsHtml) {
        const mapsData = pickMapsLdJson(mapsHtml);
        if (mapsData.telefone) enriched.telefone = mapsData.telefone;
        if (mapsData.site && (!site || site === 'Sem site')) enriched.site = mapsData.site;
        if (mapsData.email) enriched.email = mapsData.email;
        if (mapsData.instagram) enriched.instagram = mapsData.instagram;
        if (mapsData.facebook) enriched.facebook = mapsData.facebook;
        if (mapsData.tiktok) enriched.tiktok = mapsData.tiktok;
      }
    }

    // 2. Enrich from site (if available and different from Maps)
    if (site && site !== 'Sem site') {
      const domain = (() => { try { const u = new URL(site); return u.hostname.replace(/^www\./, '').toLowerCase(); } catch { return null; } })();
      const html = await fetchHtml(site);
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
