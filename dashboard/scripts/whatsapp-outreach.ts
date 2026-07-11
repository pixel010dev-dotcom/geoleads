#!/usr/bin/env npx tsx
/**
 * WhatsApp Outreach Bot — GeoLeads 🤖
 * 
 * Robô de vendas autônomo que:
 * 1. Conecta no WhatsApp via Baileys
 * 2. Extrai leads novos via Places API
 * 3. Filtra só números com WhatsApp
 * 4. Envia mensagens personalizadas com delay estratégico
 * 5. Atualiza CRM
 * 6. Detecta respostas
 * 
 * USO: npx tsx scripts/whatsapp-outreach.ts
 */

import * as path from 'path';
import * as fs from 'fs';

// ==================== LOAD ENV ====================
const envPath = path.resolve(__dirname, '../.env.local');
if (fs.existsSync(envPath)) {
  const dotenv = require('dotenv');
  dotenv.config({ path: envPath });
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY!;
const USER_EMAIL = 'pixel010dev@gmail.com';

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) throw new Error('Supabase não configurado');
if (!GOOGLE_PLACES_API_KEY) throw new Error('GOOGLE_PLACES_API_KEY não configurada');

const AUTH_DIR = path.resolve(__dirname, '../baileys-auth');
if (!fs.existsSync(AUTH_DIR)) fs.mkdirSync(AUTH_DIR, { recursive: true });

// ==================== IMPORTS ====================
import { createClient } from '@supabase/supabase-js';
import pino from 'pino';
import { 
  default as makeWASocket, 
  DisconnectReason, 
  useMultiFileAuthState,
  type WASocket,
  type WAMessage,
} from '@whiskeysockets/baileys';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ==================== CONFIG ====================
const CONFIG = {
  // Envio
  MIN_DELAY_MS: 45_000,       // 45s entre mensagens
  MAX_DELAY_MS: 90_000,       // até 90s (randômico)
  
  // Limites diários
  DAILY_LIMIT: 25,             // max por dia pra não tomar block
  BATCH_SIZE: 5,               // quantas antes de pausa longa
  BATCH_PAUSE_MS: 5 * 60_000, // 5 min a cada batch
  
  // Extração
  LEADS_PER_CYCLE: 100,        // quantos extrair por ciclo
  FILTER_ONLY_WHATSAPP: true,  // só números com WhatsApp
  
  // Ciclo
  CYCLE_INTERVAL_MS: 30 * 60_000, // 30 min entre ciclos
  MAX_MESSAGES_PER_RUN: 10,       // max por execução
  
  // Mensagem
  MESSAGE_TEMPLATE: `Olá {NOME}! Tudo bem? Vi o perfil de vocês no Google e achei o trabalho de vocês interessante. Tenho uma ideia simples que pode ajudar {CIDADE} a conhecer melhor os serviços que vocês oferecem. Posso compartilhar com você?`,
};

// ==================== ESTADO ====================
const state = {
  connected: false,
  socket: null as WASocket | null,
  userId: '' as string,
  messagesSentToday: 0,
  lastBatchTime: Date.now(),
  qrShown: false,
  startTime: Date.now(),
};

// ==================== SUPABASE: BUSCAR USER ====================
async function findUserId(): Promise<string> {
  // Lista todos os usuários
  const { data: all } = await supabase.auth.admin.listUsers();
  if (all?.users?.length) {
    // Procura pelo email
    const user = all.users.find(u => u.email === USER_EMAIL);
    if (user) {
      console.log(`[SUPABASE] Usuário encontrado: ${user.email}`);
      return user.id;
    }
    // Fallback: primeiro user
    console.log(`[SUPABASE] Usando primeiro usuário: ${all.users[0].email}`);
    return all.users[0].id;
  }

  // Tenta profiles direto
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .limit(1)
    .maybeSingle();
  if (profile?.id) return profile.id;

  throw new Error('Não encontrou usuário no Supabase');
}

// ==================== SUPABASE: OPERAÇÕES CRM ====================
interface CrmLeadRow {
  user_id: string;
  lead_key: string;
  nome: string;
  telefone: string;
  stage: string;
  nicho: string;
  cidade: string;
  payload?: any;
}

