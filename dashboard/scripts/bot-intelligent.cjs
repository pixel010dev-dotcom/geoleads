#!/usr/bin/env node
/**
 * 🤖 GeoLeads Sales Bot v2 — Inteligente
 * 
 * Robô de vendas autônomo com IA:
 * - Conexão WhatsApp via Baileys
 * - Extração de leads via Google Places API (chamada direta HTTP)
 * - Mensagens personalizadas por IA (Gemini)
 * - Funil de vendas em 4 estágios
 * - Resposta inteligente a perguntas
 * - Anti-ban com delays adaptativos
 * - Auto-supervisão e relatórios
 */

'use strict';

// ==================== BOOTSTRAP ====================
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.local') });
require('dotenv').config(); // fallback

const path = require('path');
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

// ==================== CONFIG ====================
const CONFIG = {
  WHATSAPP_QR_DIR: path.resolve(__dirname, '../baileys-auth'),
  DAILY_LIMIT: parseInt(process.env.DAILY_MESSAGE_LIMIT || '25', 10),
  MAX_PER_RUN: parseInt(process.env.MAX_MESSAGES_PER_RUN || '8', 10),
  BATCH_SIZE: 5,
  DELAY_MIN: 45_000,      // 45s
  DELAY_MAX: 90_000,      // 90s
  BATCH_PAUSE: 5 * 60_000, // 5 min entre lotes
  CYCLE_ACTIVE: 2 * 60_000, // 2 min entre ciclos ativos
  CYCLE_IDLE: 30 * 60_000,  // 30 min entre ciclos inativos
  PLACES_API_KEY: process.env.GOOGLE_PLACES_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY,
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  USER_EMAIL: 'pixel010dev@gmail.com',
};

// ==================== SUPABASE ====================
const supabase = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_SERVICE_KEY);

// ==================== APP STATE ====================
const appState = {
  userId: null,
  connected: false,
  messagesSentToday: 0,
  startTime: Date.now(),
  cycleCount: 0,
  lastCycleTime: 0,
  salesFunnel: {
    discovery: 0,
    interest: 0,
    presentation: 0,
    closed: 0,
    rejected: 0,
  },
};

// ==================== HELPERS ====================
function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function randomDelay(min = CONFIG.DELAY_MIN, max = CONFIG.DELAY_MAX) {
  const ms = Math.floor(Math.random() * (max - min) + min);
  return sleep(ms);
}

function formatPhone(phone) {
  if (!phone) return null;
  let digits = phone.replace(/\D/g, '');
  // Se já tem formato internacional (55...)
  if (digits.startsWith('55') && digits.length >= 12) {
    return digits + '@s.whatsapp.net';
  }
  // Número brasileiro: adiciona 55
  if ((digits.length === 10 || digits.length === 11)) {
    // Remove o 9 extra se tiver (DDD + 9 + número)
    if (digits.length === 11) digits = '55' + digits.substring(2);
    else digits = '55' + digits;
    return digits + '@s.whatsapp.net';
  }
  return digits.length >= 12 ? digits + '@s.whatsapp.net' : null;
}

function extractName(rawName) {
  if (!rawName) return 'Cliente';
  return rawName.split(' - ')[0].split(' | ')[0].split(',')[0].trim() || 'Cliente';
}

function log(msg, emoji = '') {
  const ts = new Date().toLocaleTimeString('pt-BR');
  console.log(`${emoji} [${ts}] ${msg}`);
}

// ==================== GEMINI AI ====================
async function gemini(prompt, system = '') {
  if (!CONFIG.GEMINI_API_KEY) {
    log('GEMINI_API_KEY não configurada', '⚠️');
    return null;
  }

  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    systemInstruction: system ? { parts: [{ text: system }] } : undefined,
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 500,
      topP: 0.9,
    },
  };

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-001:generateContent?key=${CONFIG.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }
    );
    const data = await res.json();
    return data?.candidates?.[0]?.content?.parts?.[0]?.text || null;
  } catch (err) {
    log(`Gemini error: ${err.message}`, '⚠️');
    return null;
  }
}

