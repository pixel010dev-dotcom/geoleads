'use client';

import { useState } from 'react';
import { useTranslations } from '@/lib/i18n';

export default function OnboardingOverlay() {
  const { t } = useTranslations();
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(true);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  const steps = [
    {
      icon: '🔍',
      gradient: 'from-blue-600/20 to-cyan-600/10',
      border: 'border-blue-500/30',
      title: t('onboarding.step1Title'),
      desc: t('onboarding.step1Desc'),
      tip: t('onboarding.step1Tip'),
    },
    {
      icon: '📋',
      gradient: 'from-emerald-600/20 to-teal-600/10',
      border: 'border-emerald-500/30',
      title: t('onboarding.step2Title'),
      desc: t('onboarding.step2Desc'),
      tip: t('onboarding.step2Tip'),
    },
    {
      icon: '💬',
      gradient: 'from-purple-600/20 to-pink-600/10',
      border: 'border-purple-500/30',
      title: t('onboarding.step3Title'),
      desc: t('onboarding.step3Desc'),
      tip: t('onboarding.step3Tip'),
    },
    {
      icon: '🪙',
      gradient: 'from-amber-600/20 to-orange-600/10',
      border: 'border-amber-500/30',
      title: t('onboarding.step4Title'),
      desc: t('onboarding.step4Desc'),
      tip: t('onboarding.step4Tip'),
    },
  ];

  if (!visible) return null;

  const isLast = step === steps.length - 1;
  const current = steps[step];
  const progress = ((step + 1) / steps.length) * 100;

  const handleDismiss = () => {
    setVisible(false);
    try {
      localStorage.setItem('geoleads_onboarding_done', 'true');
    } catch (e) { console.error(e); }
  };

  const handleFinish = () => {
    try {
      localStorage.setItem('geoleads_onboarding_done', 'true');
    } catch (e) { console.error(e); }
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
                <button onClick={handleFinish}
                  className="flex-1 py-2.5 rounded-xl border border-white/10 text-gray-400 hover:text-white text-sm font-medium cursor-pointer transition-all hover:bg-white/5"
                >
                  {t('onboarding.skip')}
                </button>
                <button onClick={() => setStep(s => s + 1)}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white text-sm font-bold cursor-pointer transition-all"
                >
                  {t('onboarding.next')}
                </button>
              </>
            ) : (
              <button onClick={handleFinish}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-white text-sm font-bold cursor-pointer transition-all"
              >
                {t('onboarding.start')}
              </button>
            )}
          </div>

          <label className="flex items-center justify-center gap-2 text-[11px] text-gray-500 cursor-pointer hover:text-gray-400 transition-colors">
            <input type="checkbox" checked={dontShowAgain} onChange={(e) => setDontShowAgain(e.target.checked)}
              className="rounded border-gray-600 bg-black/40 text-emerald-500 focus:ring-0 cursor-pointer h-3.5 w-3.5" />
            {t('onboarding.dontShowAgain')}
          </label>
        </div>
      </div>
    </div>
  );
}
