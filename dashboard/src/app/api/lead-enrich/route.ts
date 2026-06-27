import { NextResponse } from 'next/server';
import { getAuthUser, createAdminSupabaseClient } from '@/lib/server-auth';
import { enrichLead } from '../extract/enrichment/website';

const BR_PHONE_REGEX = /(?:\(\d{2,3}\)\s?)?\d{4,5}[\s-]?\d{4}/g;
const CNPJ_REGEX = /\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}/;
const URL_REGEX = /https?:\/\/[^\s"'<>)\]]+/g;
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

function normalizeName(name: string) {
  return name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s]/g, '').trim();
}

function extractPhoneFromText(text: string): string[] {
  const phones: string[] = [];
  let m: RegExpExecArray | null;
  const brRegex = /\(?(\d{2,3})\)?\s?(\d{4,5})[\s-]?(\d{4})/g;
  while ((m = brRegex.exec(text)) !== null) {
    const full = `(${m[1]}) ${m[2]}-${m[3]}`;
    if (!phones.includes(full)) phones.push(full);
  }
  return phones;
}

function extractCNPJFromText(text: string): string | null {
  const m = text.match(/\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}/);
  if (!m) return null;
  const digits = m[0].replace(/\D/g, '');
  if (digits.length !== 14) return null;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

function extractAddressFromText(text: string, city?: string): string | null {
  const patterns = [
    new RegExp(`Rua?[\\s\\S]{0,60}(?:${city || ''}|\\d{5}[\\s-]?\\d{3})`, 'i'),
    /(?:Rua|Av|Avenida|Travessa|Alameda|Praça|Rodovia)\s[^\n,.]{5,80}(?:,?\s*\d{1,5})?/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return m[0].trim().replace(/\s+/g, ' ');
  }
  return null;
}

function extractSiteFromUrls(html: string, name: string): string | null {
  const nameNorm = normalizeName(name);
  const nameWords = nameNorm.split(/\s+/).filter(w => w.length > 3);
  const urls = Array.from(html.matchAll(URL_REGEX), m => m[0]);
  const blocked = ['instagram.com', 'facebook.com', 'tiktok.com', 'youtube.com', 'whatsapp.com',
    'twitter.com', 'linkedin.com', 'duckduckgo.com', 'google.', 'doubleclick.net'];
  for (const url of urls) {
    try {
      const host = new URL(url).hostname.replace(/^www\./, '').toLowerCase();
      if (blocked.some(b => host.includes(b) || host === b)) continue;
      if (host.split('.').length < 2) continue;
      const hostClean = host.replace(/\.com(\.br)?$/, '').replace(/\./g, '');
      if (nameWords.some(w => w.length >= 4 && (hostClean.includes(w) || w.includes(hostClean)))) {
        return url.split('?')[0].split('#')[0];
      }
    } catch { continue; }
  }
  return null;
}

async function duckduckgoSearch(query: string): Promise<string> {
  const res = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
      'Accept-Language': 'pt-BR,pt;q=0.9',
    },
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) return '';
  return res.text();
}

async function fetchPageText(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        'Accept-Language': 'pt-BR,pt;q=0.9',
      },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return '';
    const text = await res.text();
    return text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  } catch { return ''; }
}

