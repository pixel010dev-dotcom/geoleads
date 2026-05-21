import { NextResponse } from 'next/server';
import path from 'path';
import pino from 'pino';
import QRCode from 'qrcode';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ChatbotRule = {
  id: string;
  keyword: string;
  response: string;
  enabled: boolean;
};

type ChatbotConfig = {
  enabled: boolean;
  businessName: string;
  welcomeMessage: string;
  fallbackMessage: string;
  rules: ChatbotRule[];
};

type BotSession = {
  userId: string;
  socket?: any;
  status: 'idle' | 'connecting' | 'qr' | 'connected' | 'disconnected' | 'error';
  qr?: string;
  qrDataUrl?: string;
  lastError?: string;
  lastDisconnectCode?: string;
  connectedAt?: string;
  lastMessageAt?: string;
  repliedCount: number;
  reconnectAttempts: number;
  config: ChatbotConfig;
  replyThrottle: Map<string, number>;
  optOut: Set<string>;
};

const DEFAULT_CONFIG: ChatbotConfig = {
  enabled: true,
  businessName: 'GeoLeads',
  welcomeMessage: 'Olá! Sou o assistente automático. Me diga como posso ajudar.',
  fallbackMessage: 'Recebi sua mensagem. Um atendente vai continuar por aqui em breve.',
  rules: []
};

const getSessionStore = () => {
  const globalKey = '__geoleadsChatbotSessions';
  const globalScope = globalThis as unknown as Record<string, Map<string, BotSession>>;

  if (!globalScope[globalKey]) {
    globalScope[globalKey] = new Map<string, BotSession>();
  }

  return globalScope[globalKey];
};

const getPublicSession = (session?: BotSession) => ({
  status: session?.status || 'idle',
  qrDataUrl: session?.qrDataUrl || '',
  lastError: session?.lastError || '',
  lastDisconnectCode: session?.lastDisconnectCode || '',
  connectedAt: session?.connectedAt || '',
  lastMessageAt: session?.lastMessageAt || '',
  repliedCount: session?.repliedCount || 0
});

const getTextFromMessage = (message: any) => {
  const content = message?.message;
  if (!content) return '';

  return (
    content.conversation ||
    content.extendedTextMessage?.text ||
    content.imageMessage?.caption ||
    content.videoMessage?.caption ||
    content.documentMessage?.caption ||
    ''
  ).trim();
};

const renderResponse = (template: string, vars: Record<string, string>) => {
  return template
    .replace(/{Nome}/g, vars.nome || 'tudo bem')
    .replace(/{Mensagem}/g, vars.mensagem || '')
    .replace(/{Empresa}/g, vars.empresa || 'nossa equipe');
};

const pickResponse = (text: string, config: ChatbotConfig) => {
  const normalized = text.toLowerCase();
  const matched = config.rules.find(rule => {
    const keyword = rule.keyword.trim().toLowerCase();
    return rule.enabled && keyword.length > 0 && normalized.includes(keyword);
  });

  return matched?.response || config.fallbackMessage;
};

const getAuthUser = async (request: Request) => {
  const authHeader = request.headers.get('authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();

  if (!token) return null;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  );
  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) return null;
  return data.user;
};

const getOrCreateSession = (userId: string, config?: Partial<ChatbotConfig>) => {
  const store = getSessionStore();
  const existing = store.get(userId);

  if (existing) {
    existing.config = { ...existing.config, ...config, rules: config?.rules || existing.config.rules };
    return existing;
  }

  const session: BotSession = {
    userId,
    status: 'idle',
    repliedCount: 0,
    reconnectAttempts: 0,
    config: { ...DEFAULT_CONFIG, ...config, rules: config?.rules || DEFAULT_CONFIG.rules },
    replyThrottle: new Map(),
    optOut: new Set()
  };

  store.set(userId, session);
  return session;
};

