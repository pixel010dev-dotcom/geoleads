'use client';

import { defaultAiInstructions } from './dashboard-constants';
import { useTranslations } from '@/lib/i18n';

import type { ChatbotRule } from '@/types/crm';

export interface ChatbotSectionProps {
  chatbotEnabled: boolean;
  setChatbotEnabled: (v: boolean) => void;
  chatbotBusinessName: string;
  setChatbotBusinessName: (v: string) => void;
  chatbotWelcomeMessage: string;
  setChatbotWelcomeMessage: (v: string) => void;
  chatbotFallbackMessage: string;
  setChatbotFallbackMessage: (v: string) => void;
  chatbotRules: ChatbotRule[];
  setChatbotRules: (v: ChatbotRule[]) => void;
  chatbotUseAI: boolean;
  setChatbotUseAI: (v: boolean) => void;
  chatbotAiInstructions: string;
  setChatbotAiInstructions: (v: string) => void;
  chatbotSession: Record<string, any>;
  chatbotLoading: boolean;
  chatbotMessage: string;
  chatbotPhoneNumber: string;
  setChatbotPhoneNumber: (v: string) => void;
  user: { id: string; email?: string } | null;
  handleConnectChatbot: () => Promise<void>;
  handleDisconnectChatbot: () => Promise<void>;
  handlePairChatbot: () => Promise<void>;
  handleResetSession: () => Promise<void>;
  saveChatbotConfig: (silent?: boolean) => Promise<void>;
  updateChatbotRule: (id: string, field: 'keyword' | 'response' | 'enabled', value: string | boolean) => void;
  addChatbotRule: () => void;
  removeChatbotRule: (id: string) => void;
  chatbotAutoCapture: boolean;
  setChatbotAutoCapture: (v: boolean) => void;
  chatbotStats: Record<string, any> | null;
  conversations: Record<string, any>[];
  conversationsLoading: boolean;
  handleLoadConversations: () => Promise<void>;
  handleLoadChatbotStats: () => Promise<void>;
}

