"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { getCostPerLeadLabel, paidPlanIds, plans, type PlanId } from '@/lib/plans';

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

const planHint: Record<PlanId, string> = {
  free: 'Teste o motor',
  starter: 'Começo prático',
  pro: 'Melhor equilíbrio',
  agency: 'Volume e automação'
};

type PixSession = {
  paymentId: number;
  qrCode: string;
  qrCodeBase64: string;
  amount: number;
  planId: PlanId;
};

export default function Pricing() {
  const [loadingPlan, setLoadingPlan] = useState<PlanId | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState<PlanId>('pro');
  const [user, setUser] = useState<User | null>(null);
  const [pixSession, setPixSession] = useState<PixSession | null>(null);
  const [pixStatus, setPixStatus] = useState<string>('pending');
  const [pixMessage, setPixMessage] = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
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
          setPixMessage('Pagamento confirmado! Redirecionando...');
          window.setTimeout(() => {
            window.location.href = `/?checkout=success&plan=${selectedPlanId}`;
          }, 1500);
        }
      } catch {
        /* ignore poll errors */
      }
    }, 5000);
  }, [selectedPlanId, stopPolling]);

  const checkoutRequest = async (planId: PlanId, method: 'pix' | 'card') => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      window.location.href = `/login?next=/pricing&plan=${planId}`;
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
      throw new Error(data.error || 'Erro no checkout');
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
        throw new Error('Mercado Pago nao retornou QR Code PIX.');
      }

      setPixSession({
        paymentId: data.paymentId,
        qrCode: data.qrCode,
        qrCodeBase64: data.qrCodeBase64,
        amount: data.amount,
        planId
      });
      setPixStatus(data.status || 'pending');
      setPixMessage('Escaneie o QR Code ou copie o codigo PIX abaixo.');
      startPolling(data.paymentId, token);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Erro desconhecido';
      alert(`Erro PIX: ${message}`);
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
        alert('Erro: link do Mercado Pago nao gerado.');
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Erro desconhecido';
      alert(`Erro checkout: ${message}`);
    } finally {
      setLoadingPlan(null);
    }
  };

  const copyPixCode = async () => {
    if (!pixSession?.qrCode) return;
    await navigator.clipboard.writeText(pixSession.qrCode);
    setPixMessage('Codigo PIX copiado!');
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
      <div className="absolute inset-0 bg-grid-pattern pointer-events-none opacity-35" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[min(760px,92vw)] h-[280px] bg-blue-700/10 blur-[90px] rounded-full pointer-events-none" />

      {pixSession && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="pix-checkout-modal app-card w-full max-w-md p-6 rounded-2xl border border-emerald-500/30 bg-[#0b1220] shadow-2xl">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <p className="text-xs font-bold text-emerald-300 uppercase tracking-wide">Pagamento PIX</p>
                <h3 className="text-xl font-bold mt-1">{plans[pixSession.planId].name}</h3>
                <p className="text-sm text-gray-400">
                  {pixSession.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </p>
              </div>
              <button
                type="button"
                onClick={closePixModal}
                className="text-gray-400 hover:text-white text-xl leading-none cursor-pointer"
                aria-label="Fechar"
              >
                ×
              </button>
            </div>

            {qrImageSrc ? (
              <div className="mx-auto w-fit p-3 rounded-xl bg-white mb-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrImageSrc} alt="QR Code PIX" className="w-56 h-56 object-contain" />
              </div>
            ) : (
              <div className="rounded-xl bg-white/5 border border-white/10 p-6 text-center text-gray-400 mb-4">
                Gerando QR Code...
              </div>
            )}

            <button
              type="button"
              onClick={copyPixCode}
              className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-bold text-white cursor-pointer mb-3"
            >
              Copiar codigo PIX
            </button>

            <p className="text-xs text-center text-gray-400 mb-2">
              Status: <span className="text-emerald-300 font-semibold">{pixStatus}</span>
            </p>
            {pixMessage && (
              <p className="text-xs text-center text-gray-300 leading-relaxed">{pixMessage}</p>
            )}

            <p className="text-[11px] text-center text-gray-500 mt-4 leading-relaxed">
              Apos pagar, os tokens entram automaticamente em ate 1 minuto.
            </p>
          </div>
        </div>
      )}

      <div className="app-container relative z-10">
        <div className="flex items-center justify-between gap-3 mb-7">
          <Link href="/" className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors group">
            <svg className="w-4 h-4 group-hover:-translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Voltar ao Motor
          </Link>
          <span className={`hidden sm:inline-flex px-3 py-1.5 rounded-full border text-xs font-bold ${user ? 'bg-green-500/10 border-green-500/20 text-green-300' : 'bg-amber-500/10 border-amber-500/20 text-amber-300'}`}>
            {user ? 'Conta conectada' : 'Entre para comprar'}
          </span>
        </div>

        <section className="pricing-hero mb-8 sm:mb-10">
          <div>
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-300 text-xs sm:text-sm font-bold mb-5">
              <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
              Planos prontos para vender mais
            </div>
            <h1 className="text-3xl sm:text-5xl font-extrabold leading-tight mb-4 max-w-3xl">
              Escolha o volume do seu <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-300">motor comercial</span>
            </h1>
            <p className="text-gray-400 text-sm sm:text-lg leading-relaxed max-w-2xl">
              Pague com PIX aqui mesmo: QR Code e copia e cola na tela. Cartao e boleto pelo Mercado Pago.
            </p>
          </div>

          <div className="pricing-steps">
            <div><b>1</b><span>Escolha o plano</span></div>
            <div><b>2</b><span>Pague com PIX</span></div>
            <div><b>3</b><span>Receba tokens</span></div>
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_22rem] gap-5 lg:gap-7 items-start max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-5">
            {paidPlanIds.map((planId) => {
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
                        {planHint[plan.id]}
                      </span>
                    </div>
                    <span className={`pricing-radio ${isSelected ? 'is-selected' : ''}`} />
                  </div>

                  {plan.badge && (
                    <div className="mb-3 w-fit bg-gradient-to-r from-indigo-500 to-purple-500 text-white px-3 py-1 rounded-full text-[11px] font-bold shadow-lg shadow-indigo-500/20">
                      {plan.badge}
                    </div>
                  )}

                  <h3 className="text-2xl font-bold mb-1">{plan.name}</h3>
                  <p className="text-gray-400 text-sm mb-5 min-h-[3rem]">{plan.description}</p>

                  <div className="mb-1 text-4xl font-extrabold tracking-tight">
                    {plan.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }).replace(/\s/g, ' ')}
                  </div>
                  <p className="text-xs text-green-400 mb-5">{getCostPerLeadLabel(plan)}</p>

                  <div className="rounded-xl bg-black/25 border border-white/8 p-3 mb-5">
                    <p className="text-xs text-gray-500">Tokens inclusos</p>
                    <p className="text-xl font-bold text-white">{plan.tokens.toLocaleString('pt-BR')}</p>
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
            <span className="text-xs text-blue-300 font-bold uppercase tracking-wide">Resumo da escolha</span>
            <div className="mt-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-2xl font-bold">{selectedPlan.name}</h2>
                <p className="text-sm text-gray-400 mt-1">{selectedPlan.tokens.toLocaleString('pt-BR')} leads para usar no motor</p>
              </div>
              <span className="text-3xl">{planIcons[selectedPlan.id]}</span>
            </div>

            <div className="my-5 rounded-2xl bg-white/[0.04] border border-white/10 p-4">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="text-xs text-gray-500">Total hoje</p>
                  <p className="text-3xl font-extrabold">{selectedPlan.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }).replace(/\s/g, ' ')}</p>
                </div>
                <p className="text-xs text-green-400 font-bold text-right">{getCostPerLeadLabel(selectedPlan)}</p>
              </div>
            </div>

            <button
              onClick={() => buyWithPix(selectedPlan.id)}
              disabled={loadingPlan !== null}
              className="w-full py-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 transition-all font-bold flex justify-center items-center gap-2 disabled:opacity-60 disabled:cursor-wait shadow-[0_0_22px_rgba(16,185,129,0.25)]"
            >
              {loadingPlan === selectedPlan.id ? 'Gerando PIX...' : user ? 'Pagar com PIX (QR Code)' : 'Entrar para comprar'}
            </button>

            <button
              type="button"
              onClick={() => buyWithCard(selectedPlan.id)}
              disabled={loadingPlan !== null || !user}
              className="mt-3 w-full py-3 rounded-xl border border-white/15 bg-white/[0.04] hover:bg-white/[0.08] text-sm font-semibold text-gray-200 disabled:opacity-50 cursor-pointer"
            >
              Pagar com cartao / boleto (Mercado Pago)
            </button>

            <div className="mt-4 rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-3">
              <p className="text-xs font-bold text-emerald-300 mb-1">PIX na hora</p>
              <p className="text-[11px] text-gray-300 leading-relaxed">
                O QR Code abre aqui no GeoLeads. Voce tambem pode copiar o codigo e colar no app do banco.
              </p>
            </div>

            {nextPlan && (
              <button
                type="button"
                onClick={() => setSelectedPlanId(nextPlan.id)}
                className="mt-4 w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-gray-300 hover:text-white hover:bg-white/[0.06] transition-colors"
              >
                Precisa de mais volume? Ver {nextPlan.name}
              </button>
            )}

            <p className="mt-4 text-xs text-gray-500 leading-relaxed">
              Tokens liberados apos confirmacao do pagamento. Compre logado na sua conta GeoLeads.
            </p>
          </aside>
        </div>
      </div>
    </div>
  );
}
