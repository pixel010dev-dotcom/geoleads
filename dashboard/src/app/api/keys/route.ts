// POST /api/keys — Gera nova chave de API
import { NextResponse } from 'next/server';
import { getAuthUser, createAdminSupabaseClient } from '@/lib/server-auth';
import crypto from 'crypto';

function generateApiKey(): { key: string; prefix: string; lastChars: string } {
  const raw = crypto.randomBytes(32).toString('hex');
  const key = `gl_${raw}`;
  const prefix = key.slice(0, 10);
  const lastChars = key.slice(-4);
  return { key, prefix, lastChars };
}

export async function POST(request: Request) {
  try {
    const auth = await getAuthUser(request);
    if (!auth) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });

    const { name } = await request.json();
    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: 'Nome da chave é obrigatório.' }, { status: 400 });
    }

    const { key, prefix, lastChars } = generateApiKey();

    const supabase = createAdminSupabaseClient();
    const { error: insertError } = await supabase.from('api_keys').insert({
      user_id: auth.user.id,
      name: name.trim(),
      key,
      prefix,
      last_chars: lastChars,
      created_at: new Date().toISOString(),
    });

    if (insertError) {
      console.error('[API KEYS] Insert error:', insertError);
      return NextResponse.json({ error: 'Erro ao criar chave.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, key, prefix, lastChars });
  } catch (e: any) {
    console.error('[API KEYS] Error:', e);
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
  }
}

// GET /api/keys — Lista chaves do usuário
export async function GET(request: Request) {
  try {
    const auth = await getAuthUser(request);
    if (!auth) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });

    const supabase = createAdminSupabaseClient();
    const { data, error } = await supabase
      .from('api_keys')
      .select('id, name, prefix, last_chars, created_at, last_used_at, revoked')
      .eq('user_id', auth.user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[API KEYS] Fetch error:', error);
      return NextResponse.json({ keys: [] }, { status: 200 });
    }

    return NextResponse.json({ keys: data || [] });
  } catch (e: any) {
    console.error('[API KEYS] Error:', e);
    return NextResponse.json({ keys: [] }, { status: 200 });
  }
}

// DELETE /api/keys — Revoga chave
export async function DELETE(request: Request) {
  try {
    const auth = await getAuthUser(request);
    if (!auth) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });

    const { keyId } = await request.json();
    if (!keyId) return NextResponse.json({ error: 'ID da chave é obrigatório.' }, { status: 400 });

    const supabase = createAdminSupabaseClient();
    const { error: updateError } = await supabase
      .from('api_keys')
      .update({ revoked: true, revoked_at: new Date().toISOString() })
      .eq('id', keyId)
      .eq('user_id', auth.user.id);

    if (updateError) {
      console.error('[API KEYS] Revoke error:', updateError);
      return NextResponse.json({ error: 'Erro ao revogar chave.' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error('[API KEYS] Error:', e);
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
  }
}