async function getLeadsToContact(limit: number = 10): Promise<CrmLeadRow[]> {
  const { data, error } = await supabase
    .from('crm_leads')
    .select('user_id, lead_key, nome, telefone, stage, nicho, cidade, payload')
    .eq('user_id', state.userId)
    .eq('stage', 'Novo')
    .not('telefone', 'eq', 'Não informado')
    .not('telefone', 'eq', '')
    .not('telefone', 'is', null)
    .limit(limit);

  if (error) {
    console.error(`[CRM] Erro ao buscar leads: ${error.message}`);
    return [];
  }
  return data || [];
}

async function updateLeadStage(leadKey: string, stage: string, notes?: string) {
  const update: any = { stage, updated_at: new Date().toISOString() };
  if (notes) update.notes = notes;

  const { error } = await supabase
    .from('crm_leads')
    .update(update)
    .eq('user_id', state.userId)
    .eq('lead_key', leadKey);

  if (error) console.error(`[CRM] Erro ao atualizar lead: ${error.message}`);
}

async function saveLeadsToCrm(leads: any[]) {
  const rows = leads.map(l => ({
    user_id: state.userId,
    lead_key: `${l.nome || ''}|${l.telefone || ''}|${l.cidade || ''}`,
    nome: l.nome || 'Lead sem nome',
    telefone: l.telefone || '',
    stage: 'Novo',
    nicho: l.categoria || 'Geral',
    cidade: l.cidade || 'Geral',
    payload: l,
    saved_at: new Date().toISOString(),
  }));

  // Upsert pra evitar duplicatas
  const { error } = await supabase
    .from('crm_leads')
    .upsert(rows, { onConflict: 'user_id,lead_key' });

  if (error) console.error(`[CRM] Erro ao salvar leads: ${error.message}`);
  else console.log(`[CRM] ${rows.length} leads salvos`);
}

// ==================== EXTRAÇÃO VIA PLACES API ====================
async function extractFreshLeads(keyword: string, location: string): Promise<any[]> {
  console.log(`[EXTRACT] Buscando "${keyword}" em "${location}"...`);
  
  try {
    // Importa a função do motor turbo
    const { extractFromGooglePlaces } = await import('../src/app/api/extract/strategies/google-places');
    
    const places = await extractFromGooglePlaces(keyword, location, CONFIG.LEADS_PER_CYCLE);
    
    // Filtra só com telefone
    let leads = places.filter(p => p.telefone && p.telefone !== 'Não informado');
    
    // Opcional: filtra só quem tem WhatsApp
    if (CONFIG.FILTER_ONLY_WHATSAPP) {
      leads = leads.filter(l => l.isMobile === true);
    }
    
    console.log(`[EXTRACT] ${places.length} encontrados, ${leads.length} com WhatsApp`);
    return leads;
  } catch (err: any) {
    console.error(`[EXTRACT] Erro: ${err.message}`);
    return [];
  }
}

// ==================== WHATSAPP: CONEXÃO ====================
let socket: WASocket | null = null;
let qrResolve: ((value: boolean) => void) | null = null;

async function connectWhatsApp(): Promise<void> {
  console.log('\n========================================');
  console.log('  WHATSAPP OUTREACH BOT 🤖');
  console.log('========================================\n');

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
  } as any);

  state.socket = socket;

  socket.ev.on('creds.update', saveCreds);

  socket.ev.on('connection.update', async (update: any) => {
    const { connection, qr, lastDisconnect } = update;

    if (qr) {
      console.log('\n📱 ESCANEIE O QR CODE ACIMA com seu WhatsApp');
      console.log('📱 O QR code está no terminal — abra WhatsApp > Dispositivos Conectados > Conectar');
      console.log('📱 Se não aparecer, reinicie o script\n');
      
      // Salva QR como imagem pra facilitar
      try {
        const qrcode = require('qrcode');
        const qrPath = path.resolve(__dirname, '../baileys-auth/qr.png');
        await qrcode.toFile(qrPath, qr);
        console.log(`📱 QR salvo em: ${qrPath}\n`);
      } catch {}
      
      state.qrShown = true;
      if (qrResolve) qrResolve(true);
    }

    if (connection === 'open') {
      console.log('✅ WhatsApp CONECTADO!\n');
      state.connected = true;
      if (qrResolve) qrResolve(true);
    }

    if (connection === 'close') {
      const reason = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = reason !== DisconnectReason.loggedOut;
      
      console.log(`❌ Desconectado (${reason}). ${shouldReconnect ? 'Reconectando em 5s...' : 'Sessão expirada, precisa escanear QR novamente.'}`);
      
      state.connected = false;
      
      if (shouldReconnect) {
        setTimeout(connectWhatsApp, 5000);
      }
    }
  });

  // Detecta respostas
  socket.ev.on('messages.upsert', async (msgEvent: { messages: WAMessage[]; type: string }) => {
    for (const msg of msgEvent.messages) {
      if (!msg.key || msg.key.fromMe) continue; // ignora próprias mensagens
      if (!msg.message?.conversation && !msg.message?.extendedTextMessage?.text) continue;
      
      const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
      const sender = msg.key.remoteJid;
      const pushName = msg.pushName || 'Desconhecido';
      
      console.log(`\n💬 RESPOSTA de ${pushName} (${sender}): "${text.substring(0, 100)}"`);
      
      // Aqui poderia ter lógica automática de resposta
      // Por enquanto só loga
    }
  });
}

