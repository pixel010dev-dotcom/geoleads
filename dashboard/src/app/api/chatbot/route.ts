import { NextResponse } from 'next/server';
import pino from 'pino';
import QRCode from 'qrcode';
import { getAuthUser, requireFeature, createAdminSupabaseClient } from '@/lib/server-auth';
import { makeSupabaseAuthState } from '@/lib/baileys-auth-supabase';

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
  status: 'idle' | 'connecting' | 'qr' | 'connected' | 'disconnected' | 'error' | 'pairing';
  qr?: string;
  qrDataUrl?: string;
  pairingCode?: string;
  lastError?: string;
  lastDisconnectCode?: string;
  lastIgnoredReason?: string;
  connectedAt?: string;
  lastMessageAt?: string;
  lastIncomingAt?: string;
  lastIncomingText?: string;
  lastIncomingJid?: string;
  lastReplyAt?: string;
  lastReplyText?: string;
  lastEventType?: string;
  repliedCount: number;
  reconnectAttempts: number;
  startedAtMs?: number;
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
  pairingCode: session?.pairingCode || '',
  lastError: session?.lastError || '',
  lastDisconnectCode: session?.lastDisconnectCode || '',
  connectedAt: session?.connectedAt || '',
  lastMessageAt: session?.lastMessageAt || '',
  lastIncomingAt: session?.lastIncomingAt || '',
  lastIncomingText: session?.lastIncomingText || '',
  lastIncomingJid: session?.lastIncomingJid || '',
  lastReplyAt: session?.lastReplyAt || '',
  lastReplyText: session?.lastReplyText || '',
  lastEventType: session?.lastEventType || '',
  lastIgnoredReason: session?.lastIgnoredReason || '',
  repliedCount: session?.repliedCount || 0,
  enabled: session?.config.enabled ?? false,
  rulesCount: session?.config.rules.filter(rule => rule.enabled && rule.keyword.trim().length > 0).length || 0
});

const unwrapMessageContent = (content: any): any => {
  if (!content) return null;

  const wrapped =
    content.ephemeralMessage?.message ||
    content.viewOnceMessage?.message ||
    content.viewOnceMessageV2?.message ||
    content.documentWithCaptionMessage?.message;

  return wrapped ? unwrapMessageContent(wrapped) : content;
};

const getTextFromMessage = (message: any) => {
  const content = unwrapMessageContent(message?.message);
  if (!content) return '';

  return (
    content.conversation ||
    content.extendedTextMessage?.text ||
    content.imageMessage?.caption ||
    content.videoMessage?.caption ||
    content.documentMessage?.caption ||
    content.buttonsResponseMessage?.selectedDisplayText ||
    content.buttonsResponseMessage?.selectedButtonId ||
    content.listResponseMessage?.title ||
    content.listResponseMessage?.description ||
    content.listResponseMessage?.singleSelectReply?.selectedRowId ||
    content.templateButtonReplyMessage?.selectedDisplayText ||
    content.templateButtonReplyMessage?.selectedId ||
    ''
  ).trim();
};

const normalizeText = (value: string) => (
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .toLowerCase()
);

const getWords = (value: string) => normalizeText(value).split(/\s+/).filter(Boolean);

const getDistance = (left: string, right: string) => {
  if (left === right) return 0;
  if (!left.length) return right.length;
  if (!right.length) return left.length;

  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  const current = Array(right.length + 1).fill(0);

  for (let i = 1; i <= left.length; i += 1) {
    current[0] = i;
    for (let j = 1; j <= right.length; j += 1) {
      const substitutionCost = left[i - 1] === right[j - 1] ? 0 : 1;
      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + substitutionCost
      );
    }

    for (let j = 0; j <= right.length; j += 1) {
      previous[j] = current[j];
    }
  }

  return previous[right.length];
};

