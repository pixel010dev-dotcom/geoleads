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
  nameKey: string;
  shortNameKey: string;
  descKey: string;
  price: number;
  tokens: number;
  ctaKey: string;
  badgeKey?: string | null;
  highlight?: boolean;
  features: string[];
  featureKeys: FeatureKey[];
};

export const planOrder: PlanId[] = ['free', 'starter', 'pro', 'agency'];

export const plans: Record<PlanId, Plan> = {
  free: {
    id: 'free',
    nameKey: 'pricing.planNames.free',
    shortNameKey: 'pricing.planNames.free',
    descKey: 'pricing.planDescriptions.free',
    price: 0,
    tokens: 10,
    ctaKey: 'pricing.cta.free',
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
    nameKey: 'pricing.planNames.starter',
    shortNameKey: 'pricing.planNames.starter',
    descKey: 'pricing.planDescriptions.starter',
    price: 9.9,
    tokens: 300,
    ctaKey: 'pricing.cta.starter',
    features: [
      '300 tokens de extração',
      'CRM de leads completo',
      'Exportação para CSV',
      'Caçador de e-mails em sites oficiais',
      'CNPJ quando encontrado no site ou Receita Federal'
    ],
    featureKeys: ['extractor', 'crm', 'export', 'emailEnrichment', 'cnpjEnrichment']
  },
  pro: {
    id: 'pro',
    nameKey: 'pricing.planNames.pro',
    shortNameKey: 'pricing.planNames.pro',
    descKey: 'pricing.planDescriptions.pro',
    price: 24.9,
    tokens: 1000,
    ctaKey: 'pricing.cta.pro',
    badgeKey: 'pricing.badge',
    highlight: true,
    features: [
      '1.000 tokens de extração',
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
    nameKey: 'pricing.planNames.agency',
    shortNameKey: 'pricing.planNames.agency',
    descKey: 'pricing.planDescriptions.agency',
    price: 47,
    tokens: 2000,
    ctaKey: 'pricing.cta.agency',
    features: [
      '2.000 tokens de extração',
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

export const getCostPerLeadLabel = (plan: Plan, t?: (key: string, vars?: Record<string, string | number>) => string) => {
  if (!plan.tokens || !plan.price) return t ? t('pricing.includedInTrial') : 'Incluído no teste';
  const price = formatPlanPrice(plan.price / plan.tokens);
  return t ? t('pricing.perLeadLabel', { price }) : `~ ${price} por lead`;
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
  extractor: 'pricing.features.extractor',
  crm: 'pricing.features.crm',
  export: 'pricing.features.export',
  emailEnrichment: 'pricing.features.emailEnrichment',
  cnpjEnrichment: 'pricing.features.cnpjEnrichment',
  socialEnrichment: 'pricing.features.socialEnrichment',
  whatsappSender: 'pricing.features.whatsappSender',
  aiCopy: 'pricing.features.aiCopy',
  chatbot: 'pricing.features.chatbot',
  autovendas: 'pricing.features.autovendas',
  prioritySupport: 'pricing.features.prioritySupport',
  facebook: 'pricing.features.facebook'
};
