"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import Toast, { showToast } from '@/components/Toast';
import { Button } from '@/components/Button';
import { getCostPerLeadLabel, paidPlanIds, plans, formatPlanPrice, allFeatureKeys, featureLabels, type PlanId } from '@/lib/plans';
import { useTranslations } from '@/lib/i18n';

const planMeta: Record<PlanId, { icon: string; color: string; gradient: string; glow: string }> = {
  free: {
    icon: '🔎',
    color: 'border-white/10 hover:border-white/20',
    gradient: 'from-white/5 to-transparent',
    glow: 'shadow-none',
  },
  starter: {
    icon: '⚡',
    color: 'border-blue-500/30 hover:border-blue-400/50',
    gradient: 'from-blue-500/8 to-transparent',
    glow: 'shadow-blue-500/5',
  },
  pro: {
    icon: '🚀',
    color: 'border-indigo-500/40 hover:border-indigo-400/60',
    gradient: 'from-indigo-500/10 to-transparent',
    glow: 'shadow-indigo-500/10',
  },
  agency: {
    icon: '🏢',
    color: 'border-cyan-500/30 hover:border-cyan-400/50',
    gradient: 'from-cyan-500/8 to-transparent',
    glow: 'shadow-cyan-500/5',
  },
  api: {
    icon: '🔌',
    color: 'border-purple-500/30 hover:border-purple-400/50',
    gradient: 'from-purple-500/8 to-transparent',
    glow: 'shadow-purple-500/5',
  },
};

const planHighlights: Record<PlanId, string | null> = {
  free: null,
  starter: null,
  pro: 'Mais popular',
  agency: null,
  api: null,
};

type PixSession = {
  paymentId: number;
  qrCode: string;
  qrCodeBase64: string;
  amount: number;
  planId: PlanId;
};

function PlanCardSvg({ planId }: { planId: PlanId }) {
  if (planId === 'pro') {
    return (
      <svg className="absolute -top-24 -right-20 w-48 h-48 opacity-[0.08] pointer-events-none" viewBox="0 0 200 200" fill="none">
        <circle cx="100" cy="100" r="80" stroke="currentColor" strokeWidth="0.5" className="text-indigo-400" />
        <circle cx="100" cy="100" r="50" stroke="currentColor" strokeWidth="0.5" className="text-indigo-300" />
        <circle cx="100" cy="100" r="20" stroke="currentColor" strokeWidth="0.5" className="text-indigo-200" />
      </svg>
    );
  }
  return null;
}

