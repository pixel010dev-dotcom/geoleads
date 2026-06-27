import nodemailer from 'nodemailer';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://geoleads-production.up.railway.app';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function sendReferralBonusEmail(toEmail: string, tokens: number, userId?: string) {
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
            <a href="${APP_URL}${userId ? `/login?ref=${userId}` : '/login'}"
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
            <a href="${APP_URL}/app/dashboard"
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
            <a href="${APP_URL}/app/dashboard"
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

// --- DRIP NURTURE EMAILS ---

const DRIP_TEMPLATES: Record<number, { subject: string; html: (name: string) => string }> = {
  1: {
    subject: '👋 Primeiros passos no GeoLeads',
    html: (name: string) => `
      <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Bem-vindo ao GeoLeads, ${name}!</h2>
        <p>Seus <strong>10 tokens gratuitos</strong> ja estao na sua conta. Aqui vai um guia rapido para comecar:</p>
        <ol>
          <li><strong>Escolha um nicho</strong> — ex: "dentista", "advogado", "pizzaria"</li>
          <li><strong>Escolha uma cidade</strong> — qualquer uma das 140 cidades disponiveis</li>
          <li><strong>Clique em "Extrair"</strong> — em segundos os leads aparecem na tela</li>
        </ol>
        <p style="text-align: center; margin: 30px 0;">
          <a href="${APP_URL}/app/dashboard" style="background: #2563eb; color: white; padding: 14px 28px; border-radius: 12px; text-decoration: none; font-weight: bold;">
            Ir para o painel
          </a>
        </p>
        <p style="color: #666; font-size: 13px;">Dica: use um nicho especifico. "Restaurante" e muito amplo; "hamburgueria artesanal" traz leads mais qualificados.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="color: #999; font-size: 12px;">GeoLeads — Extracao inteligente de leads do Google Maps</p>
      </div>`,
  },
  3: {
    subject: '💰 Enriquecimento: o segredo dos campeoes',
    html: (name: string) => `
      <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto;">
        <h2 style="color: #2563eb;">So telefone nao basta, ${name}</h2>
        <p>Sabia que leads com <strong>email + CNPJ + Instagram</strong> convertem 5x mais que leads com apenas telefone?</p>
        <p>O GeoLeads enriquece automaticamente cada lead que voce extrai:</p>
        <ul>
          <li>✅ Email de contato</li>
          <li>✅ CNPJ validado</li>
          <li>✅ Instagram, Facebook e TikTok</li>
          <li>✅ Site oficial</li>
        </ul>
        <p>Quanto mais dados voce tem, mais canais de abordagem — e mais chances de fechar venda.</p>
        <p style="text-align: center; margin: 30px 0;">
          <a href="${APP_URL}/pricing" style="background: #2563eb; color: white; padding: 14px 28px; border-radius: 12px; text-decoration: none; font-weight: bold;">
            Ver planos com enriquecimento
          </a>
        </p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="color: #999; font-size: 12px;">GeoLeads — Extracao inteligente de leads do Google Maps</p>
      </div>`,
  },
  5: {
    subject: '🚀 Automatize suas vendas com AutoVendas',
    html: (name: string) => `
      <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto;">
        <h2 style="color: #2563eb;">E se o GeoLeads vendesse por voce, ${name}?</h2>
        <p>O <strong>AutoVendas</strong> e uma campanha automatica de lead generation:</p>
        <ol>
          <li>Voce define nicho, cidade e template de mensagem</li>
          <li>O sistema extrai, enriquece e aborda cada lead pelo WhatsApp</li>
          <li>Os leads que responderem vao direto pro seu CRM</li>
        </ol>
        <p>Enquanto voce dorme, o GeoLeads esta prospectando para voce.</p>
        <p style="text-align: center; margin: 30px 0;">
          <a href="${APP_URL}/pricing" style="background: #2563eb; color: white; padding: 14px 28px; border-radius: 12px; text-decoration: none; font-weight: bold;">
            Ativar AutoVendas
          </a>
        </p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="color: #999; font-size: 12px;">GeoLeads — Extracao inteligente de leads do Google Maps</p>
      </div>`,
  },
  7: {
    subject: '🎁 Oferta especial — seus tokens estao acabando',
    html: (name: string) => `
      <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Seus 10 tokens gratuitos estao quase no fim, ${name}</h2>
        <p>Nosso plano <strong>Profissional</strong> e o favorito dos usuarios:</p>
        <ul>
          <li>🔥 1.000 tokens de extracao</li>
          <li>🔥 Enriquecimento completo (email, CNPJ, redes sociais)</li>
          <li>🔥 Disparador WhatsApp com fila inteligente</li>
          <li>🔥 Gerador de mensagens com IA</li>
          <li>🔥 AutoVendas — campanhas automaticas</li>
        </ul>
        <p style="font-size: 20px; font-weight: bold; color: #f59e0b;">So R$ 24,90/mes — menos de R$ 0,025 por lead!</p>
        <p style="text-align: center; margin: 30px 0;">
          <a href="${APP_URL}/pricing?plan=pro" style="background: #2563eb; color: white; padding: 14px 28px; border-radius: 12px; text-decoration: none; font-weight: bold;">
            Assinar Profissional
          </a>
        </p>
        <p style="color: #666; font-size: 13px;">PS: esta oferta tem garantia de 7 dias. Se nao gostar, devolvemos seu dinheiro.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="color: #999; font-size: 12px;">GeoLeads — Extracao inteligente de leads do Google Maps</p>
      </div>`,
  },
};

export async function sendDripEmail(toEmail: string, name: string, day: number) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn('[DRIP] SMTP nao configurado.');
    return false;
  }
  const template = DRIP_TEMPLATES[day];
  if (!template) return false;
  try {
    await transporter.sendMail({
      from: `"GeoLeads" <${process.env.SMTP_USER}>`,
      to: toEmail,
      subject: template.subject,
      html: template.html(name),
    });
    console.log(`[DRIP] Email dia ${day} enviado para ${toEmail}`);
    return true;
  } catch (err) {
    console.error(`[DRIP] Erro ao enviar email dia ${day}:`, err);
    return false;
  }
}
