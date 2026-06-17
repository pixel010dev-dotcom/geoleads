import type { SearchLead } from '../lib/types';
import { createEmptySearchLead } from '../lib/types';
import { normalizePhone, applySignalsToLead, mergeMapsPlaceExtraData } from '../lib/validation';
import { getRandomUserAgent, getRandomViewport, getRandomTimezone, getRandomGeolocation, getHumanDelay, simulateHumanScroll, withMapsLocale, GOOGLE_CONSENT_COOKIE, GOOGLE_SOCS_COOKIE } from '../lib/stealth';

interface ScrapeResult {
  leads: SearchLead[];
  blocked: boolean;
  error?: string;
}

const PHONE_SELECTORS = [
  'button[data-item-id*="phone"]',
  'a[data-item-id*="phone"]',
  'a[href^="tel:"]',
  '[data-phone-number]',
  'button[aria-label*="telefone"]',
  'button[aria-label*="phone"]',
  '[data-tooltip*="telefone"]',
  '[data-tooltip*="phone"]',
  'button[aria-label*="Ligar"]',
  'button[aria-label*="call"]',
  'a[aria-label*="telefone"]',
  'button[data-value][data-tooltip*="telefone"]',
  'button[data-value][data-tooltip*="phone"]',
  'a[href^="tel:"]',
  'a[href*="wa.me"]',
  'a[href*="whatsapp.com"]',
  '[itemprop="telephone"]',
];

const SITE_SELECTORS = [
  'a[data-item-id*="authority"]',
  'a[aria-label*="Website"]',
  'a[aria-label*="site"]',
  'a[data-tooltip*="Website"]',
  'a[data-tooltip*="site"]',
  'a[href^="http"]:not([href*="google"]):not([href*="maps"])',
];

const PHONE_REGEX_PATTERNS = [
  /(\+55\s?)?\(?\d{2}\)?\s?\d{4,5}[\s-]?\d{4}/g,
  /\+?\d{2}[\s-]?\d{2}[\s-]?\d{4,5}[\s-]?\d{4}/g,
  /\(?\d{2,3}\)?\s?\d{4,5}[\s-]?\d{4}/g,
];

