import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const { email, name } = await request.json();
    if (!email) {
      return NextResponse.json({ error: 'Email obrigatorio' }, { status: 400 });
    }

    const { sendWelcomeEmail } = await import('@/lib/email');
    await sendWelcomeEmail(email, name || 'Usuario');

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[WELCOME EMAIL] Error:', err);
    return NextResponse.json({ error: 'Erro ao enviar email' }, { status: 500 });
  }
}
