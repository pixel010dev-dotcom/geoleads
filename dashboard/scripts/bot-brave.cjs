#!/usr/bin/env node
/**
 * 🦁 GeoLeads Sales Bot v3 — WhatsApp Web via Brave
 * 
 * Conecta no WhatsApp Web usando o Brave (já logado)
 * Envia mensagens personalizadas, responde leads, gerencia funil
 */

'use strict';

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.local') });
require('dotenv').config();

const path = require('path');
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const puppeteer = require('puppeteer-core');

// ==================== CONFIG ====================
const CONFIG = {
  BRAVE_PATH: 'C:\\Users\\Admin\\AppData\\Local\\BraveSoftware\\Brave-Browser\\Application\\brave.exe',
  USER_DATA_DIR: 'C:\\Users\\Admin\\AppData\\Local\\BraveSoftware\\Brave-Browser\\User Data',
  DAILY_LIMIT: 25,
  MAX_PER_RUN: 8,
  DELAY_MIN: 45_000,
  DELAY_MAX: 90_000,
  BATCH_PAUSE: 5 * 60_000,
  CYCLE_ACTIVE: 3 * 60_000,
  CYCLE_IDLE: 30 * 60_000,
  PLACES_API_KEY: process.env.GOOGLE_PLACES_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY,
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  USER_EMAIL: 'pixel010dev@gmail.com',
};

const supabase = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_SERVICE_KEY);
const appState = { userId: null, connected: false, msgsToday: 0, browser: null, page: null, cycle: 0 };

// ==================== HELPERS ====================
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function randomDelay() { return sleep(Math.floor(Math.random() * (CONFIG.DELAY_MAX - CONFIG.DELAY_MIN) + CONFIG.DELAY_MIN)); }
function extractName(raw) { return (raw || 'Cliente').split(' - ')[0].split(' | ')[0].split(',')[0].trim() || 'Cliente'; }
function log(msg, e = '') { console.log(`${e} [${new Date().toLocaleTimeString('pt-BR')}] ${msg}`); }

// ==================== GEMINI AI ====================
async function gemini(prompt, system = '') {
  if (!CONFIG.GEMINI_API_KEY) return null;
  try {
    const body = {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      systemInstruction: system ? { parts: [{ text: system }] } : undefined,
      generationConfig: { temperature: 0.7, maxOutputTokens: 500 },
    };
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-001:generateContent?key=${CONFIG.GEMINI_API_KEY}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
    );
    const data = await res.json();
    return data?.candidates?.[0]?.content?.parts?.[0]?.text || null;
  } catch { return null; }
}

const SALES_SYS = `Você é um vendedor consultivo do GeoLeads, plataforma de leads qualificados para negócios locais. Seja natural, persuasivo, NUNCA spam. Responda em PT-BR, conciso (máx 250 chars na primeira msg). Link: https://geoleads.tech (compartilhe só quando houver interesse forte).`;

async function generateMsg(lead) {
  const name = extractName(lead.nome);
  const cidade = lead.cidade || 'região';
  const nicho = lead.nicho || 'negócio';
  const prompt = `Crie msg WhatsApp curta (max 200 chars) persuasiva para lead de ${nicho} em ${cidade}. Nome: ${name}. Apresente valor, NÃO peça dinheiro. Tom profissional e amigável.`;
  const ai = await gemini(prompt, SALES_SYS);
  if (ai && ai.length < 300) return ai;
  const ts = [
    `Olá ${name}! Tudo bem? Vi seu ${nicho} no Google e gostei. Tenho uma solução que atrai mais clientes em ${cidade}. Topa conhecer?`,
    `Oi ${name}! Encontrei seu ${nicho} no Google. Criei uma ferramenta que ajuda negócios locais a crescer. Posso mostrar?`,
  ];
  return ts[Math.floor(Math.random() * ts.length)];
}

async function generateReply(lead, msg) {
  const name = extractName(lead.nome);
  const stage = lead.stage_vendas || 1;
  const prompt = `Lead respondeu: "${msg}". Nome: ${name}, negócio: ${lead.nicho || '-'}, estágio: ${['','Descoberta','Interesse','Apresentação','Fechado'][stage]||'?'}. Gere resposta natural (max 300 chars). Se perguntou preço: ofereça demo. Se interesse: marque call. Se não: agradeça educadamente. Link geoleads.tech só se pedir.`;
  const ai = await gemini(prompt, SALES_SYS);
  if (ai) return ai;
  return `${name}, que legal seu interesse! O GeoLeads ajuda a conseguir clientes novos. Quer ver uma demonstração rápida?`;
}

