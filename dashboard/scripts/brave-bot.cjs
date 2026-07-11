#!/usr/bin/env node
/**
 * 🦁 GeoLeads Brave Bot v2
 * Abre Brave com Puppeteer, conecta no WhatsApp Web e envia msgs
 * Usa input field e Enter em vez de botão
 */

'use strict';
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.local') });

const puppeteer = require('puppeteer-core');
const path = require('path');

const BRAVE = 'C:/Users/Admin/AppData/Local/BraveSoftware/Brave-Browser/Application/brave.exe';
const PROFILE = 'C:/Users/Admin/AppData/Local/BraveSoftware/Brave-Browser/User Data';

const LEADS = [
  { nome: 'Luigia Pizzeria Napoletana', tel: '5545984223212', neg: 'pizzaria' },
  { nome: 'Pizzaria Martignoni Foz', tel: '554535734886', neg: 'pizzaria' },
  { nome: 'Vô Luiz Pizzeria e Cucina', tel: '554530281209', neg: 'pizzaria' },
  { nome: 'Bel Viale', tel: '554530296005', neg: 'pizzaria' },
  { nome: 'Quinta da Oliva', tel: '554535723131', neg: 'pizzaria' },
  { nome: 'Império Pizzaria', tel: '554530272800', neg: 'pizzaria' },
  { nome: 'Pizza di Bocca', tel: '5545991033399', neg: 'pizzaria' },
  { nome: 'Dom Garcia Pizzaria', tel: '5545999529010', neg: 'pizzaria' },
  { nome: 'Jurassic Pizza', tel: '554535256904', neg: 'pizzaria' },
  { nome: 'La Caprese Pizzaria', tel: '5545999637067', neg: 'pizzaria' },
  { nome: 'Pizzaria do Onofre', tel: '554535261683', neg: 'pizzaria' },
  { nome: 'Mega Pizza', tel: '554535741060', neg: 'pizzaria' },
  { nome: 'Pizza Peroni Delivery', tel: '554530291920', neg: 'pizzaria' },
  { nome: 'Mega Pizza Rep. Argentina', tel: '554535251020', neg: 'pizzaria' },
  { nome: 'Top Pizza Portal da Foz', tel: '554599935879', neg: 'pizzaria' },
  { nome: 'Churrascaria Tropicana', tel: '554530312672', neg: 'restaurante' },
  { nome: 'Bendito Bar Restaurante', tel: '554530297373', neg: 'restaurante' },
  { nome: 'TropCalia Restaurante', tel: '554599980120', neg: 'restaurante' },
  { nome: 'Restaurante Barracão', tel: '554530273445', neg: 'restaurante' },
  { nome: 'La Toscana Foz', tel: '5545991446805', neg: 'restaurante' },
  { nome: 'La Mafia Trattoria', tel: '55459841194', neg: 'restaurante' },
  { nome: 'Baru Gastronomia', tel: '5545991125003', neg: 'restaurante' },
  { nome: 'Capitão Bar Restaurante', tel: '5545999620400', neg: 'restaurante' },
  { nome: 'Di Paolo Foz', tel: '5545991231252', neg: 'restaurante' },
  { nome: '4 Sorelle', tel: '5545999847886', neg: 'restaurante' },
  { nome: 'Paris 6 Bistrô', tel: '5545998144730', neg: 'restaurante' },
  { nome: 'Empório com Arte', tel: '554535724240', neg: 'restaurante' },
  { nome: 'Santo Cupim', tel: '5545998416897', neg: 'restaurante' },
  { nome: 'Super Muffato Portinari', tel: '554535222836', neg: 'mercado' },
  { nome: 'Super Muffato Boicy', tel: '554535740429', neg: 'mercado' },
];

