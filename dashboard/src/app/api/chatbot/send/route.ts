import { NextResponse } from 'next/server';
import { getAuthUser, requireFeature } from '@/lib/server-auth';
import { createAdminSupabaseClient } from '@/lib/server-auth';
import { checkRateLimit, getSmartDelay } from '@/lib/wa-rate-limiter';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const auth = await getAuthUser(request);
  if (!auth) {
    return NextResponse.json({ error: 'Nao autenticado.' }, { status: 401 });
  }

  if (!requireFeature(auth.planId, 'whatsappSender')) {
    return NextResponse.json({ error: 'Disparo WhatsApp exige plano Pro ou superior.' }, { status: 403 });
  }

  const { leadId, leadName, leadPhone, message, sessionId } = await request.json() as {
    leadId?: string;
    leadName?: string;
    leadPhone: string;
    message: string;
    sessionId?: string;
  };

  if (!leadPhone || !message) {
    return NextResponse.json({ error: 'leadPhone e message sao obrigatorios.' }, { status: 400 });
  }

  if (message.length > 4096) {
    return NextResponse.json({ error: 'Mensagem muito longa (max 4096 caracteres).' }, { status: 400 });
  }

  const sanitizedPhone = leadPhone.replace(/\D/g, '');
  if (sanitizedPhone.length < 10 || sanitizedPhone.length > 15) {
    return NextResponse.json({ error: 'Telefone invalido.' }, { status: 400 });
  }

  const supabase = createAdminSupabaseClient();
  const sessionStore = (globalThis as any).__geoleadsChatbotSessions as Map<string, any>;

  let botSession: any;

  if (sessionId) {
    const sessions = sessionStore?.get(auth.user.id);
    if (sessions instanceof Map) {
      botSession = sessions.get(sessionId);
    }
  } else {
    if (sessionStore?.get(auth.user.id) instanceof Map) {
      const userSessions = sessionStore.get(auth.user.id);
      botSession = userSessions.values().next().value;
    } else {
      botSession = sessionStore?.get(auth.user.id);
    }
  }

  if (!botSession || botSession.status !== 'connected' || !botSession.socket) {
    return NextResponse.json({ error: 'WhatsApp nao conectado. Conecte pelo chatbot primeiro.' }, { status: 400 });
  }

  const sessionIdentifier = botSession.sessionId || auth.user.id;
  const limits = {
    perMinute: botSession.rateLimitPerMinute || 10,
    perHour: botSession.rateLimitPerHour || 200,
    perDay: botSession.rateLimitPerDay || 500,
  };

  const rateCheck = checkRateLimit(sessionIdentifier, limits);
  if (!rateCheck.allowed) {
    return NextResponse.json({ error: rateCheck.reason }, { status: 429 });
  }

  const jid = `${leadPhone.replace(/\D/g, '')}@s.whatsapp.net`;

  try {
    await botSession.socket.sendMessage(jid, { text: message });

    await supabase.from('whatsapp_messages').insert({
      user_id: auth.user.id,
      lead_id: leadId || null,
      lead_name: leadName || leadPhone,
      lead_phone: leadPhone,
      message,
      status: 'sent',
      sent_at: new Date().toISOString()
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    const errMsg = error?.message || 'Erro desconhecido ao enviar';
    await supabase.from('whatsapp_messages').insert({
      user_id: auth.user.id,
      lead_id: leadId || null,
      lead_name: leadName || leadPhone,
      lead_phone: leadPhone,
      message,
      status: 'failed',
      error_message: errMsg
    });

    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
