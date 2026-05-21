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
  | 'prioritySupport'
  | 'cnpjEnrichment';

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
    description: 'Para experimentar o motor antes de comprar creditos.',
    price: 0,
    tokens: 10,
    cta: 'Criar conta gratis',
    features: [
      '10 tokens iniciais',
      'Motor Maps basico',
      'Filtro por telefone e site',
      'Suporte padrao'
    ],
    featureKeys: ['extractor']
  },
  starter: {
    id: 'starter',
    name: 'Starter',
    shortName: 'Starter',
    description: 'Para validar nichos, montar listas e exportar os primeiros contatos.',
    price: 19.9,
    tokens: 600,
    cta: 'Comecar barato',
    features: [
      '600 tokens de extracao',
      'CRM de leads',
      'Exportacao CSV',
      'Cacador de e-mails em sites',
      'CNPJ quando encontrado no site oficial'
    ],
    featureKeys: ['extractor', 'crm', 'export', 'emailEnrichment', 'cnpjEnrichment']
  },
  pro: {
    id: 'pro',
    name: 'Profissional',
    shortName: 'Pro',
    description: 'Para prospeccao recorrente com redes sociais, WhatsApp e IA.',
    price: 49.9,
    tokens: 2500,
    cta: 'Comprar Pro',
    badge: 'MAIS EQUILIBRADO',
    highlight: true,
    features: [
      '2.500 tokens de extracao',
      'Tudo do Starter',
      'Instagram, Facebook e TikTok quando encontrados',
      'Disparador WhatsApp assistido',
      'Gerador de mensagens com IA'
    ],
    featureKeys: [
      'extractor',
      'crm',
      'export',
      'emailEnrichment',
      'socialEnrichment',
      'whatsappSender',
      'aiCopy',
      'cnpjEnrichment'
    ]
  },
  agency: {
    id: 'agency',
    name: 'Agencia',
    shortName: 'Agencia',
    description: 'Para operacao em volume com automacao de atendimento e prioridade.',
    price: 97,
    tokens: 7500,
    cta: 'Escalar operacao',
    features: [
      '7.500 tokens de extracao',
      'Tudo do Pro',
      'Chatbot WhatsApp por QR Code',
      'Fluxos de resposta automatica',
      'Suporte prioritario'
    ],
    featureKeys: [
      'extractor',
      'crm',
      'export',
      'emailEnrichment',
      'socialEnrichment',
      'whatsappSender',
      'aiCopy',
      'chatbot',
      'prioritySupport',
      'cnpjEnrichment'
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
  })
);

export const getCostPerLeadLabel = (plan: Plan) => {
  if (!plan.tokens || !plan.price) return 'Incluido no teste';
  return `~ ${formatPlanPrice(plan.price / plan.tokens)} por lead`;
};
