import { NextResponse } from 'next/server';
import { getAuthUser, createAdminSupabaseClient } from '@/lib/server-auth';
import { createPixPayment } from '@/lib/mercadopago-pix';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const auth = await getAuthUser(request);
  if (!auth) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });

  const supabase = createAdminSupabaseClient();
  const body = await request.json();

  const { data: campaign, error: fetchError } = await supabase
    .from('autovendas_campaigns')
    .select('*')
    .eq('id', body.campaignId)
    .eq('user_id', auth.user.id)
    .single();

  if (fetchError || !campaign) {
    return NextResponse.json({ error: 'Campanha não encontrada.' }, { status: 404 });
  }

  const price = (campaign.leads_alvo || 50) * 0.5;

  try {
    const pix = await createPixPayment({
      plan: {
        id: 'pro',
        name: `AutoVendas - ${campaign.nicho}`,
        tokens: campaign.leads_alvo,
        price,
      },
      userId: auth.user.id,
      payerEmail: auth.user.email || 'cliente@email.com',
      externalReference: `geoleads:autovendas:${campaign.id}:${auth.user.id}`,
      metadata: {
        source: 'autovendas_campaign',
        plan_id: 'autovendas',
        campaign_id: campaign.id,
      },
    });

    const { error: updateError } = await supabase
      .from('autovendas_campaigns')
      .update({
        payment_status: 'pending',
        payment_id: String(pix.paymentId),
        payment_pix_code: pix.qrCode,
        payment_pix_qr: pix.qrCodeBase64 ? `data:image/png;base64,${pix.qrCodeBase64}` : null,
        status: 'pending_payment',
      })
      .eq('id', campaign.id);

    if (updateError) {
      return NextResponse.json({ error: 'Erro ao salvar pagamento: ' + updateError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      pix: {
        paymentId: pix.paymentId,
        code: pix.qrCode,
        qr: pix.qrCodeBase64 ? `data:image/png;base64,${pix.qrCodeBase64}` : null,
        amount: pix.amount,
        expiresAt: pix.expiresAt,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro ao gerar PIX.' }, { status: 500 });
  }
}
