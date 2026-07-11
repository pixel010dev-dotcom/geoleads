#!/usr/bin/env node
/**
 * 🦁 GeoLeads Brave Bot v4 — VENDAS INTELIGENTES
 *
 * v3 + MONITORAMENTO DE RESPOSTAS + AUTO-REPLY
 *
 * Fluxo pra cada lead:
 *   1) Envia mensagem vendendo WhatsAI
 *   2) Monitora respostas por até 5 min
 *   3) Se responder → auto-resposta + CRM "Respondeu"
 *   4) Se não responder → CRM "Contactado"
 *   5) Delay inteligente e próximo lead
 */

'use strict';
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.local') });

const puppeteer = require('puppeteer-core');
const { createClient } = require('@supabase/supabase-js');

const BRAVE = 'C:/Users/Admin/AppData/Local/BraveSoftware/Brave-Browser/Application/brave.exe';
const PROFILE = 'C:/Users/Admin/AppData/Local/BraveSoftware/Brave-Browser/User Data';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// === MENSAGENS VENDENDO WHATSAI (POR NICHO) ===
const TEMPLATES = {
  restaurante: [
    (n) => `Olá ${n}! Tudo bem? Vi seu restaurante no Google. Trabalho com um sistema que encontra clientes no WhatsApp e manda ofertas pro seu negócio automaticamente. Chama WhatsAI. Já ouviu falar?`,
    (n) => `Oi ${n}! Vi seu restaurante no Google. Tenho um sistema (WhatsAI) que faz prospecção automática no WhatsApp — ele encontra clientes e conversa por você. Quer ver como funciona?`,
  ],
  pizzaria: [
    (n) => `Eaí ${n}! Tudo certo? Vi sua pizzaria no Google. Conhece o WhatsAI? É um sistema que aborda clientes no WhatsApp automaticamente e leva pedidos pro seu negócio. Quer dar uma olhada?`,
    (n) => `Olá ${n}! Tudo bem? Tenho uma ferramenta chamada WhatsAI que faz todo o trabalho de prospecção no WhatsApp pra sua pizzaria — encontra clientes e inicia a conversa. Topa conhecer?`,
  ],
  mercado: [
    (n) => `Olá ${n}! Tudo joia? Vi seu mercado no Google. Meu sistema (WhatsAI) encontra clientes e manda mensagens no WhatsApp automaticamente divulgando seu mercado. Quer ver como?`,
    (n) => `Oi ${n}! Trabalho com um sistema que faz prospecção automática no WhatsApp pra mercados. Ele encontra clientes e conversa por você. Se chama WhatsAI. Bate um papo?`,
  ],
  padaria: [
    (n) => `Bom dia ${n}! Tudo certo? Vi sua padaria no Google. Conhece o WhatsAI? Um robô que entra em contato com clientes no WhatsApp automaticamente e leva mais gente até você. Interessado?`,
    (n) => `Olá ${n}! Sua padaria apareceu no Google. Tenho um sistema (WhatsAI) que prospecta clientes no WhatsApp 24h por dia. Quer saber como ele funciona?`,
  ],
  default: [
    (n, neg) => `Olá ${n}! Tudo bem? Vi seu ${neg} no Google. Trabalho com um sistema que encontra clientes e inicia conversas no WhatsApp automaticamente — chama WhatsAI. Topa conhecer?`,
    (n, neg) => `Oi ${n}! Vi seu ${neg} no Google. Meu sistema (WhatsAI) faz prospecção automática no WhatsApp: aborda clientes, faz apresentação, tudo sozinho. Quer dar uma olhada?`,
    (n, neg) => `Eaí ${n}! Seu ${neg} apareceu no Google. Conhece o WhatsAI? É um robô que aborda clientes no WhatsApp 24h e leva mais negócios pra você. Tem interesse?`,
  ],
};

// === AUTO-RESPOSTAS (quando o lead responde) ===
const AUTO_REPLY = [
  `Que bom que respondeu! 🎯 Me chamo Diogo, sou de Foz. O WhatsAI é um sistema que encontra clientes no WhatsApp automaticamente e conversa por você — como se fosse um vendedor 24h. Já pensou em ter isso pro seu negócio?`,
  `Valeu pela resposta! 🚀 Resumindo: o WhatsAI escaneia o Google, encontra clientes perto do seu negócio e manda mensagem no WhatsApp deles automaticamente. Sem você levantar um dedo. Quer ver uma demonstração?`,
  `Fala aí! 😄 O WhatsAI é tipo um vendedor automático: ele encontra leads, manda mensagem personalizada e responde quem interage — tudo 24h. Já pensou em quantos clientes você perde sem isso?`,
];

