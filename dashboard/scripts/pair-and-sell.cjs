#!/usr/bin/env node
/**
 * 🎯 WhatsApp Pairing + Sales Agent
 * Gera código de pareamento e começa a vender depois de conectar
 */

'use strict';
try { require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.local') }); } catch {}
try { require('dotenv').config(); } catch {}

const baileys = require('@whiskeysockets/baileys');
const pino = require('pino');
const path = require('path');
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const QR_DIR = path.resolve(__dirname, '../baileys-auth');
const PHONE = '554598566730';

// Só limpa se não existir creds (primeira vez)
const firstRun = !fs.existsSync(path.join(QR_DIR, 'creds.json'));
if (firstRun) {
  if (fs.existsSync(QR_DIR)) {
    for (const f of fs.readdirSync(QR_DIR)) {
      if (f.endsWith('.json') || f.endsWith('.db')) fs.unlinkSync(path.join(QR_DIR, f));
    }
  }
}
console.log(firstRun ? '🆕 Primeira execução — auth limpo' : '♻️ Auth existente — mantendo sessão');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

let connected = false;
let credsLoaded = false;

async function requestCode(sock, retries = 5) {
  // Só tenta se o WebSocket estiver realmente aberto (não só 'connecting')
  await new Promise(r => setTimeout(r, 2000));
  for (let i = 0; i < retries; i++) {
    try {
      let code = await sock.requestPairingCode(PHONE);
      code = code.match(/.{1,4}/g)?.join('-') || code;
      console.log('\n╔══════════════════════════════════════╗');
      console.log('║   🔑 CÓDIGO DE PAREAMENTO            ║');
      console.log('║                                      ║');
      console.log(`║       ${code.padStart(15)}         ║`);
      console.log('║                                      ║');
      console.log('╚══════════════════════════════════════╝\n');
      console.log(`📱 WhatsApp > ⋮ > Dispositivos Conectados`);
      console.log(`📱 > Conectar > "Conectar com número"`);
      console.log(`📱 Digite: ${code}\n`);
      return true;
    } catch (err) {
      console.log(`⏳ Tentativa ${i+1}/${retries}: ${err.message?.substring(0,40)}`);
      await new Promise(r => setTimeout(r, 4000));
    }
  }
  console.log('⚠️ Código não gerado, QR será exibido no terminal.');
  return false;
}

async function main() {
  console.log('Conectando ao WhatsApp...\n');
  
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

  let codeAttempted = false;

  sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      const qrPath = path.join(QR_DIR, 'qr.png');
      try {
        const qrcode = require('qrcode');
        await qrcode.toFile(qrPath, qr, { scale: 8 });
        console.log(`📱 QR salvo em: ${qrPath}`);
      } catch {}
    }
    
    // Quando conectar, pede código de pareamento
    if (connection === 'connecting' && !codeAttempted && !connected) {
      codeAttempted = true;
      // Pequeno delay pra WebSocket estabilizar
      await new Promise(r => setTimeout(r, 3000));
      const ok = await requestCode(sock);
      if (!ok) {
        console.log('⚠️ QR code está disponível no terminal. Escaneie com WhatsApp.');
      }
    }
    
    if (connection === 'open' && !connected) {
      connected = true;
      console.log('\n✅ WhatsApp CONECTADO!\n');
      startSales(sock);
    }
    
    if (connection === 'close') {
      const sc = lastDisconnect?.error?.output?.statusCode;
      if (sc === 401 || sc === 'logged_out') {
        console.log('❌ Sessão expirada. Limpando auth e reiniciando...');
        // Limpa sessão e reinicia
        for (const f of fs.readdirSync(QR_DIR)) {
          if (f.endsWith('.json') || f.endsWith('.db')) fs.unlinkSync(path.join(QR_DIR, f));
        }
        connected = false;
        codeAttempted = false;
        setTimeout(() => main().catch(console.error), 2000);
        return;
      }
      console.log(`❌ Desconectado (${sc || '?'}). Reconectando em 3s...`);
      connected = false;
      codeAttempted = false;
      setTimeout(() => main().catch(console.error), 3000);
    }
  });
}

// ==================== SALES ENGINE ====================
async function getUserId() {
  const { data } = await supabase.auth.admin.listUsers();
  return data?.users?.find(u => u.email === 'pixel010dev@gmail.com')?.id;
}

const GEMINI_KEY = process.env.GEMINI_API_KEY;
async function gemini(p, sys = '') {
  if (!GEMINI_KEY) return null;
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-001:generateContent?key=${GEMINI_KEY}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ role:'user', parts:[{text:p}] }], systemInstruction: sys ? {parts:[{text:sys}]} : undefined, generationConfig:{temperature:0.7,maxOutputTokens:500} })
    });
    const d = await r.json();
    return d?.candidates?.[0]?.content?.parts?.[0]?.text || null;
  } catch { return null; }
}

function extractName(raw) { return (raw||'Lead').split(' - ')[0].split(' | ')[0].split(',')[0].trim()||'Lead'; }

