#!/usr/bin/env node
/**
 * 🎯 Pareamento WhatsApp via código
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

// Limpa sessão anterior
if (fs.existsSync(QR_DIR)) {
  for (const f of fs.readdirSync(QR_DIR)) {
    if (f.endsWith('.json') || f.endsWith('.db')) fs.unlinkSync(path.join(QR_DIR, f));
  }
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  console.log('Conectando ao WhatsApp...');
  
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

  // Variável pra saber se já pediu o código
  let codeRequested = false;

  sock.ev.on('connection.update', async ({ connection, lastDisconnect }) => {
    if (connection === 'open') {
      console.log('\n✅ WhatsApp CONECTADO!');
      // Inicia o bot principal aqui...
      console.log('🚀 Iniciando ciclo de vendas...');
      startSalesCycle(sock);
    }

    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      if (statusCode === 401) {
        console.log('\n❌ Sessão expirada.');
        process.exit(1);
      }
      console.log(`❌ Desconectado (${statusCode || '?'}). Reconectando em 3s...`);
      setTimeout(() => {}, 3000);
    }

    // Depois que conectar, pede o código
    if (connection === 'connecting' && !codeRequested) {
      codeRequested = true;
      try {
        let code = await sock.requestPairingCode(PHONE);
        code = code.match(/.{1,4}/g)?.join('-') || code;
        
        console.log('\n╔══════════════════════════════════════╗');
        console.log('║   🔑 CÓDIGO DE PAREAMENTO            ║');
        console.log('║                                      ║');
        console.log(`║       ${code.padStart(15)}         ║`);
        console.log('║                                      ║');
        console.log('╚══════════════════════════════════════╝\n');
        console.log('📱 WhatsApp > ⋮ > Dispositivos Conectados');
        console.log('📱 > Conectar > "Conectar com número"');
        console.log(`📱 Digite: ${code}\n`);
      } catch (err) {
        console.error('❌ Erro código:', err.message);
      }
    }
  });

  // Mantém vivo
  setInterval(() => {}, 60000);
}

// =============== SALES ENGINE ===============
const STAGES = { DISCOVERY: 1, INTEREST: 2, PRESENTATION: 3, CLOSED: 4, REJECTED: -1 };

async function getUserId() {
  const { data } = await supabase.auth.admin.listUsers();
  const u = data?.users?.find(u => u.email === 'pixel010dev@gmail.com');
  return u?.id;
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
  const ai = await gemini(`Crie msg WhatsApp curta (max 200 chars) persuasiva para lead de ${nic} em ${cid}. Nome: ${name}. Apenas apresente valor, sem pedir dinheiro. Tom amigável profissional.`, 'Você é um vendedor consultivo. Responda APENAS com a mensagem.');
  if (ai && ai.length < 300) return ai;
  return `Olá ${name}! Tudo bem? Vi seu ${nic} no Google e gostei do trabalho. Tenho uma solução que atrai mais clientes em ${cid}. Topa dar uma olhada?`;
}

async function getLeads(limit) {
  const userId = await getUserId();
  if (!userId) return [];
  const { data } = await supabase.from('crm_leads').select('id,lead_key,nome,telefone,cidade,nicho,status,stage_vendas').eq('user_id', userId).eq('status','Novo').gte('telefone','+55').order('created_at').limit(limit * 3);
  if (!data) return [];
  return data.filter(l => l.telefone?.replace(/\D/g,'').length >= 12).slice(0, limit);
}

async function updateLead(leadKey, status, stage, notes = '') {
  const userId = await getUserId();
  if (!userId) return;
  await supabase.from('crm_leads').update({ status, stage_vendas: stage, updated_at: new Date().toISOString(), ...(notes?{observacoes:notes}:{}) }).eq('user_id', userId).eq('lead_key', leadKey);
}

async function extractLeads() {
  console.log('Extraindo novos leads...');
  const key = process.env.GOOGLE_PLACES_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY;
  if (!key) { console.log('Sem API Key'); return 0; }
  const keywords = ['pizzaria','restaurante','mercado','padaria','academia','salão de beleza','barbearia','pet shop','clínica odontológica','advocacia','imobiliária'];  
  let all = [];
  for (const kw of keywords) {
    try {
      const r = await fetch(`https://places.googleapis.com/v1/places:searchText?key=${key}`, {
        method:'POST', headers:{'Content-Type':'application/json','X-Goog-FieldMask':'places.id,places.displayName,places.formattedAddress,places.types,places.nationalPhoneNumber,places.internationalPhoneNumber'},
        body: JSON.stringify({ textQuery:`${kw} em São Paulo`, pageSize:20, languageCode:'pt-BR' })
      });
      const d = await r.json();
      if (d?.places) {
        for (const p of d.places) {
          const phone = p.internationalPhoneNumber || p.nationalPhoneNumber || '';
          if (phone.startsWith('+55') && phone.replace(/\D/g,'').length >= 12) {
            all.push({ place_id:p.id, nome:p.displayName?.text||'Sem nome', cidade:'São Paulo', nicho:kw, telefone:phone });
          }
        }
      }
    } catch {}
  }
  let saved = 0;
  const userId = await getUserId();
  for (const lead of all) {
    const { error } = await supabase.from('crm_leads').upsert({
      user_id: userId, lead_key: `places_${lead.place_id}`, nome: lead.nome, telefone: lead.telefone, cidade: lead.cidade, nicho: lead.nicho, status: 'Novo', stage_vendas: 1, fonte: 'whatsapp_bot',
      created_at: new Date().toISOString(), updated_at: new Date().toISOString()
    }, { onConflict: 'user_id,lead_key' });
    if (!error) saved++;
  }
  console.log(`${saved} leads salvos`);
  return saved;
}

let msgsToday = 0;

async function startSalesCycle(sock) {
  const userId = await getUserId();
  console.log(`👤 Usuário: ${userId}`);
  
  let leads = await getLeads(8);
  console.log(`${leads.length} leads disponíveis`);
  
  if (leads.length === 0) {
    await extractLeads();
    leads = await getLeads(8);
    console.log(`${leads.length} leads após extração`);
  }
  
  let sent = 0;
  for (const lead of leads) {
    if (msgsToday >= 25) { console.log('Limite diário'); break; }
    if (sent > 0 && sent % 5 === 0) await new Promise(r => setTimeout(r, 300000));
    if (sent > 0) await new Promise(r => setTimeout(r, 45000 + Math.random() * 45000));
    
    const jid = lead.telefone.replace(/\D/g,'') + '@s.whatsapp.net';
    const msg = await generateMsg(lead);
    
    try {
      // Verifica se tem WhatsApp
      const presence = await sock.onWhatsApp(jid);
      if (!presence?.[0]?.exists) {
        console.log(`📵 ${extractName(lead.nome)} — sem WhatsApp`);
        continue;
      }
      
      await sock.sendMessage(jid, { text: msg });
      console.log(`✅ ${extractName(lead.nome)} — enviado!`);
      sent++;
      msgsToday++;
      await updateLead(lead.lead_key, 'Em Contato', 1);
    } catch (err) {
      console.log(`❌ ${extractName(lead.nome)} — erro: ${err.message?.substring(0,50)}`);
    }
  }
  
  console.log(`📊 Ciclo: ${sent}/${leads.length} enviadas`);
  console.log('⏰ Próximo ciclo em 3 min...');
}

main().catch(e => {
  console.error('Erro:', e.message);
  process.exit(1);
});
