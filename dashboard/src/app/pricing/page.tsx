"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import Toast, { showToast } from '@/components/Toast';
import { getCostPerLeadLabel, paidPlanIds, plans, formatPlanPrice, allFeatureKeys, featureLabels, type PlanId } from '@/lib/plans';
import { useTranslations } from '@/lib/i18n';

const planIcons: Record<PlanId, string> = {
  free: '🔎',
  starter: '⚡',
  pro: '🚀',
  agency: '🏢'
};

const planAccent: Record<PlanId, string> = {
  free: 'border-white/10',
  starter: 'border-blue-500/35',
  pro: 'border-indigo-500/60',
  agency: 'border-cyan-500/35'
};

type PixSession = {
  paymentId: number;
  qrCode: string;
  qrCodeBase64: string;
  amount: number;
  planId: PlanId;
};

export default function Pricing() {
  const { t, locale } = useTranslations();
  const router = useRouter();
  const [loadingPlan, setLoadingPlan] = useState<PlanId | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState<PlanId>('pro');
  const [user, setUser] = useState<User | null>(null);
  const [pixSession, setPixSession] = useState<PixSession | null>(null);
  const [pixStatus, setPixStatus] = useState<string>('pending');
  const [pixMessage, setPixMessage] = useState('');
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
  }, [selectedPlanId, stopPolling]);

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
      body: JSON.stringify({ planId, method })
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
    <div className="app-shell min-h-screen text-white py-5 sm:py-8 relative overflow-hidden">
      <Toast />
      <div className="absolute inset-0 bg-grid-pattern pointer-events-none opacity-35" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[min(760px,92vw)] h-[280px] bg-blue-700/10 blur-[90px] rounded-full pointer-events-none" />

      {pixSession && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in" onClick={closePixModal}>
          <div
            className="pix-checkout-modal app-card w-full max-w-md p-6 sm:p-8 rounded-3xl border border-emerald-500/30 bg-gradient-to-b from-[#0b1a15] to-[#0b1220] shadow-2xl shadow-emerald-500/10 animate-bounce-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 mb-5">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-[10px] font-bold mb-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  {t('pricing.pixTitle')}
                </div>
                <h3 className="text-xl font-bold">{t('pricing.planNames.' + pixSession.planId)}</h3>
                <p className="text-2xl font-extrabold mt-1 text-emerald-300">
                  {formatPlanPrice(pixSession.amount)}
                </p>
              </div>
              <button
                type="button"
                onClick={closePixModal}
                className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400 hover:text-white flex items-center justify-center cursor-pointer transition-all hover:scale-110"
                aria-label={t('pricing.close')}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="text-center mb-5">
              <p className="text-xs text-gray-400 mb-2">{t('pricing.scanQr')}</p>
            </div>

            {qrImageSrc ? (
              <div className="mx-auto w-fit p-4 rounded-2xl bg-white shadow-[0_0_30px_rgba(16,185,129,0.15)] mb-4 transition-all hover:scale-105 duration-300 relative">
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
                <p className="text-gray-400 text-sm">{t('pricing.generatingQr')}</p>
              </div>
            )}

            <button
              type="button"
              onClick={copyPixCode}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 font-bold text-white cursor-pointer mb-3 transition-all hover:-translate-y-0.5 active:scale-[0.98] shadow-[0_0_20px_rgba(16,185,129,0.2)]"
            >
              <svg className="w-4 h-4 inline mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              {t('pricing.copyPixCode')}
            </button>

            {pixMessage && (
              <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-4 py-3 mb-3 text-center">
                <p className="text-xs text-emerald-200 font-medium">{pixMessage}</p>
              </div>
            )}

            <div className="flex items-center justify-center gap-2 text-xs text-gray-400 mb-2">
              <span>Status:</span>
              <span className={`font-bold ${pixStatus === 'approved' ? 'text-green-400' : 'text-emerald-300'}`}>
                {pixStatus === 'pending' ? t('pricing.awaitingPayment') : pixStatus === 'approved' ? t('pricing.paid') : pixStatus}
              </span>
              {pixStatus === 'pending' && (
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse ml-1" />
              )}
            </div>

            <p className="text-[11px] text-center text-gray-500 mt-4 leading-relaxed border-t border-white/5 pt-4">
              {t('pricing.afterPayment')}
            </p>
          </div>
        </div>
      )}

      <div className="app-container relative z-10">
        <div className="flex items-center justify-between gap-3 mb-7">
          <Link href="/app/dashboard" className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors group">
            <svg className="w-4 h-4 group-hover:-translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            {t('pricing.backToEngine')}
          </Link>
          <span className={`hidden sm:inline-flex px-3 py-1.5 rounded-full border text-xs font-bold ${user ? 'bg-green-500/10 border-green-500/20 text-green-300' : 'bg-amber-500/10 border-amber-500/20 text-amber-300'}`}>
            {user ? t('pricing.accountConnected') : t('pricing.loginToBuy')}
          </span>
        </div>

        <section className="pricing-hero mb-8 sm:mb-10">
          <div>
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-300 text-xs sm:text-sm font-bold mb-5">
              <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
              {t('pricing.title')}
            </div>
            <h1 className="text-3xl sm:text-5xl font-extrabold leading-tight mb-4 max-w-3xl">
              {t('pricing.subtitle')}
            </h1>
            <p className="text-gray-400 text-sm sm:text-lg leading-relaxed max-w-2xl">
              {t('pricing.paymentInfo')}
            </p>
          </div>

          <div className="pricing-steps">
            <div><b>1</b><span>{t('pricing.steps.1')}</span></div>
            <div><b>2</b><span>{t('pricing.steps.2')}</span></div>
            <div><b>3</b><span>{t('pricing.steps.3')}</span></div>
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_22rem] gap-5 lg:gap-7 items-start max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {(['free', ...paidPlanIds] as PlanId[]).map((planId) => {
              const plan = plans[planId];
              const isSelected = selectedPlanId === plan.id;

              return (
                <div
                  key={plan.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedPlanId(plan.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') setSelectedPlanId(plan.id);
                  }}
                  className={`pricing-plan-card app-card p-5 sm:p-6 rounded-2xl border cursor-pointer transition-all duration-200 ${planAccent[plan.id]} ${
                    isSelected
                      ? 'is-selected bg-blue-600/10 shadow-[0_0_0_1px_rgba(96,165,250,0.45),0_20px_60px_rgba(37,99,235,0.18)]'
                      : 'bg-white/[0.035] hover:bg-white/[0.055]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3 mb-5">
                    <div>
                      <div className="text-3xl mb-3">{planIcons[plan.id]}</div>
                      <span className="inline-flex px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-[11px] text-gray-300 font-bold">
                        {t('pricing.planHints.' + plan.id)}
                      </span>
                    </div>
                    <span className={`pricing-radio ${isSelected ? 'is-selected' : ''}`} />
                  </div>

                  {plan.badgeKey && (
                    <div className="mb-3 w-fit bg-gradient-to-r from-indigo-500 to-purple-500 text-white px-3 py-1 rounded-full text-[11px] font-bold shadow-lg shadow-indigo-500/20">
                      {t(plan.badgeKey)}
                    </div>
                  )}

                  <h3 className="text-2xl font-bold mb-1">{t('pricing.planNames.' + plan.id)}</h3>
                  <p className="text-gray-400 text-sm mb-5 min-h-[3rem]">{t('pricing.planDescriptions.' + plan.id)}</p>

                  <div className="mb-1 text-4xl font-extrabold tracking-tight">
                    {formatPlanPrice(plan.price)}
                  </div>
                  <p className="text-xs text-green-400 mb-5">{getCostPerLeadLabel(plan)}</p>

                  <div className="rounded-xl bg-black/25 border border-white/8 p-3 mb-5">
                    <p className="text-xs text-gray-500">{t('pricing.tokensIncluded')}</p>
                    <p className="text-xl font-bold text-white">{plan.tokens.toLocaleString(locale === 'en' ? 'en-US' : 'pt-BR')}</p>
                  </div>

                  <ul className="space-y-2.5 text-sm">
                    {plan.features.slice(0, 5).map((feature) => (
                      <li key={feature} className="flex items-start gap-2.5">
                        <span className="text-green-400 mt-0.5">✓</span>
                        <span className="text-gray-300">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>

          <aside className="checkout-summary app-card p-5 sm:p-6 rounded-2xl border border-white/10 bg-black/35">
            <span className="text-xs text-blue-300 font-bold uppercase tracking-wide">{t('pricing.summaryTitle')}</span>
            <div className="mt-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-2xl font-bold">{t('pricing.planNames.' + selectedPlan.id)}</h2>
                <p className="text-sm text-gray-400 mt-1">{t('pricing.leadsToUse', { count: selectedPlan.tokens.toLocaleString(locale === 'en' ? 'en-US' : 'pt-BR') })}</p>
              </div>
              <span className="text-3xl">{planIcons[selectedPlan.id]}</span>
            </div>

            <div className="my-5 rounded-2xl bg-white/[0.04] border border-white/10 p-4">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="text-xs text-gray-500">{t('pricing.totalToday')}</p>
                  <p className="text-3xl font-extrabold">{formatPlanPrice(selectedPlan.price)}</p>
                </div>
                <p className="text-xs text-green-400 font-bold text-right">{getCostPerLeadLabel(selectedPlan)}</p>
              </div>
            </div>

            <button
              onClick={() => buyWithPix(selectedPlan.id)}
              disabled={loadingPlan !== null}
              className="w-full py-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 transition-all font-bold flex justify-center items-center gap-2 disabled:opacity-60 disabled:cursor-wait shadow-[0_0_22px_rgba(16,185,129,0.25)]"
            >
              {loadingPlan === selectedPlan.id ? t('pricing.generatingPix') : user ? t('pricing.payWithPix') : t('pricing.enterToBuy')}
            </button>

            <button
              type="button"
              onClick={() => !user ? router.push(`/login?next=/pricing&plan=${selectedPlanId}`) : buyWithCard(selectedPlan.id)}
              disabled={loadingPlan !== null && !!user}
              className="mt-3 w-full py-3 rounded-xl border border-white/15 bg-white/[0.04] hover:bg-white/[0.08] text-sm font-semibold text-gray-200 disabled:opacity-50 cursor-pointer"
              title={!user ? t('pricing.loginForCard') : ''}
            >
              {!user ? t('pricing.loginForCard') : loadingPlan === selectedPlan.id ? t('pricing.generatingPix') : t('pricing.payWithCard')}
            </button>

            <div className="mt-4 rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-3">
              <p className="text-xs font-bold text-emerald-300 mb-1">{t('pricing.pixOnTheSpot')}</p>
              <p className="text-[11px] text-gray-300 leading-relaxed">
                {t('pricing.pixDescription')}
              </p>
            </div>

            {nextPlan && (
              <button
                type="button"
                onClick={() => setSelectedPlanId(nextPlan.id)}
                className="mt-4 w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-gray-300 hover:text-white hover:bg-white/[0.06] transition-colors"
              >
                {t('pricing.needMoreVolume', { name: t('pricing.planNames.' + nextPlan.id) })}
              </button>
            )}

            <p className="mt-4 text-xs text-gray-500 leading-relaxed">
              {t('pricing.tokensAfterPayment')}
            </p>
          </aside>
        </div>

        {/* COMPARISON TABLE */}
        <section className="mt-12 sm:mt-16 max-w-5xl mx-auto">
          <div className="text-center mb-8">
            <span className="badge-blue mb-3">{t('pricing.compare')}</span>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight mt-3">{t('pricing.compareSubtitle')}</h2>
          </div>
          <div className="overflow-x-auto rounded-2xl border border-white/5 bg-black/20">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5 bg-white/[0.03]">
                  <th className="text-left px-4 py-3.5 text-gray-400 font-semibold">{t('pricing.featureColumn')}</th>
                  {(['free', ...paidPlanIds] as PlanId[]).map((pid) => {
                    const p = plans[pid];
                    return (
                      <th key={pid} className={`px-4 py-3.5 text-center font-bold ${p.highlight ? 'text-blue-400' : 'text-gray-300'}`}>
                        {t('pricing.planNames.' + pid)}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {allFeatureKeys.map((fk) => {
                  const label = featureLabels[fk];
                  return (
                    <tr key={fk} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-3 text-gray-300 font-medium">{label}</td>
                      {(['free', ...paidPlanIds] as PlanId[]).map((pid) => {
                        const included = plans[pid].featureKeys.includes(fk);
                        return (
                          <td key={pid} className="px-4 py-3 text-center">
                            {included ? (
                              <span className="text-green-400 text-lg">✓</span>
                            ) : (
                              <span className="text-gray-600">—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
                <tr className="border-t border-white/10 bg-white/[0.02]">
                  <td className="px-4 py-3 text-gray-300 font-medium">Tokens de extração</td>
                  {(['free', ...paidPlanIds] as PlanId[]).map((pid) => {
                    const p = plans[pid];
                    return (
                      <td key={pid} className="px-4 py-3 text-center font-bold text-white">
                        {p.tokens.toLocaleString(locale === 'en' ? 'en-US' : 'pt-BR')}
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-500 text-center mt-4">
            {t('pricing.allPlansInclude')}
          </p>
        </section>
      </div>
    </div>
  );
}
