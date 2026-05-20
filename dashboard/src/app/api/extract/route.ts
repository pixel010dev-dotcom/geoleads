import { NextResponse } from 'next/server';
import { chromium } from 'playwright';

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
    const { keyword, location, limit, filterRule } = await request.json();

    if (!keyword || !location) {
      return NextResponse.json({ error: 'Preencha o termo e a cidade.' }, { status: 400 });
    }

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
      return NextResponse.json({ success: true, leads: [], message: 'Google Maps não carregou resultados para essa busca.' });
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
        time: Math.round((Date.now() - startTime) / 1000)
      }
    });

  } catch (error: any) {
    console.error("ERRO NO MOTOR:", error.message);
    if (browser) await browser.close();
    return NextResponse.json({ error: 'Erro ao extrair: ' + error.message }, { status: 500 });
  }
}
