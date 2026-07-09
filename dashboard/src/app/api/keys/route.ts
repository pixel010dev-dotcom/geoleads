// POST /api/keys — Gera nova chave de API (sem tabela, chave auto-contida)
// GET /api/keys — Lista chaves do usuário (via profiles.api_keys jsonb)
// DELETE /api/keys — Revoga chave

import { NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/server-auth';
import crypto from 'crypto';

function getUserId(request: Request): string | null {
  // Try Authorization header first
  const auth = request.headers.get('authorization') || '';
  const token = auth.replace(/^Bearer\s+/i, '').trim();
  if (token) {
    try {
      const base64Payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      return JSON.parse(Buffer.from(base64Payload, 'base64').toString('utf8')).sub;
    } catch { /* fallthrough to cookie */ }
  }
  // Then try cookie
  const cookie = request.headers.get('cookie') || '';
  const matches = [...cookie.matchAll(/sb-[^-]+-auth-token=([^;]+)/g)];
  if (matches.length) {
    try {
      const tokenData = JSON.parse(decodeURIComponent(matches[0][1]));
      const accessToken = tokenData.access_token;
      if (!accessToken) return null;
      const base64Payload = accessToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      return JSON.parse(Buffer.from(base64Payload, 'base64').toString('utf8')).sub;
    } catch { return null; }
  }
  return null;
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const userId = getUserId(request);
    if (!userId) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });

    const { name } = await request.json();
    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'Nome da chave é obrigatório.' }, { status: 400 });
    }

    // Generate key: gl_<userId_hash>_<random>
    const raw = crypto.randomBytes(24).toString('hex');
    const userIdHash = crypto.createHash('sha256').update(userId).digest('hex').slice(0, 12);
    const key = `gl_${userIdHash}_${raw}`;
    const prefix = key.slice(0, 14);
    const lastChars = key.slice(-4);

    // Store in profiles as JSONB (api_keys array)
    const supabase = createAdminSupabaseClient();
    const { data: profile } = await supabase
      .from('profiles')
      .select('api_keys')
      .eq('id', userId)
      .single();

    const existingKeys = (profile?.api_keys as any[]) || [];
    const newKey = {
      id: crypto.randomUUID(),
      name: name.trim(),
      key,
      prefix,
      last_chars: lastChars,
      created_at: new Date().toISOString(),
      last_used_at: null,
      revoked: false,
      revoked_at: null,
    };

    const { error: updateErr } = await supabase
      .from('profiles')
      .update({ api_keys: [...existingKeys, newKey] })
      .eq('id', userId);

    if (updateErr) {
      console.error('[API KEYS] Update error:', updateErr);
      return NextResponse.json({ error: 'Erro ao salvar chave.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, key, prefix, lastChars });
  } catch (e: any) {
    console.error('[API KEYS] Error:', e);
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const userId = getUserId(request);
    if (!userId) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });

    const supabase = createAdminSupabaseClient();
    const { data: profile } = await supabase
      .from('profiles')
      .select('api_keys')
      .eq('id', userId)
      .single();

    const keys = (profile?.api_keys as any[]) || [];
    const safeKeys = keys.map((k: any) => ({
      id: k.id,
      name: k.name,
      prefix: k.prefix,
      last_chars: k.last_chars,
      created_at: k.created_at,
      last_used_at: k.last_used_at,
      revoked: k.revoked,
    }));

    return NextResponse.json({ keys: safeKeys });
  } catch (e: any) {
    console.error('[API KEYS] Fetch error:', e);
    return NextResponse.json({ keys: [] });
  }
}

export async function DELETE(request: Request) {
  try {
    const userId = getUserId(request);
    if (!userId) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });

    const { keyId } = await request.json();
    if (!keyId) return NextResponse.json({ error: 'ID da chave é obrigatório.' }, { status: 400 });

    const supabase = createAdminSupabaseClient();
    const { data: profile } = await supabase
      .from('profiles')
      .select('api_keys')
      .eq('id', userId)
      .single();

    let keys = (profile?.api_keys as any[]) || [];
    keys = keys.map((k: any) =>
      k.id === keyId ? { ...k, revoked: true, revoked_at: new Date().toISOString() } : k
    );

    const { error: updateErr } = await supabase
      .from('profiles')
      .update({ api_keys: keys })
      .eq('id', userId);

    if (updateErr) {
      return NextResponse.json({ error: 'Erro ao revogar chave.' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error('[API KEYS] Error:', e);
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
  }
}
