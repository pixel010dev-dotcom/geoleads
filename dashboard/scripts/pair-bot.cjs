#!/usr/bin/env node
/**
 * 🎯 Pareamento WhatsApp via código — sem QR!
 * Gera um código de 8 dígitos pra conectar
 */

'use strict';

const baileys = require('@whiskeysockets/baileys');
const pino = require('pino');
const path = require('path');
const fs = require('fs');

const QR_DIR = path.resolve(__dirname, '../baileys-auth');
const PHONE = '554598566730';

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
    printQRInTerminal: false,
    browser: ['GeoLeads', 'Chrome', '10.0'],
    syncFullHistory: false,
    markOnlineOnConnect: false,
    connectTimeoutMs: 300000,
    keepAliveIntervalMs: 60000,
    maxRetries: 50,
    defaultQueryTimeoutMs: 30000,
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async ({ connection, lastDisconnect }) => {
    if (connection === 'open') {
      console.log('\n✅ WhatsApp CONECTADO!');
      console.log('Mande Ctrl+C para sair.\n');
      process.exit(0);
    }

    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      if (statusCode === 401 || statusCode === 'logged_out') {
        console.log('\n❌ Sessão expirada. Execute de novo pra gerar outro código.');
        process.exit(1);
      }
      console.log(`\n❌ Desconectado (${statusCode || '?'})`);
      process.exit(1);
    }

    // Quando "connecting" terminar e "open" ainda não aconteceu, pede código
    if (connection === 'connecting') {
      console.log('Conectando ao WhatsApp...');
    }
  });

  // Quando a conexão estiver pronta, solicita o código de pareamento
  sock.ev.on('messaging-history.set', () => {}); // noop

  // Aguarda um pouco e solicita o código
  setTimeout(async () => {
    try {
      console.log('\n🔐 Solicitando código de pareamento...\n');
      let code = await sock.requestPairingCode(PHONE);
      
      // Formata bonito: separa em grupos de 2-2-2-2 ou como WhatsApp mostra
      code = code.match(/.{1,4}/g)?.join('-') || code;
      
      console.log('╔══════════════════════════════════════╗');
      console.log('║                                      ║');
      console.log('║   🔑 CÓDIGO DE PAREAMENTO            ║');
      console.log('║                                      ║');
      console.log(`║       ${code.padStart(15)}         ║`);
      console.log('║                                      ║');
      console.log('╚══════════════════════════════════════╝');
      console.log('');
      console.log('📱 PASSO A PASSO:');
      console.log('1. Abra o WhatsApp no seu celular');
      console.log('2. Menu (⋮) > Dispositivos Conectados');
      console.log('3. Conectar um Dispositivo');
      console.log('4. Escaneie o QR... mas em vez disso:');
      console.log('5. Toque em "Conectar com número de telefone"');
      console.log('6. Digite o código acima');
      console.log('');
      console.log('⏳ Aguardando pareamento...\n');
    } catch (err) {
      console.error('❌ Erro ao solicitar código:', err.message);
      // Tenta de novo em 5s
      setTimeout(() => {
        sock.requestPairingCode(PHONE).then(code => {
          code = code.match(/.{1,4}/g)?.join('-') || code;
          console.log(`\n🔑 NOVO CÓDIGO: ${code}\n`);
        }).catch(() => process.exit(1));
      }, 5000);
    }
  }, 3000);

  // Aguarda até conectar ou timeout
  await new Promise(resolve => setTimeout(resolve, 120000));
  console.log('\n⏰ Se não conectou, execute de novo.');
  process.exit(0);
}

main().catch(e => {
  console.error('Erro:', e.message);
  process.exit(1);
});
