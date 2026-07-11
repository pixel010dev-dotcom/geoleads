'use client';

import { useState } from 'react';
import Link from 'next/link';

const FEATURES = [
  { icon: '🤖', title: 'Prospecção Automática', desc: 'Encontra e aborda clientes no WhatsApp sem trabalho manual. O robô trabalha 24h por dia.' },
  { icon: '🎯', title: 'Segmentação por Nicho', desc: 'Escolha exatamente quem atingir: restaurantes, salões, advogados, dentistas — qualquer nicho.' },
  { icon: '🛡️', title: 'Anti-Bloqueio', desc: 'Envios com delay inteligente, pausas programadas e limites diários. Conta protegida.' },
  { icon: '📊', title: 'Monitoramento de Respostas', desc: 'Detecta quando o lead responde e já responde automaticamente com nosso script de vendas.' },
  { icon: '📈', title: 'Relatórios em Tempo Real', desc: 'Veja quantas mensagens foram enviadas, quantas responderam e quanto está convertendo.' },
  { icon: '💬', title: 'CRM Integrado', desc: 'Gerencia os contatos, etapas do funil e histórico de conversas tudo num lugar só.' },
];

const BENEFITS = [
  { value: '10×', label: 'Mais clientes' },
  { value: '24h', label: 'Prospecção automática' },
  { value: '0', label: 'Risco de bloqueio' },
  { value: '100%', label: 'Leads reais da sua região' },
];