async function extractCardsFromPage(page: any): Promise<any[]> {
  return page.evaluate(() => {
    const chunk: any[] = [];
    const selectors = [
      'div[role="feed"] > div > div > a[href*="/maps/place"]',
      'a[href*="/maps/place"][role="link"]',
      'a[href*="/maps/place"]',
    ];

    let items: Element[] = [];
    for (const sel of selectors) {
      items = Array.from(document.querySelectorAll(sel));
      if (items.length > 0) break;
    }

    for (const anchor of items) {
      try {
        const container = anchor.closest('div[role="feed"] > div > div') ||
          anchor.closest('div[role="feed"] > div') ||
          anchor.parentElement?.closest('div[class*="feed"]') ||
          anchor.parentElement;
        if (!container) continue;

        const nomeEl = container.querySelector('.fontHeadlineSmall') ||
          container.querySelector('[class*="fontHeadline"]') ||
          container.querySelector('[class*="title"]') ||
          container.querySelector('[class*="name"]') ||
          container.querySelector('span[class*="bold"]') ||
          container.querySelector('span');
        if (!nomeEl) continue;

        const nome = (nomeEl as HTMLElement).innerText?.trim();
        if (!nome || nome.length < 2 || nome.length > 200) continue;

        const text = (container as HTMLElement).innerText || '';

        let telefone = 'Não informado';
        const els = container.querySelectorAll('[aria-label]');
        for (const el of els) {
          const label = el.getAttribute('aria-label') || '';
          if (label.includes('Ligar') || label.includes('Call') || label.includes('ligar')) {
            const match = label.match(/\+?\d[\d\s\-()]{8,18}\d/);
            if (match) { telefone = match[0].trim(); break; }
          }
        }

        if (telefone === 'Não informado') {
          const phoneBtn = container.querySelector('[data-phone-number]');
          if (phoneBtn) { const p = phoneBtn.getAttribute('data-phone-number'); if (p) telefone = p.trim(); }
        }

        if (telefone === 'Não informado') {
          const telMatch = text.match(/\(?\d{2,3}\)?\s?\d{4,5}[\s-]?\d{4}/);
          if (telMatch) telefone = telMatch[0];
        }

        if (telefone === 'Não informado') {
          const phoneEl = container.querySelector('button[data-value][data-tooltip*="telefone"], button[data-value][data-tooltip*="phone"]');
          if (phoneEl) { const v = phoneEl.getAttribute('data-value'); if (v) telefone = v.trim(); }
        }

        if (telefone === 'Não informado') {
          const telLink = container.querySelector('a[href^="tel:"]');
          if (telLink) { const t = telLink.getAttribute('href')?.replace('tel:', '').trim(); if (t) telefone = t; }
        }

        if (telefone === 'Não informado') {
          const waLink = container.querySelector('a[href*="wa.me"], a[href*="whatsapp.com"]');
          if (waLink) { const href = waLink.getAttribute('href') || ''; const wm = href.match(/(\d{10,15})/); if (wm) telefone = wm[1]; }
        }

        if (telefone === 'Não informado') {
          const item = container.querySelector('[itemprop="telephone"]');
          if (item) telefone = (item as HTMLElement).innerText?.trim() || '';
        }

        if (telefone === 'Não informado') {
          const el = container.querySelector('[data-item-id*="phone"]');
          if (el) {
            const v = el.getAttribute('aria-label') || el.getAttribute('data-value') || (el as HTMLElement).innerText;
            if (v) { const phoneMatch = v.match(/(\+?\d[\d\s\-()]{8,18}\d)/); if (phoneMatch) telefone = phoneMatch[1].trim(); }
          }
        }

        if (telefone === 'Não informado') {
          for (const pat of PHONE_REGEX_PATTERNS) {
            const m = text.match(pat);
            if (m && m[0].length >= 10) { telefone = m[0].trim(); break; }
          }
        }

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

        let categoria = '';
        const textParts = text.split('\n').filter((p: string) => p.trim());
        for (let i = 0; i < textParts.length; i++) {
          const part = textParts[i].trim();
          if (part.includes('·') || part.includes('R$')) {
            const catMatch = part.match(/^(.+?)\s*(?:·|R\$)/);
            if (catMatch) categoria = catMatch[1].trim();
            break;
          }
        }

        let endereco = '';
        for (const part of textParts) {
          const addrMatch = part.match(/((?:Rua|Av\.?|Avenida|Travessa|Praça|Alameda|Rodovia)\s.+)/i);
          if (addrMatch) { endereco = addrMatch[1]; break; }
        }
        if (!endereco) {
          const addrMatch = text.match(/([A-Za-zÀ-ÿ\s]+\d+\s*-\s*[A-Za-zÀ-ÿ\s]+,\s*[A-Za-zÀ-ÿ\s]+-[A-Z]{2})/);
          if (addrMatch) endereco = addrMatch[1];
        }

        let horarios = '';
        const hoursMatch = text.match(/(Aberto|Fechado)(?:\s*⋅\s*)(.+?)(?:\.|$)/i);
        if (hoursMatch) horarios = hoursMatch[0].trim();

        const cepMatch = text.match(/\d{5}-?\d{3}/);
        const cep = cepMatch ? cepMatch[0] : '';

        const reviewCountMatch = text.match(/\((\d[\d.]*)\)\s*(?:avalia|review)/i);
        const reviewCount = reviewCountMatch ? reviewCountMatch[1] : '';

        let site = 'Sem site';
        const allLinks = container.querySelectorAll('a[href]');
        for (const link of allLinks) {
          const href = (link as HTMLAnchorElement).href;
          if (href && !href.includes('google.com') && !href.includes('maps') && href.startsWith('http')) {
            site = href;
            break;
          }
        }

        const placeUrl = (anchor as HTMLAnchorElement).href || '';

        chunk.push({ nome, telefone, avaliacao, site, placeUrl, cep, reviewCount, categoria, endereco, horarios });
      } catch {}
    }
    return chunk;
  });
}

