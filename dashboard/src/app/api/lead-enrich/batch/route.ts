import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, createAdminSupabaseClient } from '@/lib/server-auth';
import { enrichLead } from '../../extract/enrichment/website';

interface BatchLead {
  nome: string; site?: string; cidade?: string; cnpj?: string;
  email?: string; instagram?: string; facebook?: string; tiktok?: string; telefone?: string;
  leadKey?: string;
}

interface BatchResult { nome: string; enriched: Record<string, any> | null; error?: string; leadKey?: string; }

interface BatchState {
  status: 'running' | 'completed' | 'failed';
  total: number; completed: number; failed: number;
  results: BatchResult[]; error?: string; createdAt: number;
}

const inMemoryStore = new Map<string, BatchState>();
const BATCH_TTL = 10 * 60 * 1000;

const BR_PHONE_REGEX = /\(?(\d{2,3})\)?\s?(\d{4,5})[\s-]?(\d{4})/g;
const URL_REGEX = /https?:\/\/[^\s"'<>)\]]+/g;

function normalizeName(name: string) {
  return name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s]/g, '').trim();
}

function extractPhoneFromText(text: string): string[] {
  const phones: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = BR_PHONE_REGEX.exec(text)) !== null) {
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
  const queries = [`"${name}" ${city || ''}`, `${name} ${city || ''} telefone endereco`, `${name} ${city || ''} site`];

  for (const query of queries) {
    const html = await duckduckgoSearch(query);
    if (!html) continue;

    if (!data.telefone) {
      const phones = extractPhoneFromText(html);
      if (phones.length > 0) data.telefone = phones[0];
    }
    if (!data.cnpj) { const c = extractCNPJFromText(html); if (c) data.cnpj = c; }
    if (!data.endereco) { const a = extractAddressFromText(html, city); if (a) data.endereco = a; }
    if (!data.site) { const s = extractSiteFromUrls(html, name); if (s) data.site = s; }

    if (!data.instagram) {
      const m = html.match(/https?:\/\/(?:www\.)?instagram\.com\/([a-zA-Z0-9._]+)/);
      if (m && !m[1].match(/^(p|reel|stories|explore|accounts)/)) data.instagram = `https://instagram.com/${m[1]}`;
    }
    if (!data.facebook) {
      const m = html.match(/https?:\/\/(?:www\.)?facebook\.com\/([^\s"'<>]+)/);
      if (m && !m[1].match(/^(sharer|share|dialog|plugins|events|groups|login|privacy)/)) {
        const cleanPath = m[1].replace(/[/?].*/, '');
        if (cleanPath.length > 1) data.facebook = `https://facebook.com/${cleanPath}`;
      }
    }
    if (!data.tiktok) {
      const m = html.match(/https?:\/\/(?:www\.)?tiktok\.com\/@([a-zA-Z0-9._]+)/);
      if (m) data.tiktok = `https://tiktok.com/@${m[1]}`;
    }
  }

  if (!data.site || !data.telefone || !data.cnpj) {
    const html = await duckduckgoSearch(`${name} ${city || ''}`);
    if (html) {
      const urls = Array.from(html.matchAll(/href="[^"]*"/g), m => m[1]);
      const dirDomains = ['restaurantguru.com.br', 'apontador.com.br', 'ifood.com.br', 'yelp.com',
        'econodata.com.br', 'cnpj.info', 'benditoguia.com.br', 'guiafacil.com', 'listamais.com.br'];
      for (const rawUrl of urls) {
        try {
          const url = rawUrl.startsWith('http') ? rawUrl : `https:${rawUrl}`;
          const host = new URL(url).hostname.replace(/^www\./, '').toLowerCase();
          if (dirDomains.some(d => host === d || host.endsWith('.' + d))) {
            const text = await fetchPageText(url);
            if (text) {
              if (!data.telefone) { const p = extractPhoneFromText(text); if (p.length > 0) data.telefone = p[0]; }
              if (!data.cnpj) { const c = extractCNPJFromText(text); if (c) data.cnpj = c; }
              if (!data.endereco) { const a = extractAddressFromText(text, city); if (a) data.endereco = a; }
              if (!data.site) {
                const s = text.match(/https?:\/\/(?:www\.)?[a-zA-Z0-9][a-zA-Z0-9.-]+\.[a-zA-Z]{2,}[^\s"'<>]*/);
                if (s && !['instagram.com', 'facebook.com', 'tiktok.com', 'youtube.com'].some(b => s[0].includes(b))) {
                  data.site = s[0].split('?')[0].split('#')[0];
                }
              }
            }
          }
        } catch { continue; }
      }
    }
  }

  if (!data.cnpj) {
    try {
      const searchRes = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${encodeURIComponent(name)}`, {
        headers: { 'User-Agent': 'GeoLeads/1.0' }, signal: AbortSignal.timeout(5000),
      });
      if (searchRes.ok) {
        const d = await searchRes.json();
        if (d.cnpj) {
          const digits = d.cnpj.replace(/\D/g, '');
          data.cnpj = `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
          if (!data.telefone && d.ddd_telefone_1) data.telefone = `(${d.ddd_telefone_1}) ${d.telefone_1}`;
          data.razao_social = d.razao_social || '';
          data.nome_fantasia = d.nome_fantasia || '';
          data.endereco_completo = d.logradouro ? `${d.logradouro}, ${d.numero} - ${d.bairro}` : '';
          data.cidade = d.municipio || '';
          data.uf = d.uf || '';
          data.cep = d.cep || '';
          data.atividade = d.descricao_atividade_principal?.[0]?.text || '';
          data.situacao_cadastral = d.situacao_cadastral || '';
        }
      }
    } catch { /* silence */ }
  }

  return data;
}

async function enrichSingleLead(lead: BatchLead, supabase: ReturnType<typeof createAdminSupabaseClient>): Promise<BatchResult> {
  const leadKey = lead.leadKey;
  try {
    const enriched: Record<string, any> = {};
    let discoveredSite = lead.site && lead.site !== 'Sem site' ? lead.site : null;

    try {
      const { data: cached } = await supabase.from('lead_enrichment_cache')
        .select('*').eq('company_name', lead.nome).eq('city', lead.cidade || '').maybeSingle();
      if (cached) {
        if (!lead.email && cached.email) enriched.email = cached.email;
        if (!lead.instagram && cached.instagram) enriched.instagram = cached.instagram;
        if (!lead.facebook && cached.facebook) enriched.facebook = cached.facebook;
        if (!lead.tiktok && cached.tiktok) enriched.tiktok = cached.tiktok;
        if (!lead.cnpj && cached.cnpj) enriched.cnpj = cached.cnpj;
        if (!discoveredSite && cached.site) discoveredSite = cached.site;
        if (cached.telefone) enriched.telefone = cached.telefone;
      }
    } catch { /* continue */ }

    const enrichmentPromises: Promise<void>[] = [];

    enrichmentPromises.push(
      (async () => {
        try {
          const bizData = await searchBusinessData(lead.nome, lead.cidade);
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
          if (bizData.endereco_completo) enriched.endereco_completo = bizData.endereco_completo;
          if (bizData.uf) enriched.uf = bizData.uf;
          if (bizData.cep) enriched.cep = bizData.cep;
        } catch { /* silence */ }
      })()
    );

    if (lead.cnpj && lead.cnpj.replace(/\D/g, '').length === 14) {
      enrichmentPromises.push(
        (async () => {
          try {
            const digits = lead.cnpj!.replace(/\D/g, '');
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
          } catch { /* silence */ }
        })()
      );
    }

    if (discoveredSite) {
      enrichmentPromises.push(
        (async () => {
          try {
            const result = await enrichLead({
              nome: lead.nome, site: discoveredSite, cidade: lead.cidade,
              email: lead.email || '', instagram: lead.instagram || '',
              facebook: lead.facebook || '', tiktok: lead.tiktok || '', cnpj: lead.cnpj || '',
            });
            if (result.email && !enriched.email) enriched.email = result.email;
            if (result.instagram && !enriched.instagram) enriched.instagram = result.instagram;
            if (result.facebook && !enriched.facebook) enriched.facebook = result.facebook;
            if (result.tiktok && !enriched.tiktok) enriched.tiktok = result.tiktok;
          } catch { /* silence */ }
        })()
      );
    }

    if (!enriched.instagram || !enriched.facebook || !enriched.tiktok) {
      enrichmentPromises.push(
        (async () => {
          try {
            const html = await duckduckgoSearch(`${lead.nome} ${lead.cidade || ''} instagram facebook tiktok`);
            if (!enriched.instagram) {
              const m = html.match(/https?:\/\/(?:www\.)?instagram\.com\/([a-zA-Z0-9._]+)/);
              if (m && !m[1].match(/^(p|reel|stories|explore|accounts)/)) enriched.instagram = `https://instagram.com/${m[1]}`;
            }
            if (!enriched.facebook) {
              const m = html.match(/https?:\/\/(?:www\.)?facebook\.com\/([^\s"'<>]+)/);
              if (m && !m[1].match(/^(sharer|share|dialog|plugins|events|groups|login|privacy)/)) {
                const cleanPath = m[1].replace(/[/?].*/, '');
                if (cleanPath.length > 1) enriched.facebook = `https://facebook.com/${cleanPath}`;
              }
            }
            if (!enriched.tiktok) {
              const m = html.match(/https?:\/\/(?:www\.)?tiktok\.com\/@([a-zA-Z0-9._]+)/);
              if (m) enriched.tiktok = `https://tiktok.com/@${m[1]}`;
            }
          } catch { /* silence */ }
        })()
      );
    }

    await Promise.race([
      Promise.all(enrichmentPromises),
      new Promise(r => setTimeout(r, 25000)),
    ]);

    if (Object.keys(enriched).length > 0) {
      try {
        await supabase.from('lead_enrichment_cache').upsert({
          company_name: lead.nome, city: lead.cidade || '',
          site: discoveredSite || lead.site || '',
          email: enriched.email || '', instagram: enriched.instagram || '',
          facebook: enriched.facebook || '', tiktok: enriched.tiktok || '',
          cnpj: enriched.cnpj || '', telefone: enriched.telefone || '',
          enriched_at: new Date().toISOString(),
        }, { onConflict: 'company_name,city' });
      } catch { /* silence */ }
    }

    return { nome: lead.nome, leadKey, enriched: Object.keys(enriched).length > 0 ? enriched : null };
  } catch (error: unknown) {
    return { nome: lead.nome, leadKey, enriched: null, error: error instanceof Error ? error.message : 'erro desconhecido' };
  }
}

// Hybrid store: try DB first, fall back to in-memory
async function createBatch(auth: { user: { id: string } }, leads: BatchLead[]): Promise<{ batchId: string; store: 'db' | 'memory'; batchData?: any }> {
  // Try DB
  try {
    const supabase = createAdminSupabaseClient();
    const { data, error } = await supabase.from('enrichment_batches').insert({
      user_id: auth.user.id, status: 'running', total: leads.length,
      completed: 0, failed: 0, results: [], leads,
      started_at: new Date().toISOString(),
    }).select('id').single();
    if (!error && data) return { batchId: data.id, store: 'db', batchData: data };
  } catch { /* table may not exist - fall through */ }

  // Fallback to in-memory
  const batchId = `batch_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const state: BatchState = { status: 'running', total: leads.length, completed: 0, failed: 0, results: [], createdAt: Date.now() };
  inMemoryStore.set(batchId, state);
  return { batchId, store: 'memory', batchData: state };
}

async function updateBatchProgress(
  batchId: string, store: 'db' | 'memory',
  completed: number, failed: number, total: number,
  results: BatchResult[], status: 'running' | 'completed' | 'failed'
): Promise<void> {
  if (store === 'db') {
    try {
      const supabase = createAdminSupabaseClient();
      await Promise.race([
        supabase.from('enrichment_batches').update({
          completed, failed, results: JSON.stringify(results), status,
          completed_at: status !== 'running' ? new Date().toISOString() : null,
        }).eq('id', batchId),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 15000)),
      ]);
    } catch (e: any) {
      console.error(`[ENRICH BATCH] DB update failed for ${batchId}:`, e.message || e);
    }
  } else {
    const state = inMemoryStore.get(batchId);
    if (state) { state.completed = completed; state.failed = failed; state.results = results; state.status = status; }
    // Cleanup old entries
    for (const [id, s] of inMemoryStore) { if (Date.now() - s.createdAt > BATCH_TTL) inMemoryStore.delete(id); }
  }
}

async function processBatch(leads: BatchLead[], batchId: string, store: 'db' | 'memory', supabase: ReturnType<typeof createAdminSupabaseClient>): Promise<void> {
  const results: BatchResult[] = [];
  let completed = 0;
  let failed = 0;
  const concurrency = 3;
  const executing = new Set<Promise<void>>();

  for (const lead of leads) {
    const p = (async () => {
      const result = await enrichSingleLead(lead, supabase);
      results.push(result);
      if (result.error) failed++; else completed++;
      await updateBatchProgress(batchId, store, completed, failed, leads.length, results,
        (completed + failed === leads.length) ? (failed === leads.length ? 'failed' : 'completed') : 'running');
    })();
    executing.add(p);
    const clean = () => executing.delete(p);
    p.then(clean, clean);
    if (executing.size >= concurrency) await Promise.race(executing);
  }
  await Promise.all(executing);
}

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthUser(request);
    if (!auth) return NextResponse.json({ error: 'Nao autenticado.' }, { status: 401 });

    const body = await request.json();
    const { leads } = body;
    if (!Array.isArray(leads) || leads.length === 0) return NextResponse.json({ error: 'Envie um array de leads.' }, { status: 400 });
    if (leads.length > 100) return NextResponse.json({ error: 'Maximo de 100 leads por lote.' }, { status: 400 });

    const supabase = createAdminSupabaseClient();
    const { batchId, store } = await createBatch(auth, leads);

    processBatch(leads, batchId, store, supabase).catch((err) => {
      console.error(`[ENRICH BATCH] processBatch ${batchId} failed:`, err);
      updateBatchProgress(batchId, store, 0, leads.length, leads.length, [], 'failed');
    });

    return NextResponse.json({ success: true, batchId, store, total: leads.length, status: 'running' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'erro desconhecido';
    console.error('ERRO BATCH ENRICH:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthUser(request);
    if (!auth) return NextResponse.json({ error: 'Nao autenticado.' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const batchId = searchParams.get('batchId');

    // Try DB first
    if (!batchId) {
      // Get most recent running batch
      try {
        const supabase = createAdminSupabaseClient();
        const { data } = await supabase.from('enrichment_batches')
          .select('*').eq('user_id', auth.user.id).eq('status', 'running')
          .order('started_at', { ascending: false }).limit(1).maybeSingle();
        if (data) {
          return NextResponse.json({
            success: true, batchId: data.id, total: data.total, completed: data.completed,
            failed: data.failed, percentage: data.total > 0 ? Math.round(((data.completed + data.failed) / data.total) * 100) : 0,
            results: data.results || [], status: data.status,
          });
        }
      } catch { /* no DB table - try memory */ }

      // Fallback: in-memory
      let latestRunning: { id: string; state: BatchState } | null = null;
      let latestId = '';
      for (const [id, s] of inMemoryStore) {
        if (s.status === 'running' && (!latestRunning || s.createdAt > latestRunning.state.createdAt)) {
          latestRunning = { id, state: s };
          latestId = id;
        }
      }
      if (!latestRunning) return NextResponse.json({ success: true, status: 'no_batch' });
      const s = latestRunning.state;
      return NextResponse.json({
        success: true, batchId: latestId, total: s.total, completed: s.completed,
        failed: s.failed, percentage: s.total > 0 ? Math.round(((s.completed + s.failed) / s.total) * 100) : 0,
        results: s.results, status: s.status,
      });
    }

    // Specific batchId
    try {
      const supabase = createAdminSupabaseClient();
      const { data } = await supabase.from('enrichment_batches')
        .select('*').eq('id', batchId).eq('user_id', auth.user.id).maybeSingle();
      if (data) {
        return NextResponse.json({
          success: true, batchId: data.id, total: data.total, completed: data.completed,
          failed: data.failed, percentage: data.total > 0 ? Math.round(((data.completed + data.failed) / data.total) * 100) : 0,
          results: data.results || [], status: data.status,
        });
      }
    } catch { /* no DB table */ }

    const state = inMemoryStore.get(batchId);
    if (!state) return NextResponse.json({ success: true, status: 'no_batch' });
    return NextResponse.json({
      success: true, batchId, total: state.total, completed: state.completed,
      failed: state.failed, percentage: state.total > 0 ? Math.round(((state.completed + state.failed) / state.total) * 100) : 0,
      results: state.results, status: state.status,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'erro desconhecido';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
