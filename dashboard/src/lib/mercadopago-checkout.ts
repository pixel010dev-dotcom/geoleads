import type { PlanId } from '@/lib/plans';

const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '');

export const mercadoPagoWebhookUrl = `${appUrl}/api/mercado-pago/webhook`;

/** Preferência otimizada para Brasil: PIX (QR/copia-e-cola), cartão e boleto no Checkout Pro. */
export function buildCheckoutPreferenceBody({
  plan,
  userId,
  payerEmail
}: {
  plan: { id: PlanId; name: string; tokens: number; price: number };
  userId: string;
  payerEmail?: string;
}) {
  const externalRef = `geoleads:${plan.id}:${plan.tokens}:${userId}`;

  return {
    items: [
      {
        id: `geoleads-${plan.id}`,
        title: `${plan.name} - ${plan.tokens.toLocaleString('pt-BR')} tokens GeoLeads`,
        quantity: 1,
        unit_price: plan.price,
        currency_id: 'BRL'
      }
    ],
    payer: payerEmail ? { email: payerEmail } : undefined,
    external_reference: externalRef,
    metadata: {
      plan_id: plan.id,
      tokens: plan.tokens,
      user_id: userId,
      source: 'geoleads_dashboard'
    },
    back_urls: {
      success: `${appUrl}/?checkout=success&plan=${plan.id}`,
      failure: `${appUrl}/pricing?checkout=failure`,
      pending: `${appUrl}/pricing?checkout=pending`
    },
    auto_return: 'approved' as const,
    binary_mode: false,
    notification_url: mercadoPagoWebhookUrl,
    payment_methods: {
      default_payment_method_id: 'pix',
      installments: 12,
      default_installments: 1
    },
    statement_descriptor: 'GEOLEADS'
  };
}