export async function extractFromPlaywrightMaps(
  browser: any,
  keyword: string,
  location: string,
  targetLimit: number,
  existingKeys: Set<string>,
  maxScrolls: number = 50,
  signal?: AbortSignal
): Promise<SearchLead[]> {
  const allLeads: SearchLead[] = [];

  const context = await browser.newContext({
    userAgent: getRandomUserAgent(),
    viewport: getRandomViewport(),
    locale: 'pt-BR',
    timezoneId: getRandomTimezone(),
    geolocation: getRandomGeolocation(),
    permissions: ['geolocation'],
  });

  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
    Object.defineProperty(navigator, 'languages', { get: () => ['pt-BR', 'pt', 'en'] });
    Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
  });

  await context.route('**/*.{png,jpg,jpeg,gif,svg,woff,woff2,ttf,eot}', (route: any) => route.fulfill({ status: 204, body: '' }));
  await context.route('**/maps/vt**', (route: any) => route.fulfill({ status: 204, body: '' }));

  await context.addCookies([
    GOOGLE_CONSENT_COOKIE,
    GOOGLE_SOCS_COOKIE,
  ]);

  const page = await context.newPage();

  const queryFormats = [
    `${keyword} em ${location}`,
    `${keyword} ${location}`,
    `${keyword}, ${location}`,
  ];

  let foundResults = false;
  const scrapedNames = new Set<string>(Array.from(existingKeys).map(k => k.split('|')[0]).filter(Boolean));
  const scrapedPhones = new Set<string>(Array.from(existingKeys).map(k => k.split('|')[1]).filter(Boolean));

  for (const queryFormat of queryFormats) {
    if (foundResults) break;
    if (signal?.aborted) break;
    if (allLeads.length >= targetLimit) break;

    const encodedQuery = encodeURIComponent(queryFormat);

    try {
      await page.goto(`https://www.google.com/maps/search/${encodedQuery}`, {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });

      const pageUrl = page.url();
      const pageTitle = await page.title().catch(() => '');

      if (pageUrl.includes('sorry') || pageUrl.includes('captcha') || 
          pageTitle.toLowerCase().includes('captcha') || pageTitle.toLowerCase().includes('sorry')) {
        await context.close();
        return allLeads;
      }

      try {
        await page.waitForSelector('div[role="feed"], div[role="main"]', { timeout: 20000 });
        foundResults = true;
      } catch {
        try {
          await page.waitForSelector('a[href*="/maps/place"]', { timeout: 10000 });
          foundResults = true;
        } catch {
          continue;
        }
      }
    } catch { continue; }
  }

  if (!foundResults) {
    await context.close();
    return allLeads;
  }

  await page.waitForTimeout(1000 + Math.random() * 1000);
  try {
    await page.waitForSelector('a[href*="/maps/place"]', { timeout: 8000 });
  } catch {}

  let scrollCount = 0;
  let emptyScrolls = 0;

  while (allLeads.length < targetLimit && scrollCount < maxScrolls && !(signal?.aborted)) {
    const rawChunk = await extractCardsFromPage(page);

    const newLeads = rawChunk.filter((l: any) => {
      if (scrapedNames.has(l.nome)) return false;
      if (l.telefone !== 'Não informado' && scrapedPhones.has(l.telefone)) return false;
      return true;
    });

    newLeads.forEach((l: any) => {
      scrapedNames.add(l.nome);
      if (l.telefone !== 'Não informado') scrapedPhones.add(l.telefone);
      if (l.telefone && l.telefone !== 'Não informado') l.telefone = normalizePhone(l.telefone);
      allLeads.push(l as SearchLead);
    });

    if (newLeads.length === 0) {
      emptyScrolls++;
      if (emptyScrolls >= 12) break;
    } else {
      emptyScrolls = 0;
    }

    if (allLeads.length < targetLimit) {
      await page.evaluate(() => {
        const feed = document.querySelector('div[role="feed"]');
        if (feed) feed.scrollBy(0, 1000 + Math.random() * 500);
      });
      await page.waitForTimeout(1200 + Math.random() * 800);
    }
    scrollCount++;
  }

  await context.close();
  return allLeads;
}