export function ChatbotSection({
  chatbotEnabled,
  setChatbotEnabled,
  chatbotBusinessName,
  setChatbotBusinessName,
  chatbotFallbackMessage,
  setChatbotFallbackMessage,
  chatbotUseAI,
  setChatbotUseAI,
  chatbotAiInstructions,
  setChatbotAiInstructions,
  chatbotSession,
  chatbotLoading,
  chatbotMessage,
  chatbotPhoneNumber,
  setChatbotPhoneNumber,
  user,
  handleConnectChatbot,
  handleDisconnectChatbot,
  handlePairChatbot,
  handleResetSession,
  saveChatbotConfig,
  chatbotAutoCapture,
  setChatbotAutoCapture,
  chatbotStats,
  conversations,
  conversationsLoading,
  handleLoadConversations,
  handleLoadChatbotStats,
}: ChatbotSectionProps) {
  const { t, locale } = useTranslations();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 lg:gap-8 relative z-20 animate-slide-up">
      <div className="lg:col-span-1 space-y-5">
        <div className="app-card p-7 rounded-[2rem] bg-gradient-to-b from-white/[0.05] to-black/40 border border-white/10 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-cyan-500" />
          <h3 className="text-xl font-semibold mb-2 flex items-center gap-2">{t('chatbot.title')}</h3>
          <p className="text-xs text-gray-400 leading-relaxed mb-5">
            {t('chatbot.subtitle')}
          </p>

          <div className="rounded-2xl bg-black/40 border border-white/10 p-4 mb-5">
            <div className="flex items-center justify-between gap-3 mb-3">
              <span className="text-xs text-gray-400">{t('chatbot.connectionStatus')}</span>
              <span className={`text-[10px] px-2.5 py-1 rounded-full border font-bold ${
                chatbotSession.status === 'connected' ? 'bg-green-500/10 border-green-500/20 text-green-400' :
                chatbotSession.status === 'qr' ? 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400' :
                chatbotSession.status === 'connecting' ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' :
                chatbotSession.status === 'error' ? 'bg-red-500/10 border-red-500/20 text-red-400' :
                'bg-white/5 border-white/10 text-gray-400'
              }`}>
                {chatbotSession.status === 'connected' ? t('chatbot.connected') :
                 chatbotSession.status === 'qr' ? t('chatbot.awaitingQr') :
                 chatbotSession.status === 'connecting' ? t('chatbot.connecting') :
                 chatbotSession.status === 'error' ? t('chatbot.error') :
                 chatbotSession.status === 'disconnected' ? t('chatbot.disconnected') : t('chatbot.inactive')}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5">
                <span className="block text-gray-500">{t('chatbot.responses')}</span>
                <strong className="text-lg text-white">{chatbotSession.repliedCount || 0}</strong>
              </div>
              <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5">
                <span className="block text-gray-500">{t('chatbot.aiActive')}</span>
                <strong className="text-lg text-white">{chatbotUseAI ? t('chatbot.yes') : t('chatbot.no')}</strong>
              </div>
            </div>

            {chatbotSession.lastError && (
              <div className="mt-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-300 leading-relaxed">
                {chatbotSession.lastError}
              </div>
            )}

            {chatbotSession.lastIgnoredReason && (
              <div className="mt-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-300 leading-relaxed">
                ⏭️ {chatbotSession.lastIgnoredReason}
              </div>
            )}

            {chatbotSession.lastIncomingAt && (
              <div className="mt-3 p-3 rounded-xl bg-white/[0.03] border border-white/10 text-[11px] text-gray-300 leading-relaxed space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-gray-500">{t('chatbot.botLabel')}</span>
                  <span className={chatbotSession.enabled ? 'text-emerald-300' : 'text-red-300'}>
                    {chatbotSession.enabled ? t('chatbot.active') : t('chatbot.paused')}
                  </span>
                </div>
                <div>
                  <span className="block text-gray-500">{t('chatbot.lastMessage')}</span>
                  <span className="block text-gray-200 break-words">{chatbotSession.lastIncomingText || '—'}</span>
                </div>
                {chatbotSession.lastReplyText && (
                  <div>
                    <span className="block text-gray-500">{t('chatbot.lastReply')}</span>
                    <span className="block text-gray-200 break-words">{chatbotSession.lastReplyText}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {chatbotSession.qrDataUrl ? (
            <div className="p-4 rounded-2xl bg-white border border-cyan-500/20 mb-5">
              <img src={chatbotSession.qrDataUrl} alt="QR Code" className="w-full max-w-[260px] mx-auto" />
              <p className="text-center text-xs text-black/70 font-semibold mt-3">{t('chatbot.scanQr')}</p>
            </div>
          ) : chatbotSession.pairingCode ? (
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 mb-5 text-center">
              <p className="text-xs text-emerald-300 font-semibold mb-1">{t('chatbot.pairingCode')}</p>
              <p className="text-2xl font-mono font-bold text-white tracking-widest select-all">{chatbotSession.pairingCode}</p>
              <p className="text-[10px] text-emerald-400/70 mt-2">{t('whatsapp.pairingSteps')}</p>
            </div>
          ) : (
            <div className="p-4 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-xs text-cyan-300 leading-relaxed mb-5">
              {t('chatbot.connectPhone')}
            </div>
          )}

          {chatbotMessage && (
            <div className="p-3 rounded-xl bg-white/[0.04] border border-white/10 text-xs text-gray-300 mb-4">
              {chatbotMessage}
            </div>
          )}

          <div className="grid grid-cols-1 gap-3">
            {chatbotSession.status === 'connected' || chatbotSession.status === 'qr' || chatbotSession.status === 'connecting' || chatbotSession.status === 'pairing' ? (
              <>
                <button type="button" disabled={chatbotLoading} onClick={handleDisconnectChatbot}
                  className="w-full py-3 rounded-xl font-bold text-white bg-red-600 hover:bg-red-700 border border-red-500/30 cursor-pointer disabled:opacity-60">
                  {t('chatbot.disconnect')}
                </button>
                <button type="button" disabled={chatbotLoading} onClick={handleResetSession}
                  className="w-full py-2 rounded-xl text-xs text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 cursor-pointer disabled:opacity-60">
                  {t('chatbot.resetSession')}
                </button>
              </>
            ) : (
              <>
                <button type="button" disabled={chatbotLoading || !user} onClick={handleConnectChatbot}
                  className="w-full py-3 rounded-xl font-bold text-black bg-gradient-to-r from-emerald-400 to-cyan-400 hover:from-emerald-300 hover:to-cyan-300 cursor-pointer disabled:opacity-60">
                  {user ? t('chatbot.connectQr') : t('chatbot.loginToConnect')}
                </button>
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-white/10" />
                  </div>
                  <div className="relative flex justify-center text-xs">
                    <span className="bg-[#050507] px-3 text-gray-500">{t('chatbot.or')}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <input type="text" placeholder={t('chatbot.phonePlaceholder')}
                    value={chatbotPhoneNumber} onChange={(e) => setChatbotPhoneNumber(e.target.value)}
                    className="flex-1 bg-black/50 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500 font-mono" />
                  <button type="button" disabled={chatbotLoading || !user} onClick={handlePairChatbot}
                    className="px-4 py-2.5 rounded-xl font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 cursor-pointer disabled:opacity-60 text-sm whitespace-nowrap">
                    {user ? t('chatbot.pair') : '...'}
                  </button>
                </div>
              </>
            )}
            <button type="button" disabled={chatbotLoading} onClick={() => { saveChatbotConfig().catch(console.error); }}
              className="w-full py-3 rounded-xl font-bold text-white bg-white/5 hover:bg-white/10 border border-white/10 cursor-pointer disabled:opacity-60">
              {t('chatbot.saveConfig')}
            </button>
          </div>
        </div>
      </div>

      <div className="lg:col-span-2 space-y-5">
        <div className="app-card p-7 rounded-[2rem] bg-gradient-to-b from-white/[0.03] to-black/40 border border-white/10 shadow-2xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div>
              <h3 className="text-xl font-semibold">{t('chatbot.configTitle')}</h3>
              <p className="text-xs text-gray-500 mt-1">{t('chatbot.configDesc')}</p>
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-xs text-gray-300 bg-white/5 border border-white/10 rounded-xl px-3 py-2 cursor-pointer whitespace-nowrap">
                <input type="checkbox" checked={chatbotUseAI} onChange={(e) => setChatbotUseAI(e.target.checked)}
                  className="rounded border-white/20 bg-black/40 text-emerald-500 focus:ring-0 cursor-pointer h-4 w-4" />
                {t('chatbot.useAi')}
              </label>
              <label className="flex items-center gap-2 text-xs text-gray-300 bg-white/5 border border-white/10 rounded-xl px-3 py-2 cursor-pointer whitespace-nowrap">
                <input type="checkbox" checked={chatbotEnabled} onChange={(e) => setChatbotEnabled(e.target.checked)}
                  className="rounded border-white/20 bg-black/40 text-emerald-500 focus:ring-0 cursor-pointer h-4 w-4" />
                {t('chatbot.botActive')}
              </label>
            </div>
          </div>

          <div className="mb-5">
            <label className="block text-xs text-gray-400 mb-1">{t('chatbot.botName')}</label>
            <input value={chatbotBusinessName} onChange={(e) => setChatbotBusinessName(e.target.value)}
              className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500" />
          </div>

          <div className="mb-5">
            <label className="block text-xs text-gray-400 mb-1">{t('chatbot.aiInstructions')}</label>
            <textarea rows={4} value={chatbotAiInstructions} onChange={(e) => setChatbotAiInstructions(e.target.value)}
              placeholder={defaultAiInstructions}
              className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-emerald-500 resize-none" />
            <p className="text-[10px] text-gray-500 mt-1">{t('chatbot.aiPlaceholder')}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1">{t('chatbot.fallbackMessage')}</label>
              <textarea rows={3} value={chatbotFallbackMessage} onChange={(e) => setChatbotFallbackMessage(e.target.value)}
                className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-emerald-500 resize-none" />
            </div>
            <div className="flex flex-col justify-end">
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                <p className="text-xs text-emerald-300 font-semibold">{t('chatbot.aiStatus')}</p>
                <p className="text-[11px] text-emerald-400/70 mt-1">
                  {t('chatbot.aiStatusHint')}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="app-card p-7 rounded-[2rem] bg-gradient-to-b from-white/[0.03] to-black/40 border border-white/10 shadow-2xl">
          <div className="flex items-center justify-between gap-3 mb-4">
            <h3 className="text-xl font-semibold">{t('chatbot.analyticsTitle')}</h3>
            <button type="button" onClick={handleLoadChatbotStats}
              className="text-[10px] px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400 cursor-pointer">{t('chatbot.analyticsRefresh')}</button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: t('chatbot.analyticsConversations'), value: chatbotStats?.totalConversations ?? 0, color: 'text-emerald-400' },
              { label: t('chatbot.analyticsSent'), value: chatbotStats?.totalSent ?? 0, color: 'text-blue-400' },
              { label: t('chatbot.analyticsToday'), value: chatbotStats?.todaySent ?? 0, color: 'text-cyan-400' },
              { label: t('chatbot.analyticsSuccess'), value: `${chatbotStats?.successRate ?? 100}%`, color: 'text-green-400' },
            ].map(s => (
              <div key={s.label} className="p-3 rounded-xl bg-black/30 border border-white/5 text-center">
                <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
                <div className="text-[10px] text-gray-500 mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="app-card p-7 rounded-[2rem] bg-gradient-to-b from-white/[0.03] to-black/40 border border-white/10 shadow-2xl">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-xl font-semibold">{t('chatbot.leadCapture')}</h3>
              <p className="text-xs text-gray-500 mt-1">{t('chatbot.leadCaptureDesc')}</p>
            </div>
            <label className="flex items-center gap-2 text-xs text-gray-300 bg-white/5 border border-white/10 rounded-xl px-3 py-2 cursor-pointer whitespace-nowrap">
              <input type="checkbox" checked={chatbotAutoCapture} onChange={(e) => setChatbotAutoCapture(e.target.checked)}
                className="rounded border-white/20 bg-black/40 text-emerald-500 focus:ring-0 cursor-pointer h-4 w-4" /> {t('chatbot.leadCaptureActive')}
            </label>
          </div>
        </div>

        <div className="app-card p-7 rounded-[2rem] bg-gradient-to-b from-white/[0.03] to-black/40 border border-white/10 shadow-2xl">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <h3 className="text-xl font-semibold">{t('chatbot.recentConversations')}</h3>
              <p className="text-xs text-gray-500 mt-1">{t('chatbot.recentDesc')}</p>
            </div>
            <button type="button" onClick={handleLoadConversations} disabled={conversationsLoading}
              className="text-[10px] px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400 cursor-pointer disabled:opacity-50">
              {conversationsLoading ? '...' : t('chatbot.analyticsRefresh')}
            </button>
          </div>
          {conversations.length > 0 ? (
            <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
              {conversations.map((conv: Record<string, any>) => (
                <div key={conv.id} className={`p-3 rounded-xl text-xs border ${conv.direction === 'incoming' ? 'bg-white/5 border-white/10' : 'bg-emerald-500/5 border-emerald-500/15'}`}>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="font-bold text-gray-200 truncate">{conv.contact_name || conv.contact_phone || t('chatbot.disconnected')}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${conv.direction === 'incoming' ? 'bg-blue-500/10 text-blue-300' : 'bg-emerald-500/10 text-emerald-300'}`}>
                      {conv.direction === 'incoming' ? t('chatbot.received') : t('chatbot.reply')}
                    </span>
                  </div>
                  <div className="text-gray-400 line-clamp-2">{conv.message_text}</div>
                  <div className="text-[10px] text-gray-600 mt-1">
                    {conv.created_at ? new Date(conv.created_at).toLocaleString(locale) : '—'}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500 text-xs">
              {conversationsLoading ? t('chatbot.loading') : t('chatbot.noConversations')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
