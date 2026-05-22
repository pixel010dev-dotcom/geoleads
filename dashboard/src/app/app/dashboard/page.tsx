"use client";

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { getPlanById, getPlanIdFromTokens, getRequiredPlanForFeature, hasFeature, plans, type FeatureKey, type PlanId } from '@/lib/plans';
import Globe from '@/components/Globe';
import HackerRadar from '@/components/HackerRadar';
import Toast, { showToast } from '@/components/Toast';
import DashboardCharts from '@/components/DashboardCharts';

type DashboardTab = 'extractor' | 'crm' | 'whatsapp' | 'chatbot' | 'ia' | 'support';

const tabFeatureMap: Record<DashboardTab, FeatureKey | null> = {
  extractor: 'extractor',
  crm: 'crm',
  whatsapp: 'whatsappSender',
  chatbot: 'chatbot',
  ia: 'aiCopy',
  support: null
};

const tabUpgradeCopy: Record<Exclude<DashboardTab, 'extractor' | 'support'>, { title: string; description: string }> = {
  crm: {
    title: 'CRM liberado no Inicial',
    description: 'Salve leads, organize o funil e exporte contatos com um pacote pago de entrada.'
  },
  whatsapp: {
    title: 'Disparador liberado no Pro',
    description: 'Use a fila assistida e os modelos de abordagem quando seu plano tiver WhatsApp.'
  },
  chatbot: {
    title: 'Chatbot liberado no Max',
    description: 'Automatize respostas por QR Code apenas na camada de maior volume.'
  },
  ia: {
    title: 'Copys com IA liberadas no Pro',
    description: 'Gere abordagens comerciais para WhatsApp e e-mail nos planos com IA.'
  }
};

const getLeadKey = (lead: any) => `${lead.nome || ''}|${lead.telefone || ''}|${lead.cidade || ''}`;

const normalizeCrmLead = (lead: any) => ({
  ...lead,
  nome: lead.nome || 'Lead sem nome',
  telefone: lead.telefone || 'Não informado',
  email: lead.email || '',
  site: lead.site || 'Sem site',
  avaliacao: lead.avaliacao || 'N/A',
  instagram: lead.instagram || '',
  facebook: lead.facebook || '',
  tiktok: lead.tiktok || '',
  cnpj: lead.cnpj || '',
  stage: lead.stage || 'Novo',
  notes: lead.notes || '',
  savedAt: lead.savedAt || new Date().toISOString(),
  nicho: lead.nicho || 'Geral',
  cidade: lead.cidade || 'Geral'
});

const crmLeadToRow = (lead: any, userId: string) => {
  const normalized = normalizeCrmLead(lead);

  return {
    user_id: userId,
    lead_key: getLeadKey(normalized),
    nome: normalized.nome,
    telefone: normalized.telefone,
    email: normalized.email,
    site: normalized.site,
    avaliacao: normalized.avaliacao,
    instagram: normalized.instagram,
    facebook: normalized.facebook,
    tiktok: normalized.tiktok,
    cnpj: normalized.cnpj,
    stage: normalized.stage,
    notes: normalized.notes,
    nicho: normalized.nicho,
    cidade: normalized.cidade,
    saved_at: normalized.savedAt,
    payload: normalized
  };
};

const crmRowToLead = (row: any) => normalizeCrmLead({
  ...(row.payload || {}),
  nome: row.nome,
  telefone: row.telefone,
  email: row.email,
  site: row.site,
  avaliacao: row.avaliacao,
  instagram: row.instagram,
  facebook: row.facebook,
  tiktok: row.tiktok || row.payload?.tiktok,
  cnpj: row.cnpj || row.payload?.cnpj,
  stage: row.stage,
  notes: row.notes,
  nicho: row.nicho,
  cidade: row.cidade,
  savedAt: row.saved_at || row.payload?.savedAt
});

const waMessagePresets = [
  {
    id: 'local',
    title: 'Abordagem local',
    subtitle: 'Primeiro contato consultivo',
    body: 'Olá {Nome}, tudo bem? Vi que vocês atuam em {Cidade} no segmento de {Nicho}. Tenho uma ideia simples para ajudar vocês a receberem mais clientes locais. Posso te mostrar?'
  },
  {
    id: 'offer',
    title: 'Oferta direta',
    subtitle: 'Mensagem curta e objetiva',
    body: 'Oi {Nome}! Trabalho ajudando empresas de {Nicho} em {Cidade} a atrair mais clientes todos os dias. Quer que eu te envie uma sugestão rápida para o seu negócio?'
  },
  {
    id: 'audit',
    title: 'Diagnóstico grátis',
    subtitle: 'Boa para agência/serviço',
    body: 'Olá {Nome}. Analisei rapidamente a presença online de empresas de {Nicho} em {Cidade} e encontrei alguns pontos de melhoria. Posso te mandar um diagnóstico gratuito?'
  },
  {
    id: 'partner',
    title: 'Parceria',
    subtitle: 'Tom mais leve',
    body: 'Oi {Nome}, tudo certo? Estou buscando negócios de {Nicho} em {Cidade} para uma possível parceria local. Faz sentido conversarmos por aqui?'
  }
];

const waTemplateTags = ['{Nome}', '{Cidade}', '{Nicho}', '{Site}', '{Telefone}'];

const defaultChatbotRules = [
  {
    id: 'preco',
    keyword: 'preço',
    response: 'Oi {Nome}! Os valores dependem do objetivo e da região. Me fala qual serviço você procura que eu te ajudo por aqui.',
    enabled: true
  },
  {
    id: 'horario',
    keyword: 'horário',
    response: 'Olá {Nome}! Nosso horário de atendimento é de segunda a sexta, das 9h às 18h. Se quiser, já me diga o que precisa.',
    enabled: true
  },
  {
    id: 'orcamento',
    keyword: 'orçamento',
    response: 'Claro, {Nome}. Para montar um orçamento rápido, me envie sua cidade e o serviço que você deseja.',
    enabled: true
  }
];

const LockedFeaturePanel = ({ feature, activeTab, currentPlan, getUpgradePlan }: {
  feature: FeatureKey;
  activeTab: DashboardTab;
  currentPlan: { name: string };
  getUpgradePlan: (feature: FeatureKey) => { name: string; tokens: number };
}) => {
  const requiredPlan = getUpgradePlan(feature);
  const fallbackCopy = {
    title: `Recurso do plano ${requiredPlan.name}`,
    description: 'Faça upgrade para liberar esta ferramenta no GeoLeads.'
  };
  const copy = activeTab !== 'extractor' && activeTab !== 'support'
    ? tabUpgradeCopy[activeTab] || fallbackCopy
    : fallbackCopy;

  return (
    <div className="app-card p-7 rounded-[2rem] bg-gradient-to-b from-white/[0.05] to-black/40 border border-white/10 shadow-2xl animate-slide-up">
      <div className="max-w-2xl">
        <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-bold mb-4">
          🔒 Plano {requiredPlan.name}
        </span>
        <h2 className="text-2xl font-bold mb-2">{copy.title}</h2>
        <p className="text-gray-400 text-sm leading-relaxed mb-5">{copy.description}</p>
        <div className="flex flex-wrap gap-2 mb-6">
          <span className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs text-gray-300">
            Seu plano atual: {currentPlan.name}
          </span>
          <span className="px-3 py-1.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-300">
            {requiredPlan.tokens.toLocaleString('pt-BR')} tokens inclusos
          </span>
        </div>
        <Link
          href="/pricing"
          className="inline-flex items-center justify-center px-5 py-3 rounded-xl bg-white text-black font-bold text-sm hover:bg-gray-200 transition-colors"
        >
          Ver planos
        </Link>
      </div>
    </div>
  );
};

const LeadGuideWidget = ({ user, currentPlan, tokens, onNavigate }: {
  user: any;
  currentPlan: { name: string };
  tokens: number | null;
  onNavigate: (tab: DashboardTab) => void;
}) => (
  <div className="lead-guide-widget">
    <div className="flex items-start justify-between gap-3 mb-4">
      <div>
        <span className="text-xs text-blue-300 font-bold uppercase tracking-wide">Widget de ação</span>
        <h3 className="text-lg font-bold mt-1">Próximo passo para vender</h3>
      </div>
      <span className="px-2.5 py-1 rounded-full bg-green-500/10 border border-green-500/20 text-green-300 text-[11px] font-bold">
        Motor OK
      </span>
    </div>

    <div className="grid grid-cols-3 gap-2 mb-4">
      <button type="button" onClick={() => onNavigate('extractor')} className="lead-step is-active">
        <b>1</b>
        <span>Buscar</span>
      </button>
      <button type="button" onClick={() => onNavigate('crm')} className="lead-step">
        <b>2</b>
        <span>Salvar</span>
      </button>
      <button type="button" onClick={() => onNavigate('whatsapp')} className="lead-step">
        <b>3</b>
        <span>Abordar</span>
      </button>
    </div>

    <div className="rounded-2xl bg-black/25 border border-white/10 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs text-gray-500">Plano atual</p>
          <p className="font-bold text-white">{user ? currentPlan.name : 'Conta gratuita'}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-500">Saldo</p>
          <p className="font-bold text-blue-300">{tokens !== null ? tokens.toLocaleString('pt-BR') : '10'} tokens</p>
        </div>
      </div>
    </div>

    <Link href="/pricing" className="mt-3 inline-flex w-full items-center justify-center rounded-xl bg-white text-black font-bold text-sm py-3 hover:bg-gray-200 transition-colors">
      Comprar ou trocar plano
    </Link>
  </div>
);

