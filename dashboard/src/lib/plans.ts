export type PlanId = 'free' | 'starter' | 'pro' | 'agency' | 'api';

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
  | 'facebook'
  | 'apiAccess';

export type Plan = {
  id: PlanId;
  nameKey: string;
  shortNameKey: string;
  descKey: string;
  price: number;
  annualPrice: number;
  tokens: number;
  ctaKey: string;
  badgeKey?: string | null;
  highlight?: boolean;
  features: string[];
  featureKeys: FeatureKey[];
};

export const ANNUAL_DISCOUNT = 0.2;

export function getAnnualPrice(monthlyPrice: number): number {
  if (monthlyPrice <= 0) return 0;
  return Math.round(monthlyPrice * 12 * (1 - ANNUAL_DISCOUNT));
}

export const planOrder: PlanId[] = ['free', 'starter', 'pro', 'agency', 'api'];

// Custo real por lead via Google Places API: ~R$0.017
// Margem de lucro: 50-70%

export const plans: Record<PlanId, Plan> = {
  free: {
    id: 'free',
    nameKey: 'pricing.planNames.free',
    shortNameKey: 'pricing.planNames.free',
    descKey: 'pricing.planDescriptions.free',
    price: 0,
    annualPrice: 0,
    tokens: 5,
    ctaKey: 'pricing.cta.free',
    features: [
      '5 tokens iniciais',
      'Motor Google Places',
      'Dados: telefone, site, endereço',
      'Suporte padrão'
    ],
    featureKeys: ['extractor']
  },
  starter: {
    id: 'starter',
    nameKey: 'pricing.planNames.starter',
    shortNameKey: 'pricing.planNames.starter',
    descKey: 'pricing.planDescriptions.starter',
    price: 9.90,
    annualPrice: 95,
    tokens: 300,
    ctaKey: 'pricing.cta.starter',
    badgeKey: 'pricing.badge',
    highlight: true,
    features: [
      '300 leads/mês',
      'CRM completo',
      'Exportação CSV',
      'Telefone + Site + Endereço',
      'Suporte padrão'
    ],
    featureKeys: ['extractor', 'crm', 'export']
  },
  pro: {
    id: 'pro',
    nameKey: 'pricing.planNames.pro',
    shortNameKey: 'pricing.planNames.pro',
    descKey: 'pricing.planDescriptions.pro',
    price: 29.90,
    annualPrice: 287,
    tokens: 1000,
    ctaKey: 'pricing.cta.pro',
    features: [
      '1.000 leads/mês',
      'Tudo do Starter',
      'Instagram + Facebook + TikTok',
      'Disparador WhatsApp',
      'Gerador de mensagens com IA',
      'AutoVendas automático'
    ],
    featureKeys: [
      'extractor', 'crm', 'export', 'socialEnrichment',
      'whatsappSender', 'aiCopy', 'autovendas'
    ]
  },
  agency: {
    id: 'agency',
    nameKey: 'pricing.planNames.agency',
    shortNameKey: 'pricing.planNames.agency',
    descKey: 'pricing.planDescriptions.agency',
    price: 67.90,
    annualPrice: 652,
    tokens: 3000,
    ctaKey: 'pricing.cta.agency',
    features: [
      '3.000 leads/mês',
      'Tudo do Pro',
      'Chatbot WhatsApp QR Code',
      'Fluxos personalizados',
      'Suporte prioritário',
      'Integração completa'
    ],
    featureKeys: [
      'extractor', 'crm', 'export', 'socialEnrichment',
      'whatsappSender', 'aiCopy', 'autovendas', 'chatbot',
      'prioritySupport'
    ]
  },
  api: {
    id: 'api',
    nameKey: 'pricing.planNames.api',
    shortNameKey: 'pricing.planNames.api',
    descKey: 'pricing.planDescriptions.api',
    price: 97,
    annualPrice: 931,
    tokens: 10000,
    ctaKey: 'pricing.cta.api',
    badgeKey: 'pricing.badgeApi',
    features: [
      '10.000 requisições/mês via API',
      'Acesso completo à API REST',
      'Webhooks em tempo real',
      'Documentação completa',
      'Rate limit alto',
      'Suporte prioritário',
      'Chave de API dedicada'
    ],
    featureKeys: [
      'extractor', 'crm', 'export', 'socialEnrichment',
      'whatsappSender', 'aiCopy', 'autovendas', 'chatbot',
      'prioritySupport', 'apiAccess'
    ]
  }
};

export const paidPlanIds: PlanId[] = ['starter', 'pro', 'agency', 'api'];

export const getPlanById = (planId?: string | null) => (
  plans[(planId || 'free') as PlanId] || plans.free
);

export const getPlanLevel = (planId: PlanId) => planOrder.indexOf(planId);

export const hasFeature = (planId: PlanId, feature: FeatureKey) => (
  getPlanById(planId).featureKeys.includes(feature)
);

export const getRequiredPlanForFeature = (feature: FeatureKey): PlanId => {
  const match = planOrder.find(planId => plans[planId].featureKeys.includes(feature));
  return match || 'api';
};

export const getPlanIdFromTokens = (tokens?: number | null): PlanId => {
  if (typeof tokens !== 'number') return 'free';
  if (tokens >= plans.api.tokens) return 'api';
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
  if (!plan.tokens || !plan.price) return t ? t('pricing.includedInTrial') : 'Grátis';
  const price = formatPlanPrice(plan.price / plan.tokens);
  return t ? t('pricing.perLeadLabel', { price }) : `~${price}/lead`;
};

export const allFeatureKeys: FeatureKey[] = [
  'extractor', 'crm', 'export', 'socialEnrichment',
  'whatsappSender', 'aiCopy', 'chatbot', 'autovendas',
  'prioritySupport', 'apiAccess'
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
  facebook: 'pricing.features.facebook',
  apiAccess: 'pricing.features.apiAccess'
};
