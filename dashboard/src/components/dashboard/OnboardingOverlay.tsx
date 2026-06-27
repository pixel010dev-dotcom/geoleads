'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

const STEPS = [
  {
    emoji: '🎯',
    title: 'Escolha um nicho e cidade',
    desc: 'Digite um nicho (ex: "dentista", "pizzaria", "advogado") e uma cidade para comecar a extracao.',
  },
  {
    emoji: '⚡',
    title: 'Clique em "Extrair"',
    desc: 'O GeoLeads navega pelo Google Maps e coleta telefone, site, email e endereco de cada negocio.',
  },
  {
    emoji: '📋',
    title: 'Salve no CRM',
    desc: 'Os leads aparecem na tela em tempo real. Clique em "Salvar no CRM" para organizar e acompanhar.',
  },
  {
    emoji: '💰',
    title: 'Ganhe mais tokens',
    desc: 'Acabou os tokens gratuitos? Veja os planos a partir de R$ 9,90/mes com centenas de tokens.',
  },
];

export default function OnboardingOverlay() {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    const done = localStorage.getItem('geoleads_onboarding_done');
    if (!done) {
      const timer = setTimeout(() => setVisible(true), 800);
      return () => clearTimeout(timer);
    }
  }, []);

  const next = () => {
    if (step < STEPS.length - 1) {
      setStep(s => s + 1);
    } else {
      finish();
    }
  };

  const finish = () => {
    setVisible(false);
    try { localStorage.setItem('geoleads_onboarding_done', 'true'); } catch {}
  };

  if (!visible) return null;

  const s = STEPS[step];

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="app-card w-full max-w-sm p-6 sm:p-8 rounded-[2rem] bg-gradient-to-b from-white/[0.08] to-black/60 border border-blue-500/30 shadow-2xl relative overflow-hidden text-center">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-500" />
        <button onClick={finish} className="absolute top-3 right-3 text-gray-500 hover:text-white text-lg cursor-pointer">&times;</button>

        <div className="text-5xl mb-4">{s.emoji}</div>
        <h2 className="text-lg font-bold mb-2">{s.title}</h2>
        <p className="text-sm text-gray-400 mb-6">{s.desc}</p>

        <div className="flex items-center justify-center gap-2 mb-6">
          {STEPS.map((_, i) => (
            <span key={i} className={`w-2 h-2 rounded-full transition-all ${i === step ? 'bg-blue-400 w-4' : 'bg-white/20'}`} />
          ))}
        </div>

        <div className="flex gap-3">
          {step < STEPS.length - 1 ? (
            <>
              <button onClick={next} className="flex-1 py-3 rounded-xl bg-blue-500 hover:bg-blue-400 text-black font-bold text-sm transition-all cursor-pointer">
                Proximo
              </button>
              <button onClick={finish} className="px-4 py-3 rounded-xl border border-white/10 text-gray-400 text-sm cursor-pointer hover:text-white transition-colors">
                Pular
              </button>
            </>
          ) : (
            <Link href="/pricing" onClick={finish} className="flex-1 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 text-black font-bold text-sm text-center transition-all">
              Ver Planos
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