export default function Home() {
  // Navigation
  const [activeTab, setActiveTab] = useState<DashboardTab>('extractor');
  const router = useRouter();

  // Extractor States
  const [keyword, setKeyword] = useState('');
  const [location, setLocation] = useState('');
  const [limit, setLimit] = useState<number | ''>(10);
  const [isExtracting, setIsExtracting] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [leads, setLeads] = useState<any[]>([]);
  const [extractStats, setExtractStats] = useState<any>(null);
  const [filterRule, setFilterRule] = useState<string>('none');
  
  // Auth & Account
  const [user, setUser] = useState<any>(null);
  const [tokens, setTokens] = useState<number | null>(null);
  const [planId, setPlanId] = useState<PlanId>('free');

  // CRM States
  const [crmLeads, setCrmLeads] = useState<any[]>([]);
  const [crmSearch, setCrmSearch] = useState('');
  const [crmFilterStage, setCrmFilterStage] = useState('all');
  const [selectedCrmLeads, setSelectedCrmLeads] = useState<string[]>([]);
  const [crmSyncStatus, setCrmSyncStatus] = useState<'local' | 'syncing' | 'cloud' | 'error'>('local');
  const [crmSyncMessage, setCrmSyncMessage] = useState('CRM local');
  const [crmPage, setCrmPage] = useState(0);
  const [bulkStageLoading, setBulkStageLoading] = useState(false);
  const [bulkStageTarget, setBulkStageTarget] = useState('Novo');
  const [enrichLoading, setEnrichLoading] = useState(false);
  const CRM_PAGE_SIZE = 25;

  // WhatsApp Sender States
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

  // WhatsApp Chatbot States
  const [chatbotEnabled, setChatbotEnabled] = useState(true);
  const [chatbotBusinessName, setChatbotBusinessName] = useState('GeoLeads');
  const [chatbotWelcomeMessage, setChatbotWelcomeMessage] = useState('Olá! Sou o assistente automático. Me diga como posso ajudar.');
  const [chatbotFallbackMessage, setChatbotFallbackMessage] = useState('Recebi sua mensagem. Um atendente vai continuar por aqui em breve.');
  const [chatbotRules, setChatbotRules] = useState(defaultChatbotRules);
  const [chatbotSession, setChatbotSession] = useState<any>({ status: 'idle', repliedCount: 0 });
  const [chatbotLoading, setChatbotLoading] = useState(false);
  const [chatbotMessage, setChatbotMessage] = useState('');
  const [chatbotPhoneNumber, setChatbotPhoneNumber] = useState('');

  // AI Copywriter States
  const [aiProduct, setAiProduct] = useState('');
  const [aiValue, setAiValue] = useState('');
  const [aiTone, setAiTone] = useState('persuasive');
  const [generatedCopies, setGeneratedCopies] = useState<any[] | null>(null);
  const [isGeneratingCopies, setIsGeneratingCopies] = useState(false);

  // Support Tab States
  const [supportRating, setSupportRating] = useState<number>(0);
  const [supportFeedback, setSupportFeedback] = useState('');
  const [supportSubmitted, setSupportSubmitted] = useState(false);
  const [hoveredStar, setHoveredStar] = useState<number | null>(null);
  const [checkoutNotice, setCheckoutNotice] = useState<string | null>(null);

  // Extraction History States
  const [showHistory, setShowHistory] = useState(false);
  const [historyData, setHistoryData] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Social Proof Notification Loop State
  const [proofIndex, setProofIndex] = useState(0);
  const [proofVisible, setProofVisible] = useState(true);

  const socialProofMsgs = [
    { name: "Mateus C.", action: "extraiu", detail: "150 Leads", target: "em São Paulo", type: "extract" },
    { name: "Ana S.", action: "extraiu", detail: "84 Leads", target: "no Rio de Janeiro", type: "extract" },
    { name: "Rodrigo M.", action: "disparou", detail: "45 mensagens", target: "no WhatsApp", type: "whatsapp" },
    { name: "Clínica Odonto", action: "extraiu", detail: "200 Leads", target: "de Dentistas", type: "extract" },
    { name: "Juliana F.", action: "exportou", detail: "120 contatos", target: "para o CRM", type: "export" },
    { name: "Carlos P.", action: "extraiu", detail: "95 Leads", target: "em Belo Horizonte", type: "extract" },
    { name: "Felipe R.", action: "gerou", detail: "copys de vendas", target: "com IA", type: "ia" },
    { name: "Renata L.", action: "extraiu", detail: "310 Leads", target: "em Curitiba", type: "extract" },
    { name: "Lucas T.", action: "disparou", detail: "75 mensagens", target: "agora", type: "whatsapp" },
    { name: "Beatriz G.", action: "extraiu", detail: "52 Leads", target: "em Porto Alegre", type: "extract" }
  ];

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
  const activeTabLocked = Boolean(activeTabFeature && !hasFeature(planId, activeTabFeature));
  const requireFeature = (feature: FeatureKey) => hasFeature(planId, feature);
  const getUpgradePlan = (feature: FeatureKey) => getPlanById(getRequiredPlanForFeature(feature));

  const showLockedFeature = (feature: FeatureKey) => {
    const requiredPlan = getUpgradePlan(feature);
    showToast(`Recurso do plano ${requiredPlan.name}. Faça upgrade para liberar.`, 'warning');
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

  // moved: LockedFeaturePanel and LeadGuideWidget are now top-level components

  const sampleCrmLeads = () => [
    {
      nome: "Petshop Amigo Canino",
      telefone: "(11) 99888-7766",
      email: "contato@amigocanino.com.br",
      site: "https://amigocanino.com.br",
      stage: "Novo",
      notes: "Cliente potencial de petshop em São Paulo. Falar com Dr. Carlos.",
      savedAt: new Date().toISOString(),
      nicho: "Petshop",
      cidade: "São Paulo"
    },
    {
      nome: "Restaurante Sabor & Cia",
      telefone: "(21) 98765-4321",
      email: "contato@saborecia.com.br",
      site: "Sem site",
      stage: "Em Contato",
      notes: "Enviada mensagem inicial de apresentação.",
      savedAt: new Date().toISOString(),
      nicho: "Restaurante",
      cidade: "Rio de Janeiro"
    },
    {
      nome: "Clínica Odonto Riso",
      telefone: "(31) 97766-5544",
      email: "atendimento@odontoriso.com.br",
      site: "https://odontoriso.com.br",
      stage: "Proposta",
      notes: "Aguardando retorno sobre proposta de tráfego pago.",
      savedAt: new Date().toISOString(),
      nicho: "Dentista",
      cidade: "Belo Horizonte"
    }
  ];

  const loadCrmFromCloud = async (userId: string) => {
    const { data, error } = await supabase
      .from('crm_leads')
      .select('*')
      .eq('user_id', userId)
      .order('saved_at', { ascending: false });

    if (error) throw error;
    return (data || []).map(crmRowToLead);
  };

  const syncCrmToCloud = async (updatedCrm: any[], targetUserId = user?.id) => {
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
  };

  const getChatbotConfig = () => ({
    enabled: chatbotEnabled,
    businessName: chatbotBusinessName,
    welcomeMessage: chatbotWelcomeMessage,
    fallbackMessage: chatbotFallbackMessage,
    rules: chatbotRules
  });

  const saveChatbotConfig = async (silent = false) => {
    const config = getChatbotConfig();
    localStorage.setItem('geoleads_chatbot_config', JSON.stringify(config));
    let cloudSyncFailed = false;
    let runtimeSyncFailed = false;

    if (user?.id) {
      const { error } = await supabase
        .from('chatbot_configs')
        .upsert({
          user_id: user.id,
          enabled: config.enabled,
          business_name: config.businessName,
          welcome_message: config.welcomeMessage,
          fallback_message: config.fallbackMessage,
          rules: config.rules
        }, { onConflict: 'user_id' });

      if (error) {
        console.warn('Chatbot config cloud sync failed:', error.message);
        cloudSyncFailed = true;
      }
    }

    if (user?.id && ['connected', 'qr', 'connecting'].includes(chatbotSession.status)) {
      try {
        await callChatbotApi('update-config', config);
      } catch (error: any) {
        console.warn('Chatbot runtime sync failed:', error.message);
        runtimeSyncFailed = true;
      }
    }

    if (!silent) {
      if (runtimeSyncFailed) {
        setChatbotMessage('Configuração salva, mas o bot conectado não recebeu a atualização. Reconecte o QR.');
      } else if (cloudSyncFailed) {
        setChatbotMessage('Configuração salva localmente. Rode o SQL do Supabase para salvar na nuvem.');
      } else if (['connected', 'qr', 'connecting'].includes(chatbotSession.status)) {
        setChatbotMessage('Configuração salva e enviada para o bot conectado.');
      } else {
        setChatbotMessage('Configuração do chatbot salva.');
      }
    }
  };

  const callChatbotApi = async (action: string, config = getChatbotConfig()) => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;

    if (!token) {
      router.push('/login');
      return null;
    }

    const res = await fetch('/api/chatbot', {
      method: action === 'status' ? 'GET' : 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: action === 'status' ? undefined : JSON.stringify({ action, config })
    });
    const payload = await res.json();

    if (!res.ok) {
      throw new Error(payload.error || 'Erro no chatbot.');
    }

    if (payload.session) setChatbotSession(payload.session);
    return payload;
  };

  const refreshChatbotStatus = async () => {
    if (!user) return;

    try {
      await callChatbotApi('status');
    } catch (error: any) {
      setChatbotMessage(error.message);
    }
  };

  const handleConnectChatbot = async () => {
    if (!requireFeature('chatbot')) {
      setActiveTab('chatbot');
      return;
    }

    setChatbotLoading(true);
    setChatbotMessage('');

    try {
      await saveChatbotConfig(true);
      await callChatbotApi('connect');
      setChatbotMessage('Conexão iniciada. Escaneie o QR Code quando aparecer.');
    } catch (error: any) {
      setChatbotMessage(error.message);
    } finally {
      setChatbotLoading(false);
    }
  };

  const handleDisconnectChatbot = async () => {
    setChatbotLoading(true);
    setChatbotMessage('');

    try {
      await callChatbotApi('disconnect');
      setChatbotMessage('Chatbot desconectado.');
    } catch (error: any) {
      setChatbotMessage(error.message);
    } finally {
      setChatbotLoading(false);
    }
  };

  const handlePairChatbot = async () => {
    if (!requireFeature('chatbot')) {
      setActiveTab('chatbot');
      return;
    }

    const number = chatbotPhoneNumber.replace(/\D/g, '');
    if (number.length < 10 || number.length > 15) {
      setChatbotMessage('Digite um número válido com código do país (ex: 5511999999999)');
      return;
    }

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
        if (result.session.pairingCode) {
          setChatbotMessage(`Código de pareamento: ${result.session.pairingCode}`);
        }
      } else {
        setChatbotMessage(result.error || 'Erro ao parear.');
      }
    } catch (error: any) {
      setChatbotMessage(error.message);
    } finally {
      setChatbotLoading(false);
    }
  };

  const updateChatbotRule = (id: string, field: 'keyword' | 'response' | 'enabled', value: string | boolean) => {
    setChatbotRules(prev => prev.map(rule => rule.id === id ? { ...rule, [field]: value } : rule));
  };

  const addChatbotRule = () => {
    setChatbotRules(prev => [
      ...prev,
      {
        id: `rule-${Date.now()}`,
        keyword: '',
        response: 'Olá {Nome}! Recebi sua mensagem sobre {Mensagem}. Já te ajudo.',
        enabled: true
      }
    ]);
  };

  const removeChatbotRule = (id: string) => {
    setChatbotRules(prev => prev.filter(rule => rule.id !== id));
  };

  useEffect(() => {
    const timeoutIds: ReturnType<typeof setTimeout>[] = [];
    const interval = setInterval(() => {
      setProofVisible(false);
      const id = setTimeout(() => {
        setProofIndex((prev) => (prev + 1) % socialProofMsgs.length);
        setProofVisible(true);
      }, 500);
      timeoutIds.push(id);
    }, 7000);
    return () => {
      clearInterval(interval);
      timeoutIds.forEach(clearTimeout);
    };
  }, [socialProofMsgs.length]);

  const refreshProfile = async (userId: string) => {
    const { data: profileData, error } = await supabase
      .from('profiles')
      .select('tokens, plan_id')
      .eq('id', userId)
      .single();

    if (error || !profileData) return;

    setTokens(profileData.tokens);
    const savedPlanId = getPlanById(profileData.plan_id).id;
    const inferredPlanId = getPlanIdFromTokens(profileData.tokens);
    setPlanId(plans[savedPlanId].tokens >= plans[inferredPlanId].tokens ? savedPlanId : inferredPlanId);
  };

  // Load User, Tokens and CRM Data on Mount
  useEffect(() => {
    document.title = 'GeoLeads - Dashboard';
    const loadData = async () => {
      let sessionUserId = '';

      // Load Supabase session
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        sessionUserId = session.user.id;
        setUser(session.user);
        let profileData: any = null;
        const { data, error } = await supabase
          .from('profiles')
          .select('tokens, plan_id')
          .eq('id', session.user.id)
          .single();

        if (error) {
          const fallback = await supabase
            .from('profiles')
            .select('tokens')
            .eq('id', session.user.id)
            .single();
          profileData = fallback.data;
        } else {
          profileData = data;
        }

        if (profileData) {
          await refreshProfile(session.user.id);
        }
      }

      const params = new URLSearchParams(window.location.search);
      const checkoutState = params.get('checkout');
      const purchasedPlanId = params.get('plan') as PlanId | null;

      if (checkoutState === 'success') {
        const planName = purchasedPlanId ? getPlanById(purchasedPlanId).name : 'seu plano';
        setCheckoutNotice(`Pagamento recebido! Estamos liberando os tokens do plano ${planName}. Se o saldo não atualizar em 1 minuto, recarregue a página.`);

        if (sessionUserId) {
          await refreshProfile(sessionUserId);
          window.setTimeout(() => refreshProfile(sessionUserId), 4000);
          window.setTimeout(() => refreshProfile(sessionUserId), 12000);
        }

        params.delete('checkout');
        params.delete('plan');
        const nextQuery = params.toString();
        const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ''}`;
        window.history.replaceState({}, '', nextUrl);
      }

      // Load CRM from local cache first, then prefer cloud when available.
      const localCrm = localStorage.getItem('geoleads_crm');
      let parsedCrm: any[] = [];
      if (localCrm) {
        try {
          parsedCrm = JSON.parse(localCrm).map(normalizeCrmLead);
        } catch(e) {}
      }

      const localChatbotConfig = localStorage.getItem('geoleads_chatbot_config');
      if (localChatbotConfig) {
        try {
          applyChatbotConfig(JSON.parse(localChatbotConfig));
        } catch(e) {}
      }

      if (sessionUserId) {
        try {
          setCrmSyncStatus('syncing');
          setCrmSyncMessage('Carregando nuvem...');
          const cloudCrm = await loadCrmFromCloud(sessionUserId);

          if (cloudCrm.length > 0) {
            parsedCrm = cloudCrm;
            localStorage.setItem('geoleads_crm', JSON.stringify(parsedCrm));
          } else if (parsedCrm.length > 0) {
            await syncCrmToCloud(parsedCrm, sessionUserId);
          } else {
            setCrmSyncStatus('cloud');
            setCrmSyncMessage('CRM na nuvem');
          }
        } catch (error: any) {
          console.warn('CRM cloud load failed:', error.message);
          setCrmSyncStatus('error');
          setCrmSyncMessage('Modo local');
        }

        try {
          const { data: cloudChatbotConfig } = await supabase
            .from('chatbot_configs')
            .select('*')
            .eq('user_id', sessionUserId)
            .maybeSingle();

          if (cloudChatbotConfig) {
            const config = {
              enabled: cloudChatbotConfig.enabled,
              businessName: cloudChatbotConfig.business_name,
              welcomeMessage: cloudChatbotConfig.welcome_message,
              fallbackMessage: cloudChatbotConfig.fallback_message,
              rules: cloudChatbotConfig.rules
            };
            applyChatbotConfig(config);
            localStorage.setItem('geoleads_chatbot_config', JSON.stringify(config));
          }
        } catch (error: any) {
          console.warn('Chatbot cloud config load failed:', error.message);
        }
      }

      // If empty, load B2B mock data by default to prevent a blank cold start.
      if (!Array.isArray(parsedCrm) || parsedCrm.length === 0) {
        parsedCrm = sampleCrmLeads();
        localStorage.setItem('geoleads_crm', JSON.stringify(parsedCrm));
      }
      setCrmLeads(parsedCrm);

      const dispatchable = parsedCrm.filter(l => l.telefone && l.telefone !== 'Não informado').map(getLeadKey);
      setSelectedWaLeads(dispatchable);
    };
    loadData();
  }, []);

  useEffect(() => {
    if (activeTab !== 'chatbot' || !user || !requireFeature('chatbot')) return;

    refreshChatbotStatus();
    const interval = setInterval(refreshChatbotStatus, 5000);
    return () => clearInterval(interval);
  }, [activeTab, user, planId]);

  useEffect(() => {
    if (activeTab === 'whatsapp' && user && requireFeature('whatsappSender')) {
      handleLoadSentMessages();
    }
  }, [activeTab, user, planId]);

  useEffect(() => { setCrmPage(0); }, [crmSearch, crmFilterStage]);

  // Save CRM to local cache and cloud when the user is authenticated.
  const saveCrm = (updatedCrm: any[]) => {
    const normalized = updatedCrm.map(normalizeCrmLead);
    setCrmLeads(normalized);
    localStorage.setItem('geoleads_crm', JSON.stringify(normalized));
    syncCrmToCloud(normalized);
  };

  // Add lead to CRM
  const handleAddToCRM = (lead: any) => {
    if (!requireFeature('crm')) {
      setActiveTab('crm');
      return;
    }

    const exists = crmLeads.some(l => l.nome === lead.nome);
    if (exists) {
      showToast(`"${lead.nome}" já está no CRM.`, 'info');
      return;
    }

    const newCrmLead = {
      ...lead,
      stage: 'Novo',
      notes: '',
      savedAt: new Date().toISOString(),
      nicho: keyword || 'Geral',
      cidade: location || 'Geral'
    };

    const updated = [newCrmLead, ...crmLeads];
    saveCrm(updated);
    if (newCrmLead.telefone && newCrmLead.telefone !== 'Não informado') {
      const newKey = getLeadKey(newCrmLead);
      setSelectedWaLeads(prev => prev.includes(newKey) ? prev : [newKey, ...prev]);
    }
    showToast(`"${lead.nome}" salvo no CRM!`, 'success');
  };

  // Save all current leads to CRM
  const handleAddAllToCRM = () => {
    if (!requireFeature('crm')) {
      setActiveTab('crm');
      return;
    }

    if (leads.length === 0) return;
    let addedCount = 0;
    const updated = [...crmLeads];

    const newDispatchableKeys: string[] = [];

    leads.forEach(lead => {
      const exists = updated.some(l => l.nome === lead.nome);
      if (!exists) {
        const newLead = {
          ...lead,
          stage: 'Novo',
          notes: '',
          savedAt: new Date().toISOString(),
          nicho: keyword || 'Geral',
          cidade: location || 'Geral'
        };
        updated.unshift(newLead);
        if (newLead.telefone && newLead.telefone !== 'Não informado') {
          newDispatchableKeys.push(getLeadKey(newLead));
        }
        addedCount++;
      }
    });

    if (addedCount > 0) {
      saveCrm(updated);
      if (newDispatchableKeys.length > 0) {
        setSelectedWaLeads(prev => Array.from(new Set([...newDispatchableKeys, ...prev])));
      }
showToast(`${addedCount} leads adicionados ao CRM!`, 'success');
      } else {
        showToast('Todos esses leads já existem no CRM.', 'info');
    }
  };

  // Remove lead from CRM
  const handleRemoveFromCRM = (nome: string) => {
    if (confirm(`Tem certeza que deseja excluir o lead "${nome}" do CRM?`)) {
      const removedLead = crmLeads.find(l => l.nome === nome);
      const updated = crmLeads.filter(l => l.nome !== nome);
      saveCrm(updated);
      setSelectedCrmLeads(prev => prev.filter(n => n !== nome));
      if (removedLead) {
        setSelectedWaLeads(prev => prev.filter(key => key !== getLeadKey(removedLead)));
        deleteCrmFromCloud([getLeadKey(removedLead)]);
      }
    }
  };

  // Toggle selection for a single lead
  const handleToggleSelectCrmLead = (nome: string) => {
    setSelectedCrmLeads(prev => 
      prev.includes(nome) ? prev.filter(n => n !== nome) : [...prev, nome]
    );
  };

  // Toggle selection for a single WhatsApp lead
  const handleToggleSelectWaLead = (leadKey: string) => {
    if (isSendingBulk) return;
    setSelectedWaLeads(prev =>
      prev.includes(leadKey) ? prev.filter(key => key !== leadKey) : [...prev, leadKey]
    );
  };

  // Toggle selection for all dispatchable WhatsApp leads
  const handleToggleSelectAllWaLeads = (dispatchable: any[]) => {
    if (isSendingBulk) return;
    const allKeys = dispatchable.map(getLeadKey);
    const areAllSelected = allKeys.every(key => selectedWaLeads.includes(key));

    if (areAllSelected) {
      setSelectedWaLeads(prev => prev.filter(key => !allKeys.includes(key)));
    } else {
      setSelectedWaLeads(prev => {
        const unique = new Set([...prev, ...allKeys]);
        return Array.from(unique);
      });
    }
  };

  // Toggle selection for all filtered leads
  const handleToggleSelectAllCrmLeads = (filteredLeads: any[]) => {
    const allFilteredNames = filteredLeads.map(l => l.nome);
    const areAllSelected = allFilteredNames.every(name => selectedCrmLeads.includes(name));
    
    if (areAllSelected) {
      setSelectedCrmLeads(prev => prev.filter(name => !allFilteredNames.includes(name)));
    } else {
      setSelectedCrmLeads(prev => {
        const unique = new Set([...prev, ...allFilteredNames]);
        return Array.from(unique);
      });
    }
  };

  // Bulk remove selected leads from CRM
  const handleRemoveSelectedFromCRM = () => {
    if (selectedCrmLeads.length === 0) return;
    if (confirm(`Tem certeza que deseja excluir os ${selectedCrmLeads.length} leads selecionados do CRM?`)) {
      const removedKeys = crmLeads
        .filter(l => selectedCrmLeads.includes(l.nome))
        .map(getLeadKey);
      const updated = crmLeads.filter(l => !selectedCrmLeads.includes(l.nome));
      saveCrm(updated);
      setSelectedCrmLeads([]);
      setSelectedWaLeads(prev => prev.filter(key => !removedKeys.includes(key)));
      deleteCrmFromCloud(removedKeys);
    }
  };

  // Bulk stage change for selected CRM leads
  const handleBulkStageChange = async () => {
    if (selectedCrmLeads.length === 0 || bulkStageLoading) return;
    setBulkStageLoading(true);
    const updated = crmLeads.map(l => {
      if (selectedCrmLeads.includes(l.nome)) {
        return { ...l, stage: bulkStageTarget };
      }
      return l;
    });
    saveCrm(updated);
    setBulkStageLoading(false);
    showToast(`${selectedCrmLeads.length} leads movidos para "${bulkStageTarget}"`, 'success');
  };

  const handleReEnrichSelected = async () => {
    const toEnrich = crmLeads.filter(l => selectedCrmLeads.includes(l.nome) && l.site && l.site !== 'Sem site');
    if (toEnrich.length === 0) {
      showToast('Nenhum lead selecionado com site para enriquecer.', 'warning');
      return;
    }
    setEnrichLoading(true);
    let enriched = 0;
    const updated = [...crmLeads];
    for (const lead of toEnrich) {
      try {
        const headers = await getAuthedJsonHeaders();
        if (!headers) return;
        const res = await fetch('/api/lead-enrich', {
          method: 'POST',
          headers,
          body: JSON.stringify({ nome: lead.nome, site: lead.site, cidade: lead.cidade })
        });
        const data = await res.json();
        if (data.success && data.enriched) {
          const idx = updated.findIndex(l => l.nome === lead.nome);
          if (idx >= 0) {
            updated[idx] = { ...updated[idx], ...data.enriched };
          }
          enriched++;
        }
      } catch {}
    }
    saveCrm(updated);
    setEnrichLoading(false);
    showToast(`${enriched} de ${toEnrich.length} leads re-enriquecidos!`, 'success');
  };

  const handleReEnrichSingle = async (lead: any) => {
    if (!lead.site || lead.site === 'Sem site') {
      showToast('Lead sem site para enriquecer.', 'warning');
      return;
    }
    try {
      const headers = await getAuthedJsonHeaders();
      if (!headers) return;
      const res = await fetch('/api/lead-enrich', {
        method: 'POST',
        headers,
        body: JSON.stringify({ nome: lead.nome, site: lead.site, cidade: lead.cidade })
      });
      const data = await res.json();
      if (data.success && data.enriched) {
        const updated = crmLeads.map(l => {
          if (l.nome === lead.nome) return { ...l, ...data.enriched };
          return l;
        });
        saveCrm(updated);
        showToast(`"${lead.nome}" enriquecido!`, 'success');
      } else {
        showToast(`Falha ao enriquecer "${lead.nome}".`, 'error');
      }
    } catch {
      showToast(`Erro ao enriquecer "${lead.nome}".`, 'error');
    }
  };

  const finishBulkQueue = () => {
    setIsSendingBulk(false);
    setIsAutoSending(false);
    autoSendCancelled.current = false;
    setBulkIndex(-1);
    setBulkTimer(0);
    setBulkQueue([]);
  };

  const handleStopBulkSending = () => {
    autoSendCancelled.current = true;
    finishBulkQueue();
  };

  const handleStartBulkSending = () => {
    const queue = selectedWaDispatchableLeads;
    if (queue.length === 0) {
      showToast('Nenhum lead com telefone selecionado.', 'warning');
      return;
    }
    setBulkQueue(queue);
    setIsSendingBulk(true);
    handleTriggerBulkSendLead(0, queue);
  };

  const handleTriggerBulkSendLead = (index: number, queueOverride?: any[]) => {
    const queue = queueOverride || bulkQueue;
    if (index < 0 || index >= queue.length) return;

    const lead = queue[index];
    setBulkIndex(index);

    let delay = getSafeBulkDelay();
    if (bulkSimulateHuman) {
      const variance = Math.floor(Math.random() * 9) - 4;
      delay = Math.max(10, delay + variance);
    }
    setBulkTimer(bulkAutoNext ? delay : 0);
    openWhatsApp(lead, waTemplate, {
      markSent: false,
      preferWeb: true,
      target: /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ? '_blank' : 'geoleads_whatsapp_queue',
    });
  };

  const handleConfirmSentAndNext = () => {
    if (!isSendingBulk || bulkIndex < 0 || !bulkQueue[bulkIndex]) return;

    const lead = bulkQueue[bulkIndex];
    setWaSentStatus(prev => ({ ...prev, [lead.nome]: true }));

    const nextIndex = bulkIndex + 1;
    if (nextIndex < bulkQueue.length) {
      handleTriggerBulkSendLead(nextIndex);
    } else {
      showToast('Fila concluída! Todos os contatos enviados.', 'success');
      finishBulkQueue();
    }
  };

  const getSafeBulkDelay = () => {
    if (bulkDelay.trim() === '') return 20;
    const value = Number(bulkDelay);
    if (!Number.isFinite(value)) return 20;
    return Math.min(120, Math.max(10, value));
  };

  const handleStartAutoBulkSend = async () => {
    const queue = selectedWaDispatchableLeads;
    if (queue.length === 0) {
      showToast('Nenhum lead com telefone selecionado.', 'warning');
      return;
    }
    if (chatbotSession.status !== 'connected') {
      showToast('Conecte o WhatsApp no Chatbot primeiro!', 'warning');
      setActiveTab('chatbot');
      return;
    }
    setBulkQueue(queue);
    setIsSendingBulk(true);
    setIsAutoSending(true);
    setBulkAutoNext(true);

    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return;

    for (let i = 0; i < queue.length; i++) {
      if (autoSendCancelled.current) break;

      const lead = queue[i];
      setBulkIndex(i);
      const delay = getSafeBulkDelay();
      const variance = Math.floor(Math.random() * 9) - 4;
      const finalDelay = Math.max(5, delay + variance);

      const message = renderWhatsAppMessage(lead);
      try {
        const res = await fetch('/api/chatbot/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ leadName: lead.nome, leadPhone: lead.telefone, message, leadId: lead.id })
        });
        if (res.ok) {
          setWaSentStatus(prev => ({ ...prev, [lead.nome]: true }));
        } else {
          const err = await res.json();
          showToast(`Falha ao enviar para ${lead.nome}: ${err.error || 'erro'}`, 'error');
        }
      } catch {
        showToast(`Erro ao enviar para ${lead.nome}`, 'error');
      }

      if (i < queue.length - 1) {
        const waitSteps = Math.ceil(finalDelay / 0.5);
        for (let w = 0; w < waitSteps; w++) {
          if (autoSendCancelled.current) break;
          await new Promise(r => setTimeout(r, 500));
        }
        if (autoSendCancelled.current) break;
      }
    }
    showToast(`Disparo automático concluído! ${queue.length} mensagens enviadas.`, 'success');
    finishBulkQueue();
    handleLoadSentMessages();
  };

  const handleSendViaBot = async (lead: any) => {
    if (!requireFeature('whatsappSender')) {
      setActiveTab('whatsapp');
      return;
    }
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
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ leadName: lead.nome, leadPhone: lead.telefone, message, leadId: lead.id })
      });
      if (res.ok) {
        setWaSentStatus(prev => ({ ...prev, [lead.nome]: true }));
        handleLoadSentMessages();
      } else {
        const err = await res.json();
        showToast(err.error || 'Falha ao enviar via bot.', 'error');
      }
    } catch (err: any) {
      showToast('Erro ao enviar: ' + (err.message || 'desconhecido'), 'error');
    } finally {
      setWaSendingViaBot(prev => ({ ...prev, [leadKey]: false }));
    }
  };

  const handleLoadSentMessages = async () => {
    if (!user || !requireFeature('whatsappSender')) return;
    setWaSentMessagesLoading(true);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) return;
      const res = await fetch('/api/chatbot/messages', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const json = await res.json();
      if (json.success) setWaSentMessages(json.messages || []);
    } catch {} finally {
      setWaSentMessagesLoading(false);
    }
  };

  // Update CRM Lead field (stage or notes)
  const handleUpdateCRMLead = (nome: string, field: 'stage' | 'notes', value: string) => {
    const updated = crmLeads.map(l => {
      if (l.nome === nome) {
        return { ...l, [field]: value };
      }
      return l;
    });
    saveCrm(updated);
  };

  // Extraction trigger
  const handleExtract = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      router.push('/login');
      return;
    }

    const selectedFilters = filterRule.split(',').map(s => s.trim()).filter(Boolean);
    for (const f of selectedFilters) {
      const opt = filterOptions.find(o => o.value === f);
      if (opt && !requireFeature(opt.feature)) {
        showLockedFeature(opt.feature);
        return;
      }
    }

    if (tokens !== null && Number(limit) > tokens) {
      showToast(`Saldo insuficiente! Pediu ${limit} leads mas tem ${tokens} tokens.`, 'error');
      return;
    }

    setIsExtracting(true);
    setHasSearched(false);
    setLeads([]);
    setExtractStats(null);

    try {
      const headers = await getAuthedJsonHeaders();
      if (!headers) return;

      const res = await fetch('/api/extract', {
        method: 'POST',
        headers,
        body: JSON.stringify({ keyword, location, limit: Number(limit), filterRule })
      });
      
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Erro ao extrair leads.');
      }
      
      if (data.success && data.leads) {
        setLeads(data.leads);
        if (data.stats) {
          setExtractStats(data.stats);
          if (data.stats.correctedKeyword) setKeyword(data.stats.correctedKeyword);
          if (data.stats.correctedLocation) setLocation(data.stats.correctedLocation);
        }
        
        if (typeof data.stats?.tokensRemaining === 'number') {
          setTokens(data.stats.tokensRemaining);
        } else if (tokens !== null && data.leads.length > 0) {
          setTokens(Math.max(0, tokens - data.leads.length));
        }
      } else if (data.error) {
showToast("Erro: " + data.error, 'error');
      } else {
        throw new Error(data.error || 'Erro desconhecido');
      }
    } catch (err: any) {
      const message = err.message || 'Erro inesperado ao extrair leads';
      showToast("Erro: " + message, 'error');
    } finally {
      setIsExtracting(false);
      setHasSearched(true);
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const fetchHistory = async () => {
    setHistoryLoading(true);
    setShowHistory(true);
    try {
      const headers = await getAuthedJsonHeaders();
      if (!headers) return;
      const res = await fetch('/api/extract/history', { headers });
      const data = await res.json();
      if (data.success) setHistoryData(data.history || []);
    } catch {} finally {
      setHistoryLoading(false);
    }
  };

  const exportToCSV = () => {
    if (!requireFeature('export')) {
      showLockedFeature('export');
      return;
    }

    if (leads.length === 0) return;
    const esc = (v: string) => `"${(v || '').replace(/"/g, '""')}"`;
    const headers = ['Empresa', 'Telefone', 'E-mail', 'CNPJ', 'Avaliação', 'Instagram', 'Facebook', 'TikTok', 'Site'];
    const csvContent = [
      headers.join(','),
      ...leads.map(l => [
        esc(l.nome),
        esc(l.telefone),
        esc(l.email),
        esc(l.cnpj),
        esc(l.avaliacao),
        esc(l.instagram),
        esc(l.facebook),
        esc(l.tiktok),
        esc(l.site)
      ].join(','))
    ].join('\n');
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `GeoLeads_${keyword}_${new Date().toLocaleDateString('pt-BR')}.csv`;
    link.click();
  };

  const exportToXLSX = async () => {
    if (!requireFeature('export')) {
      showLockedFeature('export');
      return;
    }
    if (leads.length === 0) return;
    try {
      const headers = await getAuthedJsonHeaders();
      if (!headers) return;
      const res = await fetch('/api/export/xlsx', {
        method: 'POST',
        headers,
        body: JSON.stringify({ leads, filename: `GeoLeads_${keyword}_${new Date().toLocaleDateString('pt-BR')}.xlsx` })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erro ao exportar XLSX');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `GeoLeads_${keyword}_${new Date().toLocaleDateString('pt-BR')}.xlsx`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      showToast(err.message || 'Erro ao exportar XLSX', 'error');
    }
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

    if (!requireFeature('aiCopy')) {
      setActiveTab('ia');
      return;
    }

    if (!waAiProduct || !waAiValue) {
      setWaAiMessage('Preencha a oferta e o principal benefício para gerar modelos.');
      return;
    }

    setWaAiLoading(true);
    setWaAiMessage('');
    setWaAiCopies([]);

    try {
      const headers = await getAuthedJsonHeaders();
      if (!headers) return;

      const res = await fetch('/api/ai-copy', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          product: waAiProduct,
          value: waAiValue,
          tone: waAiTone,
          channel: 'whatsapp',
          audience: keyword || waPreviewLead.nicho || 'empresas locais'
        })
      });
      const data = await res.json();

      if (!data.success || !data.copies) {
        throw new Error(data.error || 'Erro inesperado.');
      }

      setWaAiCopies(data.copies);
      setWaAiMessage(data.source === 'gemini_ai'
        ? `Modelos gerados com IA (${data.model}).`
        : data.warning || 'Modelos locais gerados sem custo de API.'
      );
    } catch (error: any) {
      setWaAiMessage(error.message || 'Erro ao gerar modelos.');
    } finally {
      setWaAiLoading(false);
    }
  };

  // WhatsApp Trigger Helper
  const openWhatsApp = (
    lead: any,
    customText?: string,
    options?: { markSent?: boolean; preferWeb?: boolean; target?: string }
  ) => {
    if (!requireFeature('whatsappSender')) {
      setActiveTab('whatsapp');
      return;
    }

    if (!lead.telefone || lead.telefone === 'Não informado') {
      showToast('Lead sem telefone válido.', 'warning');
      return;
    }
    const number = lead.telefone.replace(/\D/g, ''); 
    if (number.length < 10) {
      showToast('Número de telefone inválido.', 'warning');
      return;
    }

    let msg = '';
    if (customText) {
      msg = renderWhatsAppMessage(lead, customText);
    } else {
      msg = `Olá! Vi o perfil da *${lead.nome}* no Google e gostaria de saber mais sobre os serviços de vocês. Podemos conversar?`;
    }

    const messageEncoded = encodeURIComponent(msg);
    const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
    const url = options?.preferWeb && !isMobile
      ? `https://web.whatsapp.com/send?phone=55${number}&text=${messageEncoded}`
      : `https://wa.me/55${number}?text=${messageEncoded}`;
    window.open(url, options?.target || '_blank');
    
    if (options?.markSent !== false) {
      setWaSentStatus(prev => ({ ...prev, [lead.nome]: true }));
    }
  };

  // AI Message Copywriting Engine (Gemini integration with local fallback)
  const generateAICopies = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requireFeature('aiCopy')) {
      setActiveTab('ia');
      return;
    }

    if (!aiProduct || !aiValue) {
      showToast('Preencha os campos para gerar copys.', 'warning');
      return;
    }

    setIsGeneratingCopies(true);
    setGeneratedCopies(null);

    try {
      const headers = await getAuthedJsonHeaders();
      if (!headers) return;

      const res = await fetch('/api/ai-copy', {
        method: 'POST',
        headers,
        body: JSON.stringify({ product: aiProduct, value: aiValue, tone: aiTone, channel: 'mixed' })
      });
      const data = await res.json();
      if (data.success && data.copies) {
        setGeneratedCopies(data.copies);
      } else {
        showToast('Erro ao gerar roteiros: ' + (data.error || 'Erro inesperado.'), 'error');
      }
    } catch (err: any) {
      console.error(err);
      showToast('Erro de conexão ao gerar roteiros.', 'error');
    } finally {
      setIsGeneratingCopies(false);
    }
  };

  // Filter options config for beautiful Grid Selection
  const filterOptions = [
    { value: 'none', label: 'Trazer tudo', icon: '🔍', desc: 'Recomendado para varredura completa', feature: 'extractor' as FeatureKey },
    { value: 'phone', label: 'Só Telefone', icon: '📞', desc: 'Filtra empresas com contato telefônico', feature: 'extractor' as FeatureKey },
    { value: 'cnpj', label: 'Só CNPJ', icon: '🏢', desc: 'Filtra empresas com CNPJ no site', feature: 'cnpjEnrichment' as FeatureKey },
    { value: 'email', label: 'Só E-mail', icon: '✉️', desc: 'Filtra empresas com e-mail no site', feature: 'emailEnrichment' as FeatureKey },
    { value: 'insta', label: 'Só Instagram', icon: '📷', desc: 'Extrai apenas contas com Instagram', feature: 'socialEnrichment' as FeatureKey },
    { value: 'face', label: 'Só Facebook', icon: '📘', desc: 'Filtra leads que possuem página Facebook', feature: 'socialEnrichment' as FeatureKey },
    { value: 'tiktok', label: 'Só TikTok', icon: '🎵', desc: 'Filtra leads com perfil TikTok', feature: 'socialEnrichment' as FeatureKey },
    { value: 'site', label: 'Só Site', icon: '🌐', desc: 'Filtra apenas empresas com site próprio', feature: 'extractor' as FeatureKey },
  ];

  const quickSearches = [
    { keyword: 'Clínicas de estética', location: 'São Paulo, SP' },
    { keyword: 'Dentistas', location: 'Belo Horizonte, MG' },
    { keyword: 'Academias', location: 'Rio de Janeiro, RJ' },
    { keyword: 'Restaurantes', location: 'Curitiba, PR' }
  ];

  // CRM Filter / Search logic
  const filteredCrmLeads = crmLeads.filter(lead => {
    const matchesSearch = 
      lead.nome.toLowerCase().includes(crmSearch.toLowerCase()) || 
      lead.telefone.toLowerCase().includes(crmSearch.toLowerCase()) ||
      lead.email?.toLowerCase().includes(crmSearch.toLowerCase()) ||
      lead.cnpj?.toLowerCase().includes(crmSearch.toLowerCase()) ||
      lead.nicho.toLowerCase().includes(crmSearch.toLowerCase()) ||
      lead.cidade.toLowerCase().includes(crmSearch.toLowerCase());
    
    if (crmFilterStage === 'all') return matchesSearch;
    return matchesSearch && lead.stage === crmFilterStage;
  });

  const crmTotalPages = Math.max(1, Math.ceil(filteredCrmLeads.length / CRM_PAGE_SIZE));
  const safeCrmPage = Math.min(crmPage, crmTotalPages - 1);
  const paginatedCrmLeads = filteredCrmLeads.slice(safeCrmPage * CRM_PAGE_SIZE, (safeCrmPage + 1) * CRM_PAGE_SIZE);

  const displayLeads = leads.length > 0 ? leads : [];

  return (
    <div className="app-shell min-h-screen text-white font-sans selection:bg-blue-500/30 relative pb-12 sm:pb-16 overflow-x-hidden">
      <Toast />
      <div className="absolute inset-0 bg-grid-pattern pointer-events-none opacity-40" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[min(720px,92vw)] h-[260px] bg-blue-700/10 blur-[90px] rounded-full pointer-events-none" />

      {/* NAVBAR */}
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
                  💰 {tokens !== null ? tokens.toLocaleString('pt-BR') : '...'} <span className="hidden sm:inline">Tokens</span>
                </div>
                <div className="px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-full bg-white/5 border border-white/10 text-gray-300 font-bold whitespace-nowrap">
                  {currentPlan.shortName}
                </div>
                <Link href="/account" className="text-gray-400 hover:text-white transition-colors font-medium">Conta</Link>
                <Link href="/pricing" className="text-gray-400 hover:text-white transition-colors font-medium">Planos</Link>
                <button onClick={logout} className="text-red-400 hover:text-red-300 font-medium cursor-pointer">Sair</button>
              </>
            ) : (
              <>
                <div className="hidden sm:flex px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-full bg-white/5 border border-white/10 items-center gap-1.5 text-[11px] sm:text-xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse shadow-[0_0_8px_rgba(74,222,128,0.8)]" />
                  <span className="hidden sm:inline">Motor Online</span>
                </div>
                <Link href="/login" className="px-3.5 py-1.5 sm:px-5 sm:py-2 rounded-full bg-white text-black font-semibold hover:bg-gray-200 transition-all text-xs sm:text-sm shadow-[0_0_15px_rgba(255,255,255,0.2)]">
                  Entrar
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
            <button
              type="button"
              onClick={() => setCheckoutNotice(null)}
              className="self-end sm:self-auto px-3 py-1.5 rounded-lg bg-white/10 border border-white/15 text-xs text-gray-200 hover:text-white cursor-pointer"
            >
              Fechar
            </button>
          </div>
        )}

        <header className="mb-6 sm:mb-8">
          <div className="dashboard-hero">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-300 text-xs font-bold mb-4">
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                Painel pronto para prospecção
              </div>
              <h1 className="text-2xl sm:text-4xl md:text-5xl font-extrabold tracking-tight mb-3 sm:mb-4 leading-tight max-w-4xl">
                Encontre, organize e aborde <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-300">clientes B2B</span>
              </h1>
              <p className="text-gray-400 text-sm sm:text-base md:text-lg max-w-2xl leading-relaxed">
                Escolha o nicho, a região e o nível de contato que você quer. O GeoLeads entrega a lista, o CRM e a abordagem em um fluxo só.
              </p>
              <div className="workflow-strip mt-5">
                <span>Maps</span>
                <span>CNPJ</span>
                <span>E-mail</span>
                <span>Redes</span>
                <span>WhatsApp</span>
              </div>
            </div>

            <LeadGuideWidget user={user} currentPlan={currentPlan} tokens={tokens} onNavigate={setActiveTab} />
          </div>

          <DashboardCharts userId={user?.id || ''} />

          {/* TAB NAVIGATION BAR */}
          <div className="app-tabs dashboard-tabs flex gap-2 mb-6 max-w-full overflow-x-auto no-scrollbar">
            <button 
              onClick={() => setActiveTab('extractor')}
              className={`app-tab px-3.5 py-2 sm:px-5 sm:py-2.5 rounded-t-xl text-xs sm:text-sm font-semibold transition-all duration-200 cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${activeTab === 'extractor' ? 'bg-blue-600/15 border-b-2 border-blue-500 text-blue-400' : 'text-gray-400 hover:text-white'}`}
            >
              🚀 Motor Extrator
            </button>
            <button 
              onClick={() => setActiveTab('crm')}
              className={`app-tab px-3.5 py-2 sm:px-5 sm:py-2.5 rounded-t-xl text-xs sm:text-sm font-semibold transition-all duration-200 cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${activeTab === 'crm' ? 'bg-blue-600/15 border-b-2 border-blue-500 text-blue-400' : 'text-gray-400 hover:text-white'}`}
            >
              📋 CRM de Leads
              {!requireFeature('crm') && <span className="text-[10px] text-amber-300">🔒</span>}
              {crmLeads.length > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-blue-500 text-black text-[10px] font-bold">{crmLeads.length}</span>
              )}
            </button>
            <button 
              onClick={() => setActiveTab('whatsapp')}
              className={`app-tab px-3.5 py-2 sm:px-5 sm:py-2.5 rounded-t-xl text-xs sm:text-sm font-semibold transition-all duration-200 cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${activeTab === 'whatsapp' ? 'bg-blue-600/15 border-b-2 border-blue-500 text-blue-400' : 'text-gray-400 hover:text-white'}`}
            >
              ⚡ Disparador WhatsApp
              {!requireFeature('whatsappSender') && <span className="text-[10px] text-amber-300">🔒</span>}
            </button>
            <button
              onClick={() => setActiveTab('chatbot')}
              className={`app-tab px-3.5 py-2 sm:px-5 sm:py-2.5 rounded-t-xl text-xs sm:text-sm font-semibold transition-all duration-200 cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${activeTab === 'chatbot' ? 'bg-blue-600/15 border-b-2 border-blue-500 text-blue-400' : 'text-gray-400 hover:text-white'}`}
            >
              🤖 Chatbot WhatsApp
              {!requireFeature('chatbot') && <span className="text-[10px] text-amber-300">🔒</span>}
            </button>
            <button 
              onClick={() => setActiveTab('ia')}
              className={`app-tab px-3.5 py-2 sm:px-5 sm:py-2.5 rounded-t-xl text-xs sm:text-sm font-semibold transition-all duration-200 cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${activeTab === 'ia' ? 'bg-blue-600/15 border-b-2 border-blue-500 text-blue-400' : 'text-gray-400 hover:text-white'}`}
            >
              🤖 Gerador de Copys IA
              {!requireFeature('aiCopy') && <span className="text-[10px] text-amber-300">🔒</span>}
            </button>
            <button 
              onClick={() => setActiveTab('support')}
              className={`app-tab px-3.5 py-2 sm:px-5 sm:py-2.5 rounded-t-xl text-xs sm:text-sm font-semibold transition-all duration-200 cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${activeTab === 'support' ? 'bg-blue-600/15 border-b-2 border-blue-500 text-blue-400' : 'text-gray-400 hover:text-white'}`}
            >
              🙋‍♀️ Suporte & Avaliação
            </button>
          </div>
        </header>

        {activeTabLocked && activeTabFeature && (
          <LockedFeaturePanel feature={activeTabFeature} activeTab={activeTab} currentPlan={currentPlan} getUpgradePlan={getUpgradePlan} />
        )}

        {/* ==================== TAB 1: EXTRACTOR ==================== */}
        {activeTab === 'extractor' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 lg:gap-8 relative z-20">
            {/* PAINEL DE BUSCA */}
            <div className="lg:col-span-1 animate-slide-up" style={{ animationDelay: '0.1s' }}>
              <div className="app-card p-7 rounded-[2rem] bg-gradient-to-b from-white/[0.05] to-black/40 border border-white/10 shadow-2xl relative overflow-hidden group hover:border-blue-500/30 transition-all duration-500">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-500" />
                
                <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
                  <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  Nova Extração Avançada
                </h2>

                <form onSubmit={handleExtract} className="space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">Comece por um modelo rápido</label>
                    <div className="quick-preset-grid">
                      {quickSearches.map((preset) => (
                        <button
                          key={`${preset.keyword}-${preset.location}`}
                          type="button"
                          onClick={() => {
                            setKeyword(preset.keyword);
                            setLocation(preset.location);
                            setFilterRule('none');
                          }}
                          className="quick-preset"
                        >
                          <span>{preset.keyword}</span>
                          <small>{preset.location}</small>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">O que você procura?</label>
                    <input 
                      type="text" 
                      placeholder="ex: Academias, Dentistas..."
                      className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                      value={keyword}
                      onChange={(e) => setKeyword(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">Qual cidade/região?</label>
                    <input 
                      type="text" 
                      placeholder="ex: São Paulo, SP"
                      className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">Quantos Leads? (-1 Token/Lead)</label>
                    <input 
                      type="number" min="1" max="500"
                      style={{ colorScheme: 'dark' }}
                      className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                      value={limit}
                      onChange={(e) => setLimit(e.target.value === '' ? '' : Number(e.target.value))}
                      required
                    />
                  </div>

                  {/* PREMIUM GRID CHIPS FOR FILTER SELECTOR */}
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">Filtros (selecione um ou mais)</label>
                    <div className="extract-filter-grid">
                      {filterOptions.map((opt) => {
                        const selectedSet = new Set(filterRule.split(',').map(s => s.trim()).filter(Boolean));
                        const isSelected = filterRule === 'none' && opt.value === 'none' ? true : selectedSet.has(opt.value);
                        const isLocked = !requireFeature(opt.feature);
                        const requiredPlan = getUpgradePlan(opt.feature);
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => {
                              if (isLocked) { showLockedFeature(opt.feature); return; }
                              if (opt.value === 'none') { setFilterRule('none'); return; }
                              const current = new Set(filterRule.split(',').map(s => s.trim()).filter(Boolean));
                              if (current.has(opt.value)) current.delete(opt.value); else current.add(opt.value);
                              if (current.size === 0) { setFilterRule('none'); return; }
                              current.delete('none');
                              setFilterRule(Array.from(current).join(','));
                            }}
                            className={`filter-option-card ${
                              isLocked
                                ? 'is-locked'
                                : isSelected
                                  ? 'is-selected'
                                  : ''
                            }`}
                          >
                            <span className="text-xl flex items-center justify-between">
                              <span>{opt.icon}</span>
                              {isLocked && <span className="text-[10px] text-amber-300">🔒 {requiredPlan.shortName}</span>}
                            </span>
                            <span className="text-xs font-bold leading-tight block text-gray-200 mt-1">{opt.label}</span>
                            {isSelected && (
                              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-blue-400" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-[11px] text-gray-500 mt-2">Você só consome tokens pelos leads que possuírem o item escolhido.</p>
                  </div>
                  
                  <button 
                    type="submit"
                    disabled={isExtracting}
                    className={`w-full py-3.5 rounded-xl font-bold text-white transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer ${isExtracting ? 'bg-blue-600/50 cursor-wait' : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 hover:shadow-[0_0_20px_rgba(59,130,246,0.5)] hover:-translate-y-1 active:scale-95'}`}
                  >
                    {isExtracting ? (
                      <>
                        <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Motor Trabalhando...
                      </>
                    ) : (
                      user ? '🚀 Iniciar Extração' : '🔒 Criar Conta para Extrair'
                    )}
                  </button>
                </form>
              </div>
            </div>

            {/* PAINEL DE RESULTADOS */}
            <div className="lg:col-span-2 animate-slide-up" style={{ animationDelay: '0.2s' }}>
              <div className="app-card p-7 rounded-[2rem] bg-gradient-to-b from-white/[0.03] to-black/40 border border-white/10 h-full min-h-[400px] flex flex-col shadow-2xl">
                
                {/* Header dos resultados */}
                <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
                  <div>
                    <h2 className="text-xl font-semibold">
                      {isExtracting ? '⏳ Extraindo...' : leads.length > 0 ? `✅ ${leads.length} Leads Encontrados!` : 'Vitrine de Resultados'}
                    </h2>
                    {extractStats && (
                      <div className="mt-1 space-y-0.5 animate-fade-in">
                        <p className="text-xs text-gray-500">
                          Mapeou {extractStats.scanned} empresas em {extractStats.time} segundos.
                        </p>
                        {extractStats.correctedKeyword && (
                          <p className="text-xs text-blue-400 font-medium">
                            ✨ Busca normalizada: "{extractStats.correctedKeyword} em {extractStats.correctedLocation}"
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="app-action-row w-full sm:w-auto">
                    <button 
                      onClick={handleAddAllToCRM}
                      disabled={leads.length === 0}
                      className="flex flex-1 sm:flex-none items-center justify-center gap-2 text-sm text-gray-200 hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed bg-white/5 hover:bg-white/10 px-4 py-2 rounded-lg border border-white/10 cursor-pointer"
                    >
                      📁 Salvar no CRM
                    </button>
                    <button 
                      onClick={exportToCSV}
                      disabled={leads.length === 0}
                      className="flex flex-1 sm:flex-none items-center justify-center gap-2 text-sm text-blue-400 hover:text-blue-300 transition-colors disabled:opacity-30 disabled:cursor-not-allowed bg-blue-500/10 px-4 py-2 rounded-lg border border-blue-500/20 cursor-pointer"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      Exportar CSV
                    </button>
                    <button 
                      onClick={exportToXLSX}
                      disabled={leads.length === 0}
                      className="flex flex-1 sm:flex-none items-center justify-center gap-2 text-sm text-emerald-400 hover:text-emerald-300 transition-colors disabled:opacity-30 disabled:cursor-not-allowed bg-emerald-500/10 px-4 py-2 rounded-lg border border-emerald-500/20 cursor-pointer"
                    >
                      📊 XLSX
                    </button>
                    <button 
                      onClick={fetchHistory}
                      className="flex flex-1 sm:flex-none items-center justify-center gap-2 text-sm text-amber-400 hover:text-amber-300 transition-colors bg-amber-500/10 px-4 py-2 rounded-lg border border-amber-500/20 cursor-pointer"
                    >
                      🕐 Histórico
                    </button>
                  </div>
                </div>

                {/* Loading State (High-tech Hacker Radar) */}
                {isExtracting && (
                  <div className="flex-1 py-4">
                    <HackerRadar keyword={keyword} location={location} />
                  </div>
                )}

                {/* Tabela de Resultados */}
                {!isExtracting && (
                  <div className="flex-1 rounded-2xl border border-white/5 bg-black/20 overflow-hidden relative overflow-y-auto max-h-[500px]">
                    <table className="hidden md:table w-full text-left text-sm">
                      <thead className="bg-white/5 border-b border-white/5 text-gray-400 sticky top-0 backdrop-blur-md z-10">
                        <tr>
                          <th className="px-4 py-3 font-medium">Empresa</th>
                          <th className="px-4 py-3 font-medium">Contato</th>
                          <th className="px-4 py-3 font-medium">E-mail</th>
                          <th className="px-4 py-3 font-medium">Redes</th>
                          <th className="px-4 py-3 font-medium">Categoria</th>
                          <th className="px-4 py-3 font-medium">Endereço</th>
                          <th className="px-4 py-3 font-medium">Horários</th>
                          <th className="px-4 py-3 font-medium">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {displayLeads.map((lead: any, i: number) => (
                          <tr key={i} className="hover:bg-white/[0.06] transition-colors animate-slide-up" style={{ animationDelay: `${i * 0.03}s` }}>
                            <td className="px-4 py-4 font-medium text-gray-200">
                              <div>{lead.nome}</div>
                              {lead.site && lead.site !== 'Sem site' ? (
                                <a href={lead.site} target="_blank" className="inline-block text-xs text-blue-400 hover:underline mt-1">🌐 Site Oficial</a>
                              ) : (
                                <span className="text-xs text-gray-600 mt-1 block">Sem site comercial</span>
                              )}
                              {lead.cnpj && (
                                <span className="block text-[11px] text-amber-300 font-mono mt-1">CNPJ {lead.cnpj}</span>
                              )}
                            </td>
                            <td className="px-4 py-4 text-gray-400 font-mono text-xs">
                              <div className="flex flex-col gap-1">
                                <span>{lead.telefone}</span>
                                {lead.telefone && lead.telefone !== 'Não informado' && (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-green-500/10 text-green-400 border border-green-500/20 text-[10px] w-fit">
                                    ✓ Válido
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-4 text-xs">
                              {lead.email ? (
                                <a href={`mailto:${lead.email}`} className="text-purple-400 hover:underline font-mono">{lead.email}</a>
                              ) : (
                                <span className="text-gray-600">—</span>
                              )}
                            </td>
                            <td className="px-4 py-4">
                              <div className="flex flex-col gap-1">
                                {lead.instagram && (
                                  <a href={lead.instagram} target="_blank" className="text-pink-400 text-xs hover:underline">📷 Instagram</a>
                                )}
                                {lead.facebook && (
                                  <a href={lead.facebook} target="_blank" className="text-blue-500 text-xs hover:underline">📘 Facebook</a>
                                )}
                                {lead.tiktok && (
                                  <a href={lead.tiktok} target="_blank" className="text-cyan-300 text-xs hover:underline">🎵 TikTok</a>
                                )}
                                {!lead.instagram && !lead.facebook && !lead.tiktok && (
                                  <span className="text-gray-600 text-xs">—</span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-4 text-xs text-gray-400">
                              {lead.categoria || '-'}
                            </td>
                            <td className="px-4 py-4 text-xs text-gray-400 max-w-[200px] truncate" title={lead.endereco || '-'}>
                              {lead.endereco || '-'}
                            </td>
                            <td className="px-4 py-4 text-xs text-gray-400">
                              {lead.horarios || '-'}
                            </td>
                            <td className="px-4 py-4">
                              <div className="flex items-center gap-2">
                                <button 
                                  onClick={() => handleAddToCRM(lead)}
                                  className="p-2 rounded bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10 hover:border-white/20 transition-all text-xs cursor-pointer flex items-center gap-1"
                                  title="Salvar no CRM"
                                >
                                  📁 Salvar
                                </button>
                                {lead.telefone && lead.telefone !== 'Não informado' && (
                                  <button 
                                    onClick={() => openWhatsApp(lead)}
                                    className="p-2 rounded bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20 transition-colors text-xs cursor-pointer"
                                    title="WhatsApp Direto"
                                  >
                                    💬 Whatsapp
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                        
                        {/* Estado vazio: antes de buscar */}
                        {displayLeads.length === 0 && !hasSearched && !isExtracting && (
                          <tr>
                            <td colSpan={8} className="px-4 py-16 text-center">
                              <div className="text-4xl mb-4">🔍</div>
                              <p className="text-gray-300 font-medium text-lg mb-2">Pronto para começar!</p>
                              <p className="text-gray-500 text-sm max-w-md mx-auto">
                                Preencha o formulário ao lado com o nicho e a cidade desejada, defina a quantidade de leads e clique em <span className="text-blue-400 font-semibold">Iniciar Extração</span>.
                              </p>
                            </td>
                          </tr>
                        )}

                        {/* Estado vazio: depois de buscar e não achar nada */}
                        {displayLeads.length === 0 && hasSearched && !isExtracting && (
                          <tr>
                            <td colSpan={8} className="px-4 py-16 text-center">
                              <div className="text-4xl mb-4">🕵️</div>
                              <p className="text-gray-300 font-medium text-lg mb-2">Nenhum lead encontrado</p>
                              <p className="text-gray-500 text-sm max-w-lg mx-auto">
                                O motor não encontrou empresas que atendam ao filtro selecionado nessa região.
                                <br/><br/>
                                <span className="text-blue-400 font-semibold">Nenhum Token foi descontado.</span> Tente mudar o filtro para "Trazer tudo" ou busque outra cidade.
                              </p>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>

                    {/* Mobile Card List */}
                    <div className="mobile-card-list md:hidden p-3 sm:p-4">
                      {displayLeads.map((lead: any, i: number) => (
                        <div 
                          key={i} 
                          className="p-4 rounded-xl bg-white/[0.02] border border-white/5 flex flex-col gap-3 animate-slide-up"
                          style={{ animationDelay: `${i * 0.03}s` }}
                        >
                          <div>
                            <div className="font-bold text-gray-200 text-sm">{lead.nome}</div>
                            {lead.site && lead.site !== 'Sem site' ? (
                              <a href={lead.site} target="_blank" className="inline-block text-xs text-blue-400 hover:underline mt-1">🌐 Site Oficial</a>
                            ) : (
                              <span className="text-xs text-gray-600 mt-1 block">Sem site comercial</span>
                            )}
                            {lead.cnpj && (
                              <span className="block text-[11px] text-amber-300 font-mono mt-1">CNPJ {lead.cnpj}</span>
                            )}
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs border-t border-white/5 pt-3">
                            <div>
                              <span className="text-gray-500 block mb-0.5">Contato</span>
                              <span className="font-mono text-gray-300 block break-words">{lead.telefone}</span>
                              {lead.telefone && lead.telefone !== 'Não informado' && (
                                <span className="inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 rounded bg-green-500/10 text-green-400 border border-green-500/20 text-[9px] w-fit">
                                  ✓ Válido
                                </span>
                              )}
                            </div>
                            <div>
                              <span className="text-gray-500 block mb-0.5">E-mail</span>
                              {lead.email ? (
                                <a href={`mailto:${lead.email}`} className="text-purple-400 hover:underline font-mono block break-all">{lead.email}</a>
                              ) : (
                                <span className="text-gray-600 block">—</span>
                              )}
                            </div>
                          </div>

                          <div className="flex justify-between items-center border-t border-white/5 pt-3 gap-2 flex-wrap">
                            <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                              {lead.instagram && (
                                <a href={lead.instagram} target="_blank" className="text-pink-400 text-xs hover:underline bg-pink-500/5 px-2 py-1 rounded border border-pink-500/10">📷 Insta</a>
                              )}
                              {lead.facebook && (
                                <a href={lead.facebook} target="_blank" className="text-blue-500 text-xs hover:underline bg-blue-500/5 px-2 py-1 rounded border border-blue-500/10">📘 Face</a>
                              )}
                              {lead.tiktok && (
                                <a href={lead.tiktok} target="_blank" className="text-cyan-300 text-xs hover:underline bg-cyan-500/5 px-2 py-1 rounded border border-cyan-500/10">🎵 TikTok</a>
                              )}
                            </div>

                            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto mt-2 sm:mt-0">
                              <button 
                                onClick={() => handleAddToCRM(lead)}
                                className="w-full sm:w-auto px-3 py-2 rounded bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10 text-xs cursor-pointer flex items-center justify-center gap-1"
                              >
                                📁 Salvar
                              </button>
                              {lead.telefone && lead.telefone !== 'Não informado' && (
                                <button 
                                  onClick={() => openWhatsApp(lead)}
                                  className="w-full sm:w-auto px-3 py-2 rounded bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20 text-xs cursor-pointer flex items-center justify-center gap-1"
                                >
                                  💬 WhatsApp
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}

                      {/* Estado vazio: antes de buscar */}
                      {displayLeads.length === 0 && !hasSearched && !isExtracting && (
                        <div className="py-16 text-center">
                          <div className="text-4xl mb-4">🔍</div>
                          <p className="text-gray-300 font-medium text-lg mb-2">Pronto para começar!</p>
                          <p className="text-gray-500 text-xs max-w-xs mx-auto">
                            Preencha o formulário acima com o nicho e a cidade desejada, defina a quantidade de leads e clique em <span className="text-blue-400 font-semibold">Iniciar Extração</span>.
                          </p>
                        </div>
                      )}

                      {/* Estado vazio: depois de buscar e não achar nada */}
                      {displayLeads.length === 0 && hasSearched && !isExtracting && (
                        <div className="py-16 text-center">
                          <div className="text-4xl mb-4">🕵️</div>
                          <p className="text-gray-300 font-medium text-lg mb-2">Nenhum lead encontrado</p>
                          <p className="text-gray-500 text-xs max-w-xs mx-auto">
                            O motor não encontrou empresas que atendam ao filtro selecionado nessa região. Tente mudar o filtro ou busque outra cidade.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ==================== TAB 2: CRM ==================== */}
        {activeTab === 'crm' && !activeTabLocked && (
          <div className="app-card p-7 rounded-[2rem] bg-gradient-to-b from-white/[0.03] to-black/40 border border-white/10 shadow-2xl relative overflow-hidden animate-slide-up">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-500" />
            
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
              <div>
                <h2 className="text-2xl font-bold flex items-center gap-2">
                  📋 Seu CRM de Vendas
                </h2>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <p className="text-xs text-gray-500">Gerencie os leads que você já salvou e altere as etapas do funil comercial.</p>
                  <span className={`text-[10px] px-2 py-1 rounded-full border font-bold ${
                    crmSyncStatus === 'cloud' ? 'bg-green-500/10 border-green-500/20 text-green-400' :
                    crmSyncStatus === 'syncing' ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' :
                    crmSyncStatus === 'error' ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' :
                    'bg-white/5 border-white/10 text-gray-400'
                  }`}>
                    {crmSyncMessage}
                  </span>
                </div>
              </div>

              {/* SEARCH & STAGE FILTER */}
              <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
                {filteredCrmLeads.length > 0 && (
                  <label className="flex items-center gap-2 text-xs text-gray-400 bg-white/5 border border-white/10 rounded-xl px-3 py-2 cursor-pointer hover:bg-white/10">
                    <input 
                      type="checkbox"
                      checked={filteredCrmLeads.length > 0 && filteredCrmLeads.every(l => selectedCrmLeads.includes(l.nome))}
                      onChange={() => handleToggleSelectAllCrmLeads(filteredCrmLeads)}
                      className="rounded border-white/20 bg-black/40 text-blue-500 focus:ring-0 focus:ring-offset-0 cursor-pointer h-3.5 w-3.5"
                    />
                    Selecionar Todos
                  </label>
                )}
                {selectedCrmLeads.length > 0 && (
                  <>
                    <button
                      onClick={handleRemoveSelectedFromCRM}
                      className="px-3.5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white border border-red-500/30 text-xs font-semibold cursor-pointer transition-colors"
                    >
                      🗑️ Excluir ({selectedCrmLeads.length})
                    </button>
                    <span className="text-xs text-gray-400 flex items-center gap-1.5">
                      Mover para:
                      <select
                        value={bulkStageTarget}
                        onChange={(e) => setBulkStageTarget(e.target.value)}
                        style={{ colorScheme: 'dark' }}
                        className="bg-black/50 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500 cursor-pointer"
                      >
                        <option value="Novo">Novo Lead</option>
                        <option value="Em Contato">Em Contato</option>
                        <option value="Proposta">Proposta Enviada</option>
                        <option value="Fechado">Vendido / Ganho</option>
                        <option value="Perdido">Perdido</option>
                      </select>
                    </span>
                    <button
                      onClick={handleBulkStageChange}
                      disabled={bulkStageLoading}
                      className="px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white border border-blue-500/30 text-xs font-semibold cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {bulkStageLoading ? 'Movendo...' : 'Aplicar'}
                    </button>
                    <button
                      onClick={handleReEnrichSelected}
                      disabled={enrichLoading}
                      className="px-3 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white border border-amber-500/30 text-xs font-semibold cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {enrichLoading ? 'Enriquecendo...' : '🔄 Re-enriquecer'}
                    </button>
                  </>
                )}
                <input 
                  type="text" 
                  placeholder="Buscar no CRM..."
                  className="w-full sm:w-auto bg-black/50 border border-white/10 rounded-xl px-4 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500"
                  value={crmSearch}
                  onChange={(e) => setCrmSearch(e.target.value)}
                />
                <select
                  value={crmFilterStage}
                  onChange={(e) => setCrmFilterStage(e.target.value)}
                  style={{ colorScheme: 'dark' }}
                  className="w-full sm:w-auto bg-black/50 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500 cursor-pointer"
                >
                  <option value="all">Todas as Etapas</option>
                  <option value="Novo">Novo Lead</option>
                  <option value="Em Contato">Em Contato</option>
                  <option value="Proposta">Proposta Enviada</option>
                  <option value="Fechado">Vendido / Ganho</option>
                  <option value="Perdido">Perdido</option>
                </select>
              </div>
            </div>

            {/* TABLE / CARDS CONTAINER */}
            <div className="rounded-2xl border border-white/5 bg-black/20 overflow-hidden">
              {/* Desktop Table */}
              <table className="hidden md:table w-full text-left text-sm">
                <thead className="bg-white/5 border-b border-white/5 text-gray-400">
                  <tr>
                    <th className="px-4 py-3 font-medium w-10 text-center">
                      <input 
                        type="checkbox"
                        checked={filteredCrmLeads.length > 0 && filteredCrmLeads.every(l => selectedCrmLeads.includes(l.nome))}
                        onChange={() => handleToggleSelectAllCrmLeads(filteredCrmLeads)}
                        className="rounded border-white/20 bg-black/40 text-blue-500 focus:ring-0 focus:ring-offset-0 cursor-pointer h-4 w-4"
                      />
                    </th>
                    <th className="px-4 py-3 font-medium">Lead Info</th>
                    <th className="px-4 py-3 font-medium">Contatos</th>
                    <th className="px-4 py-3 font-medium">Funil / Status</th>
                    <th className="px-4 py-3 font-medium">Minhas Anotações</th>
                    <th className="px-4 py-3 font-medium">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {paginatedCrmLeads.map((lead, i) => (
                    <tr key={i} className={`hover:bg-white/[0.03] transition-colors ${selectedCrmLeads.includes(lead.nome) ? 'bg-blue-500/5' : ''}`}>
                      <td className="px-4 py-4 text-center">
                        <input 
                          type="checkbox"
                          checked={selectedCrmLeads.includes(lead.nome)}
                          onChange={() => handleToggleSelectCrmLead(lead.nome)}
                          className="rounded border-white/20 bg-black/40 text-blue-500 focus:ring-0 focus:ring-offset-0 cursor-pointer h-4 w-4"
                        />
                      </td>
                      <td className="px-4 py-4 font-medium text-gray-200">
                        <div className="font-bold">{lead.nome}</div>
                        <div className="text-xs text-gray-500 mt-0.5">{lead.nicho} · {lead.cidade}</div>
                        {lead.site && lead.site !== 'Sem site' && (
                          <a href={lead.site} target="_blank" className="text-xs text-blue-400 hover:underline mt-1 block">🌐 Site comercial</a>
                        )}
                        {lead.cnpj && (
                          <span className="block text-[11px] text-amber-300 font-mono mt-1">CNPJ {lead.cnpj}</span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-xs font-mono">
                        <div className="space-y-1">
                          {lead.telefone && lead.telefone !== 'Não informado' && (
                            <div className="text-gray-300">📞 {lead.telefone}</div>
                          )}
                          {lead.email && (
                            <div className="text-purple-400">✉️ {lead.email}</div>
                          )}
                          {lead.instagram && (
                            <a href={lead.instagram} target="_blank" className="text-pink-400 block hover:underline">📷 Instagram</a>
                          )}
                          {lead.facebook && (
                            <a href={lead.facebook} target="_blank" className="text-blue-400 block hover:underline">📘 Facebook</a>
                          )}
                          {lead.tiktok && (
                            <a href={lead.tiktok} target="_blank" className="text-cyan-300 block hover:underline">🎵 TikTok</a>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <select
                          value={lead.stage || 'Novo'}
                          onChange={(e) => handleUpdateCRMLead(lead.nome, 'stage', e.target.value)}
                          style={{ colorScheme: 'dark' }}
                          className={`px-3 py-1.5 rounded-lg border text-xs font-bold focus:outline-none cursor-pointer ${
                            lead.stage === 'Novo' ? 'bg-blue-500/10 border-blue-500/30 text-blue-400' :
                            lead.stage === 'Em Contato' ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' :
                            lead.stage === 'Proposta' ? 'bg-purple-500/10 border-purple-500/30 text-purple-400' :
                            lead.stage === 'Fechado' ? 'bg-green-500/10 border-green-500/30 text-green-400' :
                            'bg-red-500/10 border-red-500/30 text-red-400'
                          }`}
                        >
                          <option value="Novo">Novo Lead</option>
                          <option value="Em Contato">Em Contato</option>
                          <option value="Proposta">Proposta Enviada</option>
                          <option value="Fechado">Vendido / Ganho</option>
                          <option value="Perdido">Perdido</option>
                        </select>
                      </td>
                      <td className="px-4 py-4">
                        <textarea
                          placeholder="Clique para anotar detalhes..."
                          value={lead.notes || ''}
                          onChange={(e) => handleUpdateCRMLead(lead.nome, 'notes', e.target.value)}
                          className="w-full bg-black/40 border border-white/5 hover:border-white/10 focus:border-blue-500 focus:outline-none rounded-lg p-2 text-xs text-gray-300 resize-none h-14 transition-colors"
                        />
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          {lead.telefone && lead.telefone !== 'Não informado' && (
                            <button
                              onClick={() => openWhatsApp(lead)}
                              className="p-2 rounded bg-green-500/10 hover:bg-green-500/20 border border-green-500/20 text-green-400 transition-colors text-xs font-semibold cursor-pointer"
                            >
                              💬 Contatar
                            </button>
                          )}
                          {lead.site && lead.site !== 'Sem site' && (
                            <button
                              onClick={() => handleReEnrichSingle(lead)}
                              className="p-2 rounded bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 text-amber-400 transition-colors text-xs font-semibold cursor-pointer"
                            >
                              🔄 Re-enriquecer
                            </button>
                          )}
                          <button
                            onClick={() => handleRemoveFromCRM(lead.nome)}
                            className="p-2 rounded bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 transition-colors text-xs font-semibold cursor-pointer"
                          >
                            Excluir
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}

                  {filteredCrmLeads.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-16 text-center text-gray-500">
                        <div className="text-3xl mb-3">📁</div>
                        <p className="font-semibold">Nenhum lead encontrado no CRM.</p>
                        <p className="text-xs max-w-md mx-auto mt-1">Salve leads a partir do "Motor Extrator" para visualizá-los e gerenciá-los aqui no seu pipeline.</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>

              {/* Mobile Card List CRM */}
              <div className="mobile-card-list md:hidden p-3 sm:p-4">
                {paginatedCrmLeads.map((lead, i) => (
                  <div 
                    key={i} 
                    className={`p-4 rounded-xl border transition-all ${
                      selectedCrmLeads.includes(lead.nome) 
                        ? 'bg-blue-950/20 border-blue-500/30' 
                        : 'bg-white/[0.02] border-white/5'
                    } flex flex-col gap-4`}
                  >
                    <div className="flex items-start gap-3">
                      <input 
                        type="checkbox"
                        checked={selectedCrmLeads.includes(lead.nome)}
                        onChange={() => handleToggleSelectCrmLead(lead.nome)}
                        className="rounded border-white/20 bg-black/40 text-blue-500 focus:ring-0 focus:ring-offset-0 cursor-pointer h-4 w-4 mt-0.5"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-gray-200 text-sm">{lead.nome}</div>
                        <div className="text-xs text-gray-500 mt-1">{lead.nicho} · {lead.cidade}</div>
                        {lead.site && lead.site !== 'Sem site' && (
                          <a href={lead.site} target="_blank" className="text-xs text-blue-400 hover:underline mt-1.5 block">🌐 Site comercial</a>
                        )}
                        {lead.cnpj && (
                          <span className="block text-[11px] text-amber-300 font-mono mt-1.5">CNPJ {lead.cnpj}</span>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2 border-t border-white/5 pt-3">
                      {lead.telefone && lead.telefone !== 'Não informado' && (
                        <div className="text-xs text-gray-300 flex items-center gap-2 font-mono">
                          <span className="opacity-60">📞</span> {lead.telefone}
                        </div>
                      )}
                      {lead.email && (
                        <div className="text-xs text-purple-400 flex items-center gap-2 font-mono break-all">
                          <span className="opacity-60">✉️</span> {lead.email}
                        </div>
                      )}
                      {lead.instagram && (
                        <a href={lead.instagram} target="_blank" className="text-xs text-pink-400 flex items-center gap-2 hover:underline">
                          <span className="opacity-60">📷</span> Instagram
                        </a>
                      )}
                      {lead.facebook && (
                        <a href={lead.facebook} target="_blank" className="text-xs text-blue-400 flex items-center gap-2 hover:underline">
                          <span className="opacity-60">📘</span> Facebook
                        </a>
                      )}
                      {lead.tiktok && (
                        <a href={lead.tiktok} target="_blank" className="text-xs text-cyan-300 flex items-center gap-2 hover:underline">
                          <span className="opacity-60">🎵</span> TikTok
                        </a>
                      )}
                    </div>

                    <div className="border-t border-white/5 pt-3 flex flex-col gap-2">
                      <span className="text-[11px] text-gray-500 font-medium">Funil / Status:</span>
                      <select
                        value={lead.stage || 'Novo'}
                        onChange={(e) => handleUpdateCRMLead(lead.nome, 'stage', e.target.value)}
                        style={{ colorScheme: 'dark' }}
                        className={`w-full px-3 py-2 rounded-xl border text-xs font-bold focus:outline-none cursor-pointer ${
                          lead.stage === 'Novo' ? 'bg-blue-500/10 border-blue-500/30 text-blue-400' :
                          lead.stage === 'Em Contato' ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' :
                          lead.stage === 'Proposta' ? 'bg-purple-500/10 border-purple-500/30 text-purple-400' :
                          lead.stage === 'Fechado' ? 'bg-green-500/10 border-green-500/30 text-green-400' :
                          'bg-red-500/10 border-red-500/30 text-red-400'
                        }`}
                      >
                        <option value="Novo">Novo Lead</option>
                        <option value="Em Contato">Em Contato</option>
                        <option value="Proposta">Proposta Enviada</option>
                        <option value="Fechado">Vendido / Ganho</option>
                        <option value="Perdido">Perdido</option>
                      </select>
                    </div>

                    <div className="border-t border-white/5 pt-3 flex flex-col gap-2">
                      <span className="text-[11px] text-gray-500 font-medium">Minhas Anotações:</span>
                      <textarea
                        placeholder="Clique para anotar detalhes..."
                        value={lead.notes || ''}
                        onChange={(e) => handleUpdateCRMLead(lead.nome, 'notes', e.target.value)}
                        className="w-full bg-black/40 border border-white/5 hover:border-white/10 focus:border-blue-500 focus:outline-none rounded-xl p-3 text-xs text-gray-300 resize-none h-16 transition-colors"
                      />
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2 border-t border-white/5 pt-3">
                      {lead.telefone && lead.telefone !== 'Não informado' && (
                        <button
                          onClick={() => openWhatsApp(lead)}
                          className="flex-1 py-2.5 rounded-xl bg-green-500/10 hover:bg-green-500/20 border border-green-500/20 text-green-400 transition-colors text-xs font-semibold cursor-pointer flex items-center justify-center gap-1.5"
                        >
                          💬 Contatar
                        </button>
                      )}
                      {lead.site && lead.site !== 'Sem site' && (
                        <button
                          onClick={() => handleReEnrichSingle(lead)}
                          className="flex-1 py-2.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 text-amber-400 transition-colors text-xs font-semibold cursor-pointer flex items-center justify-center gap-1.5"
                        >
                          🔄 Re-enriquecer
                        </button>
                      )}
                      <button
                        onClick={() => handleRemoveFromCRM(lead.nome)}
                        className="flex-1 py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 transition-colors text-xs font-semibold cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        Excluir
                      </button>
                    </div>
                  </div>
                ))}

                {filteredCrmLeads.length === 0 && (
                  <div className="py-16 text-center text-gray-500">
                    <div className="text-3xl mb-3">📁</div>
                    <p className="font-semibold text-sm">Nenhum lead encontrado no CRM.</p>
                  </div>
                )}
              </div>
            </div>

            {filteredCrmLeads.length > CRM_PAGE_SIZE && (
              <div className="flex items-center justify-between pt-4 text-xs text-gray-500">
                <span>
                  Mostrando {safeCrmPage * CRM_PAGE_SIZE + 1}–{Math.min((safeCrmPage + 1) * CRM_PAGE_SIZE, filteredCrmLeads.length)} de {filteredCrmLeads.length}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCrmPage(p => Math.max(0, p - 1))}
                    disabled={safeCrmPage === 0}
                    className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 disabled:opacity-30 hover:bg-white/10 transition-colors cursor-pointer disabled:cursor-not-allowed"
                  >
                    ← Anterior
                  </button>
                  <button
                    onClick={() => setCrmPage(p => p + 1)}
                    disabled={safeCrmPage >= crmTotalPages - 1}
                    className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 disabled:opacity-30 hover:bg-white/10 transition-colors cursor-pointer disabled:cursor-not-allowed"
                  >
                    Próximo →
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ==================== TAB 3: WHATSAPP BULK ==================== */}
        {activeTab === 'whatsapp' && !activeTabLocked && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 lg:gap-8 relative z-20 animate-slide-up">
            
            {/* CONFIGURAÇÃO DO DISPARO */}
            <div className="lg:col-span-1 space-y-5">
              {/* MODELO DE MENSAGEM */}
              <div className="app-card p-7 rounded-[2rem] bg-gradient-to-b from-white/[0.05] to-black/40 border border-white/10 shadow-2xl relative">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-green-500 to-emerald-500" />
                <div className="mb-5">
                  <h3 className="text-xl font-semibold flex items-center gap-2">
                    ✍️ Mensagem da Campanha
                  </h3>
                  <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                    <span className="px-2.5 py-1 rounded-full bg-green-500/10 text-green-300 border border-green-500/20 font-bold">
                      Personalizada
                    </span>
                    <span className="px-2.5 py-1 rounded-full bg-white/5 text-gray-400 border border-white/10">
                      Envio assistido
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
                          <span className="block text-xs font-bold text-gray-100">{preset.title}</span>
                          <span className="block text-[10px] text-gray-500 mt-0.5">{preset.subtitle}</span>
                        </button>
                      );
                    })}
                  </div>

                  <form onSubmit={generateWaAiTemplates} className="rounded-2xl bg-green-500/[0.04] border border-green-500/15 p-4 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h4 className="text-sm font-bold text-green-300">Modelos com IA</h4>
                        <p className="text-[11px] text-gray-500 mt-0.5">Gere abordagens novas e aplique no disparador.</p>
                      </div>
                      <span className="text-[10px] px-2 py-1 rounded-full bg-black/30 border border-white/10 text-gray-400">
                        Gemini ou local
                      </span>
                    </div>

                    <div className="grid grid-cols-1 gap-2">
                      <input
                        value={waAiProduct}
                        onChange={(e) => setWaAiProduct(e.target.value)}
                        placeholder="O que você vende? ex: gestão de tráfego"
                        className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-green-500"
                      />
                      <textarea
                        rows={2}
                        value={waAiValue}
                        onChange={(e) => setWaAiValue(e.target.value)}
                        placeholder="Principal benefício: ex: gerar mais orçamentos todos os meses"
                        className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-green-500 resize-none"
                      />
                      <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2">
                        <select
                          value={waAiTone}
                          onChange={(e) => setWaAiTone(e.target.value)}
                          style={{ colorScheme: 'dark' }}
                          className="w-full bg-black/80 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-green-500 cursor-pointer"
                        >
                          <option value="friendly">Humano e natural</option>
                          <option value="direct">Curto e direto</option>
                          <option value="curious">Curioso</option>
                          <option value="persuasive">Persuasivo</option>
                        </select>
                        <button
                          type="submit"
                          disabled={waAiLoading}
                          className="px-4 py-2.5 rounded-xl bg-green-500 hover:bg-green-400 text-black text-xs font-extrabold cursor-pointer disabled:opacity-60"
                        >
                          {waAiLoading ? 'Gerando...' : 'Gerar modelos'}
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
                            <span className="block text-[10px] text-green-300 font-bold mt-2">Usar este modelo</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </form>

                  <div>
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <label className="block text-xs font-medium text-gray-400">Editor</label>
                      <span className="text-[10px] text-gray-500 font-mono">{waTemplate.length} caracteres</span>
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
                    <label className="block text-[11px] font-medium text-gray-500 mb-2">Campos dinâmicos</label>
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
                      <span className="text-xs font-bold text-green-300">Prévia</span>
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
                  🚀 Fila Assistida WhatsApp
                </h3>
                <p className="text-xs text-gray-400 mb-4">
                  Abra conversas em sequência, envie dentro do WhatsApp e avance sem perder o controle da lista.
                </p>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1">Intervalo entre Mensagens (segundos):</label>
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
                      Simular comportamento humano (+/- 4s randômicos)
                    </label>

                    <label className="flex items-center gap-2.5 text-xs text-gray-300 cursor-pointer">
                      <input 
                        type="checkbox"
                        checked={bulkAutoNext}
                        onChange={(e) => setBulkAutoNext(e.target.checked)}
                        className="rounded border-white/20 bg-black/40 text-red-500 focus:ring-0 cursor-pointer h-4 w-4"
                      />
                      Abrir próximo chat automaticamente após o intervalo
                    </label>
                  </div>

                  {/* STATUS DO BOT CONECTADO */}
                  <div className={`p-3 rounded-xl text-xs leading-relaxed space-y-1 ${
                    chatbotSession?.status === 'connected'
                      ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-300'
                      : 'bg-gray-500/10 border border-gray-500/20 text-gray-400'
                  }`}>
                    <span className="font-bold flex items-center gap-1">
                      {chatbotSession?.status === 'connected' ? '🟢 Bot WhatsApp Conectado' : '🔴 Chatbot Desconectado'}
                    </span>
                    {chatbotSession?.status === 'connected' ? (
                      <span>Envio direto via bot disponível. Respostas: {chatbotSession.repliedCount || 0}</span>
                    ) : (
                      <span>Vá na aba Chatbot e conecte via QR Code para enviar mensagens direto do servidor.</span>
                    )}
                  </div>

                  {/* ALERTA DE BLOQUEIO DESTAQUE */}
                  <div className="p-4 rounded-xl bg-red-950/20 border border-red-500/20 text-xs text-red-400 leading-relaxed space-y-1">
                    <span className="font-bold flex items-center gap-1">⚠️ AVISO DE RISCO DE BLOQUEIO</span>
                    O WhatsApp limita automações de envio. Use a fila para abordagens legítimas, com contexto, personalização e opção de não receber novas mensagens.
                  </div>

                  {isSendingBulk ? (
                    <button 
                      type="button"
                      onClick={handleStopBulkSending}
                      className="w-full py-3 rounded-xl font-bold text-white bg-red-600 hover:bg-red-700 border border-red-500/30 cursor-pointer flex items-center justify-center gap-2 transition-colors"
                    >
                      ⏹ Parar Fila
                    </button>
                  ) : (
                    <div className="flex flex-col gap-2">
                      <button 
                        type="button"
                        onClick={handleStartBulkSending}
                        className="w-full py-3 rounded-xl font-bold text-white bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 hover:shadow-[0_0_15px_rgba(239,68,68,0.3)] cursor-pointer flex items-center justify-center gap-2 transition-all"
                      >
                        🚀 Iniciar Fila Assistida
                      </button>
                      <button 
                        type="button"
                        onClick={() => {
                          if (chatbotSession?.status === 'connected') {
                            handleStartAutoBulkSend();
                          } else {
                            setActiveTab('chatbot');
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }
                        }}
                        className={`w-full py-3 rounded-xl font-bold text-white cursor-pointer flex items-center justify-center gap-2 transition-all ${
                          chatbotSession?.status === 'connected'
                            ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 hover:shadow-[0_0_15px_rgba(16,185,129,0.3)]'
                            : 'bg-amber-600/30 text-amber-300 hover:bg-amber-600/50 border border-amber-500/30'
                        }`}
                      >
                        {chatbotSession?.status === 'connected' ? '🤖 Enviar Automático (Bot)' : '🔌 Conecte o Chatbot primeiro →'}
                      </button>
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
                    <h3 className="text-xl font-semibold">Leads Prontos para Abordagem</h3>
                    <p className="text-xs text-gray-500 mt-1">Lista com telefones extraídos do seu CRM.</p>
                  </div>
                  <div className="flex flex-wrap gap-2 sm:items-center">
                    <div className="text-xs px-3 py-1.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20 font-bold">
                      Selecionados: {selectedWaCount}
                    </div>
                    <div className="text-xs px-3 py-1.5 rounded-full bg-white/5 text-gray-300 border border-white/10 font-bold">
                      Total: {dispatchableWaLeads.length} com telefone
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
                      <span className="font-bold block">{isAutoSending ? '🤖 Disparo Automático Ativo!' : '🚀 Fila Assistida Ativa!'}</span>
                      {isAutoSending ? (
                        <span>Enviando {bulkIndex + 1} de {bulkQueue.length}... (aguarde)</span>
                      ) : (
                        <>
                          Processando lead {bulkIndex + 1} de {bulkQueue.length}.
                          {bulkAutoNext ? (
                            <> Próximo chat abre em <span className="font-mono font-bold text-white bg-green-500 px-2 py-0.5 rounded text-xs ml-1">{bulkTimer}s</span>.</>
                          ) : (
                            <span className="block text-green-300 mt-1">Envie a mensagem no WhatsApp, volte aqui e avance.</span>
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
                          ✓ Já enviei / Próximo
                        </button>
                      )}
                      <button
                        onClick={handleStopBulkSending}
                        className="px-3.5 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30 text-xs font-semibold cursor-pointer"
                      >
                        ⏹ Parar Fila
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
                        <th className="px-4 py-3 font-medium">Nome / Empresa</th>
                        <th className="px-4 py-3 font-medium">Telefone</th>
                        <th className="px-4 py-3 font-medium">Preview da Abordagem</th>
                        <th className="px-4 py-3 font-medium">Status / Ação</th>
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
                                    {isActive ? '👉 Chat Atual' : isSendingBulk && queueIndex < 0 ? 'Fora da Fila' : isSent ? '✓ Re-enviar' : '⚡ Disparar'}
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
                                      {waSendingViaBot[leadKey] ? '...' : '🤖 Bot'}
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
                            <p className="font-semibold">Nenhum lead com telefone no CRM.</p>
                            <p className="text-xs max-w-md mx-auto mt-1">Vá para o Extrator, faça buscas com filtros e salve os contatos no seu CRM para liberá-los aqui.</p>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>

                  {/* Mobile Card List WhatsApp */}
                  <div className="mobile-card-list md:hidden p-3 sm:p-4">
                    {dispatchableWaLeads.length > 0 && (
                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 bg-white/[0.02] border border-white/5 rounded-xl p-3.5">
                        <span className="text-xs text-gray-400">Selecionados: {selectedWaCount} de {dispatchableWaLeads.length}</span>
                        <button
                          type="button"
                          onClick={() => handleToggleSelectAllWaLeads(dispatchableWaLeads)}
                          disabled={isSendingBulk}
                          className="text-xs font-bold text-green-400 hover:text-green-300 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {dispatchableWaLeads.every(l => selectedWaLeads.includes(getLeadKey(l))) ? 'Desmarcar Todos' : 'Selecionar Todos'}
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
                                {isActive ? '👉 Chat Atual' : isSendingBulk && queueIndex < 0 ? 'Fora da Fila' : isSent ? '✓ Re-enviar' : '⚡ Disparar'}
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
                                  {waSendingViaBot[leadKey] ? '...' : '🤖 Enviar via Bot'}
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}

                    {dispatchableWaLeads.length === 0 && (
                      <div className="py-16 text-center text-gray-500">
                        <div className="text-3xl mb-3">💬</div>
                        <p className="font-semibold text-sm">Nenhum lead com telefone no CRM.</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* HISTORICO DE MENSAGENS ENVIADAS VIA BOT */}
                {chatbotSession?.status === 'connected' && waSentMessages.length > 0 && (
                  <div className="mt-6 app-card p-6 rounded-[2rem] bg-gradient-to-b from-white/[0.03] to-black/40 border border-white/10 shadow-2xl">
                    <div className="flex items-center justify-between gap-3 mb-4">
                      <h4 className="text-sm font-bold text-gray-200">📨 Mensagens Enviadas via Bot</h4>
                      <button
                        type="button"
                        onClick={handleLoadSentMessages}
                        className="text-[10px] px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400 cursor-pointer"
                      >
                        {waSentMessagesLoading ? '...' : 'Atualizar'}
                      </button>
                    </div>
                    <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                      {waSentMessages.slice(0, 20).map((msg: any) => (
                        <div key={msg.id} className="p-3 rounded-xl bg-black/30 border border-white/5 text-xs">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="font-bold text-gray-200 truncate">{msg.lead_name}</span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                              msg.status === 'sent' ? 'bg-green-500/10 text-green-400' :
                              msg.status === 'failed' ? 'bg-red-500/10 text-red-400' :
                              'bg-gray-500/10 text-gray-400'
                            }`}>
                              {msg.status === 'sent' ? 'Enviada' : msg.status === 'failed' ? 'Falhou' : msg.status}
                            </span>
                          </div>
                          <div className="text-gray-400 line-clamp-2">{msg.message}</div>
                          <div className="text-[10px] text-gray-500 mt-1">
                            {msg.sent_at ? new Date(msg.sent_at).toLocaleString('pt-BR') : '—'}
                            {msg.error_message && <span className="text-red-400 ml-2">Erro: {msg.error_message}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ==================== TAB 4: WHATSAPP CHATBOT ==================== */}
        {activeTab === 'chatbot' && !activeTabLocked && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 lg:gap-8 relative z-20 animate-slide-up">
            <div className="lg:col-span-1 space-y-5">
              <div className="app-card p-7 rounded-[2rem] bg-gradient-to-b from-white/[0.05] to-black/40 border border-white/10 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-cyan-500" />
                <h3 className="text-xl font-semibold mb-2 flex items-center gap-2">🤖 Chatbot WhatsApp</h3>
                <p className="text-xs text-gray-400 leading-relaxed mb-5">
                  Responda mensagens recebidas automaticamente com regras simples. Ideal para atendimento inicial, dúvidas frequentes e captação de interessados.
                </p>

                <div className="rounded-2xl bg-black/40 border border-white/10 p-4 mb-5">
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <span className="text-xs text-gray-400">Status da conexão</span>
                    <span className={`text-[10px] px-2.5 py-1 rounded-full border font-bold ${
                      chatbotSession.status === 'connected' ? 'bg-green-500/10 border-green-500/20 text-green-400' :
                      chatbotSession.status === 'qr' ? 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400' :
                      chatbotSession.status === 'connecting' ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' :
                      chatbotSession.status === 'error' ? 'bg-red-500/10 border-red-500/20 text-red-400' :
                      'bg-white/5 border-white/10 text-gray-400'
                    }`}>
                      {chatbotSession.status === 'connected' ? 'Conectado' :
                       chatbotSession.status === 'qr' ? 'Aguardando QR' :
                       chatbotSession.status === 'connecting' ? 'Conectando' :
                       chatbotSession.status === 'error' ? 'Erro' :
                       chatbotSession.status === 'disconnected' ? 'Desconectado' : 'Inativo'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5">
                      <span className="block text-gray-500">Respostas</span>
                      <strong className="text-lg text-white">{chatbotSession.repliedCount || 0}</strong>
                    </div>
                    <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5">
                      <span className="block text-gray-500">Regras no bot</span>
                      <strong className="text-lg text-white">{chatbotSession.rulesCount ?? chatbotRules.filter(rule => rule.enabled).length}</strong>
                    </div>
                  </div>

                  {(chatbotSession.lastError || chatbotSession.lastDisconnectCode) && (
                    <div className="mt-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-300 leading-relaxed">
                      {chatbotSession.lastError || 'Conexão instável.'}
                      {chatbotSession.lastDisconnectCode && (
                        <span className="block font-mono mt-1 opacity-80">Código: {chatbotSession.lastDisconnectCode}</span>
                      )}
                    </div>
                  )}

                  {(chatbotSession.lastIncomingAt || chatbotSession.lastReplyAt || chatbotSession.lastIgnoredReason || chatbotSession.lastEventType) && (
                    <div className="mt-3 p-3 rounded-xl bg-white/[0.03] border border-white/10 text-[11px] text-gray-300 leading-relaxed space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-gray-500">Bot</span>
                        <span className={chatbotSession.enabled ? 'text-emerald-300' : 'text-red-300'}>
                          {chatbotSession.enabled ? 'Ativo' : 'Pausado'}
                        </span>
                      </div>
                      {chatbotSession.lastEventType && (
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-gray-500">Evento</span>
                          <span className="font-mono text-gray-200">{chatbotSession.lastEventType}</span>
                        </div>
                      )}
                      {chatbotSession.lastIncomingAt && (
                        <div>
                          <span className="block text-gray-500">Última mensagem</span>
                          <span className="block text-gray-200 break-words">{chatbotSession.lastIncomingText || 'Sem texto legível'}</span>
                        </div>
                      )}
                      {chatbotSession.lastReplyAt && (
                        <div>
                          <span className="block text-gray-500">Última resposta</span>
                          <span className="block text-gray-200 break-words">{chatbotSession.lastReplyText}</span>
                        </div>
                      )}
                      {chatbotSession.lastIgnoredReason && (
                        <div>
                          <span className="block text-gray-500">Último motivo</span>
                          <span className="block text-amber-300 break-words">{chatbotSession.lastIgnoredReason}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {chatbotSession.qrDataUrl ? (
                  <div className="p-4 rounded-2xl bg-white border border-cyan-500/20 mb-5">
                    <img src={chatbotSession.qrDataUrl} alt="QR Code do WhatsApp" className="w-full max-w-[260px] mx-auto" />
                    <p className="text-center text-xs text-black/70 font-semibold mt-3">Escaneie com o WhatsApp do usuário</p>
                  </div>
                ) : chatbotSession.pairingCode ? (
                  <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 mb-5 text-center">
                    <p className="text-xs text-emerald-300 font-semibold mb-1">Código de Pareamento</p>
                    <p className="text-2xl font-mono font-bold text-white tracking-widest select-all">{chatbotSession.pairingCode}</p>
                    <p className="text-[10px] text-emerald-400/70 mt-2">WhatsApp {'>'} Dispositivos Conectados {'>'} Conectar um dispositivo</p>
                  </div>
                ) : (
                  <div className="p-4 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-xs text-cyan-300 leading-relaxed mb-5">
                    Ao conectar, o GeoLeads gera um QR Code ou código de pareamento. Depois que o WhatsApp parear, o bot responde apenas conversas recebidas.
                  </div>
                )}

                {chatbotMessage && (
                  <div className="p-3 rounded-xl bg-white/[0.04] border border-white/10 text-xs text-gray-300 mb-4">
                    {chatbotMessage}
                  </div>
                )}

                <div className="grid grid-cols-1 gap-3">
                  {chatbotSession.status === 'connected' || chatbotSession.status === 'qr' || chatbotSession.status === 'connecting' || chatbotSession.status === 'pairing' ? (
                    <button
                      type="button"
                      disabled={chatbotLoading}
                      onClick={handleDisconnectChatbot}
                      className="w-full py-3 rounded-xl font-bold text-white bg-red-600 hover:bg-red-700 border border-red-500/30 cursor-pointer disabled:opacity-60"
                    >
                      Desconectar Bot
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        disabled={chatbotLoading || !user}
                        onClick={handleConnectChatbot}
                        className="w-full py-3 rounded-xl font-bold text-black bg-gradient-to-r from-emerald-400 to-cyan-400 hover:from-emerald-300 hover:to-cyan-300 cursor-pointer disabled:opacity-60"
                      >
                        {user ? '📱 Conectar via QR Code' : 'Faça login para conectar'}
                      </button>
                      <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                          <span className="w-full border-t border-white/10" />
                        </div>
                        <div className="relative flex justify-center text-xs">
                          <span className="bg-[#050507] px-3 text-gray-500">ou</span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="55 11 99999-9999"
                          value={chatbotPhoneNumber}
                          onChange={(e) => setChatbotPhoneNumber(e.target.value)}
                          className="flex-1 bg-black/50 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500 font-mono"
                        />
                        <button
                          type="button"
                          disabled={chatbotLoading || !user}
                          onClick={handlePairChatbot}
                          className="px-4 py-2.5 rounded-xl font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 cursor-pointer disabled:opacity-60 text-sm whitespace-nowrap"
                        >
                          {user ? '🔗 Parear' : '...'}
                        </button>
                      </div>
                    </>
                  )}
                  <button
                    type="button"
                    disabled={chatbotLoading}
                    onClick={() => saveChatbotConfig()}
                    className="w-full py-3 rounded-xl font-bold text-white bg-white/5 hover:bg-white/10 border border-white/10 cursor-pointer disabled:opacity-60"
                  >
                    Salvar Configuração
                  </button>
                  <div className="mt-3 p-3 rounded-xl bg-amber-500/15 border border-amber-500/25">
                    <p className="text-xs text-amber-300 font-bold text-center">⚠ Salve as configurações primeiro!</p>
                    <p className="text-[11px] text-amber-400/70 text-center mt-1">O QR Code só aparece depois de salvar</p>
                  </div>
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 leading-relaxed">
                <span className="font-bold block mb-1">Uso recomendado</span>
                Use para atendimento e resposta a contatos que chamaram primeiro. O comando SAIR/PARAR/CANCELAR desativa respostas automáticas para aquele contato.
              </div>
            </div>

            <div className="lg:col-span-2 space-y-5">
              <div className="app-card p-7 rounded-[2rem] bg-gradient-to-b from-white/[0.03] to-black/40 border border-white/10 shadow-2xl">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                  <div>
                    <h3 className="text-xl font-semibold">Configuração do Atendimento</h3>
                    <p className="text-xs text-gray-500 mt-1">Defina a identidade do bot e as mensagens padrão.</p>
                  </div>
                  <label className="flex items-center gap-2 text-xs text-gray-300 bg-white/5 border border-white/10 rounded-xl px-3 py-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={chatbotEnabled}
                      onChange={(e) => setChatbotEnabled(e.target.checked)}
                      className="rounded border-white/20 bg-black/40 text-emerald-500 focus:ring-0 cursor-pointer h-4 w-4"
                    />
                    Bot ativo
                  </label>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Nome da empresa/bot</label>
                    <input
                      value={chatbotBusinessName}
                      onChange={(e) => setChatbotBusinessName(e.target.value)}
                      className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Variáveis disponíveis</label>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {['{Nome}', '{Mensagem}', '{Empresa}'].map(tag => (
                        <span key={tag} className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-[11px] font-mono text-gray-300">{tag}</span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Mensagem inicial/fallback</label>
                    <textarea
                      rows={4}
                      value={chatbotFallbackMessage}
                      onChange={(e) => setChatbotFallbackMessage(e.target.value)}
                      className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-emerald-500 resize-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Mensagem de boas-vindas interna</label>
                    <textarea
                      rows={4}
                      value={chatbotWelcomeMessage}
                      onChange={(e) => setChatbotWelcomeMessage(e.target.value)}
                      className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-emerald-500 resize-none"
                    />
                  </div>
                </div>
              </div>

              <div className="app-card p-7 rounded-[2rem] bg-gradient-to-b from-white/[0.03] to-black/40 border border-white/10 shadow-2xl">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                  <div>
                    <h3 className="text-xl font-semibold">Fluxos de Resposta</h3>
                    <p className="text-xs text-gray-500 mt-1">Quando a mensagem recebida contiver a palavra-chave, o bot envia a resposta.</p>
                  </div>
                  <button
                    type="button"
                    onClick={addChatbotRule}
                    className="w-full sm:w-auto px-3.5 py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-300 text-xs font-bold cursor-pointer"
                  >
                    + Nova Regra
                  </button>
                </div>

                <div className="space-y-4">
                  {chatbotRules.map((rule, index) => (
                    <div key={rule.id} className="p-4 rounded-2xl bg-black/30 border border-white/10">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
                        <span className="text-xs font-bold text-gray-300">Regra {index + 1}</span>
                        <div className="flex flex-wrap items-center gap-3">
                          <label className="flex items-center gap-2 text-[11px] text-gray-400 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={rule.enabled}
                              onChange={(e) => updateChatbotRule(rule.id, 'enabled', e.target.checked)}
                              className="rounded border-white/20 bg-black/40 text-emerald-500 focus:ring-0 cursor-pointer h-3.5 w-3.5"
                            />
                            Ativa
                          </label>
                          <button
                            type="button"
                            onClick={() => removeChatbotRule(rule.id)}
                            className="text-xs text-red-400 hover:text-red-300 cursor-pointer"
                          >
                            Remover
                          </button>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-[11px] text-gray-500 mb-1">Palavra-chave</label>
                          <input
                            value={rule.keyword}
                            onChange={(e) => updateChatbotRule(rule.id, 'keyword', e.target.value)}
                            placeholder="ex: preço"
                            className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className="block text-[11px] text-gray-500 mb-1">Resposta automática</label>
                          <textarea
                            rows={3}
                            value={rule.response}
                            onChange={(e) => updateChatbotRule(rule.id, 'response', e.target.value)}
                            className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-emerald-500 resize-none"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ==================== TAB 5: AI MESSAGE GENERATOR ==================== */}
        {activeTab === 'ia' && !activeTabLocked && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 lg:gap-8 relative z-20 animate-slide-up">
            
            {/* PAINEL DE ENTRADAS */}
            <div className="lg:col-span-1">
              <div className="app-card p-7 rounded-[2rem] bg-gradient-to-b from-white/[0.05] to-black/40 border border-white/10 shadow-2xl relative">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 to-indigo-500" />
                
                <h3 className="text-xl font-semibold mb-6 flex items-center gap-2">
                  🤖 Gerador de Copys IA
                </h3>

                <form onSubmit={generateAICopies} className="space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">O que a sua empresa vende?</label>
                    <input 
                      type="text" 
                      placeholder="ex: Gestão de Tráfego Pago, Software ERP..."
                      className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all"
                      value={aiProduct}
                      onChange={(e) => setAiProduct(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">Qual o maior ganho/proposta de valor?</label>
                    <textarea 
                      rows={3}
                      placeholder="ex: Colocar mais clientes na porta todos os dias e aumentar o faturamento em 30%"
                      className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all resize-none"
                      value={aiValue}
                      onChange={(e) => setAiValue(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">Tom de Voz</label>
                    <select
                      value={aiTone}
                      onChange={(e) => setAiTone(e.target.value)}
                      style={{ colorScheme: 'dark' }}
                      className="w-full bg-black/80 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all cursor-pointer"
                    >
                      <option value="persuasive">Persuasivo & Marcante</option>
                      <option value="direct">Curto & Direto ao Ponto</option>
                      <option value="curious">Curioso & Provocativo</option>
                    </select>
                  </div>
                  
                  <button 
                    type="submit"
                    className="w-full py-3.5 rounded-xl font-bold text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 hover:shadow-[0_0_20px_rgba(168,85,247,0.4)] transition-all duration-200 cursor-pointer"
                  >
                    ✨ Gerar Roteiros de Alta Conversão
                  </button>
                </form>
              </div>
            </div>

            {/* RESULTADO DAS COPYS */}
            <div className="lg:col-span-2">
              <div className="app-card p-7 rounded-[2rem] bg-gradient-to-b from-white/[0.03] to-black/40 border border-white/10 h-full flex flex-col shadow-2xl">
                <h3 className="text-xl font-semibold mb-6">Modelos Prontos para Uso</h3>

                {generatedCopies ? (
                  <div className="app-copy-block space-y-5 pr-1 sm:pr-2">
                    {generatedCopies.map((copy, index) => (
                      <div key={index} className="p-4 sm:p-6 rounded-2xl bg-white/[0.02] border border-white/5 relative group hover:border-purple-500/30 transition-all">
                        <h4 className="text-sm font-bold text-purple-400 mb-1">{copy.title}</h4>
                        <p className="text-[11px] text-gray-500 mb-4">{copy.desc}</p>
                        
                        <pre className="text-xs bg-black/50 border border-white/5 rounded-xl p-3 sm:p-4 font-sans text-gray-300 leading-relaxed whitespace-pre-wrap select-all">
                          {copy.text}
                        </pre>

                        <div className="mt-3 flex flex-col sm:flex-row gap-2">
                          <button
                            onClick={() => {
                              setWaTemplate(copy.text);
                              setActiveTab('whatsapp');
                            }}
                            className="px-3 py-1.5 rounded-lg bg-green-500/10 hover:bg-green-500/20 text-green-300 border border-green-500/20 text-xs font-semibold cursor-pointer transition-colors flex items-center justify-center gap-1.5"
                          >
                            Usar no Disparador
                          </button>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(copy.text);
                              showToast('Copiado!', 'success');
                            }}
                            className="px-3 py-1.5 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/20 text-xs font-semibold cursor-pointer transition-colors flex items-center justify-center gap-1.5"
                          >
                            📋 Copiar
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-center py-16 text-gray-500">
                    <div className="text-5xl mb-4">🤖</div>
                    <p className="font-semibold text-lg text-gray-300">Crie copys personalizadas sem esforço</p>
                    <p className="text-sm max-w-sm mt-1 mx-auto text-gray-500">Insira as informações da sua oferta no painel ao lado e a IA criará roteiros comerciais prontos, otimizados para prospecção fria.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ==================== TAB 5: SUPPORT & RATING ==================== */}
        {activeTab === 'support' && (
          <div className="support-panels-grid grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-8 relative z-20 animate-slide-up">
            {/* CARD 1: CONTATO E SUPORTE */}
            <div className="support-panel-card app-card p-7 rounded-[2rem] bg-gradient-to-b from-white/[0.05] to-black/40 border border-white/10 shadow-2xl relative group hover:border-blue-500/30 transition-all duration-500">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-500" />
              
              <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                🙋‍♀️ Central de Suporte & Atendimento
              </h3>
              <p className="text-sm text-gray-400 mb-6 leading-relaxed">
                Precisa de ajuda com o extrator, tem dúvidas sobre faturamento ou quer sugerir alguma melhoria no sistema? Nossa equipe está pronta para responder!
              </p>

              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <span className="text-[10px] text-gray-500 uppercase block font-bold tracking-wider">E-mail de Suporte</span>
                    <span className="text-sm text-gray-200 font-medium font-mono break-all">pixel010dev@gmail.com</span>
                  </div>
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText('pixel010dev@gmail.com');
                      showToast('E-mail copiado!', 'success');
                    }}
                    className="w-full sm:w-auto px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-gray-300 cursor-pointer transition-colors"
                  >
                    📋 Copiar
                  </button>
                </div>

                <a 
                  href="mailto:pixel010dev@gmail.com?subject=Suporte GeoLeads&body=Olá equipe GeoLeads,"
                  className="w-full py-3.5 rounded-xl font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 hover:shadow-[0_0_20px_rgba(59,130,246,0.4)] transition-all duration-200 cursor-pointer flex items-center justify-center gap-2"
                >
                  ✉️ Abrir Chamado por E-mail
                </a>

                <a 
                  href="https://mail.google.com/mail/?view=cm&fs=1&to=pixel010dev@gmail.com&su=Suporte%20GeoLeads&body=Ol%C3%A1%20equipe%20GeoLeads%2C"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3 rounded-xl font-medium text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 text-sm"
                >
                  🌐 Abrir no Gmail Web
                </a>
              </div>
            </div>

            {/* CARD 2: AVALIAÇÃO DE DESEMPENHO */}
            <div className="support-panel-card app-card p-7 rounded-[2rem] bg-gradient-to-b from-white/[0.05] to-black/40 border border-white/10 shadow-2xl relative group hover:border-purple-500/30 transition-all duration-500">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 to-indigo-500" />
              
              <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                ⭐ Avalie a sua Experiência
              </h3>
              <p className="text-sm text-gray-400 mb-6 leading-relaxed">
                Sua opinião nos ajuda a evoluir a plataforma. Como tem sido sua experiência no GeoLeads?
              </p>

              {supportSubmitted ? (
                <div className="py-8 text-center text-green-400 animate-fade-in">
                  <div className="text-5xl mb-3">🎉</div>
                  <h4 className="font-bold text-lg text-gray-100">Muito obrigado pela avaliação!</h4>
                  <p className="text-xs text-gray-500 mt-1 max-w-xs mx-auto leading-relaxed">Seu feedback foi registrado e será lido pela nossa equipe de desenvolvimento.</p>
                  <button 
                    onClick={() => {
                      setSupportSubmitted(false);
                      setSupportRating(0);
                      setSupportFeedback('');
                    }}
                    className="mt-6 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-gray-300 hover:bg-white/10 cursor-pointer transition-colors"
                  >
                    Avaliar Novamente
                  </button>
                </div>
              ) : (
                <form 
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (supportRating === 0) {
                      showToast('Selecione uma nota de 1 a 5 estrelas.', 'warning');
                      return;
                    }
                    try {
                      const res = await fetch('/api/feedback', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          rating: supportRating,
                          feedback: supportFeedback,
                          name: user?.email || 'Usuário',
                          userId: user?.id || null,
                        }),
                      });
                      if (!res.ok) throw new Error('Erro ao enviar');
                      setSupportSubmitted(true);
                      showToast('Avaliação enviada com sucesso!', 'success');
                    } catch (err) {
                      console.error('Feedback error:', err);
                      showToast('Erro ao enviar avaliação. Tente novamente.', 'error');
                    }
                  }}
                  className="space-y-5"
                >
                  <div className="support-rating-box flex flex-col items-center justify-center p-4 bg-black/35 rounded-xl border border-white/5">
                    <span className="text-xs text-gray-500 mb-2 font-medium">Sua nota de 1 a 5 estrelas:</span>
                    <div className="support-rating-stars">
                      {[1, 2, 3, 4, 5].map(star => {
                        const StarIsHighlighted = (hoveredStar !== null ? star <= hoveredStar : star <= supportRating);
                        return (
                          <button
                            key={star}
                            type="button"
                            onClick={() => setSupportRating(star)}
                            onMouseEnter={() => setHoveredStar(star)}
                            onMouseLeave={() => setHoveredStar(null)}
                            className={`text-3xl focus:outline-none transition-all hover:scale-125 cursor-pointer duration-150 ${
                              StarIsHighlighted 
                                ? 'text-amber-400 drop-shadow-[0_0_10px_rgba(251,191,36,0.85)] scale-110' 
                                : 'text-gray-600 hover:text-gray-400'
                            }`}
                          >
                            {StarIsHighlighted ? '★' : '☆'}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1">Como podemos melhorar? (Opcional):</label>
                    <textarea 
                      rows={3}
                      placeholder="Deixe sua sugestão ou elogio..."
                      className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all resize-none text-sm"
                      value={supportFeedback}
                      onChange={(e) => setSupportFeedback(e.target.value)}
                    />
                  </div>

                  <button 
                    type="submit"
                    className="w-full py-3.5 rounded-xl font-bold text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 hover:shadow-[0_0_20px_rgba(168,85,247,0.4)] transition-all duration-200 cursor-pointer"
                  >
                    Enviar Avaliação
                  </button>
                </form>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Modal de Histórico */}
      {showHistory && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-12 sm:pt-16 px-4">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowHistory(false)} />
          <div className="relative w-full max-w-2xl max-h-[80vh] bg-gray-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-slide-up">
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <h3 className="text-lg font-bold flex items-center gap-2">
                🕐 Histórico de Extrações
              </h3>
              <button
                onClick={() => setShowHistory(false)}
                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors cursor-pointer"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="overflow-y-auto max-h-[calc(80vh-64px)] p-4">
              {historyLoading ? (
                <div className="flex items-center justify-center py-12">
                  <svg className="animate-spin h-6 w-6 text-blue-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                </div>
              ) : historyData.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-3xl mb-3">📭</div>
                  <p className="text-gray-400">Nenhuma extração encontrada.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {historyData.map((h: any) => (
                    <div key={h.id} className="p-4 rounded-xl bg-white/[0.03] border border-white/5 hover:border-white/10 transition-colors">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div>
                          <span className="font-bold text-sm text-white">{h.keyword}</span>
                          <span className="text-gray-400 text-sm mx-1.5">em</span>
                          <span className="font-bold text-sm text-blue-400">{h.location}</span>
                        </div>
                        <span className="text-[11px] text-gray-500 whitespace-nowrap">
                          {new Date(h.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-3 text-xs text-gray-400">
                        <span>🔹 {h.leads_found} leads encontrados</span>
                        <span>🔹 {h.tokens_spent} tokens gastos</span>
                        <span>🔹 {h.search_time_seconds}s de busca</span>
                        {h.filter_rule && h.filter_rule !== 'none' && (
                          <span>🔹 Filtro: {h.filter_rule}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Widget de Prova Social */}
      <div
        className={`hidden lg:flex fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:bottom-6 sm:max-w-sm px-4 py-3 bg-black/60 border border-white/10 rounded-2xl shadow-2xl items-center gap-3 hover:-translate-y-1 transition-all duration-500 cursor-default z-50 ${
          proofVisible ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-4 scale-95'
        }`}
      >
        <span className={`w-2.5 h-2.5 rounded-full animate-pulse ${
          socialProofMsgs[proofIndex].type === 'whatsapp' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.8)]' :
          socialProofMsgs[proofIndex].type === 'ia' ? 'bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.8)]' :
          socialProofMsgs[proofIndex].type === 'export' ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.8)]' :
          'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]'
        }`} />
        <p className="text-xs text-gray-300 font-medium leading-snug">
          <span className="text-white font-bold">{socialProofMsgs[proofIndex].name}</span>{' '}
          {socialProofMsgs[proofIndex].action}{' '}
          <span className={`font-bold ${
            socialProofMsgs[proofIndex].type === 'whatsapp' ? 'text-green-400' :
            socialProofMsgs[proofIndex].type === 'ia' ? 'text-purple-400' :
            socialProofMsgs[proofIndex].type === 'export' ? 'text-amber-400' :
            'text-blue-400'
          }`}>{socialProofMsgs[proofIndex].detail}</span>{' '}
          <span className="text-gray-400">{socialProofMsgs[proofIndex].target}</span>
        </p>
      </div>
    </div>
  );
}
