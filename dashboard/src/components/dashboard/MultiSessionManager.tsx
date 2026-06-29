'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslations } from '@/lib/i18n';
import { Button } from '@/components/Button';

type SessionData = {
  sessionId: string;
  label: string;
  status: string;
  qrDataUrl: string;
  pairingCode: string;
  lastError: string;
  phoneNumber: string;
  connectedAt: string;
  hasCredentials: boolean;
  repliedCount: number;
  rateLimitPerMinute: number;
  rateLimitPerHour: number;
  rateLimitPerDay: number;
  minDelay: number;
  maxDelay: number;
  proxyUrl: string;
  active: boolean;
  createdAt: string;
};

type Props = {
  user: { id: string; email?: string } | null;
  selectedSessionId?: string;
  onSelectSession: (sessionId: string) => void;
  onSessionUpdate: () => void;
};

export function MultiSessionManager({ user, selectedSessionId, onSelectSession, onSessionUpdate }: Props) {
  const { t } = useTranslations();
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addLabel, setAddLabel] = useState('');
  const [addPhone, setAddPhone] = useState('');
  const [addLoading, setAddLoading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [editingConfig, setEditingConfig] = useState<string | null>(null);
  const [configForm, setConfigForm] = useState<Record<string, any>>({});
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadSessions = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch('/api/chatbot/sessions', { cache: 'no-store' });
      const data = await res.json();
      if (data.success) {
        setSessions(data.sessions);
      }
    } catch (e) {
      console.error('[MultiSession] Erro ao carregar sessoes:', e);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  useEffect(() => {
    if (!user) return;
    pollingRef.current = setInterval(loadSessions, 8000);
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [user, loadSessions]);

  const handleCreate = async () => {
    if (!user || !addLabel.trim()) return;
    setAddLoading(true);
    try {
      const { data: { session } } = await (await import('@/lib/supabase')).supabase.auth.getSession();
      if (!session?.access_token) return;
      const res = await fetch('/api/chatbot/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          action: 'create',
          label: addLabel.trim(),
          phoneNumber: addPhone.replace(/\D/g, ''),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setShowAddForm(false);
        setAddLabel('');
        setAddPhone('');
        onSessionUpdate();
        await loadSessions();
      }
    } catch (e) {
      console.error('[MultiSession] Erro ao criar sessao:', e);
    } finally {
      setAddLoading(false);
    }
  };

  const handleDelete = async (sessionId: string) => {
    if (!user) return;
    try {
      const { data: { session } } = await (await import('@/lib/supabase')).supabase.auth.getSession();
      if (!session?.access_token) return;
      await fetch('/api/chatbot/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ action: 'delete', sessionId }),
      });
      setDeleteConfirm(null);
      if (selectedSessionId === sessionId) onSelectSession('');
      onSessionUpdate();
      await loadSessions();
    } catch (e) {
      console.error('[MultiSession] Erro ao deletar sessao:', e);
    }
  };

  const handleDisconnect = async (sessionId: string) => {
    if (!user) return;
    try {
      const { data: { session } } = await (await import('@/lib/supabase')).supabase.auth.getSession();
      if (!session?.access_token) return;
      await fetch('/api/chatbot/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ action: 'disconnect', sessionId }),
      });
      onSessionUpdate();
      await loadSessions();
    } catch (e) {
      console.error('[MultiSession] Erro ao desconectar:', e);
    }
  };

  const handleConnect = async (sessionId: string) => {
    if (!user) return;
    try {
      const { data: { session } } = await (await import('@/lib/supabase')).supabase.auth.getSession();
      if (!session?.access_token) return;
      const res = await fetch('/api/chatbot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ action: 'connect', sessionId, config: {} }),
      });
      const data = await res.json();
      if (data.session) {
        onSessionUpdate();
        await loadSessions();
      }
    } catch (e) {
      console.error('[MultiSession] Erro ao conectar:', e);
    }
  };

  const handleSaveConfig = async (sessionId: string) => {
    if (!user) return;
    try {
      const { data: { session } } = await (await import('@/lib/supabase')).supabase.auth.getSession();
      if (!session?.access_token) return;
      const config = configForm[sessionId] || {};
      await fetch('/api/chatbot/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ action: 'update-config', sessionId, ...config }),
      });
      setEditingConfig(null);
      onSessionUpdate();
      await loadSessions();
    } catch (e) {
      console.error('[MultiSession] Erro ao salvar config:', e);
    }
  };

  const openConfig = (s: SessionData) => {
    setEditingConfig(s.sessionId);
    setConfigForm(prev => ({
      ...prev,
      [s.sessionId]: {
        label: s.label,
        rateLimitPerMinute: s.rateLimitPerMinute,
        rateLimitPerHour: s.rateLimitPerHour,
        rateLimitPerDay: s.rateLimitPerDay,
        minDelay: s.minDelay,
        maxDelay: s.maxDelay,
        proxyUrl: s.proxyUrl,
      }
    }));
  };

  const statusColor = (status: string) => {
    switch (status) {
      case 'connected': return 'bg-green-500';
      case 'qr': case 'pairing': case 'connecting': return 'bg-cyan-500';
      case 'error': return 'bg-red-500';
      case 'disconnected': return 'bg-gray-500';
      default: return 'bg-gray-700';
    }
  };

  const statusLabel = (status: string) => {
    switch (status) {
      case 'connected': return t('multiSession.connected');
      case 'qr': case 'pairing': return t('multiSession.qr');
      case 'connecting': return t('multiSession.connecting');
      case 'error': return t('multiSession.error');
      case 'disconnected': return t('multiSession.disconnected');
      default: return t('multiSession.inactive');
    }
  };

  const formatPhone = (phone: string) => {
    if (!phone) return '-';
    if (phone.length === 13) return `+${phone.slice(0,2)} (${phone.slice(2,4)}) ${phone.slice(4,9)}-${phone.slice(9)}`;
    if (phone.length === 12) return `+${phone.slice(0,2)} (${phone.slice(2,4)}) ${phone.slice(4,8)}-${phone.slice(8)}`;
    return phone;
  };

  if (loading) {
    return <div className="text-center py-8 text-gray-500 text-xs">{t('multiSession.loading')}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">{t('multiSession.title')}</h3>
          <p className="text-xs text-gray-500 mt-0.5">{t('multiSession.subtitle')}</p>
        </div>
        {!showAddForm && (
          <Button onClick={() => setShowAddForm(true)} size="sm"
            className="bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-black font-bold shadow-none whitespace-nowrap">
            + {t('multiSession.addSession')}
          </Button>
        )}
      </div>

      {showAddForm && (
        <div className="p-4 rounded-2xl bg-gradient-to-b from-emerald-500/10 to-black/40 border border-emerald-500/20 space-y-3 animate-slide-up">
          <h4 className="text-sm font-bold text-emerald-300">{t('multiSession.addSessionTitle')}</h4>
          <div>
            <label className="block text-[10px] text-gray-400 mb-1">{t('multiSession.sessionLabel')}</label>
            <input value={addLabel} onChange={e => setAddLabel(e.target.value)}
              placeholder={t('multiSession.sessionLabelPlaceholder')}
              className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500" />
          </div>
          <div>
            <label className="block text-[10px] text-gray-400 mb-1">{t('multiSession.phoneNumber')}</label>
            <input value={addPhone} onChange={e => setAddPhone(e.target.value)}
              placeholder={t('multiSession.phoneNumberPlaceholder')}
              className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 font-mono" />
          </div>
          <div className="flex gap-2">
            <Button onClick={handleCreate} disabled={addLoading || !addLabel.trim()}
              size="sm" className="bg-emerald-500 hover:bg-emerald-400 text-black font-bold shadow-none">
              {addLoading ? '...' : t('multiSession.create')}
            </Button>
            <button type="button" onClick={() => setShowAddForm(false)}
              className="px-3 py-2 rounded-xl text-xs text-gray-400 bg-white/5 hover:bg-white/10 border border-white/10 cursor-pointer">
              {t('multiSession.cancel')}
            </button>
          </div>
        </div>
      )}

      {sessions.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <div className="text-4xl mb-3">📱</div>
          <p className="font-semibold text-sm">{t('multiSession.noSessions')}</p>
          <p className="text-xs mt-1 max-w-md mx-auto">{t('multiSession.noSessionsDesc')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {sessions.map(s => (
            <div key={s.sessionId}
              className={`relative p-4 rounded-2xl border transition-all cursor-pointer ${
                selectedSessionId === s.sessionId
                  ? 'bg-emerald-500/10 border-emerald-500/40 shadow-[0_0_20px_rgba(52,211,153,0.15)]'
                  : 'bg-gradient-to-b from-white/[0.03] to-black/40 border-white/10 hover:border-white/20'
              }`}
              onClick={() => onSelectSession(s.sessionId)}>
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${statusColor(s.status)}`} />
                  <span className="font-semibold text-sm text-white truncate">{s.label}</span>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                  s.status === 'connected' ? 'bg-green-500/10 text-green-400' :
                  s.status === 'error' ? 'bg-red-500/10 text-red-400' :
                  s.status === 'qr' || s.status === 'pairing' ? 'bg-cyan-500/10 text-cyan-400' :
                  'bg-white/5 text-gray-400'
                }`}>
                  {statusLabel(s.status)}
                </span>
              </div>

              <div className="text-xs text-gray-400 mb-3 font-mono">
                {formatPhone(s.phoneNumber)}
              </div>

              {s.qrDataUrl && (s.status === 'qr' || s.status === 'pairing' || s.status === 'connecting') && (
                <div className="mb-3 p-3 rounded-xl bg-white border border-cyan-500/20">
                  <img src={s.qrDataUrl} alt="QR Code" className="w-full max-w-[180px] mx-auto" />
                  <p className="text-center text-[10px] text-black/70 font-semibold mt-2">{t('chatbot.scanQr')}</p>
                </div>
              )}

              {s.pairingCode && (
                <div className="mb-3 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center">
                  <p className="text-[10px] text-emerald-300 font-semibold">{t('chatbot.pairingCode')}</p>
                  <p className="text-lg font-mono font-bold text-white tracking-widest select-all">{s.pairingCode}</p>
                </div>
              )}

              {s.lastError && (
                <div className="mb-3 p-2 rounded-xl bg-red-500/10 border border-red-500/20 text-[10px] text-red-300 leading-relaxed">
                  {s.lastError}
                </div>
              )}

              <div className="flex flex-wrap gap-1.5 mt-2">
                {(s.status === 'idle' || s.status === 'disconnected' || s.status === 'error') && (
                  <button type="button" onClick={(e) => { e.stopPropagation(); handleConnect(s.sessionId); }}
                    className="px-3 py-1.5 rounded-lg text-[11px] font-bold bg-emerald-500 hover:bg-emerald-400 text-black cursor-pointer border-0">
                    {t('multiSession.connect')}
                  </button>
                )}
                {(s.status === 'connected' || s.status === 'qr' || s.status === 'pairing' || s.status === 'connecting') && (
                  <button type="button" onClick={(e) => { e.stopPropagation(); handleDisconnect(s.sessionId); }}
                    className="px-3 py-1.5 rounded-lg text-[11px] font-bold bg-red-600 hover:bg-red-700 text-white cursor-pointer border-0">
                    {t('multiSession.disconnect')}
                  </button>
                )}
                <button type="button" onClick={(e) => { e.stopPropagation(); openConfig(s); }}
                  className="px-3 py-1.5 rounded-lg text-[11px] font-bold bg-white/5 hover:bg-white/10 text-gray-300 cursor-pointer border border-white/10">
                  ⚙️
                </button>
                {deleteConfirm === s.sessionId ? (
                  <div className="flex gap-1">
                    <button type="button" onClick={(e) => { e.stopPropagation(); handleDelete(s.sessionId); }}
                      className="px-3 py-1.5 rounded-lg text-[11px] font-bold bg-red-600 text-white cursor-pointer border-0">
                      {t('multiSession.delete')}
                    </button>
                    <button type="button" onClick={(e) => { e.stopPropagation(); setDeleteConfirm(null); }}
                      className="px-3 py-1.5 rounded-lg text-[11px] bg-white/5 text-gray-400 cursor-pointer border border-white/10">
                      {t('multiSession.cancel')}
                    </button>
                  </div>
                ) : (
                  <button type="button" onClick={(e) => { e.stopPropagation(); setDeleteConfirm(s.sessionId); }}
                    className="px-3 py-1.5 rounded-lg text-[11px] font-bold bg-red-500/10 hover:bg-red-500/20 text-red-400 cursor-pointer border border-red-500/20">
                    🗑️
                  </button>
                )}
              </div>

              {editingConfig === s.sessionId && (
                <div className="mt-3 pt-3 border-t border-white/10 space-y-3" onClick={e => e.stopPropagation()}>
                  <div>
                    <label className="block text-[10px] text-gray-400 mb-0.5">{t('multiSession.sessionLabel')}</label>
                    <input value={configForm[s.sessionId]?.label || ''}
                      onChange={e => setConfigForm(prev => ({ ...prev, [s.sessionId]: { ...prev[s.sessionId], label: e.target.value } }))}
                      className="w-full bg-black/50 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500" />
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-400 font-semibold">{t('multiSession.rateLimits')}</span>
                    <div className="grid grid-cols-3 gap-2 mt-1">
                      <div>
                        <label className="text-[9px] text-gray-500">{t('multiSession.perMinute')}</label>
                        <input type="number" value={configForm[s.sessionId]?.rateLimitPerMinute ?? 10}
                          onChange={e => setConfigForm(prev => ({ ...prev, [s.sessionId]: { ...prev[s.sessionId], rateLimitPerMinute: Number(e.target.value) } }))}
                          className="w-full bg-black/50 border border-white/10 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-emerald-500" />
                      </div>
                      <div>
                        <label className="text-[9px] text-gray-500">{t('multiSession.perHour')}</label>
                        <input type="number" value={configForm[s.sessionId]?.rateLimitPerHour ?? 200}
                          onChange={e => setConfigForm(prev => ({ ...prev, [s.sessionId]: { ...prev[s.sessionId], rateLimitPerHour: Number(e.target.value) } }))}
                          className="w-full bg-black/50 border border-white/10 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-emerald-500" />
                      </div>
                      <div>
                        <label className="text-[9px] text-gray-500">{t('multiSession.perDay')}</label>
                        <input type="number" value={configForm[s.sessionId]?.rateLimitPerDay ?? 500}
                          onChange={e => setConfigForm(prev => ({ ...prev, [s.sessionId]: { ...prev[s.sessionId], rateLimitPerDay: Number(e.target.value) } }))}
                          className="w-full bg-black/50 border border-white/10 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-emerald-500" />
                      </div>
                    </div>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-400 font-semibold">{t('multiSession.delays')}</span>
                    <div className="grid grid-cols-2 gap-2 mt-1">
                      <div>
                        <label className="text-[9px] text-gray-500">{t('multiSession.minDelay')}</label>
                        <input type="number" value={configForm[s.sessionId]?.minDelay ?? 20}
                          onChange={e => setConfigForm(prev => ({ ...prev, [s.sessionId]: { ...prev[s.sessionId], minDelay: Number(e.target.value) } }))}
                          className="w-full bg-black/50 border border-white/10 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-emerald-500" />
                      </div>
                      <div>
                        <label className="text-[9px] text-gray-500">{t('multiSession.maxDelay')}</label>
                        <input type="number" value={configForm[s.sessionId]?.maxDelay ?? 60}
                          onChange={e => setConfigForm(prev => ({ ...prev, [s.sessionId]: { ...prev[s.sessionId], maxDelay: Number(e.target.value) } }))}
                          className="w-full bg-black/50 border border-white/10 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-emerald-500" />
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] text-gray-400 mb-0.5">{t('multiSession.proxy')}</label>
                    <input value={configForm[s.sessionId]?.proxyUrl || ''}
                      onChange={e => setConfigForm(prev => ({ ...prev, [s.sessionId]: { ...prev[s.sessionId], proxyUrl: e.target.value } }))}
                      placeholder={t('multiSession.proxyPlaceholder')}
                      className="w-full bg-black/50 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono" />
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => handleSaveConfig(s.sessionId)}
                      className="px-3 py-1.5 rounded-lg text-[11px] font-bold bg-emerald-500 hover:bg-emerald-400 text-black cursor-pointer border-0">
                      {t('multiSession.saveConfig')}
                    </button>
                    <button type="button" onClick={() => setEditingConfig(null)}
                      className="px-3 py-1.5 rounded-lg text-[11px] bg-white/5 text-gray-400 cursor-pointer border border-white/10">
                      {t('multiSession.cancel')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
