// ===== GeoLeads Sales Bot — RODE NO CONSOLE DO WHATSAPP WEB =====
// 1. Abra web.whatsapp.com no Brave (já deve estar logado)
// 2. Pressione F12 > Console
// 3. Cole este código e pressione Enter
// O bot vai começar a enviar mensagens automaticamente
//
// Para PARAR: digite stopBot() no console

(async () => {
  if (window.__geoBotRunning) return alert('Bot já rodando!');
  window.__geoBotRunning = true;

  const BOT = {
    delayMin: 60000,  // 1 min entre msgs
    delayMax: 120000, // 2 min
    maxDaily: 25,
    sent: 0,
    leads: [
      // Leads serão carregados automaticamente
    ],
    active: true,
  };

  // =========== UTILITÁRIOS ===========
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const randDelay = () => BOT.delayMin + Math.random() * (BOT.delayMax - BOT.delayMin);

  function waitEl(selector, timeout = 15000) {
    return new Promise((resolve, reject) => {
      const el = document.querySelector(selector);
      if (el) return resolve(el);
      const obs = new MutationObserver(() => {
        const e = document.querySelector(selector);
        if (e) { obs.disconnect(); resolve(e); }
      });
      obs.observe(document.body, { childList: true, subtree: true });
      setTimeout(() => { obs.disconnect(); reject(new Error(`Timeout: ${selector}`)); }, timeout);
    });
  }

  // =========== ENVIAR MENSAGEM ===========
  async function sendMessage(phone, text) {
    try {
      // Abre conversa
      window.open(`https://web.whatsapp.com/send?phone=${phone}`, '_blank');
      await sleep(3000);
      
      // Volta pra aba original e espera campo de texto
      const input = await waitEl('div[contenteditable="true"][spellcheck="true"]', 10000);
      if (!input) return false;
      
      // Digita e envia
      input.focus();
      document.execCommand('insertText', false, text);
      await sleep(1500);
      
      const sendBtn = document.querySelector('button[data-testid="compose-btn-send"]') || 
                      document.querySelector('button[aria-label="Enviar"]');
      if (sendBtn) sendBtn.click();
      else {
        const enter = new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true });
        input.dispatchEvent(enter);
      }
      
      return true;
    } catch (err) {
      console.error('❌ Erro ao enviar:', err.message);
      return false;
    }
  }

  // =========== MENSAGENS POR NEGÓCIO ===========
  function getMessage(nome, negocio, cidade) {
    const msgs = [
      `Olá ${nome}! Tudo bem? Vi seu ${negocio} no Google. Tenho uma solução que atrai mais clientes em ${cidade}. Topa dar uma olhada?`,
      `Oi ${nome}, tudo certo? Sou de uma plataforma que ajuda ${negocio}s em ${cidade} a conseguir mais clientes pelo Google. Posso te mostrar?`,
      `Fala ${nome}! Seu ${negocio} apareceu aqui nas pesquisas. Tenho uma parceria que pode trazer mais clientes pra você em ${cidade}. Bate um papo?`,
      `Eaí ${nome}! Tudo joia? Vi que você tem um ${negocio} em ${cidade} e tenho uma oportunidade de divulgação gratuita. Tem interesse?`,
    ];
    return msgs[Math.floor(Math.random() * msgs.length)];
  }

  // =========== CARREGAR LEADS DO CRM ===========
  // Se não tiver conexão com o backend, usa leads de exemplo
  // ou cole seus leads no lugar

  // Cole aqui seus leads no formato:
  // { nome: 'João', telefone: '5511999999999', negocio: 'pizzaria', cidade: 'São Paulo' }
  // OU deixe vazio que o bot vai usar os de exemplo

  BOT.leads = [
    { nome: 'Teste', telefone: '554598566730', negocio: 'teste', cidade: 'teste' },
    // ADICIONE SEUS LEADS AQUI, exemplo:
    // { nome: 'João', telefone: '5511999999999', negocio: 'pizzaria', cidade: 'São Paulo' },
  ];

  // =========== EXECUTAR ===========
  console.log(`🤖 GeoLeads Bot iniciado!`);
  console.log(`📋 ${BOT.leads.length} leads carregados`);
  console.log(`⏱️ Delays: ${BOT.delayMin/1000}s-${BOT.delayMax/1000}s`);
  console.log(`📊 Limite: ${BOT.maxDaily} msgs/dia\n`);
  console.log(`🛑 Para parar: stopBot()`);

  for (const lead of BOT.leads) {
    if (!BOT.active || BOT.sent >= BOT.maxDaily) break;

    const phone = lead.telefone.replace(/\D/g, '');
    const msg = getMessage(lead.nome, lead.negocio, lead.cidade);
    
    console.log(`📤 Enviando para ${lead.nome} (${phone})...`);
    const ok = await sendMessage(phone, msg);
    
    if (ok) {
      BOT.sent++;
      console.log(`✅ ${lead.nome} — ${BOT.sent}/${BOT.leads.length}`);
    } else {
      console.log(`❌ ${lead.nome} — falha`);
    }

    if (BOT.sent < BOT.leads.length && BOT.sent < BOT.maxDaily) {
      const delay = randDelay();
      console.log(`⏳ Próxima em ${Math.round(delay/1000)}s\n`);
      await sleep(delay);
    }
  }

  console.log(`\n📊 FINALIZADO: ${BOT.sent} mensagens enviadas`);
  if (BOT.sent >= BOT.maxDaily) console.log('🚫 Limite diário atingido!');
  window.__geoBotRunning = false;
})();

function stopBot() {
  window.__geoBotRunning = false;
  window.__geoBotActive = false;
  console.log('🛑 Bot parado!');
}