const SYSTEM_SALES = `Você é um vendedor consultivo do GeoLeads, uma plataforma que gera leads qualificados para negócios locais.

REGRAS:
- Seja natural, amigável e persuasivo
- Adapte o tom ao contexto (formal para clínicas, informal para pizzarias)
- NUNCA seja spam. Sempre ofereça valor primeiro
- Quando perguntarem sobre preço, diga que é acessível e que pode mostrar uma demonstração
- O link do GeoLeads é: https://geoleads.tech (mas só compartilhe quando o lead demonstrar interesse)
- Responda em PORTUGUÊS BRASILEIRO
- Seja conciso (máx 200 caracteres na primeira mensagem)
- Funil: 1° Apresentação → 2° Interesse → 3° Demo → 4° Fechamento

OBJETIVO: Converter leads em clientes do GeoLeads.`;

// ==================== SALES FUNNEL ====================
const STAGE = {
  DISCOVERY: 1,    // Primeiro contato
  INTEREST: 2,     // Lead respondeu positivamente
  PRESENTATION: 3, // Demonstração do produto
  CLOSED: 4,       // Fechou / Quer comprar
  REJECTED: -1,    // Não quer
};

const STAGE_LABEL = {
  1: 'Descoberta',
  2: 'Interesse',
  3: 'Apresentação',
  4: 'Fechado',
  '-1': 'Rejeitado',
};

async function generateFirstMessage(lead) {
  const name = extractName(lead.nome);
  const cidade = lead.cidade || 'sua região';
  const nicho = lead.nicho || 'negócio';

  // Tenta Gemini primeiro
  const prompt = `Crie uma mensagem de WhatsApp curta e persuasiva (máx 200 caracteres) para um lead de ${nicho} em ${cidade}.
Nome: ${name}
Contexto: Encontrei o negócio no Google e quero oferecer uma solução que gera mais clientes.
Tom: Amigável, profissional, não pareça spam.
NÃO peça dinheiro. Apenas apresente valor.`;
  const aiMsg = await gemini(prompt, SYSTEM_SALES);
  if (aiMsg) return aiMsg;

  // Fallback humano
  const templates = [
    `Olá ${name}! Tudo bem? Vi o perfil do seu ${nicho} no Google e gostei do trabalho. Tenho uma ideia que pode ajudar a atrair mais clientes em ${cidade}. Topa dar uma olhada?`,
    `Oi ${name}, tudo certo? Encontrei seu ${nicho} no Google e achei interessante! Tenho uma ferramenta que ajuda negócios como o seu a conseguir mais clientes em ${cidade}. Posso te mostrar?`,
    `Olá ${name}! Vi seu ${nicho} no Google e notei que tem potencial pra crescer ainda mais em ${cidade}. Criei uma solução que pode ajudar. Quer saber mais?`,
  ];
  return templates[Math.floor(Math.random() * templates.length)];
}

