import { NextResponse } from 'next/server';
import { chromium } from 'playwright';
import { createRequestSupabaseClient, getAuthUser, requireFeature } from '@/lib/server-auth';
import { type FeatureKey } from '@/lib/plans';

export const runtime = 'nodejs';

// Controle de extrações simultâneas por usuário
const activeExtractions = new Map<string, number>();
const MAX_CONCURRENT_PER_USER = 2;
const MAX_GLOBAL_CONCURRENT = 10;

function getConcurrentExtractions(userId: string): number {
  return activeExtractions.get(userId) || 0;
}

function getGlobalConcurrent(): number {
  let total = 0;
  for (const count of activeExtractions.values()) total += count;
  return total;
}

// Algoritmo de Distância de Levenshtein para medir similaridade entre palavras
function getLevenshteinDistance(a: string, b: string): number {
  const tmp = [];
  let i, j, val;
  for (i = 0; i <= a.length; i++) {
    tmp[i] = [i];
  }
  for (j = 0; j <= b.length; j++) {
    tmp[0][j] = j;
  }
  for (i = 1; i <= a.length; i++) {
    for (j = 1; j <= b.length; j++) {
      val = (a[i - 1] === b[j - 1]) ? 0 : 1;
      tmp[i][j] = Math.min(
        tmp[i - 1][j] + 1, // deletar
        tmp[i][j - 1] + 1, // inserir
        tmp[i - 1][j - 1] + val // substituir
      );
    }
  }
  return tmp[a.length][b.length];
}

// Nichos comerciais comuns no Brasil para busca difusa (Fuzzy Matching)
const COMMON_NICHES = [
  'advogado', 'dentista', 'academia', 'restaurante', 'pizzaria', 'hamburgueria',
  'sorveteria', 'confeitaria', 'cafeteria', 'estética', 'salão de beleza',
  'cabeleireiro', 'barbearia', 'imobiliária', 'contabilidade', 'petshop',
  'veterinária', 'oficina', 'borracharia', 'autopeças', 'médico',
  'psicólogo', 'nutricionista', 'fisioterapeuta', 'clínica', 'farmácia',
  'supermercado', 'padaria', 'açougue', 'hortifruti', 'escola', 'creche',
  'faculdade', 'hotel', 'pousada', 'motel', 'estúdio', 'crossfit',
  'arquiteto', 'engenheiro', 'construtora', 'marcenaria', 'vidraçaria',
  'serralheria', 'pintor', 'eletricista', 'encanador', 'gesso', 'limpeza',
  'lavanderia', 'floricultura', 'gráfica', 'papelaria', 'assistência técnica',
  'informática', 'celular', 'desentupidora', 'dedetizadora', 'segurança',
  'advocacia', 'odontologia', 'autoescola'
];

// Dicionário de Correções Rápidas (erros ortográficos diretos)
const TYPO_DICTIONARY: Record<string, string> = {
  'adivogado': 'advogado',
  'adevogado': 'advogado',
  'adivogacia': 'advocacia',
  'adevogacia': 'advocacia',
  'denticta': 'dentista',
  'dentixta': 'dentista',
  'restauranti': 'restaurante',
  'acadimia': 'academia',
  'iscola': 'escola',
  'cabelereiro': 'cabeleireiro',
  'cabelerero': 'cabeleireiro',
  'cabeleirero': 'cabeleireiro',
  'farmasia': 'farmácia',
  'ofissina': 'oficina',
  'boracharia': 'borracharia',
  'pisaria': 'pizzaria',
  'pissaria': 'pizzaria',
  'hamburguerria': 'hamburgueria',
  'sorveterria': 'sorveteria',
  'imobliaria': 'imobiliária',
  'imobiliara': 'imobiliária',
  'estetcia': 'estética',
  'esstetica': 'estética',
  'esteticista': 'esteticista',
  'comfeitaria': 'confeitaria',
  'contabelidade': 'contabilidade',
  'medco': 'médico'
};

