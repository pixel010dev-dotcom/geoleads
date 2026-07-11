#!/usr/bin/env node
/**
 * 🦁 GeoLeads Brave Bot v3 — ULTRA OTIMIZADO
 *
 * O que faz:
 * - Filtra só números de celular (pula fixos automaticamente)
 * - Mensagens personalizadas por nicho
 * - Primeiro nome extraído do nome da empresa
 * - Atualiza CRM após envio
 * - Monitora respostas
 * - Estatísticas completas
 * - Sorteia leads aleatórios (evita parecer robô)
 */

'use strict';
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.local') });

const puppeteer = require('puppeteer-core');
const { createClient } = require('@supabase/supabase-js');

const BRAVE = 'C:/Users/Admin/AppData/Local/BraveSoftware/Brave-Browser/Application/brave.exe';
const PROFILE = 'C:/Users/Admin/AppData/Local/BraveSoftware/Brave-Browser/User Data';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// === MENSAGENS — VENDEM O WHATSAI ===
// Objetivo: despertar interesse no sistema de prospecção automática via WhatsApp
// Tom: natural, direto, como se fosse uma pessoa real mandando
const TEMPLATES = {
  'restaurante': [
    (n) => `Olá ${n}! Tudo bem? Vi seu restaurante no Google. Trabalho com um sistema que encontra clientes no WhatsApp e manda ofertas pro seu negócio automaticamente. Chama WhatsAI. Já ouviu falar?`,
    (n) => `Oi ${n}! Vi seu restaurante no Google. Tenho um sistema (WhatsAI) que faz prospecção automática no WhatsApp — ele encontra clientes e conversa por você. Quer ver como funciona?`,
  ],
  'pizzaria': [
    (n) => `Eaí ${n}! Tudo certo? Vi sua pizzaria no Google. Conhece o WhatsAI? É um sistema que aborda clientes no WhatsApp automaticamente e leva pedidos pro seu negócio. Quer dar uma olhada?`,
    (n) => `Olá ${n}! Tudo bem? Tenho uma ferramenta chamada WhatsAI que faz todo o trabalho de prospecção no WhatsApp pra sua pizzaria — encontra clientes e inicia a conversa. Topa conhecer?`,
  ],
  'mercado': [
    (n) => `Olá ${n}! Tudo joia? Vi seu mercado no Google. Meu sistema (WhatsAI) encontra clientes e manda mensagens no WhatsApp automaticamente divulgando seu mercado. Quer ver como?`,
    (n) => `Oi ${n}! Trabalho com um sistema que faz prospecção automática no WhatsApp pra mercados. Ele encontra clientes e conversa por você. Se chama WhatsAI. Bate um papo?`,
  ],
  'padaria': [
    (n) => `Bom dia ${n}! Tudo certo? Vi sua padaria no Google. Conhece o WhatsAI? Um robô que entra em contato com clientes no WhatsApp automaticamente e leva mais gente até você. Interessado?`,
    (n) => `Olá ${n}! Sua padaria apareceu no Google. Tenho um sistema (WhatsAI) que prospecta clientes no WhatsApp 24h por dia. Quer saber como ele funciona?`,
  ],
  'default': [
    (n, neg) => `Olá ${n}! Tudo bem? Vi seu ${neg} no Google. Trabalho com um sistema que encontra clientes e inicia conversas no WhatsApp automaticamente — chama WhatsAI. Topa conhecer?`,
    (n, neg) => `Oi ${n}! Vi seu ${neg} no Google. Meu sistema (WhatsAI) faz prospecção automática no WhatsApp: aborda clientes, faz apresentação, tudo sozinho. Quer dar uma olhada?`,
    (n, neg) => `Eaí ${n}! Seu ${neg} apareceu no Google. Conhece o WhatsAI? É um robô que aborda clientes no WhatsApp 24h e leva mais negócios pra você. Tem interesse?`,
  ],
};

// === AUTO-RESPOSTAS — FECHAM A VENDA DO WHATSAI ===
const AUTO_REPLY = [
  `Que bom que respondeu! 🎯 Me chamo Diogo, sou de Foz. O WhatsAI é um sistema que encontra clientes no WhatsApp automaticamente e conversa por você — como se fosse um vendedor 24h. Já pensou em ter isso pro seu negócio?`,
  `Valeu pela resposta! 🚀 Resumindo: o WhatsAI escaneia o Google, encontra clientes perto do seu negócio e manda mensagem no WhatsApp deles automaticamente. Sem você levantar um dedo. Quer ver uma demonstração?`,
  `Fala aí! 😄 O WhatsAI é tipo um vendedor automático: ele encontra leads, manda mensagem personalizada e responde quem interage — tudo 24h. Já pensou em quantos clientes você perde sem isso?`,
];

function primeiroNome(nome) {
  // Pega o primeiro nome real, ignorando palavras comuns
  const palavras = nome.split(/\s+/);
  const ignorar = ['dom', 'dona', 'dr', 'dra', 'super', 'mega', 'top', 'la', 'o', 'a'];
  for (const p of palavras) {
    const limpo = p.replace(/[^a-zA-Zà-úÀ-Ú]/g, '');
    if (limpo.length >= 3 && !ignorar.includes(limpo.toLowerCase())) return limpo;
  }
  return palavras[0] || nome;
}

function isCelular(telefone) {
  const digs = (telefone || '').replace(/\D/g, '');
  return digs.length >= 13;
}