// ==================== WHATSAPP: ENVIO ====================
function formatMessage(template: string, lead: CrmLeadRow): string {
  return template
    .replace(/{NOME}/g, lead.nome?.split(' - ')[0]?.split(' | ')[0] || lead.nome || '')
    .replace(/{CIDADE}/g, lead.cidade || 'sua região')
    .replace(/{NICHO}/g, lead.nicho || 'negócio')
    .replace(/{TELEFONE}/g, lead.telefone || '');
}

function formatPhoneForJid(phone: string): string | null {
  // Remove tudo que não é dígito
  let digits = phone.replace(/\D/g, '');
  
  // Se tem 10-11 dígitos (BR), adiciona 55
  if (digits.length >= 10 && digits.length <= 11) {
    // Remove o 9 extra do nono dígito se necessário
    if (digits.length === 11) {
      digits = '55' + digits.substring(2);
    } else {
      digits = '55' + digits;
    }
  }
  
  // Já tem código de país
  if (digits.length >= 12) {
    return digits + '@s.whatsapp.net';
  }
  
  return null;
}

async function sendMessage(lead: CrmLeadRow): Promise<boolean> {
  if (!socket || !state.connected) {
    console.log('[SEND] WhatsApp não conectado');
    return false;
  }

  const jid = formatPhoneForJid(lead.telefone);
  if (!jid) {
    console.log(`[SEND] Telefone inválido: ${lead.telefone}`);
    return false;
  }

  const text = formatMessage(CONFIG.MESSAGE_TEMPLATE, lead);

  try {
    // Verifica se o número tem WhatsApp primeiro
    const presenceResult = await socket.onWhatsApp(jid);
    const presence = presenceResult?.[0];
    if (!presence?.exists) {
      console.log(`[SEND] ${lead.nome} — não tem WhatsApp`);
      await updateLeadStage(lead.lead_key, 'Novo', 'Sem WhatsApp');
      return false;
    }

    // Envia
    await socket.sendMessage(jid, { text });
    console.log(`✅ ${lead.nome} — mensagem enviada!`);

    // Atualiza CRM
    await updateLeadStage(lead.lead_key, 'Em Contato', `Mensagem enviada em ${new Date().toLocaleString('pt-BR')}`);

    state.messagesSentToday++;
    return true;
  } catch (err: any) {
    console.error(`[SEND] Erro ao enviar para ${lead.nome}: ${err.message || err}`);
    
    // Se erro de número inválido, marca
    if (err.message?.includes('not-authorized') || err.message?.includes('not-authorized')) {
      await updateLeadStage(lead.lead_key, 'Novo', `Número inválido: ${err.message}`);
    }
    
    return false;
  }
}

// ==================== DELAY INTELIGENTE ====================
function randomDelay(): Promise<void> {
  const ms = CONFIG.MIN_DELAY_MS + Math.random() * (CONFIG.MAX_DELAY_MS - CONFIG.MIN_DELAY_MS);
  console.log(`⏳ Aguardando ${Math.round(ms / 1000)}s...`);
  return new Promise(r => setTimeout(r, ms));
}

function batchPause(): Promise<void> {
  console.log(`\n🛌 Pausa de ${CONFIG.BATCH_PAUSE_MS / 60000}min após ${CONFIG.BATCH_SIZE} mensagens...\n`);
  return new Promise(r => setTimeout(r, CONFIG.BATCH_PAUSE_MS));
}