const isCloseWord = (word: string, keyword: string) => {
  if (keyword.length <= 3) return word === keyword;

  const maxDistance = keyword.length <= 5 ? 1 : 2;
  return Math.abs(word.length - keyword.length) <= maxDistance && getDistance(word, keyword) <= maxDistance;
};

const keywordMatchesText = (text: string, keyword: string) => {
  const normalizedText = normalizeText(text);
  const normalizedKeyword = normalizeText(keyword.trim());

  if (!normalizedKeyword) return false;
  if (normalizedText.includes(normalizedKeyword)) return true;

  const textWords = getWords(text);
  const keywordWords = getWords(keyword);
  if (keywordWords.length === 0) return false;

  return keywordWords.every(keywordWord => textWords.some(textWord => isCloseWord(textWord, keywordWord)));
};

const getMessageTimestampMs = (message: any) => {
  const timestamp = message?.messageTimestamp;
  let seconds = 0;

  if (typeof timestamp === 'number') seconds = timestamp;
  if (typeof timestamp === 'string') seconds = Number(timestamp);
  if (typeof timestamp === 'bigint') seconds = Number(timestamp);
  if (timestamp && typeof timestamp.toNumber === 'function') seconds = timestamp.toNumber();
  if (!seconds && timestamp?.low) seconds = Number(timestamp.low);

  return Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : 0;
};

const renderResponse = (template: string, vars: Record<string, string>) => {
  return template
    .replace(/{Nome}/g, vars.nome || 'tudo bem')
    .replace(/{Mensagem}/g, vars.mensagem || '')
    .replace(/{Empresa}/g, vars.empresa || 'nossa equipe');
};

