/**
 * WhatsApp Outreach Bot — version CommonJS (compatível com tsx)
 * 
 * Roda com: npx tsx scripts/bot.cjs
 * Ou: node scripts/bot.cjs
 */

// ==================== BOOTSTRAP: LOAD ENV ====================
const path = require('path');
const fs = require('fs');

const envPath = path.resolve(__dirname, '../.env.local');
if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY || '';
const USER_EMAIL = 'pixel010dev@gmail.com';

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('[FATAL] Supabase não configurado');
  process.exit(1);
}
if (!GOOGLE_PLACES_API_KEY) {
  console.error('[FATAL] GOOGLE_PLACES_API_KEY não configurada');
  process.exit(1);
}

const AUTH_DIR = path.resolve(__dirname, '../baileys-auth');
if (!fs.existsSync(AUTH_DIR)) fs.mkdirSync(AUTH_DIR, { recursive: true });

// ==================== CONFIG ====================
const CONFIG = {
  MIN_DELAY_MS: 45_000,
  MAX_DELAY_MS: 90_000,
  DAILY_LIMIT: 25,
  BATCH_SIZE: 5,
  BATCH_PAUSE_MS: 5 * 60_000,
  LEADS_PER_CYCLE: 100,
  CYCLE_INTERVAL_MS: 30 * 60_000,
  MAX_MESSAGES_PER_RUN: 10,
  MESSAGE_TEMPLATE: `Olá {NOME}! Tudo bem? Vi o perfil de vocês no Google e achei o trabalho interessante. Tenho uma ideia simples que pode ajudar {CIDADE} a atrair mais clientes. Posso compartilhar com você?`,
};

// ==================== STATE ====================
const appState = {
  connected: false,
  socket: null,
  userId: '',
  messagesSentToday: 0,
  startTime: Date.now(),
};

// ==================== SUPABASE ====================
const { createClient } = require('@supabase/supabase-js');
const pino = require('pino');
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function findUserId() {
  const { data: all } = await supabase.auth.admin.listUsers();
  if (all?.users?.length) {
    const user = all.users.find(u => u.email === USER_EMAIL);
    if (user) {
      console.log(`[SUPABASE] Usuário: ${user.email}`);
      return user.id;
    }
    console.log(`[SUPABASE] Usando: ${all.users[0].email}`);
    return all.users[0].id;
  }
  throw new Error('Nenhum usuário encontrado');
}

async function getLeadsToContact(limit) {
  const { data, error } = await supabase
    .from('crm_leads')
    .select('user_id, lead_key, nome, telefone, stage, nicho, cidade, payload')
    .eq('user_id', appState.userId)
    .eq('stage', 'Novo')
    .not('telefone', 'eq', 'Não informado')
    .not('telefone', 'eq', '')
    .not('telefone', 'is', null)
    .limit(limit);
  if (error) { console.error('[CRM] Erro:', error.message); return []; }
  return data || [];
}

async function updateLeadStage(leadKey, stage, notes) {
  const update = { stage, updated_at: new Date().toISOString() };
  if (notes) update.notes = notes;
  await supabase.from('crm_leads').update(update)
    .eq('user_id', appState.userId).eq('lead_key', leadKey);
}

async function saveLeadsToCrm(leads) {
  const rows = leads.map(l => ({
    user_id: appState.userId,
    lead_key: `${l.nome || ''}|${l.telefone || ''}|${l.cidade || ''}`,
    nome: l.nome || 'Lead sem nome',
    telefone: l.telefone || '',
    stage: 'Novo',
    nicho: l.categoria || 'Geral',
    cidade: l.cidade || 'Geral',
    payload: l,
    saved_at: new Date().toISOString(),
  }));
  await supabase.from('crm_leads').upsert(rows, { onConflict: 'user_id,lead_key' });
  console.log(`[CRM] ${rows.length} leads salvos`);
}

// ==================== EXTRAÇÃO PLACES API ====================
async function extractFreshLeads(keyword, location) {
  console.log(`[EXTRACT] Buscando "${keyword}" em "${location}"...`);
  try {
    const { extractFromGooglePlaces } = require('../src/app/api/extract/strategies/google-places');
    const places = await extractFromGooglePlaces(keyword, location, CONFIG.LEADS_PER_CYCLE);
    let leads = places.filter(p => p.telefone && p.telefone !== 'Não informado');
    leads = leads.filter(l => l.isMobile === true);
    console.log(`[EXTRACT] ${places.length} encontrados, ${leads.length} com WhatsApp`);
    return leads;
  } catch (err) {
    console.error(`[EXTRACT] Erro: ${err.message}`);
    return [];
  }
}