async function searchBusinessData(name: string, city?: string): Promise<Record<string, any>> {
  const data: Record<string, any> = {};

  const queries = [
    `"${name}" ${city || ''}`,
    `${name} ${city || ''} telefone endereco`,
    `${name} ${city || ''} site`,
  ];

  for (const query of queries) {
    const html = await duckduckgoSearch(query);
    if (!html) continue;

    if (!data.telefone) {
      const phones = extractPhoneFromText(html);
      if (phones.length > 0) data.telefone = phones[0];
    }

    if (!data.cnpj) {
      const cnpj = extractCNPJFromText(html);
      if (cnpj) data.cnpj = cnpj;
    }

    if (!data.endereco) {
      const addr = extractAddressFromText(html, city);
      if (addr) data.endereco = addr;
    }

    if (!data.site) {
      const site = extractSiteFromUrls(html, name);
      if (site) data.site = site;
    }

    if (!data.instagram) {
      const instaMatch = html.match(/https?:\/\/(?:www\.)?instagram\.com\/([a-zA-Z0-9._]+)/);
      if (instaMatch && !instaMatch[1].match(/^(p|reel|stories|explore|accounts)/)) {
        data.instagram = `https://instagram.com/${instaMatch[1]}`;
      }
    }

    if (!data.facebook) {
      const fbMatch = html.match(/https?:\/\/(?:www\.)?facebook\.com\/([^\s"'<>]+)/);
      if (fbMatch && !fbMatch[1].match(/^(sharer|share|dialog|plugins|events|groups|login|privacy)/)) {
        const cleanPath = fbMatch[1].replace(/[/?].*/, '');
        if (cleanPath.length > 1) data.facebook = `https://facebook.com/${cleanPath}`;
      }
    }

    if (!data.tiktok) {
      const ttMatch = html.match(/https?:\/\/(?:www\.)?tiktok\.com\/@([a-zA-Z0-9._]+)/);
      if (ttMatch) data.tiktok = `https://tiktok.com/@${ttMatch[1]}`;
    }
  }

  // Follow BR directory links to extract more data
  if (!data.site || !data.telefone || !data.cnpj) {
    const html = await duckduckgoSearch(`${name} ${city || ''}`);
    if (html) {
      const urls = Array.from(html.matchAll(/href="[^"]*"/g), m => m[1]);
      const dirDomains = ['restaurantguru.com.br', 'apontador.com.br', 'guiademidia.com.br',
        'ifood.com.br', 'yelp.com', 'econodata.com.br', 'cnpj.info', 'benditoguia.com.br',
        'guiafacil.com', 'listamais.com.br', 'tudogostoso.com.br'];
      for (const rawUrl of urls) {
        try {
          const url = rawUrl.startsWith('http') ? rawUrl : `https:${rawUrl}`;
          const host = new URL(url).hostname.replace(/^www\./, '').toLowerCase();
          if (dirDomains.some(d => host === d || host.endsWith('.' + d))) {
            const text = await fetchPageText(url);
            if (text) {
              if (!data.telefone) {
                const phones = extractPhoneFromText(text);
                if (phones.length > 0) data.telefone = phones[0];
              }
              if (!data.cnpj) {
                const cnpj = extractCNPJFromText(text);
                if (cnpj) data.cnpj = cnpj;
              }
              if (!data.endereco) {
                const addr = extractAddressFromText(text, city);
                if (addr) data.endereco = addr;
              }
              if (!data.site) {
                const siteMatch = text.match(/https?:\/\/(?:www\.)?[a-zA-Z0-9][a-zA-Z0-9.-]+\.[a-zA-Z]{2,}[^\s"'<>]*/);
                if (siteMatch) {
                  const s = siteMatch[0].split('?')[0].split('#')[0];
                  if (!['instagram.com', 'facebook.com', 'tiktok.com', 'youtube.com'].some(b => s.includes(b))) {
                    data.site = s;
                  }
                }
              }
            }
          }
        } catch { continue; }
      }
    }
  }

  // Try to find CNPJ via BrasilAPI search
  if (!data.cnpj) {
    try {
      const searchRes = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${encodeURIComponent(name)}`, {
        headers: { 'User-Agent': 'GeoLeads/1.0' },
        signal: AbortSignal.timeout(5000),
      });
      if (searchRes.ok) {
        const d = await searchRes.json();
        if (d.cnpj) {
          const digits = d.cnpj.replace(/\D/g, '');
          data.cnpj = `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
          if (!data.telefone && d.ddd_telefone_1) {
            data.telefone = `(${d.ddd_telefone_1}) ${d.telefone_1}`;
          }
          data.endereco_completo = d.logradouro ? `${d.logradouro}, ${d.numero} - ${d.bairro}` : '';
          data.cidade = d.municipio || '';
          data.uf = d.uf || '';
          data.cep = d.cep || '';
          data.razao_social = d.razao_social || '';
          data.nome_fantasia = d.nome_fantasia || '';
          data.atividade = d.descricao_atividade_principal?.[0]?.text || '';
          data.situacao_cadastral = d.situacao_cadastral || '';
        }
      }
    } catch (e) { console.warn('[ENRICH] step:', e); }
  }

  return data;
}

export async function POST(request: Request) {
  try {
    const auth = await getAuthUser(request);
    if (!auth) return NextResponse.json({ error: 'Nao autenticado.' }, { status: 401 });

    const body = await request.json();
    const { nome, site, cidade, cnpj } = body;
    if (!nome) return NextResponse.json({ error: 'Informe o nome da empresa.' }, { status: 400 });

    const enriched: Record<string, any> = {};
    const enrichmentPromises: Promise<void>[] = [];
    let discoveredSite = site && site !== 'Sem site' ? site : null;

    // 1. Try cache
    try {
      const supabaseCheck = createAdminSupabaseClient();
      const { data: cached } = await supabaseCheck.from('lead_enrichment_cache')
        .select('*').eq('company_name', nome).eq('city', cidade || '').maybeSingle();
      if (cached) {
        if (cached.email) enriched.email = cached.email;
        if (cached.instagram) enriched.instagram = cached.instagram;
        if (cached.facebook) enriched.facebook = cached.facebook;
        if (cached.tiktok) enriched.tiktok = cached.tiktok;
        if (!cnpj && cached.cnpj) enriched.cnpj = cached.cnpj;
        if (!discoveredSite && cached.site) discoveredSite = cached.site;
        if (cached.telefone) enriched.telefone = cached.telefone;
        if (Object.keys(enriched).length >= 3 && discoveredSite) {
          return NextResponse.json({ success: true, enriched, message: 'Cache.' });
        }
      }
    } catch { /* continue */ }

    // 2. AGGRESSIVE: Search the web for this business
    enrichmentPromises.push(
      (async () => {
        try {
          const bizData = await searchBusinessData(nome, cidade);
          if (bizData.telefone && !enriched.telefone) enriched.telefone = bizData.telefone;
          if (bizData.cnpj && !enriched.cnpj) enriched.cnpj = bizData.cnpj;
          if (bizData.endereco && !enriched.endereco) enriched.endereco = bizData.endereco;
          if (bizData.instagram && !enriched.instagram) enriched.instagram = bizData.instagram;
          if (bizData.facebook && !enriched.facebook) enriched.facebook = bizData.facebook;
          if (bizData.tiktok && !enriched.tiktok) enriched.tiktok = bizData.tiktok;
          if (bizData.site && !discoveredSite) {
            discoveredSite = bizData.site;
            enriched.site_descoberto = bizData.site;
          }
          if (bizData.razao_social) enriched.razao_social = bizData.razao_social;
          if (bizData.nome_fantasia) enriched.nome_fantasia = bizData.nome_fantasia;
          if (bizData.atividade) enriched.atividade = bizData.atividade;
          if (bizData.situacao_cadastral) enriched.situacao_cadastral = bizData.situacao_cadastral;
          if (bizData.endereco_completo) enriched.endereco_completo = bizData.endereco_completo;
          if (bizData.cidade) enriched.cidade_encontrada = bizData.cidade;
          if (bizData.uf) enriched.uf = bizData.uf;
          if (bizData.cep) enriched.cep = bizData.cep;
        } catch (e) { console.warn('[ENRICH] step:', e); }
      })()
    );

    // 3. If we already have CNPJ, look it up on BrasilAPI
    if (cnpj && cnpj.replace(/\D/g, '').length === 14) {
      enrichmentPromises.push(
        (async () => {
          try {
            const digits = cnpj.replace(/\D/g, '');
            const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digits}`, {
              headers: { 'User-Agent': 'GeoLeads/1.0' }, signal: AbortSignal.timeout(5000),
            });
            if (res.ok) {
              const d = await res.json();
              enriched.cnpj ||= `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
              if (d.razao_social) enriched.razao_social = d.razao_social;
              if (d.nome_fantasia) enriched.nome_fantasia = d.nome_fantasia;
              if (!enriched.telefone && d.ddd_telefone_1) enriched.telefone = `(${d.ddd_telefone_1}) ${d.telefone_1}`;
              if (d.logradouro) enriched.endereco_completo = `${d.logradouro}, ${d.numero} - ${d.bairro}`;
              if (d.municipio) enriched.cidade_encontrada = d.municipio;
              if (d.uf) enriched.uf = d.uf;
              if (d.cep) enriched.cep = d.cep;
              if (d.descricao_atividade_principal?.[0]?.text) enriched.atividade = d.descricao_atividade_principal[0].text;
              if (d.situacao_cadastral) enriched.situacao_cadastral = d.situacao_cadastral;
            }
          } catch (e) { console.warn('[ENRICH] step:', e); }
        })()
      );
    }

    // 4. Website scraping if we discovered a site
    if (discoveredSite) {
      enrichmentPromises.push(
        (async () => {
          try {
            const result = await enrichLead({ nome, site: discoveredSite, cidade, email: '', instagram: '', facebook: '', tiktok: '', cnpj: '' });
            if (result.email && !enriched.email) enriched.email = result.email;
            if (result.instagram && !enriched.instagram) enriched.instagram = result.instagram;
            if (result.facebook && !enriched.facebook) enriched.facebook = result.facebook;
            if (result.tiktok && !enriched.tiktok) enriched.tiktok = result.tiktok;
          } catch (e) { console.warn('[ENRICH] step:', e); }
        })()
      );
    }

    // 5. Social search for remaining missing social fields
    if (!enriched.instagram || !enriched.facebook || !enriched.tiktok) {
      enrichmentPromises.push(
        (async () => {
          try {
            const socialHtml = await duckduckgoSearch(`${nome} ${cidade || ''} instagram facebook tiktok`);
            if (!enriched.instagram) {
              const m = socialHtml.match(/https?:\/\/(?:www\.)?instagram\.com\/([a-zA-Z0-9._]+)/);
              if (m && !m[1].match(/^(p|reel|stories|explore|accounts)/)) enriched.instagram = `https://instagram.com/${m[1]}`;
            }
            if (!enriched.facebook) {
              const m = socialHtml.match(/https?:\/\/(?:www\.)?facebook\.com\/([^\s"'<>]+)/);
              if (m && !m[1].match(/^(sharer|share|dialog|plugins|events|groups|login|privacy)/)) {
                const cleanPath = m[1].replace(/[/?].*/, '');
                if (cleanPath.length > 1) enriched.facebook = `https://facebook.com/${cleanPath}`;
              }
            }
            if (!enriched.tiktok) {
              const m = socialHtml.match(/https?:\/\/(?:www\.)?tiktok\.com\/@([a-zA-Z0-9._]+)/);
              if (m) enriched.tiktok = `https://tiktok.com/@${m[1]}`;
            }
          } catch (e) { console.warn('[ENRICH] step:', e); }
        })()
      );
    }

    // Wait for all enrichment (max 30s)
    await Promise.race([
      Promise.all(enrichmentPromises),
      new Promise(r => setTimeout(r, 30000)),
    ]);

    if (Object.keys(enriched).length === 0) {
      return NextResponse.json({ success: true, enriched: null, message: 'Nenhum dado adicional encontrado.' });
    }

    // Save to cache
    try {
      const supabase = createAdminSupabaseClient();
      await supabase.from('lead_enrichment_cache').upsert({
        company_name: nome, city: cidade || '', site: discoveredSite || site || '',
        email: enriched.email || '', instagram: enriched.instagram || '',
        facebook: enriched.facebook || '', tiktok: enriched.tiktok || '',
        cnpj: enriched.cnpj || '',
        enriched_at: new Date().toISOString(),
      }, { onConflict: 'company_name,city' });
    } catch (e) { console.warn('[ENRICH] step:', e); }

    return NextResponse.json({ success: true, enriched, message: `${Object.keys(enriched).length} campos enriquecidos para "${nome}"` });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'erro desconhecido';
    console.error('ERRO LEAD ENRICH:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