const MSGS = [
  (n, neg) => `Olá ${n}! Tudo bem? Vi seu ${neg} no Google. Tenho uma solução que atrai mais clientes em Foz. Topa dar uma olhada?`,
  (n, neg) => `Oi ${n}! Seu ${neg} apareceu aqui. Tenho uma parceria que pode trazer mais clientes. Bate um papo?`,
  (n, neg) => `Eaí ${n}! Tudo joia? Tenho uma oportunidade de divulgação gratuita pro seu ${neg}. Tem interesse?`,
];

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
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

  // Aguarda login (sidebar)
  console.log('⏳ Aguardando login...');
  try {
    await page.waitForSelector('#pane-side', { timeout: 60000 });
  } catch {
    console.log('❌ WhatsApp Web não está logado. QR na tela — escaneie.');
    try { await page.waitForSelector('#pane-side', { timeout: 120000 }); }
    catch { console.log('❌ Login não detectado.'); await browser.close(); return; }
  }
  console.log('✅ WhatsApp Web logado!\n');

  const MAX = 25;
  let sent = 0;

  for (const lead of LEADS) {
    if (sent >= MAX) { console.log('🚫 Limite diário'); break; }

    const msg = MSGS[Math.floor(Math.random() * MSGS.length)](lead.nome, lead.neg);
    
    console.log(`📤 ${lead.nome} (${lead.tel})...`);

    // Abre chat com o número
    await page.goto(`https://web.whatsapp.com/send?phone=${lead.tel}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(5000);

    // Procura input de mensagem OU mensagem de "não está no WhatsApp"
    const inputExists = await page.evaluate(() => {
      // WhatsApp Web input field
      const div = document.querySelector('div[contenteditable="true"][spellcheck="true"]');
      if (div) return 'ok';
      // Number not on WhatsApp
      const blocked = document.querySelector('canvas') || document.querySelector('div[data-testid="conversation-info"]');
      if (document.body.innerText.includes('não está no WhatsApp') || document.body.innerText.includes('not registered')) return 'nao_existe';
      // Couldn't detect
      return 'desconhecido';
    });

    if (inputExists === 'nao_existe') {
      console.log(`❌ ${lead.nome} — número não está no WhatsApp`);
      continue;
    }
    if (inputExists === 'desconhecido') {
      console.log(`❌ ${lead.nome} — página inesperada, pulando`);
      continue;
    }

    // Digita a mensagem
    try {
      await page.evaluate((text) => {
        const div = document.querySelector('div[contenteditable="true"][spellcheck="true"]');
        if (!div) throw new Error('input not found');
        div.focus();
        div.innerText = '';
        document.execCommand('insertText', false, text);
      }, msg);
    } catch (e) {
      console.log(`❌ ${lead.nome} — erro ao digitar`);
      continue;
    }

    await sleep(2000);

    // Tenta clicar no botão de enviar, ou Enter
    const sent_ok = await page.evaluate(() => {
      const btn = document.querySelector('button[data-testid="compose-btn-send"]') 
               || document.querySelector('button[aria-label="Enviar"]')
               || document.querySelector('span[data-testid="send"]')
               || document.querySelector('button[aria-label="Send"]');
      if (btn) { btn.click(); return true; }
      return false;
    });

    if (!sent_ok) {
      // Enter como fallback
      await page.keyboard.press('Enter');
    }

    sent++;
    console.log(`✅ ${lead.nome} (${sent}/${MAX})`);

    if (sent >= MAX) break;

    // Delay 1-2 min
    const d = 60000 + Math.random() * 60000;
    console.log(`⏳ Próxima em ${Math.round(d/1000)}s\n`);
    await sleep(d);
  }

  console.log(`\n📊 FINALIZADO: ${sent} mensagens enviadas! Tudo rodando no Brave 🚀`);
  console.log('🟢 Brave permanece aberto. Feche manualmente quando quiser.');
  await new Promise(() => {});
}

main().catch(e => {
  console.error('❌ ERRO:', e.message);
  process.exit(1);
});
