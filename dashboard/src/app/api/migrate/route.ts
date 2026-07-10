// POST /api/migrate — One-shot migration to create missing tables
import { NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/server-auth';

export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization') || '';
  const secret = authHeader.replace(/^Bearer\s+/i, '').trim();

  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminSupabaseClient();

  const results: string[] = [];

  // Create api_keys table
  const { error: createErr } = await supabase.from('api_keys').insert({
    user_id: '00000000-0000-0000-0000-000000000000',
    name: '_migration_test',
    key: '_migration_' + Date.now(),
    prefix: '_migration',
    last_chars: 'test',
  }).select().single();

  if (createErr && createErr.message.includes('does not exist')) {
    // Table doesn't exist, try creating via raw SQL through the REST API
    // Use the service role key to create the table via the /rest/v1/ endpoint
    const sql = `
      CREATE TABLE IF NOT EXISTS public.api_keys (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        key TEXT NOT NULL UNIQUE,
        prefix TEXT NOT NULL,
        last_chars TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        last_used_at TIMESTAMPTZ,
        revoked BOOLEAN DEFAULT FALSE,
        revoked_at TIMESTAMPTZ
      );
      CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON public.api_keys(user_id);
      CREATE INDEX IF NOT EXISTS idx_api_keys_key ON public.api_keys(key);
      ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
    `;

    try {
      const response = await fetch('https://api.supabase.com/v1/projects/mwnpwrzwgwrqqlomqhux/database/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({ query: sql }),
      });
      const data = await response.json();
      results.push(`Management API: ${response.status} ${JSON.stringify(data).slice(0, 200)}`);
    } catch (e: any) {
      results.push(`Management API error: ${e.message}`);
    }
  } else if (createErr) {
    results.push(`Table exists but insert error: ${createErr.message}`);
    // Clean up test record
    await supabase.from('api_keys').delete().eq('name', '_migration_test');
  } else {
    results.push('Table already exists and writable');
    // Clean up test record
    await supabase.from('api_keys').delete().eq('name', '_migration_test');
  }

  return NextResponse.json({ results });
}
