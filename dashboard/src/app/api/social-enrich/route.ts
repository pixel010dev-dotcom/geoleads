import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAuthUser, requireFeature } from '@/lib/server-auth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder-project-url.supabase.co',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key'
);

type SocialResult = {
  instagram?: string;
  facebook?: string;
  tiktok?: string;
  linkedin?: string;
  twitter?: string;
  confidence_score: number;
  source: string;
};

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

async function searchInstagram(name: string, city?: string): Promise<{ url?: string; score: number }> {
  try {
    const query = encodeURIComponent(`${name} ${city || ''} instagram`);
    const res = await fetch(`https://html.duckduckgo.com/html/?q=${query}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      signal: AbortSignal.timeout(5000)
    });
    if (!res.ok) return { score: 0 };
    const html = await res.text();

    const instaRegex = /https?:\/\/(?:www\.)?instagram\.com\/([a-zA-Z0-9._]+)/g;
    let match: RegExpExecArray | null;
    let bestUrl = '';
    let bestScore = 0;

    while ((match = instaRegex.exec(html))) {
      const url = match[0];
      const username = match[1];
      const score = scoreMatch(name, username.replace(/[._]/g, ' '));
      if (score > bestScore && score >= 40) {
        bestScore = score;
        bestUrl = url;
      }
    }

    return { url: bestUrl || undefined, score: bestScore };
  } catch {
    return { score: 0 };
  }
}

async function searchFacebook(name: string, city?: string): Promise<{ url?: string; score: number }> {
  try {
    const query = encodeURIComponent(`${name} ${city || ''} facebook`);
    const res = await fetch(`https://html.duckduckgo.com/html/?q=${query}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      signal: AbortSignal.timeout(5000)
    });
    if (!res.ok) return { score: 0 };
    const html = await res.text();

    const fbRegex = /https?:\/\/(?:www\.)?facebook\.com\/([^\s"'<>]+)/g;
    let match: RegExpExecArray | null;
    let bestUrl = '';
    let bestScore = 0;

    while ((match = fbRegex.exec(html))) {
      const url = match[0];
      if (url.includes('/p/') || url.includes('/share') || url.includes('/events')) continue;
      const pageName = match[1].replace(/[/?].*/, '').replace(/[._]/g, ' ');
      const score = scoreMatch(name, pageName);
      if (score > bestScore && score >= 40) {
        bestScore = score;
        bestUrl = url;
      }
    }

    return { url: bestUrl || undefined, score: bestScore };
  } catch {
    return { score: 0 };
  }
}

async function searchTiktok(name: string, city?: string): Promise<{ url?: string; score: number }> {
  try {
    const query = encodeURIComponent(`${name} ${city || ''} tiktok`);
    const res = await fetch(`https://html.duckduckgo.com/html/?q=${query}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      signal: AbortSignal.timeout(5000)
    });
    if (!res.ok) return { score: 0 };
    const html = await res.text();

    const ttRegex = /https?:\/\/(?:www\.)?tiktok\.com\/@([a-zA-Z0-9._]+)/g;
    let match: RegExpExecArray | null;
    let bestUrl = '';
    let bestScore = 0;

    while ((match = ttRegex.exec(html))) {
      const url = match[0];
      const username = match[1];
      const score = scoreMatch(name, username.replace(/[._]/g, ' '));
      if (score > bestScore && score >= 40) {
        bestScore = score;
        bestUrl = url;
      }
    }

    return { url: bestUrl || undefined, score: bestScore };
  } catch {
    return { score: 0 };
  }
}

export async function POST(request: Request) {
  try {
    const auth = await getAuthUser(request);
    if (!auth) {
      return NextResponse.json({ error: 'Nao autenticado.' }, { status: 401 });
    }

    if (!requireFeature(auth.planId, 'socialEnrichment')) {
      return NextResponse.json({ error: 'Enriquecimento social exige plano Profissional ou superior.' }, { status: 403 });
    }

    const body = await request.json();
    const { name, city, niche, site } = body;

    if (!name) {
      return NextResponse.json({ error: 'Informe o nome da empresa.' }, { status: 400 });
    }

    const cacheKey = `${normalizeName(name)}|${normalizeName(city || '')}`;

    const { data: cached } = await supabase
      .from('social_enrichment_cache')
      .select('*')
      .eq('company_name', name)
      .eq('city', city || '')
      .maybeSingle();

    if (cached) {
      return NextResponse.json({
        success: true,
        source: 'cache',
        data: {
          instagram: cached.instagram || undefined,
          facebook: cached.facebook || undefined,
          tiktok: cached.tiktok || undefined,
          linkedin: cached.linkedin || undefined,
          twitter: cached.twitter || undefined,
          confidence_score: cached.confidence_score,
          source: cached.source
        }
      });
    }

    const results: SocialResult = { confidence_score: 0, source: 'search' };
    let totalScore = 0;
    let foundCount = 0;

    const [insta, fb, tt] = await Promise.all([
      searchInstagram(name, city),
      searchFacebook(name, city),
      searchTiktok(name, city)
    ]);

    if (insta.url && insta.score >= 40) {
      results.instagram = insta.url;
      totalScore += insta.score;
      foundCount++;
    }
    if (fb.url && fb.score >= 40) {
      results.facebook = fb.url;
      totalScore += fb.score;
      foundCount++;
    }
    if (tt.url && tt.score >= 40) {
      results.tiktok = tt.url;
      totalScore += tt.score;
      foundCount++;
    }

    results.confidence_score = foundCount > 0 ? Math.round(totalScore / foundCount) : 0;

    if (foundCount > 0) {
      await supabase.from('social_enrichment_cache').insert({
        company_name: name,
        city: city || '',
        niche: niche || '',
        instagram: results.instagram || '',
        facebook: results.facebook || '',
        tiktok: results.tiktok || '',
        confidence_score: results.confidence_score,
        source: 'search'
      });
    }

    return NextResponse.json({
      success: true,
      source: 'search',
      data: results
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'erro desconhecido';
    console.error('ERRO SOCIAL ENRICH:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
