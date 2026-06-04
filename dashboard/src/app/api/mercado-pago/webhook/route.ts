import { NextResponse } from 'next/server';
import { creditApprovedMercadoPagoPayment } from '@/lib/mercadopago-webhook';
import crypto from 'crypto';

type MpEvent = {
  action: string;
  data: { id: string };
  type?: string;
};

function verifyMercadoPagoSignature(request: Request, body: string): boolean {
  const secret = process.env.MERCADO_PAGO_WEBHOOK_SECRET;
  if (!secret) return true; // Sem segredo configurado, aceita qualquer requisição
  const signature = request.headers.get('x-signature');
  const requestId = request.headers.get('x-request-id');
  if (!signature || !requestId) return false;
  const parts = signature.split(',');
  const ts = parts.find(p => p.trim().startsWith('ts='))?.split('=')[1]?.trim();
  const v1 = parts.find(p => p.trim().startsWith('v1='))?.split('=')[1]?.trim();
  if (!ts || !v1) return false;
  const manifest = `id:${body ? JSON.parse(body).data?.id : ''};request-id:${requestId};ts:${ts};`;
  const hmac = crypto.createHmac('sha256', secret).update(manifest).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(v1));
}

async function handlePaymentNotification(paymentId: string) {
  const result = await creditApprovedMercadoPagoPayment(paymentId);

  if (!result.ok) {
    if (result.status >= 400) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({ received: true, skipped: result.error }, { status: 200 });
  }

  return NextResponse.json({
    success: true,
    duplicated: result.duplicated || false,
    userId: result.userId,
    ...('campaignId' in result
      ? {
        campaignId: result.campaignId,
        action: result.duplicated ? 'already_paid' : result.action
      }
      : {
        planId: result.planId,
        newTokens: result.newTokens,
        addedTokens: result.addedTokens,
        action: result.duplicated ? 'already_credited' : 'tokens_credited'
      })
  });
}

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const body = JSON.parse(rawBody);
    const event: MpEvent = body.data ? body : { action: body.action, data: { id: String(body.id || '') } };

    if (!event.data?.id) {
      return NextResponse.json({ received: true }, { status: 200 });
    }

    // Valida assinatura do webhook
    if (!verifyMercadoPagoSignature(request, rawBody)) {
      console.warn('Webhook: assinatura invalida rejeitada');
      return NextResponse.json({ error: 'invalid_signature' }, { status: 401 });
    }

    if (event.action !== 'payment.updated' && event.action !== 'payment.created') {
      return NextResponse.json({ received: true }, { status: 200 });
    }

    return handlePaymentNotification(event.data.id);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'erro desconhecido';
    console.error('ERRO WEBHOOK MERCADO PAGO:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const topic = url.searchParams.get('topic') || url.searchParams.get('type');
    const id = url.searchParams.get('id') || url.searchParams.get('data.id');

    if (topic === 'payment' && id) {
      return handlePaymentNotification(id);
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'erro desconhecido';
    console.error('ERRO WEBHOOK MERCADO PAGO (GET):', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
