import { NextResponse } from 'next/server';
import { getPixPaymentStatus } from '@/lib/mercadopago-pix';
import { getAuthUser } from '@/lib/server-auth';

export async function GET(request: Request) {
  try {
    const auth = await getAuthUser(request);
    if (!auth) {
      return NextResponse.json({ error: 'Nao autenticado.' }, { status: 401 });
    }

    const paymentId = new URL(request.url).searchParams.get('paymentId') || '';
    if (!paymentId) {
      return NextResponse.json({ error: 'paymentId obrigatorio.' }, { status: 400 });
    }

    const status = await getPixPaymentStatus(paymentId);

    return NextResponse.json({
      success: true,
      ...status,
      approved: status.status === 'approved'
    });
  } catch {
    return NextResponse.json({ error: 'Erro ao verificar status do pagamento' }, { status: 500 });
  }
}
