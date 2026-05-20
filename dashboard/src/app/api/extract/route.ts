import { NextResponse } from 'next/server';
import { chromium } from 'playwright';

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

// Enriquecimento: visita o site da empresa e caça E-mails e Redes Sociais
async function enrichLead(lead: any) {
  lead.email = '';
  lead.instagram = '';
  lead.facebook = '';
  
  if (!lead.site || lead.site === 'Sem site') return lead;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(lead.site, { 
      signal: controller.signal, 
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      redirect: 'follow',
    });
    clearTimeout(timeout);

    if (res.ok) {
      const html = await res.text();
      
      // Caça E-mails (ignora lixo tipo sentry, wix, example)
      const emailMatch = html.match(/[a-zA-Z0-9._+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}/);
      if (emailMatch && !/sentry|wix|example|schema|wordpress/.test(emailMatch[0])) {
        lead.email = emailMatch[0];
      }
      
      // Caça Instagram
      const instaMatch = html.match(/https?:\/\/(www\.)?instagram\.com\/[a-zA-Z0-9_.]+/);
      if (instaMatch) lead.instagram = instaMatch[0];

      // Caça Facebook
      const faceMatch = html.match(/https?:\/\/(www\.)?facebook\.com\/[a-zA-Z0-9_.]+/);
      if (faceMatch) lead.facebook = faceMatch[0];
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
  return true;
}

export async function POST(request: Request) {
  let browser;
  try {
    const { keyword: rawKeyword, location: rawLocation, limit, filterRule } = await request.json();

    if (!rawKeyword || !rawLocation) {
      return NextResponse.json({ error: 'Preencha o termo e a cidade.' }, { status: 400 });
    }

    // Normalização Inteligente (Tolerância a erros de digitação e abreviações)
    const { correctedKeyword, correctedLocation } = smartNormalizeQuery(rawKeyword, rawLocation);
    const keyword = correctedKeyword;
    const location = correctedLocation;

    const targetLimit = Math.min(limit || 10, 500); 
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
            
            chunk.push({ nome, telefone, avaliacao, site });
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

    await browser.close();
    browser = null;

    return NextResponse.json({ 
      success: true, 
      leads: validLeads,
      stats: {
        total: validLeads.length,
        scanned: scrapedNames.size,
        time: Math.round((Date.now() - startTime) / 1000),
        correctedKeyword,
        correctedLocation
      }
    });

  } catch (error: any) {
    console.error("ERRO NO MOTOR:", error.message);
    if (browser) await browser.close();
    return NextResponse.json({ error: 'Erro ao extrair: ' + error.message }, { status: 500 });
  }
}
