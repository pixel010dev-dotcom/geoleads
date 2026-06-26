"use client";

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { getPlanById, getPlanIdFromTokens, getRequiredPlanForFeature, hasFeature, plans, type FeatureKey, type PlanId } from '@/lib/plans';
import Globe from '@/components/Globe';
import Toast, { showToast } from '@/components/Toast';
import DashboardCharts from '@/components/DashboardCharts';
import type { CrmLead, ExtractStats, WaSentMessage } from '@/types/crm';
import type { SearchLead } from '@/app/api/extract/lib/types';
import { getLeadKey, normalizeCrmLead, crmLeadToRow, crmRowToLead, tabFeatureMap, sampleCrmLeads, defaultChatbotRules, filterOptions, quickSearches, type DashboardTab } from '@/components/dashboard/dashboard-constants';
import { LockedFeaturePanel } from '@/components/dashboard/DashboardWidgets';
import ExtractorSection from '@/components/dashboard/ExtractorSection';
import CRMSection from '@/components/dashboard/CRMSection';

import { WhatsAppSection } from '@/components/dashboard/WhatsAppSection';
import { ChatbotSection } from '@/components/dashboard/ChatbotSection';
import AICopySection from '@/components/dashboard/AICopySection';
import SupportSection from '@/components/dashboard/SupportSection';
import { generatePdfReport } from '@/lib/pdf-report';
import OnboardingOverlay from '@/components/dashboard/OnboardingOverlay';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { useTranslations } from '@/lib/i18n';

function mergeEnrichmentIntoLead(lead: CrmLead, enriched: Record<string, any>): CrmLead {
  const merged = { ...lead, ...enriched };
  if (enriched.site_descoberto && (!merged.site || merged.site === 'Sem site')) {
    merged.site = enriched.site_descoberto;
  }
  return merged;
}

