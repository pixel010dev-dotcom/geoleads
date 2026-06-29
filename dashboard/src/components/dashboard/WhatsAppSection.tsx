'use client';

import { useState } from 'react';
import type { FeatureKey } from '@/lib/plans';
import type { DashboardTab } from './dashboard-constants';
import type { CrmLead, WaSentMessage, AiCopyResult } from '@/types/crm';
import { waMessagePresets, waTemplateTags } from './dashboard-constants';
import { Button } from '@/components/Button';
import { useTranslations } from '@/lib/i18n';

export interface WhatsAppSectionProps {
  dispatchableWaLeads: CrmLead[];
  selectedWaLeads: string[];
  setSelectedWaLeads: (v: string[]) => void;
  waTemplate: string;
  setWaTemplate: (v: string) => void;
  waSentStatus: Record<string, boolean>;
  isSendingBulk: boolean;
  isAutoSending: boolean;
  bulkDelay: string;
  setBulkDelay: (v: string) => void;
  bulkSimulateHuman: boolean;
  setBulkSimulateHuman: (v: boolean) => void;
  bulkAutoNext: boolean;
  setBulkAutoNext: (v: boolean) => void;
  bulkIndex: number;
  bulkTimer: number;
  bulkQueue: CrmLead[];
  waAiProduct: string;
  setWaAiProduct: (v: string) => void;
  waAiValue: string;
  setWaAiValue: (v: string) => void;
  waAiTone: string;
  setWaAiTone: (v: string) => void;
  waAiCopies: AiCopyResult[];
  waAiLoading: boolean;
  waAiMessage: string;
  waSendingViaBot: Record<string, boolean>;
  waSentMessages: WaSentMessage[];
  waSentMessagesLoading: boolean;
  chatbotSession: Record<string, any>;
  user: { id: string; email?: string } | null;
  requireFeature: (feature: FeatureKey) => boolean;
  setActiveTab: (tab: DashboardTab) => void;
  openWhatsApp: (lead: CrmLead, customText?: string, options?: Record<string, any>) => void;
  handleStartBulkSending: () => void;
  handleStopBulkSending: () => void;
  handleStartAutoBulkSend: () => Promise<void>;
  handleConfirmSentAndNext: () => void;
  handleTriggerBulkSendLead: (index: number, queueOverride?: CrmLead[]) => void;
  handleToggleSelectWaLead: (leadKey: string) => void;
  handleToggleSelectAllWaLeads: (dispatchable: CrmLead[]) => void;
  handleSendViaBot: (lead: CrmLead) => Promise<void>;
  handleLoadSentMessages: () => Promise<void>;
  generateWaAiTemplates: (e: React.FormEvent) => Promise<void>;
  appendWaTag: (tag: string) => void;
  getSafeBulkDelay: () => number;
  renderWhatsAppMessage: (lead: Partial<CrmLead>, template?: string) => string;
  getLeadKey: (lead: Partial<CrmLead>) => string;
  waPreviewLead: Partial<CrmLead>;
  selectedWaCount: number;
  activeBulkLeadKey: string | null;
  waStats: Record<string, any> | null;
  campaigns: Record<string, any>[];
  scheduleDate: string;
  setScheduleDate: (v: string) => void;
  scheduleTime: string;
  setScheduleTime: (v: string) => void;
  handleLoadWaStats: () => Promise<void>;
  handleLoadCampaigns: () => Promise<void>;
  handleCreateCampaign: () => Promise<void>;
}

