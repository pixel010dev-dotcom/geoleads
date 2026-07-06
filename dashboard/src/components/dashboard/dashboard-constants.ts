import type { CrmLead, CrmLeadRow } from '@/types/crm';

export type DashboardTab = 'extractor' | 'crm' | 'whatsapp' | 'chatbot' | 'referral' | 'ia' | 'support' | 'api';

export const tabFeatureMap: Record<DashboardTab, string | null> = {
  extractor: null,
  crm: 'crm',
  whatsapp: 'whatsappSender',
  chatbot: 'chatbot',
  referral: null,
  ia: 'aiCopy',
  support: null,
  api: 'apiAccess',
};

export const tabUpgradeCopy: Record<string, { titleKey: string; descKey: string }> = {
  crm: {
    titleKey: 'lockedFeature.crm.title',
    descKey: 'lockedFeature.crm.desc',
  },
  whatsapp: {
    titleKey: 'lockedFeature.whatsapp.title',
    descKey: 'lockedFeature.whatsapp.desc',
  },
  chatbot: {
    titleKey: 'lockedFeature.chatbot.title',
    descKey: 'lockedFeature.chatbot.desc',
  },
  ia: {
    titleKey: 'lockedFeature.ia.title',
    descKey: 'lockedFeature.ia.desc',
  },
  autovendas: {
    titleKey: 'lockedFeature.autovendas.title',
    descKey: 'lockedFeature.autovendas.desc',
  },
  facebook: {
    titleKey: 'lockedFeature.facebook.title',
    descKey: 'lockedFeature.facebook.desc',
  },
};

export const getLeadKey = (lead: { nome?: string; telefone?: string; cidade?: string }) =>
  `${lead.nome || ''}|${lead.telefone || ''}|${lead.cidade || ''}`;

export const normalizeCrmLead = (lead: Partial<CrmLead>): CrmLead => ({
  ...lead,
  nome: lead.nome || 'Lead sem nome',
  telefone: lead.telefone || 'Não informado',
  email: lead.email || '',
  site: lead.site || 'Sem site',
  endereco: lead.endereco || '',
  avaliacao: lead.avaliacao || 'N/A',
  reviewCount: lead.reviewCount || '',
  categoria: lead.categoria || '',
  horarios: lead.horarios || '',
  cep: lead.cep || '',
  placeUrl: lead.placeUrl || '',
  instagram: lead.instagram || '',
  facebook: lead.facebook || '',
  tiktok: lead.tiktok || '',
  linkedin: lead.linkedin || '',
  cnpj: lead.cnpj || '',
  stage: lead.stage || 'Novo',
  notes: lead.notes || '',
  tags: Array.isArray(lead.tags) ? lead.tags : [],
  savedAt: lead.savedAt || new Date().toISOString(),
  nicho: lead.nicho || 'Geral',
  cidade: lead.cidade || 'Geral',
});

export const crmLeadToRow = (lead: Partial<CrmLead>, userId: string): CrmLeadRow => {
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
    linkedin: normalized.linkedin,
    cnpj: normalized.cnpj,
    stage: normalized.stage,
    notes: normalized.notes,
    nicho: normalized.nicho,
    cidade: normalized.cidade,
    saved_at: normalized.savedAt,
    payload: normalized,
  };
};

export const crmRowToLead = (row: Partial<CrmLeadRow>): CrmLead => normalizeCrmLead({
  ...(row.payload || {}),
  nome: row.nome,
  telefone: row.telefone,
  email: row.email,
  site: row.site,
  avaliacao: row.avaliacao,
  instagram: row.instagram,
  facebook: row.facebook,
  tiktok: row.tiktok || row.payload?.tiktok,
  linkedin: row.linkedin || row.payload?.linkedin,
  cnpj: row.cnpj || row.payload?.cnpj,
  stage: row.stage,
  notes: row.notes,
  nicho: row.nicho,
  cidade: row.cidade,
  savedAt: row.saved_at || row.payload?.savedAt,
});

export const waMessagePresets = [
  { id: 'local', titleKey: 'waMessagePresets.local.title', subtitleKey: 'waMessagePresets.local.subtitle', messageKey: 'waMessagePresets.local.message', body: 'Olá {Nome}, tudo bem? Vi que vocês atuam em {Cidade} no segmento de {Nicho}. Tenho uma ideia simples para ajudar vocês a receberem mais clientes locais. Posso te mostrar?' },
  { id: 'offer', titleKey: 'waMessagePresets.offer.title', subtitleKey: 'waMessagePresets.offer.subtitle', messageKey: 'waMessagePresets.offer.message', body: 'Oi {Nome}! Trabalho ajudando empresas de {Nicho} em {Cidade} a atrair mais clientes todos os dias. Quer que eu te envie uma sugestão rápida para o seu negócio?' },
  { id: 'audit', titleKey: 'waMessagePresets.audit.title', subtitleKey: 'waMessagePresets.audit.subtitle', messageKey: 'waMessagePresets.audit.message', body: 'Olá {Nome}. Analisei rapidamente a presença online de empresas de {Nicho} em {Cidade} e encontrei alguns pontos de melhoria. Posso te mandar um diagnóstico gratuito?' },
  { id: 'partner', titleKey: 'waMessagePresets.partner.title', subtitleKey: 'waMessagePresets.partner.subtitle', messageKey: 'waMessagePresets.partner.message', body: 'Oi {Nome}, tudo certo? Estou buscando negócios de {Nicho} em {Cidade} para uma possível parceria local. Faz sentido conversarmos por aqui?' },
];

