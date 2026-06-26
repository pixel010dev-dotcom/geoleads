import { NextResponse } from 'next/server';
import { getAuthUser, createAdminSupabaseClient } from '@/lib/server-auth';
import { enrichLead } from '../extract/enrichment/website';

function normalizeName(name: string) {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .trim();
}

function scoreMatch(query: string, result: string): number {
  const q = normalizeName(query);
  const r = normalizeName(result);
  if (q === r) return 100;
  if (r.includes(q) || q.includes(r)) return 75;
  const qWords = q.split(/\s+/);
  const rWords = r.split(/\s+/);
  let matches = 0;
  for (const w of qWords) {
    if (w.length < 3) continue;
    if (rWords.some(rw => rw.includes(w) || w.includes(rw))) matches++;
  }
  return Math.round((matches / qWords.length) * 70);
}

function normalizeCnpj(value: string) {
  return value.replace(/\D/g, '').slice(0, 14);
}

async function enrichCNPJ(cnpjValue?: string): Promise<any> {
  if (cnpjValue) {
    const normalized = normalizeCnpj(cnpjValue);
    if (normalized.length === 14) {
      try {
        const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${normalized}`, {
          headers: { 'User-Agent': 'GeoLeads/1.0' },
          signal: AbortSignal.timeout(5000)
        });
        if (res.ok) {
          const data = await res.json();
          return {
            cnpj: `${normalized.slice(0, 2)}.${normalized.slice(2, 5)}.${normalized.slice(5, 8)}/${normalized.slice(8, 12)}-${normalized.slice(12)}`,
            razao_social: data.razao_social || '',
            nome_fantasia: data.nome_fantasia || '',
            telefone_empresa: data.ddd_telefone_1 ? `(${data.ddd_telefone_1}) ${data.telefone_1}` : '',
            endereco_completo: data.logradouro ? `${data.logradouro}, ${data.numero} - ${data.bairro}` : '',
            cidade: data.municipio || '',
            uf: data.uf || '',
            cep: data.cep || '',
            data_abertura: data.data_inicio_atividade || '',
            situacao_cadastral: data.situacao_cadastral || '',
            atividade: data.descricao_atividade_principal?.[0]?.text || '',
          };
        }
      } catch { /* silence */ }
    }
  }
  return null;
}

async function searchSocial(name: string, platform: string, city?: string, attempt = 1): Promise<{ url?: string; score: number }> {
  try {
    const query = encodeURIComponent(`${name} ${city || ''} ${platform}`);
    const res = await fetch(`https://html.duckduckgo.com/html/?q=${query}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        'Accept-Language': 'pt-BR,pt;q=0.9',
      },
      signal: AbortSignal.timeout(10000)
    });
    if (!res.ok) return { score: 0 };
    const html = await res.text();

    let regex: RegExp;
    if (platform === 'instagram') {
      regex = /https?:\/\/(?:www\.)?instagram\.com\/([a-zA-Z0-9._]+)/g;
    } else if (platform === 'facebook') {
      regex = /https?:\/\/(?:www\.)?facebook\.com\/([^\s"'<>]+)/g;
    } else if (platform === 'tiktok') {
      regex = /https?:\/\/(?:www\.)?tiktok\.com\/@([a-zA-Z0-9._]+)/g;
    } else {
      return { score: 0 };
    }

    let match: RegExpExecArray | null;
    let bestUrl = '';
    let bestScore = 0;

    while ((match = regex.exec(html))) {
      const url = match[0];
      if (platform === 'facebook' && (url.includes('/p/') || url.includes('/share') || url.includes('/events'))) continue;
      const username = platform === 'facebook' ? match[1].replace(/[/?].*/, '').replace(/[._]/g, ' ') : match[1].replace(/[._]/g, ' ');
      const score = scoreMatch(name, username);
      if (score > bestScore && score >= 40) {
        bestScore = score;
        bestUrl = url;
      }
    }

    if (!bestUrl && attempt < 2) {
      return searchSocial(name, platform, city, attempt + 1);
    }

    return { url: bestUrl || undefined, score: bestScore };
  } catch {
    if (attempt < 2) {
      return searchSocial(name, platform, city, attempt + 1);
    }
    return { score: 0 };
  }
}

async function discoverSiteViaDuckDuckGo(name: string, city?: string): Promise<string | null> {
  try {
    const query = encodeURIComponent(`${name} ${city || ''} site oficial`);
    const res = await fetch(`https://html.duckduckgo.com/html/?q=${query}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        'Accept-Language': 'pt-BR,pt;q=0.9',
      },
      signal: AbortSignal.timeout(10000)
    });
    if (!res.ok) return null;
    const html = await res.text();
    const urlRegex = /(https?:\/\/(?:www\.)?[a-zA-Z0-9][a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(?:\/[^\s"'<>]*)?)/g;
    const matches = Array.from(html.matchAll(urlRegex), m => m[1]);
    const blocked = ['instagram.com', 'facebook.com', 'tiktok.com', 'youtube.com', 'whatsapp.com', 'twitter.com', 'linkedin.com', 'duckduckgo.com'];
    for (const url of matches) {
      try {
        const host = new URL(url).hostname.replace(/^www\./, '').toLowerCase();
        if (blocked.some(b => host === b || host.endsWith('.' + b))) continue;
        if (host.includes('google.') || host.includes('googleapis.')) continue;
        const nameNorm = normalizeName(name);
        const hostWords = host.replace(/\.com(\.br)?$/, '').split(/[.-]/);
        if (hostWords.some(w => w.length >= 4 && nameNorm.includes(w))) {
          return url;
        }
      } catch { continue; }
    }
    return null;
  } catch {
    return null;
  }
}

async function discoverCNPJviaCompanyName(name: string): Promise<any | null> {
  try {
    const query = encodeURIComponent(name);
    const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${query}`, {
      headers: { 'User-Agent': 'GeoLeads/1.0' },
      signal: AbortSignal.timeout(5000)
    });
    if (res.ok) {
      const data = await res.json();
      if (data.cnpj) {
        const normalized = data.cnpj.replace(/\D/g, '');
        return {
          cnpj: `${normalized.slice(0, 2)}.${normalized.slice(2, 5)}.${normalized.slice(5, 8)}/${normalized.slice(8, 12)}-${normalized.slice(12)}`,
          razao_social: data.razao_social || '',
          nome_fantasia: data.nome_fantasia || '',
          telefone_empresa: data.ddd_telefone_1 ? `(${data.ddd_telefone_1}) ${data.telefone_1}` : '',
          endereco_completo: data.logradouro ? `${data.logradouro}, ${data.numero} - ${data.bairro}` : '',
          cidade: data.municipio || '',
          uf: data.uf || '',
          cep: data.cep || '',
          data_abertura: data.data_inicio_atividade || '',
          situacao_cadastral: data.situacao_cadastral || '',
          atividade: data.descricao_atividade_principal?.[0]?.text || '',
        };
      }
    }
    return null;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  try {
    const auth = await getAuthUser(request);
    if (!auth) {
      return NextResponse.json({ error: 'Nao autenticado.' }, { status: 401 });
    }

    const body = await request.json();
    const { nome, site, cidade, cnpj, email, instagram, facebook, tiktok } = body;

    if (!nome) {
      return NextResponse.json({ error: 'Informe o nome da empresa.' }, { status: 400 });
    }

    const enriched: Record<string, any> = {};
    const enrichmentPromises: Promise<void>[] = [];
    let discoveredSite = site && site !== 'Sem site' ? site : null;

    // Check Supabase cache before making API calls
    try {
      const supabaseCheck = createAdminSupabaseClient();
      const { data: cached } = await supabaseCheck
        .from('lead_enrichment_cache')
        .select('email, instagram, facebook, tiktok, cnpj, site')
        .eq('company_name', nome)
        .eq('city', cidade || '')
        .maybeSingle();
      if (cached) {
        if (cached.email) enriched.email = cached.email;
        if (cached.instagram) enriched.instagram = cached.instagram;
        if (cached.facebook) enriched.facebook = cached.facebook;
        if (cached.tiktok) enriched.tiktok = cached.tiktok;
        if (!cnpj && cached.cnpj) enriched.cnpj = cached.cnpj;
        if (cached.site && (!site || site === 'Sem site')) discoveredSite = cached.site;
        if (Object.keys(enriched).length > 0 && discoveredSite) {
          return NextResponse.json({ success: true, enriched, message: 'Usando cache do Supabase.' });
        }
      }
    } catch { /* continue se cache falhar */ }

    // 0. Site discovery via DuckDuckGo if no site
    if (!discoveredSite) {
      enrichmentPromises.push(
        (async () => {
          try {
            const foundSite = await discoverSiteViaDuckDuckGo(nome, cidade);
            if (foundSite) {
              discoveredSite = foundSite;
              enriched.site_descoberto = foundSite;
            }
          } catch { /* silence */ }
        })()
      );
    }

    // 1. Website enrichment (email + social links do site)
    if (discoveredSite) {
      enrichmentPromises.push(
        (async () => {
          try {
            const result = await enrichLead({ nome, site: discoveredSite, cidade, email: '', instagram: '', facebook: '', tiktok: '', cnpj: '' });
            if (result.email) enriched.email = result.email;
            if (result.instagram) enriched.instagram = result.instagram;
            if (result.facebook) enriched.facebook = result.facebook;
            if (result.tiktok) enriched.tiktok = result.tiktok;
          } catch { /* silence */ }
        })()
      );
    }

    // 2. CNPJ enrichment via BrasilAPI (try with provided CNPJ or discover by name)
    if (cnpj && !enriched.cnpj) {
      enrichmentPromises.push(
        (async () => {
          try {
            const cnpjData = await enrichCNPJ(cnpj);
            if (cnpjData) Object.assign(enriched, cnpjData);
          } catch { /* silence */ }
        })()
      );
    } else if (!cnpj && !enriched.cnpj) {
      enrichmentPromises.push(
        (async () => {
          try {
            const cnpjData = await discoverCNPJviaCompanyName(nome);
            if (cnpjData) Object.assign(enriched, cnpjData);
          } catch { /* silence */ }
        })()
      );
    }

    // 3. Social search (Instagram, Facebook, TikTok) - only for missing fields
    if (!enriched.instagram || !enriched.facebook || !enriched.tiktok) {
      enrichmentPromises.push(
        (async () => {
          try {
            const [insta, fb, tt] = await Promise.all([
              !enriched.instagram ? searchSocial(nome, 'instagram', cidade) : Promise.resolve({ url: undefined, score: 0 }),
              !enriched.facebook ? searchSocial(nome, 'facebook', cidade) : Promise.resolve({ url: undefined, score: 0 }),
              !enriched.tiktok ? searchSocial(nome, 'tiktok', cidade) : Promise.resolve({ url: undefined, score: 0 }),
            ]);
            if (insta.url && !enriched.instagram) enriched.instagram = insta.url;
            if (fb.url && !enriched.facebook) enriched.facebook = fb.url;
            if (tt.url && !enriched.tiktok) enriched.tiktok = tt.url;
          } catch { /* silence */ }
        })()
      );
    }

    // Aguarda todos os enriquecimentos (max 20s)
    await Promise.race([
      Promise.all(enrichmentPromises),
      new Promise(r => setTimeout(r, 20000)),
    ]);

    // Se nao encontrou nada, retorna vazio
    if (Object.keys(enriched).length === 0) {
      return NextResponse.json({
        success: true,
        enriched: null,
        message: 'Nenhum dado adicional encontrado.'
      });
    }

    try {
      const supabase = createAdminSupabaseClient();
      await supabase.from('lead_enrichment_cache').upsert({
        company_name: nome,
        city: cidade || '',
        site: discoveredSite || site || '',
        email: enriched.email || '',
        instagram: enriched.instagram || '',
        facebook: enriched.facebook || '',
        tiktok: enriched.tiktok || '',
        cnpj: enriched.cnpj || '',
        enriched_at: new Date().toISOString(),
      }, { onConflict: 'company_name,city' });
    } catch { /* silence - cache e opcional */ }

    return NextResponse.json({
      success: true,
      enriched: enriched,
      message: `${Object.keys(enriched).length} campos enriquecidos para "${nome}"`
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'erro desconhecido';
    console.error('ERRO LEAD ENRICH:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
