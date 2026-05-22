import { NextResponse } from 'next/server';
import { chromium } from 'playwright';
import { createRequestSupabaseClient, getAuthUser, requireFeature } from '@/lib/server-auth';
import { type FeatureKey } from '@/lib/plans';

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

  // 2. Remove sufixos de estados comuns digitados na localização (ex: "- sp", ", sp", "sp")
  cleanLoc = cleanLoc
    .replace(/\s*-\s*[a-z]{2}$/i, '') // ex: "- sp" ou "- rj"
    .replace(/,\s*[a-z]{2}$/i, '')   // ex: ", sp" ou ", rj"
    .replace(/\s+[a-z]{2}$/i, '')    // ex: " sp" ou " rj" no fim da frase se a localização for maior
    .trim();

  // Se a localização inteira sobrou apenas como sigla do estado (ex: "sp"), resolvemos pelo dicionário
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

function normalizeCnpj(value: string) {
  return value.replace(/\D/g, '').slice(0, 14);
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
  return match ? formatCnpj(match[0]) : '';
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

  const socials = pickSocialLinks(html, baseUrl);
  if (!lead.instagram) lead.instagram = socials.instagram;
  if (!lead.facebook) lead.facebook = socials.facebook;
  if (!lead.tiktok) lead.tiktok = socials.tiktok;
}

// Enriquecimento: visita o site da empresa e caca contatos, CNPJ e redes.
async function enrichLead(lead: any) {
  lead.email = '';
  lead.instagram = '';
  lead.facebook = '';
  lead.tiktok = '';
  lead.cnpj = '';

  if (!lead.site || lead.site === 'Sem site') return lead;

  try {
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
  } catch (e) { /* Timeout ou site fora do ar - ok, continua */ }

  return lead;
}

// Pré-filtro rápido ANTES de enriquecer (aplicado na extração do Maps)
function preFilter(lead: any, filterRule: string): boolean {
  if (!filterRule || filterRule === 'none') return true;
  // Telefone pode ser filtrado direto do Maps (sem precisar visitar o site)
  if (filterRule === 'phone') return lead.telefone && lead.telefone !== 'Não informado';
  // Site pode ser filtrado direto do Maps  
  if (filterRule === 'site') return lead.site && lead.site !== 'Sem site';
  // Os demais (email, insta, face) precisam de enriquecimento, então passam aqui
  return true;
}

// Pós-filtro DEPOIS de enriquecer (para email, insta, face)
function postFilter(lead: any, filterRule: string): boolean {
  if (!filterRule || filterRule === 'none' || filterRule === 'phone' || filterRule === 'site') return true;
  if (filterRule === 'email') return !!lead.email;
  if (filterRule === 'insta') return !!lead.instagram;
  if (filterRule === 'face') return !!lead.facebook;
  if (filterRule === 'tiktok') return !!lead.tiktok;
  if (filterRule === 'cnpj') return !!lead.cnpj;
  return true;
}