const pickResponse = (text: string, config: ChatbotConfig) => {
  const matched = config.rules.find(rule => {
    return rule.enabled && keywordMatchesText(text, rule.keyword);
  });

  return matched?.response || config.fallbackMessage;
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
  const { Browsers, DisconnectReason } = baileys;

  session.status = 'connecting';
  session.startedAtMs = Date.now();
  session.lastError = '';
  session.lastDisconnectCode = '';
  session.lastIgnoredReason = '';

  try {
    session.socket?.end?.();
  } catch {}

  const { state, saveCreds } = await makeSupabaseAuthState(session.userId);

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
      const rawCode = lastDisconnect?.error?.output?.statusCode;
      const statusCode = rawCode !== undefined && rawCode !== null ? Number(rawCode) : undefined;
      session.lastDisconnectCode = statusCode !== undefined ? String(statusCode) : 'unknown';

      const isLoggedOut = statusCode === DisconnectReason.loggedOut;
      const isBadSession = statusCode === DisconnectReason.badSession;
      const isRestartRequired = statusCode === DisconnectReason.restartRequired;

      if (isLoggedOut) {
        session.status = 'disconnected';
        session.lastError = 'Sessão encerrada. Conecte novamente.';
        session.qr = '';
        session.qrDataUrl = '';
        session.reconnectAttempts = 0;
        return;
      }

      if (isBadSession) {
        session.status = 'error';
        session.lastError = 'Sessão inválida (badSession). Remova o dispositivo no WhatsApp e tente novamente.';
        session.qr = '';
        session.qrDataUrl = '';
        session.reconnectAttempts = 0;
        return;
      }

      const maxRetries = isRestartRequired ? 10 : 8;
      const retryDelay = isRestartRequired ? 4000 : 2000;

      if (session.reconnectAttempts < maxRetries) {
        session.reconnectAttempts += 1;
        session.status = 'connecting';
        session.lastError = `Reconectando WhatsApp (${session.reconnectAttempts}/${maxRetries}). Código: ${session.lastDisconnectCode}`;

        setTimeout(() => {
          startBotSession(session).catch((error) => {
            session.status = 'error';
            session.lastError = `Falha ao reconectar: ${error?.message || 'erro desconhecido'}`;
          });
        }, retryDelay);
        return;
      }

      session.status = 'error';
      session.lastError = `Conexão caiu após várias tentativas. Código: ${session.lastDisconnectCode}`;
    }
  });

  socket.ev.on('messages.upsert', async (event: any) => {
    session.lastEventType = event.type || 'unknown';

    if (!session.config.enabled) {
      session.lastIgnoredReason = 'Bot desativado nas configurações.';
      return;
    }

    for (const message of event.messages || []) {
      const jid = message.key?.remoteJid;
      const text = getTextFromMessage(message);

      session.lastIncomingAt = new Date().toISOString();
      session.lastIncomingJid = jid || '';
      session.lastIncomingText = text || '';

      try {
        if (!jid) {
          session.lastIgnoredReason = 'Mensagem sem identificador de conversa.';
          continue;
        }

        if (message.key?.fromMe) {
          session.lastIgnoredReason = 'Mensagem enviada pelo próprio número conectado.';
          continue;
        }

        if (jid.endsWith('@g.us') || jid === 'status@broadcast' || jid.endsWith('@broadcast') || jid.endsWith('@newsletter')) {
          session.lastIgnoredReason = 'Grupo, status ou broadcast ignorado.';
          continue;
        }

        const messageTimestampMs = getMessageTimestampMs(message);
        if (messageTimestampMs && session.startedAtMs && messageTimestampMs < session.startedAtMs - 120_000) {
          session.lastIgnoredReason = 'Mensagem antiga ignorada após reconexão.';
          continue;
        }

        if (!text) {
          session.lastIgnoredReason = 'Mensagem sem texto legível.';
          continue;
        }

        const senderName = message.pushName || 'tudo bem';
        const lowerText = normalizeText(text);

        if (lowerText.includes('sair') || lowerText.includes('parar') || lowerText.includes('cancelar')) {
          const optOutText = 'Combinado. Nao vou enviar novas respostas automaticas por aqui.';
          session.optOut.add(jid);
          await socket.sendMessage(jid, { text: optOutText });
          session.lastReplyAt = new Date().toISOString();
          session.lastReplyText = optOutText;
          session.lastMessageAt = session.lastReplyAt;
          session.lastIgnoredReason = 'Contato pediu para parar respostas automáticas.';
          continue;
        }

        if (session.optOut.has(jid)) {
          session.lastIgnoredReason = 'Contato está na lista de opt-out.';
          continue;
        }

        const now = Date.now();
        const lastReplyAt = session.replyThrottle.get(jid) || 0;
        if (now - lastReplyAt < 30_000) {
          session.lastIgnoredReason = 'Contato em intervalo de segurança de 30 segundos.';
          continue;
        }

        const response = pickResponse(text, session.config);
        if (!response) {
          session.lastIgnoredReason = 'Nenhuma resposta configurada para essa mensagem.';
          continue;
        }

        const replyText = renderResponse(response, {
          nome: senderName,
          mensagem: text,
          empresa: session.config.businessName
        });

        await socket.sendMessage(jid, { text: replyText });

        session.replyThrottle.set(jid, now);
        session.lastReplyAt = new Date().toISOString();
        session.lastReplyText = replyText;
        session.lastMessageAt = session.lastReplyAt;
        session.lastIgnoredReason = '';
        session.repliedCount += 1;
      } catch (error: any) {
        session.lastError = `Falha ao responder mensagem: ${error?.message || 'erro desconhecido'}`;
        session.lastIgnoredReason = 'Erro ao enviar resposta automática.';
      }
    }
  });

  return session;
};

export async function GET(request: Request) {
  const auth = await getAuthUser(request);
  if (!auth) {
    return NextResponse.json({ error: 'Nao autenticado.' }, { status: 401 });
  }

  const session = getSessionStore().get(auth.user.id);
  return NextResponse.json({ success: true, session: getPublicSession(session) });
}