const startBotSession = async (session: BotSession) => {
  const baileys = await import('@whiskeysockets/baileys');
  const makeWASocket = baileys.default;
  const { Browsers, DisconnectReason, useMultiFileAuthState } = baileys;

  session.status = 'connecting';
  session.lastError = '';
  session.lastDisconnectCode = '';

  try {
    session.socket?.end?.();
  } catch {}

  const safeUserId = session.userId.replace(/[^a-zA-Z0-9_-]/g, '');
  const authDir = path.join(process.cwd(), '.geoleads-wa-auth', safeUserId);
  const { state, saveCreds } = await useMultiFileAuthState(authDir);

  const socket = makeWASocket({
    auth: state,
    browser: Browsers.ubuntu('GeoLeads Chatbot'),
    logger: pino({ level: 'silent' }),
    markOnlineOnConnect: false,
    printQRInTerminal: false,
    syncFullHistory: false
  });

  session.socket = socket;

  socket.ev.on('creds.update', saveCreds);

  socket.ev.on('connection.update', async (update: any) => {
    const { connection, qr, lastDisconnect } = update;

    if (qr) {
      session.qr = qr;
      session.qrDataUrl = await QRCode.toDataURL(qr, { width: 320, margin: 1 });
      session.status = 'qr';
    }

    if (connection === 'open') {
      session.status = 'connected';
      session.qr = '';
      session.qrDataUrl = '';
      session.connectedAt = new Date().toISOString();
      session.lastError = '';
      session.lastDisconnectCode = '';
      session.reconnectAttempts = 0;
    }

    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      session.lastDisconnectCode = statusCode ? String(statusCode) : 'unknown';
      const loggedOut = statusCode === DisconnectReason.loggedOut;

      if (loggedOut) {
        session.status = 'disconnected';
        session.lastError = 'Sessão encerrada. Conecte novamente.';
        session.qr = '';
        session.qrDataUrl = '';
        session.reconnectAttempts = 0;
        return;
      }

      if (session.reconnectAttempts < 5) {
        session.reconnectAttempts += 1;
        session.status = 'connecting';
        session.lastError = `Reconectando WhatsApp (${session.reconnectAttempts}/5). Código: ${session.lastDisconnectCode}`;

        setTimeout(() => {
          startBotSession(session).catch((error) => {
            session.status = 'error';
            session.lastError = `Falha ao reconectar: ${error?.message || 'erro desconhecido'}`;
          });
        }, 1500);
        return;
      }

      session.status = 'error';
      session.lastError = `Conexão caiu após várias tentativas. Código: ${session.lastDisconnectCode}`;
    }
  });

  socket.ev.on('messages.upsert', async (event: any) => {
    if (!session.config.enabled || event.type !== 'notify') return;

    for (const message of event.messages || []) {
      const jid = message.key?.remoteJid;
      if (!jid || message.key?.fromMe) continue;
      if (!jid.endsWith('@s.whatsapp.net')) continue;

      const text = getTextFromMessage(message);
      if (!text) continue;

      const senderName = message.pushName || 'tudo bem';
      const lowerText = text.toLowerCase();

      if (lowerText.includes('sair') || lowerText.includes('parar') || lowerText.includes('cancelar')) {
        session.optOut.add(jid);
        await socket.sendMessage(jid, { text: 'Combinado. Não vou enviar novas respostas automáticas por aqui.' });
        continue;
      }

      if (session.optOut.has(jid)) continue;

      const now = Date.now();
      const lastReplyAt = session.replyThrottle.get(jid) || 0;
      if (now - lastReplyAt < 30_000) continue;

      const response = pickResponse(text, session.config);
      if (!response) continue;

      await socket.sendMessage(jid, {
        text: renderResponse(response, {
          nome: senderName,
          mensagem: text,
          empresa: session.config.businessName
        })
      });

      session.replyThrottle.set(jid, now);
      session.lastMessageAt = new Date().toISOString();
      session.repliedCount += 1;
    }
  });

  return session;
};

export async function GET(request: Request) {
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  }

  const session = getSessionStore().get(user.id);
  return NextResponse.json({ success: true, session: getPublicSession(session) });
}

export async function POST(request: Request) {
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  }

  const body = await request.json();
  const action = body.action;
  const config = body.config as Partial<ChatbotConfig> | undefined;
  const session = getOrCreateSession(user.id, config);

  if (action === 'connect') {
    if (session.status === 'connected' || session.status === 'qr' || session.status === 'connecting') {
      return NextResponse.json({ success: true, session: getPublicSession(session) });
    }

    await startBotSession(session);
    return NextResponse.json({ success: true, session: getPublicSession(session) });
  }

  if (action === 'update-config') {
    session.config = { ...session.config, ...config, rules: config?.rules || session.config.rules };
    return NextResponse.json({ success: true, session: getPublicSession(session) });
  }

  if (action === 'disconnect') {
    try {
      await session.socket?.logout?.();
    } catch {}

    try {
      session.socket?.end?.();
    } catch {}

    session.socket = undefined;
    session.status = 'disconnected';
    session.qr = '';
    session.qrDataUrl = '';
    return NextResponse.json({ success: true, session: getPublicSession(session) });
  }

  return NextResponse.json({ error: 'Ação inválida.' }, { status: 400 });
}
