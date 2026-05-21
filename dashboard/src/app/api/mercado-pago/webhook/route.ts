import { NextResponse } from 'next/server';
import { creditApprovedMercadoPagoPayment } from '@/lib/mercadopago-webhook';

type MpEvent = {
  action: string;
  data: { id: string };
  type?: string;
};

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
    planId: result.planId,
    newTokens: result.newTokens,
    addedTokens: result.addedTokens,
    action: result.duplicated ? 'already_credited' : 'tokens_credited'
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const event: MpEvent = body.data ? body : { action: body.action, data: { id: String(body.id || '') } };

    if (!event.data?.id) {
      return NextResponse.json({ received: true }, { status: 200 });
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
