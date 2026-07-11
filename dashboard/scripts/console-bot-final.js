// ===== GeoLeads Bot — 30 leads de Foz do Iguaçu =====
// Abra web.whatsapp.com no Brave > F12 > Console
// Cole tudo e Enter

(async () => {
  if (window.__geoBotRunning) return alert('Já rodando!');
  window.__geoBotRunning = true;

  const LEADS = [
    { nome: 'Luigia Pizzeria Napoletana', telefone: '5545984223212', negocio: 'pizzaria', cidade: 'Foz do Iguaçu' },
    { nome: 'Pizzaria Martignoni Foz', telefone: '554535734886', negocio: 'pizzaria', cidade: 'Foz do Iguaçu' },
    { nome: 'Vô Luiz Pizzeria e Cucina', telefone: '554530281209', negocio: 'pizzaria', cidade: 'Foz do Iguaçu' },
    { nome: 'Bel Viale', telefone: '554530296005', negocio: 'pizzaria', cidade: 'Foz do Iguaçu' },
    { nome: 'Quinta da Oliva - Pizzas Carnes e Massas', telefone: '554535723131', negocio: 'pizzaria', cidade: 'Foz do Iguaçu' },
    { nome: 'Império Pizzaria', telefone: '554530272800', negocio: 'pizzaria', cidade: 'Foz do Iguaçu' },
    { nome: 'Pizza di Bocca', telefone: '5545991033399', negocio: 'pizzaria', cidade: 'Foz do Iguaçu' },
    { nome: 'Dom Garcia Pizzaria', telefone: '5545999529010', negocio: 'pizzaria', cidade: 'Foz do Iguaçu' },
    { nome: 'Jurassic Pizza', telefone: '554535256904', negocio: 'pizzaria', cidade: 'Foz do Iguaçu' },
    { nome: 'La Caprese Pizzaria', telefone: '5545999637067', negocio: 'pizzaria', cidade: 'Foz do Iguaçu' },
    { nome: 'Pizzaria do Onofre', telefone: '554535261683', negocio: 'pizzaria', cidade: 'Foz do Iguaçu' },
    { nome: 'Mega Pizza', telefone: '554535741060', negocio: 'pizzaria', cidade: 'Foz do Iguaçu' },
    { nome: 'Pizza Peroni Delivery', telefone: '554530291920', negocio: 'pizzaria', cidade: 'Foz do Iguaçu' },
    { nome: 'Mega Pizza República Argentina', telefone: '554535251020', negocio: 'pizzaria', cidade: 'Foz do Iguaçu' },
    { nome: 'Top Pizza - Portal da Foz', telefone: '554599935879', negocio: 'pizzaria', cidade: 'Foz do Iguaçu' },
    { nome: 'Churrascaria Tropicana', telefone: '554530312672', negocio: 'restaurante', cidade: 'Foz do Iguaçu' },
    { nome: 'Bendito - Bar e Restaurante', telefone: '554530297373', negocio: 'restaurante', cidade: 'Foz do Iguaçu' },
    { nome: 'TropCalia Restaurante', telefone: '554599980120', negocio: 'restaurante', cidade: 'Foz do Iguaçu' },
    { nome: 'Restaurante Barracão', telefone: '554530273445', negocio: 'restaurante', cidade: 'Foz do Iguaçu' },
    { nome: 'La Toscana Foz', telefone: '5545991446805', negocio: 'restaurante', cidade: 'Foz do Iguaçu' },
    { nome: 'La Mafia Trattoria', telefone: '55459841194', negocio: 'restaurante', cidade: 'Foz do Iguaçu' },
    { nome: 'Baru Gastronomia', telefone: '5545991125003', negocio: 'restaurante', cidade: 'Foz do Iguaçu' },
    { nome: 'Capitão Bar - Restaurante Foz', telefone: '5545999620400', negocio: 'restaurante', cidade: 'Foz do Iguaçu' },
    { nome: 'Di Paolo Foz do Iguaçu', telefone: '5545991231252', negocio: 'restaurante', cidade: 'Foz do Iguaçu' },
    { nome: '4 Sorelle', telefone: '5545999847886', negocio: 'restaurante', cidade: 'Foz do Iguaçu' },
    { nome: 'Paris 6 Bistrô Foz do Iguaçu', telefone: '5545998144730', negocio: 'restaurante', cidade: 'Foz do Iguaçu' },
    { nome: 'Empório com Arte', telefone: '554535724240', negocio: 'restaurante', cidade: 'Foz do Iguaçu' },
    { nome: 'Santo Cupim - Botequim e Restaurante', telefone: '5545998416897', negocio: 'restaurante', cidade: 'Foz do Iguaçu' },
    { nome: 'Super Muffato Portinari', telefone: '554535222836', negocio: 'mercado', cidade: 'Foz do Iguaçu' },
    { nome: 'Super Muffato Boicy', telefone: '554535740429', negocio: 'mercado', cidade: 'Foz do Iguaçu' },
  ];

  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const delay = () => 60000 + Math.random() * 60000;

  const MSGS = [
    (n, neg, cid) => `Olá ${n}! Tudo bem? Vi seu ${neg} no Google. Tenho uma solução que atrai mais clientes em ${cid}. Topa dar uma olhada?`,
    (n, neg, cid) => `Oi ${n}! Seu ${neg} apareceu aqui. Tenho uma parceria que pode trazer mais clientes. Bate um papo?`,
    (n, neg, cid) => `Eaí ${n}! Tudo joia? Vi que tem um ${neg} em ${cid} e tenho uma oportunidade de divulgação gratuita. Tem interesse?`,
  ];

  console.log(`🤖 GeoLeads Bot — ${LEADS.length} leads`);
  console.log('🛑 Para parar: stopBot()\n');

  let sent = 0;
  for (const lead of LEADS) {
    if (sent >= 25) { console.log('🚫 Limite diário!'); break; }

    const msg = MSGS[Math.floor(Math.random() * MSGS.length)](lead.nome, lead.negocio, lead.cidade);
    const phone = lead.telefone;

    console.log(`📤 ${lead.nome} (${phone})...`);
    window.open(`https://web.whatsapp.com/send?phone=${phone}`);
    await sleep(4000);

    const input = document.querySelector('div[contenteditable="true"][spellcheck="true"]');
    if (!input) { console.log(`❌ ${lead.nome} — sem input`); continue; }

    input.focus();
    document.execCommand('insertText', false, msg);
    await sleep(2000);

    const btn = document.querySelector('button[data-testid="compose-btn-send"]') || document.querySelector('button[aria-label="Enviar"]');
    if (btn) btn.click();
    else input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true }));

    sent++;
    console.log(`✅ ${lead.nome} (${sent}/${LEADS.length})`);

    if (sent < LEADS.length && sent < 25) {
      const d = delay();
      console.log(`⏳ Próxima em ${Math.round(d/1000)}s\n`);
      await sleep(d);
    }
  }

  console.log(`\n📊 Finalizado: ${sent} mensagens enviadas!`);
  window.__geoBotRunning = false;
})();

function stopBot() {
  window.__geoBotRunning = false;
  console.log('🛑 Parado!');
}
