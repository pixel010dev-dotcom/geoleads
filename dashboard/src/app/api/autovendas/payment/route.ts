import { NextResponse } from 'next/server';
import { getAuthUser, createAdminSupabaseClient } from '@/lib/server-auth';
import { createPixPayment, getPixPaymentStatus } from '@/lib/mercadopago-pix';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const cancellablePaymentStatuses = new Set(['cancelled', 'canceled', 'rejected', 'refunded', 'charged_back']);

const AUTOVENDAS_PRICE_PER_LEAD = Number(process.env.AUTOVENDAS_PRICE_PER_LEAD) || 0.5;

function getAutoVendasPrice(leadsAlvo?: number | null) {
  return (leadsAlvo || 50) * AUTOVENDAS_PRICE_PER_LEAD;
}

function getWebhookUrl(request: Request) {
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin).replace(/\/$/, '');
  return `${appUrl}/api/mercado-pago/webhook`;
}

export async function POST(request: Request) {
  const auth = await getAuthUser(request);
  if (!auth) return NextResponse.json({ error: 'Nao autorizado.' }, { status: 401 });

  const supabase = createAdminSupabaseClient();
  const body = await request.json();
  const campaignId = String(body.campaignId || '').trim();

  if (!campaignId) {
    return NextResponse.json({ error: 'Campanha obrigatoria.' }, { status: 400 });
  }

  const { data: campaign, error: fetchError } = await supabase
    .from('autovendas_campaigns')
    .select('*')
    .eq('id', campaignId)
    .eq('user_id', auth.user.id)
    .single();

  if (fetchError || !campaign) {
    return NextResponse.json({ error: 'Campanha nao encontrada.' }, { status: 404 });
  }

  if (campaign.payment_status === 'paid' || campaign.status === 'paid' || campaign.status === 'running') {
    return NextResponse.json({ error: 'Esta campanha ja esta paga.' }, { status: 400 });
  }

  if (campaign.status === 'cancelled') {
    return NextResponse.json({ error: 'Campanha cancelada nao pode gerar PIX.' }, { status: 400 });
  }

  const price = getAutoVendasPrice(campaign.leads_alvo);

  if (campaign.payment_id && campaign.payment_pix_code && campaign.payment_status === 'pending') {
    return NextResponse.json({
      success: true,
      reused: true,
      campaign,
      pix: {
        paymentId: campaign.payment_id,
        code: campaign.payment_pix_code,
        qr: campaign.payment_pix_qr,
        amount: price,
      },
    });
  }

  try {
    const pix = await createPixPayment({
      plan: {
        id: 'pro',
        tokens: campaign.leads_alvo,
        price,
      },
      description: `AutoVendas - ${campaign.nicho}`,
      userId: auth.user.id,
      payerEmail: auth.user.email || 'cliente@email.com',
      externalReference: `geoleads:autovendas:${campaign.id}:${auth.user.id}`,
      metadata: {
        source: 'autovendas_campaign',
        plan_id: 'autovendas',
        campaign_id: campaign.id,
      },
      notificationUrl: getWebhookUrl(request),
    });

    const { data, error: updateError } = await supabase
      .from('autovendas_campaigns')
      .update({
        payment_status: 'pending',
        payment_id: String(pix.paymentId),
        payment_pix_code: pix.qrCode,
        payment_pix_qr: pix.qrCodeBase64 ? `data:image/png;base64,${pix.qrCodeBase64}` : null,
        status: 'pending_payment',
      })
      .eq('id', campaign.id)
      .eq('user_id', auth.user.id)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: 'Erro ao salvar pagamento: ' + updateError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      campaign: data,
      pix: {
        paymentId: pix.paymentId,
        code: pix.qrCode,
        qr: pix.qrCodeBase64 ? `data:image/png;base64,${pix.qrCodeBase64}` : null,
        amount: pix.amount,
        expiresAt: pix.expiresAt,
      },
    });
  } catch (err: any) {
    console.error('[AUTOVENDAS PAYMENT] Error:', err?.message || err);
    return NextResponse.json({ error: 'Erro ao gerar PIX. Tente novamente.' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const auth = await getAuthUser(request);
  if (!auth) return NextResponse.json({ error: 'Nao autorizado.' }, { status: 401 });

  const campaignId = new URL(request.url).searchParams.get('campaignId') || '';
  if (!campaignId) {
    return NextResponse.json({ error: 'campaignId obrigatorio.' }, { status: 400 });
  }

  const supabase = createAdminSupabaseClient();
  const { data: campaign, error: fetchError } = await supabase
    .from('autovendas_campaigns')
    .select('*')
    .eq('id', campaignId)
    .eq('user_id', auth.user.id)
    .single();

  if (fetchError || !campaign) {
    return NextResponse.json({ error: 'Campanha nao encontrada.' }, { status: 404 });
  }

  if (!campaign.payment_id) {
    return NextResponse.json({ error: 'Nenhum PIX gerado para esta campanha.' }, { status: 400 });
  }

  if (campaign.payment_status === 'paid') {
    return NextResponse.json({
      success: true,
      approved: true,
      status: 'approved',
      campaign,
    });
  }

  try {
    const status = await getPixPaymentStatus(String(campaign.payment_id));
    const normalizedStatus = String(status.status || '').toLowerCase();

    let updatedCampaign = campaign;
    if (normalizedStatus === 'approved') {
      const { data } = await supabase
        .from('autovendas_campaigns')
        .update({
          payment_status: 'paid',
          status: 'paid',
        })
        .eq('id', campaign.id)
        .eq('user_id', auth.user.id)
        .select()
        .single();
      updatedCampaign = data || updatedCampaign;
    } else if (cancellablePaymentStatuses.has(normalizedStatus)) {
      const { data } = await supabase
        .from('autovendas_campaigns')
        .update({
          payment_status: 'cancelled',
          status: 'draft',
          payment_id: null,
          payment_pix_code: null,
          payment_pix_qr: null,
        })
        .eq('id', campaign.id)
        .eq('user_id', auth.user.id)
        .select()
        .single();
      updatedCampaign = data || updatedCampaign;
    }

    return NextResponse.json({
      success: true,
      approved: normalizedStatus === 'approved',
      ...status,
      campaign: updatedCampaign,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro ao consultar pagamento.' }, { status: 500 });
  }
}