export default function WhatsAILanding() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    try {
      const res = await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, source: 'whatsai-landing' }),
      });
      if (res.ok) setSent(true);
    } catch {}
  };

  return (
    <div className="min-h-screen bg-black text-white">
      {/* BANNER — Produto Real */}
      <div className="bg-gradient-to-r from-green-500/10 via-emerald-500/10 to-green-500/10 border-b border-green-500/20 text-center py-2 text-xs text-gray-300">
        🚀 Produto completo disponível em{' '}
        <a
          href="https://whatsai-app-production.up.railway.app"
          target="_blank"
          rel="noopener noreferrer"
          className="text-green-400 font-bold underline hover:text-green-300"
        >
          whatsai.app →
        </a>
      </div>

      {/* NAV */}
      <nav className="fixed top-0 w-full border-b border-white/5 bg-black/40 backdrop-blur-2xl z-50">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/whatsai" className="flex items-center gap-2">
            <span className="text-xl font-black tracking-tight">
              <span className="text-white">Whats</span><span className="text-green-400">AI</span>
            </span>
          </Link>
          <div className="flex items-center gap-3 text-sm">
            <Link href="/blog/prospeccao-b2b-whatsapp" className="text-gray-400 hover:text-white transition-colors">Blog</Link>
            <a
              href="https://whatsai-app-production.up.railway.app"
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 rounded-lg bg-green-500 hover:bg-green-400 text-black font-bold transition-all text-sm"
            >
              Acessar Produto →
            </a>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section className="pt-28 pb-20 px-4 text-center">
        <div className="max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-medium mb-6">
            🔥 Prospecção automática via WhatsApp
          </div>
          <h1 className="text-4xl sm:text-6xl font-extrabold leading-tight mb-4">
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
              Nunca mais perca um cliente
            </span>
            <br />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-green-400 to-emerald-600">
              por falta de prospecção
            </span>
          </h1>
          <p className="text-lg text-gray-400 max-w-2xl mx-auto mb-8">
            O <strong className="text-white">WhatsAI</strong> encontra, aborda e gerencia clientes no WhatsApp automaticamente. 
            Você escolhe o nicho e a região — o robô faz o resto.
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <a
              href="https://whatsai-app-production.up.railway.app"
              target="_blank"
              rel="noopener noreferrer"
              className="px-6 py-3 rounded-xl bg-green-500 hover:bg-green-400 text-black font-bold transition-all shadow-lg shadow-green-500/25"
            >
              Acessar WhatsAI Agora →
            </a>
            <a
              href="#como-funciona"
              className="px-6 py-3 rounded-xl border border-white/10 hover:bg-white/[0.03] transition-all text-white"
            >
              Como Funciona ↓
            </a>
          </div>
        </div>
      </section>

      {/* BENEFITS COUNTERS */}
      <section className="py-12 border-y border-white/5">
        <div className="max-w-4xl mx-auto px-4 grid grid-cols-2 sm:grid-cols-4 gap-6">
          {BENEFITS.map(b => (
            <div key={b.label} className="text-center">
              <div className="text-3xl sm:text-4xl font-extrabold text-green-400">{b.value}</div>
              <div className="text-sm text-gray-400 mt-1">{b.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* COMO FUNCIONA */}
      <section id="como-funciona" className="py-20 px-4">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-extrabold text-center mb-12">Como funciona?</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { num: '1', title: 'Você configura', desc: 'Escolhe nicho (pizzaria, salão, mercado...) e região. O WhatsAI carrega centenas de leads em segundos.' },
              { num: '2', title: 'O robô prospecta', desc: 'Envia mensagens personalizadas com delay inteligente. Pula números sem WhatsApp. Monitora respostas em tempo real.' },
              { num: '3', title: 'Você vende', desc: 'Quando um lead responde, o sistema avisa. Você entra e fecha o negócio. O robô continua trabalhando.' },
            ].map(s => (
              <div key={s.num} className="p-6 rounded-2xl border border-white/5 bg-white/[0.02]">
                <div className="w-10 h-10 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center text-green-400 font-extrabold mb-4">{s.num}</div>
                <h3 className="font-bold mb-2">{s.title}</h3>
                <p className="text-sm text-gray-400">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="py-20 px-4 bg-white/[0.01] border-y border-white/5">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-extrabold text-center mb-4">Tudo que você precisa</h2>
          <p className="text-gray-400 text-center mb-12 max-w-xl mx-auto">Do lead ao fechamento, tudo automatizado.</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map(f => (
              <div key={f.title} className="p-5 rounded-xl border border-white/5 hover:bg-white/[0.02] transition-colors">
                <div className="text-2xl mb-3">{f.icon}</div>
                <h3 className="font-bold text-sm mb-1.5">{f.title}</h3>
                <p className="text-xs text-gray-500">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING / CTA */}
      <section id="cta" className="py-20 px-4">
        <div className="max-w-lg mx-auto text-center">
          <div className="text-4xl mb-4">🚀</div>
          <h2 className="text-3xl font-extrabold mb-4">Pronto pra automatizar suas vendas?</h2>
          <p className="text-gray-400 mb-2">
            O WhatsAI já está disponível por <strong className="text-white">R$29,90/mês</strong> com 7 dias grátis.
          </p>
          <p className="text-gray-500 text-sm mb-8">
            PIX, cartão ou boleto. Cancele quando quiser.
          </p>
          <a
            href="https://whatsai-app-production.up.railway.app"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block px-8 py-4 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 text-black font-bold transition-all shadow-lg shadow-green-500/25 text-lg"
          >
            Começar Teste Grátis →
          </a>
          {!sent && (
            <p className="text-xs text-gray-600 mt-4">
              Ou deixe seu email para receber mais informações por WhatsApp.
            </p>
          )}

          {sent ? (
            <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 text-sm">
              ✅ Recebemos seu contato! Em breve vamos te chamar.
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex gap-2 max-w-sm mx-auto">
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="seu@email.com"
                required
                className="flex-1 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-green-500"
              />
              <button
                type="submit"
                className="px-5 py-3 rounded-xl bg-green-500 hover:bg-green-400 text-black font-bold text-sm transition-all"
              >
                Enviar
              </button>
            </form>
          )}
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-white/5 py-8 px-4 text-center text-xs text-gray-600">
        <p className="mb-2">WhatsAI © 2026 — <a href="https://whatsai-app-production.up.railway.app" target="_blank" rel="noopener noreferrer" className="text-green-400 hover:underline">Acessar Produto Completo →</a></p>
        <p>Parte do ecossistema GeoLeads</p>
        <div className="flex justify-center gap-4 mt-2">
          <Link href="/blog" className="hover:text-white transition-colors">Blog</Link>
          <Link href="/blog/whatsapp-marketing-automacao" className="hover:text-white transition-colors">WhatsApp Marketing</Link>
        </div>
      </footer>
    </div>
  );
}