async function generateResponse(lead, message) {
  const name = extractName(lead.nome);
  const stage = lead.stage_vendas || STAGE.DISCOVERY;
  const cidade = lead.cidade || 'sua região';
  const nicho = lead.nicho || 'negócio';

  const prompt = `Lead respondeu: "${message}"

Contexto:
- Nome: ${name}
- Negócio: ${nicho}
- Cidade: ${cidade}
- Estágio atual: ${STAGE_LABEL[stage]}

Gere uma resposta NATURAL e persuasiva. Se ele:
- Perguntou preço: Diga que é acessível e ofereça demonstração grátis
- Mostrou interesse: Reforce o valor e marque uma call rápida
- Disse "não obrigado": Agradeça e pergunte se pode mandar mais info depois
- Tem dúvidas: Esclareça e mostre benefícios

Link do site: https://geoleads.tech (só mande se ele pedir ou mostrar interesse forte)
Responda em até 300 caracteres.`;
  const aiMsg = await gemini(prompt, SYSTEM_SALES);
  if (aiMsg) return aiMsg;

  // Fallback
  const fallbacks = [
    `Que legal, ${name}! O GeoLeads ajuda negócios como o seu a conseguir clientes novos toda semana. Quer ver como funciona?`,
    `Entendo, ${name}! A plataforma é bem simples de usar e os resultados aparecem rápido. Posso te mostrar numa call rápida?`,
    `Valeu pelo retorno, ${name}! Se tiver interesse depois, é só chamar. Desejo sucesso no ${nicho}!`,
  ];
  return fallbacks[Math.floor(Math.random() * fallbacks.length)];
}