async function generateMsg(lead) {
  const name = extractName(lead.nome);
  const cid = lead.cidade||'região';
  const nic = lead.nicho||'negócio';
  const ai = await gemini(`Crie msg WhatsApp curta (max 200 chars) persuasiva para lead de ${nic} em ${cid}. Nome: ${name}.`, 'Você é vendedor consultivo. Apenas a mensagem.');
  if (ai && ai.length < 300) return ai;
  return `Olá ${name}! Tudo bem? Vi seu ${nic} no Google. Tenho uma solução que atrai mais clientes em ${cid}. Topa dar uma olhada?`;
}

async function getLeads(limit) {
  const uid = await getUserId();
  if (!uid) return [];
  const { data } = await supabase.from('crm_leads').select('id,lead_key,nome,telefone,cidade,nicho,status,stage_vendas')
    .eq('user_id', uid).eq('status','Novo').gte('telefone','+55').order('created_at').limit(limit*3);
  if (!data) return [];
  return data.filter(l => l.telefone?.replace(/\D/g,'').length >= 12).slice(0, limit);
}

async function updateLead(leadKey, status, stage, notes = '') {
  const uid = await getUserId();
  if (!uid) return;
  await supabase.from('crm_leads').update({ status, stage_vendas:stage, updated_at:new Date().toISOString(), ...(notes?{observacoes:notes}:{}) })
    .eq('user_id', uid).eq('lead_key', leadKey);
}

async function searchPlaces(keyword, location) {
  const key = process.env.GOOGLE_PLACES_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY;
  if (!key) return [];
  const results = [];
  try {
    const res = await fetch(`https://places.googleapis.com/v1/places:searchText?key=${key}`, {
      method:'POST',
      headers:{'Content-Type':'application/json','X-Goog-FieldMask':'places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.internationalPhoneNumber'},
      body: JSON.stringify({ textQuery:`${keyword} em ${location}`, pageSize:20, languageCode:'pt-BR' })
    });
    const data = await res.json();
    if (data?.places) {
      for (const p of data.places) {
        const phone = p.internationalPhoneNumber || p.nationalPhoneNumber || '';
        if (phone.startsWith('+55')) {
          results.push({ place_id:p.id, nome:p.displayName?.text||'Sem nome', cidade:location, nicho:keyword, telefone:phone });
        }
      }
    } else {
      console.log('Places erro:', JSON.stringify(data).substring(0,100));
    }
  } catch(err) { console.log('Places fetch err:', err.message); }
  return results;
}

async function extractLeads() {
  console.log('🚀 Extraindo leads...');
  const kws = ['pizzaria','restaurante','mercado','padaria','academia','salão de beleza','barbearia','oficina mecânica','pet shop','clínica odontológica','advocacia','imobiliária'];
  let all = [];
  for (const kw of kws) {
    const r = await searchPlaces(kw, 'São Paulo');
    console.log(`  ${kw}: ${r.length} leads`);
    all = all.concat(r);
  }
  const uid = await getUserId();
  let saved = 0;
  for (const lead of all) {
    const { error } = await supabase.from('crm_leads').upsert({
      user_id: uid, lead_key: `places_${lead.place_id}`, nome: lead.nome,
      telefone: lead.telefone, cidade: lead.cidade, nicho: lead.nicho, status: 'Novo',
      stage_vendas: 1, fonte: 'whatsapp_bot',
      created_at: new Date().toISOString(), updated_at: new Date().toISOString()
    }, { onConflict: 'user_id,lead_key' });
    if (!error) saved++;
  }
  console.log(`💾 ${saved} leads salvos (${all.length} encontrados)`);
  return saved;
}

let msgsToday = 0;

async function startSales(sock) {
  console.log('Checando leads...');
  let leads = await getLeads(8);
  console.log(`📋 ${leads.length} leads disponíveis`);
  
  if (leads.length === 0) {
    await extractLeads();
    leads = await getLeads(8);
  }
  
  if (leads.length === 0) {
    console.log('⚠️ Sem leads pra enviar. Bot aguardando...');
    return;
  }
  
  let sent = 0;
  for (const lead of leads) {
    if (msgsToday >= 25) { console.log('🚫 Limite diário'); break; }
    if (sent > 0 && sent % 5 === 0) await new Promise(r => setTimeout(r, 300000));
    if (sent > 0) await new Promise(r => setTimeout(r, 45000 + Math.random() * 45000));
    
    const jid = lead.telefone.replace(/\D/g,'') + '@s.whatsapp.net';
    const msg = await generateMsg(lead);
    
    try {
      const presence = await sock.onWhatsApp(jid);
      if (!presence?.[0]?.exists) { console.log(`📵 ${extractName(lead.nome)} sem WhatsApp`); continue; }
      await sock.sendMessage(jid, { text: msg });
      console.log(`✅ ${extractName(lead.nome)}`);
      sent++; msgsToday++;
      await updateLead(lead.lead_key, 'Em Contato', 1);
    } catch(err) {
      console.log(`❌ ${extractName(lead.nome)}: ${err.message?.substring(0,50)}`);
    }
  }
  console.log(`📊 Enviadas: ${sent}/${leads.length} | Hoje: ${msgsToday}`);
}

main().catch(e => { console.error('🔥', e.message); process.exit(1); });