// ==================== WHATSAPP ====================
let socket = null;

async function connectWhatsApp() {
  console.log('\n========================================');
  console.log('  WHATSAPP OUTREACH BOT');
  console.log('========================================\n');

  // Dynamic import do Baileys (ESM module)
  const baileys = require('@whiskeysockets/baileys');
  const makeWASocket = baileys.default;
  const { DisconnectReason, useMultiFileAuthState } = baileys;

  const { state: authState, saveCreds } = await useMultiFileAuthState(AUTH_DIR);

  socket = makeWASocket({
    auth: authState,
    browser: ['GeoLeads Bot', 'Chrome', '120.0.0.0'],
    logger: pino({ level: 'silent' }),
    markOnlineOnConnect: false,
    printQRInTerminal: true,
    syncFullHistory: false,
    connectTimeoutMs: 60_000,
    keepAliveIntervalMs: 30_000,
  });

  appState.socket = socket;

  socket.ev.on('creds.update', saveCreds);

  socket.ev.on('connection.update', async (update) => {
    const { connection, qr, lastDisconnect } = update;

    if (qr) {
      console.log('\n📱 ESCANEIE O QR CODE ACIMA com seu WhatsApp');
      console.log('📱 Abra WhatsApp > Dispositivos Conectados > Conectar\n');
      try {
        const qrcode = require('qrcode');
        const qrPath = path.resolve(__dirname, '../baileys-auth/qr.png');
        await qrcode.toFile(qrPath, qr);
        console.log(`📱 QR salvo em: ${qrPath}\n`);
      } catch {}
    }

    if (connection === 'open') {
      console.log('\n✅ WhatsApp CONECTADO!\n');
      appState.connected = true;
    }

    if (connection === 'close') {
      const reason = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = reason !== DisconnectReason.loggedOut;
      console.log(`❌ Desconectado (${reason}). ${shouldReconnect ? 'Reconectando...' : 'QR expirado'}`);
      appState.connected = false;
      if (shouldReconnect) setTimeout(connectWhatsApp, 5000);
    }
  });

  // Detecta respostas
  socket.ev.on('messages.upsert', async ({ messages }) => {
    for (const msg of messages) {
      if (!msg.key || msg.key.fromMe) continue;
      const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
      const sender = msg.key.remoteJid;
      const pushName = msg.pushName || 'Desconhecido';
      if (text) {
        console.log(`\n💬 RESPOSTA de ${pushName} (${sender}): "${text.substring(0, 100)}"`);
      }
    }
  });
}

// ==================== MENSAGEM ====================
function formatMessage(template, lead) {
  return template
    .replace(/{NOME}/g, (lead.nome || '').split(' - ')[0].split(' | ')[0])
    .replace(/{CIDADE}/g, lead.cidade || 'sua região')
    .replace(/{NICHO}/g, lead.nicho || 'negócio')
    .replace(/{TELEFONE}/g, lead.telefone || '');
}

function formatPhone(phone) {
  let digits = phone.replace(/\D/g, '');
  if (digits.length === 10 || digits.length === 11) {
    digits = '55' + (digits.length === 11 ? digits.substring(2) : digits);
  }
  return digits.length >= 12 ? digits + '@s.whatsapp.net' : null;
}

async function sendMessage(lead) {
  if (!socket || !appState.connected) {
    console.log('[SEND] WhatsApp desconectado');
    return false;
  }

  const jid = formatPhone(lead.telefone);
  if (!jid) {
    console.log(`[SEND] Telefone inválido: ${lead.telefone}`);
    return false;
  }

  const text = formatMessage(CONFIG.MESSAGE_TEMPLATE, lead);

  try {
    const [presence] = await socket.onWhatsApp(jid);
    if (!presence?.exists) {
      console.log(`[SEND] ${lead.nome} — sem WhatsApp`);
      await updateLeadStage(lead.lead_key, 'Novo', 'Sem WhatsApp');
      return false;
    }

    await socket.sendMessage(jid, { text });
    console.log(`✅ ${lead.nome} — mensagem enviada!`);
    await updateLeadStage(lead.lead_key, 'Em Contato', `Enviado em ${new Date().toLocaleString('pt-BR')}`);
    appState.messagesSentToday++;
    return true;
  } catch (err) {
    console.error(`[SEND] Erro: ${lead.nome}: ${err.message || err}`);
    return false;
  }
}