// ==================== PLACES API (SIMPLES) ====================
async function searchPlaces(keyword, location) {
  if (!CONFIG.PLACES_API_KEY) {
    log('GOOGLE_PLACES_API_KEY não configurada', '⚠️');
    return [];
  }

  const results = [];
  const query = `${keyword} em ${location}`;

  try {
    log(`[PLACES] "${query}"`, '🔍');
    const res = await fetch(
      `https://places.googleapis.com/v1/places:searchText?key=${CONFIG.PLACES_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.internationalPhoneNumber',
        },
        body: JSON.stringify({ textQuery: query, pageSize: 20, languageCode: 'pt-BR' }),
      }
    );

    const data = await res.json();
    if (!data?.places) {
      log(`[PLACES] Erro: ${JSON.stringify(data).substring(0,200)}`, '❌');
      return [];
    }

    log(`[PLACES] ${data.places.length} resultados brutos`, '📊');

    for (const p of data.places) {
      const phone = p.internationalPhoneNumber || p.nationalPhoneNumber || '';
      if (phone.startsWith('+55')) {
        results.push({
          place_id: p.id,
          nome: p.displayName?.text || 'Sem nome',
          endereco: p.formattedAddress || '',
          cidade: location,
          nicho: keyword,
          telefone: phone,
          fonte: 'places_new_api',
        });
      }
    }

    log(`→ ${results.length} com telefone BR`, '📊');
  } catch (err) {
    log(`[PLACES] Erro: ${err.message}`, '❌');
  }

  return results;
}

async function extractAndSaveLeads() {
  log('=== Extraindo leads via Places API ===', '🚀');

  // Keywords padrão (negócios locais que costumam ter WhatsApp)
  const defaultKeywords = [
    'pizzaria', 'restaurante', 'mercado', 'padaria', 'academia',
    'salão de beleza', 'barbearia', 'oficina mecânica', 'pet shop',
    'clínica odontológica', 'consultório médico', 'advocacia',
    'imobiliária', 'contabilidade', 'escola',
  ];

  const locations = ['São Paulo']; // Começa com SP, depois expande

  let allLeads = [];
  for (const loc of locations) {
    for (const kw of defaultKeywords) {
      const results = await searchPlaces(kw, loc);
      allLeads = allLeads.concat(results);
    }
  }

  log(`Total extraídos: ${allLeads.length} leads com WhatsApp`, '📊');

  // Salva no CRM
  let saved = 0;
  for (const lead of allLeads) {
    try {
      const { error } = await supabase.from('crm_leads').upsert({
        user_id: appState.userId,
        lead_key: `places_${lead.place_id}`,
        nome: lead.nome,
        telefone: lead.telefone,
        cidade: lead.cidade,
        nicho: lead.nicho,
        status: 'Novo',
        stage_vendas: STAGE.DISCOVERY,
        fonte: 'whatsapp_bot',
        metadata: { isMobile: lead.isMobile, extracted_at: new Date().toISOString() },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,lead_key' });

      if (!error) saved++;
    } catch {}
  }

  log(`${saved}/${allLeads.length} leads salvos no CRM`, '💾');
  return saved;
}

// ==================== CRM OPERATIONS ====================
async function findUserId() {
  const { data: all } = await supabase.auth.admin.listUsers();
  if (all?.users?.length) {
    const found = all.users.find(u => u.email === CONFIG.USER_EMAIL);
    if (found) return found.id;
  }
  throw new Error('Nenhum usuário encontrado');
}

async function getLeadsToContact(limit) {
  // Busca leads "Novo" que tenham WhatsApp
  const { data } = await supabase
    .from('crm_leads')
    .select('id,lead_key,nome,telefone,cidade,nicho,status,stage_vendas')
    .eq('user_id', appState.userId)
    .eq('status', 'Novo')
    .not('telefone', 'is', null)
    .gte('telefone', '+55')
    .order('created_at', { ascending: true })
    .limit(limit * 3); // Pega mais pra filtrar

  if (!data) return [];

  // Filtra telefones válidos
  return data.filter(l => l.telefone && l.telefone.replace(/\D/g, '').length >= 12).slice(0, limit);
}

async function updateLeadStage(leadKey, status, stage, notes = '') {
  await supabase
    .from('crm_leads')
    .update({
      status,
      stage_vendas: stage,
      updated_at: new Date().toISOString(),
      ...(notes ? { observacoes: supabase.rpc('concat_notes', { existing_notes: 'observacoes', new_notes: notes }).then ? null : notes } : {}),
    })
    .eq('user_id', appState.userId)
    .eq('lead_key', leadKey);
}

// ==================== WHATSAPP ====================
let socket = null;

async function connectWhatsApp() {
  log('Iniciando conexão WhatsApp...', '📱');

  const baileys = require('@whiskeysockets/baileys');
  const makeWASocket = baileys.default;
  const { DisconnectReason, useMultiFileAuthState } = baileys;
  const pino = require('pino');
  const { Boom } = require('@hapi/boom');

  const { state, saveCreds } = await useMultiFileAuthState(CONFIG.WHATSAPP_QR_DIR);

  socket = makeWASocket({
    auth: state,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: true,
    browser: ['GeoLeads', 'Chrome', '10.0'],
    syncFullHistory: false,
    markOnlineOnConnect: false,
    connectTimeoutMs: 300_000, // 5 min pra dar tempo de escanear QR
    keepAliveIntervalMs: 120_000,
    maxRetries: 20,
    defaultQueryTimeoutMs: 30_000,
  });

  socket.ev.on('creds.update', saveCreds);

  socket.ev.on('connection.update', ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      log('QR CODE GERADO — escaneie com WhatsApp', '📱');
      // Salva QR em arquivo
      const qrPath = path.join(CONFIG.WHATSAPP_QR_DIR, 'qr.png');
      try {
        const qrcode = require('qrcode');
        qrcode.toFile(qrPath, qr, { scale: 8, margin: 1 });
      } catch {}
    }

    if (connection === 'open') {
      appState.connected = true;
      log('WhatsApp CONECTADO!', '✅');
    }

    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const reason = lastDisconnect?.error?.message || statusCode || 'unknown';
      appState.connected = false;
      log(`Desconectado (${reason}). Reconectando...`, '❌');

      // Reconecta exceto para logout
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      if (shouldReconnect) {
        setTimeout(() => connectWhatsApp(), 5000);
      }
    }
  });

  // Escuta mensagens recebidas
  socket.ev.on('messages.upsert', async ({ messages }) => {
    for (const msg of messages) {
      if (msg.key?.fromMe) continue; // Ignora nossas próprias mensagens

      // Extrai o telefone do remetente
      const senderJid = msg.key?.remoteJid;
      if (!senderJid || !senderJid.includes('@s.whatsapp.net')) continue;

      const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
      if (!text) continue;

      const senderPhone = senderJid.replace('@s.whatsapp.net', '');

      // Busca o lead no CRM
      const { data: leads } = await supabase
        .from('crm_leads')
        .select('id,lead_key,nome,cidade,nicho,stage_vendas')
        .eq('user_id', appState.userId)
        .or(`telefone.eq.+55${senderPhone.replace('+55','')},telefone.eq.${senderPhone}`)
        .limit(1);

      const lead = leads?.[0];
      if (lead) {
        log(`📩 "${extractName(lead.nome)}" respondeu: ${text.substring(0,50)}`);

        // Gera resposta inteligente
        const response = await generateResponse(lead, text);
        if (response) {
          try {
            await socket.sendMessage(senderJid, { text: response });
            log(`↩️ Resposta enviada para ${extractName(lead.nome)}`, '💬');
          } catch {}
        }

        // Analisa sentimento e atualiza estágio
        const sentiment = await analyzeSentiment(text);
        let newStage = lead.stage_vendas || STAGE.DISCOVERY;
        if (sentiment === 'positive' && newStage < STAGE.PRESENTATION) newStage++;
        if (sentiment === 'negative') newStage = STAGE.REJECTED;
        if (sentiment === 'interested') newStage = STAGE.PRESENTATION;

        await supabase
          .from('crm_leads')
          .update({
            stage_vendas: newStage,
            status: newStage >= STAGE.CLOSED ? 'Cliente' : newStage === STAGE.REJECTED ? 'Não Interessado' : 'Em Contato',
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', appState.userId)
          .eq('lead_key', lead.lead_key);

        // Log
        const label = STAGE_LABEL[newStage] || 'Desconhecido';
        log(`→ ${extractName(lead.nome)}: ${label}`, '📊');
        if (newStage === STAGE.CLOSED) {
          log(`🎉 NOVO CLIENTE! ${extractName(lead.nome)} fechou!`);
        }
      }
    }
  });

  return socket;
}

async function analyzeSentiment(text) {
  const prompt = `Analise o sentimento desta mensagem de um lead de vendas. Responda APENAS com uma palavra: positive, negative, interested, neutral.

Mensagem: "${text}"

Resposta:`;

  const result = await gemini(prompt, 'Você é um analista de sentimento. Responda apenas positive, negative, interested ou neutral.');
  if (result && ['positive', 'negative', 'interested', 'neutral'].includes(result.trim().toLowerCase())) {
    return result.trim().toLowerCase();
  }

  // Fallback
  const lower = text.toLowerCase();
  if (['quero', 'sim', 'quanto', 'interessado', 'gostei', 'pode me mostrar'].some(w => lower.includes(w))) return 'interested';
  if (['não', 'nao', 'obrigado', 'sem interesse', 'já tenho', 'nunca'].some(w => lower.includes(w))) return 'negative';
  return 'neutral';
}

// ==================== MESSAGE SENDING ====================
async function sendMessage(lead) {
  if (!socket || !appState.connected) {
    log('WhatsApp desconectado', '⚠️');
    return false;
  }

  const jid = formatPhone(lead.telefone);
  if (!jid) {
    log(`Telefone inválido: ${lead.telefone}`, '⚠️');
    return false;
  }

  try {
    // Verifica se o número tem WhatsApp
    const presenceResult = await socket.onWhatsApp(jid);
    const presence = presenceResult?.[0];
    if (!presence?.exists) {
      log(`${extractName(lead.nome)} — sem WhatsApp`, '📵');
      await updateLeadStage(lead.lead_key, 'Novo', lead.stage_vendas || STAGE.DISCOVERY, 'Sem WhatsApp');
      return false;
    }

    // Gera mensagem personalizada
    const text = await generateFirstMessage(lead);
    if (!text) return false;

    await socket.sendMessage(jid, { text });
    log(`✅ ${extractName(lead.nome)} — mensagem enviada!`);

    await updateLeadStage(lead.lead_key, 'Em Contato', STAGE.DISCOVERY, `Enviado em ${new Date().toLocaleString('pt-BR')}`);
    appState.messagesSentToday++;
    appState.salesFunnel.discovery++;
    return true;
  } catch (err) {
    log(`Erro ao enviar para ${extractName(lead.nome)}: ${err.message || err}`, '❌');
    return false;
  }
}

async function batchPause() {
  log(`Pausa de ${CONFIG.BATCH_PAUSE / 60000}min entre lotes...`, '☕');
  await sleep(CONFIG.BATCH_PAUSE);
}

// ==================== CYCLE ====================
async function runCycle() {
  appState.cycleCount++;
  appState.lastCycleTime = Date.now();
  log(`=== CICLO ${appState.cycleCount} ===`, '🔄');

  if (!appState.connected) {
    log('WhatsApp desconectado, pulando...', '⚠️');
    return;
  }

  // 1. Busca leads disponíveis
  let leads = await getLeadsToContact(CONFIG.MAX_PER_RUN);
  log(`${leads.length} leads disponíveis`, '📋');

  // 2. Se não tem leads, extrai novos
  if (leads.length === 0) {
    const saved = await extractAndSaveLeads();
    if (saved > 0) {
      leads = await getLeadsToContact(CONFIG.MAX_PER_RUN);
      log(`${leads.length} leads após extração`, '📋');
    }
  }

  // 3. Envia mensagens
  let sent = 0;
  for (let i = 0; i < leads.length && sent < CONFIG.MAX_PER_RUN; i++) {
    if (appState.messagesSentToday >= CONFIG.DAILY_LIMIT) {
      log(`Limite diário (${CONFIG.DAILY_LIMIT}) atingido!`, '🚫');
      break;
    }
    if (sent > 0 && sent % CONFIG.BATCH_SIZE === 0) await batchPause();
    if (sent > 0) await randomDelay();

    const ok = await sendMessage(leads[i]);
    if (ok) sent++;
  }

  // 4. Relatório
  log(`📊 CICLO: ${sent}/${leads.length} mensagens enviadas`, '📊');
  log(`📊 Hoje: ${appState.messagesSentToday}/${CONFIG.DAILY_LIMIT}`, '📊');
  log(`📊 Funil: Descoberta=${appState.salesFunnel.discovery} | Interesse=${appState.salesFunnel.interest} | Apresentação=${appState.salesFunnel.presentation} | Fechados=${appState.salesFunnel.closed}`, '📊');
}

// ==================== MAIN ====================
async function main() {
  console.log(`
╔══════════════════════════════════════════╗
║     🤖 GeoLeads Sales Bot v2            ║
║     Inteligente + IA 🤖                 ║
╚══════════════════════════════════════════╝
  `);

  appState.userId = await findUserId();
  log(`Usuário: ${CONFIG.USER_EMAIL}`);
  log(`ID: ${appState.userId}`);

  await connectWhatsApp();

  // Aguarda conexão
  log('Aguardando QR code... Escaneie com WhatsApp', '📱');
  if (!appState.connected) {
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
        else {
          log('QR não escaneado ainda. Continuando...', '⏳');
          resolve();
        }
      }, 300_000); // 5 min
    });
  }

  log('🚀 Bot operacional!\n');

  while (true) {
    try {
      await runCycle();
    } catch (err) {
      log(`Erro no ciclo: ${err.message}`, '🔥');
    }

    const isActive = appState.messagesSentToday > 0 || appState.connected;
    const waitMs = isActive ? CONFIG.CYCLE_ACTIVE : CONFIG.CYCLE_IDLE;
    log(`Próximo ciclo em ${waitMs / 60000}min`, '⏰');
    await sleep(waitMs);
  }
}

// ==================== START ====================
main().catch(err => {
  console.error('🔥 Fatal:', err);
  process.exit(1);
});
