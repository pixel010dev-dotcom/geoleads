import { NextResponse } from 'next/server';
import { getAuthUser, requireFeature, createAdminSupabaseClient } from '@/lib/server-auth';
import { createSessionInStore, getSession, getAllUserSessions, removeSessionFromStore, getPublicSession } from '@/lib/wa-session-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getOldSessionStore(): Map<string, any> | null {
  const g = globalThis as any;
  return g['__geoleadsChatbotSessions'] || null;
}

export async function GET(request: Request) {
  const auth = await getAuthUser(request);
  if (!auth) return NextResponse.json({ error: 'Nao autenticado.' }, { status: 401 });

  const sessions = getAllUserSessions(auth.user.id);
  const supabase = createAdminSupabaseClient();
  const { data: dbSessions } = await supabase
    .from('whatsapp_sessions')
    .select('*')
    .eq('user_id', auth.user.id);

  const oldStore = getOldSessionStore();
  const oldSession = oldStore?.get(auth.user.id);

  const merged = (dbSessions || []).map(row => {
    const mem = sessions.find(s => s.sessionId === row.session_id);
    let publicSession = getPublicSession(mem || undefined) || {};

    if (!mem && oldSession && (row.session_id === oldSession.sessionId)) {
      publicSession = {
        ...publicSession,
        status: oldSession.status || 'idle',
        qrDataUrl: oldSession.qrDataUrl || '',
        lastError: oldSession.lastError || '',
        connectedAt: oldSession.connectedAt || '',
        lastIncomingAt: oldSession.lastIncomingAt || '',
        lastIncomingText: oldSession.lastIncomingText || '',
        repliedCount: oldSession.repliedCount || 0,
      };
    }

    return {
      ...publicSession,
      sessionId: row.session_id,
      label: mem?.label || row.session_label || 'Principal',
      rateLimitPerMinute: row.rate_limit_per_minute ?? 10,
      rateLimitPerHour: row.rate_limit_per_hour ?? 200,
      rateLimitPerDay: row.rate_limit_per_day ?? 500,
      minDelay: row.min_delay_seconds ?? 20,
      maxDelay: row.max_delay_seconds ?? 60,
      proxyUrl: row.proxy_url || '',
      phoneNumber: row.phone_number || '',
      active: row.active ?? true,
      hasCredentials: !!(row.creds),
      createdAt: row.created_at,
    };
  });

  return NextResponse.json({ success: true, sessions: merged });
}

export async function POST(request: Request) {
  const auth = await getAuthUser(request);
  if (!auth) return NextResponse.json({ error: 'Nao autenticado.' }, { status: 401 });
  if (!requireFeature(auth.planId, 'chatbot')) {
    return NextResponse.json({ error: 'Chatbot WhatsApp exige plano Max ou superior.' }, { status: 403 });
  }

  const body = await request.json();
  const action = body.action;

  if (action === 'create') {
    const label = body.label || `Número ${Date.now() % 1000}`;
    const phoneNumber = body.phoneNumber || '';

    const supabase = createAdminSupabaseClient();
    const sessionId = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    const { data: row, error } = await supabase.from('whatsapp_sessions').insert({
      user_id: auth.user.id,
      session_label: label,
      session_id: sessionId,
      active: true,
      phone_number: phoneNumber.replace(/\D/g, '') || null,
      rate_limit_per_minute: body.rateLimitPerMinute ?? 10,
      rate_limit_per_hour: body.rateLimitPerHour ?? 200,
      rate_limit_per_day: body.rateLimitPerDay ?? 500,
      min_delay_seconds: body.minDelay ?? 20,
      max_delay_seconds: body.maxDelay ?? 60,
      proxy_url: body.proxyUrl || null,
    }).select().single();

    if (error || !row) {
      return NextResponse.json({ error: 'Erro ao criar sessao: ' + (error?.message || '') }, { status: 500 });
    }

    createSessionInStore(auth.user.id, sessionId, label, {
      rateLimitPerMinute: row.rate_limit_per_minute,
      rateLimitPerHour: row.rate_limit_per_hour,
      rateLimitPerDay: row.rate_limit_per_day,
      minDelay: row.min_delay_seconds,
      maxDelay: row.max_delay_seconds,
      proxyUrl: row.proxy_url || undefined,
      phoneNumber: row.phone_number || undefined,
    });

    return NextResponse.json({ success: true, sessionId, label });
  }

  if (action === 'delete') {
    const { sessionId } = body;
    if (!sessionId) return NextResponse.json({ error: 'sessionId obrigatorio.' }, { status: 400 });

    const supabase = createAdminSupabaseClient();
    await supabase.from('whatsapp_sessions').delete().eq('session_id', sessionId).eq('user_id', auth.user.id);
    removeSessionFromStore(auth.user.id, sessionId);

    return NextResponse.json({ success: true });
  }

  if (action === 'disconnect') {
    const { sessionId } = body;
    const session = getSession(auth.user.id, sessionId);
    if (session?.socket) {
      try { session.socket.end?.(); } catch {}
    }
    if (session) {
      session.status = 'disconnected';
      session.socket = undefined;
    }

    return NextResponse.json({ success: true });
  }

  if (action === 'update-config') {
    const { sessionId, ...config } = body;
    const session = getSession(auth.user.id, sessionId);
    if (!session) return NextResponse.json({ error: 'Sessao nao encontrada.' }, { status: 404 });

    if (config.label) session.label = config.label;
    if (config.rateLimitPerMinute) session.rateLimitPerMinute = config.rateLimitPerMinute;
    if (config.rateLimitPerHour) session.rateLimitPerHour = config.rateLimitPerHour;
    if (config.rateLimitPerDay) session.rateLimitPerDay = config.rateLimitPerDay;
    if (config.minDelay) session.minDelay = config.minDelay;
    if (config.maxDelay) session.maxDelay = config.maxDelay;
    if (config.proxyUrl !== undefined) session.proxyUrl = config.proxyUrl;

    const supabase = createAdminSupabaseClient();
    await supabase.from('whatsapp_sessions').update({
      session_label: config.label,
      rate_limit_per_minute: config.rateLimitPerMinute,
      rate_limit_per_hour: config.rateLimitPerHour,
      rate_limit_per_day: config.rateLimitPerDay,
      min_delay_seconds: config.minDelay,
      max_delay_seconds: config.maxDelay,
      proxy_url: config.proxyUrl,
    }).eq('session_id', sessionId);

    return NextResponse.json({ success: true, session: getPublicSession(session) });
  }

  return NextResponse.json({ error: 'Acao invalida.' }, { status: 400 });
}