export function WhatsAppSection({
  dispatchableWaLeads,
  selectedWaLeads,
  setSelectedWaLeads,
  waTemplate,
  setWaTemplate,
  waSentStatus,
  isSendingBulk,
  isAutoSending,
  bulkDelay,
  setBulkDelay,
  bulkSimulateHuman,
  setBulkSimulateHuman,
  bulkAutoNext,
  setBulkAutoNext,
  bulkIndex,
  bulkTimer,
  bulkQueue,
  waAiProduct,
  setWaAiProduct,
  waAiValue,
  setWaAiValue,
  waAiTone,
  setWaAiTone,
  waAiCopies,
  waAiLoading,
  waAiMessage,
  waSendingViaBot,
  waSentMessages,
  waSentMessagesLoading,
  chatbotSession,
  user,
  requireFeature,
  setActiveTab,
  openWhatsApp,
  handleStartBulkSending,
  handleStopBulkSending,
  handleStartAutoBulkSend,
  handleConfirmSentAndNext,
  handleTriggerBulkSendLead,
  handleToggleSelectWaLead,
  handleToggleSelectAllWaLeads,
  handleSendViaBot,
  handleLoadSentMessages,
  generateWaAiTemplates,
  appendWaTag,
  getSafeBulkDelay,
  renderWhatsAppMessage,
  getLeadKey,
  waPreviewLead,
  selectedWaCount,
  activeBulkLeadKey,
  waStats,
  campaigns,
  scheduleDate,
  setScheduleDate,
  scheduleTime,
  setScheduleTime,
  handleLoadWaStats,
  handleLoadCampaigns,
  handleCreateCampaign,
}: WhatsAppSectionProps) {
  const { t, locale } = useTranslations();
  const [followupDelays, setFollowupDelays] = useState<string>('1,3,7');
  const [followupEnabled, setFollowupEnabled] = useState(false);
  const [followupMessage, setFollowupMessage] = useState('Olá {Nome}! Tudo bem? Passando pra saber se teve chance de ver minha mensagem anterior. Qualquer dúvida, fico à disposição!');

  const presetLabel = (id: string, type: 'title' | 'subtitle'): string => {
    const keyMap: Record<string, { title: string; subtitle: string }> = {
      'local': { title: 'whatsapp.preset1', subtitle: 'whatsapp.preset2' },
      'offer': { title: 'whatsapp.preset3', subtitle: 'whatsapp.preset4' },
      'audit': { title: 'whatsapp.preset5', subtitle: 'whatsapp.preset6' },
      'partner': { title: 'whatsapp.preset7', subtitle: 'whatsapp.preset8' },
    };
    const keys = keyMap[id];
    return keys ? t(keys[type]) : type === 'title' ? 'Preset' : '';
  };

  return (
    <div className="space-y-5 animate-slide-up">
      {/* Métricas */}
      <div className="app-card p-5 rounded-[2rem] bg-gradient-to-b from-white/[0.03] to-black/40 border border-white/10 shadow-2xl">
        <div className="flex items-center justify-between gap-3 mb-4">
          <h3 className="text-lg font-semibold">{t('whatsapp.metrics')}</h3>
          <button type="button" onClick={() => { handleLoadWaStats(); handleLoadCampaigns(); }}
            className="text-[10px] px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400 cursor-pointer">
            {t('whatsapp.refresh')}
          </button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: t('whatsapp.totalSent'), value: waStats?.totalSent ?? 0, color: 'text-blue-400' },
            { label: t('whatsapp.failures'), value: waStats?.totalFailed ?? 0, color: 'text-red-400' },
            { label: t('whatsapp.successRate'), value: `${waStats?.successRate ?? 100}%`, color: 'text-green-400' },
            { label: t('whatsapp.sentToday'), value: waStats?.todaySent ?? 0, color: 'text-cyan-400' },
            { label: t('whatsapp.campaigns'), value: campaigns.length, color: 'text-purple-400' },
          ].map(s => (
            <div key={s.label} className="p-3 rounded-xl bg-black/30 border border-white/5 text-center">
              <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
              <div className="text-[10px] text-gray-500 mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>
        {/* Campanhas agendadas */}
        {campaigns.filter((c: Record<string, any>) => c.status === 'scheduled').length > 0 && (
          <div className="mt-4 space-y-2">
            <span className="text-xs text-gray-500 font-bold">{t('whatsapp.scheduledCampaigns')}</span>
            {campaigns.filter((c: Record<string, any>) => c.status === 'scheduled').map((c: Record<string, any>) => (
              <div key={c.id} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-amber-500/5 border border-amber-500/15 text-xs">
                <span className="text-gray-300 truncate">{c.name}</span>
                <span className="text-amber-300 whitespace-nowrap font-mono">{c.scheduled_at ? new Date(c.scheduled_at).toLocaleString(locale) : '—'}</span>
              </div>
            ))}
          </div>
        )}
      </div>

    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 lg:gap-8 relative z-20">

      {/* CONFIGURAÇÃO DO DISPARO */}
      <div className="lg:col-span-1 space-y-5">
        {/* MODELO DE MENSAGEM */}
        <div className="app-card p-7 rounded-[2rem] bg-gradient-to-b from-white/[0.05] to-black/40 border border-white/10 shadow-2xl relative">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-green-500 to-emerald-500" />
          <div className="mb-5">
            <h3 className="text-xl font-semibold flex items-center gap-2">
              {t('whatsapp.campaignMessage')}
            </h3>
            <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
              <span className="px-2.5 py-1 rounded-full bg-green-500/10 text-green-300 border border-green-500/20 font-bold">
                {t('whatsapp.customBadge')}
              </span>
              <span className="px-2.5 py-1 rounded-full bg-white/5 text-gray-400 border border-white/10">
                {t('whatsapp.assistedBadge')}
              </span>
            </div>
          </div>

          <div className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {waMessagePresets.map((preset) => {
                const isSelected = waTemplate === preset.body;

                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => setWaTemplate(preset.body)}
                    className={`text-left p-3 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-green-500/15 border-green-500/40 shadow-[0_0_18px_rgba(34,197,94,0.12)]'
                        : 'bg-white/[0.03] border-white/10 hover:bg-white/[0.06] hover:border-white/20'
                    }`}
                  >
                    <span className="block text-xs font-bold text-gray-100">{presetLabel(preset.id, 'title')}</span>
                    <span className="block text-[10px] text-gray-500 mt-0.5">{presetLabel(preset.id, 'subtitle')}</span>
                  </button>
                );
              })}
            </div>

            <form onSubmit={generateWaAiTemplates} className="rounded-2xl bg-green-500/[0.04] border border-green-500/15 p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h4 className="text-sm font-bold text-green-300">{t('whatsapp.aiModels')}</h4>
                  <p className="text-[11px] text-gray-500 mt-0.5">{t('whatsapp.aiSubtitle')}</p>
                </div>
                <span className="text-[10px] px-2 py-1 rounded-full bg-black/30 border border-white/10 text-gray-400">
                  {t('whatsapp.aiProvider')}
                </span>
              </div>

              <div className="grid grid-cols-1 gap-2">
                <input
                  value={waAiProduct}
                  onChange={(e) => setWaAiProduct(e.target.value)}
                  placeholder={t('whatsapp.aiProduct')}
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-green-500"
                />
                <textarea
                  rows={2}
                  value={waAiValue}
                  onChange={(e) => setWaAiValue(e.target.value)}
                  placeholder={t('whatsapp.aiBenefit')}
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-green-500 resize-none"
                />
                <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2">
                  <select
                    value={waAiTone}
                    onChange={(e) => setWaAiTone(e.target.value)}
                    style={{ colorScheme: 'dark' }}
                    className="w-full bg-black/80 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-green-500 cursor-pointer"
                  >
                    <option value="friendly">{t('whatsapp.aiToneHuman')}</option>
                    <option value="direct">{t('whatsapp.aiToneDirect')}</option>
                    <option value="curious">{t('whatsapp.aiToneCurious')}</option>
                    <option value="persuasive">{t('whatsapp.aiTonePersuasive')}</option>
                  </select>
                  <button
                    type="submit"
                    disabled={waAiLoading}
                    className="px-4 py-2.5 rounded-xl bg-green-500 hover:bg-green-400 text-black text-xs font-extrabold cursor-pointer disabled:opacity-60"
                  >
                    {waAiLoading ? t('whatsapp.aiGenerating') : t('whatsapp.aiGenerate')}
                  </button>
                </div>
              </div>

              {waAiMessage && (
                <div className="text-[11px] text-green-200 bg-black/25 border border-white/10 rounded-xl px-3 py-2">
                  {waAiMessage}
                </div>
              )}

              {waAiCopies.length > 0 && (
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {waAiCopies.map((copy, index) => (
                    <button
                      key={`${copy.title}-${index}`}
                      type="button"
                      onClick={() => setWaTemplate(copy.text)}
                      className="w-full text-left p-3 rounded-xl bg-black/35 hover:bg-black/50 border border-white/10 hover:border-green-500/30 transition-all cursor-pointer"
                    >
                      <span className="block text-xs font-bold text-white">{copy.title}</span>
                      <span className="block text-[10px] text-gray-500 mt-0.5">{copy.desc}</span>
                      <span className="block text-[11px] text-gray-300 mt-2 line-clamp-3 whitespace-pre-wrap">{copy.text}</span>
                      <span className="block text-[10px] text-green-300 font-bold mt-2">{t('whatsapp.aiUseModel')}</span>
                    </button>
                  ))}
                </div>
              )}
            </form>

            <div>
              <div className="mb-2 flex items-center justify-between gap-3">
                <label className="block text-xs font-medium text-gray-400">{t('whatsapp.dynamicFields')}</label>
                <span className="text-[10px] text-gray-500 font-mono">{t('whatsapp.aiChars', { count: waTemplate.length })}</span>
              </div>
              <textarea
                rows={7}
                className="w-full bg-black/50 border border-white/10 rounded-xl p-3.5 text-sm text-white focus:outline-none focus:border-green-500 transition-all resize-none leading-relaxed"
                value={waTemplate}
                onChange={(e) => setWaTemplate(e.target.value)}
              />
            </div>

            {/* TAG HELPERS */}
            <div>
              <label className="block text-[11px] font-medium text-gray-500 mb-2">{t('whatsapp.dynamicFields')}</label>
              <div className="flex flex-wrap gap-1.5">
                {waTemplateTags.map(tag => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => appendWaTag(tag)}
                    className="px-2.5 py-1 rounded bg-white/5 hover:bg-white/10 border border-white/15 text-[11px] font-mono text-gray-300 hover:text-white transition-all cursor-pointer"
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-2xl bg-black/45 border border-green-500/15 overflow-hidden">
              <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between gap-3">
                <span className="text-xs font-bold text-green-300">{t('whatsapp.preview')}</span>
                <span className="text-[10px] text-gray-500 truncate">{waPreviewLead.nome}</span>
              </div>
              <div className="p-4 text-xs text-gray-300 leading-relaxed">
                {renderWhatsAppMessage(waPreviewLead)}
              </div>
            </div>
          </div>
        </div>

        {/* PAINEL DE DISPARO EM MASSA E ANTIBAN */}
        <div className="app-card p-7 rounded-[2rem] bg-gradient-to-b from-white/[0.05] to-black/40 border border-white/10 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500 to-orange-500" />
          <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
            {t('whatsapp.queueTitle')}
          </h3>
          <p className="text-xs text-gray-400 mb-4">
            {t('whatsapp.queueDesc')}
          </p>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">{t('whatsapp.intervalLabel')}</label>
              <input
                type="number"
                min={10}
                max={120}
                inputMode="numeric"
                placeholder="20"
                className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-red-500 font-mono"
                value={bulkDelay}
                onChange={(e) => setBulkDelay(e.target.value)}
                onBlur={() => setBulkDelay(String(getSafeBulkDelay()))}
              />
            </div>

            <div className="space-y-2.5">
              <label className="flex items-center gap-2.5 text-xs text-gray-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={bulkSimulateHuman}
                  onChange={(e) => setBulkSimulateHuman(e.target.checked)}
                  className="rounded border-white/20 bg-black/40 text-red-500 focus:ring-0 cursor-pointer h-4 w-4"
                />
                {t('whatsapp.humanBehavior')}
              </label>

              <label className="flex items-center gap-2.5 text-xs text-gray-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={bulkAutoNext}
                  onChange={(e) => setBulkAutoNext(e.target.checked)}
                  className="rounded border-white/20 bg-black/40 text-red-500 focus:ring-0 cursor-pointer h-4 w-4"
                />
                {t('whatsapp.autoNext')}
              </label>
            </div>

            {/* STATUS DO BOT CONECTADO */}
            <div className={`p-3 rounded-xl text-xs leading-relaxed space-y-1 ${
              chatbotSession?.status === 'connected'
                ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-300'
                : 'bg-gray-500/10 border border-gray-500/20 text-gray-400'
            }`}>
              <span className="font-bold flex items-center gap-1">
                {chatbotSession?.status === 'connected' ? t('whatsapp.botConnected') : t('whatsapp.botDisconnected')}
              </span>
              {chatbotSession?.status === 'connected' ? (
                <span>{t('whatsapp.botStatusConnected')}. {t('whatsapp.botRepliedCount', { count: chatbotSession.repliedCount || 0 })}</span>
              ) : (
                <span>{t('whatsapp.botStatusDisconnected')}</span>
              )}
            </div>

            {/* ALERTA DE BLOQUEIO DESTAQUE */}
            <div className="p-4 rounded-xl bg-red-950/20 border border-red-500/20 text-xs text-red-400 leading-relaxed space-y-1">
              <span className="font-bold flex items-center gap-1">{t('whatsapp.blockWarning')}</span>
              {t('whatsapp.blockWarningText')}
            </div>

        {/* AGENDAMENTO */}
        <div className="p-4 rounded-xl bg-purple-950/20 border border-purple-500/20 space-y-3">
          <span className="text-xs font-bold text-purple-300 flex items-center gap-1">{t('whatsapp.scheduleSend')}</span>
          <div className="grid grid-cols-2 gap-2">
            <input type="date" value={scheduleDate} onChange={(e) => setScheduleDate(e.target.value)}
              className="bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500 [color-scheme:dark]" />
            <input type="time" value={scheduleTime} onChange={(e) => setScheduleTime(e.target.value)}
              className="bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500 [color-scheme:dark]" />
          </div>
          <Button onClick={handleCreateCampaign} size="sm" className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 shadow-none text-xs py-2">
            {t('whatsapp.scheduleCampaign')}
          </Button>
        </div>

        {/* FOLLOW-UP SEQUENCE */}
        <div className="p-4 rounded-xl bg-green-950/20 border border-green-500/20 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-green-300 flex items-center gap-1">{t('whatsapp.followUp')}</span>
            <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer">
              <input type="checkbox" checked={followupEnabled} onChange={e => setFollowupEnabled(e.target.checked)}
                className="rounded border-white/20 bg-black/40 text-green-500 cursor-pointer h-3.5 w-3.5" />
              {t('whatsapp.enable')}
            </label>
          </div>
          {followupEnabled && (
            <div className="space-y-2">
              <div>
                <label className="text-[10px] text-gray-500 block mb-1">{t('whatsapp.followUpInterval')}</label>
                <input type="text" value={followupDelays} onChange={e => setFollowupDelays(e.target.value)}
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-green-500 font-mono"
                  placeholder="1,3,7" />
              </div>
              <div>
                <label className="text-[10px] text-gray-500 block mb-1">{t('whatsapp.followUpMessage')}</label>
                <textarea rows={2} value={followupMessage} onChange={e => setFollowupMessage(e.target.value)}
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-green-500 resize-none"
                  placeholder="Olá {Nome}!..." />
              </div>
              <p className="text-[9px] text-gray-600">Tags: {'{Nome}'} {'{Cidade}'} {'{Nicho}'}</p>
            </div>
          )}
        </div>

            {isSendingBulk ? (
              <Button onClick={handleStopBulkSending} variant="danger" size="md" className="w-full">
                {t('whatsapp.stopQueue')}
              </Button>
            ) : (
              <div className="flex flex-col gap-2">
                <Button onClick={handleStartBulkSending} variant="danger" size="md" className="w-full">
                  {t('whatsapp.startQueue')}
                </Button>
                <Button
                  onClick={() => {
                    if (chatbotSession?.status === 'connected') {
                      handleStartAutoBulkSend();
                    } else {
                      setActiveTab('chatbot');
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }
                  }}
                  size="md"
                  className={`w-full ${
                    chatbotSession?.status === 'connected'
                      ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500'
                      : 'bg-amber-600/30 text-amber-300 hover:bg-amber-600/50 border border-amber-500/30 shadow-none'
                  }`}
                >
                  {chatbotSession?.status === 'connected' ? t('whatsapp.autoSendBot') : t('whatsapp.connectBotFirst')}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* LISTA DE DISPARO */}
      <div className="lg:col-span-2">
        <div className="app-card p-7 rounded-[2rem] bg-gradient-to-b from-white/[0.03] to-black/40 border border-white/10 shadow-2xl h-full flex flex-col">
          <div className="mb-6 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
            <div>
              <h3 className="text-xl font-semibold">{t('whatsapp.readyLeads')}</h3>
              <p className="text-xs text-gray-500 mt-1">{t('whatsapp.readyLeadsDesc')}</p>
            </div>
            <div className="flex flex-wrap gap-2 sm:items-center">
              <div className="text-xs px-3 py-1.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20 font-bold">
                {t('whatsapp.selected', { count: selectedWaCount })}
              </div>
              <div className="text-xs px-3 py-1.5 rounded-full bg-white/5 text-gray-300 border border-white/10 font-bold">
                {t('whatsapp.totalWithPhone', { count: dispatchableWaLeads.length })}
              </div>
            </div>
          </div>

          {/* BANNER DE FILA ATIVA */}
          {isSendingBulk && bulkIndex >= 0 && (
            <div className={`mb-6 p-5 rounded-2xl text-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
              isAutoSending
                ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                : 'bg-green-500/10 border border-green-500/20 text-green-400'
            }`}>
              <div>
                <span className="font-bold block">{isAutoSending ? t('whatsapp.autoActive') : t('whatsapp.queueActive')}</span>
                {isAutoSending ? (
                  <span>{t('whatsapp.sendingProgress', { current: bulkIndex + 1, total: bulkQueue.length })}</span>
                ) : (
                  <>
                    {t('whatsapp.processingLead', { current: bulkIndex + 1, total: bulkQueue.length })}
                    {bulkAutoNext ? (
                      <> {t('whatsapp.nextChatIn')} <span className="font-mono font-bold text-white bg-green-500 px-2 py-0.5 rounded text-xs ml-1">{bulkTimer}s</span>.</>
                    ) : (
                      <span className="block text-green-300 mt-1">{t('whatsapp.sendAndProceed')}</span>
                    )}
                  </>
                )}
              </div>
              <div className="app-action-row w-full sm:w-auto">
                {!isAutoSending && (
                  <button
                    onClick={handleConfirmSentAndNext}
                    className="px-3.5 py-1.5 rounded-lg bg-green-500 text-black hover:bg-green-400 border border-green-400 text-xs font-extrabold cursor-pointer"
                  >
                    {t('whatsapp.alreadySent')}
                  </button>
                )}
                <button
                  onClick={handleStopBulkSending}
                  className="px-3.5 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30 text-xs font-semibold cursor-pointer"
                >
                  {t('whatsapp.stopQueue')}
                </button>
              </div>
            </div>
          )}

          <div className="flex-1 rounded-2xl border border-white/5 bg-black/20 overflow-hidden overflow-y-auto max-h-[500px]">
            <table className="hidden md:table w-full text-left text-sm">
              <thead className="bg-white/5 border-b border-white/5 text-gray-400 sticky top-0">
                <tr>
                  <th className="px-4 py-3 font-medium w-12 text-center">
                    <input
                      type="checkbox"
                      className="rounded border-white/20 bg-black/40 text-green-500 focus:ring-0 cursor-pointer h-4 w-4"
                      checked={dispatchableWaLeads.length > 0 && dispatchableWaLeads.every(l => selectedWaLeads.includes(getLeadKey(l)))}
                      disabled={isSendingBulk}
                      onChange={() => handleToggleSelectAllWaLeads(dispatchableWaLeads)}
                    />
                  </th>
                  <th className="px-4 py-3 font-medium">{t('whatsapp.tableName')}</th>
                  <th className="px-4 py-3 font-medium">{t('whatsapp.tablePhone')}</th>
                  <th className="px-4 py-3 font-medium">{t('whatsapp.tablePreview')}</th>
                  <th className="px-4 py-3 font-medium">{t('whatsapp.tableStatus')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {dispatchableWaLeads
                  .map((lead, i) => {
                    const leadKey = getLeadKey(lead);
                    const isSent = waSentStatus[lead.nome] || false;
                    const isActive = activeBulkLeadKey === leadKey;
                    const queueIndex = bulkQueue.findIndex(l => getLeadKey(l) === leadKey);
                    const previewText = renderWhatsAppMessage(lead);

                    return (
                      <tr key={i} className={`transition-all duration-300 ${
                        isActive
                          ? 'bg-green-500/10 border-l-4 border-l-green-500'
                          : 'hover:bg-white/[0.03]'
                      }`}>
                        <td className="px-4 py-4 w-12 text-center">
                          <input
                            type="checkbox"
                            className="rounded border-white/20 bg-black/40 text-green-500 focus:ring-0 cursor-pointer h-4 w-4"
                            checked={selectedWaLeads.includes(leadKey)}
                            disabled={isSendingBulk}
                            onChange={() => handleToggleSelectWaLead(leadKey)}
                          />
                        </td>
                        <td className="px-4 py-4 font-bold text-gray-200">
                          {lead.nome}
                          <span className="block text-[10px] text-gray-500 font-normal mt-0.5">{lead.nicho} · {lead.cidade}</span>
                        </td>
                        <td className="px-4 py-4 text-xs font-mono text-gray-400">
                          {lead.telefone}
                        </td>
                        <td className="px-4 py-4 text-xs text-gray-400 max-w-xs truncate" title={previewText}>
                          {previewText}
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex flex-wrap gap-1.5">
                            <button
                              disabled={isSendingBulk && queueIndex < 0}
                              onClick={() => {
                                if (isSendingBulk) {
                                  if (queueIndex >= 0) handleTriggerBulkSendLead(queueIndex);
                                } else {
                                  openWhatsApp(lead, waTemplate);
                                }
                              }}
                              className={`px-3 py-2 rounded-lg font-bold text-xs cursor-pointer border transition-all ${
                                isActive
                                  ? 'bg-green-500 text-black border-green-400 hover:bg-green-400 font-extrabold'
                                  : isSendingBulk && queueIndex < 0
                                    ? 'bg-white/[0.02] border-white/5 text-gray-600 cursor-not-allowed'
                                  : isSent
                                    ? 'bg-green-500/10 border-green-500/30 text-green-400 hover:bg-green-500/20'
                                    : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20 text-gray-200'
                              }`}
                            >
                              {isActive ? t('whatsapp.btnChatActive') : isSendingBulk && queueIndex < 0 ? t('whatsapp.btnOutQueue') : isSent ? t('whatsapp.btnResend') : t('whatsapp.btnDispatch')}
                            </button>
                            {chatbotSession?.status === 'connected' && (
                              <button
                                disabled={waSendingViaBot[leadKey]}
                                onClick={() => handleSendViaBot(lead)}
                                className={`px-3 py-2 rounded-lg font-bold text-xs cursor-pointer border transition-all ${
                                  waSendingViaBot[leadKey]
                                    ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400 animate-pulse'
                                    : 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20'
                                }`}
                              >
                                {waSendingViaBot[leadKey] ? '...' : t('whatsapp.btnBot')}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                {dispatchableWaLeads.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-16 text-center text-gray-500">
                      <div className="text-3xl mb-3">💬</div>
                      <p className="font-semibold">{t('whatsapp.emptyLeads')}</p>
                      <p className="text-xs max-w-md mx-auto mt-1">{t('whatsapp.emptyLeadsDesc')}</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {/* Mobile Card List WhatsApp */}
            <div className="mobile-card-list md:hidden p-3 sm:p-4">
              {dispatchableWaLeads.length > 0 && (
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 bg-white/[0.02] border border-white/5 rounded-xl p-3.5">
                  <span className="text-xs text-gray-400">{t('whatsapp.selected', { count: selectedWaCount })} de {dispatchableWaLeads.length}</span>
                  <button
                    type="button"
                    onClick={() => handleToggleSelectAllWaLeads(dispatchableWaLeads)}
                    disabled={isSendingBulk}
                    className="text-xs font-bold text-green-400 hover:text-green-300 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {dispatchableWaLeads.every(l => selectedWaLeads.includes(getLeadKey(l))) ? t('whatsapp.deselectAllLabel') : t('whatsapp.selectAllLabel')}
                  </button>
                </div>
              )}
              {dispatchableWaLeads
                .map((lead, i) => {
                  const leadKey = getLeadKey(lead);
                  const isSent = waSentStatus[lead.nome] || false;
                  const isActive = activeBulkLeadKey === leadKey;
                  const queueIndex = bulkQueue.findIndex(l => getLeadKey(l) === leadKey);
                  const previewText = renderWhatsAppMessage(lead);

                  return (
                    <div
                      key={i}
                      className={`p-4 rounded-xl border transition-all duration-300 ${
                        isActive
                          ? 'bg-green-950/20 border-green-500/30 shadow-[0_0_15px_rgba(34,197,94,0.15)] animate-pulse'
                          : 'bg-white/[0.02] border-white/5'
                      } flex flex-col gap-3`}
                    >
                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2">
                        <div className="flex items-start gap-3 min-w-0">
                          <input
                            type="checkbox"
                            className="rounded border-white/20 bg-black/40 text-green-500 focus:ring-0 cursor-pointer h-4 w-4 mt-0.5"
                            checked={selectedWaLeads.includes(leadKey)}
                            disabled={isSendingBulk}
                            onChange={() => handleToggleSelectWaLead(leadKey)}
                          />
                          <div className="min-w-0">
                            <div className="font-bold text-gray-200 text-sm">{lead.nome}</div>
                            <div className="text-xs text-gray-500 mt-0.5">{lead.nicho} · {lead.cidade}</div>
                          </div>
                        </div>
                        <span className="w-fit max-w-full break-all text-xs font-mono text-gray-400 bg-white/5 px-2 py-0.5 rounded border border-white/10">{lead.telefone}</span>
                      </div>

                      <div className="bg-black/50 border border-white/5 rounded-xl p-3 text-xs text-gray-400 font-sans italic leading-relaxed">
                        "{previewText}"
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <button
                          disabled={isSendingBulk && queueIndex < 0}
                          onClick={() => {
                            if (isSendingBulk) {
                              if (queueIndex >= 0) handleTriggerBulkSendLead(queueIndex);
                            } else {
                              openWhatsApp(lead, waTemplate);
                            }
                          }}
                          className={`w-full py-2.5 rounded-xl font-bold text-xs cursor-pointer border transition-all flex items-center justify-center gap-1.5 ${
                            isActive
                              ? 'bg-green-500 text-black border-green-400 hover:bg-green-400 font-extrabold'
                              : isSendingBulk && queueIndex < 0
                                ? 'bg-white/[0.02] border-white/5 text-gray-600 cursor-not-allowed'
                              : isSent
                                ? 'bg-green-500/10 border-green-500/30 text-green-400 hover:bg-green-500/20'
                                : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20 text-gray-200'
                          }`}
                        >
                          {isActive ? t('whatsapp.btnChatActive') : isSendingBulk && queueIndex < 0 ? t('whatsapp.btnOutQueue') : isSent ? t('whatsapp.btnResend') : t('whatsapp.btnDispatch')}
                        </button>
                        {chatbotSession?.status === 'connected' && (
                          <button
                            disabled={waSendingViaBot[leadKey]}
                            onClick={() => handleSendViaBot(lead)}
                            className={`w-full py-2.5 rounded-xl font-bold text-xs cursor-pointer border transition-all flex items-center justify-center gap-1.5 ${
                              waSendingViaBot[leadKey]
                                ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400 animate-pulse'
                                : 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20'
                            }`}
                          >
                            {waSendingViaBot[leadKey] ? '...' : t('whatsapp.btnSendBot')}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}

              {dispatchableWaLeads.length === 0 && (
                <div className="py-16 text-center text-gray-500">
                  <div className="text-3xl mb-3">💬</div>
                  <p className="font-semibold text-sm">{t('whatsapp.emptyLeads')}</p>
                </div>
              )}
            </div>
          </div>

          {/* HISTORICO DE MENSAGENS ENVIADAS VIA BOT */}
          {chatbotSession?.status === 'connected' && waSentMessages.length > 0 && (
            <div className="mt-6 app-card p-6 rounded-[2rem] bg-gradient-to-b from-white/[0.03] to-black/40 border border-white/10 shadow-2xl">
              <div className="flex items-center justify-between gap-3 mb-4">
                <h4 className="text-sm font-bold text-gray-200">{t('whatsapp.sentMessagesTitle')}</h4>
                <button
                  type="button"
                  onClick={handleLoadSentMessages}
                  className="text-[10px] px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400 cursor-pointer"
                >
                  {waSentMessagesLoading ? '...' : t('whatsapp.refresh')}
                </button>
              </div>
              <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                {waSentMessages.slice(0, 20).map((msg: WaSentMessage) => (
                  <div key={msg.id} className="p-3 rounded-xl bg-black/30 border border-white/5 text-xs">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="font-bold text-gray-200 truncate">{msg.lead_name}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                        msg.status === 'sent' ? 'bg-green-500/10 text-green-400' :
                        msg.status === 'failed' ? 'bg-red-500/10 text-red-400' :
                        'bg-gray-500/10 text-gray-400'
                      }`}>
                        {msg.status === 'sent' ? t('whatsapp.messageSent') : msg.status === 'failed' ? t('whatsapp.messageFailed') : msg.status}
                      </span>
                    </div>
                    <div className="text-gray-400 line-clamp-2">{msg.message}</div>
                    <div className="text-[10px] text-gray-500 mt-1">
                    {msg.sent_at ? new Date(msg.sent_at).toLocaleString(locale) : '—'}
                    {msg.error_message && <span className="text-red-400 ml-2">{t('whatsapp.error', { message: msg.error_message })}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
    </div>
  );
}
