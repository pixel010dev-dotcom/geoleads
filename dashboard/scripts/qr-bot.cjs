const baileys = require('@whiskeysockets/baileys');
const pino = require('pino');
const path = require('path');
const fs = require('fs');
const qrcode = require('qrcode');

const QR_DIR = path.resolve(__dirname, '../baileys-auth');

// Limpa sessão anterior
if (fs.existsSync(QR_DIR)) {
  for (const f of fs.readdirSync(QR_DIR)) {
    if (f.endsWith('.json') || f.endsWith('.db')) fs.unlinkSync(path.join(QR_DIR, f));
  }
}

async function main() {
  const { state, saveCreds } = await baileys.useMultiFileAuthState(QR_DIR);
  
  const sock = baileys.default({
    auth: state,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: true,
    browser: ['GeoLeads', 'Chrome', '10.0'],
    syncFullHistory: false,
    markOnlineOnConnect: false,
    connectTimeoutMs: 300000,
    keepAliveIntervalMs: 60000,
    maxRetries: 50,
    defaultQueryTimeoutMs: 30000,
  });

  sock.ev.on('creds.update', saveCreds);

  // QR salvo como PNG
  sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      const qrPath = path.join(QR_DIR, 'qr.png');
      await qrcode.toFile(qrPath, qr, { scale: 8, margin: 1 });
      console.log('\n📱 QR salvo em: ' + qrPath);
      console.log(`📱 ESCANEIE O QR CODE ACIMA com seu WhatsApp
📱 Abra WhatsApp > Dispositivos Conectados > Conectar\n`);
    }
    
    if (connection === 'open') {
      console.log('\n✅ WhatsApp CONECTADO!');
      console.log('Mande Ctrl+C para sair.');
    }
    
    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      console.log(`❌ Desconectado (${statusCode || '?'}). Reconectando em 3s...`);
      setTimeout(() => {
        main().catch(() => process.exit(1));
      }, 3000);
    }
  });
}

main().catch(e => {
  console.error('Erro:', e.message);
  process.exit(1);
});