// ==================== CRM ====================
async function findUserId() {
  const { data } = await supabase.auth.admin.listUsers();
  const u = data?.users?.find(u => u.email === CONFIG.USER_EMAIL);
  if (!u) throw new Error('Usuário não encontrado');
  return u.id;
}

async function getLeads(limit) {
  const { data } = await supabase.from('crm_leads')
    .select('id,lead_key,nome,telefone,cidade,nicho,status,stage_vendas')
    .eq('user_id', appState.userId).eq('status', 'Novo')
    .gte('telefone', '+55').order('created_at').limit(limit * 3);
  if (!data) return [];
  return data.filter(l => l.telefone?.replace(/\D/g,'').length >= 12).slice(0, limit);
}

async function updateLead(leadKey, status, stage, notes = '') {
  await supabase.from('crm_leads').update({
    status, stage_vendas: stage, updated_at: new Date().toISOString(),
    ...(notes ? { observacoes: notes } : {}),
  }).eq('user_id', appState.userId).eq('lead_key', leadKey);
}

// ==================== PLACES API ====================
async function searchPlaces(keyword, location) {
  if (!CONFIG.PLACES_API_KEY) { log('Sem API Key', '⚠️'); return []; }
  const results = [];
  try {
    const res = await fetch(
      `https://places.googleapis.com/v1/places:searchText?key=${CONFIG.PLACES_API_KEY}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.types,places.nationalPhoneNumber,places.internationalPhoneNumber' },
        body: JSON.stringify({ textQuery: `${keyword} em ${location}`, pageSize: 20, languageCode: 'pt-BR' }) }
    );
    const data = await res.json();
    if (data?.places) {
      for (const p of data.places) {
        const phone = p.internationalPhoneNumber || p.nationalPhoneNumber || '';
        if (phone && phone.startsWith('+55') && phone.replace(/\D/g,'').length >= 12) {
          results.push({ place_id: p.id, nome: p.displayName?.text || 'Sem nome', endereco: p.formattedAddress || '', cidade: location, nicho: keyword, telefone: phone, fonte: 'places_new_api' });
        }
      }
    }
  } catch (err) { log(`Places error: ${err.message}`, '❌'); }
  return results;
}

async function extractLeads() {
  log('Extraindo leads...', '🚀');
  const keywords = ['pizzaria','restaurante','mercado','padaria','academia','salão de beleza','barbearia','pet shop','clínica','advocacia','imobiliária'];
  let all = [];
  for (const kw of keywords) {
    const r = await searchPlaces(kw, 'São Paulo');
    all = all.concat(r);
    await sleep(300);
  }
  let saved = 0;
  for (const lead of all) {
    const { error } = await supabase.from('crm_leads').upsert({
      user_id: appState.userId, lead_key: `places_${lead.place_id}`, nome: lead.nome,
      telefone: lead.telefone, cidade: lead.cidade, nicho: lead.nicho, status: 'Novo',
      stage_vendas: 1, fonte: 'whatsapp_bot',
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,lead_key' });
    if (!error) saved++;
  }
  log(`${saved} leads salvos`, '💾');
  return saved;
}

// ==================== WHATSAPP WEB VIA BRAVE ====================
async function launchWhatsApp() {
  log('Lançando Brave com WhatsApp Web...', '🚀');
  
  appState.browser = await puppeteer.launch({
    executablePath: CONFIG.BRAVE_PATH,
    userDataDir: CONFIG.USER_DATA_DIR,
    headless: false,
    args: ['--disable-dev-shm-usage', '--no-sandbox'],
    defaultViewport: null,
  });

  const pages = await appState.browser.pages();
  appState.page = pages[0] || await appState.browser.newPage();
  
  // Navega para o WhatsApp Web
  await appState.page.goto('https://web.whatsapp.com', { waitUntil: 'networkidle2', timeout: 60000 });
  
  // Aguarda o QR ou login
  log('Verificando login do WhatsApp Web...', '👀');
  
  try {
    // Se já estiver logado, o painel lateral aparece
    await appState.page.waitForSelector('[data-testid="chat-list"]', { timeout: 30000 });
    appState.connected = true;
    log('✅ WhatsApp Web já logado!');
    return true;
  } catch {
    log('Aguardando QR code na tela do navegador...', '📱');
    log('👉 Escaneie o QR CODE que ABRIU NO BRAVE', '📱');
    
    // Abre uma nova aba com o QR em destaque
    const qrPage = await appState.browser.newPage();
    await qrPage.goto('https://web.whatsapp.com', { waitUntil: 'networkidle2' });
    
    // Aguarda o login (máx 5 min)
    try {
      await qrPage.waitForSelector('[data-testid="chat-list"]', { timeout: 300000 });
      appState.connected = true;
      appState.page = qrPage;
      log('✅ WhatsApp Web conectado!');
      return true;
    } catch {
      log('⏰ Timeout aguardando scan do QR', '⚠️');
      return false;
    }
  }
}

async function sendWhatsApp(phone, text) {
  if (!appState.connected || !appState.page) return false;
  
  // Formata o número
  const cleanPhone = phone.replace(/\D/g, '');
  const url = `https://web.whatsapp.com/send?phone=${cleanPhone}`;
  
  try {
    await appState.page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    
    // Aguarda a caixa de texto aparecer
    await appState.page.waitForSelector('[data-testid="conversation-compose-box-input"]', { timeout: 15000 });
    await sleep(2000); // espera carregar
    
    // Digita a mensagem
    const input = await appState.page.$('[data-testid="conversation-compose-box-input"]');
    if (!input) throw new Error('Input não encontrado');
    
    await input.click();
    await input.type(text, { delay: 30 });
    await sleep(500);
    
    // Envia
    await appState.page.keyboard.press('Enter');
    await sleep(2000);
    
    log(`✅ Mensagem enviada para ${cleanPhone.slice(-4)}...`, '💬');
    return true;
  } catch (err) {
    log(`Erro ao enviar para ${cleanPhone.slice(-4)}: ${err.message}`, '❌');
    return false;
  }
}

// ==================== CYCLE ====================
async function runCycle() {
  appState.cycle++;
  log(`=== CICLO ${appState.cycle} ===`, '🔄');
  
  if (!appState.connected) {
    log('WhatsApp não conectado', '⚠️');
    return;
  }
  
  let leads = await getLeads(CONFIG.MAX_PER_RUN);
  log(`${leads.length} leads disponíveis`, '📋');
  
  if (leads.length === 0) {
    const saved = await extractLeads();
    if (saved > 0) leads = await getLeads(CONFIG.MAX_PER_RUN);
  }
  
  let sent = 0;
  for (let i = 0; i < leads.length && sent < CONFIG.MAX_PER_RUN; i++) {
    if (appState.msgsToday >= CONFIG.DAILY_LIMIT) {
      log(`Limite diário (${CONFIG.DAILY_LIMIT})`, '🚫');
      break;
    }
    if (sent > 0 && sent % 5 === 0) await sleep(CONFIG.BATCH_PAUSE);
    if (sent > 0) await randomDelay();
    
    const phone = leads[i].telefone.replace(/\D/g, '');
    const msg = await generateMsg(leads[i]);
    if (msg) {
      const ok = await sendWhatsApp(phone, msg);
      if (ok) {
        sent++;
        appState.msgsToday++;
        await updateLead(leads[i].lead_key, 'Em Contato', 1, `Enviado via Brave em ${new Date().toLocaleString('pt-BR')}`);
      }
    }
  }
  
  log(`📊 Ciclo: ${sent}/${leads.length} enviadas | Hoje: ${appState.msgsToday}/${CONFIG.DAILY_LIMIT}`);
}

// ==================== MAIN ====================
async function main() {
  console.log(`
╔══════════════════════════════════════════╗
║   🦁 GeoLeads Sales Bot v3              ║
║   WhatsApp Web via Brave + IA           ║
╚══════════════════════════════════════════╝
  `);
  
  appState.userId = await findUserId();
  log(`Usuário: ${CONFIG.USER_EMAIL}`);
  
  await launchWhatsApp();
  
  if (!appState.connected) {
    log('Conecte o WhatsApp Web no Brave que abriu!', '📱');
    // Tenta de novo até conectar
    for (let i = 0; i < 30 && !appState.connected; i++) {
      await sleep(10000);
      try {
        await appState.page.waitForSelector('[data-testid="chat-list"]', { timeout: 5000 });
        appState.connected = true;
        log('✅ WhatsApp Web conectado!');
      } catch {}
    }
  }
  
  if (!appState.connected) {
    log('🔥 Não foi possível conectar. Verifique o Brave.', '❌');
    return;
  }
  
  log('🚀 Bot operacional!\n');
  
  while (true) {
    try {
      await runCycle();
    } catch (err) {
      log(`Erro no ciclo: ${err.message}`, '🔥');
    }
    await sleep(CONFIG.CYCLE_ACTIVE);
  }
}

main().catch(err => {
  console.error('🔥 Fatal:', err);
  process.exit(1);
});
