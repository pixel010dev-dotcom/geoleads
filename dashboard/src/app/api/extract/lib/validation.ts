const BAD_EMAIL_REGEX = /sentry|wix|example|schema|wordpress|localhost|yourdomain|domain\.com|noreply|no-reply/i;
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const CNPJ_REGEX = /\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}/;
const URL_REGEX = /https?:\/\/[^\s"'<>\\\])]+/gi;
const HREF_REGEX = /href=["']([^"']+)["']/gi;
const ABSOLUTE_SOCIAL_REGEX = /https?:\/\/(?:www\.)?(?:instagram\.com|facebook\.com|fb\.com|tiktok\.com)\/[^\s"'<>]+/gi;

function isValidBRDDD(ddd: number): boolean {
  return (ddd >= 11 && ddd <= 19) || (ddd >= 21 && ddd <= 28) ||
    (ddd >= 31 && ddd <= 38) || (ddd >= 41 && ddd <= 49) ||
    (ddd >= 51 && ddd <= 59) || (ddd >= 61 && ddd <= 69) ||
    (ddd >= 71 && ddd <= 79) || (ddd >= 81 && ddd <= 89) ||
    (ddd >= 91 && ddd <= 99);
}

function addBrazilianMobileDigit(digits: string): string {
  if (digits.length === 10) {
    const ddd = parseInt(digits.slice(0, 2), 10);
    if (isValidBRDDD(ddd)) {
      return digits.slice(0, 2) + '9' + digits.slice(2);
    }
  }
  if (digits.startsWith('55') && digits.length === 12) {
    const ddd = parseInt(digits.slice(2, 4), 10);
    if (isValidBRDDD(ddd)) {
      return digits.slice(0, 4) + '9' + digits.slice(4);
    }
  }
  return digits;
}

export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 0) return raw;
  if (/(\d)\1{5,}/.test(digits)) return 'Não informado';

  const normalized = addBrazilianMobileDigit(digits);

  if (normalized.startsWith('55') && normalized.length >= 12) {
    if (normalized.length === 12) {
      return `+55 (${normalized.slice(2, 4)}) ${normalized.slice(4, 8)}-${normalized.slice(8, 12)}`;
    }
    return `+55 (${normalized.slice(2, 4)}) ${normalized.slice(4, 9)}-${normalized.slice(9, 13)}`;
  }
  if (normalized.length >= 13 && !normalized.startsWith('55')) {
    if (normalized.length === 13) {
      return `+${normalized.slice(0, 2)} (${normalized.slice(2, 4)}) ${normalized.slice(4, 8)}-${normalized.slice(8, 12)}`;
    }
    return `+${normalized.slice(0, 2)} (${normalized.slice(2, 4)}) ${normalized.slice(4, 9)}-${normalized.slice(9, 13)}`;
  }
  if (normalized.length >= 10 && normalized.length <= 11) {
    const ddd = parseInt(normalized.slice(0, 2), 10);
    if (isValidBRDDD(ddd)) {
      if (normalized.length === 10) {
        return `+55 (${normalized.slice(0, 2)}) ${normalized.slice(2, 6)}-${normalized.slice(6, 10)}`;
      }
      return `+55 (${normalized.slice(0, 2)}) ${normalized.slice(2, 7)}-${normalized.slice(7, 11)}`;
    }
    return `+${normalized.slice(0, 2)} ${normalized.slice(2)}`;
  }
  return 'Não informado';
}

export function isValidBrazilianPhone(raw: string): boolean {
  const digits = raw.replace(/\D/g, '');
  const local = digits.startsWith('55') && digits.length >= 12 ? digits.slice(2) : digits;
  if (local.length < 10 || local.length > 11) return false;
  if (/^(\d)\1+$/.test(local)) return false;
  if (/(\d)\1{5,}/.test(local)) return false;
  const ddd = parseInt(local.slice(0, 2), 10);
  return isValidBRDDD(ddd);
}

export function normalizeCnpj(value: string): string {
  return value.replace(/\D/g, '').slice(0, 14);
}

