import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, createAdminSupabaseClient } from '@/lib/server-auth';
import { enrichLead } from '../../extract/enrichment/website';

interface BatchLead {
  nome: string;
  site?: string;
  cidade?: string;
  cnpj?: string;
  email?: string;
  instagram?: string;
  facebook?: string;
  tiktok?: string;
  telefone?: string;
}

interface BatchResult {
  nome: string;
  enriched: Record<string, any> | null;
  error?: string;
}

interface BatchState {
  status: 'running' | 'completed' | 'failed';
  total: number;
  completed: number;
  failed: number;
  results: BatchResult[];
  error?: string;
  createdAt: number;
}

const batchStore = new Map<string, BatchState>();
const BATCH_TTL = 10 * 60 * 1000;

function generateBatchId(): string {
  return `batch_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

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

function hasMissingFields(lead: BatchLead): boolean {
  return !lead.email || !lead.instagram || !lead.facebook || !lead.tiktok;
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

async function enrichSingleLead(lead: BatchLead, supabase: ReturnType<typeof createAdminSupabaseClient>): Promise<BatchResult> {
  try {
    const enriched: Record<string, any> = {};
    const hasMissing = hasMissingFields(lead);

    if (!hasMissing && lead.cnpj) {
      return { nome: lead.nome, enriched: null };
    }

    let discoveredSite = lead.site && lead.site !== 'Sem site' ? lead.site : null;

    try {
      const { data: cached } = await supabase
        .from('lead_enrichment_cache')
        .select('email, instagram, facebook, tiktok, cnpj, site')
        .eq('company_name', lead.nome)
        .eq('city', lead.cidade || '')
        .maybeSingle();

      if (cached) {
        if (!lead.email && cached.email) enriched.email = cached.email;
        if (!lead.instagram && cached.instagram) enriched.instagram = cached.instagram;
        if (!lead.facebook && cached.facebook) enriched.facebook = cached.facebook;
        if (!lead.tiktok && cached.tiktok) enriched.tiktok = cached.tiktok;
        if (!lead.cnpj && cached.cnpj) enriched.cnpj = cached.cnpj;
        if (!discoveredSite && cached.site) discoveredSite = cached.site;
      }
    } catch { /* continue without cache */ }

    const enrichmentPromises: Promise<void>[] = [];

    // Site discovery se nao tem site
    if (!discoveredSite) {
      enrichmentPromises.push(
        (async () => {
          try {
            const foundSite = await discoverSiteViaDuckDuckGo(lead.nome, lead.cidade);
            if (foundSite) {
              discoveredSite = foundSite;
              enriched.site_descoberto = foundSite;
            }
          } catch { /* silence */ }
        })()
      );
    }

    if (discoveredSite) {
      enrichmentPromises.push(
        (async () => {
          try {
            const result = await enrichLead({ nome: lead.nome, site: discoveredSite, cidade: lead.cidade, email: lead.email || '', instagram: lead.instagram || '', facebook: lead.facebook || '', tiktok: lead.tiktok || '', cnpj: lead.cnpj || '' });
            if (result.email && !enriched.email) enriched.email = result.email;
            if (result.instagram && !enriched.instagram) enriched.instagram = result.instagram;
            if (result.facebook && !enriched.facebook) enriched.facebook = result.facebook;
            if (result.tiktok && !enriched.tiktok) enriched.tiktok = result.tiktok;
          } catch { /* silence */ }
        })()
      );
    }

    if (lead.cnpj && !enriched.cnpj) {
      enrichmentPromises.push(
        (async () => {
          try {
            const cnpjData = await enrichCNPJ(lead.cnpj);
            if (cnpjData) Object.assign(enriched, cnpjData);
          } catch { /* silence */ }
        })()
      );
    } else if (!lead.cnpj && !enriched.cnpj) {
      enrichmentPromises.push(
        (async () => {
          try {
            const cnpjData = await discoverCNPJviaCompanyName(lead.nome);
            if (cnpjData) Object.assign(enriched, cnpjData);
          } catch { /* silence */ }
        })()
      );
    }

    if (!enriched.instagram || !enriched.facebook || !enriched.tiktok) {
      enrichmentPromises.push(
        (async () => {
          try {
            const [insta, fb, tt] = await Promise.all([
              searchSocial(lead.nome, 'instagram', lead.cidade),
              searchSocial(lead.nome, 'facebook', lead.cidade),
              searchSocial(lead.nome, 'tiktok', lead.cidade),
            ]);
            if (insta.url && !enriched.instagram) enriched.instagram = insta.url;
            if (fb.url && !enriched.facebook) enriched.facebook = fb.url;
            if (tt.url && !enriched.tiktok) enriched.tiktok = tt.url;
          } catch { /* silence */ }
        })()
      );
    }

    await Promise.race([
      Promise.all(enrichmentPromises),
      new Promise(r => setTimeout(r, 15000)),
    ]);

    if (Object.keys(enriched).length > 0) {
      try {
        await supabase.from('lead_enrichment_cache').upsert({
          company_name: lead.nome,
          city: lead.cidade || '',
          site: discoveredSite || lead.site || '',
          email: enriched.email || '',
          instagram: enriched.instagram || '',
          facebook: enriched.facebook || '',
          tiktok: enriched.tiktok || '',
          cnpj: enriched.cnpj || '',
          enriched_at: new Date().toISOString(),
        }, { onConflict: 'company_name,city' });
      } catch { /* silence */ }
    }

    return {
      nome: lead.nome,
      enriched: Object.keys(enriched).length > 0 ? enriched : null,
    };
  } catch (error: unknown) {
    return {
      nome: lead.nome,
      enriched: null,
      error: error instanceof Error ? error.message : 'erro desconhecido',
    };
  }
}

async function processBatch(leads: BatchLead[], batchId: string, supabase: ReturnType<typeof createAdminSupabaseClient>): Promise<void> {
  const state = batchStore.get(batchId)!;
  const concurrency = 5;
  const executing = new Set<Promise<void>>();

  for (const lead of leads) {
    const p = (async () => {
      const result = await enrichSingleLead(lead, supabase);
      const currentState = batchStore.get(batchId);
      if (!currentState) return;
      currentState.results.push(result);
      if (result.error) {
        currentState.failed++;
      } else {
        currentState.completed++;
      }
    })();
    executing.add(p);
    const clean = () => executing.delete(p);
    p.then(clean, clean);
    if (executing.size >= concurrency) {
      await Promise.race(executing);
    }
  }

  await Promise.all(executing);

  const finalState = batchStore.get(batchId);
  if (finalState) {
    finalState.status = finalState.failed === leads.length ? 'failed' : 'completed';
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthUser(request);
    if (!auth) {
      return NextResponse.json({ error: 'Nao autenticado.' }, { status: 401 });
    }

    const body = await request.json();
    const { leads } = body;

    if (!Array.isArray(leads) || leads.length === 0) {
      return NextResponse.json({ error: 'Envie um array de leads.' }, { status: 400 });
    }

    if (leads.length > 100) {
      return NextResponse.json({ error: 'Maximo de 100 leads por lote.' }, { status: 400 });
    }

    const batchId = generateBatchId();
    const supabase = createAdminSupabaseClient();

    const batchState: BatchState = {
      status: 'running',
      total: leads.length,
      completed: 0,
      failed: 0,
      results: [],
      createdAt: Date.now(),
    };
    batchStore.set(batchId, batchState);

    processBatch(leads, batchId, supabase).catch(() => {
      const s = batchStore.get(batchId);
      if (s) s.status = 'failed';
    });

    return NextResponse.json({
      success: true,
      batchId,
      total: leads.length,
      status: 'running',
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'erro desconhecido';
    console.error('ERRO BATCH ENRICH:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const batchId = searchParams.get('batchId');

  if (!batchId) {
    return NextResponse.json({ error: 'Informe batchId.' }, { status: 400 });
  }

  const state = batchStore.get(batchId);
  if (!state) {
    return NextResponse.json({ error: 'Batch não encontrado ou expirado.' }, { status: 404 });
  }

  // Cleanup expired batches periodically
  for (const [id, s] of batchStore) {
    if (Date.now() - s.createdAt > BATCH_TTL) {
      batchStore.delete(id);
    }
  }

  return NextResponse.json({
    success: true,
    batchId,
    total: state.total,
    completed: state.completed,
    failed: state.failed,
    percentage: Math.round(((state.completed + state.failed) / state.total) * 100),
    results: state.results,
    status: state.status,
  });
}
