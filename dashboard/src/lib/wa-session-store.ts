// Multi-session store: Map<userId, Map<sessionId, BotSession>>

export type BotSession = {
  sessionId: string;
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
  config: any;
  replyThrottle: Map<string, number>;
  optOut: Set<string>;
  rateLimitPerMinute: number;
  rateLimitPerHour: number;
  rateLimitPerDay: number;
  minDelay: number;
  maxDelay: number;
  proxyUrl?: string;
  label: string;
  phoneNumber?: string;
  bannedAt?: string;
  createdAt: string;
};

const KEY = '__geoleadsChatbotSessionsV2';

function getStore(): Map<string, Map<string, BotSession>> {
  const g = globalThis as any;
  if (!g[KEY]) g[KEY] = new Map();
  return g[KEY];
}

export function getAllUserSessions(userId: string): BotSession[] {
  return Array.from((getStore().get(userId) || new Map()).values());
}

export function getSession(userId: string, sessionId?: string): BotSession | undefined {
  const userSessions = getStore().get(userId);
  if (!userSessions) return undefined;
  if (sessionId) return userSessions.get(sessionId);
  return userSessions.values().next().value;
}

export function createSessionInStore(userId: string, sessionId: string, label?: string, opts?: {
  rateLimitPerMinute?: number; rateLimitPerHour?: number; rateLimitPerDay?: number;
  minDelay?: number; maxDelay?: number; proxyUrl?: string; phoneNumber?: string;
}): BotSession {
  const store = getStore();
  if (!store.has(userId)) store.set(userId, new Map());
  const userSessions = store.get(userId)!;

  let session = userSessions.get(sessionId);
  if (session) return session;

  session = {
    sessionId, userId,
    label: label || 'Principal',
    status: 'idle',
    repliedCount: 0, reconnectAttempts: 0,
    config: {},
    replyThrottle: new Map(),
    optOut: new Set(),
    rateLimitPerMinute: opts?.rateLimitPerMinute ?? 10,
    rateLimitPerHour: opts?.rateLimitPerHour ?? 200,
    rateLimitPerDay: opts?.rateLimitPerDay ?? 500,
    minDelay: opts?.minDelay ?? 20,
    maxDelay: opts?.maxDelay ?? 60,
    proxyUrl: opts?.proxyUrl,
    phoneNumber: opts?.phoneNumber,
    createdAt: new Date().toISOString(),
  } as BotSession;

  userSessions.set(sessionId, session);
  return session;
}

export function removeSessionFromStore(userId: string, sessionId: string): boolean {
  const userSessions = getStore().get(userId);
  if (!userSessions) return false;
  const session = userSessions.get(sessionId);
  if (session?.socket) { try { session.socket.end?.(); } catch {} }
  return userSessions.delete(sessionId);
}

export function getPublicSession(session?: BotSession) {
  if (!session) return null;
  return {
    sessionId: session.sessionId,
    label: session.label,
    status: session.status,
    qrDataUrl: session.qrDataUrl || '',
    pairingCode: session.pairingCode || '',
    lastError: session.lastError || '',
    lastDisconnectCode: session.lastDisconnectCode || '',
    connectedAt: session.connectedAt || '',
    lastMessageAt: session.lastMessageAt || '',
    lastIncomingAt: session.lastIncomingAt || '',
    lastIncomingText: session.lastIncomingText || '',
    lastIncomingJid: session.lastIncomingJid || '',
    lastReplyAt: session.lastReplyAt || '',
    lastReplyText: session.lastReplyText || '',
    lastEventType: session.lastEventType || '',
    lastIgnoredReason: session.lastIgnoredReason || '',
    repliedCount: session.repliedCount || 0,
    enabled: session.config?.enabled ?? false,
    useAI: session.config?.useAI ?? true,
    aiInstructions: session.config?.aiInstructions || '',
    rulesCount: session.config?.rules?.filter((r: any) => r.enabled && r.keyword?.trim()).length || 0,
    rateLimitPerMinute: session.rateLimitPerMinute,
    rateLimitPerHour: session.rateLimitPerHour,
    rateLimitPerDay: session.rateLimitPerDay,
    minDelay: session.minDelay,
    maxDelay: session.maxDelay,
    proxyUrl: session.proxyUrl || '',
    phoneNumber: session.phoneNumber || '',
    bannedAt: session.bannedAt || '',
    createdAt: session.createdAt,
  };
}
