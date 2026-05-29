export type DashboardTab = 'extractor' | 'autovendas' | 'crm' | 'enrich' | 'whatsapp' | 'chatbot' | 'ia' | 'support' | 'facebook';

export const tabFeatureMap: Record<DashboardTab, string | null> = {
  extractor: null,
  autovendas: 'autovendas',
  crm: 'crm',
  enrich: null,
  whatsapp: 'whatsappSender',
  chatbot: 'chatbot',
  ia: 'aiCopy',
  support: null,
  facebook: 'facebook',
};

export const tabUpgradeCopy: Record<string, { title: string; description: string }> = {
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
  },
  autovendas: {
    title: 'AutoVendas liberado no Pro',
    description: 'Campanhas automáticas de lead gen com extração + disparo integrados.'
  }
};

export const getLeadKey = (lead: any) => `${lead.nome || ''}|${lead.telefone || ''}|${lead.cidade || ''}`;

export const normalizeCrmLead = (lead: any) => ({
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
  tags: Array.isArray(lead.tags) ? lead.tags : [],
  savedAt: lead.savedAt || new Date().toISOString(),
  nicho: lead.nicho || 'Geral',
  cidade: lead.cidade || 'Geral'
});

export const crmLeadToRow = (lead: any, userId: string) => {
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

export const crmRowToLead = (row: any) => normalizeCrmLead({
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

export const waMessagePresets = [
  { id: 'local', title: 'Abordagem local', subtitle: 'Primeiro contato consultivo', body: 'Olá {Nome}, tudo bem? Vi que vocês atuam em {Cidade} no segmento de {Nicho}. Tenho uma ideia simples para ajudar vocês a receberem mais clientes locais. Posso te mostrar?' },
  { id: 'offer', title: 'Oferta direta', subtitle: 'Mensagem curta e objetiva', body: 'Oi {Nome}! Trabalho ajudando empresas de {Nicho} em {Cidade} a atrair mais clientes todos os dias. Quer que eu te envie uma sugestão rápida para o seu negócio?' },
  { id: 'audit', title: 'Diagnóstico grátis', subtitle: 'Boa para agência/serviço', body: 'Olá {Nome}. Analisei rapidamente a presença online de empresas de {Nicho} em {Cidade} e encontrei alguns pontos de melhoria. Posso te mandar um diagnóstico gratuito?' },
  { id: 'partner', title: 'Parceria', subtitle: 'Tom mais leve', body: 'Oi {Nome}, tudo certo? Estou buscando negócios de {Nicho} em {Cidade} para uma possível parceria local. Faz sentido conversarmos por aqui?' }
];

export const waTemplateTags = ['{Nome}', '{Cidade}', '{Nicho}', '{Site}', '{Telefone}'];

export const defaultChatbotRules = [
  { id: 'preco', keyword: 'preço', response: 'Oi {Nome}! Os valores dependem do objetivo e da região. Me fala qual serviço você procura que eu te ajudo por aqui.', enabled: true },
  { id: 'horario', keyword: 'horário', response: 'Olá {Nome}! Nosso horário de atendimento é de segunda a sexta, das 9h às 18h. Se quiser, já me diga o que precisa.', enabled: true },
  { id: 'orcamento', keyword: 'orçamento', response: 'Claro, {Nome}. Para montar um orçamento rápido, me envie sua cidade e o serviço que você deseja.', enabled: true }
];

export const filterOptions = [
  { value: 'none', label: 'Trazer tudo', icon: '🔍', desc: 'Recomendado para varredura completa', feature: 'extractor' as const },
  { value: 'phone', label: 'Só Telefone', icon: '📞', desc: 'Filtra empresas com contato telefônico', feature: 'extractor' as const },
  { value: 'cnpj', label: 'Só CNPJ', icon: '🏢', desc: 'Filtra empresas com CNPJ no site', feature: 'cnpjEnrichment' as const },
  { value: 'email', label: 'Só E-mail', icon: '✉️', desc: 'Filtra empresas com e-mail no site', feature: 'emailEnrichment' as const },
  { value: 'insta', label: 'Só Instagram', icon: '📷', desc: 'Extrai apenas contas com Instagram', feature: 'socialEnrichment' as const },
  { value: 'face', label: 'Só Facebook', icon: '📘', desc: 'Filtra leads que possuem página Facebook', feature: 'socialEnrichment' as const },
  { value: 'tiktok', label: 'Só TikTok', icon: '🎵', desc: 'Filtra leads com perfil TikTok', feature: 'socialEnrichment' as const },
  { value: 'site', label: 'Só Site', icon: '🌐', desc: 'Filtra apenas empresas com site próprio', feature: 'extractor' as const },
];

export const quickSearches = [
  { keyword: 'Clínicas de estética', location: 'São Paulo, SP' },
  { keyword: 'Dentistas', location: 'Belo Horizonte, MG' },
  { keyword: 'Academias', location: 'Rio de Janeiro, RJ' },
  { keyword: 'Restaurantes', location: 'Curitiba, PR' }
];

export const socialProofMsgs = [
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

export const sampleCrmLeads = () => [
  { nome: "Petshop Amigo Canino", telefone: "(11) 99888-7766", email: "contato@amigocanino.com.br", site: "https://amigocanino.com.br", stage: "Novo", notes: "Cliente potencial de petshop em São Paulo. Falar com Dr. Carlos.", savedAt: new Date().toISOString(), nicho: "Petshop", cidade: "São Paulo" },
  { nome: "Restaurante Sabor & Cia", telefone: "(21) 98765-4321", email: "contato@saborecia.com.br", site: "Sem site", stage: "Em Contato", notes: "Enviada mensagem inicial de apresentação.", savedAt: new Date().toISOString(), nicho: "Restaurante", cidade: "Rio de Janeiro" },
  { nome: "Clínica Odonto Riso", telefone: "(31) 97766-5544", email: "atendimento@odontoriso.com.br", site: "https://odontoriso.com.br", stage: "Proposta", notes: "Aguardando retorno sobre proposta de tráfego pago.", savedAt: new Date().toISOString(), nicho: "Dentista", cidade: "Belo Horizonte" }
];