export default function Pricing() {
  const { t, locale } = useTranslations();
  const router = useRouter();
  const [loadingPlan, setLoadingPlan] = useState<PlanId | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState<PlanId>('pro');
  const [user, setUser] = useState<User | null>(null);
  const [pixSession, setPixSession] = useState<PixSession | null>(null);
  const [pixStatus, setPixStatus] = useState<string>('pending');
  const [pixMessage, setPixMessage] = useState('');
  const [annual, setAnnual] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    document.title = t('pricing.title');
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user || null);
    });

    const params = new URLSearchParams(window.location.search);
    const plan = params.get('plan') as PlanId | null;
    if (plan && paidPlanIds.includes(plan)) {
      window.requestAnimationFrame(() => setSelectedPlanId(plan));
    }

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedPlan = plans[selectedPlanId];
  const nextPlan = useMemo(() => {
    const currentIndex = paidPlanIds.indexOf(selectedPlanId);
    return paidPlanIds[currentIndex + 1] ? plans[paidPlanIds[currentIndex + 1]] : null;
  }, [selectedPlanId]);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const startPolling = useCallback((paymentId: number, token: string) => {
    stopPolling();
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/checkout/status?paymentId=${paymentId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (!res.ok) return;

        setPixStatus(data.status || 'pending');
        if (data.approved) {
          stopPolling();
          setPixMessage(t('pricing.paymentConfirmed'));
          window.setTimeout(() => {
            router.push(`/?checkout=success&plan=${selectedPlanId}`);
          }, 1500);
        }
      } catch (e) { console.error(e); }
    }, 5000);
  }, [selectedPlanId, stopPolling, router, t]);

  const checkoutRequest = async (planId: PlanId, method: 'pix' | 'card') => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      router.push(`/login?next=/pricing&plan=${planId}`);
      return null;
    }

    const res = await fetch('/api/checkout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`
      },
      body: JSON.stringify({ planId, method, annual })
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || t('pricing.checkoutError'));
    }

    return { data, token: session.access_token };
  };

  const buyWithPix = async (planId = selectedPlanId) => {
    setLoadingPlan(planId);
    setPixMessage('');
    try {
      const result = await checkoutRequest(planId, 'pix');
      if (!result) return;

      const { data, token } = result;
      if (data.method !== 'pix' || !data.qrCode) {
        throw new Error(t('pricing.noQrCode'));
      }

      setPixSession({
        paymentId: data.paymentId,
        qrCode: data.qrCode,
        qrCodeBase64: data.qrCodeBase64,
        amount: data.amount,
        planId
      });
      setPixStatus(data.status || 'pending');
      setPixMessage(t('pricing.scanQr'));
      startPolling(data.paymentId, token);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Unknown error';
      showToast(`Erro PIX: ${message}`, 'error');
    } finally {
      setLoadingPlan(null);
    }
  };

  const buyWithCard = async (planId = selectedPlanId) => {
    setLoadingPlan(planId);
    try {
      const result = await checkoutRequest(planId, 'card');
      if (!result) return;

      if (result.data.url) {
        window.location.href = result.data.url;
      } else {
        showToast(t('pricing.noPaymentLink'), 'error');
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Unknown error';
      showToast(`Erro checkout: ${message}`, 'error');
    } finally {
      setLoadingPlan(null);
    }
  };

  const copyPixCode = async () => {
    if (!pixSession?.qrCode) return;
    await navigator.clipboard.writeText(pixSession.qrCode);
    setPixMessage(t('pricing.pixCopied'));
  };

  const closePixModal = () => {
    stopPolling();
    setPixSession(null);
    setPixMessage('');
    setPixStatus('pending');
  };

  const qrImageSrc = pixSession?.qrCodeBase64
    ? `data:image/png;base64,${pixSession.qrCodeBase64}`
    : '';

  return (
    <div className="min-h-screen text-white py-6 sm:py-10 relative overflow-hidden">
      <Toast />

      {/* BG effects */}
      <div className="absolute inset-0 bg-grid-pattern pointer-events-none opacity-25" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[300px] bg-indigo-600/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 left-1/3 w-[500px] h-[250px] bg-blue-600/8 blur-[100px] rounded-full pointer-events-none" />

      {/* PIX MODAL */}
      {pixSession && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in" onClick={closePixModal}>
          <div
            className="w-full max-w-md p-6 sm:p-8 rounded-3xl border border-emerald-500/30 bg-gradient-to-b from-[#0b1a15] to-[#0b1220] shadow-2xl shadow-emerald-500/10 animate-bounce-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 mb-5">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-[10px] font-bold mb-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  PIX
                </div>
                <h3 className="text-xl font-bold">{t('pricing.planNames.' + pixSession.planId)}</h3>
                <p className="text-2xl font-extrabold mt-1 text-emerald-300">
                  {formatPlanPrice(pixSession.amount)}
                </p>
              </div>
              <button
                onClick={closePixModal}
                className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-all"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="text-center mb-5">
              <p className="text-xs text-gray-400 mb-2">Escaneie o QR Code abaixo com seu banco</p>
            </div>

            {qrImageSrc ? (
              <div className="relative mx-auto w-fit p-4 rounded-2xl bg-white mb-4 transition-all duration-300">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-2xl blur opacity-30" />
                <div className="relative bg-white rounded-xl p-1">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={qrImageSrc} alt="QR Code PIX" className="w-56 h-56 object-contain" />
                </div>
              </div>
            ) : (
              <div className="rounded-2xl bg-white/5 border border-white/10 p-10 text-center mb-4">
                <div className="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-emerald-400 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                </div>
                <p className="text-gray-400 text-sm">Gerando QR Code...</p>
              </div>
            )}

            <button
              onClick={copyPixCode}
              className="w-full py-3 px-4 rounded-xl font-bold text-sm bg-emerald-600 hover:bg-emerald-500 text-white transition-all flex items-center justify-center gap-2 mb-3"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Copiar código PIX
            </button>

            {pixMessage && (
              <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-4 py-3 mb-3 text-center">
                <p className="text-xs text-emerald-200 font-medium">{pixMessage}</p>
              </div>
            )}

            <div className="flex items-center justify-center gap-2 text-xs text-gray-400 mb-2">
              <span>Status:</span>
              <span className={`font-bold ${pixStatus === 'approved' ? 'text-green-400' : 'text-emerald-300'}`}>
                {pixStatus === 'pending' ? 'Aguardando pagamento...' : pixStatus === 'approved' ? 'Pago ✓' : pixStatus}
              </span>
              {pixStatus === 'pending' && (
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse ml-1" />
              )}
            </div>

            <p className="text-[11px] text-center text-gray-500 mt-4 leading-relaxed border-t border-white/5 pt-4">
              Tokens liberados após confirmação do pagamento.
            </p>
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto px-4 relative z-10">
        {/* TOP BAR */}
        <div className="flex items-center justify-between gap-3 mb-8">
          <Link href="/app/dashboard" className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors group">
            <svg className="w-4 h-4 group-hover:-translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Voltar ao Motor
          </Link>
          <div className="flex items-center gap-3">
            <span className={`hidden sm:inline-flex px-3 py-1.5 rounded-full border text-xs font-bold ${user ? 'bg-green-500/10 border-green-500/20 text-green-300' : 'bg-amber-500/10 border-amber-500/20 text-amber-300'}`}>
              {user ? 'Conta conectada' : 'Faça login para comprar'}
            </span>
          </div>
        </div>

        {/* HERO */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs sm:text-sm font-bold mb-5">
            <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
            Planos prontos para vender mais
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold leading-tight mb-4">
            Escolha o volume do seu <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-blue-400">motor comercial</span>
          </h1>
          <p className="text-gray-400 text-sm sm:text-lg leading-relaxed max-w-2xl mx-auto">
            Pague com PIX aqui mesmo: QR Code e copia e cola na tela. Cartão e boleto pelo Mercado Pago.
          </p>
        </div>

        {/* STEPS + TOGGLE */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-8 max-w-4xl mx-auto">
          <div className="flex items-center gap-2 sm:gap-4">
            {[
              { n: '1', label: 'Escolha o plano' },
              { n: '2', label: 'Pague com PIX' },
              { n: '3', label: 'Receba tokens' },
            ].map((step, i) => (
              <div key={step.n} className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center text-xs font-bold text-indigo-300">
                  {step.n}
                </div>
                <span className="text-xs sm:text-sm font-semibold text-gray-300 whitespace-nowrap">{step.label}</span>
                {i < 2 && <div className="hidden sm:block w-6 h-px bg-white/10" />}
              </div>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <span className={`text-sm font-medium transition-colors ${!annual ? 'text-white' : 'text-gray-500'}`}>Mensal</span>
            <button
              type="button"
              onClick={() => setAnnual(!annual)}
              className={`relative w-14 h-7 rounded-full transition-colors cursor-pointer active:scale-95 ${annual ? 'bg-indigo-600' : 'bg-white/20'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow-md transition-transform ${annual ? 'translate-x-7' : 'translate-x-0'}`} />
            </button>
            <span className={`text-sm font-medium transition-colors ${annual ? 'text-white' : 'text-gray-500'}`}>
              Anual
              <span className="ml-1.5 px-1.5 py-0.5 rounded-md bg-green-500/15 text-green-400 text-[10px] font-bold">-20%</span>
            </span>
          </div>
        </div>

        {/* PLAN CARDS + CHECKOUT */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_22rem] gap-6 lg:gap-8 items-start max-w-6xl mx-auto">
          {/* CARDS */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {(paidPlanIds as PlanId[]).map((planId) => {
              const plan = plans[planId];
              const isSelected = selectedPlanId === plan.id;
              const meta = planMeta[planId];
              const highlight = planHighlights[planId];
              const isPro = planId === 'pro';

              return (
                <div
                  key={plan.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedPlanId(plan.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') setSelectedPlanId(plan.id);
                  }}
                  className={`
                    relative rounded-2xl border p-5 cursor-pointer transition-all duration-200
                    ${meta.color}
                    ${isSelected
                      ? `is-selected bg-gradient-to-b ${meta.gradient} ${
                          isPro
                            ? 'shadow-[0_0_0_1px_rgba(99,102,241,0.5),0_20px_60px_rgba(99,102,241,0.15)]'
                            : 'shadow-[0_0_0_1px_rgba(96,165,250,0.35),0_20px_60px_rgba(37,99,235,0.12)]'
                        }`
                      : 'bg-white/[0.03] hover:bg-white/[0.06]'
                    }
                    ${isPro ? 'ring-1 ring-indigo-500/20' : ''}
                  `}
                >
                  <PlanCardSvg planId={planId} />

                  {/* BADGE */}
                  {highlight && (
                    <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-[10px] font-bold px-3 py-1 rounded-full shadow-lg shadow-indigo-500/25 whitespace-nowrap z-10">
                      {highlight}
                    </div>
                  )}
                  {plan.badgeKey && !highlight && (
                    <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-[10px] font-bold px-3 py-1 rounded-full shadow-lg shadow-indigo-500/25 whitespace-nowrap z-10">
                      {t(plan.badgeKey)}
                    </div>
                  )}

                  {/* HEADER */}
                  <div className="flex items-start justify-between gap-3 mb-4 mt-1">
                    <div>
                      <span className="text-2xl mb-2 block">{meta.icon}</span>
                      <h3 className="text-lg font-bold">{t('pricing.planNames.' + plan.id)}</h3>
                    </div>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-1 transition-all ${
                      isSelected
                        ? isPro ? 'border-indigo-400 bg-indigo-400' : 'border-blue-400 bg-blue-400'
                        : 'border-white/20'
                    }`}>
                      {isSelected && (
                        <svg className="w-3 h-3 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                  </div>

                  <p className="text-xs text-gray-400 mb-4 min-h-[2.5rem] leading-relaxed">{t('pricing.planDescriptions.' + plan.id)}</p>

                  {/* PRICE */}
                  <div className="mb-3">
                    <span className="text-3xl font-extrabold tracking-tight">
                      {formatPlanPrice(annual && plan.annualPrice > 0 ? plan.annualPrice : plan.price)}
                    </span>
                    {annual && plan.annualPrice > 0 && (
                      <span className="text-xs text-green-400 font-medium ml-1">/ano</span>
                    )}
                    {!annual && plan.price > 0 && (
                      <span className="text-xs text-gray-500 ml-1">/mês</span>
                    )}
                    {annual && plan.annualPrice > 0 && (
                      <div className="text-[10px] text-gray-500 mt-0.5">
                        <s>{formatPlanPrice(plan.price * 12)}</s> economia de 20%
                      </div>
                    )}
                  </div>

                  <p className="text-xs text-green-400 font-medium mb-4">{getCostPerLeadLabel(plan, t)}</p>

                  {/* TOKENS */}
                  <div className="rounded-xl bg-black/30 border border-white/[0.06] p-3 mb-4">
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Tokens inclusos</p>
                    <p className="text-xl font-bold text-white">{plan.tokens.toLocaleString(locale === 'en' ? 'en-US' : 'pt-BR')}</p>
                  </div>

                  {/* FEATURES */}
                  <ul className="space-y-2 text-xs">
                    {plan.features.slice(0, 5).map((feature) => (
                      <li key={feature} className="flex items-start gap-2">
                        <span className={`mt-0.5 flex-shrink-0 ${isPro ? 'text-indigo-400' : 'text-green-400'}`}>✓</span>
                        <span className="text-gray-300">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>

          {/* CHECKOUT SIDEBAR */}
          <aside className="rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.04] to-black/30 p-5 sm:p-6 sticky top-24">
            <span className="text-[10px] text-blue-300 font-bold uppercase tracking-widest">Resumo da escolha</span>
            <div className="mt-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold">{t('pricing.planNames.' + selectedPlan.id)}</h2>
                <p className="text-xs text-gray-400 mt-1">{selectedPlan.tokens.toLocaleString(locale === 'en' ? 'en-US' : 'pt-BR')} leads para usar no motor</p>
              </div>
              <span className="text-2xl">{planMeta[selectedPlan.id].icon}</span>
            </div>

            <div className="my-5 rounded-xl bg-white/[0.04] border border-white/[0.06] p-4">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider">
                    {annual ? 'Total no ano' : 'Total hoje'}
                  </p>
                  <p className="text-2xl font-extrabold mt-1">
                    {formatPlanPrice(annual && selectedPlan.annualPrice > 0 ? selectedPlan.annualPrice : selectedPlan.price)}
                  </p>
                  {annual && selectedPlan.annualPrice > 0 && (
                    <p className="text-[10px] text-gray-500 mt-1">
                      <s>{formatPlanPrice(selectedPlan.price * 12)}</s> economia de 20%
                    </p>
                  )}
                </div>
                <p className="text-[10px] text-green-400 font-bold text-right leading-tight">
                  {getCostPerLeadLabel(selectedPlan, t)}
                </p>
              </div>
            </div>

            <button
              onClick={() => buyWithPix(selectedPlan.id)}
              disabled={loadingPlan !== null}
              className="w-full py-3 px-4 rounded-xl font-bold text-sm bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white transition-all flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(16,185,129,0.2)]"
            >
              {loadingPlan === selectedPlan.id ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Gerando PIX...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Pagar com PIX (QR Code)
                </>
              )}
            </button>

            <button
              onClick={() => !user ? router.push(`/login?next=/pricing&plan=${selectedPlanId}`) : buyWithCard(selectedPlan.id)}
              disabled={loadingPlan !== null && !!user}
              className="w-full py-2.5 px-4 rounded-xl font-bold text-sm bg-white/5 border border-white/10 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed text-gray-200 transition-all flex items-center justify-center gap-2 mt-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
              {!user ? 'Faça login para pagar com cartão' : 'Pagar com cartão / boleto (Mercado Pago)'}
            </button>

            <div className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] p-3">
              <p className="text-xs font-bold text-emerald-300 mb-1">PIX na hora</p>
              <p className="text-[11px] text-gray-400 leading-relaxed">
                O QR Code abre aqui no GeoLeads. Você também pode copiar o código e colar no app do banco.
              </p>
            </div>

            {nextPlan && (
              <button onClick={() => setSelectedPlanId(nextPlan.id)} className="w-full text-xs text-gray-400 hover:text-white transition-colors mt-4">
                Precisa de mais volume? <span className="text-blue-400 font-semibold hover:underline">{t('pricing.planNames.' + nextPlan.id)}</span>
              </button>
            )}

            <p className="mt-4 text-[10px] text-gray-500 leading-relaxed text-center border-t border-white/[0.04] pt-4">
              Tokens liberados após confirmação do pagamento. Compre logado na sua conta GeoLeads.
            </p>
          </aside>
        </div>

        {/* COMPARISON TABLE */}
        <section className="mt-16 sm:mt-20 max-w-5xl mx-auto">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-300 text-xs font-bold mb-4">
              Comparação completa
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Veja o que cada plano oferece</h2>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-white/[0.06] bg-black/20">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06] bg-white/[0.03]">
                  <th className="text-left px-4 py-3.5 text-gray-400 font-semibold text-xs uppercase tracking-wider">Funcionalidade</th>
                  {(paidPlanIds as PlanId[]).map((pid) => {
                    const p = plans[pid];
                    return (
                      <th key={pid} className={`px-4 py-3.5 text-center font-bold text-xs ${p.highlight ? 'text-indigo-400' : 'text-gray-300'}`}>
                        {t('pricing.planNames.' + pid)}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {allFeatureKeys.map((fk) => {
                  return (
                    <tr key={fk} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-3 text-gray-300 text-xs">{t(featureLabels[fk])}</td>
                      {(paidPlanIds as PlanId[]).map((pid) => {
                        const included = plans[pid].featureKeys.includes(fk);
                        return (
                          <td key={pid} className="px-4 py-3 text-center">
                            {included ? (
                              <span className="text-green-400 text-base">✓</span>
                            ) : (
                              <span className="text-gray-600">—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
                <tr className="border-t border-white/[0.06] bg-white/[0.02]">
                  <td className="px-4 py-3 text-gray-300 text-xs font-semibold">Tokens de extração</td>
                  {(paidPlanIds as PlanId[]).map((pid) => {
                    const p = plans[pid];
                    return (
                      <td key={pid} className="px-4 py-3 text-center font-bold text-white text-sm">
                        {p.tokens.toLocaleString(locale === 'en' ? 'en-US' : 'pt-BR')}
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-gray-500 text-center mt-4 leading-relaxed">
            Todos os planos incluem acesso ao Motor Extrator e suporte padrão. Upgrade a qualquer momento.
          </p>
        </section>
      </div>
    </div>
  );
}