// === UTILITÁRIOS ===
function primeiroNome(nome) {
  const p = nome.split(/\s+/);
  const ignorar = ['dom','dona','dr','dra','super','mega','top','la','o','a','bb','mr','mrs'];
  for (const w of p) {
    const limpo = w.replace(/[^a-zA-Zà-úÀ-Ú0-9]/g, '');
    if (limpo.length >= 3 && !ignorar.includes(limpo.toLowerCase()) && isNaN(limpo)) return limpo;
  }
  return p[0] || nome;
}

function isCelular(t) { return (t||'').replace(/\D/g,'').length >= 13; }
function rand(m, M) { return m + Math.random() * (M - m); }
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function esperar(page, sel, t = 30000) {
  try { await page.waitForSelector(sel, { timeout: t }); return true; }
  catch { return false; }
}

// === MONITORAMENTO DE RESPOSTAS ===
// Fica na conversa esperando o lead responder.
// Retorna true se detectou resposta e respondeu.
async function monitorarResposta(page, lead, timeoutMs = 300000) {
  const inicio = Date.now();
  const checkInterval = 5000; // verifica a cada 5s
  let jaRespondeu = false;

  while (Date.now() - inicio < timeoutMs) {
    // Verifica se apareceu mensagem incoming
    const reply = await page.evaluate(() => {
      // message-in = mensagem recebida
      // Se alguma mensagem incoming apareceu DEPOIS da nossa última verificação...
      const incoming = document.querySelectorAll('div.message-in, div[data-testid="conversation-info"]');
      if (incoming.length > 0) {
        // Pega o texto da última mensagem
        const lastMsg = incoming[incoming.length - 1];
        const textEl = lastMsg.querySelector('span.selectable-text, div.copyable-text');
        return textEl ? textEl.textContent.trim() : 'sim';
      }
      return null;
    });

    if (reply && !jaRespondeu) {
      jaRespondeu = true;
      const auto = AUTO_REPLY[Math.floor(Math.random() * AUTO_REPLY.length)];
      console.log(`   💬 RESPOSTA DETECTADA: "${reply.substring(0, 60)}..."`);
      console.log(`   🤖 Respondendo automaticamente...`);

      // Espera um pouco pra simular leitura
      await sleep(rand(3000, 6000));

      // Digita auto-resposta
      const wrote = await page.evaluate((text) => {
        const div = document.querySelector('div[contenteditable="true"][spellcheck="true"]');
        if (!div) return false;
        div.focus();
        div.innerText = '';
        document.execCommand('insertText', false, text);
        return true;
      }, auto);

      if (wrote) {
        await sleep(1500);
        const clicou = await page.evaluate(() => {
          const b = document.querySelector('button[data-testid="compose-btn-send"]')
                 || document.querySelector('button[aria-label="Enviar"]')
                 || document.querySelector('button[aria-label="Send"]');
          if (b) { b.click(); return true; }
          return false;
        });
        if (!clicou) await page.keyboard.press('Enter');

        console.log(`   ✅ AUTO-RESPOSTA ENVIADA`);
      }

      // Marca no CRM que respondeu
      await supabase.from('crm_leads').update({
        stage: 'Respondeu',
        updated_at: new Date().toISOString(),
      }).eq('id', lead.id);

      return true; // respondeu
    }

    await sleep(checkInterval);
  }

  return false; // não respondeu no tempo
}

