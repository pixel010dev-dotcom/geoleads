import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function sendReferralBonusEmail(toEmail: string, tokens: number) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn('[EMAIL] SMTP nao configurado. Pule email de bonus de indicacao.');
    return;
  }
  try {
    await transporter.sendMail({
      from: `"GeoLeads" <${process.env.SMTP_USER}>`,
      to: toEmail,
      subject: `🎉 Voce ganhou ${tokens} tokens de indicacao no GeoLeads!`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">Parabens! 🎉</h2>
          <p>Alguem que se cadastrou pelo seu link de indicacao acabou de comprar um plano.</p>
          <p style="font-size: 24px; font-weight: bold; color: #f59e0b;">Voce ganhou <strong>${tokens} tokens</strong>!</p>
          <p>Continue compartilhando seu link para ganhar ainda mais tokens:</p>
          <p style="text-align: center; margin: 20px 0;">
            <a href="https://geoleads-production.up.railway.app/login?ref=SEU_ID" 
               style="background: #2563eb; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none;">
              Compartilhar Link
            </a>
          </p>
          <hr>
          <small style="color: #666;">Enviado automaticamente pelo GeoLeads</small>
        </div>
      `,
    });
    console.log('[EMAIL] Email de bonus de indicacao enviado para', toEmail);
  } catch (err) {
    console.error('[EMAIL] Erro ao enviar email de bonus:', err);
  }
}

export async function sendWelcomeEmail(toEmail: string, name: string) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn('[EMAIL] SMTP nao configurado. Pule email de boas-vindas.');
    return;
  }
  try {
    await transporter.sendMail({
      from: `"GeoLeads" <${process.env.SMTP_USER}>`,
      to: toEmail,
      subject: 'Bem-vindo ao GeoLeads! 🎉',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">Bem-vindo ao GeoLeads, ${name}! 🎉</h2>
          <p>Seus <strong>10 tokens gratis</strong> ja estao disponiveis para voce testar a ferramenta.</p>
          <p>Com o GeoLeads voce pode:</p>
          <ul>
            <li>Extrair leads do Google Maps em 140 cidades</li>
            <li>Encontrar telefone, email, site e redes sociais</li>
            <li>Organizar leads no CRM integrado</li>
            <li>Disparar mensagens no WhatsApp</li>
          </ul>
          <p style="text-align: center; margin: 20px 0;">
            <a href="https://geoleads-production.up.railway.app/app/dashboard"
               style="background: #2563eb; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none;">
              Comecar a Extrair Leads
            </a>
          </p>
          <p>Indique amigos e ganhe <strong>100 tokens</strong> para cada um que comprar um plano!</p>
          <hr>
          <small style="color: #666;">Enviado automaticamente pelo GeoLeads</small>
        </div>
      `,
    });
    console.log('[EMAIL] Email de boas-vindas enviado para', toEmail);
  } catch (err) {
    console.error('[EMAIL] Erro ao enviar email de boas-vindas:', err);
  }
}

export async function sendPaymentConfirmationEmail(toEmail: string, planName: string, tokens: number) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn('[EMAIL] SMTP nao configurado. Pule email de confirmacao de pagamento.');
    return;
  }
  try {
    await transporter.sendMail({
      from: `"GeoLeads" <${process.env.SMTP_USER}>`,
      to: toEmail,
      subject: `✅ Pagamento confirmado - Plano ${planName} ativado!`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">Pagamento confirmado! ✅</h2>
          <p>Seu plano <strong>${planName}</strong> foi ativado com sucesso.</p>
          <p style="font-size: 24px; font-weight: bold; color: #22c55e;">${tokens} tokens adicionados a sua conta!</p>
          <p>Indique amigos e ganhe 100 tokens para cada um que comprar um plano.</p>
          <p style="text-align: center; margin: 20px 0;">
            <a href="https://geoleads-production.up.railway.app/app/dashboard"
               style="background: #2563eb; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none;">
              Ir para o Dashboard
            </a>
          </p>
          <hr>
          <small style="color: #666;">Enviado automaticamente pelo GeoLeads</small>
        </div>
      `,
    });
    console.log('[EMAIL] Email de confirmacao de pagamento enviado para', toEmail);
  } catch (err) {
    console.error('[EMAIL] Erro ao enviar email de confirmacao:', err);
  }
}

export async function sendFeedbackNotification(data: {
  name: string;
  rating: number;
  feedback: string | null;
  userId: string | null;
}) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn('[EMAIL] SMTP não configurado. Pule notificação de feedback.');
    return;
  }
  try {
    await transporter.sendMail({
      from: `"GeoLeads Feedback" <${process.env.SMTP_USER}>`,
      to: process.env.NOTIFICATION_EMAIL || process.env.SMTP_USER,
      subject: `[GeoLeads] Novo feedback de ${data.name}`,
      html: `
        <h2>Novo feedback recebido</h2>
        <table>
          <tr><td><strong>Nome:</strong></td><td>${data.name}</td></tr>
          <tr><td><strong>Nota:</strong></td><td>${'★'.repeat(data.rating)}${'☆'.repeat(5 - data.rating)} (${data.rating}/5)</td></tr>
          <tr><td><strong>User ID:</strong></td><td>${data.userId || '-'}</td></tr>
        </table>
        ${data.feedback ? `<p><strong>Feedback:</strong><br>${data.feedback}</p>` : ''}
        <hr>
        <small>Enviado automaticamente pelo GeoLeads</small>
      `,
    });
    console.log('[EMAIL] Notificação de feedback enviada com sucesso.');
  } catch (err) {
    console.error('[EMAIL] Erro ao enviar notificação de feedback:', err);
  }
}