export function validateCnpjChecksum(cnpj: string): boolean {
  const digits = cnpj.replace(/\D/g, '').slice(0, 14);
  if (digits.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(digits)) return false;
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += parseInt(digits[i]) * (i < 4 ? 5 - i : 13 - i);
  let digit1 = 11 - (sum % 11);
  if (digit1 >= 10) digit1 = 0;
  if (parseInt(digits[12]) !== digit1) return false;
  sum = 0;
  for (let i = 0; i < 13; i++) sum += parseInt(digits[i]) * (i < 5 ? 6 - i : 13 - i);
  let digit2 = 11 - (sum % 11);
  if (digit2 >= 10) digit2 = 0;
  return parseInt(digits[13]) === digit2;
}

export function formatCnpj(value: string): string {
  const digits = normalizeCnpj(value);
  if (digits.length !== 14) return '';
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

export function pickEmail(html: string): string {
  const matches = Array.from(html.matchAll(EMAIL_REGEX), match => match[0]);
  return matches.find(email => !BAD_EMAIL_REGEX.test(email)) || '';
}

export function pickCnpj(html: string): string {
  const match = html.match(CNPJ_REGEX);
  if (!match) return '';
  const formatted = formatCnpj(match[0]);
  return validateCnpjChecksum(formatted) ? formatted : '';
}

export function isGoogleOwnedHost(host: string): boolean {
  return host.includes('google.') || host.includes('googleapis.') || host.includes('gstatic.') ||
    host.includes('googleusercontent.') || host.includes('ggpht.') || host.includes('googlevideo.') ||
    host.includes('withgoogle.') || host.includes('schema.org') || host.includes('w3.org');
}

export function isBusinessWebsiteCandidate(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl);
    const host = url.hostname.replace(/^www\./, '').toLowerCase();
    if (!/^https?:$/.test(url.protocol)) return false;
    if (isGoogleOwnedHost(host)) return false;
    if (host.includes('youtube.') || host.includes('youtu.be') || host.includes('maps.app.goo.gl')) return false;
    if (host.includes('instagram.com') || host.includes('facebook.com') || host.includes('fb.com')) return false;
    if (host.includes('tiktok.com') || host.includes('whatsapp.com') || host.includes('wa.me')) return false;
    return true;
  } catch {
    return false;
  }
}

export function isSafeUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
    const hostname = u.hostname.toLowerCase();
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0' ||
        hostname === '[::1]' || hostname.endsWith('.local') || hostname.endsWith('.internal')) return false;
    const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(hostname);
    if (ipv4) {
      const a = parseInt(ipv4[1]), b = parseInt(ipv4[2]);
      if (a === 10) return false;
      if (a === 172 && b >= 16 && b <= 31) return false;
      if (a === 192 && b === 168) return false;
      if (a === 169 && b === 254) return false;
      if (a === 127) return false;
    }
    return true;
  } catch { return false; }
}