// Dicionário de abreviações e shorthand de Cidades/Regiões
const LOCATION_DICTIONARY: Record<string, string> = {
  'sp': 'São Paulo',
  'sao paulo': 'São Paulo',
  'sao paolo': 'São Paulo',
  's. paulo': 'São Paulo',
  'sãopaulo': 'São Paulo',
  'rj': 'Rio de Janeiro',
  'rio': 'Rio de Janeiro',
  'rio de janero': 'Rio de Janeiro',
  'bh': 'Belo Horizonte',
  'belo horizonte': 'Belo Horizonte',
  'bsb': 'Brasília',
  'brasilia': 'Brasília',
  'poa': 'Porto Alegre',
  'porto alegre': 'Porto Alegre',
  'floripa': 'Florianópolis',
  'florianopolis': 'Florianópolis',
  'curitba': 'Curitiba',
  'curitiba': 'Curitiba',
  'salvado': 'Salvador',
  'salvador': 'Salvador',
  'fortalesa': 'Fortaleza',
  'fortaleza': 'Fortaleza',
  'recfe': 'Recife',
  'recife': 'Recife',
  'goiana': 'Goiânia',
  'goiania': 'Goiânia',
  'manos': 'Manaus',
  'manaus': 'Manaus',
  'vitora': 'Vitória',
  'vitoria': 'Vitória'
};

