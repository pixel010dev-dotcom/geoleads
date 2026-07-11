#!/usr/bin/env node
/*
 * 🔑 WhatsApp Pairing Only
 * Só gera o código de pareamento e segura a conexão
 * Depois de conectado, chama o bot inteligente
 */

'use strict';
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });
require('dotenv').config();

const baileys = require('@whiskeysockets/baileys');
const pino = require('pino');

const AUTH = path.resolve(__dirname, '../baileys-auth');
const PHONE = '554598566730';
let connected = false;

// Limpa auth se existir
if (fs.existsSync(AUTH)) {
  for (const f of fs.readdirSync(AUTH)) {
    if (f.endsWith('.json') || f.endsWith('.db')) fs.unlinkSync(path.join(AUTH, f));
  }
}

async function connect() {
  const { state, saveCreds } = await baileys.useMultiFileAuthState(AUTH);
  
  const sock = baileys.default({
    auth: state,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: true,
    browser: ['GeoLeads', 'Chrome', '10.0'],
    syncFullHistory: false,
    markOnlineOnConnect: false,
    connectTimeoutMs: 120000,
    keepAliveIntervalMs: 15000, // ping a cada 15s pra manter vivo
    maxRetries: 100,
    defaultQueryTimeoutMs: 60000,
  });

  sock.ev.on('creds.update', saveCreds);

  let codeDone = false;

  sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
    // Salva QR
    if (qr) {
      try {
        const qrcode = require('qrcode');
        await qrcode.toFile(path.join(AUTH, 'qr.png'), qr, { scale: 8 });
      } catch {}
    }

    // Tenta código de pareamento
    if (connection === 'connecting' && !codeDone) {
      codeDone = true;
      // Espera o WebSocket ficar pronto
      for (let i = 0; i < 10; i++) {
        try {
          let code = await sock.requestPairingCode(PHONE);
          code = code.match(/.{1,4}/g)?.join('-') || code;
          console.log('\n╔══════════════════════════════════════╗');
          console.log('║   🔑 CÓDIGO DE PAREAMENTO            ║');
          console.log('║                                      ║');
          console.log(`║       ${code.padStart(15)}         ║`);
          console.log('║                                      ║');
          console.log('╚══════════════════════════════════════╝\n');
          console.log(`📱 Digite no WhatsApp: ${code}`);
          console.log('📱 Menu > Dispositivos Conectados > Conectar > "Conectar com número"\n');
          break;
        } catch (err) {
          console.log(`⏳ Aguardando conexão... (${i+1}/10)`);
          await new Promise(r => setTimeout(r, 3000));
        }
      }
    }

    if (connection === 'open' && !connected) {
      connected = true;
      console.log('\n✅ WhatsApp CONECTADO!');
      
      // Chama o bot inteligente
      console.log('🚀 Iniciando bot de vendas...\n');
      require('./pair-and-sell-sales.cjs')(sock);
    }

    if (connection === 'close') {
      const sc = lastDisconnect?.error?.output?.statusCode;
      console.log(`❌ Desconectado (${sc || '?'})`);
      
      if (sc === 401 || sc === 'logged_out') {
        console.log('Sessão expirada.');
        process.exit(1);
      }
      
      console.log('Reconectando em 5s...\n');
      connected = false;
      codeDone = false;
      setTimeout(() => connect().catch(console.error), 5000);
    }
  });
}

connect().catch(e => { console.error('🔥', e.message); process.exit(1); });