export async function POST(request: Request) {
  const auth = await getAuthUser(request);
  if (!auth) {
    return NextResponse.json({ error: 'Nao autenticado.' }, { status: 401 });
  }

  if (!requireFeature(auth.planId, 'chatbot')) {
    return NextResponse.json({ error: 'Chatbot WhatsApp exige plano Max ou superior.' }, { status: 403 });
  }

  const body = await request.json();
  const action = body.action;
  const config = body.config as Partial<ChatbotConfig> | undefined;
  const session = getOrCreateSession(auth.user.id, config);

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

  if (action === 'pair') {
    const phoneNumber = String(body.phoneNumber || '').replace(/\D/g, '');
    if (phoneNumber.length < 10 || phoneNumber.length > 15) {
      return NextResponse.json({ error: 'Número inválido. Use código do país + DDD + número (ex: 5511999999999).' }, { status: 400 });
    }
    try {
      session.socket?.end?.();
    } catch {}
    session.pairingCode = '';
    session.qrDataUrl = '';
    session.qr = '';
    session.status = 'pairing';
    session.startedAtMs = Date.now();

    const baileys = await import('@whiskeysockets/baileys');
    const makeWASocket = baileys.default;
    const { Browsers, DisconnectReason } = baileys;
    const { state, saveCreds } = await makeSupabaseAuthState(session.userId);

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
      const { connection, lastDisconnect } = update;

      if (connection === 'open') {
        session.status = 'connected';
        session.pairingCode = '';
        session.connectedAt = new Date().toISOString();
        session.lastError = '';
        session.lastDisconnectCode = '';
        session.reconnectAttempts = 0;
      }

      if (connection === 'close') {
        const rawCode = lastDisconnect?.error?.output?.statusCode;
        const statusCode = rawCode !== undefined && rawCode !== null ? Number(rawCode) : undefined;
        session.lastDisconnectCode = statusCode !== undefined ? String(statusCode) : 'unknown';

        const isLoggedOut = statusCode === DisconnectReason.loggedOut;
        const isBadSession = statusCode === DisconnectReason.badSession;
        const isRestartRequired = statusCode === DisconnectReason.restartRequired;

        if (isLoggedOut) {
          session.status = 'disconnected';
          session.lastError = 'Sessão encerrada. Conecte novamente.';
          session.reconnectAttempts = 0;
          return;
        }

        if (isBadSession) {
          session.status = 'disconnected';
          session.lastError = 'Sessão inválida. Remova o dispositivo no WhatsApp e tente novamente.';
          session.reconnectAttempts = 0;
          return;
        }

        const maxRetries = isRestartRequired ? 10 : 8;
        const retryDelay = isRestartRequired ? 4000 : 2000;

        if (session.reconnectAttempts < maxRetries) {
          session.reconnectAttempts += 1;
          session.status = 'connecting';
          session.lastError = `Reconectando WhatsApp (${session.reconnectAttempts}/${maxRetries}). Código: ${session.lastDisconnectCode}`;

          setTimeout(async () => {
            try {
              await startBotSession(session);
            } catch {}
          }, retryDelay);
        } else {
          session.status = 'disconnected';
          session.lastError = `Conexão caiu após várias tentativas. Código: ${session.lastDisconnectCode}`;
        }
      }
    });

    // Request pairing code
    const code = await socket.requestPairingCode(phoneNumber);
    session.pairingCode = code;

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

  if (action === 'reset_session') {
    try {
      session.socket?.end?.();
    } catch {}
    session.socket = undefined;

    const supabase = createAdminSupabaseClient();
    await supabase.from('whatsapp_sessions').delete().eq('user_id', auth.user.id);

    session.status = 'idle';
    session.qr = '';
    session.qrDataUrl = '';
    session.pairingCode = '';
    session.lastError = '';
    session.lastDisconnectCode = '';
    session.reconnectAttempts = 0;
    session.connectedAt = '';

    return NextResponse.json({ success: true, session: getPublicSession(session) });
  }

  return NextResponse.json({ error: 'Ação inválida.' }, { status: 400 });
}