function rand(min, max) { return min + Math.random() * (max - min); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function aguardar(page, sel, timeout = 30000) {
  try { await page.waitForSelector(sel, { timeout }); return true; }
  catch { return false; }
}

async function main() {
  console.log('🔍 Buscando leads do CRM...');

  const { data: users } = await supabase.auth.admin.listUsers();
  const uid = users?.users?.find(u => u.email === 'pixel010dev@gmail.com')?.id;
  if (!uid) { console.log('❌ Usuário não encontrado'); return; }

  // Pega leads novos
  const { data: leads } = await supabase
    .from('crm_leads')
    .select('id, nome, telefone, nicho')
    .eq('user_id', uid)
    .eq('stage', 'Novo');

  if (!leads || !leads.length) { console.log('❌ Nenhum lead novo'); return; }

  // Filtra só celular e aleatoriza
  let celulares = leads.filter(l => isCelular(l.telefone));
  celulares.sort(() => Math.random() - 0.5);

  console.log(`📊 ${leads.length} leads totais`);
  console.log(`📱 ${celulares.length} celulares`);
  console.log(`🏪 ${leads.length - celulares.length} fixos (pulando)\n`);

  console.log('🚀 Lançando Brave...');
  const browser = await puppeteer.launch({
    executablePath: BRAVE,
    userDataDir: PROFILE,
    headless: false,
    args: ['--no-sandbox', '--disable-blink-features=AutomationControlled'],
  });

  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36');

  console.log('📱 Abrindo WhatsApp Web...');
  await page.goto('https://web.whatsapp.com', { waitUntil: 'domcontentloaded', timeout: 60000 });

  console.log('⏳ Aguardando login...');
  try { await page.waitForSelector('#pane-side', { timeout: 60000 }); }
  catch {
    console.log('❌ WhatsApp não está logado. QR na tela pra escanear.');
    try { await page.waitForSelector('#pane-side', { timeout: 120000 }); }
    catch { console.log('❌ Login falhou'); await browser.close(); return; }
  }
  console.log('✅ WhatsApp Web logado!\n');

  // === CONFIG ===
  const MAX = Math.min(25, celulares.length);
  let sent = 0, errors = 0, skipped = 0;

  for (let i = 0; i < MAX; i++) {
    const lead = celulares[i];
    const first = primeiroNome(lead.nome);
    const phone = lead.telefone.replace(/\D/g, '');
    const niche = lead.nicho?.toLowerCase() || '';

    // Escolhe template
    const templates = TEMPLATES[niche] || TEMPLATES['default'];
    const msgFn = templates[Math.floor(Math.random() * templates.length)];
    const msg = msgFn(first, niche);

    console.log(`📤 [${i+1}/${MAX}] ${first} (${lead.nicho})...`);

    // Abre chat
    await page.goto(`https://web.whatsapp.com/send?phone=${phone}`, {
      waitUntil: 'domcontentloaded', timeout: 30000
    });
    await sleep(5000);

    // Verifica status
    const estado = await page.evaluate(() => {
      const input = document.querySelector('div[contenteditable="true"][spellcheck="true"]');
      if (input) return 'ok';
      if (document.body.innerText.includes('não está no WhatsApp') ||
          document.body.innerText.includes('not registered')) return 'nao_existe';
      return 'desconhecido';
    });

    if (estado === 'nao_existe') {
      console.log(`   ❌ Não está no WhatsApp`);
      skipped++;
      // Marca como inválido
      await supabase.from('crm_leads').update({ stage: 'Invalido' })
        .eq('id', lead.id);
      continue;
    }
    if (estado === 'desconhecido') {
      console.log(`   ❌ Página inesperada`);
      errors++;
      continue;
    }

    // Digita mensagem
    try {
      await page.evaluate((text) => {
        const div = document.querySelector('div[contenteditable="true"][spellcheck="true"]');
        if (!div) throw new Error('sem input');
        div.focus();
        div.innerText = '';
        document.execCommand('insertText', false, text);
      }, msg);
    } catch (e) {
      console.log(`   ❌ Erro ao digitar`);
      errors++;
      continue;
    }

    await sleep(2000);

    // Envia
    const clicou = await page.evaluate(() => {
      const btn = document.querySelector('button[data-testid="compose-btn-send"]')
               || document.querySelector('button[aria-label="Enviar"]')
               || document.querySelector('button[aria-label="Send"]');
      if (btn) { btn.click(); return true; }
      return false;
    });
    if (!clicou) await page.keyboard.press('Enter');

    sent++;
    console.log(`   ✅ ENVIADO (${sent}/${MAX})`);
    console.log(`   💬 ${msg.substring(0, 80)}...`);

    // Atualiza CRM
    await supabase.from('crm_leads').update({
      stage: 'Contactado',
      updated_at: new Date().toISOString(),
    }).eq('id', lead.id);

    if (sent >= MAX) break;

    // Delay inteligente — varia entre 45-120s, mais longo a cada 5 envios
    let delay = sent % 5 === 0 ? rand(90, 150) : rand(45, 100);
    console.log(`   ⏳ ${Math.round(delay)}s`);
    await sleep(delay * 1000);
  }

  console.log(`\n📊 RESULTADO FINAL`);
  console.log(`✅ Enviadas: ${sent}`);
  console.log(`❌ Erros: ${errors}`);
  console.log(`⏭️  Fora do WhatsApp: ${skipped}`);
  console.log(`🎯 Taxa de entrega: ${Math.round(sent/(sent+errors+skipped)*100)}%`);

  // Gera relatório no CRM
  await supabase.from('extraction_history').insert({
    user_id: uid,
    tipo: 'envio_whatsapp_v3',
    quantidade: sent,
    payload: { enviadas: sent, erros: errors, fora_whatsapp: skipped },
  });

  console.log(`\n🟢 Brave permanece aberto. Feche manualmente.`);
  await new Promise(() => {});
}

main().catch(e => {
  console.error('❌ ERRO:', e.message);
  process.exit(1);
});