export const waTemplateTags = ['{Nome}', '{Cidade}', '{Nicho}', '{Site}', '{Telefone}'];

export const defaultChatbotRules = [
  { id: 'preco', keyword: 'preço', responseKey: 'chatbot.rules.price', enabled: true },
  { id: 'horario', keyword: 'horário', responseKey: 'chatbot.rules.hours', enabled: true },
  { id: 'orcamento', keyword: 'orçamento', responseKey: 'chatbot.rules.budget', enabled: true },
];

export const defaultAiInstructions = 'bot.aiInstructions';

export const filterOptions = [
  { value: 'none', labelKey: 'extractor.filters.none', icon: '🔍', descKey: 'extractor.filters.noneDesc', feature: 'extractor' as const },
  { value: 'phone', labelKey: 'extractor.filters.phone', icon: '📞', descKey: 'extractor.filters.phoneDesc', feature: 'extractor' as const },
  { value: 'site', labelKey: 'extractor.filters.site', icon: '🌐', descKey: 'extractor.filters.siteDesc', feature: 'extractor' as const },
  { value: 'email', labelKey: 'extractor.filters.email', icon: '📧', descKey: 'extractor.filters.emailDesc', feature: 'extractor' as const },
  { value: 'instagram', labelKey: 'extractor.filters.insta', icon: '📸', descKey: 'extractor.filters.instaDesc', feature: 'extractor' as const },
];

export const quickSearches = [
  { keywordKey: 'extractor.quickSearches.clinics', location: 'São Paulo, SP' },
  { keywordKey: 'extractor.quickSearches.dentists', location: 'Belo Horizonte, MG' },
  { keywordKey: 'extractor.quickSearches.gyms', location: 'Rio de Janeiro, RJ' },
  { keywordKey: 'extractor.quickSearches.restaurants', location: 'Curitiba, PR' },
];

export const socialProofMsgs = [
  { name: "Mateus C.", actionKey: "socialProof.extracted", detail: "150 Leads", target: "em São Paulo", type: "extract" },
  { name: "Ana S.", actionKey: "socialProof.extracted", detail: "84 Leads", target: "no Rio de Janeiro", type: "extract" },
  { name: "Rodrigo M.", actionKey: "socialProof.sent", detail: "45 mensagens", target: "no WhatsApp", type: "whatsapp" },
  { name: "Clínica Odonto", actionKey: "socialProof.extracted", detail: "200 Leads", target: "de Dentistas", type: "extract" },
  { name: "Juliana F.", actionKey: "socialProof.exported", detail: "120 contatos", target: "para o CRM", type: "export" },
  { name: "Carlos P.", actionKey: "socialProof.extracted", detail: "95 Leads", target: "em Belo Horizonte", type: "extract" },
  { name: "Felipe R.", actionKey: "socialProof.generated", detail: "copys de vendas", target: "com IA", type: "ia" },
  { name: "Renata L.", actionKey: "socialProof.extracted", detail: "310 Leads", target: "em Curitiba", type: "extract" },
  { name: "Lucas T.", actionKey: "socialProof.sent", detail: "75 mensagens", target: "agora", type: "whatsapp" },
  { name: "Beatriz G.", actionKey: "socialProof.extracted", detail: "52 Leads", target: "em Porto Alegre", type: "extract" },
];

export const sampleCrmLeads = (): CrmLead[] => [
  normalizeCrmLead({ nome: "Petshop Amigo Canino", telefone: "(11) 99888-7766", email: "contato@amigocanino.com.br", site: "https://amigocanino.com.br", stage: "Novo", notes: "Cliente potencial de petshop em Sao Paulo. Falar com Dr. Carlos.", savedAt: new Date().toISOString(), nicho: "Petshop", cidade: "Sao Paulo" }),
  normalizeCrmLead({ nome: "Restaurante Sabor & Cia", telefone: "(21) 98765-4321", email: "contato@saborecia.com.br", site: "Sem site", stage: "Em Contato", notes: "Enviada mensagem inicial de apresentação.", savedAt: new Date().toISOString(), nicho: "Restaurante", cidade: "Rio de Janeiro" }),
  normalizeCrmLead({ nome: "Clínica Odonto Riso", telefone: "(31) 97766-5544", email: "atendimento@odontoriso.com.br", site: "https://odontoriso.com.br", stage: "Proposta", notes: "Aguardando retorno sobre proposta de tráfego pago.", savedAt: new Date().toISOString(), nicho: "Dentista", cidade: "Belo Horizonte" }),
];

export const CRM_STAGES = [
  { id: 'Novo', key: 'crm.stageNew' },
  { id: 'Em Contato', key: 'crm.stageContact' },
  { id: 'Proposta Enviada', key: 'crm.stageProposal' },
  { id: 'Vendido / Ganho', key: 'crm.stageWon' },
  { id: 'Perdido', key: 'crm.stageLost' },
];
