'use client';

import { useState } from 'react';

const steps = [
  {
    icon: '🔍',
    title: '1. Busque leads no Google Maps',
    desc: 'Digite um nicho (ex: "Academia") e uma cidade. O GeoLeads extrai nome, telefone, site e redes sociais automaticamente.',
  },
  {
    icon: '📋',
    title: '2. Salve no CRM',
    desc: 'Com um clique, salve os leads encontrados. Organize por estágio: Novo, Em Contato, Proposta, Fechado.',
  },
  {
    icon: '💬',
    title: '3. Dispare pelo WhatsApp',
    desc: 'Selecione os leads, escreva ou gere uma mensagem com IA e abra o WhatsApp com tudo preenchido.',
  },
];

export default function OnboardingOverlay() {
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(true);

  if (!visible) return null;

  const isLast = step === steps.length - 1;
  const current = steps[step];

  const handleDismiss = () => {
    setVisible(false);
    try {
      localStorage.setItem('geoleads_onboarding_done', 'true');
    } catch {}
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-3xl bg-gradient-to-b from-gray-900 to-black border border-white/10 shadow-2xl overflow-hidden">
        <div className="p-8 text-center">
          <div className="text-5xl mb-4">{current.icon}</div>
          <h2 className="text-xl font-bold text-white mb-2">{current.title}</h2>
          <p className="text-sm text-gray-400 leading-relaxed">{current.desc}</p>
        </div>

        <div className="flex items-center justify-center gap-1.5 mb-6">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === step ? 'w-8 bg-blue-400' : 'w-1.5 bg-gray-600'
              }`}
            />
          ))}
        </div>

        <div className="px-8 pb-6 flex gap-3">
          {!isLast ? (
            <>
              <button
                onClick={handleDismiss}
                className="flex-1 py-2.5 rounded-xl border border-white/10 text-gray-400 hover:text-white text-sm font-medium cursor-pointer transition-colors"
              >
                Pular
              </button>
              <button
                onClick={() => setStep(s => s + 1)}
                className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold cursor-pointer transition-colors"
              >
                Próximo
              </button>
            </>
          ) : (
            <button
              onClick={handleDismiss}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white text-sm font-bold cursor-pointer transition-all"
            >
              🔥 Começar a usar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
