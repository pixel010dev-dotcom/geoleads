import { MercadoPagoConfig, Payment } from 'mercadopago';
import type { PlanId } from '@/lib/plans';
import { mercadoPagoWebhookUrl } from '@/lib/mercadopago-checkout';

const client = new MercadoPagoConfig({
  accessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN || ''
});

export type PixCheckoutResult = {
  paymentId: number;
  status: string;
  statusDetail?: string;
  qrCode: string;
  qrCodeBase64: string;
  ticketUrl?: string;
  expiresAt?: string;
  amount: number;
};

export async function createPixPayment({
  plan,
  userId,
  payerEmail
}: {
  plan: { id: PlanId; name: string; tokens: number; price: number };
  userId: string;
  payerEmail: string;
}): Promise<PixCheckoutResult> {
  const paymentApi = new Payment(client);
  const externalRef = `geoleads:${plan.id}:${plan.tokens}:${userId}`;
  const expiration = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  const result = await paymentApi.create({
    body: {
      transaction_amount: plan.price,
      description: `GeoLeads ${plan.name} - ${plan.tokens.toLocaleString('pt-BR')} tokens`,
      payment_method_id: 'pix',
      external_reference: externalRef,
      date_of_expiration: expiration,
      notification_url: mercadoPagoWebhookUrl,
      metadata: {
        plan_id: plan.id,
        tokens: plan.tokens,
        user_id: userId,
        source: 'geoleads_pix_checkout'
      },
      payer: {
        email: payerEmail,
        first_name: 'Cliente',
        last_name: 'GeoLeads'
      }
    }
  });

  const tx = result.point_of_interaction?.transaction_data;
  const qrCode = tx?.qr_code || '';
  const qrCodeBase64 = tx?.qr_code_base64 || '';

  if (!qrCode && !qrCodeBase64) {
    const detail = result.status_detail || 'sem_qr_code';
    throw new Error(
      `PIX indisponivel no Mercado Pago (${detail}). Cadastre suas chaves PIX na conta vendedor em mercadopago.com.br`
    );
  }

  return {
    paymentId: result.id || 0,
    status: result.status || 'pending',
    statusDetail: result.status_detail,
    qrCode,
    qrCodeBase64,
    ticketUrl: tx?.ticket_url,
    expiresAt: result.date_of_expiration || expiration,
    amount: plan.price
  };
}

export async function getPixPaymentStatus(paymentId: string) {
  const paymentApi = new Payment(client);
  const result = await paymentApi.get({ id: paymentId });

  return {
    paymentId: result.id,
    status: result.status,
    statusDetail: result.status_detail,
    externalReference: result.external_reference
  };
}
