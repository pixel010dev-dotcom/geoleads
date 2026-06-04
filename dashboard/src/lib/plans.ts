export type PlanId = 'free' | 'starter' | 'pro' | 'agency';

export type FeatureKey =
  | 'extractor'
  | 'crm'
  | 'export'
  | 'emailEnrichment'
  | 'socialEnrichment'
  | 'whatsappSender'
  | 'aiCopy'
  | 'chatbot'
  | 'autovendas'
  | 'prioritySupport'
  | 'cnpjEnrichment'
  | 'facebook';

export type Plan = {
  id: PlanId;
  name: string;
  shortName: string;
  description: string;
  price: number;
  tokens: number;
  cta: string;
  badge?: string;
  highlight?: boolean;
  features: string[];
  featureKeys: FeatureKey[];
};

export const planOrder: PlanId[] = ['free', 'starter', 'pro', 'agency'];

export const plans: Record<PlanId, Plan> = {
  free: {
    id: 'free',
    name: 'Teste',
    shortName: 'Teste',
    description: 'Para experimentar o motor antes de comprar créditos.',
    price: 0,
    tokens: 10,
    cta: 'Criar conta grátis',
    features: [
      '10 tokens iniciais',
      'Motor Maps básico',
      'Filtro por telefone e site',
      'Suporte padrão'
    ],
    featureKeys: ['extractor']
  },
  starter: {
    id: 'starter',
    name: 'Inicial',
    shortName: 'Inicial',
    description: 'Para começar a prospectar com CRM, exportação e dados essenciais.',
    price: 9.9,
    tokens: 400,
    cta: 'Escolher Inicial',
    features: [
      '400 tokens de extração',
      'CRM de leads completo',
      'Exportação para CSV',
      'Caçador de e-mails em sites oficiais',
      'CNPJ quando encontrado no site ou Receita Federal'
    ],
    featureKeys: ['extractor', 'crm', 'export', 'emailEnrichment', 'cnpjEnrichment']
  },
  pro: {
    id: 'pro',
    name: 'Profissional',
    shortName: 'Pro',
    description: 'Para prospecção recorrente com redes sociais, WhatsApp e IA.',
    price: 24.9,
    tokens: 1200,
    cta: 'Escolher Profissional',
    badge: 'MAIS EQUILIBRADO',
    highlight: true,
    features: [
      '1.200 tokens de extração',
      'Tudo do plano Inicial',
      'Instagram, Facebook e TikTok quando encontrados',
      'Disparador WhatsApp assistido com fila inteligente',
      'Gerador de mensagens de vendas com IA',
      'AutoVendas — campanhas automáticas de lead gen'
    ],
    featureKeys: [
      'extractor',
      'crm',
      'export',
      'emailEnrichment',
      'socialEnrichment',
      'whatsappSender',
      'aiCopy',
      'autovendas',
      'cnpjEnrichment'
    ]
  },
  agency: {
    id: 'agency',
    name: 'Profissional Max',
    shortName: 'Max',
    description: 'Para operação em volume com automação de atendimento e prioridade.',
    price: 47,
    tokens: 2400,
    cta: 'Escolher Max',
    features: [
      '2.400 tokens de extração',
      'Tudo do plano Profissional',
      'AutoVendas — campanhas automáticas de lead gen',
      'Chatbot WhatsApp por QR Code com regras automáticas',
      'Fluxos de resposta personalizáveis',
      'Suporte prioritário com atendimento humano'
    ],
    featureKeys: [
      'extractor',
      'crm',
      'export',
      'emailEnrichment',
      'socialEnrichment',
      'whatsappSender',
      'aiCopy',
      'autovendas',
      'chatbot',
      'prioritySupport',
      'cnpjEnrichment',
      'facebook'
    ]
  }
};

export const paidPlanIds: PlanId[] = ['starter', 'pro', 'agency'];

export const getPlanById = (planId?: string | null) => (
  plans[(planId || 'free') as PlanId] || plans.free
);

export const getPlanLevel = (planId: PlanId) => planOrder.indexOf(planId);

export const hasFeature = (planId: PlanId, feature: FeatureKey) => (
  getPlanById(planId).featureKeys.includes(feature)
);

export const getRequiredPlanForFeature = (feature: FeatureKey): PlanId => {
  const match = planOrder.find(planId => plans[planId].featureKeys.includes(feature));
  return match || 'agency';
};

export const getPlanIdFromTokens = (tokens?: number | null): PlanId => {
  if (typeof tokens !== 'number') return 'free';
  if (tokens >= plans.agency.tokens) return 'agency';
  if (tokens >= plans.pro.tokens) return 'pro';
  if (tokens >= plans.starter.tokens) return 'starter';
  return 'free';
};

export const formatPlanPrice = (price: number) => (
  price.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).replace(/\s/g, ' ')
);

export const getCostPerLeadLabel = (plan: Plan) => {
  if (!plan.tokens || !plan.price) return 'Incluído no teste';
  return `~ ${formatPlanPrice(plan.price / plan.tokens)} por lead`;
};

export const allFeatureKeys: FeatureKey[] = [
  'extractor',
  'crm',
  'export',
  'emailEnrichment',
  'cnpjEnrichment',
  'socialEnrichment',
  'whatsappSender',
  'aiCopy',
  'chatbot',
  'autovendas',
  'prioritySupport',
  'facebook'
];

export const featureLabels: Record<FeatureKey, string> = {
  extractor: 'Motor Extrator',
  crm: 'CRM de Leads',
  export: 'Exportação CSV',
  emailEnrichment: 'Caçador de E-mails',
  cnpjEnrichment: 'CNPJ Oficial',
  socialEnrichment: 'Redes Sociais',
  whatsappSender: 'Disparador WhatsApp',
  aiCopy: 'Copys com IA',
  chatbot: 'Chatbot WhatsApp',
  autovendas: 'AutoVendas',
  prioritySupport: 'Suporte Prioritário',
  facebook: 'Anúncios Facebook'
};