// ==================== DELAYS ====================
function randomDelay() {
  const ms = CONFIG.MIN_DELAY_MS + Math.random() * (CONFIG.MAX_DELAY_MS - CONFIG.MIN_DELAY_MS);
  console.log(`⏳ Aguardando ${Math.round(ms / 1000)}s...`);
  return new Promise(r => setTimeout(r, ms));
}

function batchPause() {
  console.log(`\n🛌 Pausa de ${CONFIG.BATCH_PAUSE_MS / 60000}min...\n`);
  return new Promise(r => setTimeout(r, CONFIG.BATCH_PAUSE_MS));
}

// ==================== CICLO ====================
async function runCycle() {
  console.log('\n' + '='.repeat(50));
  console.log(`🔄 CICLO ${new Date().toLocaleString('pt-BR')}`);
  console.log('='.repeat(50));

  if (!appState.connected) {
    console.log('⚠️ WhatsApp desconectado, aguardando...');
    return;
  }

  let leads = await getLeadsToContact(CONFIG.MAX_MESSAGES_PER_RUN);
  console.log(`📋 ${leads.length} leads disponíveis`);

  if (leads.length === 0) {
    console.log('🔍 Sem leads no CRM. Extraindo novos...');
    const { data: lastExtract } = await supabase
      .from('extraction_history')
      .select('keyword, location')
      .eq('user_id', appState.userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    const keyword = lastExtract?.keyword || 'pizzaria';
    const location = lastExtract?.location || 'São Paulo';
    const newLeads = await extractFreshLeads(keyword, location);
    if (newLeads.length > 0) {
      await saveLeadsToCrm(newLeads);
      leads = await getLeadsToContact(CONFIG.MAX_MESSAGES_PER_RUN);
    }
  }

  if (appState.messagesSentToday >= CONFIG.DAILY_LIMIT) {
    console.log(`\n🚫 Limite diário (${CONFIG.DAILY_LIMIT}) atingido. Parando.`);
    console.log(`📊 Hoje: ${appState.messagesSentToday} mensagens`);
    console.log(`⏱️ Ativo: ${Math.round((Date.now() - appState.startTime) / 60000)}min`);
    return;
  }

  let sent = 0;
  for (let i = 0; i < leads.length && sent < CONFIG.MAX_MESSAGES_PER_RUN; i++) {
    if (appState.messagesSentToday >= CONFIG.DAILY_LIMIT) break;
    if (sent > 0 && sent % CONFIG.BATCH_SIZE === 0) await batchPause();
    if (sent > 0) await randomDelay();

    const ok = await sendMessage(leads[i]);
    if (ok) sent++;
  }

  console.log(`\n📊 CICLO: ${sent}/${leads.length} mensagens`);
  console.log(`📊 Total hoje: ${appState.messagesSentToday}/${CONFIG.DAILY_LIMIT}`);
}

// ==================== MAIN ====================
async function main() {
  console.log('Iniciando WhatsApp Outreach Bot...\n');

  appState.userId = await findUserId();
  console.log(`👤 ID: ${appState.userId}`);

  await connectWhatsApp();

  // Aguarda conexão ou QR
  console.log('Aguardando conexão WhatsApp (QR code ou reconexão)...');
  if (!appState.connected) {
    // Espera ativa: verifica a cada 2s até conectar (máx 5min após QR)
    await new Promise(resolve => {
      const check = setInterval(() => {
        if (appState.connected) {
          clearInterval(check);
          resolve();
        }
      }, 2000);
      setTimeout(() => {
        clearInterval(check);
        if (appState.connected) resolve();
        else console.log('⚠️ QR ainda não escaneado. O bot continua tentando...');
        resolve();
      }, 300_000); // 5 min de espera total
    });
  }

  console.log('\n🚀 Bot operacional!\n');

  while (true) {
    try {
      await runCycle();
    } catch (err) {
      console.error(`[FATAL] ${err.message}`);
    }
    // Se conectou mas não rodou nada, espera só 2min pra tentar de novo
    if (!appState.connected) {
      const waitMin = CONFIG.CYCLE_INTERVAL_MS / 60000;
      console.log(`\n⏰ Próximo ciclo em ${waitMin}min\n`);
      await new Promise(r => setTimeout(r, CONFIG.CYCLE_INTERVAL_MS));
    } else {
      console.log(`\n⏰ Próximo ciclo em 2min\n`);
      await new Promise(r => setTimeout(r, 120_000)); // 2 min entre ciclos ativos
    }
  }
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
