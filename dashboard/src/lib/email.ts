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
