/**
 * 🚀 GeoLeads Sales — chamado pelo pair-simple quando conecta
 */
module.exports = async function start(sock) {
  const { createClient } = require('@supabase/supabase-js');
  const path = require('path');
  require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });
  
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  async function userId() {
    const { data } = await supabase.auth.admin.listUsers();
    return data?.users?.find(u => u.email === 'pixel010dev@gmail.com')?.id;
  }

  const GK = process.env.GEMINI_API_KEY;
  async function gemini(p, sys) {
    if (!GK) return null;
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-001:generateContent?key=${GK}`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ contents:[{role:'user', parts:[{text:p}]}], systemInstruction: sys ? {parts:[{text:sys}]} : undefined, generationConfig:{temperature:0.7,maxOutputTokens:500} })
      });
      return (await r.json())?.candidates?.[0]?.content?.parts?.[0]?.text || null;
    } catch { return null; }
  }

  function name(r) { return (r||'Lead').split(/[-|,]/)[0].trim()||'Lead'; }
  
  async function msg(lead) {
    const n = name(lead.nome), c = lead.cidade||'região', k = lead.nicho||'negócio';
    const ai = await gemini(`Msg curta (max 200 chars) persuasiva p/ lead de ${k} em ${c}. Nome: ${n}.`, 'Vc é vendedor. Só a msg.');
    if (ai && ai.length < 300) return ai;
    return `Olá ${n}! Tudo bem? Vi seu ${k} no Google. Tenho uma solução que atrai mais clientes em ${c}. Topa dar uma olhada?`;
  }

  async function leads(limit) {
    const uid = await userId(); if (!uid) return [];
    const { data } = await supabase.from('crm_leads').select('id,lead_key,nome,telefone,cidade,nicho').eq('user_id', uid).eq('status','Novo').gte('telefone','+55').order('created_at').limit(limit*2);
    if (!data) return [];
    return data.filter(l => l.telefone?.replace(/\D/g,'').length >= 12).slice(0, limit);
  }

  // ===== EXTRAÇÃO PLACES =====
  async function searchPlaces(keyword, location) {
    const key = process.env.GOOGLE_PLACES_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY;
    if (!key) return [];
    try {
      const res = await fetch(`https://places.googleapis.com/v1/places:searchText?key=${key}`, {
        method:'POST',
        headers:{'Content-Type':'application/json','X-Goog-FieldMask':'places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.internationalPhoneNumber'},
        body: JSON.stringify({ textQuery:`${keyword} em ${location}`, pageSize:20, languageCode:'pt-BR' })
      });
      const data = await res.json();
      if (!data?.places) return [];
      return data.places.filter(p => (p.internationalPhoneNumber||p.nationalPhoneNumber||'').startsWith('+55')).map(p => ({
        place_id: p.id, nome: p.displayName?.text||'Sem nome', cidade: location, nicho: keyword, telefone: p.internationalPhoneNumber||p.nationalPhoneNumber
      }));
    } catch { return []; }
  }

  async function extractLeads() {
    console.log('🚀 Extraindo leads...');
    const kws = ['pizzaria','restaurante','mercado','padaria','academia','salão de beleza','barbearia','oficina mecânica','pet shop','clínica odontológica','advocacia','imobiliária'];
    let all = [];
    for (const kw of kws) {
      const r = await searchPlaces(kw, 'São Paulo');
      console.log(`  ${kw}: ${r.length}`);
      all = all.concat(r);
    }
    const uid = await userId();
    let saved = 0;
    for (const lead of all) {
      const { error } = await supabase.from('crm_leads').upsert({
        user_id: uid, lead_key: `places_${lead.place_id}`, nome: lead.nome,
        telefone: lead.telefone, cidade: lead.cidade, nicho: lead.nicho,
        status: 'Novo', stage_vendas: 1, fonte: 'whatsapp_bot',
        created_at: new Date().toISOString(), updated_at: new Date().toISOString()
      }, { onConflict: 'user_id,lead_key' });
      if (!error) saved++;
    }
    console.log(`💾 ${saved}/${all.length} salvos`);
    return saved;
  }

  // ===== SALES LOOP =====
  let sent = 0;
  let leads_list = await leads(8);
  console.log(`📋 ${leads_list.length} leads disponíveis`);

  if (leads_list.length === 0) {
    await extractLeads();
    leads_list = await leads(8);
  }

  for (const lead of leads_list) {
    if (sent > 0) await new Promise(r => setTimeout(r, 60000 + Math.random() * 60000));
    const jid = lead.telefone.replace(/\D/g,'') + '@s.whatsapp.net';
    const texto = await msg(lead);

    try {
      const exists = await sock.onWhatsApp(jid);
      if (!exists?.[0]?.exists) {
        console.log(`📵 ${name(lead.nome)} sem WhatsApp`);
        continue;
      }
      await sock.sendMessage(jid, { text: texto });
      console.log(`✅ ${name(lead.nome)}`);
      sent++;
    } catch (err) {
      console.log(`❌ ${name(lead.nome)}: ${err.message?.substring(0,50)}`);
    }
  }

  console.log(`📊 Enviadas: ${sent}/${leads_list.length}`);
  console.log('⏰ Concluído. Bot aguardando...');
};