export function safeUrl(rawUrl: string, baseUrl: string): string {
  try {
    if (!rawUrl || /^(mailto:|tel:|javascript:|#)/i.test(rawUrl)) return '';
    const url = new URL(rawUrl, baseUrl);
    url.hash = '';
    return url.toString();
  } catch {
    return '';
  }
}

export function normalizeSocialUrl(rawUrl: string, baseUrl: string): { key: string; url: string } | null {
  const fullUrl = safeUrl(rawUrl, baseUrl);
  if (!fullUrl) return null;
  try {
    const url = new URL(fullUrl);
    const host = url.hostname.replace(/^www\./, '').toLowerCase();
    const path = url.pathname.replace(/\/+$/, '');
    if (host === 'instagram.com') {
      const blocked = /^\/(p|reel|reels|stories|explore|accounts|privacy|terms)\b/i.test(path);
      if (!blocked && /^\/[a-zA-Z0-9._]+$/.test(path)) return { key: 'instagram', url: `https://instagram.com${path}` };
    }
    if (host === 'facebook.com' || host === 'fb.com') {
      const blocked = /^\/(sharer|share|dialog|plugins|events|groups|login|privacy|help)\b/i.test(path);
      if (!blocked && path.length > 1) {
        const profileId = path === '/profile.php' ? url.searchParams.get('id') : '';
        const query = profileId ? `?id=${profileId}` : '';
        return { key: 'facebook', url: `https://facebook.com${path}${query}` };
      }
    }
    if (host === 'tiktok.com') {
      if (/^\/@[a-zA-Z0-9._]+$/.test(path)) return { key: 'tiktok', url: `https://www.tiktok.com${path}` };
    }
  } catch {
    return null;
  }
  return null;
}

export function pickSocialLinks(html: string, baseUrl: string): Record<'instagram' | 'facebook' | 'tiktok', string> {
  const socials: Record<'instagram' | 'facebook' | 'tiktok', string> = { instagram: '', facebook: '', tiktok: '' };
  const candidates = new Set<string>();
  let match: RegExpExecArray | null;
  HREF_REGEX.lastIndex = 0;
  while ((match = HREF_REGEX.exec(html))) candidates.add(match[1]);
  for (const socialMatch of html.matchAll(ABSOLUTE_SOCIAL_REGEX)) candidates.add(socialMatch[0]);
  for (const candidate of candidates) {
    const social = normalizeSocialUrl(candidate, baseUrl);
    if (social && !socials[social.key as keyof typeof socials]) {
      socials[social.key as keyof typeof socials] = social.url;
    }
  }
  return socials;
}

export function pickContactUrls(html: string, baseUrl: string): string[] {
  let base: URL;
  try { base = new URL(baseUrl); } catch { return []; }
  const urls: string[] = [];
  let match: RegExpExecArray | null;
  HREF_REGEX.lastIndex = 0;
  while ((match = HREF_REGEX.exec(html))) {
    const fullUrl = safeUrl(match[1], baseUrl);
    if (!fullUrl) continue;
    try {
      const url = new URL(fullUrl);
      if (url.hostname !== base.hostname) continue;
      const path = decodeURIComponent(url.pathname).toLowerCase();
      if (!/(contato|contact|sobre|about|quem-somos|institucional|empresa|localizacao|unidades)/i.test(path)) continue;
      if (!urls.includes(url.toString())) urls.push(url.toString());
      if (urls.length >= 2) break;
    } catch (e) { console.error(e); }
  }
  return urls;
}

export function applySignalsToLead(lead: any, html: string, baseUrl: string) {
  if (!lead.email) lead.email = pickEmail(html);
  if (!lead.cnpj) lead.cnpj = pickCnpj(html);
  if (!lead.telefone || lead.telefone === 'Não informado') {
    const text = html.replace(/<[^>]*>/g, ' ');
    const telMatch = text.match(/\(?\d{2,3}\)?\s?\d{4,5}[\s-]?\d{4}/);
    if (telMatch) lead.telefone = normalizePhone(telMatch[0]);
  }
  const socials = pickSocialLinks(html, baseUrl);
  if (!lead.instagram) lead.instagram = socials.instagram;
  if (!lead.facebook) lead.facebook = socials.facebook;
  if (!lead.tiktok) lead.tiktok = socials.tiktok;
}

export function decodeMapsPayloadText(raw: string): string {
  let text = raw
    .replace(/\\u003d/g, '=')
    .replace(/\\u0026/g, '&')
    .replace(/\\u002f/gi, '/')
    .replace(/\\\//g, '/')
    .replace(/&amp;/g, '&');
  for (let i = 0; i < 2; i++) {
    try {
      const decoded = decodeURIComponent(text);
      if (decoded === text) break;
      text = decoded;
    } catch { break; }
  }
  return text;
}

export function cleanMapsUrlCandidate(rawUrl: string): string {
  let candidate = decodeMapsPayloadText(rawUrl)
    .replace(/^[\["']+/, '')
    .replace(/[\]"'<>\\]+$/g, '')
    .replace(/[),.;]+$/g, '');
  try {
    const url = new URL(candidate);
    const host = url.hostname.replace(/^www\./, '').toLowerCase();
    if (host.endsWith('google.com') && url.pathname === '/url') {
      const redirected = url.searchParams.get('q') || url.searchParams.get('url');
      if (redirected) candidate = redirected;
    }
  } catch (e) { console.error(e); }
  return candidate;
}

export function mergeMapsPlaceExtraData(target: any, source: any) {
  if (!target.telefone && source.telefone) target.telefone = source.telefone;
  if (!target.site && source.site) target.site = source.site;
  if (!target.instagram && source.instagram) target.instagram = source.instagram;
  if (!target.facebook && source.facebook) target.facebook = source.facebook;
  if (!target.tiktok && source.tiktok) target.tiktok = source.tiktok;
  if (!target.endereco && source.endereco) target.endereco = source.endereco;
  if (!target.horarios && source.horarios) target.horarios = source.horarios;
}