export async function extractMapsPlaceDetails(tab: any, placeUrl: string): Promise<any> {
  const result: any = { telefone: '', site: '', instagram: '', facebook: '', tiktok: '', endereco: '', horarios: '' };

  try {
    try {
      await tab.goto(withMapsLocale(placeUrl), {
        waitUntil: 'domcontentloaded',
        timeout: 15000,
        referer: 'https://www.google.com/maps'
      });
    } catch {}

    try {
      await tab.waitForFunction(() => {
        const text = document.body?.innerText || '';
        if (!text || text.length < 120) return false;
        if (/captcha|unusual traffic|trafego incomum|sorry/i.test(text)) return true;
        if (/\(?\d{2}\)?\s?\d{4,5}[\s-]?\d{4}/.test(text)) return true;
        if (document.querySelector('[data-item-id*="phone"], [data-item-id*="authority"], [data-item-id*="address"], a[href^="tel:"]')) return true;
        return text.includes('Sugerir mudança') || text.includes('Suggest an edit') || text.includes('Adicionar website');
      }, null, { timeout: 10000 });
    } catch {
      try { await tab.waitForTimeout(2000); } catch {}
    }

    const extraData = await tab.evaluate(() => {
      const r: any = { telefone: '', site: '', instagram: '', facebook: '', tiktok: '', endereco: '', horarios: '' };
      const text = document.body?.innerText || '';
      const html = document.body?.innerHTML || '';

      for (const s of document.querySelectorAll('script[type="application/ld+json"]')) {
        try {
          const d = JSON.parse(s.textContent || '{}');
          const items = Array.isArray(d) ? d : [d];
          for (const item of items) {
            if (item.telephone && !r.telefone) r.telefone = item.telephone;
            if (item.url && !r.site && !item.url.includes('google.com')) r.site = item.url;
            if (item.sameAs && Array.isArray(item.sameAs)) {
              for (const url of item.sameAs) {
                if (url.includes('instagram.com')) r.instagram = url;
                if (url.includes('facebook.com') || url.includes('fb.com')) r.facebook = url;
                if (url.includes('tiktok.com')) r.tiktok = url;
              }
            }
            if (item.address?.streetAddress) {
              let addr = item.address.streetAddress;
              if (item.address.addressLocality) addr += ', ' + item.address.addressLocality;
              if (item.address.addressRegion) addr += ' - ' + item.address.addressRegion;
              if (item.address.postalCode) addr += ', ' + item.address.postalCode;
              r.endereco = addr;
            }
          }
        } catch {}
      }

      if (!r.telefone) {
        for (const sel of PHONE_SELECTORS) {
          const el = document.querySelector(sel);
          if (!el) continue;
          const v = el.getAttribute('aria-label') || el.getAttribute('data-phone-number') ||
                    el.getAttribute('href')?.replace('tel:', '') || el.getAttribute('data-value') ||
                    (el as HTMLElement).innerText;
          if (v) { const phoneMatch = v.match(/(\+?\d[\d\s\-()]{8,18}\d)/); if (phoneMatch) { r.telefone = phoneMatch[1].trim(); break; } }
        }
      }

      if (!r.telefone) {
        for (const pat of PHONE_REGEX_PATTERNS) {
          const ms = text.match(pat);
          if (ms && ms.length > 0) { r.telefone = ms[0].trim(); break; }
        }
      }

      if (!r.site) {
        for (const sel of SITE_SELECTORS) {
          const el = document.querySelector(sel);
          if (el) { const h = el.getAttribute('href') || ''; if (h && !h.includes('google.com')) { r.site = h; break; } }
        }
      }

      for (const m of html.matchAll(/https?:\/\/(?:www\.)?(instagram\.com|facebook\.com|fb\.com|tiktok\.com)\/[^\s"'<>]+/gi)) {
        const url = m[0].replace(/["'<>].*$/, '');
        if (url.includes('instagram.com') && !r.instagram) r.instagram = url;
        if ((url.includes('facebook.com') || url.includes('fb.com')) && !r.facebook) r.facebook = url;
        if (url.includes('tiktok.com') && !r.tiktok) r.tiktok = url;
      }

      if (!r.endereco) {
        const addrEl = document.querySelector('[data-item-id*="address"]');
        if (addrEl) r.endereco = (addrEl as HTMLElement).innerText?.trim() || '';
      }

      const hMatch = text.match(/(Aberto|Fechado)(?:\s*⋅\s*)(.+?)(?:\.|$)/i);
      if (hMatch) r.horarios = hMatch[0].trim();

      return r;
    });

    mergeMapsPlaceExtraData(result, extraData);

    if (!result.telefone && !result.site) {
      await tab.waitForTimeout(1500);
      const retryData = await tab.evaluate(() => {
        const r: any = { telefone: '', site: '' };
        const text = document.body?.innerText || '';
        for (const pat of PHONE_REGEX_PATTERNS) {
          const ms = text.match(pat);
          if (ms && ms.length > 0) { r.telefone = ms[0].trim(); break; }
        }
        for (const sel of SITE_SELECTORS) {
          const el = document.querySelector(sel);
          if (el) { const h = el.getAttribute('href') || ''; if (h && !h.includes('google.com')) { r.site = h; break; } }
        }
        return r;
      });
      mergeMapsPlaceExtraData(result, retryData);
    }
  } catch {}

  return result;
}