// ==================== CICLO PRINCIPAL ====================
async function runCycle() {
  console.log('\n' + '='.repeat(50));
  console.log(`🔄 CICLO ${new Date().toLocaleString('pt-BR')}`);
  console.log('='.repeat(50));

  // 1. Verifica conexão WhatsApp
  if (!state.connected) {
    console.log('⚠️ WhatsApp desconectado, aguardando reconexão...');
    return;
  }

  // 2. Busca leads do CRM que tão "Novo" com telefone
  let leads = await getLeadsToContact(CONFIG.MAX_MESSAGES_PER_RUN);
  console.log(`📋 ${leads.length} leads disponíveis pra contato`);

  // 3. Se não tem leads, extrai novos
  if (leads.length === 0) {
    console.log('🔍 Sem leads no CRM. Extraindo novos...');
    
    // Pega o último nicho usado ou usa padrão
    const { data: lastExtract } = await supabase
      .from('extraction_history')
      .select('keyword, location')
      .eq('user_id', state.userId)
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

  // 4. Verifica limite diário
  if (state.messagesSentToday >= CONFIG.DAILY_LIMIT) {
    console.log(`\n🚫 Limite diário atingido (${CONFIG.DAILY_LIMIT} mensagens). Parando por hoje.`);
    console.log(`📊 Estatísticas:`);
    console.log(`   Mensagens enviadas: ${state.messagesSentToday}`);
    console.log(`   Tempo ativo: ${Math.round((Date.now() - state.startTime) / 60000)}min`);
    console.log(`   Próximo ciclo diário: ${new Date(Date.now() + CONFIG.CYCLE_INTERVAL_MS).toLocaleString('pt-BR')}`);
    return;
  }

  // 5. Envia mensagens
  let sent = 0;
  for (let i = 0; i < leads.length && sent < CONFIG.MAX_MESSAGES_PER_RUN; i++) {
    const lead = leads[i];
    
    // Verifica limite diário
    if (state.messagesSentToday >= CONFIG.DAILY_LIMIT) {
      console.log('🚫 Limite diário atingido');
      break;
    }

    // Pausa entre batches
    if (sent > 0 && sent % CONFIG.BATCH_SIZE === 0) {
      await batchPause();
    }

    // Pausa entre mensagens (exceto na primeira)
    if (sent > 0) {
      await randomDelay();
    }

    const ok = await sendMessage(lead);
    if (ok) sent++;
  }

  console.log(`\n📊 CICLO COMPLETO: ${sent}/${leads.length} mensagens enviadas`);
  console.log(`📊 Total hoje: ${state.messagesSentToday}/${CONFIG.DAILY_LIMIT}`);
}

// ==================== LOOP PRINCIPAL ====================
async function main() {
  console.log('Iniciando sistema...');

  // 1. Descobre user ID
  state.userId = await findUserId();
  console.log(`👤 Usuário: ${USER_EMAIL} (ID: ${state.userId})`);

  // 2. Conecta WhatsApp (bloqueia até conectar)
  await connectWhatsApp();
  
  // 3. Aguarda conexão
  console.log('Aguardando conexão WhatsApp...');
  await new Promise<void>(resolve => {
    const check = setInterval(() => {
      if (state.connected) {
        clearInterval(check);
        resolve();
      }
    }, 1000);
    // Timeout de 2 min pro QR
    setTimeout(() => {
      clearInterval(check);
      console.log('⚠️ QR não escaneado ainda. O bot vai tentar reconectar...');
      resolve();
    }, 120_000);
  });

  // 4. Loop de ciclos
  console.log('\n🚀 Bot operacional! Iniciando ciclos de extração + envio...\n');

  while (true) {
    try {
      await runCycle();
    } catch (err: any) {
      console.error(`[FATAL] Erro no ciclo: ${err.message}`);
    }

    // Espera antes do próximo ciclo
    const waitMinutes = CONFIG.CYCLE_INTERVAL_MS / 60000;
    console.log(`\n⏰ Próximo ciclo em ${waitMinutes}min (${new Date(Date.now() + CONFIG.CYCLE_INTERVAL_MS).toLocaleString('pt-BR')})`);
    console.log('📱 Bot rodando em background...\n');
    
    await new Promise(r => setTimeout(r, CONFIG.CYCLE_INTERVAL_MS));
  }
}

// ==================== EXECUTA ====================
main().catch(err => {
  console.error('Erro fatal:', err);
  process.exit(1);
});
