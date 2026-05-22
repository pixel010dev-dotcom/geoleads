import { NextResponse } from 'next/server';
import { getAuthUser, requireFeature } from '@/lib/server-auth';
import { createAdminSupabaseClient } from '@/lib/server-auth';

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

  const { leadId, leadName, leadPhone, message } = await request.json();

  if (!leadPhone || !message) {
    return NextResponse.json({ error: 'leadPhone e message sao obrigatorios.' }, { status: 400 });
  }

  const supabase = createAdminSupabaseClient();
  const sessionStore = (globalThis as any).__geoleadsChatbotSessions as Map<string, any>;
  const botSession = sessionStore?.get(auth.user.id);

  if (!botSession || botSession.status !== 'connected' || !botSession.socket) {
    return NextResponse.json({ error: 'WhatsApp nao conectado. Conecte pelo chatbot primeiro.' }, { status: 400 });
  }

  const jid = `${leadPhone.replace(/\D/g, '')}@s.whatsapp.net`;

  try {
    await botSession.socket.sendMessage(jid, { text: message });

    const { error: insertError } = await supabase.from('whatsapp_messages').insert({
      user_id: auth.user.id,
      lead_id: leadId || null,
      lead_name: leadName || leadPhone,
      lead_phone: leadPhone,
      message,
      status: 'sent',
      sent_at: new Date().toISOString()
    });

    if (insertError) {
      console.error('Failed to save message record:', insertError);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    await supabase.from('whatsapp_messages').insert({
      user_id: auth.user.id,
      lead_id: leadId || null,
      lead_name: leadName || leadPhone,
      lead_phone: leadPhone,
      message,
      status: 'failed',
      error_message: error?.message || 'Erro desconhecido ao enviar'
    });

    return NextResponse.json({ error: `Falha ao enviar: ${error?.message || 'erro desconhecido'}` }, { status: 500 });
  }
}