// === MAIN ===
async function main() {
  console.log('🔍 Buscando leads...');

  const { data: users } = await supabase.auth.admin.listUsers();
  const uid = users?.users?.find(u => u.email === 'pixel010dev@gmail.com')?.id;
  if (!uid) { console.log('❌ sem uid'); return; }

  const { data: leads } = await supabase
    .from('crm_leads')
    .select('id, nome, telefone, nicho')
    .eq('user_id', uid)
    .eq('stage', 'Novo');

  if (!leads?.length) { console.log('❌ sem leads'); return; }

  let celulares = leads.filter(l => isCelular(l.telefone));
  celulares.sort(() => Math.random() - 0.5);

  console.log(`📊 ${leads.length} totais, ${celulares.length} celulares, ${leads.length - celulares.length} fixos\n`);

  console.log('🚀 Lançando Brave...');
  const browser = await puppeteer.launch({
    executablePath: BRAVE,
    userDataDir: PROFILE,
    headless: false,
    args: ['--no-sandbox', '--disable-blink-features=AutomationControlled'],
  });

  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36');

  console.log('📱 WhatsApp Web...');
  await page.goto('https://web.whatsapp.com', { waitUntil: 'domcontentloaded', timeout: 60000 });
  console.log('⏳ Login...');
  try { await page.waitForSelector('#pane-side', { timeout: 60000 }); }
  catch {
    console.log('❌ QR na tela');
    try { await page.waitForSelector('#pane-side', { timeout: 120000 }); }
    catch { console.log('❌ Login falhou'); await browser.close(); return; }
  }
  console.log('✅ Logado!\n');

  // === CONFIG ===
  const MAX = Math.min(25, celulares.length);
  let enviadas = 0, responderam = 0, erros = 0, fora = 0;

  for (let i = 0; i < Math.min(MAX, celulares.length); i++) {
    const lead = celulares[i];
    const first = primeiroNome(lead.nome);
    const phone = lead.telefone.replace(/\D/g, '');
    const niche = (lead.nicho || '').toLowerCase();

    const tpls = TEMPLATES[niche] || TEMPLATES.default;
    const msg = tpls[Math.floor(Math.random() * tpls.length)](first, niche);

    console.log(`📤 [${i+1}/${MAX}] ${first} (${niche})...`);

    await page.goto(`https://web.whatsapp.com/send?phone=${phone}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(5000);

    // Verifica se número existe
    const estado = await page.evaluate(() => {
      const input = document.querySelector('div[contenteditable="true"][spellcheck="true"]');
      if (input) return 'ok';
      if (document.body.innerText.includes('não está no WhatsApp') || document.body.innerText.includes('not registered')) return 'nao';
      return 'desconhecido';
    });

    if (estado === 'nao') {
      console.log(`   ❌ Fora do WhatsApp`);
      fora++;
      await supabase.from('crm_leads').update({ stage: 'Invalido' }).eq('id', lead.id);
      continue;
    }
    if (estado === 'desconhecido') {
      console.log(`   ❝ Página inesperada`);
      erros++;
      continue;
    }

    // Digita
    try {
      await page.evaluate((text) => {
        const div = document.querySelector('div[contenteditable="true"][spellcheck="true"]');
        if (!div) throw Error('no input');
        div.focus();
        div.innerText = '';
        document.execCommand('insertText', false, text);
      }, msg);
    } catch {
      console.log(`   ❌ Erro ao digitar`);
      erros++;
      continue;
    }

    await sleep(2000);

    // Envia
    const clicou = await page.evaluate(() => {
      const b = document.querySelector('button[data-testid="compose-btn-send"]')
             || document.querySelector('button[aria-label="Enviar"]')
             || document.querySelector('button[aria-label="Send"]');
      if (b) { b.click(); return true; }
      return false;
    });
    if (!clicou) await page.keyboard.press('Enter');

    enviadas++;

    // Marca como Contactado (provisório)
    await supabase.from('crm_leads').update({
      stage: 'Contactado',
      updated_at: new Date().toISOString(),
    }).eq('id', lead.id);

    // MONITORA RESPOSTA por até 5 min
    console.log(`   ✅ Enviada. Monitorando resposta (até 5 min)...`);
    const respondeu = await monitorarResposta(page, lead, 300000);

    if (respondeu) {
      responderam++;
      console.log(`   🎯 ${first} RESPONDEU!`);
    } else {
      console.log(`   ⏰ ${first} não respondeu (timeout 5 min)`);
    }

    if (enviadas >= MAX) break;

    // Delay
    const delay = enviadas % 3 === 0 ? rand(90, 150) : rand(45, 90);
    console.log(`   ⏳ ${Math.round(delay)}s\n`);
    await sleep(delay * 1000);
  }

  console.log(`\n📊 RESULTADO FINAL v4`);
  console.log(`✅ Enviadas: ${enviadas}`);
  console.log(`🎯 Responderam: ${responderam}`);
  console.log(`❌ Erros: ${erros}`);
  console.log(`⏭️  Fora do WhatsApp: ${fora}`);

  if (enviadas > 0) {
    console.log(`📈 Taxa de resposta: ${Math.round(responderam/enviadas*100)}%`);
  }

  // Relatório no banco
  await supabase.from('extraction_history').insert({
    user_id: uid,
    tipo: 'envio_whatsapp_v4',
    quantidade: enviadas,
    payload: { enviadas, responderam, erros, fora_whatsapp: fora },
  });

  console.log(`\n🟢 Brave aberto. Feche manualmente.`);
  await new Promise(() => {});
}

main().catch(e => {
  console.error('❌', e.message);
  process.exit(1);
});