export async function POST(request: Request) {
  let browser;
  try {
    const auth = await getAuthUser(request);
    if (!auth) {
      return NextResponse.json({ error: 'Nao autenticado. Faca login para extrair leads.' }, { status: 401 });
    }

    const { keyword: rawKeyword, location: rawLocation, limit, filterRule } = await request.json();
    const requestSupabase = createRequestSupabaseClient(request);

    if (!rawKeyword || !rawLocation) {
      return NextResponse.json({ error: 'Preencha o termo e a cidade.' }, { status: 400 });
    }

    if (filterRule && filterRule !== 'none' && filterRule !== 'phone' && filterRule !== 'site') {
      const featureMap: Record<string, FeatureKey> = {
        email: 'emailEnrichment',
        cnpj: 'cnpjEnrichment',
        insta: 'socialEnrichment',
        face: 'socialEnrichment',
        tiktok: 'socialEnrichment'
      };
      const requiredFeature = featureMap[filterRule];
      if (requiredFeature && !requireFeature(auth.planId, requiredFeature)) {
        return NextResponse.json({
          error: `Filtro "${filterRule}" exige plano superior. Faca upgrade para usar.`
        }, { status: 403 });
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
    const page = await browser.newPage();
    
    // Bloqueia imagens e CSS para carregar mais rápido
    await page.route('**/*.{png,jpg,jpeg,gif,svg,css,woff,woff2}', route => route.abort());

    const query = encodeURIComponent(`${keyword} em ${location}`);
    await page.goto(`https://www.google.com/maps/search/${query}`, { 
      waitUntil: 'domcontentloaded',
      timeout: 15000 
    });
    
    // Aceita cookies do Google se aparecer
    try {
      const acceptBtn = page.locator('button:has-text("Aceitar"), button:has-text("Accept"), form[action*="consent"] button');
      await acceptBtn.first().click({ timeout: 3000 });
    } catch(e) { /* Sem popup de cookies - ok */ }

    // Espera o feed de resultados carregar
    try {
      await page.waitForSelector('div[role="feed"]', { timeout: 8000 });
    } catch(e) {
      await browser.close();
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

    await page.waitForTimeout(2000);

    const validLeads: any[] = [];
    const scrapedNames = new Set<string>();
    let scrollAttempts = 0;
    let emptyScrolls = 0;

    // Loop Principal Otimizado
    while (validLeads.length < targetLimit && (Date.now() - startTime) < MAX_TIME && scrollAttempts < 30) {
      
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
            
            // Avaliação
            const ratingMatch = text.match(/(\d[.,]\d)\s/);
            const avaliacao = ratingMatch ? ratingMatch[1] : 'N/A';

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
            
            chunk.push({ nome, telefone, avaliacao, site, placeUrl });
          } catch(e) {}
        }
        return chunk;
      });

      // 2. Filtra novos leads (não repetidos)
      const newLeads = rawChunk.filter(l => !scrapedNames.has(l.nome));
      newLeads.forEach(l => scrapedNames.add(l.nome));

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
          const enriched = await Promise.all(preFiltered.map(lead => enrichLead(lead)));
          
          // 5. Aplica PÓS-FILTRO (para email/insta/face)
          for (const lead of enriched) {
            if (postFilter(lead, filterRule)) {
              validLeads.push(lead);
              if (validLeads.length >= targetLimit) break;
            }
          }
        }
      }

      // Scroll para carregar mais resultados
      if (validLeads.length < targetLimit) {
        await page.evaluate(() => {
          const feed = document.querySelector('div[role="feed"]');
          if (feed) feed.scrollBy(0, 1500);
        });
        await page.waitForTimeout(1500);
      }
      scrollAttempts++;
    }

    // Segunda passada: extrair telefone de leads que ficaram sem (info panel do Maps)
    const leadsSemTelefone = validLeads.filter(l => l.telefone === 'Não informado' && l.placeUrl);
    for (let i = 0; i < Math.min(leadsSemTelefone.length, 15); i++) {
      try {
        await page.goto(leadsSemTelefone[i].placeUrl, { waitUntil: 'domcontentloaded', timeout: 8000 });
        await page.waitForTimeout(1500);
        const phone = await page.evaluate(() => {
          const btn = document.querySelector('button[data-item-id*="phone"]');
          if (btn) {
            const label = btn.getAttribute('aria-label');
            if (label) {
              const m = label.match(/\+?\d[\d\s\-\(\)]{8,18}\d/);
              if (m) return m[0].trim();
            }
          }
          const text = document.body?.innerText || '';
          const m = text.match(/(?:Telefone|Tel|Phone|Fone|WhatsApp)[:\s]*([\+\d][\d\s\-\(\)]{8,18}\d)/i);
          if (m) return m[1].trim();
          const m2 = text.match(/\(?\d{2,3}\)?\s?\d{4,5}[\s-]?\d{4}/);
          if (m2) return m2[0];
          return '';
        });
        if (phone) leadsSemTelefone[i].telefone = phone;
      } catch (e) {
        // Falha ao navegar - continua
      }
    }

    await browser.close();
    browser = null;

    const gastos = validLeads.length;
    if (auth && gastos > 0) {
      const { error: deductError } = await requestSupabase.rpc('deduct_tokens', {
        p_user_id: auth.user.id,
        p_amount: gastos
      });
      if (deductError && !deductError.message?.includes('does not exist')) {
        console.warn('RPC deduct_tokens falhou, usando fallback:', deductError.message);
      }
      if (deductError) {
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
    console.error("ERRO NO MOTOR:", error.message);
    if (browser) await browser.close();
    return NextResponse.json({ error: 'Erro ao extrair: ' + error.message }, { status: 500 });
  }
}
