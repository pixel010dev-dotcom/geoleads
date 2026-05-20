"use client";

import { useState } from 'react';

export default function Pricing() {
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  const buyPlan = async (amount: number, tokens: number, planName: string) => {
    setLoadingPlan(planName);
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        body: JSON.stringify({ email: 'cliente@teste.com', amount, tokens })
      });
      const data = await res.json();
      
      if(data.url) {
        window.location.href = data.url;
      } else {
        alert(`Erro do Mercado Pago: ${data.error}`);
      }
    } catch(e: any) {
      alert(`Erro de conexão ao tentar gerar o Checkout: ${e.message}`);
    } finally {
      setLoadingPlan(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white py-8 px-4 sm:px-6 relative overflow-hidden">
      <div className="absolute inset-0 bg-grid-pattern pointer-events-none opacity-40" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-indigo-600/20 blur-[120px] rounded-full pointer-events-none" />

      <div className="max-w-7xl mx-auto relative z-10">
        {/* Nav de volta */}
        <a href="/" className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-8 group">
          <svg className="w-4 h-4 group-hover:-translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Voltar ao Motor
        </a>

        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-sm font-medium mb-6">
            <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
            Sem assinatura — compre quando precisar
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold mb-4">
            Escolha o poder do seu <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">Motor</span>
          </h1>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            Cada token vale 1 lead qualificado. Quanto mais tokens, mais barato fica por lead.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {/* Plano Iniciante */}
          <div className="p-6 sm:p-8 rounded-[1.5rem] sm:rounded-[2rem] bg-gradient-to-b from-white/[0.04] to-black/40 border border-white/10 hover:border-blue-500/40 transition-all duration-300 flex flex-col backdrop-blur-xl group">
            <div className="text-3xl mb-4">🔍</div>
            <h3 className="text-2xl font-bold mb-1">Iniciante</h3>
            <p className="text-gray-400 text-sm mb-6">Ideal para testar o motor e ver resultados reais.</p>
            <div className="text-4xl font-bold mb-1">R$ 29<span className="text-lg text-gray-500 font-normal">,90</span></div>
            <p className="text-xs text-gray-500 mb-6">≈ R$ 0,03 por lead</p>
            <ul className="space-y-3 mb-8 flex-1 text-sm">
              <li className="flex items-center gap-2.5">✅ <span className="text-gray-300">1.000 Tokens de Extração</span></li>
              <li className="flex items-center gap-2.5">✅ <span className="text-gray-300">Motor de Cobrança Justa</span></li>
              <li className="flex items-center gap-2.5">📊 <span className="text-gray-300">Exportação Excel / CSV</span></li>
              <li className="flex items-center gap-2.5">📞 <span className="text-gray-300">Extração de Telefone</span></li>
              <li className="flex items-center gap-2.5">✉️ <span className="text-gray-300">Caçador de E-mails</span></li>
            </ul>
            <button 
              onClick={() => buyPlan(29.90, 1000, 'iniciante')}
              disabled={loadingPlan !== null}
              className="w-full py-3.5 rounded-xl bg-white/5 text-white border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all font-semibold group-hover:shadow-[0_0_15px_rgba(59,130,246,0.2)]"
            >
              {loadingPlan === 'iniciante' ? 'Redirecionando...' : 'Começar Agora'}
            </button>
          </div>

          {/* Plano Profissional */}
          <div className="p-6 sm:p-8 rounded-[1.5rem] sm:rounded-[2rem] bg-gradient-to-b from-indigo-900/40 to-purple-900/20 border border-indigo-500/50 relative flex flex-col transform md:-translate-y-4 shadow-2xl shadow-indigo-500/10 backdrop-blur-xl group">
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-indigo-500 to-purple-500 text-white px-5 py-1.5 rounded-full text-sm font-bold shadow-lg shadow-indigo-500/30">
              ⭐ MAIS VENDIDO
            </div>
            <div className="text-3xl mb-4">⚡</div>
            <h3 className="text-2xl font-bold mb-1">Profissional</h3>
            <p className="text-gray-400 text-sm mb-6">Para quem quer vender em escala.</p>
            <div className="text-4xl font-bold mb-1 text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">
              R$ 97<span className="text-lg text-gray-500 font-normal">,00</span>
            </div>
            <p className="text-xs text-green-400 mb-6">≈ R$ 0,019 por lead · 37% mais barato</p>
            <ul className="space-y-3 mb-8 flex-1 text-sm">
              <li className="flex items-center gap-2.5">⚡ <span className="text-white font-medium">5.000 Tokens de Extração</span></li>
              <li className="flex items-center gap-2.5">✅ <span className="text-gray-300">Tudo do Iniciante</span></li>
              <li className="flex items-center gap-2.5">🔥 <span className="text-green-400 font-medium">Disparador WhatsApp Web</span></li>
              <li className="flex items-center gap-2.5">📷 <span className="text-pink-400 font-medium">Caçador de Instagram</span></li>
              <li className="flex items-center gap-2.5">📘 <span className="text-blue-400 font-medium">Caçador de Facebook</span></li>
              <li className="flex items-center gap-2.5">⭐ <span className="text-yellow-400 font-medium">Filtro de Avaliação Mínima</span></li>
            </ul>
            <button 
              onClick={() => buyPlan(97.00, 5000, 'profissional')}
              disabled={loadingPlan !== null}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 transition-all font-semibold shadow-lg shadow-indigo-500/20 flex justify-center items-center gap-2"
            >
              {loadingPlan === 'profissional' ? 'Redirecionando...' : 'Comprar Agora →'}
            </button>
          </div>

          {/* Plano Agência */}
          <div className="p-6 sm:p-8 rounded-[1.5rem] sm:rounded-[2rem] bg-gradient-to-b from-white/[0.04] to-black/40 border border-white/10 hover:border-purple-500/40 transition-all duration-300 flex flex-col backdrop-blur-xl group">
            <div className="text-3xl mb-4">🚀</div>
            <h3 className="text-2xl font-bold mb-1">Agência</h3>
            <p className="text-gray-400 text-sm mb-6">Para empresas e agências de marketing digital.</p>
            <div className="text-4xl font-bold mb-1">R$ 197<span className="text-lg text-gray-500 font-normal">,00</span></div>
            <p className="text-xs text-green-400 mb-6">≈ R$ 0,013 por lead · 57% mais barato</p>
            <ul className="space-y-3 mb-8 flex-1 text-sm">
              <li className="flex items-center gap-2.5">🚀 <span className="text-white font-medium">15.000 Tokens de Extração</span></li>
              <li className="flex items-center gap-2.5">✅ <span className="text-gray-300">Tudo do Profissional</span></li>
              <li className="flex items-center gap-2.5">🤖 <span className="text-blue-400 font-medium">Gerador de Mensagens IA</span></li>
              <li className="flex items-center gap-2.5">📋 <span className="text-purple-400 font-medium">CRM Embutido</span></li>
              <li className="flex items-center gap-2.5">🏷️ <span className="text-amber-400 font-medium">Leads Marcados & Favoritos</span></li>
              <li className="flex items-center gap-2.5">💼 <span className="text-cyan-400 font-medium">Suporte Prioritário</span></li>
            </ul>
            <button 
              onClick={() => buyPlan(197.00, 15000, 'agencia')}
              disabled={loadingPlan !== null}
              className="w-full py-3.5 rounded-xl bg-white/5 text-white border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all font-semibold group-hover:shadow-[0_0_15px_rgba(168,85,247,0.2)]"
            >
              {loadingPlan === 'agencia' ? 'Redirecionando...' : 'Escalar Agora'}
            </button>
          </div>
        </div>

        {/* Rodapé de confiança */}
        <div className="mt-16 text-center">
          <p className="text-gray-500 text-sm">Pagamento 100% seguro via <span className="text-white font-semibold">Mercado Pago</span> · PIX, Cartão e Boleto · Acesso imediato</p>
        </div>
      </div>
    </div>
  );
}