function smartNormalizeQuery(keyword: string, location: string) {
  // 1. Limpa espaços e coloca tudo em minúsculas para análise
  let cleanKw = keyword.trim().toLowerCase();
  let cleanLoc = location.trim().toLowerCase();

  // 2. Verifica dicionário ANTES de remover sufixos (evita "sp" virar string vazia)
  if (!LOCATION_DICTIONARY[cleanLoc]) {
    // Remove sufixos de estados comuns digitados na localização (ex: "- sp", ", sp", "sp")
    cleanLoc = cleanLoc
      .replace(/\s*-\s*[a-z]{2}$/i, '')
      .replace(/,\s*[a-z]{2}$/i, '')
      .replace(/\s+[a-z]{2}$/i, '')
      .trim();
  }

  if (LOCATION_DICTIONARY[cleanLoc]) {
    cleanLoc = LOCATION_DICTIONARY[cleanLoc];
  } else {
    // Caso contrário, tentamos capitalizar as palavras da localização de forma elegante
    cleanLoc = cleanLoc
      .split(' ')
      .map(word => {
        if (['de', 'do', 'da', 'dos', 'das', 'e'].includes(word)) return word;
        return word.charAt(0).toUpperCase() + word.slice(1);
      })
      .join(' ');
  }

  // 3. Normalização do Nicho (Keyword)
  // Dividimos em palavras para ver se alguma delas é um erro comum mapeado
  const words = cleanKw.split(/\s+/);
  const correctedWords = words.map(word => {
    // a. Se está no dicionário direto, corrige
    if (TYPO_DICTIONARY[word]) {
      return TYPO_DICTIONARY[word];
    }

    // b. Se não está, busca difusa (Levenshtein) contra a lista de nichos comuns
    let bestMatch = word;
    let minDistance = 999;
    
    // Só aplica para palavras com tamanho razoável (>= 4 letras)
    if (word.length >= 4) {
      for (const niche of COMMON_NICHES) {
        const dist = getLevenshteinDistance(word, niche);
        if (dist < minDistance) {
          minDistance = dist;
          bestMatch = niche;
        }
      }
      
      // Se a distância for muito pequena (1 ou 2 letras), aceita a correção
      if (minDistance <= 2) {
        return bestMatch;
      }
    }

    return word;
  });

  cleanKw = correctedWords.join(' ');
  
  // Capitaliza a keyword para ficar bonita na exibição e na busca
  cleanKw = cleanKw
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  return {
    originalKeyword: keyword,
    originalLocation: location,
    correctedKeyword: cleanKw,
    correctedLocation: cleanLoc
  };
}

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const BAD_EMAIL_REGEX = /sentry|wix|example|schema|wordpress|localhost|yourdomain|domain\.com|noreply|no-reply/i;
const CNPJ_REGEX = /\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}/;
const HREF_REGEX = /href=["']([^"']+)["']/gi;
const ABSOLUTE_SOCIAL_REGEX = /https?:\/\/(?:www\.)?(?:instagram\.com|facebook\.com|fb\.com|tiktok\.com)\/[^\s"'<>]+/gi;

function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 0) return raw;
  // Se já tem DDI (+55), mantém
  if (digits.startsWith('55') && digits.length >= 12) {
    return `+55 (${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9, 13)}`;
  }
  // Se tem DDI diferente
  if (digits.length >= 13 && !digits.startsWith('55')) {
    return `+${digits.slice(0, 2)} (${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9, 13)}`;
  }
  // Só DDD + número (assume Brasil)
  if (digits.length >= 10 && digits.length <= 11) {
    return `+55 (${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
  }
  // Fallback: formata o que tem
  return digits;
}

function normalizeCnpj(value: string) {
  return value.replace(/\D/g, '').slice(0, 14);
}

function validateCnpjChecksum(cnpj: string): boolean {
  const digits = cnpj.replace(/\D/g, '').slice(0, 14);
  if (digits.length !== 14) return false;
  // Rejeita sequências iguais (11.111.111/1111-11)
  if (/^(\d)\1{13}$/.test(digits)) return false;
  // Valida 1º dígito verificador
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += parseInt(digits[i]) * (i < 4 ? 5 - i : 13 - i);
  let digit1 = 11 - (sum % 11);
  if (digit1 >= 10) digit1 = 0;
  if (parseInt(digits[12]) !== digit1) return false;
  // Valida 2º dígito verificador
  sum = 0;
  for (let i = 0; i < 13; i++) sum += parseInt(digits[i]) * (i < 5 ? 6 - i : 13 - i);
  let digit2 = 11 - (sum % 11);
  if (digit2 >= 10) digit2 = 0;
  return parseInt(digits[13]) === digit2;
}

function formatCnpj(value: string) {
  const digits = normalizeCnpj(value);
  if (digits.length !== 14) return '';
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

function safeUrl(rawUrl: string, baseUrl: string) {
  try {
    if (!rawUrl || /^(mailto:|tel:|javascript:|#)/i.test(rawUrl)) return '';
    const url = new URL(rawUrl, baseUrl);
    url.hash = '';
    return url.toString();
  } catch {
    return '';
  }
}

async function fetchHtml(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3500);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
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

function pickEmail(html: string) {
  const matches = Array.from(html.matchAll(EMAIL_REGEX), match => match[0]);
  return matches.find(email => !BAD_EMAIL_REGEX.test(email)) || '';
}

function pickCnpj(html: string) {
  const match = html.match(CNPJ_REGEX);
  if (!match) return '';
  const formatted = formatCnpj(match[0]);
  return validateCnpjChecksum(formatted) ? formatted : '';
}

function normalizeSocialUrl(rawUrl: string, baseUrl: string) {
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

function pickSocialLinks(html: string, baseUrl: string) {
  const socials: Record<'instagram' | 'facebook' | 'tiktok', string> = {
    instagram: '',
    facebook: '',
    tiktok: ''
  };
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

function pickContactUrls(html: string, baseUrl: string) {
  let base: URL;
  try {
    base = new URL(baseUrl);
  } catch {
    return [];
  }

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
    } catch {}
  }

  return urls;
}

function applySignalsToLead(lead: any, html: string, baseUrl: string) {
  if (!lead.email) lead.email = pickEmail(html);
  if (!lead.cnpj) lead.cnpj = pickCnpj(html);

  // Tenta extrair telefone do HTML do site (fallback pra quando o Maps não tem)
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

// Enriquecimento: visita o site da empresa e caca contatos, CNPJ e redes.
const EMAIL_FALLBACK_PATTERNS = [
  (domain: string) => `contato@${domain}`,
  (domain: string) => `comercial@${domain}`,
  (domain: string) => `sac@${domain}`,
  (domain: string) => `admin@${domain}`,
  (domain: string) => `vendas@${domain}`,
  (domain: string) => `adm@${domain}`,
  (domain: string) => `contato@www.${domain}`,
];

// Cache de enriquecimento por domínio (evita refetch do mesmo site)
const enrichCache = new Map<string, { email: string; cnpj: string; instagram: string; facebook: string; tiktok: string }>();

async function enrichLead(lead: any) {
  lead.email = '';
  lead.instagram = '';
  lead.facebook = '';
  lead.tiktok = '';
  lead.cnpj = '';

  if (!lead.site || lead.site === 'Sem site') return lead;

  try {
    const domain = extractDomain(lead.site);
    // 1. Tenta cache
    if (domain && enrichCache.has(domain)) {
      const cached = enrichCache.get(domain)!;
      lead.email = cached.email;
      lead.cnpj = cached.cnpj;
      lead.instagram = cached.instagram;
      lead.facebook = cached.facebook;
      lead.tiktok = cached.tiktok;
      return lead;
    }

    const homeHtml = await fetchHtml(lead.site);
    if (!homeHtml) {
      // Se o site não respondeu, tenta fallback de email por padrões comuns
      if (domain) applyEmailFallback(lead, domain);
      return lead;
    }

    applySignalsToLead(lead, homeHtml, lead.site);

    const contactUrls = pickContactUrls(homeHtml, lead.site);
    if (contactUrls.length > 0 && (!lead.email || !lead.cnpj || !lead.instagram || !lead.facebook || !lead.tiktok)) {
      const extraPages = await Promise.all(contactUrls.map(url => fetchHtml(url)));
      extraPages.forEach((html, index) => {
        if (html) applySignalsToLead(lead, html, contactUrls[index]);
      });
    }

    // 2. Fallback de email se ainda não encontrou
    if (!lead.email && domain) {
      applyEmailFallback(lead, domain);
    }

    // 3. Salva no cache
    if (domain) {
      enrichCache.set(domain, {
        email: lead.email,
        cnpj: lead.cnpj,
        instagram: lead.instagram,
        facebook: lead.facebook,
        tiktok: lead.tiktok,
      });
    }
  } catch (e) { /* Timeout ou site fora do ar - ok, continua */ }

  return lead;
}

function extractDomain(url: string): string | null {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, '').toLowerCase();
  } catch { return null; }
}

function applyEmailFallback(lead: any, domain: string) {
  for (const fn of EMAIL_FALLBACK_PATTERNS) {
    const email = fn(domain);
    if (!BAD_EMAIL_REGEX.test(email)) {
      lead.email = email;
      return;
    }
  }
}

// Converte filterRule string única ou lista para array de regras
function parseFilterRules(filterRule: string): string[] {
  if (!filterRule || filterRule === 'none') return [];
  return filterRule.split(',').map(r => r.trim()).filter(Boolean);
}

// Pré-filtro rápido ANTES de enriquecer (aplicado na extração do Maps)
// phone e site NÃO são filtrados aqui — a segunda passagem (place pages) pode recuperá-los
function preFilter(lead: any, filterRule: string): boolean {
  const rules = parseFilterRules(filterRule);
  if (rules.length === 0) return true;
  return rules.every(rule => {
    if (['phone', 'site'].includes(rule)) return true;
    return true;
  });
}

// Pós-filtro DEPOIS de enriquecer + segunda passagem (para todos os filtros)
function postFilter(lead: any, filterRule: string): boolean {
  const rules = parseFilterRules(filterRule);
  if (rules.length === 0) return true;
  return rules.every(rule => {
    if (rule === 'phone') return lead.telefone && lead.telefone !== 'Não informado';
    if (rule === 'site') return lead.site && lead.site !== 'Sem site';
    if (rule === 'email') return !!lead.email;
    if (rule === 'insta') return !!lead.instagram;
    if (rule === 'face') return !!lead.facebook;
    if (rule === 'tiktok') return !!lead.tiktok;
    if (rule === 'cnpj') return !!lead.cnpj;
    return true;
  });
}

export async function POST(request: Request) {
  let browser;
  let auth: Awaited<ReturnType<typeof getAuthUser>>;
  let extractionDone = false;
  function done() {
    if (!extractionDone) {
      extractionDone = true;
      if (auth) {
        const c = activeExtractions.get(auth.user.id) || 1;
        if (c <= 1) activeExtractions.delete(auth.user.id);
        else activeExtractions.set(auth.user.id, c - 1);
      }
    }
  }

  try {
    auth = await getAuthUser(request);
    if (!auth) {
      return NextResponse.json({ error: 'Nao autenticado. Faca login para extrair leads.' }, { status: 401 });
    }

    // Rate limit: máximo 2 extrações simultâneas por usuário, 10 global
    const concurrent = getConcurrentExtractions(auth.user.id);
    if (concurrent >= MAX_CONCURRENT_PER_USER) {
      return NextResponse.json({
        error: `Você já tem ${concurrent} extrações em andamento. Aguarde uma finalizar antes de iniciar outra.`
      }, { status: 429 });
    }
    if (getGlobalConcurrent() >= MAX_GLOBAL_CONCURRENT) {
      return NextResponse.json({
        error: 'Sistema sobrecarregado. Tente novamente em alguns segundos.'
      }, { status: 503 });
    }
    activeExtractions.set(auth.user.id, concurrent + 1);

    const { keyword: rawKeyword, location: rawLocation, limit, filterRule } = await request.json();
    const requestSupabase = createRequestSupabaseClient(request);

    if (!rawKeyword || !rawLocation) {
      return NextResponse.json({ error: 'Preencha o termo e a cidade.' }, { status: 400 });
    }

    if (filterRule && filterRule !== 'none') {
      const featureMap: Record<string, FeatureKey> = {
        email: 'emailEnrichment',
        cnpj: 'cnpjEnrichment',
        insta: 'socialEnrichment',
        face: 'socialEnrichment',
        tiktok: 'socialEnrichment'
      };
      const rules = parseFilterRules(filterRule);
      for (const rule of rules) {
        const requiredFeature = featureMap[rule];
        if (requiredFeature && !requireFeature(auth.planId, requiredFeature)) {
          return NextResponse.json({
            error: `Filtro "${rule}" exige plano superior. Faca upgrade para usar.`
          }, { status: 403 });
        }
      }
    }

    if (auth.tokens <= 0) {
      return NextResponse.json({ error: 'Sem tokens disponiveis. Compre mais tokens para continuar extraindo.' }, { status: 402 });
    }

    // Normalização Inteligente (Tolerância a erros de digitação e abreviações)
    const { correctedKeyword, correctedLocation } = smartNormalizeQuery(rawKeyword, rawLocation);
    const keyword = correctedKeyword;
    const location = correctedLocation;

    const requestedLimit = Math.max(1, Number(limit) || 10);
    const targetLimit = Math.min(requestedLimit, 500, auth.tokens);
    if (requestedLimit > auth.tokens) {
      return NextResponse.json({
        error: `Saldo insuficiente. Você pediu ${requestedLimit} leads, mas tem ${auth.tokens} tokens.`
      }, { status: 402 });
    }

    const MAX_TIME = 50000; // 50 segundos
    const startTime = Date.now();

    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
      viewport: { width: 1920, height: 1080 },
      locale: 'pt-BR',
      timezoneId: 'America/Sao_Paulo',
      geolocation: { latitude: -23.5505, longitude: -46.6333 },
      permissions: ['geolocation'],
    });
    const page = await context.newPage();
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
    });

    // Bloqueia recursos não essenciais de forma stealth (204 em vez de abort)
    await page.route('**/*.{png,jpg,jpeg,gif,svg,woff,woff2}', route => route.fulfill({ status: 204, body: '' }));

    // Cookies de consentimento proativos (evita popup de cookies)
    await page.context().addCookies([
      { name: 'CONSENT', value: 'YES+cb.20250522-13-p0.en+FX+937', domain: '.google.com', path: '/' },
      { name: 'SOCS', value: 'CAISHAgENhB0Dcm9sZQ==', domain: '.google.com', path: '/' },
    ]);

    const query = encodeURIComponent(`${keyword} em ${location}`);
    await page.goto(`https://www.google.com/maps/search/${query}`, { 
      waitUntil: 'domcontentloaded',
      timeout: 15000 
    });
    
    // Detecta bloqueio do Google (CAPTCHA ou página de bloqueio)
    const pageTitle = await page.title().catch(() => '');
    const pageUrl = page.url();
    if (pageUrl.includes('sorry') || pageUrl.includes('captcha') || pageTitle.toLowerCase().includes('captcha') || pageTitle.toLowerCase().includes('sorry')) {
      await browser.close();
      done();
      return NextResponse.json({
        success: true,
        leads: [],
        message: 'Google bloqueou a busca temporariamente. Tente novamente em alguns minutos.',
        stats: { correctedKeyword, correctedLocation }
      });
    }

    // Cookies de consentimento já foram definidos proativamente
    // Logo após a navegação, verifica se o feed carregou
    try {
      await page.waitForSelector('div[role="feed"]', { timeout: 10000 });
    } catch(e) {
      await browser.close();
      done();
      return NextResponse.json({ 
        success: true, 
        leads: [], 
        message: 'Google Maps não carregou resultados para essa busca.',
        stats: {
          correctedKeyword,
          correctedLocation
        }
      });
    }

    await page.waitForTimeout(1500 + Math.random() * 1000);

    const validLeads: any[] = [];
    const allEnrichedLeads: any[] = [];
    const scrapedNames = new Set<string>();
    const scrapedPhones = new Set<string>();
    let scrollAttempts = 0;
    let emptyScrolls = 0;

    // Loop Principal Otimizado
    while (validLeads.length < targetLimit && allEnrichedLeads.length < targetLimit * 2 && (Date.now() - startTime) < MAX_TIME && scrollAttempts < 30) {
      
      // 1. Extrai todos os cards visíveis da tela
      const rawChunk = await page.evaluate(() => {
        const chunk: any[] = [];
        const items = document.querySelectorAll('div[role="feed"] > div > div > a[href*="/maps/place"]');
        
        for (const anchor of items) {
          try {
            const container = anchor.closest('div[role="feed"] > div > div') || anchor.parentElement;
            if (!container) continue;
            
            const nameEl = container.querySelector('.fontHeadlineSmall') || container.querySelector('[class*="fontHeadline"]');
            if (!nameEl) continue;
            
            const nome = (nameEl as HTMLElement).innerText?.trim();
            if (!nome || nome.length < 2) continue;

            const text = (container as HTMLElement).innerText || '';
            
            // Telefone - extração híbrida avançada
            let telefone = 'Não informado';
            
            // 1. Procura por botões ou links de ligar com aria-label (ex: "Ligar para +55 11 99999-9999")
            const els = container.querySelectorAll('[aria-label]');
            for (const el of els) {
              const label = el.getAttribute('aria-label') || '';
              if (label.includes('Ligar') || label.includes('Call') || label.includes('ligar')) {
                const match = label.match(/\+?\d[\d\s\-\(\)]{8,18}\d/);
                if (match) {
                  telefone = match[0].trim();
                  break;
                }
              }
            }

            // 2. Fallback: procura por atributo data-phone-number
            if (telefone === 'Não informado') {
              const phoneBtn = container.querySelector('[data-phone-number]');
              if (phoneBtn) {
                const p = phoneBtn.getAttribute('data-phone-number');
                if (p) telefone = p.trim();
              }
            }

            // 3. Fallback: regex no texto do card
            if (telefone === 'Não informado') {
              const telMatch = text.match(/\(?\d{2,3}\)?\s?\d{4,5}[\s-]?\d{4}/);
              if (telMatch) {
                telefone = telMatch[0];
              }
            }

            // 4. Fallback: botão de telefone no card (internacional)
            if (telefone === 'Não informado') {
              const phoneEl = container.querySelector('button[data-value][data-tooltip*="telefone"], button[data-value][data-tooltip*="phone"]');
              if (phoneEl) {
                const v = phoneEl.getAttribute('data-value');
                if (v) telefone = v.trim();
              }
            }

            // 5. Fallback: links tel:
            if (telefone === 'Não informado') {
              const telLink = container.querySelector('a[href^="tel:"]');
              if (telLink) {
                const t = telLink.getAttribute('href')?.replace('tel:', '').trim();
                if (t) telefone = t;
              }
            }

            // 6. Fallback: WhatsApp links
            if (telefone === 'Não informado') {
              const waLink = container.querySelector('a[href*="wa.me"], a[href*="whatsapp.com"]');
              if (waLink) {
                const href = waLink.getAttribute('href') || '';
                const wm = href.match(/(\d{10,15})/);
                if (wm) telefone = wm[1];
              }
            }

            // 7. Fallback: itemprop telephone
            if (telefone === 'Não informado') {
              const item = container.querySelector('[itemprop="telephone"]');
              if (item) telefone = (item as HTMLElement).innerText?.trim() || '';
            }

            // Avaliação via aria-label semântico (mais preciso que regex)
            let avaliacao = 'N/A';
            const ratingEl = container.querySelector('[role="img"][aria-label*="estrelas"], [role="img"][aria-label*="stars"]');
            if (ratingEl) {
              const ariaLabel = ratingEl.getAttribute('aria-label') || '';
              const rMatch = ariaLabel.match(/(\d[.,]\d)/);
              if (rMatch) avaliacao = rMatch[1].replace(',', '.');
            }
            if (avaliacao === 'N/A') {
              const rMatch = text.match(/(\d[.,]\d)\s*(?:estrela|star|\(|$)/i);
              if (rMatch) avaliacao = rMatch[1].replace(',', '.');
            }

            // Categoria (tipo de negócio ex: "Restaurante italiano")
            let categoria = '';
            const textParts = text.split('\n').filter(p => p.trim());
            for (let i = 0; i < textParts.length; i++) {
              const part = textParts[i].trim();
              if (part.includes('·') || part.includes('R$')) {
                const catMatch = part.match(/^(.+?)\s*(?:·|R\$)/);
                if (catMatch) categoria = catMatch[1].trim();
                break;
              }
            }

            // Endereço
            let endereco = '';
            for (const part of textParts) {
              const addrMatch = part.match(/((?:Rua|Av\.?|Avenida|Travessa|Praça|Alameda|Rodovia)\s.+)/i);
              if (addrMatch) { endereco = addrMatch[1]; break; }
            }
            if (!endereco) {
              const addrMatch = text.match(/([A-Za-zÀ-ÿ\s]+\d+\s*-\s*[A-Za-zÀ-ÿ\s]+,\s*[A-Za-zÀ-ÿ\s]+-[A-Z]{2})/);
              if (addrMatch) endereco = addrMatch[1];
            }

            // Horários (ex: "Aberto ⋅ Fecha às 22:00")
            let horarios = '';
            const hoursMatch = text.match(/(Aberto|Fechado)(?:\s*⋅\s*)(.+?)(?:\.|$)/i);
            if (hoursMatch) horarios = hoursMatch[0].trim();

            // CEP
            const cepMatch = text.match(/\d{5}-?\d{3}/);
            const cep = cepMatch ? cepMatch[0] : '';

            // Review count
            const reviewCountMatch = text.match(/\((\d[\d.]*)\)\s*(?:avalia|review)/i);
            const reviewCount = reviewCountMatch ? reviewCountMatch[1] : '';

            // Site oficial
            let site = 'Sem site';
            const allLinks = container.querySelectorAll('a[href]');
            for (const link of allLinks) {
              const href = (link as HTMLAnchorElement).href;
              if (href && !href.includes('google.com') && !href.includes('maps') && href.startsWith('http')) {
                site = href;
                break;
              }
            }

            // Place URL
            const placeUrl = (anchor as HTMLAnchorElement).href || '';
            
            chunk.push({ nome, telefone, avaliacao, site, placeUrl, cep, reviewCount, categoria, endereco, horarios });
          } catch(e) {}
        }
        return chunk;
      });

      // 2. Filtra novos leads (não repetidos) — nome composto + telefone
      const newLeads = rawChunk.filter(l => {
        if (scrapedNames.has(l.nome)) return false;
        if (l.telefone !== 'Não informado' && scrapedPhones.has(l.telefone)) return false;
        return true;
      });
      newLeads.forEach(l => {
        scrapedNames.add(l.nome);
        if (l.telefone !== 'Não informado') scrapedPhones.add(l.telefone);
      });

      if (newLeads.length === 0) {
        emptyScrolls++;
        if (emptyScrolls >= 5) break; // Sem mais resultados
      } else {
        emptyScrolls = 0;
      }

      if (newLeads.length > 0) {
        // 3. Aplica PRÉ-FILTRO (rápido, sem visitar sites)
        const preFiltered = newLeads.filter(l => preFilter(l, filterRule));
        
        if (preFiltered.length > 0) {
          // 4. Enriquece APENAS os que passaram no pré-filtro (economiza tempo!)
          const enriched = await Promise.all(preFiltered.map(lead => {
            // Normaliza telefone antes de enriquecer
            if (lead.telefone && lead.telefone !== 'Não informado') lead.telefone = normalizePhone(lead.telefone);
            return enrichLead(lead);
          }));
          
          // 5. Acumula TODOS os leads enriquecidos (segunda passada roda antes do pós-filtro)
          for (const lead of enriched) {
            allEnrichedLeads.push(lead);
            if (allEnrichedLeads.length >= targetLimit * 2) break;
          }
        }
      }

      // Scroll para carregar mais resultados
      if (allEnrichedLeads.length < targetLimit * 2) {
        await page.evaluate(() => {
          const feed = document.querySelector('div[role="feed"]');
          if (feed) feed.scrollBy(0, 1200 + Math.random() * 600);
        });
        await page.waitForTimeout(1200 + Math.random() * 800);
      }
      scrollAttempts++;
    }

    // Segunda passada: extrair telefone de leads que ficaram sem (info panel do Maps)
    // Roda ANTES do pós-filtro para maximizar a coleta independente do filtro escolhido
    const leadsSemTelefone = allEnrichedLeads.filter(l => l.telefone === 'Não informado' && l.placeUrl);
    const BATCH_SIZE = 5;
    const MAX_SECOND_PASS = Math.min(leadsSemTelefone.length, 30);
    for (let i = 0; i < MAX_SECOND_PASS; i += BATCH_SIZE) {
      const batch = leadsSemTelefone.slice(i, i + BATCH_SIZE);
      await Promise.all(batch.map(async (lead) => {
        let tab: any = null;
        try {
          tab = await context.newPage();
          await tab.goto(lead.placeUrl, {
            waitUntil: 'networkidle',
            timeout: 12000,
            referer: 'https://www.google.com/maps'
          });
          await tab.waitForSelector('button[data-item-id*="phone"], a[href^="tel:"], [data-phone-number]', {
            timeout: 8000
          }).catch(() => {});
          await tab.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
          await tab.waitForTimeout(300);
          const extraData = await tab.evaluate(() => {
            const result: any = { telefone: '', site: '', instagram: '', facebook: '', tiktok: '', endereco: '', horarios: '' };
            const text = document.body?.innerText || '';

            const phoneSelectors = [
              'button[data-item-id*="phone"]', 'a[data-item-id*="phone"]', 'a[href^="tel:"]',
              '[data-phone-number]', 'button[aria-label*="telefone"]', 'button[aria-label*="phone"]',
              '[data-tooltip*="telefone"]', '[data-tooltip*="phone"]',
            ];
            for (const sel of phoneSelectors) {
              const el = document.querySelector(sel);
              if (!el) continue;
              const v = el.getAttribute('aria-label') || el.getAttribute('data-phone-number') ||
                        el.getAttribute('href')?.replace('tel:', '') || el.getAttribute('data-value') ||
                        (el as HTMLElement).innerText;
              if (v) { const m = v.match(/(\+?\d[\d\s\-\(\)]{8,18}\d)/); if (m) { result.telefone = m[1].trim(); break; } }
            }
            if (!result.telefone) { const m = text.match(/\(?\d{2,3}\)?\s?\d{4,5}[\s-]?\d{4}/); if (m) result.telefone = m[0]; }

            const siteEl = document.querySelector('a[data-item-id*="authority"], a[href^="http"]:not([href*="google"]):not([href*="maps"])');
            if (siteEl) { const h = siteEl.getAttribute('href') || ''; if (h) result.site = h; }

            const html = document.body?.innerHTML || '';
            const socialRegex = /https?:\/\/(?:www\.)?(instagram\.com|facebook\.com|fb\.com|tiktok\.com)\/[^\s"'<>]+/gi;
            for (const m of html.matchAll(socialRegex)) {
              const url = m[0].replace(/["'<>].*$/, '');
              if (url.includes('instagram.com') && !result.instagram) result.instagram = url;
              if ((url.includes('facebook.com') || url.includes('fb.com')) && !result.facebook) result.facebook = url;
              if (url.includes('tiktok.com') && !result.tiktok) result.tiktok = url;
            }

            const addrEl = document.querySelector('[data-item-id*="address"]');
            if (addrEl) result.endereco = (addrEl as HTMLElement).innerText?.trim() || '';

            const hMatch = text.match(/(Aberto|Fechado)(?:\s*⋅\s*)(.+?)(?:\.|$)/i);
            if (hMatch) result.horarios = hMatch[0].trim();

            return result;
          });
          if (extraData.telefone) lead.telefone = normalizePhone(extraData.telefone);
          if (extraData.site && (!lead.site || lead.site === 'Sem site')) lead.site = extraData.site;
          if (extraData.instagram && !lead.instagram) lead.instagram = extraData.instagram;
          if (extraData.facebook && !lead.facebook) lead.facebook = extraData.facebook;
          if (extraData.tiktok && !lead.tiktok) lead.tiktok = extraData.tiktok;
          if (extraData.endereco && !lead.endereco) lead.endereco = extraData.endereco;
          if (extraData.horarios && !lead.horarios) lead.horarios = extraData.horarios;
        } catch {
        } finally {
          if (tab) try { await tab.close(); } catch {}
        }
      }));
    }

    // Agora aplica o PÓS-FILTRO em todos os leads enriquecidos + segunda passada
    for (const lead of allEnrichedLeads) {
      if (postFilter(lead, filterRule)) {
        validLeads.push(lead);
        if (validLeads.length >= targetLimit) break;
      }
    }

    await browser.close();
    browser = null;
    done();

    const gastos = validLeads.length;
    if (auth && gastos > 0) {
      let deducted = false;
      const { error: deductError } = await requestSupabase.rpc('deduct_tokens', {
        p_user_id: auth.user.id,
        p_amount: gastos
      });
      if (deductError && !deductError.message?.includes('does not exist')) {
        console.warn('RPC deduct_tokens falhou, usando fallback:', deductError.message);
      }
      if (!deductError) {
        deducted = true;
      }
      if (!deducted) {
        const { error: fallbackError } = await requestSupabase
          .from('profiles')
          .update({ tokens: Math.max(0, auth.tokens - gastos) })
          .eq('id', auth.user.id)
          .gte('tokens', gastos);
        if (fallbackError) {
          console.error('Falha ao deduzir tokens (fallback):', fallbackError.message);
        }
      }
    }

    // Salva histórico da extração
    try {
      await requestSupabase.from('extraction_history').insert({
        user_id: auth.user.id,
        keyword,
        location,
        filter_rule: filterRule || '',
        leads_found: validLeads.length,
        leads_requested: targetLimit,
        tokens_spent: gastos,
        search_time_seconds: Math.round((Date.now() - startTime) / 1000),
      });
    } catch (histErr) {
      // Falha ao salvar histórico não deve quebrar a extração
    }

    return NextResponse.json({ 
      success: true, 
      leads: validLeads,
      stats: {
        total: validLeads.length,
        scanned: scrapedNames.size,
        time: Math.round((Date.now() - startTime) / 1000),
        correctedKeyword,
        correctedLocation,
        tokensSpent: gastos,
        tokensRemaining: auth ? Math.max(0, auth.tokens - gastos) : 0
      }
    });

  } catch (error: any) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("ERRO NO MOTOR:", msg);
    if (browser) { try { await browser.close(); } catch {} }
    done();
    return NextResponse.json({ error: 'Erro ao extrair: ' + msg }, { status: 500 });
  }
}
