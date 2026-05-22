import { NextResponse } from 'next/server';
import { MercadoPagoConfig, Preference } from 'mercadopago';
import { getPlanById, paidPlanIds, type PlanId } from '@/lib/plans';
import { buildCheckoutPreferenceBody } from '@/lib/mercadopago-checkout';
import { createPixPayment } from '@/lib/mercadopago-pix';
import { getAuthUser } from '@/lib/server-auth';

const token = process.env.MERCADO_PAGO_ACCESS_TOKEN || '';
const isSimulated = token.startsWith('SIMULATED_') || (!token || token.length < 10);
const client = new MercadoPagoConfig({
  accessToken: token || 'dummy'
});

export async function POST(request: Request) {
  try {
    const auth = await getAuthUser(request);
    if (!auth) {
      return NextResponse.json({ error: 'Faça login para comprar tokens.' }, { status: 401 });
    }

    const user = auth.user;
    const body = await request.json();
    const selectedPlanId = String(body.planId || '').trim() as PlanId;
    const method = String(body.method || 'pix').toLowerCase();

    if (!paidPlanIds.includes(selectedPlanId)) {
      return NextResponse.json({ error: 'Plano invalido.' }, { status: 400 });
    }

    const plan = getPlanById(selectedPlanId);
    const payerEmail = user.email || body.email || '';
    const profileTokens = auth.tokens || 0;
    const currentPlanId = auth.planId || 'free';

    if (!payerEmail) {
      return NextResponse.json({ error: 'Sua conta precisa de e-mail para gerar PIX.' }, { status: 400 });
    }

    if (method === 'card' || method === 'checkout') {
      if (isSimulated) {
        return NextResponse.json({
          success: true,
          method: 'checkout',
          plan: { id: plan.id, tokens: plan.tokens, price: plan.price },
          url: `https://geoleads-production.up.railway.app/?checkout=simulated&plan=${plan.id}`,
          sandboxUrl: null,
          currentPlan: currentPlanId,
          currentTokens: profileTokens
        });
      }

      const preference = new Preference(client);
      const result = await preference.create({
        body: buildCheckoutPreferenceBody({
          plan,
          userId: user.id,
          payerEmail
        })
      });

      return NextResponse.json({
        success: true,
        method: 'checkout',
        plan: { id: plan.id, tokens: plan.tokens, price: plan.price },
        url: result.init_point,
        sandboxUrl: result.sandbox_init_point,
        currentPlan: currentPlanId,
        currentTokens: profileTokens
      });
    }

    const pix = await createPixPayment({
      plan,
      userId: user.id,
      payerEmail
    });

    return NextResponse.json({
      success: true,
      method: 'pix',
      plan: { id: plan.id, tokens: plan.tokens, price: plan.price },
      paymentId: pix.paymentId,
      status: pix.status,
      qrCode: pix.qrCode,
      qrCodeBase64: pix.qrCodeBase64,
      ticketUrl: pix.ticketUrl,
      expiresAt: pix.expiresAt,
      amount: pix.amount,
      currentPlan: currentPlanId,
      currentTokens: profileTokens
    });
  } catch (error: unknown) {
    let message = error instanceof Error ? error.message : 'Erro interno';
    console.error('ERRO MERCADO PAGO:', message);
    if (message.includes('Unauthorized use of live credentials')) {
      message = 'Token de PRODUÇÃO não autorizado. Use um token de TESTE (TEST-...) '
        + 'em mercadopago.com.br > Credenciais > Teste';
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
