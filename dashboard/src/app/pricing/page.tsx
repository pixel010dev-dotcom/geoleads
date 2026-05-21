"use client";

import { useState } from 'react';
import { getCostPerLeadLabel, paidPlanIds, plans, type PlanId } from '@/lib/plans';

const planIcons: Record<PlanId, string> = {
  free: '🔎',
  starter: '⚡',
  pro: '🚀',
  agency: '🏢'
};

export default function Pricing() {
  const [loadingPlan, setLoadingPlan] = useState<PlanId | null>(null);

  const buyPlan = async (planId: PlanId) => {
    setLoadingPlan(planId);
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId })
      });
      const data = await res.json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(`Erro do Mercado Pago: ${data.error}`);
      }
    } catch (e: any) {
      alert(`Erro de conexão ao tentar gerar o checkout: ${e.message}`);
    } finally {
      setLoadingPlan(null);
    }
  };

  return (
    <div className="app-shell min-h-screen text-white py-6 sm:py-8 relative overflow-hidden">
      <div className="absolute inset-0 bg-grid-pattern pointer-events-none opacity-40" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[min(800px,95vw)] h-[360px] bg-indigo-600/20 blur-[120px] rounded-full pointer-events-none" />

      <div className="app-container relative z-10">
        <a href="/" className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-8 group">
          <svg className="w-4 h-4 group-hover:-translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Voltar ao Motor
        </a>

        <div className="text-center mb-10 sm:mb-14">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-sm font-medium mb-6">
            <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
            Preços mais leves, ferramentas no plano certo
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold mb-4 leading-tight">
            Escolha quanto quer acelerar o seu <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">Motor</span>
          </h1>
          <p className="text-gray-400 text-base sm:text-lg max-w-2xl mx-auto">
            Compre créditos quando precisar. Cada token vale 1 lead entregue, e os recursos avançados entram conforme o pacote.
          </p>
        </div>

        <div className="mb-10 rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5 max-w-5xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <span className="text-xs text-blue-300 font-bold uppercase tracking-wide">Teste grátis</span>
              <p className="text-sm text-gray-300 mt-1">Crie sua conta e comece com 10 tokens para validar a busca antes de comprar.</p>
            </div>
            <a href="/login" className="px-4 py-2 rounded-xl bg-white text-black font-bold text-sm text-center hover:bg-gray-200 transition-colors">
              Criar conta
            </a>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-y-10 gap-x-5 md:gap-8 max-w-5xl mx-auto">
          {paidPlanIds.map((planId) => {
            const plan = plans[planId];

            return (
              <div
                key={plan.id}
                className={`app-card p-6 sm:p-8 rounded-[1.5rem] sm:rounded-[2rem] border transition-all duration-300 flex flex-col backdrop-blur-xl group ${
                  plan.highlight
                    ? 'bg-gradient-to-b from-indigo-900/40 to-purple-900/20 border-indigo-500/50 relative md:-translate-y-4 shadow-2xl shadow-indigo-500/10'
                    : 'bg-gradient-to-b from-white/[0.04] to-black/40 border-white/10 hover:border-blue-500/40'
                }`}
              >
                {plan.badge && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-indigo-500 to-purple-500 text-white px-5 py-1.5 rounded-full text-sm font-bold shadow-lg shadow-indigo-500/30 whitespace-nowrap">
                    {plan.badge}
                  </div>
                )}

                <div className="text-3xl mb-4">{planIcons[plan.id]}</div>
                <h3 className="text-2xl font-bold mb-1">{plan.name}</h3>
                <p className="text-gray-400 text-sm mb-6">{plan.description}</p>

                <div className={`text-4xl font-bold mb-1 ${plan.highlight ? 'text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400' : ''}`}>
                  {plan.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }).replace(/\s/g, ' ')}
                </div>
                <p className="text-xs text-green-400 mb-6">{getCostPerLeadLabel(plan)}</p>

                <ul className="space-y-3 mb-8 flex-1 text-sm">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2.5">
                      <span className="text-green-400 mt-0.5">✓</span>
                      <span className="text-gray-300">{feature}</span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => buyPlan(plan.id)}
                  disabled={loadingPlan !== null}
                  className={`w-full py-3.5 rounded-xl transition-all font-semibold flex justify-center items-center gap-2 disabled:opacity-60 disabled:cursor-wait ${
                    plan.highlight
                      ? 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 shadow-lg shadow-indigo-500/20'
                      : 'bg-white/5 text-white border border-white/10 hover:bg-white/10 hover:border-white/20 group-hover:shadow-[0_0_15px_rgba(59,130,246,0.2)]'
                  }`}
                >
                  {loadingPlan === plan.id ? 'Redirecionando...' : plan.cta}
                </button>
              </div>
            );
          })}
        </div>

        <div className="mt-10 sm:mt-16 text-center">
          <p className="text-gray-500 text-sm">Pagamento 100% seguro via <span className="text-white font-semibold">Mercado Pago</span> · PIX, Cartão e Boleto · acesso imediato após confirmação.</p>
        </div>
      </div>
    </div>
  );
}
