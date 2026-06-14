'use client';

import { useState } from 'react';

const steps = [
  {
    icon: '🔍',
    gradient: 'from-blue-600/20 to-cyan-600/10',
    border: 'border-blue-500/30',
    title: 'Encontre clientes no Google Maps',
    desc: 'Digite um nicho (ex: "Academia") e uma cidade. O GeoLeads varre o Maps e extrai nome, telefone, WhatsApp, Instagram, email e CNPJ de centenas de negócios em minutos.',
    tip: '💡 Dica: Quanto mais específico o nicho, melhores os leads. "Pet Shop" funciona melhor que "animais".',
  },
  {
    icon: '📋',
    gradient: 'from-emerald-600/20 to-teal-600/10',
    border: 'border-emerald-500/30',
    title: 'Gerencie no CRM inteligente',
    desc: 'Salve leads com 1 clique. Organize por estágio: Novo → Contatado → Proposta → Fechado. Edite, filtre e nunca perca um lead de vista.',
    tip: '💡 Dica: Use os estágios pra saber exatamente onde cada lead está no seu funil de vendas.',
  },
  {
    icon: '💬',
    gradient: 'from-purple-600/20 to-pink-600/10',
    border: 'border-purple-500/30',
    title: 'Venda pelo WhatsApp',
    desc: 'Dispare mensagens em massa com templates prontos, ou use o gerador de copys com IA. O chatbot responde automaticamente quem não atendeu.',
    tip: '💡 Dica: Mensagens curtas e diretas convertem mais. Teste diferentes abordagens.',
  },
  {
    icon: '🪙',
    gradient: 'from-amber-600/20 to-orange-600/10',
    border: 'border-amber-500/30',
    title: 'Tokens = Seu combustível',
    desc: 'Cada lead extraído gasta 1 token. Você começa com 10 tokens grátis sem cartão. Planos a partir de R$9,90 com 300 tokens. Os tokens são vitalícios enquanto seu plano estiver ativo.',
    tip: '💡 Dica: Use os tokens grátis pra testar seu nicho antes de investir em um plano.',
  },
];

export default function OnboardingOverlay() {
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(true);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  if (!visible) return null;

  const isLast = step === steps.length - 1;
  const current = steps[step];
  const progress = ((step + 1) / steps.length) * 100;

  const handleDismiss = () => {
    setVisible(false);
    try {
      localStorage.setItem('geoleads_onboarding_done', 'true');
    } catch {}
  };

  const handleFinish = () => {
    if (dontShowAgain) {
      try {
        localStorage.setItem('geoleads_onboarding_done', 'true');
      } catch {}
    }
    setVisible(false);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-3xl bg-gradient-to-b from-gray-900 to-black border border-white/10 shadow-2xl overflow-hidden">
        <div className={`p-8 sm:p-10 text-center border-b ${current.border} ${current.gradient}`}>
          <div className="text-6xl mb-4 animate-pulse">{current.icon}</div>
          <h2 className="text-2xl font-bold text-white mb-3 leading-tight">{current.title}</h2>
          <p className="text-sm text-gray-300 leading-relaxed">{current.desc}</p>
          <div className="mt-4 p-3 rounded-xl bg-black/40 border border-white/5">
            <p className="text-xs text-gray-400 leading-relaxed">{current.tip}</p>
          </div>
        </div>

        <div className="px-8 sm:px-10 py-5">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-gray-500 font-mono">{step + 1}/{steps.length}</span>
            <span className="text-[10px] text-gray-500 font-mono">{Math.round(progress)}%</span>
          </div>
          <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-400 to-cyan-400 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div className="px-8 sm:px-10 pb-6 flex flex-col gap-3">
          <div className="flex gap-3">
            {!isLast ? (
              <>
                <button onClick={handleDismiss}
                  className="flex-1 py-2.5 rounded-xl border border-white/10 text-gray-400 hover:text-white text-sm font-medium cursor-pointer transition-all hover:bg-white/5"
                >
                  Pular
                </button>
                <button onClick={() => setStep(s => s + 1)}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white text-sm font-bold cursor-pointer transition-all"
                >
                  Próximo
                </button>
              </>
            ) : (
              <button onClick={handleFinish}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-white text-sm font-bold cursor-pointer transition-all"
              >
                🔥 Começar a extrair leads
              </button>
            )}
          </div>

          <label className="flex items-center justify-center gap-2 text-[11px] text-gray-500 cursor-pointer hover:text-gray-400 transition-colors">
            <input type="checkbox" checked={dontShowAgain} onChange={(e) => setDontShowAgain(e.target.checked)}
              className="rounded border-gray-600 bg-black/40 text-emerald-500 focus:ring-0 cursor-pointer h-3.5 w-3.5" />
            Não mostrar novamente
          </label>
        </div>
      </div>
    </div>
  );
}
