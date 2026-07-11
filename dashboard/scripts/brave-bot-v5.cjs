#!/usr/bin/env node
/**
 * 🦁 GeoLeads Brave Bot v5.1 — SEGURO + INTELIGENTE + VARREDURA FINAL
 *
 * v5 com proteção anti-bloco + smart scheduling + monitoramento 30min
 *
 * Regras:
 *   - Máx 10 envios/dia
 *   - Delay 5-15 min entre mensagens
 *   - Pausa de 2h a cada 5 envios
 *   - Só envia horário comercial (8h-20h)
 *   - Detecta bloqueio e pausa automaticamente
 *   - Monitora respostas por 30 min após cada envio
 *   - Auto-resposta se alguém responder
 *   - Varredura final: confere TODOS os leads enviados por respostas tardias
 *   - Nome real: extrai nome da pessoa (não nome do estabelecimento)
 *   - Paste via clipboard API (mais confiável que execCommand)
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

// === CONFIG ===
const CONFIG = {
  MAX_POR_DIA: 10,
  DELAY_MIN: 300,
  DELAY_MAX: 900,
  PAUSA_CADA: 5,
  PAUSA_DURACAO: 7200,
  HORARIO_INICIO: 8,
  HORARIO_FIM: 20,
  MONITORAR_POR: 1800000, // 30 min monitorando resposta
};

// === MENSAGENS (vendendo WhatsAI) ===
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
  salao: [
    (n) => `E aí ${n}! Tudo bem? Vi seu salão no Google. Já pensou em ter um robô que prospecta clientes no WhatsApp pra você? Chama WhatsAI — ele encontra pessoas interessadas e conversa por você. Quer ver?`,
    (n) => `Oi ${n}! Vi seu salão no Google. Tenho o WhatsAI, um sistema que aborda clientes no WhatsApp automaticamente pra divulgar seu trabalho. Topa conhecer?`,
  ],
  barbearia: [
    (n) => `Fala ${n}! Vi sua barbearia no Google. Meu sistema (WhatsAI) faz prospecção automática no WhatsApp, achando clientes e iniciando conversa por você. Quer dar uma olhada?`,
    (n) => `Eaí ${n}! Tudo certo? Tenho o WhatsAI, um robô que encontra clientes no WhatsApp e leva mais gente pra sua barbearia. Interessado?`,
  ],
  academia: [
    (n) => `Olá ${n}! Tudo bem? Vi sua academia no Google. Meu sistema (WhatsAI) prospecta alunos no WhatsApp automaticamente — encontra pessoas próximas e inicia a conversa. Quer ver como funciona?`,
  ],
  clinica: [
    (n) => `Olá ${n}! Tudo bem? Vi sua clínica no Google. Tenho um sistema (WhatsAI) que faz prospecção automática de pacientes no WhatsApp. Quer conhecer?`,
  ],
  pet: [
    (n) => `Olá ${n}! Tudo certo? Vi seu pet shop no Google. O WhatsAI é um sistema que aborda clientes no WhatsApp automaticamente pra divulgar seu pet shop. Quer saber como?`,
  ],
  imobiliaria: [
    (n) => `Olá ${n}! Tudo bem? Vi sua imobiliária no Google. Já pensou em ter um robô que prospecta clientes no WhatsApp pra você? O WhatsAI faz isso automaticamente. Quer conhecer?`,
  ],
  advocacia: [
    (n) => `Olá ${n}! Tudo bem? Vi seu escritório no Google. O WhatsAI é um sistema que encontra clientes no WhatsApp e inicia conversas automaticamente pra sua advocacia. Quer ver como?`,
  ],
  default: [
    (n, neg) => `Olá ${n}! Tudo bem? Vi seu ${neg} no Google. Trabalho com um sistema que encontra clientes e inicia conversas no WhatsApp automaticamente — chama WhatsAI. Topa conhecer?`,
    (n, neg) => `Oi ${n}! Vi seu ${neg} no Google. Meu sistema (WhatsAI) faz prospecção automática no WhatsApp: aborda clientes, faz apresentação, tudo sozinho. Quer dar uma olhada?`,
    (n, neg) => `Eaí ${n}! Seu ${neg} apareceu no Google. Conhece o WhatsAI? É um robô que aborda clientes no WhatsApp 24h e leva mais negócios pra você. Tem interesse?`,
  ],
};

const AUTO_REPLY = [
  `Que bom que respondeu! 🎯 Me chamo Diogo, sou de Foz. O WhatsAI é um sistema que encontra clientes no WhatsApp automaticamente e conversa por você — como se fosse um vendedor 24h. Já pensou em ter isso pro seu negócio?`,
  `Valeu pela resposta! 🚀 Resumindo: o WhatsAI escaneia o Google, encontra clientes perto do seu negócio e manda mensagem no WhatsApp deles automaticamente. Sem você levantar um dedo. Quer ver uma demonstração?`,
  `Fala aí! 😄 O WhatsAI é tipo um vendedor automático: ele encontra leads, manda mensagem personalizada e responde quem interage — tudo 24h. Já pensou em quantos clientes você perde sem isso?`,
];

// === NOMES REAIS ===
// Filtra palavras que são tipo de negócio, não nome de pessoa
const ignoraPrimeiroNome = [
  'dom','dona','dr','dra','super','mega','top','la','o','a','bb','mr','mrs',
  'restaurante','pizzaria','mercado','padaria','salao','barbearia','academia',
  'advocacia','pet','imobiliaria','clinica','oficina','lanchonete',
  'conveniencia','mercearia','acougue','farmacia','drogaria','loja','butique',
  'atelier','studio','espaco','centro','hospital','laboratorio','escola',
  'colegio','auto','mecanica','borracharia','hotel','pousada','motel',
  'igreja','templo','associacao','sindicato','gremio','fundacao',
  'food','bar','pub','cafe','bistro','churrascaria','pastelaria',
  'distribuidora','transportadora','logistica','construtora','incorporadora',
  'engenharia','arquitetura','consultoria','assessoria','contabilidade',
  'escritorio','cabelereiro','manicure','depilacao',
  'estetica','massagem','pilates','crossfit','funcional','lutas','jiu-jitsu',
  'sistema','tec','tech','digital','online','web','solution','solucoes',
  'servicos','produtos','artigos','equipamentos','materiais','pecas',
  'the','restaurant','pizza','market','bakery','shop','store','salon',
  'barber','gym','clinic','pet','hotel','inn','center','club','house',
  'studio','school','auto','service','solutions','group',
];

function primeiroNome(nome) {
  if (!nome) return 'Lead';
  const p = nome.split(/[\s,]+/);
  // Tenta achar o primeiro nome próprio (>= 3 chars, não é tipo de negócio)
  for (const w of p) {
    const limpo = w.replace(/[^a-zA-Zà-úÀ-Ú0-9]/g, '');
    if (limpo.length >= 3 &&
        !ignoraPrimeiroNome.includes(limpo.toLowerCase()) &&
        isNaN(limpo)) return limpo.charAt(0).toUpperCase() + limpo.slice(1).toLowerCase();
  }
  // Fallback: primeiro pedaço do nome
  const fallback = p[0].replace(/[^a-zA-Zà-úÀ-Ú0-9]/g, '');
  return fallback || 'Lead';
}

function isCelular(t) { return (t||'').replace(/\D/g,'').length >= 13; }
function rand(m, M) { return m + Math.random() * (M - m); }
const sleep = ms => new Promise(r => setTimeout(r, ms));

// Espera se não for horário comercial
async function esperarHorario() {
  while (true) {
    const h = new Date().getHours();
    if (h >= CONFIG.HORARIO_INICIO && h < CONFIG.HORARIO_FIM) return;
    console.log(`⏰ Horário: ${h}h. Fora do expediente (${CONFIG.HORARIO_INICIO}h-${CONFIG.HORARIO_FIM}h). Aguardando...`);
    await sleep(600000); // verifica a cada 10 min
  }
}

// Detecta se foi bloqueado
async function detectarBloqueio(page) {
  const texto = await page.evaluate(() => document.body.innerText);
  const bloqueios = [
    'tentando', 'muitas', 'muitas tentativas', 'limite', 'spam',
    'bloqueada', 'bloqueado', 'nao e possivel', 'try again', 'too many',
    'temporariamente', 'aguarde', 'later',
  ];
  for (const b of bloqueios) {
    if (texto.toLowerCase().includes(b)) return true;
  }
  return false;
}

// Cola texto no input do WhatsApp (clipboard API é mais confiável)
async function colarTexto(page, text) {
  return await page.evaluate((txt) => {
    const div = document.querySelector('div[contenteditable="true"][spellcheck="true"]');
    if (!div) return false;
    div.focus();
    try {
      // Clipboard API
      const dt = new DataTransfer();
      dt.setData('text/plain', txt);
      div.dispatchEvent(new ClipboardEvent('paste', {
        clipboardData: dt, bubbles: true, cancelable: true
      }));
      return true;
    } catch {
      div.innerText = '';
      document.execCommand('insertText', false, txt);
      return true;
    }
  }, text);
}

// Clica no botão de enviar
async function clicarEnviar(page) {
  return await page.evaluate(() => {
    const b = document.querySelector('button[data-testid="compose-btn-send"]')
           || document.querySelector('button[aria-label="Enviar"]')
           || document.querySelector('button[aria-label="Send"]');
    if (b) { b.click(); return true; }
    return false;
  });
}

// Monitora respostas por X minutos - conta mensagens recebidas NOVAS
async function monitorarResposta(page, lead, timeoutMs = CONFIG.MONITORAR_POR) {
  const inicio = Date.now();
  let jaRespondeu = false;

  // Conta mensagens recebidas EXISTENTES antes do monitoramento
  const msgCountBefore = await page.evaluate(() =>
    document.querySelectorAll('div.message-in').length
  );

  while (Date.now() - inicio < timeoutMs) {
    // Verifica bloqueio
    if (await detectarBloqueio(page)) {
      console.log('   🚫 BLOQUEIO DETECTADO! Pausando...');
      return 'bloqueio';
    }

    // Verifica NOVAS mensagens
    const msgCountNow = await page.evaluate(() =>
      document.querySelectorAll('div.message-in').length
    );
    const novasMsgs = msgCountNow - msgCountBefore;

    if (novasMsgs > 0 && !jaRespondeu) {
      jaRespondeu = true;

      // Pega texto da última mensagem recebida
      const reply = await page.evaluate(() => {
        const incoming = document.querySelectorAll('div.message-in');
        const lastMsg = incoming[incoming.length - 1];
        const textEl = lastMsg.querySelector('span.selectable-text, div.copyable-text');
        return textEl ? textEl.textContent.trim() : 'sim';
      });

      const auto = AUTO_REPLY[Math.floor(Math.random() * AUTO_REPLY.length)];
      console.log(`   💬 RESPOSTA: "${(reply||'').substring(0, 80)}"`);
      console.log('   🤖 Respondendo...');

      await sleep(rand(3000, 6000));
      await colarTexto(page, auto);
      await sleep(1500);

      const enviou = await clicarEnviar(page);
      if (!enviou) await page.keyboard.press('Enter');

      console.log('   ✅ Auto-resposta enviada');

      // Marca no CRM e salva a resposta
      await supabase.from('crm_leads').update({
        stage: 'Respondeu',
        updated_at: new Date().toISOString(),
      }).eq('id', lead.id);

      return 'respondeu';
    }

    await sleep(8000); // checa a cada 8s
  }
  return 'timeout';
}

// ⭐ Varredura final: confere TODOS os leads enviados por respostas tardias
async function varreduraFinal(page, leadsEnviados) {
  console.log(`\n🔍 Varredura final: verificando ${leadsEnviados.length} leads...`);

  for (const lead of leadsEnviados) {
    const phone = lead.telefone.replace(/\D/g, '');
    try {
      await page.goto(`https://web.whatsapp.com/send?phone=${phone}`,
        { waitUntil: 'domcontentloaded', timeout: 30000 });
      await sleep(4000);

      const info = await page.evaluate(() => {
        const incoming = document.querySelectorAll('div.message-in');
        const texts = [];
        for (const msg of incoming) {
          const el = msg.querySelector('span.selectable-text, div.copyable-text');
          if (el) texts.push(el.textContent.trim());
        }
        return { total: incoming.length, lastTexts: texts.slice(-3) };
      });

      if (info.total > 0) {
        console.log(`   💬 ${lead.nome}: ${info.total} msgs recebidas`);
        if (info.lastTexts.length > 0) {
          console.log(`      Última: "${info.lastTexts[info.lastTexts.length-1].substring(0, 80)}"`);
        }

        await supabase.from('crm_leads').update({
          stage: 'Respondeu',
          updated_at: new Date().toISOString(),
        }).eq('id', lead.id);
      }
    } catch (e) {
      console.log(`   ❌ Erro ao verificar ${lead.nome}: ${e.message}`);
    }
  }
  console.log('✅ Varredura final concluída!\n');
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

  if (!leads?.length) { console.log('❌ sem leads novos'); return; }

  let celulares = leads.filter(l => isCelular(l.telefone));
  celulares.sort(() => Math.random() - 0.5);

  console.log(`📊 ${leads.length} totais, ${celulares.length} celulares`);
  console.log(`⚙️  Máx ${CONFIG.MAX_POR_DIA}/dia | Delay ${CONFIG.DELAY_MIN/60}-${CONFIG.DELAY_MAX/60} min\n`);

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

  let enviadas = 0, responderam = 0, erros = 0, fora = 0;
  const MAX = Math.min(CONFIG.MAX_POR_DIA, celulares.length);
  const leadsEnviados = [];

  for (let i = 0; i < MAX; i++) {
    // Espera horário comercial
    await esperarHorario();

    const lead = celulares[i];
    const first = primeiroNome(lead.nome);
    const phone = lead.telefone.replace(/\D/g, '');
    const niche = (lead.nicho || '').toLowerCase();

    const tpls = TEMPLATES[niche] || TEMPLATES.default;
    const msg = tpls[Math.floor(Math.random() * tpls.length)](first, niche);

    console.log(`📤 [${i+1}/${MAX}] ${first} (${niche})...`);

    await page.goto(`https://web.whatsapp.com/send?phone=${phone}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(5000);

    const estado = await page.evaluate(() => {
      const input = document.querySelector('div[contenteditable="true"][spellcheck="true"]');
      if (input) return 'ok';
      if (document.body.innerText.includes('nao esta no WhatsApp') ||
          document.body.innerText.includes('not registered')) return 'nao';
      return 'desconhecido';
    });

    if (estado === 'nao') {
      console.log('   ❌ Fora do WhatsApp');
      fora++;
      await supabase.from('crm_leads').update({ stage: 'Invalido' }).eq('id', lead.id);
      continue;
    }
    if (estado === 'desconhecido') {
      console.log('   ❌ Página inesperada');
      erros++;
      continue;
    }

    // Envia mensagem
    const digitou = await colarTexto(page, msg);
    if (!digitou) {
      console.log('   ❌ Erro ao digitar');
      erros++;
      continue;
    }
    await sleep(2000);

    const clicou = await clicarEnviar(page);
    if (!clicou) await page.keyboard.press('Enter');

    enviadas++;
    leadsEnviados.push(lead);
    await supabase.from('crm_leads').update({
      stage: 'Contactado',
      updated_at: new Date().toISOString(),
    }).eq('id', lead.id);

    // Monitora resposta (30 min)
    console.log(`   ✅ Enviada. Monitorando ${CONFIG.MONITORAR_POR/60000} min...`);
    const resultado = await monitorarResposta(page, lead);

    if (resultado === 'respondeu') {
      responderam++;
      console.log(`   🎯 ${first} RESPONDEU!`);
    } else if (resultado === 'bloqueio') {
      console.log('   🚫 Bloqueio detectado. Parando envios.');
      break;
    } else {
      console.log(`   ⏰ ${first} não respondeu`);
    }

    if (enviadas >= MAX) break;

    // Delay adaptável
    let delay;
    if (enviadas > 0 && enviadas % CONFIG.PAUSA_CADA === 0) {
      delay = CONFIG.PAUSA_DURACAO;
      console.log(`   🛑 Pausa longa de ${delay/3600}h`);
    } else {
      delay = rand(CONFIG.DELAY_MIN, CONFIG.DELAY_MAX);
      console.log(`   ⏳ ${Math.round(delay/60)} min`);
    }
    await sleep(delay * 1000);
  }

  // ⭐ Varredura final em todos os leads enviados
  if (leadsEnviados.length > 0) {
    await varreduraFinal(page, leadsEnviados);
  }

  console.log(`\n📊 RESULTADO FINAL v5.1`);
  console.log(`✅ Enviadas: ${enviadas}`);
  console.log(`🎯 Responderam: ${responderam}`);
  console.log(`❌ Erros: ${erros}`);
  console.log(`⏭️  Fora do WhatsApp: ${fora}`);

  if (enviadas > 0) {
    console.log(`📈 Taxa de resposta: ${Math.round(responderam/enviadas*100)}%`);
    // Salva histórico
    await supabase.from('extraction_history').insert({
      user_id: uid,
      tipo: 'envio_whatsapp_v5',
      quantidade: enviadas,
      payload: { enviadas, responderam, erros, fora_whatsapp: fora },
    }).maybeSingle();
  }

  console.log(`\n🟢 Brave aberto. Feche manualmente.`);
  await new Promise(() => {});
}

main().catch(e => {
  console.error('❌', e.message);
  process.exit(1);
});