export default function Home() {
  const { t, locale } = useTranslations();
  const [activeTab, setActiveTab] = useState<DashboardTab>('extractor');
  const router = useRouter();

  const [keyword, setKeyword] = useState('');
  const [location, setLocation] = useState('');
  const [limit, setLimit] = useState<number | ''>(10);
  const [isExtracting, setIsExtracting] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [leads, setLeads] = useState<any[]>([]);
  const [extractStats, setExtractStats] = useState<ExtractStats | null>(null);
  const [filterRule, setFilterRule] = useState<string>('none');

  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);
  const [tokens, setTokens] = useState<number | null>(null);
  const [planId, setPlanId] = useState<PlanId>('free');

  const [crmLeads, setCrmLeads] = useState<CrmLead[]>([]);
  const [crmSearch, setCrmSearch] = useState('');
  const [crmFilterStage, setCrmFilterStage] = useState('all');
  const [selectedCrmLeads, setSelectedCrmLeads] = useState<string[]>([]);
  const [crmSyncStatus, setCrmSyncStatus] = useState<'local' | 'syncing' | 'cloud' | 'error'>('local');
  const [crmSyncMessage, setCrmSyncMessage] = useState('CRM local');
  const [crmPage, setCrmPage] = useState(0);
  const [chartRefreshKey, setChartRefreshKey] = useState(0);
  const [bulkStageLoading, setBulkStageLoading] = useState(false);
  const [bulkStageTarget, setBulkStageTarget] = useState('Novo');
  const CRM_PAGE_SIZE = 25;

  const [waTemplate, setWaTemplate] = useState('Olá {Nome}! Vi seu perfil comercial em {Cidade} e gostaria de saber se vocês têm interesse em receber mais clientes de {Nicho}. Podemos conversar?');
  const [waSentStatus, setWaSentStatus] = useState<Record<string, boolean>>({});
  const [isSendingBulk, setIsSendingBulk] = useState(false);
  const [isAutoSending, setIsAutoSending] = useState(false);
  const autoSendCancelled = useRef(false);
  const [bulkDelay, setBulkDelay] = useState('20');
  const [bulkSimulateHuman, setBulkSimulateHuman] = useState(true);
  const [bulkIndex, setBulkIndex] = useState(-1);
  const [bulkTimer, setBulkTimer] = useState(0);
  const [bulkAutoNext, setBulkAutoNext] = useState(false);
  const [selectedWaLeads, setSelectedWaLeads] = useState<string[]>([]);
  const [bulkQueue, setBulkQueue] = useState<any[]>([]);
  const [waAiProduct, setWaAiProduct] = useState('');
  const [waAiValue, setWaAiValue] = useState('');
  const [waAiTone, setWaAiTone] = useState('friendly');
  const [waAiCopies, setWaAiCopies] = useState<any[]>([]);
  const [waAiLoading, setWaAiLoading] = useState(false);
  const [waAiMessage, setWaAiMessage] = useState('');
  const [waSendingViaBot, setWaSendingViaBot] = useState<Record<string, boolean>>({});
  const [waSentMessages, setWaSentMessages] = useState<any[]>([]);
  const [waSentMessagesLoading, setWaSentMessagesLoading] = useState(false);
  const [waStats, setWaStats] = useState<any>(null);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [conversations, setConversations] = useState<any[]>([]);
  const [conversationsLoading, setConversationsLoading] = useState(false);

  const [chatbotEnabled, setChatbotEnabled] = useState(true);
  const [chatbotBusinessName, setChatbotBusinessName] = useState('GeoLeads');
  const [chatbotWelcomeMessage, setChatbotWelcomeMessage] = useState('Olá! Sou o assistente automático. Me diga como posso ajudar.');
  const [chatbotFallbackMessage, setChatbotFallbackMessage] = useState('Recebi sua mensagem. Um atendente vai continuar por aqui em breve.');
  const [chatbotRules, setChatbotRules] = useState(defaultChatbotRules);
  const [chatbotUseAI, setChatbotUseAI] = useState(true);
  const [chatbotAiInstructions, setChatbotAiInstructions] = useState('Você é um assistente de vendas amigável e profissional. Ajude clientes com dúvidas sobre serviços, agende reuniões e colete informações de contato.');
  const [chatbotSession, setChatbotSession] = useState<any>({ status: 'idle', repliedCount: 0 });
  const [chatbotAutoCapture, setChatbotAutoCapture] = useState(false);
  const [chatbotStats, setChatbotStats] = useState<any>(null);
  const [chatbotLoading, setChatbotLoading] = useState(false);
  const [chatbotMessage, setChatbotMessage] = useState('');
  const [chatbotPhoneNumber, setChatbotPhoneNumber] = useState('');

  const [aiProduct, setAiProduct] = useState('');
  const [aiValue, setAiValue] = useState('');
  const [aiTone, setAiTone] = useState('persuasive');
  const [generatedCopies, setGeneratedCopies] = useState<any[] | null>(null);
  const [isGeneratingCopies, setIsGeneratingCopies] = useState(false);

  const [supportRating, setSupportRating] = useState<number>(0);
  const [supportFeedback, setSupportFeedback] = useState('');
  const [supportSubmitted, setSupportSubmitted] = useState(false);
  const [hoveredStar, setHoveredStar] = useState<number | null>(null);
  const [checkoutNotice, setCheckoutNotice] = useState<string | null>(null);

  const [showHistory, setShowHistory] = useState(false);
  const [historyData, setHistoryData] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [showReferral, setShowReferral] = useState(false);
  const [referralBonus, setReferralBonus] = useState<number | null>(null);

  const [showOnboarding, setShowOnboarding] = useState(false);

  const dispatchableWaLeads = useMemo(
    () => crmLeads.filter(l => l.telefone && l.telefone !== 'Não informado'),
    [crmLeads]
  );

  const selectedWaDispatchableLeads = useMemo(
    () => dispatchableWaLeads.filter(l => selectedWaLeads.includes(getLeadKey(l))),
    [dispatchableWaLeads, selectedWaLeads]
  );

  const selectedWaCount = selectedWaDispatchableLeads.length;
  const activeBulkLeadKey = bulkQueue[bulkIndex] ? getLeadKey(bulkQueue[bulkIndex]) : null;
  const waPreviewLead = selectedWaDispatchableLeads[0] || dispatchableWaLeads[0] || {
    nome: 'Clínica Exemplo',
    telefone: '(11) 99999-0000',
    site: 'https://exemplo.com.br',
    cidade: 'São Paulo',
    nicho: 'Estética'
  };

  const currentPlan = getPlanById(planId);
  const activeTabFeature = tabFeatureMap[activeTab];
  const activeTabLocked = Boolean(activeTabFeature && !hasFeature(planId, activeTabFeature as FeatureKey));
  const requireFeature = (feature: FeatureKey) => hasFeature(planId, feature);
  const getUpgradePlan = (feature: FeatureKey) => getPlanById(getRequiredPlanForFeature(feature));

  const showLockedFeature = (feature: FeatureKey) => {
    const requiredPlan = getUpgradePlan(feature);
    showToast(t('lockedFeature.toast', { name: t(requiredPlan.nameKey) }), 'warning');
  };

  const getAuthedJsonHeaders = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) {
      router.push('/login');
      return null;
    }
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    };
  };

  const loadCrmFromCloud = async (userId: string) => {
    const { data, error } = await supabase
      .from('crm_leads')
      .select('*')
      .eq('user_id', userId)
      .order('saved_at', { ascending: false });
    if (error) throw error;
    return (data || []).map(crmRowToLead);
  };

  const syncCrmToCloud = async (updatedCrm: CrmLead[], targetUserId = user?.id) => {
    if (!targetUserId) {
      setCrmSyncStatus('local');
      setCrmSyncMessage('CRM local');
      return;
    }
    setCrmSyncStatus('syncing');
    setCrmSyncMessage('Sincronizando...');
    const rows = updatedCrm.map(lead => crmLeadToRow(lead, targetUserId));
    if (rows.length === 0) {
      setCrmSyncStatus('cloud');
      setCrmSyncMessage('CRM na nuvem');
      return;
    }
    const { error } = await supabase
      .from('crm_leads')
      .upsert(rows, { onConflict: 'user_id,lead_key' });
    if (error) {
      console.warn('CRM cloud sync failed:', error.message);
      setCrmSyncStatus('error');
      setCrmSyncMessage('Salvo localmente');
      return;
    }
    setCrmSyncStatus('cloud');
    setCrmSyncMessage('CRM na nuvem');
  };

  const deleteCrmFromCloud = async (leadKeys: string[], targetUserId = user?.id) => {
    if (!targetUserId || leadKeys.length === 0) return;
    const { error } = await supabase
      .from('crm_leads')
      .delete()
      .eq('user_id', targetUserId)
      .in('lead_key', leadKeys);
    if (error) {
      console.warn('CRM cloud delete failed:', error.message);
      setCrmSyncStatus('error');
      setCrmSyncMessage('Exclusão só local');
    }
  };

  const applyChatbotConfig = (config: any) => {
    setChatbotEnabled(config.enabled ?? true);
    setChatbotBusinessName(config.businessName || config.business_name || 'GeoLeads');
    setChatbotWelcomeMessage(config.welcomeMessage || config.welcome_message || 'Olá! Sou o assistente automático. Me diga como posso ajudar.');
    setChatbotFallbackMessage(config.fallbackMessage || config.fallback_message || 'Recebi sua mensagem. Um atendente vai continuar por aqui em breve.');
    setChatbotRules(Array.isArray(config.rules) && config.rules.length > 0 ? config.rules : defaultChatbotRules);
    if (config.useAI !== undefined) setChatbotUseAI(Boolean(config.useAI));
    if (config.aiInstructions) setChatbotAiInstructions(config.aiInstructions);
  };

  const getChatbotConfig = () => ({
    enabled: chatbotEnabled,
    businessName: chatbotBusinessName,
    welcomeMessage: chatbotWelcomeMessage,
    fallbackMessage: chatbotFallbackMessage,
    rules: chatbotRules,
    useAI: chatbotUseAI,
    aiInstructions: chatbotAiInstructions
  });

  const saveChatbotConfig = async (silent = false) => {
    const config = getChatbotConfig();
    try { localStorage.setItem('geoleads_chatbot_config', JSON.stringify(config)); } catch { /* ignore */ }
    let cloudSyncFailed = false;
    let runtimeSyncFailed = false;
    if (user?.id) {
      let upsertError = null;
      // Tenta salvar com campos de IA (podem não existir na tabela ainda)
      const { error } = await supabase
        .from('chatbot_configs')
        .upsert({
          user_id: user.id, enabled: config.enabled, business_name: config.businessName,
          welcome_message: config.welcomeMessage, fallback_message: config.fallbackMessage,
          rules: config.rules, use_ai: config.useAI, ai_instructions: config.aiInstructions
        }, { onConflict: 'user_id' });
      upsertError = error;
      // Fallback: se deu erro nos novos campos, tenta sem eles
      if (error && (error.message?.includes('use_ai') || error.message?.includes('ai_instructions'))) {
        const { error: fallbackError } = await supabase
          .from('chatbot_configs')
          .upsert({
            user_id: user.id, enabled: config.enabled, business_name: config.businessName,
            welcome_message: config.welcomeMessage, fallback_message: config.fallbackMessage,
            rules: config.rules
          }, { onConflict: 'user_id' });
        upsertError = fallbackError;
        if (!fallbackError) cloudSyncFailed = false;
      }
      if (upsertError) { console.warn('Chatbot config cloud sync failed:', upsertError.message); cloudSyncFailed = true; }
      // Save auto-capture setting
      await supabase.from('profiles').update({ chatbot_auto_capture: chatbotAutoCapture }).eq('id', user.id);
    }
    if (user?.id && ['connected', 'qr', 'connecting'].includes(chatbotSession.status)) {
      try { await callChatbotApi('update-config', config); } catch (error: any) { runtimeSyncFailed = true; }
    }
    if (!silent) {
      if (runtimeSyncFailed) setChatbotMessage('Configuração salva, mas o bot conectado não recebeu a atualização. Reconecte o QR.');
      else if (cloudSyncFailed) setChatbotMessage('Configuração salva localmente. Rode o SQL do Supabase para salvar na nuvem.');
      else if (['connected', 'qr', 'connecting'].includes(chatbotSession.status)) setChatbotMessage('Configuração salva e enviada para o bot conectado.');
      else setChatbotMessage('Configuração do chatbot salva.');
    }
  };

  const callChatbotApi = async (action: string, config = getChatbotConfig()) => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) { router.push('/login'); return null; }
    const res = await fetch('/api/chatbot', {
      method: action === 'status' ? 'GET' : 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: action === 'status' ? undefined : JSON.stringify({ action, config })
    });
    const payload = await res.json();
    if (!res.ok) throw new Error(payload.error || 'Erro no chatbot.');
    if (payload.session) setChatbotSession(payload.session);
    return payload;
  };

  const refreshChatbotStatus = async () => {
    if (!user) return;
    try { await callChatbotApi('status'); } catch (error: any) { setChatbotMessage(error.message); }
  };

  const handleConnectChatbot = async () => {
    if (!requireFeature('chatbot')) { setActiveTab('chatbot'); return; }
    setChatbotLoading(true);
    setChatbotMessage('');
    try {
      await saveChatbotConfig(true);
      await callChatbotApi('connect');
      setChatbotMessage('Conexão iniciada. Escaneie o QR Code quando aparecer.');
    } catch (error: any) { setChatbotMessage(error.message); }
    finally { setChatbotLoading(false); }
  };

  const handleDisconnectChatbot = async () => {
    setChatbotLoading(true);
    setChatbotMessage('');
    try { await callChatbotApi('disconnect'); setChatbotMessage('Chatbot desconectado.'); }
    catch (error: any) { setChatbotMessage(error.message); }
    finally { setChatbotLoading(false); }
  };

  const handleResetSession = async () => {
    setChatbotLoading(true);
    setChatbotMessage('');
    try {
      await callChatbotApi('reset_session');
      setChatbotMessage('Sessão resetada. Conecte novamente.');
    } catch (error: any) { setChatbotMessage(error.message); }
    finally { setChatbotLoading(false); }
  };

  const handlePairChatbot = async () => {
    if (!requireFeature('chatbot')) { setActiveTab('chatbot'); return; }
    const number = chatbotPhoneNumber.replace(/\D/g, '');
    if (number.length < 10 || number.length > 15) { setChatbotMessage('Digite um número válido com código do país (ex: 5511999999999)'); return; }
    setChatbotLoading(true);
    setChatbotMessage('');
    setChatbotSession((prev: any) => ({ ...prev, pairingCode: '' }));
    try {
      await saveChatbotConfig(true);
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) return;
      const res = await fetch('/api/chatbot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'pair', phoneNumber: number, config: getChatbotConfig() })
      });
      const result = await res.json();
      if (result.success && result.session) {
        setChatbotSession((prev: any) => ({ ...prev, ...result.session }));
        if (result.session.pairingCode) setChatbotMessage(`Código de pareamento: ${result.session.pairingCode}`);
      } else setChatbotMessage(result.error || 'Erro ao parear.');
    } catch (error: any) { setChatbotMessage(error.message); }
    finally { setChatbotLoading(false); }
  };

  const updateChatbotRule = (id: string, field: 'keyword' | 'response' | 'enabled', value: string | boolean) => {
    setChatbotRules(prev => prev.map(rule => rule.id === id ? { ...rule, [field]: value } : rule));
  };

  const addChatbotRule = () => {
    setChatbotRules(prev => [...prev, { id: `rule-${Date.now()}`, keyword: '', responseKey: 'default', enabled: true }]);
  };

  const removeChatbotRule = (id: string) => {
    setChatbotRules(prev => prev.filter(rule => rule.id !== id));
  };

  const applyProfileData = (profileData: any) => {
    const profileTokens = typeof profileData?.tokens === 'number'
      ? profileData.tokens
      : Number(profileData?.tokens || 10);
    setTokens(profileTokens);
    const savedPlanId = getPlanById(profileData?.planId || profileData?.plan_id).id;
    const inferredPlanId = getPlanIdFromTokens(profileTokens);
    setPlanId(plans[savedPlanId].tokens >= plans[inferredPlanId].tokens ? savedPlanId : inferredPlanId);

    const chatbotAutoCaptureValue = profileData?.chatbotAutoCapture ?? profileData?.chatbot_auto_capture;
    if (chatbotAutoCaptureValue !== undefined && chatbotAutoCaptureValue !== null) {
      setChatbotAutoCapture(Boolean(chatbotAutoCaptureValue));
    }
  };

  const refreshProfile = async (userId: string) => {
    try {
      const headers = await getAuthedJsonHeaders();
      if (headers) {
        const res = await fetch('/api/profile', { headers, cache: 'no-store' });
        const payload = await res.json().catch(() => null);
        if (res.ok && payload?.success && payload.profile) {
          applyProfileData(payload.profile);
          return payload.profile;
        }
        if (payload?.error) console.warn('Profile API failed:', payload.error);
      }
    } catch (error: any) {
      console.warn('Profile API request failed:', error.message);
    }

    const { data: profileData, error } = await supabase
      .from('profiles').select('tokens, plan_id').eq('id', userId).single();
    if (error || !profileData) return;
    try {
      const { data: availableTokens } = await supabase.rpc('get_available_tokens', {
        p_user_id: userId
      });
      setTokens(typeof availableTokens === 'number' ? availableTokens : profileData.tokens);
    } catch {
      setTokens(profileData.tokens);
    }
    const savedPlanId = getPlanById(profileData.plan_id).id;
    const inferredPlanId = getPlanIdFromTokens(profileData.tokens);
    setPlanId(plans[savedPlanId].tokens >= plans[inferredPlanId].tokens ? savedPlanId : inferredPlanId);
  };

  useEffect(() => {
    document.title = 'GeoLeads - Dashboard';
    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];

    const loadData = async () => {
      let sessionUserId = '';
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        sessionUserId = session.user.id;
        setUser(session.user);
        await refreshProfile(session.user.id);
      }
      const params = new URLSearchParams(window.location.search);
      const checkoutState = params.get('checkout');
      const purchasedPlanId = params.get('plan') as PlanId | null;
      if (checkoutState === 'success') {
        const planName = purchasedPlanId ? t(getPlanById(purchasedPlanId).nameKey) : t('checkout.yourPlan');
        setCheckoutNotice(`Pagamento recebido! Estamos liberando os tokens do plano ${planName}. Se o saldo não atualizar em 1 minuto, recarregue a página.`);
        if (sessionUserId) {
          await refreshProfile(sessionUserId);
          timers.push(setTimeout(() => { if (!cancelled) refreshProfile(sessionUserId); }, 4000));
          timers.push(setTimeout(() => { if (!cancelled) refreshProfile(sessionUserId); }, 12000));
        }
        params.delete('checkout'); params.delete('plan');
        const nextQuery = params.toString();
        const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ''}`;
        window.history.replaceState({}, '', nextUrl);
      }
      let localCrm: string | null = null;
      try { localCrm = localStorage.getItem('geoleads_crm'); } catch { localCrm = null; }
      let parsedCrm: any[] = [];
      if (localCrm) { try { parsedCrm = JSON.parse(localCrm).map(normalizeCrmLead); } catch(e) { console.error(e); } }
      let localChatbotConfig: string | null = null;
      try { localChatbotConfig = localStorage.getItem('geoleads_chatbot_config'); } catch { localChatbotConfig = null; }
      if (localChatbotConfig) { try { applyChatbotConfig(JSON.parse(localChatbotConfig)); } catch(e) { console.error(e); } }
      if (sessionUserId) {
        try {
          setCrmSyncStatus('syncing'); setCrmSyncMessage('Carregando nuvem...');
          const cloudCrm = await loadCrmFromCloud(sessionUserId);
          if (cloudCrm.length > 0) { parsedCrm = cloudCrm; try { localStorage.setItem('geoleads_crm', JSON.stringify(parsedCrm)); } catch { /* ignore */ } }
          else if (parsedCrm.length > 0) { await syncCrmToCloud(parsedCrm, sessionUserId); }
          else { setCrmSyncStatus('cloud'); setCrmSyncMessage('CRM na nuvem'); }
        } catch (error: any) { console.warn('CRM cloud load failed:', error.message); setCrmSyncStatus('error'); setCrmSyncMessage('Modo local'); }
        try {
          const { data: cloudChatbotConfig } = await supabase.from('chatbot_configs').select('*').eq('user_id', sessionUserId).maybeSingle();
          if (cloudChatbotConfig) {
            const config = {
              enabled: cloudChatbotConfig.enabled, businessName: cloudChatbotConfig.business_name,
              welcomeMessage: cloudChatbotConfig.welcome_message, fallbackMessage: cloudChatbotConfig.fallback_message,
              rules: cloudChatbotConfig.rules,
              useAI: cloudChatbotConfig.use_ai, aiInstructions: cloudChatbotConfig.ai_instructions
            };
            applyChatbotConfig(config);
            try { localStorage.setItem('geoleads_chatbot_config', JSON.stringify(config)); } catch { /* ignore */ }
          }
        } catch (error: any) { console.warn('Chatbot cloud config load failed:', error.message); }
      }
      if (!Array.isArray(parsedCrm) || parsedCrm.length === 0) {
        parsedCrm = sampleCrmLeads();
        try { localStorage.setItem('geoleads_crm', JSON.stringify(parsedCrm)); } catch { /* ignore */ }
      }
      setCrmLeads(parsedCrm);
      const dispatchable = parsedCrm.filter(l => l.telefone && l.telefone !== 'Não informado').map(getLeadKey);
      setSelectedWaLeads(dispatchable);
    };
    loadData();

    // Pending referral from signup
    let pendingRef: string | null = null;
    try { pendingRef = localStorage.getItem('pending_ref'); } catch { pendingRef = null; }
    if (pendingRef) {
      try { localStorage.removeItem('pending_ref'); } catch { /* ignore */ }
      (async () => {
        const h = await getAuthedJsonHeaders();
        if (!h) return;
        await fetch('/api/referral/link', { method: 'POST', headers: h, body: JSON.stringify({ ref: pendingRef }) });
      })();
    }

    // Onboarding check
    let onboardingDone = '';
    try { onboardingDone = localStorage.getItem('geoleads_onboarding_done') || ''; } catch { onboardingDone = ''; }
    if (!onboardingDone) {
      setShowOnboarding(true);
    }

    // Check for pending enrichment batches (retoma se o usuário saiu e voltou)
    (async () => {
      try {
        const h = await getAuthedJsonHeaders();
        if (!h) return;
        const res = await fetch('/api/lead-enrich/batch', { headers: h });
        const data = await res.json();
        if (data.success && data.status === 'running' && data.batchId) {
          setBatchEnrichProgress({
            total: data.total, completed: data.completed,
            failed: data.failed, percentage: data.percentage, status: data.status,
          });
          const appliedKeys = new Set<string>();
          const poll = setInterval(async () => {
            if (!mountedRef.current) { clearInterval(poll); return; }
            try {
              const pollRes = await fetch(`/api/lead-enrich/batch?batchId=${data.batchId}`, { headers: h });
              const pollData = await pollRes.json();
              if (pollData.success) {
                if (!mountedRef.current) { clearInterval(poll); return; }
                setBatchEnrichProgress({
                  total: pollData.total, completed: pollData.completed,
                  failed: pollData.failed, percentage: pollData.percentage, status: pollData.status,
                });
                // Aplica resultados em tempo real
                if (pollData.results) {
                  const newEnrichments: Record<string, any> = {};
                  pollData.results.forEach((r: any) => {
                    const rKey = r.leadKey || r.nome;
                    if (r.enriched && !appliedKeys.has(rKey)) {
                      newEnrichments[rKey] = r.enriched;
                      appliedKeys.add(rKey);
                    }
                  });
                  if (Object.keys(newEnrichments).length > 0) {
                    setCrmLeads(prev => {
                      const merged = prev.map(l => {
                        const key = getLeadKey(l);
                        return newEnrichments[key] ? mergeEnrichmentIntoLead(l, newEnrichments[key]) : l;
                      });
                      try { localStorage.setItem('geoleads_crm', JSON.stringify(merged.map(normalizeCrmLead))); } catch { /* ignore */ }
                      syncCrmToCloud(merged);
                      return merged;
                    });
                  }
                }
                if (pollData.status === 'completed' || pollData.status === 'failed') {
                  clearInterval(poll);
                  if (pollData.completed > 0) showToast(`${pollData.completed} leads enriquecidos!`, 'success');
                  setTimeout(() => setBatchEnrichProgress(null), 8000);
                }
              }
            } catch { clearInterval(poll); setBatchEnrichProgress(null); }
          }, 1200);
          batchPollRef.current = poll;
        }
      } catch { /* silence */ }
    })();

    return () => {
      cancelled = true;
      timers.forEach(t => clearTimeout(t));
    };
  }, []);

  useEffect(() => {
    if (activeTab !== 'chatbot' || !user || !requireFeature('chatbot')) return;
    refreshChatbotStatus();
    const interval = setInterval(refreshChatbotStatus, 5000);
    return () => clearInterval(interval);
  }, [activeTab, user, planId]);

  useEffect(() => {
    if (activeTab === 'whatsapp' && user && requireFeature('whatsappSender')) handleLoadSentMessages();
  }, [activeTab, user, planId]);

  useEffect(() => { setCrmPage(0); }, [crmSearch, crmFilterStage]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (batchPollRef.current) {
        clearInterval(batchPollRef.current);
        batchPollRef.current = null;
      }
    };
  }, []);

  const saveCrm = (updatedCrm: CrmLead[]) => {
    const normalized = updatedCrm.map(normalizeCrmLead);
    setCrmLeads(normalized);
    try { localStorage.setItem('geoleads_crm', JSON.stringify(normalized)); } catch { /* ignore */ }
    syncCrmToCloud(normalized);
  };

  const handleAddToCRM = (lead: any) => {
    if (!requireFeature('crm')) { setActiveTab('crm'); return; }
    const leadCidade = lead.cidade || location || 'Geral';
    const crmLeadKey = `${lead.nome || ''}|${lead.telefone || ''}|${leadCidade}`;
    const exists = crmLeads.some(l => getLeadKey(l) === crmLeadKey);
    if (exists) { showToast(`"${lead.nome}" já está no CRM.`, 'info'); return; }
    const newCrmLead = { ...lead, stage: 'Novo', notes: '', savedAt: new Date().toISOString(), nicho: keyword || 'Geral', cidade: leadCidade };
    const updated = [newCrmLead, ...crmLeads];
    saveCrm(updated);
    if (newCrmLead.telefone && newCrmLead.telefone !== 'Não informado') {
      setSelectedWaLeads(prev => prev.includes(crmLeadKey) ? prev : [crmLeadKey, ...prev]);
    }
    showToast(`"${lead.nome}" salvo no CRM! Enriquecendo dados...`, 'success');
    // Auto-enriquecimento em background
    (async () => {
      try {
        const headers = await getAuthedJsonHeaders();
        if (!headers) return;
        const res = await fetch('/api/lead-enrich', {
          method: 'POST', headers,
          body: JSON.stringify({ nome: lead.nome, site: lead.site, cidade: leadCidade, cnpj: lead.cnpj })
        });
        const data = await res.json();
        if (data.success && data.enriched) {
          setCrmLeads(prev => prev.map(l => getLeadKey(l) === crmLeadKey ? mergeEnrichmentIntoLead(l, data.enriched) : l));
        }
      } catch { /* silencio - enrichment e opcional */ }
    })();
  };

  const handleAddAllToCRM = () => {
    if (!requireFeature('crm')) { setActiveTab('crm'); return; }
    if (leads.length === 0) return;
    if (isAddingAllToCRM.current) return;
    isAddingAllToCRM.current = true;
    setTimeout(() => { isAddingAllToCRM.current = false; }, 5000);
    let addedCount = 0;
    const updated = [...crmLeads];
    const existingKeys = new Set(updated.map(getLeadKey));
    const newDispatchableKeys: string[] = [];
    const newlyAdded: any[] = [];
    leads.forEach(lead => {
      const leadCidade = lead.cidade || location || 'Geral';
      const extractionKey = `${lead.nome || ''}|${lead.telefone || ''}|${leadCidade}`;
      const exists = existingKeys.has(extractionKey);
      if (!exists) {
        const newLead = { ...lead, stage: 'Novo', notes: '', savedAt: new Date().toISOString(), nicho: keyword || 'Geral', cidade: leadCidade };
        updated.unshift(newLead);
        newlyAdded.push(newLead);
        if (newLead.telefone && newLead.telefone !== 'Não informado') newDispatchableKeys.push(getLeadKey(newLead));
        addedCount++;
      }
    });
    if (addedCount > 0) {
      saveCrm(updated);
      if (newDispatchableKeys.length > 0) setSelectedWaLeads(prev => Array.from(new Set([...newDispatchableKeys, ...prev])));
      showToast(`${addedCount} leads adicionados ao CRM! Enriquecendo...`, 'success');
      startBatchEnrichment(newlyAdded, (enrichments) => {
        setCrmLeads(prev => {
          const merged = prev.map(l => {
            const key = getLeadKey(l);
            return enrichments[key] ? mergeEnrichmentIntoLead(l, enrichments[key]) : l;
          });
          try { localStorage.setItem('geoleads_crm', JSON.stringify(merged.map(normalizeCrmLead))); } catch { /* ignore */ }
          syncCrmToCloud(merged);
          return merged;
        });
      });
    } else showToast('Todos esses leads já existem no CRM.', 'info');
  };

  const [batchEnrichProgress, setBatchEnrichProgress] = useState<{
    total: number; completed: number; failed: number; percentage: number; status: string;
  } | null>(null);

  const startBatchEnrichment = async (leadsToEnrich: any[], onLeadUpdate?: (results: Record<string, any>) => void) => {
    if (leadsToEnrich.length === 0) return;
    const h = await getAuthedJsonHeaders();
    if (!h) return;
    setBatchEnrichProgress({ total: leadsToEnrich.length, completed: 0, failed: 0, percentage: 0, status: 'running' });
    showToast(`Enriquecendo ${leadsToEnrich.length} leads...`, 'info');
    try {
      const res = await fetch('/api/lead-enrich/batch', {
        method: 'POST', headers: h,
        body: JSON.stringify({
          leads: leadsToEnrich.map((l: any) => ({
            nome: l.nome, site: l.site, cidade: l.cidade,
            cnpj: l.cnpj, email: l.email, instagram: l.instagram,
            facebook: l.facebook, tiktok: l.tiktok,
            leadKey: getLeadKey(l),
          }))
        }),
      });
      const data = await res.json();
      if (data.success && data.batchId) {
        const appliedKeys = new Set<string>();
        const poll = setInterval(async () => {
          if (!mountedRef.current) { clearInterval(poll); return; }
          try {
            const pollRes = await fetch(`/api/lead-enrich/batch?batchId=${data.batchId}`, { headers: h });
            const pollData = await pollRes.json();
            if (pollData.success) {
              if (!mountedRef.current) { clearInterval(poll); return; }
              setBatchEnrichProgress({
                total: pollData.total, completed: pollData.completed,
                failed: pollData.failed, percentage: pollData.percentage, status: pollData.status,
              });
              // Apply results in real-time as they arrive
              if (pollData.results && pollData.results.length > 0) {
                const newEnrichments: Record<string, any> = {};
                pollData.results.forEach((r: any) => {
                  const rKey = r.leadKey || r.nome;
                  if (r.enriched && !appliedKeys.has(rKey)) {
                    newEnrichments[rKey] = r.enriched;
                    appliedKeys.add(rKey);
                  }
                });
                if (Object.keys(newEnrichments).length > 0) {
                  onLeadUpdate?.(newEnrichments);
                }
              }
              if (pollData.status === 'completed' || pollData.status === 'failed') {
                clearInterval(poll);
                if (pollData.completed > 0) showToast(`${pollData.completed} leads enriquecidos!`, 'success');
                if (pollData.failed > 0) showToast(`${pollData.failed} leads falharam.`, 'info');
                setTimeout(() => setBatchEnrichProgress(null), 8000);
              }
            }
          } catch { clearInterval(poll); setBatchEnrichProgress(null); }
        }, 1200);
        batchPollRef.current = poll;
      } else {
        setBatchEnrichProgress(null);
        showToast('Erro ao iniciar enriquecimento.', 'error');
      }
    } catch { setBatchEnrichProgress(null); showToast('Erro de conexão no enriquecimento.', 'error'); }
  };

  const [enrichLoading, setEnrichLoading] = useState(false);

  const handleReEnrichSingle = async (lead: any) => {
    setEnrichLoading(true);
    try {
      const headers = await getAuthedJsonHeaders();
      if (!headers) return;
      const res = await fetch('/api/lead-enrich', {
        method: 'POST', headers,
        body: JSON.stringify({ nome: lead.nome, site: lead.site, cidade: lead.cidade, cnpj: lead.cnpj })
      });
      const data = await res.json();
      if (data.success && data.enriched) {
        const leadKey = getLeadKey(lead);
        const updated = crmLeads.map(l => getLeadKey(l) === leadKey ? mergeEnrichmentIntoLead(l, data.enriched) : l);
        saveCrm(updated);
      }
    } catch { /* silence */ }
    finally { setEnrichLoading(false); }
  };

  const handleReEnrichSelected = async () => {
    if (selectedCrmLeads.length === 0) return;
    setEnrichLoading(true);
    try {
      const headers = await getAuthedJsonHeaders();
      if (!headers) return;
      const selectedLeads = crmLeads.filter(l => selectedCrmLeads.includes(l.nome));
      const res = await fetch('/api/lead-enrich/batch', {
        method: 'POST', headers,
        body: JSON.stringify({
          leads: selectedLeads.map(l => ({
            nome: l.nome, site: l.site, cidade: l.cidade,
            cnpj: l.cnpj, email: l.email, instagram: l.instagram,
            facebook: l.facebook, tiktok: l.tiktok,
            leadKey: getLeadKey(l),
          }))
        }),
      });
      const data = await res.json();
      if (data.success && data.batchId) {
        // Poll for results
        const poll = setInterval(async () => {
          if (!mountedRef.current) { clearInterval(poll); return; }
          try {
            const pollRes = await fetch(`/api/lead-enrich/batch?batchId=${data.batchId}`, { headers });
            const pollData = await pollRes.json();
            if (pollData.status === 'completed' || pollData.status === 'failed') {
              clearInterval(poll);
              if (pollData.results) {
                setCrmLeads(prev => {
                  const updated = prev.map(l => {
                    const r = pollData.results.find((r: any) => (r.leadKey || r.nome) === getLeadKey(l));
                    return r?.enriched ? mergeEnrichmentIntoLead(l, r.enriched) : l;
                  });
                  try { localStorage.setItem('geoleads_crm', JSON.stringify(updated.map(normalizeCrmLead))); } catch { /* ignore */ }
                  syncCrmToCloud(updated);
                  return updated;
                });
              }
              showToast(`${pollData.completed} leads enriquecidos!`, 'success');
              setEnrichLoading(false);
            }
          } catch { clearInterval(poll); setEnrichLoading(false); }
        }, 1500);
        batchPollRef.current = poll;
      } else {
        setEnrichLoading(false);
        showToast(data.error || 'Erro no enrichment em lote.', 'error');
      }
    } catch {
      setEnrichLoading(false);
      showToast('Erro ao enriquecer leads selecionados.', 'error');
    }
  };

  const handleRemoveFromCRM = (nome: string, telefone?: string, cidade?: string) => {
    const removedLead = crmLeads.find(l => l.nome === nome && (!telefone || l.telefone === telefone) && (!cidade || l.cidade === cidade));
    const targetKey = removedLead ? getLeadKey(removedLead) : `${nome}|${telefone || ''}|${cidade || ''}`;
    const updated = crmLeads.filter(l => getLeadKey(l) !== targetKey);
    saveCrm(updated);
    setSelectedCrmLeads(prev => prev.filter(n => n !== nome));
    if (removedLead) {
      setSelectedWaLeads(prev => prev.filter(key => key !== targetKey));
      deleteCrmFromCloud([targetKey]);
    }
  };

  const handleToggleSelectCrmLead = (nome: string) => {
    setSelectedCrmLeads(prev => prev.includes(nome) ? prev.filter(n => n !== nome) : [...prev, nome]);
  };

  const handleToggleSelectWaLead = (leadKey: string) => {
    if (isSendingBulk) return;
    setSelectedWaLeads(prev => prev.includes(leadKey) ? prev.filter(key => key !== leadKey) : [...prev, leadKey]);
  };

  const handleToggleSelectAllWaLeads = (dispatchable: any[]) => {
    if (isSendingBulk) return;
    const allKeys = dispatchable.map(getLeadKey);
    const areAllSelected = allKeys.every(key => selectedWaLeads.includes(key));
    if (areAllSelected) setSelectedWaLeads(prev => prev.filter(key => !allKeys.includes(key)));
    else setSelectedWaLeads(prev => Array.from(new Set([...prev, ...allKeys])));
  };

  const handleToggleSelectAllCrmLeads = (filteredLeads: any[]) => {
    const allFilteredNames = filteredLeads.map(l => l.nome);
    const areAllSelected = allFilteredNames.every(name => selectedCrmLeads.includes(name));
    if (areAllSelected) setSelectedCrmLeads(prev => prev.filter(name => !allFilteredNames.includes(name)));
    else setSelectedCrmLeads(prev => Array.from(new Set([...prev, ...allFilteredNames])));
  };

  const handleRemoveSelectedFromCRM = () => {
    if (selectedCrmLeads.length === 0) return;
    const removedKeys = crmLeads.filter(l => selectedCrmLeads.includes(l.nome)).map(getLeadKey);
    const updated = crmLeads.filter(l => !selectedCrmLeads.includes(l.nome));
    saveCrm(updated);
    setSelectedCrmLeads([]);
    setSelectedWaLeads(prev => prev.filter(key => !removedKeys.includes(key)));
    deleteCrmFromCloud(removedKeys);
    showToast(`${selectedCrmLeads.length} leads removidos do CRM.`, 'success');
  };

  const handleBulkStageChange = async () => {
    if (selectedCrmLeads.length === 0 || bulkStageLoading) return;
    setBulkStageLoading(true);
    const updated = crmLeads.map(l => selectedCrmLeads.includes(l.nome) ? { ...l, stage: bulkStageTarget } : l);
    saveCrm(updated);
    setBulkStageLoading(false);
    showToast(`${selectedCrmLeads.length} leads movidos para "${bulkStageTarget}"`, 'success');
  };

  const finishBulkQueue = () => {
    setIsSendingBulk(false); setIsAutoSending(false); autoSendCancelled.current = false;
    setBulkIndex(-1); setBulkTimer(0); setBulkQueue([]);
  };

  const handleStopBulkSending = () => { autoSendCancelled.current = true; finishBulkQueue(); };

  const handleStartBulkSending = () => {
    const queue = selectedWaDispatchableLeads;
    if (queue.length === 0) { showToast('Nenhum lead com telefone selecionado.', 'warning'); return; }
    setBulkQueue(queue); setIsSendingBulk(true);
    handleTriggerBulkSendLead(0, queue);
  };

  const handleTriggerBulkSendLead = (index: number, queueOverride?: any[]) => {
    const queue = queueOverride || bulkQueue;
    if (index < 0 || index >= queue.length) return;
    const lead = queue[index];
    setBulkIndex(index);
    let delay = getSafeBulkDelay();
    if (bulkSimulateHuman) { delay = Math.max(10, delay + Math.floor(Math.random() * 9) - 4); }
    setBulkTimer(bulkAutoNext ? delay : 0);
    openWhatsApp(lead, waTemplate, {
      markSent: false, preferWeb: true,
      target: /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ? '_blank' : 'geoleads_whatsapp_queue',
    });
  };

  const handleConfirmSentAndNext = () => {
    if (!isSendingBulk || bulkIndex < 0 || !bulkQueue[bulkIndex]) return;
    const lead = bulkQueue[bulkIndex];
    setWaSentStatus(prev => ({ ...prev, [lead.nome]: true }));
    const nextIndex = bulkIndex + 1;
    if (nextIndex < bulkQueue.length) handleTriggerBulkSendLead(nextIndex);
    else { showToast('Fila concluída! Todos os contatos enviados.', 'success'); finishBulkQueue(); }
  };

  const getSafeBulkDelay = () => {
    if (bulkDelay.trim() === '') return 20;
    const value = Number(bulkDelay);
    if (!Number.isFinite(value)) return 20;
    return Math.min(120, Math.max(10, value));
  };

  const handleStartAutoBulkSend = async () => {
    const queue = selectedWaDispatchableLeads;
    if (queue.length === 0) { showToast('Nenhum lead com telefone selecionado.', 'warning'); return; }
    if (chatbotSession.status !== 'connected') { showToast('Conecte o WhatsApp no Chatbot primeiro!', 'warning'); setActiveTab('chatbot'); return; }
    setBulkQueue(queue); setIsSendingBulk(true); setIsAutoSending(true); setBulkAutoNext(true);
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return;
    for (let i = 0; i < queue.length; i++) {
      if (autoSendCancelled.current) break;
      const lead = queue[i];
      setBulkIndex(i);
      const delay = getSafeBulkDelay();
      const finalDelay = Math.max(5, delay + Math.floor(Math.random() * 9) - 4);
      const message = renderWhatsAppMessage(lead);
      try {
        const res = await fetch('/api/chatbot/send', {
          method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ leadName: lead.nome, leadPhone: lead.telefone, message, leadKey: getLeadKey(lead) })
        });
        if (res.ok) setWaSentStatus(prev => ({ ...prev, [lead.nome]: true }));
        else { const err = await res.json(); showToast(`Falha ao enviar para ${lead.nome}: ${err.error || 'erro'}`, 'error'); }
      } catch { showToast(`Erro ao enviar para ${lead.nome}`, 'error'); }
      if (i < queue.length - 1) {
        const waitSteps = Math.ceil(finalDelay / 0.5);
        for (let w = 0; w < waitSteps; w++) { if (autoSendCancelled.current) break; await new Promise(r => setTimeout(r, 500)); }
        if (autoSendCancelled.current) break;
      }
    }
    showToast(`Disparo automático concluído! ${queue.length} mensagens enviadas.`, 'success');
    finishBulkQueue();
    handleLoadSentMessages();
  };

  const handleSendViaBot = async (lead: any) => {
    if (!requireFeature('whatsappSender')) { setActiveTab('whatsapp'); return; }
    if (!lead.telefone || lead.telefone === 'Não informado') return;
    const leadKey = getLeadKey(lead);
    if (waSendingViaBot[leadKey]) return;
    setWaSendingViaBot(prev => ({ ...prev, [leadKey]: true }));
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) return;
      const message = renderWhatsAppMessage(lead);
      const res = await fetch('/api/chatbot/send', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ leadName: lead.nome, leadPhone: lead.telefone, message, leadId: lead.id })
      });
      if (res.ok) { setWaSentStatus(prev => ({ ...prev, [lead.nome]: true })); handleLoadSentMessages(); }
      else { const err = await res.json(); showToast(err.error || 'Falha ao enviar via bot.', 'error'); }
    } catch (err: any) { showToast('Erro ao enviar: ' + (err.message || 'desconhecido'), 'error'); }
    finally { setWaSendingViaBot(prev => ({ ...prev, [leadKey]: false })); }
  };

  const handleLoadSentMessages = async () => {
    if (!user || !requireFeature('whatsappSender')) return;
    setWaSentMessagesLoading(true);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) return;
      const res = await fetch('/api/chatbot/messages', { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json();
      if (json.success) setWaSentMessages(json.messages || []);
    } catch (e) { console.error(e); } finally { setWaSentMessagesLoading(false); }
  };

  const handleLoadWaStats = async () => {
    if (!user) return;
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) return;
      const res = await fetch('/api/chatbot/stats', { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json();
      if (json.success) setWaStats(json.stats);
    } catch (e) { console.error(e); }
  };

  const handleLoadCampaigns = async () => {
    if (!user) return;
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) return;
      const res = await fetch('/api/chatbot/campaign', { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json();
      if (json.success) setCampaigns(json.campaigns || []);
    } catch (e) { console.error(e); }
  };

  const handleCreateCampaign = async () => {
    if (!scheduleDate || !scheduleTime || !waTemplate) { showToast('Preencha data, hora e mensagem.', 'warning'); return; }
    const selected = selectedWaDispatchableLeads;
    if (selected.length === 0) { showToast('Selecione leads para a campanha.', 'warning'); return; }
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) return;
      const scheduledAt = new Date(`${scheduleDate}T${scheduleTime}:00`).toISOString();
      const res = await fetch('/api/chatbot/campaign', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'create', name: `Campanha ${new Date().toLocaleDateString(locale === 'en' ? 'en-US' : 'pt-BR')}`, messageTemplate: waTemplate, leadKeys: selected.map(getLeadKey), scheduledAt }),
      });
      const json = await res.json();
      if (json.success) { showToast('Campanha agendada!', 'success'); handleLoadCampaigns(); }
      else showToast(json.error || 'Erro ao criar campanha.', 'error');
    } catch (e) { console.error(e); }
  };

  const handleLoadConversations = async () => {
    if (!user) return;
    setConversationsLoading(true);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) return;
      const res = await fetch('/api/chatbot/conversations?limit=30', { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json();
      if (json.success) setConversations(json.conversations || []);
    } catch (e) { console.error(e); } finally { setConversationsLoading(false); }
  };

  const handleLoadChatbotStats = async () => {
    if (!user) return;
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) return;
      const res = await fetch('/api/chatbot/stats', { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json();
      if (json.success) setChatbotStats(json.stats);
    } catch (e) { console.error(e); }
  };

  const handleUpdateCRMLead = (nome: string, field: 'stage' | 'notes' | 'tags', value: string, telefone?: string, cidade?: string) => {
    const updated = crmLeads.map(l => l.nome === nome && (!telefone || l.telefone === telefone) && (!cidade || l.cidade === cidade) ? { ...l, [field]: field === 'tags' ? value.split(',').filter(Boolean) : value } : l);
    saveCrm(updated);
  };

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const currentJobIdRef = useRef<string | null>(null);
  const pollCountRef = useRef(0);
  const pollStartTimeRef = useRef(0);
  const mountedRef = useRef(true);
  const batchPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const crmLeadsRef = useRef(crmLeads);
  const isAddingAllToCRM = useRef(false);

  useEffect(() => { crmLeadsRef.current = crmLeads; }, [crmLeads]);

  const startPolling = (jobId: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
    currentJobIdRef.current = jobId;
    pollCountRef.current = 0;
    pollStartTimeRef.current = Date.now();
    try { localStorage.setItem('lastJobId', jobId); } catch { /* ignore */ }
    pollRef.current = setInterval(async () => {
      if (currentJobIdRef.current !== jobId) return;
      pollCountRef.current++;

      if (pollCountRef.current > 200 || (Date.now() - pollStartTimeRef.current) > 600000) {
        setIsExtracting(false);
        setHasSearched(true);
        if (pollRef.current) clearInterval(pollRef.current);
        try { localStorage.removeItem('lastJobId'); } catch { /* ignore */ }
        showToast('Extração expirou. Tente novamente.', 'error');
        try {
          const headers = await getAuthedJsonHeaders();
          if (headers) await fetch(`/api/extract/cancel`, { method: 'POST', headers, body: JSON.stringify({ jobId }) });
        } catch { /* ignore */ }
        return;
      }

      try {
        const headers = await getAuthedJsonHeaders();
        if (!headers) return;
        const res = await fetch(`/api/extract/job/${jobId}`, { headers });
        const data = await res.json();
        if (data.success && data.job) {
          const j = data.job;
          setExtractStats({
            total: j.leads_count,
            scanned: j.scanned,
            cities_scanned: j.cities_scanned,
            time: j.search_time_seconds,
            correctedKeyword: j.keyword,
            correctedLocation: j.location,
            message: j.message,
          });
          if (j.status === 'completed') {
            if (j.delivered) {
              setLeads(j.leads || []);
              setHasSearched(true);
              const leadCount = j.leads?.length || 0;
              if (leadCount > 0) {
                showToast(`Extração concluída! ${leadCount} leads encontrados. Revise e clique em "Salvar no CRM".`, 'success');
              }
            } else {
              setHasSearched(true);
            }
            setIsExtracting(false);
            if (pollRef.current) clearInterval(pollRef.current);
            try { localStorage.removeItem('lastJobId'); } catch { /* ignore */ }
            if (user?.id) refreshProfile(user.id);
          } else if (j.status === 'running') {
            setHasSearched(false);
          } else if (j.status === 'failed' || j.status === 'cancelled') {
            if (currentJobIdRef.current !== jobId) return;
            setIsExtracting(false);
            setHasSearched(true);
            if (pollRef.current) clearInterval(pollRef.current);
            try { localStorage.removeItem('lastJobId'); } catch { /* ignore */ }
            if (j.status === 'failed') showToast("Erro: " + (j.error || 'Falha na extração'), 'error');
          }
        }
      } catch (e) { console.error(e); }
    }, 3000);
  };

  const handleExtract = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) { router.push('/login'); return; }
    const selectedFilters = filterRule.split(',').map(s => s.trim()).filter(Boolean);
    for (const f of selectedFilters) {
      const opt = filterOptions.find(o => o.value === f);
      if (opt && !requireFeature(opt.feature)) { showLockedFeature(opt.feature); return; }
    }
    if (tokens !== null && Number(limit) > tokens) { showToast(`Saldo insuficiente! Pediu ${limit} leads mas tem ${tokens} tokens.`, 'error'); return; }
    setIsExtracting(true); setHasSearched(false); setLeads([]); setExtractStats(null);
    const existingLeadKeys = crmLeads.map(l => getLeadKey(l)).filter(Boolean);
    try {
      const headers = await getAuthedJsonHeaders();
      if (!headers) return;
      const res = await fetch('/api/extract', {
        method: 'POST', headers,
        body: JSON.stringify({ keyword, location, limit: Number(limit), filterRule, existingLeadKeys })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao extrair leads.');
      if (data.success && data.jobId) {
        startPolling(data.jobId);
      } else {
        throw new Error(data.error || 'Erro desconhecido');
      }
    } catch (err: any) {
      showToast("Erro: " + (err.message || 'Erro inesperado ao extrair leads'), 'error');
      setIsExtracting(false);
      setHasSearched(true);
    }
  };

  // Recuperar job pendente ao carregar a página
  useEffect(() => {
    let lastJobId: string | null = null;
    try { lastJobId = localStorage.getItem('lastJobId'); } catch { lastJobId = null; }
    if (lastJobId && !isExtracting) {
      (async () => {
        try {
          const headers = await getAuthedJsonHeaders();
          if (!headers) return;
          const res = await fetch(`/api/extract/job/${lastJobId}`, { headers });
          const data = await res.json();
          if (data.success && data.job) {
            const j = data.job;
            const startedAt = j.started_at ? new Date(j.started_at).getTime() : 0;
            const isStale = startedAt > 0 && (Date.now() - startedAt) > 300000;
            if (isStale && (j.status === 'running' || j.status === 'pending')) {
              try { localStorage.removeItem('lastJobId'); } catch { /* ignore */ }
              try {
                await fetch('/api/extract/cancel', { method: 'POST', headers, body: JSON.stringify({ jobId: lastJobId }) });
              } catch { /* ignore */ }
              return;
            }
            if (j.status === 'running' || j.status === 'pending') {
              setIsExtracting(true);
              setHasSearched(false);
              setLeads([]);
              setExtractStats(null);
              startPolling(lastJobId);
            } else {
              try { localStorage.removeItem('lastJobId'); } catch { /* ignore */ }
            }
          }
        } catch (e) { console.error(e); try { localStorage.removeItem('lastJobId'); } catch { /* ignore */ } }
      })();
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  const cancelExtraction = async () => {
    const jobId = currentJobIdRef.current;
    if (!jobId) return;
    try {
      const headers = await getAuthedJsonHeaders();
      if (!headers) return;
      const res = await fetch('/api/extract/cancel', {
        method: 'POST', headers,
        body: JSON.stringify({ jobId })
      });
      const data = await res.json();
      if (data.success) {
        showToast('Extração cancelada. Tokens reembolsados.', 'info');
        if (user?.id) refreshProfile(user.id);
      } else {
        showToast(data.error || 'Erro ao cancelar extração.', 'error');
      }
    } catch (e) { console.error(e); }
    if (pollRef.current) clearInterval(pollRef.current);
    setIsExtracting(false);
    setHasSearched(true);
    try { localStorage.removeItem('lastJobId'); } catch { /* ignore */ }
  };

  const logout = async () => { await supabase.auth.signOut(); router.push('/login'); };

  const fetchHistory = async () => {
    setHistoryLoading(true); setShowHistory(true);
    try {
      const headers = await getAuthedJsonHeaders();
      if (!headers) return;
      const res = await fetch('/api/extract/history', { headers });
      const data = await res.json();
      if (data.success) setHistoryData(data.history || []);
    } catch (e) { console.error(e); } finally { setHistoryLoading(false); }
  };

  const exportToCSV = () => {
    if (!requireFeature('export')) { showLockedFeature('export'); return; }
    if (leads.length === 0) return;
    const esc = (v: string) => `"${(v || '').replace(/"/g, '""')}"`;
    const csvHeaders = [t('crm.csvName'), t('crm.csvPhone'), t('crm.csvEmail'), t('crm.csvCnpj'), t('crm.csvRating'), t('crm.csvInstagram'), t('crm.csvFacebook'), t('crm.csvTiktok'), t('crm.csvSite')];
    const csvContent = [csvHeaders.join(','), ...leads.map(l => [esc(l.nome), esc(l.telefone), esc(l.email), esc(l.cnpj), esc(l.avaliacao), esc(l.instagram), esc(l.facebook), esc(l.tiktok), esc(l.site)].join(','))].join('\n');
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `GeoLeads_${keyword}_${new Date().toLocaleDateString(locale === 'en' ? 'en-US' : 'pt-BR')}.csv`;
    link.click();
  };

  const exportToXLSX = async () => {
    if (!requireFeature('export')) { showLockedFeature('export'); return; }
    if (leads.length === 0) return;
    try {
      const headers = await getAuthedJsonHeaders();
      if (!headers) return;
      const res = await fetch('/api/export/xlsx', {
        method: 'POST', headers,
        body: JSON.stringify({ leads, filename: `GeoLeads_${keyword}_${new Date().toLocaleDateString(locale === 'en' ? 'en-US' : 'pt-BR')}.xlsx` })
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Erro ao exportar XLSX'); }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `GeoLeads_${keyword}_${new Date().toLocaleDateString(locale === 'en' ? 'en-US' : 'pt-BR')}.xlsx`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err: any) { showToast(err.message || 'Erro ao exportar XLSX', 'error'); }
  };

  const renderWhatsAppMessage = (lead: any, template = waTemplate) => {
    return template
      .replace(/{Nome}/g, lead.nome || 'seu negócio')
      .replace(/{Telefone}/g, lead.telefone || '(00) 00000-0000')
      .replace(/{Site}/g, lead.site || 'Sem site')
      .replace(/{Cidade}/g, lead.cidade || location || 'sua região')
      .replace(/{Nicho}/g, lead.nicho || keyword || 'comércio');
  };

  const appendWaTag = (tag: string) => {
    setWaTemplate(prev => {
      const spacer = prev.length === 0 || prev.endsWith(' ') || prev.endsWith('\n') ? '' : ' ';
      return `${prev}${spacer}${tag}`;
    });
  };

  const generateWaAiTemplates = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requireFeature('aiCopy')) { setActiveTab('ia'); return; }
    if (!waAiProduct || !waAiValue) { setWaAiMessage('Preencha a oferta e o principal benefício para gerar modelos.'); return; }
    setWaAiLoading(true); setWaAiMessage(''); setWaAiCopies([]);
    try {
      const headers = await getAuthedJsonHeaders();
      if (!headers) return;
      const res = await fetch('/api/ai-copy', {
        method: 'POST', headers,
        body: JSON.stringify({ product: waAiProduct, value: waAiValue, tone: waAiTone, channel: 'whatsapp', audience: keyword || waPreviewLead.nicho || 'empresas locais' })
      });
      const data = await res.json();
      if (!data.success || !data.copies) throw new Error(data.error || 'Erro inesperado.');
      setWaAiCopies(data.copies);
      setWaAiMessage(data.source === 'gemini_ai' ? `Modelos gerados com IA (${data.model}).` : data.warning || 'Modelos locais gerados sem custo de API.');
    } catch (error: any) { setWaAiMessage(error.message || 'Erro ao gerar modelos.'); }
    finally { setWaAiLoading(false); }
  };

  const openWhatsApp = (lead: any, customText?: string, options?: { markSent?: boolean; preferWeb?: boolean; target?: string }) => {
    if (!requireFeature('whatsappSender')) { setActiveTab('whatsapp'); return; }
    if (!lead.telefone || lead.telefone === 'Não informado') { showToast('Lead sem telefone válido.', 'warning'); return; }
    const number = lead.telefone.replace(/\D/g, '');
    if (number.length < 10) { showToast('Número de telefone inválido.', 'warning'); return; }
    let msg = customText ? renderWhatsAppMessage(lead, customText) : `Olá! Vi o perfil da *${lead.nome}* no Google e gostaria de saber mais sobre os serviços de vocês. Podemos conversar?`;
    const messageEncoded = encodeURIComponent(msg);
    const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
    const url = options?.preferWeb && !isMobile ? `https://web.whatsapp.com/send?phone=${number}&text=${messageEncoded}` : `https://wa.me/${number}?text=${messageEncoded}`;
    window.open(url, options?.target || '_blank', 'noopener,noreferrer');
    if (options?.markSent !== false) setWaSentStatus(prev => ({ ...prev, [lead.nome]: true }));
  };

  const generateAICopies = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requireFeature('aiCopy')) { setActiveTab('ia'); return; }
    if (!aiProduct || !aiValue) { showToast('Preencha os campos para gerar copys.', 'warning'); return; }
    setIsGeneratingCopies(true); setGeneratedCopies(null);
    try {
      const headers = await getAuthedJsonHeaders();
      if (!headers) return;
      const res = await fetch('/api/ai-copy', {
        method: 'POST', headers,
        body: JSON.stringify({ product: aiProduct, value: aiValue, tone: aiTone, channel: 'mixed' })
      });
      const data = await res.json();
      if (data.success && data.copies) setGeneratedCopies(data.copies);
      else showToast('Erro ao gerar roteiros: ' + (data.error || 'Erro inesperado.'), 'error');
    } catch (err: any) { console.error(err); showToast('Erro de conexão ao gerar roteiros.', 'error'); }
    finally { setIsGeneratingCopies(false); }
  };

  const filteredCrmLeads = crmLeads.filter(lead => {
    const matchesSearch = lead.nome.toLowerCase().includes(crmSearch.toLowerCase()) || lead.telefone.toLowerCase().includes(crmSearch.toLowerCase()) || lead.email?.toLowerCase().includes(crmSearch.toLowerCase()) || lead.cnpj?.toLowerCase().includes(crmSearch.toLowerCase()) || lead.nicho.toLowerCase().includes(crmSearch.toLowerCase()) || lead.cidade.toLowerCase().includes(crmSearch.toLowerCase());
    if (crmFilterStage === 'all') return matchesSearch;
    return matchesSearch && lead.stage === crmFilterStage;
  });

  const crmTotalPages = Math.max(1, Math.ceil(filteredCrmLeads.length / CRM_PAGE_SIZE));
  const safeCrmPage = Math.min(crmPage, crmTotalPages - 1);
  const paginatedCrmLeads = filteredCrmLeads.slice(safeCrmPage * CRM_PAGE_SIZE, (safeCrmPage + 1) * CRM_PAGE_SIZE);
  const displayLeads = leads.length > 0 ? leads : [];

  if (!user) {
    return (
      <div className="app-shell min-h-screen text-white font-sans bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400 mx-auto mb-4"></div>
          <p className="text-gray-400">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell min-h-screen text-white font-sans selection:bg-blue-500/30 relative pb-12 sm:pb-16 overflow-x-hidden">
      <Toast />
      <div className="absolute inset-0 bg-grid-pattern pointer-events-none opacity-40" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[min(720px,92vw)] h-[260px] bg-blue-700/10 blur-[90px] rounded-full pointer-events-none" />

      <nav className="border-b border-white/5 bg-black/40 backdrop-blur-2xl sticky top-0 z-50">
        <div className="app-container min-h-16 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 sm:gap-3 group cursor-default min-w-fit">
            <Globe size={32} />
            <span className="font-extrabold text-xl sm:text-2xl tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">Geo<span className="text-blue-400">Leads</span></span>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2.5 sm:gap-4 text-xs sm:text-sm">
            {user ? (
              <>
                <div className="px-2.5 py-1 sm:px-4 sm:py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-300 font-bold whitespace-nowrap">
                  💰 {tokens !== null ? tokens.toLocaleString(locale === 'en' ? 'en-US' : 'pt-BR') : '...'} <span className="hidden sm:inline">{t('dashboard.tokens')}</span>
                </div>
                <div className="px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-full bg-white/5 border border-white/10 text-gray-300 font-bold whitespace-nowrap">
                  {t(currentPlan.shortNameKey)}
                </div>
                <LanguageSwitcher />
                <Link href="/account" className="text-gray-400 hover:text-white transition-colors font-medium">{t('nav.account')}</Link>
                <Link href="/pricing" className="text-gray-400 hover:text-white transition-colors font-medium">{t('nav.plans')}</Link>
                <button onClick={logout} className="text-red-400 hover:text-red-300 font-medium cursor-pointer">{t('nav.logout')}</button>
              </>
            ) : (
              <>
                <div className="hidden sm:flex px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-full bg-white/5 border border-white/10 items-center gap-1.5 text-[11px] sm:text-xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse shadow-[0_0_8px_rgba(74,222,128,0.8)]" />
                  <span className="hidden sm:inline">{t('nav.engineOnline')}</span>
                </div>
                <Link href="/login" className="px-3.5 py-1.5 sm:px-5 sm:py-2 rounded-full bg-white text-black font-semibold hover:bg-gray-200 transition-all text-xs sm:text-sm shadow-[0_0_15px_rgba(255,255,255,0.2)]">
                  {t('nav.login')}
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      <main className="app-container py-6 sm:py-10 lg:py-12 relative z-10">
        {checkoutNotice && (
          <div className="mb-5 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <p className="text-sm text-emerald-100 leading-relaxed">{checkoutNotice}</p>
            <button type="button" onClick={() => setCheckoutNotice(null)} className="self-end sm:self-auto px-3 py-1.5 rounded-lg bg-white/10 border border-white/15 text-xs text-gray-200 hover:text-white cursor-pointer">{t('dashboard.close')}</button>
          </div>
        )}

        <header className="mb-6 sm:mb-8">
          <div className="dashboard-hero">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-300 text-xs font-bold mb-4">
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                {t('dashboard.ready')}
              </div>
              <h1 className="text-2xl sm:text-4xl md:text-5xl font-extrabold tracking-tight mb-3 sm:mb-4 leading-tight max-w-4xl">
                {t('dashboard.heroTitle')}
              </h1>
              <p className="text-gray-400 text-sm sm:text-base md:text-lg max-w-2xl leading-relaxed">
                {t('dashboard.heroSubtitle')}
              </p>
            </div>
          </div>
          <DashboardCharts tokens={tokens ?? 0} leads={crmLeads} planName={t(currentPlan.nameKey)} />

          <div className="flex items-center gap-2 sm:gap-3 mb-6 overflow-x-auto max-w-full">
            <div className="app-tabs dashboard-tabs flex gap-1 flex-shrink-0 items-center">
              <button onClick={() => setActiveTab('extractor')}
                className={`app-tab px-3.5 py-2 sm:px-5 sm:py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${activeTab === 'extractor' ? 'bg-blue-600/20 text-blue-300 shadow-sm' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}>
                {t('dashboard.extractor')}
              </button>
              <button onClick={() => setActiveTab('crm')}
                className={`app-tab px-3.5 py-2 sm:px-5 sm:py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${activeTab === 'crm' ? 'bg-blue-600/20 text-blue-300 shadow-sm' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}>
                {t('dashboard.crm')}{!requireFeature('crm') && <span className="text-[10px] text-amber-300">🔒</span>}{crmLeads.length > 0 && <span className="ml-1 px-1.5 py-0.5 rounded-full bg-blue-500 text-black text-[10px] font-bold">{crmLeads.length}</span>}
              </button>
              <button onClick={() => setActiveTab('whatsapp')}
                className={`app-tab px-3.5 py-2 sm:px-5 sm:py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${activeTab === 'whatsapp' ? 'bg-blue-600/20 text-blue-300 shadow-sm' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}>
                {t('dashboard.whatsapp')}{!requireFeature('whatsappSender') && <span className="text-[10px] text-amber-300">🔒</span>}
              </button>
              <button onClick={() => setActiveTab('chatbot')}
                className={`app-tab px-3.5 py-2 sm:px-5 sm:py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${activeTab === 'chatbot' ? 'bg-blue-600/20 text-blue-300 shadow-sm' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}>
                {t('dashboard.chatbot')}{!requireFeature('chatbot') && <span className="text-[10px] text-amber-300">🔒</span>}
              </button>
              <button onClick={() => setActiveTab('support')}
                className={`app-tab px-3.5 py-2 sm:px-5 sm:py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${activeTab === 'support' ? 'bg-blue-600/20 text-blue-300 shadow-sm' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}>
                {t('dashboard.support')}
              </button>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <button onClick={() => setShowReferral(true)} className="text-[11px] px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500/20 transition-colors cursor-pointer whitespace-nowrap font-semibold">
                {t('dashboard.referral')}
              </button>
              <button onClick={() => setActiveTab('ia')}
                className={`text-[11px] px-3 py-1.5 rounded-full transition-colors cursor-pointer whitespace-nowrap font-semibold ${activeTab === 'ia' ? 'bg-purple-500/20 text-purple-300 border border-purple-500/20' : 'bg-white/5 text-gray-400 hover:text-white border border-white/10'}`}>
                {t('dashboard.aiCopy')}{!requireFeature('aiCopy') && <span className="ml-1 text-amber-300">🔒</span>}
              </button>
            </div>
          </div>
        </header>

        {activeTabLocked && activeTabFeature && (
          <LockedFeaturePanel feature={activeTabFeature as FeatureKey} activeTab={activeTab} currentPlan={currentPlan} getUpgradePlan={getUpgradePlan} />
        )}

        {activeTab === 'extractor' && (
          <ExtractorSection
            isExtracting={isExtracting} hasSearched={hasSearched} leads={leads} extractStats={extractStats}
            keyword={keyword} location={location} limit={limit} filterRule={filterRule}
            tokens={tokens} user={user} currentPlan={currentPlan} planId={planId}
            handleExtract={handleExtract} handleAddToCRM={handleAddToCRM} handleAddAllToCRM={handleAddAllToCRM}
            openWhatsApp={openWhatsApp} exportToCSV={exportToCSV} exportToXLSX={exportToXLSX}
            fetchHistory={fetchHistory} showHistory={showHistory} setShowHistory={setShowHistory}
            historyLoading={historyLoading} historyData={historyData}
            requireFeature={requireFeature} showLockedFeature={showLockedFeature} getUpgradePlan={getUpgradePlan}
            setKeyword={setKeyword} setLocation={setLocation} setLimit={setLimit} setFilterRule={setFilterRule}
            onCancel={cancelExtraction}
          />
        )}

        {activeTab === 'crm' && !activeTabLocked && (
          <>
          {batchEnrichProgress?.status === 'running' && (
            <div className="mb-4 bg-purple-500/10 border border-purple-500/20 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-purple-400 animate-pulse shadow-[0_0_8px_rgba(168,85,247,0.6)]" />
                  <span className="text-sm font-bold text-purple-300">Enriquecendo dados...</span>
                </div>
                <span className="text-xs text-gray-400 font-mono">
                  {batchEnrichProgress.completed + batchEnrichProgress.failed}/{batchEnrichProgress.total} ({batchEnrichProgress.percentage}%)
                </span>
              </div>
              <div className="w-full h-3 bg-black/40 rounded-full overflow-hidden border border-white/5">
                <div className="h-full bg-gradient-to-r from-purple-600 via-pink-500 to-purple-600 rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${batchEnrichProgress.percentage}%` }} />
              </div>
              <div className="flex gap-4 mt-2 text-xs">
                <span className="text-green-400 font-medium">✓ {batchEnrichProgress.completed} concluídos</span>
                {batchEnrichProgress.failed > 0 && <span className="text-red-400 font-medium">✕ {batchEnrichProgress.failed} falhas</span>}
                <span className="text-gray-500">{batchEnrichProgress.total - batchEnrichProgress.completed - batchEnrichProgress.failed} pendentes</span>
              </div>
            </div>
          )}
          <CRMSection
            crmLeads={crmLeads} crmSearch={crmSearch} setCrmSearch={setCrmSearch}
            crmFilterStage={crmFilterStage} setCrmFilterStage={setCrmFilterStage}
            selectedCrmLeads={selectedCrmLeads} setSelectedCrmLeads={setSelectedCrmLeads}
            crmSyncStatus={crmSyncStatus} crmSyncMessage={crmSyncMessage}
            crmPage={crmPage} setCrmPage={setCrmPage}
            bulkStageLoading={bulkStageLoading} bulkStageTarget={bulkStageTarget} setBulkStageTarget={setBulkStageTarget}
            handleRemoveFromCRM={handleRemoveFromCRM} handleToggleSelectCrmLead={handleToggleSelectCrmLead}
            handleToggleSelectAllCrmLeads={handleToggleSelectAllCrmLeads} handleRemoveSelectedFromCRM={handleRemoveSelectedFromCRM}
            handleBulkStageChange={handleBulkStageChange} handleUpdateCRMLead={handleUpdateCRMLead} openWhatsApp={openWhatsApp}
            waSentMessages={waSentMessages}
            batchEnrichProgress={batchEnrichProgress}
            onImportLeads={async (importedLeads) => {
              const existingKeys = new Set(crmLeads.map(getLeadKey));
              const newLeads = importedLeads.filter((l: any) => !existingKeys.has(getLeadKey(l)));
              const formatted = newLeads.map(l => ({
                ...l, stage: 'Novo', notes: '', savedAt: new Date().toISOString(),
                nicho: l.nicho || keyword || 'Geral', cidade: l.cidade || location || 'Geral',
              }));
              const updated = [...formatted, ...crmLeads];
              saveCrm(updated);
              setSelectedWaLeads(prev => {
                const newKeys = formatted.filter((l: any) => l.telefone && l.telefone !== 'Não informado').map(getLeadKey);
                return Array.from(new Set([...newKeys, ...prev]));
              });
              const skipped = importedLeads.length - newLeads.length;
              const msg = skipped > 0 ? `${newLeads.length} importados, ${skipped} duplicados ignorados` : `${formatted.length} leads importados!`;
              showToast(msg, 'success');
              const updatedSnapshot = [...formatted, ...crmLeads];
              startBatchEnrichment(formatted, (enrichments) => {
                saveCrm(updatedSnapshot.map((l: any) => enrichments[l.nome] ? { ...l, ...enrichments[l.nome] } : l));
              });
            }}
          />
          </>
        )}

        {activeTab === 'whatsapp' && !activeTabLocked && (
          <WhatsAppSection
            dispatchableWaLeads={dispatchableWaLeads} selectedWaLeads={selectedWaLeads} setSelectedWaLeads={setSelectedWaLeads}
            waTemplate={waTemplate} setWaTemplate={setWaTemplate} waSentStatus={waSentStatus}
            isSendingBulk={isSendingBulk} isAutoSending={isAutoSending} bulkDelay={bulkDelay} setBulkDelay={setBulkDelay}
            bulkSimulateHuman={bulkSimulateHuman} setBulkSimulateHuman={setBulkSimulateHuman}
            bulkAutoNext={bulkAutoNext} setBulkAutoNext={setBulkAutoNext} bulkIndex={bulkIndex} bulkTimer={bulkTimer} bulkQueue={bulkQueue}
            waAiProduct={waAiProduct} setWaAiProduct={setWaAiProduct} waAiValue={waAiValue} setWaAiValue={setWaAiValue}
            waAiTone={waAiTone} setWaAiTone={setWaAiTone} waAiCopies={waAiCopies} waAiLoading={waAiLoading} waAiMessage={waAiMessage}
            waSendingViaBot={waSendingViaBot} waSentMessages={waSentMessages} waSentMessagesLoading={waSentMessagesLoading}
            chatbotSession={chatbotSession} user={user} requireFeature={requireFeature} setActiveTab={setActiveTab}
            openWhatsApp={openWhatsApp} handleStartBulkSending={handleStartBulkSending}
            handleStopBulkSending={handleStopBulkSending} handleStartAutoBulkSend={handleStartAutoBulkSend}
            handleConfirmSentAndNext={handleConfirmSentAndNext} handleTriggerBulkSendLead={handleTriggerBulkSendLead}
            handleToggleSelectWaLead={handleToggleSelectWaLead} handleToggleSelectAllWaLeads={handleToggleSelectAllWaLeads}
            handleSendViaBot={handleSendViaBot} handleLoadSentMessages={handleLoadSentMessages}
            generateWaAiTemplates={generateWaAiTemplates} appendWaTag={appendWaTag}
            getSafeBulkDelay={getSafeBulkDelay} renderWhatsAppMessage={renderWhatsAppMessage} getLeadKey={getLeadKey}
            waPreviewLead={waPreviewLead} selectedWaCount={selectedWaCount} activeBulkLeadKey={activeBulkLeadKey}
            waStats={waStats} campaigns={campaigns} scheduleDate={scheduleDate} setScheduleDate={setScheduleDate}
            scheduleTime={scheduleTime} setScheduleTime={setScheduleTime}
            handleLoadWaStats={handleLoadWaStats} handleLoadCampaigns={handleLoadCampaigns}
            handleCreateCampaign={handleCreateCampaign}
          />
        )}

        {activeTab === 'chatbot' && !activeTabLocked && (
          <ChatbotSection
            chatbotEnabled={chatbotEnabled} setChatbotEnabled={setChatbotEnabled}
            chatbotBusinessName={chatbotBusinessName} setChatbotBusinessName={setChatbotBusinessName}
            chatbotWelcomeMessage={chatbotWelcomeMessage} setChatbotWelcomeMessage={setChatbotWelcomeMessage}
            chatbotFallbackMessage={chatbotFallbackMessage} setChatbotFallbackMessage={setChatbotFallbackMessage}
            chatbotRules={chatbotRules} setChatbotRules={setChatbotRules}
            chatbotUseAI={chatbotUseAI} setChatbotUseAI={setChatbotUseAI}
            chatbotAiInstructions={chatbotAiInstructions} setChatbotAiInstructions={setChatbotAiInstructions}
            chatbotSession={chatbotSession} chatbotLoading={chatbotLoading} chatbotMessage={chatbotMessage}
            chatbotPhoneNumber={chatbotPhoneNumber} setChatbotPhoneNumber={setChatbotPhoneNumber}
            user={user} handleConnectChatbot={handleConnectChatbot} handleDisconnectChatbot={handleDisconnectChatbot}
            handlePairChatbot={handlePairChatbot} handleResetSession={handleResetSession} saveChatbotConfig={saveChatbotConfig}
            updateChatbotRule={updateChatbotRule} addChatbotRule={addChatbotRule} removeChatbotRule={removeChatbotRule}
            chatbotAutoCapture={chatbotAutoCapture} setChatbotAutoCapture={setChatbotAutoCapture}
            chatbotStats={chatbotStats} conversations={conversations} conversationsLoading={conversationsLoading}
            handleLoadConversations={handleLoadConversations} handleLoadChatbotStats={handleLoadChatbotStats}
          />
        )}

        {activeTab === 'ia' && !activeTabLocked && (
          <AICopySection
            aiProduct={aiProduct} setAiProduct={setAiProduct} aiValue={aiValue} setAiValue={setAiValue}
            aiTone={aiTone} setAiTone={setAiTone} generatedCopies={generatedCopies}
            isGeneratingCopies={isGeneratingCopies} generateAICopies={generateAICopies}
            setWaTemplate={setWaTemplate} setActiveTab={setActiveTab} showToast={showToast}
          />
        )}

        {activeTab === 'support' && (
          <SupportSection
            supportRating={supportRating} setSupportRating={setSupportRating}
            supportFeedback={supportFeedback} setSupportFeedback={setSupportFeedback}
            supportSubmitted={supportSubmitted} setSupportSubmitted={setSupportSubmitted}
            hoveredStar={hoveredStar} setHoveredStar={setHoveredStar} user={user} showToast={showToast}
          />
        )}
      </main>

      {showOnboarding && <OnboardingOverlay />}

      {showReferral && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setShowReferral(false)}>
          <div className="app-card w-full max-w-md p-6 sm:p-8 rounded-[2rem] bg-gradient-to-b from-white/[0.05] to-black/60 border border-white/10 shadow-2xl relative overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-500 to-yellow-500" />
            <button onClick={() => setShowReferral(false)} className="absolute top-4 right-4 text-gray-500 hover:text-white cursor-pointer text-lg">&times;</button>
            <h2 className="text-xl font-bold mb-2">{t('dashboard.referralTitle')}</h2>
            <p className="text-sm text-gray-400 mb-6">{t('dashboard.referralDesc')}</p>
            <div className="bg-black/40 border border-white/10 rounded-xl p-4 mb-4">
              <label className="text-xs text-gray-500 block mb-1.5">Seu link de indicação</label>
              <div className="flex gap-2">
                <input readOnly value={`${typeof window !== 'undefined' ? window.location.origin : ''}/login?ref=${user?.id || ''}`} className="flex-1 bg-black/60 border border-white/10 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none" onClick={e => (e.target as HTMLInputElement).select()} />
                <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/login?ref=${user?.id || ''}`); showToast('Link copiado!', 'success'); }} className="px-3 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold cursor-pointer">{t('dashboard.copyLink')}</button>
              </div>
            </div>
            {referralBonus !== null && (
              <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-3 text-sm text-green-400 text-center">
                🎉 Você já ganhou <strong>{referralBonus}</strong> tokens em bônus de indicação!
              </div>
            )}
            <p className="text-[11px] text-gray-500 mt-4 leading-relaxed">{t('dashboard.referralAutoCredit')}</p>
          </div>
        </div>
      )}
    </div>
  );
}
