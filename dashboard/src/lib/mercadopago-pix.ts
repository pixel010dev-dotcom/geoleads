import { MercadoPagoConfig, Payment } from 'mercadopago';
import type { PlanId } from '@/lib/plans';
import { mercadoPagoWebhookUrl } from '@/lib/mercadopago-checkout';

function getMpConfig() {
  const token = process.env.MERCADO_PAGO_ACCESS_TOKEN || '';
  const isSandbox = token.startsWith('TEST-');
  const isSimulated = token.startsWith('SIMULATED_') || (!token || token.length < 10);
  return {
    client: new MercadoPagoConfig({
      accessToken: token || 'dummy',
      options: { timeout: 15000 }
    }),
    isSandbox,
    isSimulated,
    isConfigured: token.length > 10 || isSimulated
  };
}

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
  const { client, isSandbox, isSimulated, isConfigured } = getMpConfig();

  if (!isConfigured) {
    throw new Error(
      'Mercado Pago não configurado. Configure MERCADO_PAGO_ACCESS_TOKEN no Railway.'
    );
  }

  const externalRef = `geoleads:${plan.id}:${plan.tokens}:${userId}`;
  const expiration = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  if (isSimulated) {
    return {
      paymentId: 123456789,
      status: 'pending',
      qrCode: '000201010212261060014br.gov.bcb.pix0114+5511999999999520400005303986540410.005802BR5913GeoLeads Simulado6008BRASILIA62070503***63041234',
      qrCodeBase64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      ticketUrl: undefined,
      expiresAt: expiration,
      amount: plan.price
    };
  }

  const paymentApi = new Payment(client);

  let result;
  try {
    result = await paymentApi.create({
      body: {
        transaction_amount: Number(plan.price.toFixed(2)),
        description: `GeoLeads ${plan.name} - ${plan.tokens} tokens`,
        payment_method_id: 'pix',
        external_reference: externalRef,
        date_of_expiration: expiration,
        ...(isSandbox ? {} : { notification_url: mercadoPagoWebhookUrl }),
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
  } catch (mpError: any) {
    const msg = mpError.message || 'Erro desconhecido do Mercado Pago';
    console.error('MP PIX CREATE ERROR:', msg);

    if (msg.includes('Unauthorized use of live credentials')) {
      throw new Error(
        'Token de PRODUÇÃO não autorizado. Você precisa usar um token de TESTE (TEST-...) '
        + 'enquanto estiver em desenvolvimento. '
        + 'Pegue seu token de teste em: mercadopago.com.br > Credenciais > Teste'
      );
    }

    if (msg.includes('invalid json') || msg.includes('Unexpected end')) {
      throw new Error(
        isSandbox
          ? 'Mercado Pago sandbox retornou resposta vazia. Verifique o access token.'
          : 'Mercado Pago produção retornou resposta vazia. Verifique: 1) Chave PIX cadastrada 2) Credenciais de produção ativadas em mercadopago.com.br'
      );
    }

    if (msg.includes('access_token')) {
      throw new Error('Token do Mercado Pago inválido ou não configurado.');
    }

    throw new Error(`Mercado Pago: ${msg}`);
  }

  const tx = result?.point_of_interaction?.transaction_data;
  const qrCode = tx?.qr_code || '';
  const qrCodeBase64 = tx?.qr_code_base64 || '';

  if (!qrCode && !qrCodeBase64) {
    const status = result?.status || 'unknown';
    const detail = result?.status_detail || 'sem_qr_code';
    throw new Error(
      `Mercado Pago não gerou QR Code. Status: ${status} (${detail}). Cadastre suas chaves PIX em mercadopago.com.br`
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
  const { client, isSimulated, isConfigured } = getMpConfig();

  if (!isConfigured) {
    throw new Error('Mercado Pago não configurado.');
  }

  if (isSimulated) {
    return {
      paymentId: Number(paymentId) || 123456789,
      status: 'approved',
      statusDetail: 'accredited',
      externalReference: 'geoleads:simulated:0:simulated'
    };
  }

  const paymentApi = new Payment(client);
  const result = await paymentApi.get({ id: paymentId });

  return {
    paymentId: result.id,
    status: result.status,
    statusDetail: result.status_detail,
    externalReference: result.external_reference
  };
}
