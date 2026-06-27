"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { getPlanById, plans, paidPlanIds, formatPlanPrice, allFeatureKeys, featureLabels, type PlanId } from '@/lib/plans';
import { useTranslations } from '@/lib/i18n';
import Globe from '@/components/Globe';
import Toast, { showToast } from '@/components/Toast';
import ShareButtons from '@/components/ShareButtons';

export default function Account() {
  const { t, locale } = useTranslations();
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [tokens, setTokens] = useState<number>(0);
  const [planId, setPlanId] = useState<PlanId>('free');
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState<any[]>([]);
  const [loadError, setLoadError] = useState('');

  const loadAccountData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        router.push('/login');
        return;
      }

      setUser(session.user);

      const { data: profile } = await supabase
        .from('profiles')
        .select('tokens, plan_id')
        .eq('id', session.user.id)
        .maybeSingle();

      if (profile) {
        setTokens(profile.tokens);
        setPlanId((profile.plan_id as PlanId) || 'free');
      }

      const { data: history } = await supabase
        .from('payment_history')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })
        .limit(10);

      setPayments(history || []);
    } catch (err) {
      console.error('Account load error:', err);
      setLoadError(t('account.error'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    document.title = t('account.title');
    loadAccountData();
  }, []);

  if (loading) {
    return (
      <div className="app-shell min-h-screen text-white flex items-center justify-center">
        <div className="text-center">
          <Globe size={48} className="mx-auto mb-4 animate-pulse" />
          <p className="text-gray-400">{t('account.loading')}</p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="app-shell min-h-screen text-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 mb-4">{loadError}</p>
          <button onClick={() => { setLoading(true); setLoadError(''); loadAccountData(); }} className="px-6 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold cursor-pointer">
            {t('account.retry')}
          </button>
        </div>
      </div>
    );
  }

  const currentPlan = getPlanById(planId);
  const usagePercent = currentPlan.tokens > 0 ? Math.min(100, ((currentPlan.tokens - tokens) / currentPlan.tokens) * 100) : 0;

  return (
    <div className="app-shell min-h-screen text-white relative pb-16">
      <Toast />
      <nav className="border-b border-white/5 bg-black/40 backdrop-blur-2xl sticky top-0 z-50">
        <div className="app-container min-h-16 py-3 flex items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-2 group">
            <Globe size={28} />
            <span className="font-extrabold text-xl tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">Geo<span className="text-blue-400">Leads</span></span>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/app/dashboard" className="text-gray-400 hover:text-white transition-colors text-sm">{t('account.backToDashboard')}</Link>
          </div>
        </div>
      </nav>

      <main className="app-container py-8 lg:py-12 relative z-10">
        <h1 className="text-3xl sm:text-4xl font-extrabold mb-2">{t('account.myAccount')}</h1>
        <p className="text-gray-400 mb-8">{user?.email}</p>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="app-card p-6 rounded-2xl bg-gradient-to-b from-white/[0.05] to-black/40 border border-white/10">
            <p className="text-sm text-gray-400 mb-1">{t('account.currentPlan')}</p>
            <p className="text-2xl font-bold">{t(currentPlan.nameKey)}</p>
            <p className="text-sm text-gray-500 mt-1">{formatPlanPrice(currentPlan.price)}{currentPlan.price > 0 ? t('account.perMonth') : ''}</p>
          </div>

          <div className="app-card p-6 rounded-2xl bg-gradient-to-b from-white/[0.05] to-black/40 border border-white/10">
            <p className="text-sm text-gray-400 mb-1">{t('account.availableTokens')}</p>
            <p className="text-2xl font-bold">{tokens.toLocaleString(locale === 'en' ? 'en-US' : 'pt-BR')}</p>
            <p className="text-sm text-gray-500 mt-1">{t('account.ofIncluded', { count: currentPlan.tokens.toLocaleString(locale === 'en' ? 'en-US' : 'pt-BR') })}</p>
          </div>

          <div className="app-card p-6 rounded-2xl bg-gradient-to-b from-white/[0.05] to-black/40 border border-white/10">
            <p className="text-sm text-gray-400 mb-1">{t('account.planUsage')}</p>
            <div className="mt-2">
              <div className="h-3 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-500"
                  style={{ width: `${usagePercent}%` }}
                />
              </div>
              <p className="text-sm text-gray-500 mt-2">{t('account.percentUsed', { percent: Math.round(usagePercent) })}</p>
            </div>
          </div>
        </div>

        <div className="app-card p-6 rounded-2xl bg-gradient-to-b from-white/[0.05] to-black/40 border border-white/10 mb-8">
          <h2 className="text-xl font-bold mb-4">{t('account.featureComparison')}</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-3 pr-4 text-gray-400 font-medium">{t('account.feature')}</th>
                  {paidPlanIds.map(pid => (
                    <th key={pid} className={`text-center py-3 px-2 font-bold ${plans[pid].highlight ? 'text-indigo-400' : 'text-gray-300'}`}>
                      {t(plans[pid].nameKey)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-white/5">
                  <td className="py-3 pr-4 text-gray-300">{t('account.tokensIncluded')}</td>
                  {paidPlanIds.map(pid => (
                    <td key={pid} className="text-center py-3 px-2 text-white font-medium">{plans[pid].tokens.toLocaleString(locale === 'en' ? 'en-US' : 'pt-BR')}</td>
                  ))}
                </tr>
                <tr className="border-b border-white/5">
                  <td className="py-3 pr-4 text-gray-300">{t('account.price')}</td>
                  {paidPlanIds.map(pid => (
                    <td key={pid} className="text-center py-3 px-2 text-white font-medium">{formatPlanPrice(plans[pid].price)}</td>
                  ))}
                </tr>
                {allFeatureKeys.map(feature => (
                  <tr key={feature} className="border-b border-white/5">
                    <td className="py-3 pr-4 text-gray-300">{t(featureLabels[feature])}</td>
                    {paidPlanIds.map(pid => (
                      <td key={pid} className="text-center py-3 px-2">
                        {plans[pid].featureKeys.includes(feature) ? (
                          <span className="text-green-400 text-lg">✓</span>
                        ) : (
                          <span className="text-gray-600 text-lg">—</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {payments.length > 0 && (
          <div className="app-card p-6 rounded-2xl bg-gradient-to-b from-white/[0.05] to-black/40 border border-white/10">
            <h2 className="text-xl font-bold mb-4">{t('account.paymentHistory')}</h2>
            <div className="space-y-3">
              {payments.map(p => (
                <div key={p.id} className="flex items-center justify-between py-3 px-4 rounded-xl bg-white/5 border border-white/10">
                  <div>
                    <p className="font-medium">{t(getPlanById(p.plan_id).nameKey)} - {p.tokens_added.toLocaleString(locale === 'en' ? 'en-US' : 'pt-BR')} {t('account.tokens')}</p>
                    <p className="text-xs text-gray-500">{new Date(p.created_at).toLocaleDateString(locale === 'en' ? 'en-US' : 'pt-BR')}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-green-400">{formatPlanPrice(p.amount)}</p>
                    <p className="text-xs text-gray-500 capitalize">{p.status}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="app-card p-6 rounded-2xl bg-gradient-to-b from-white/[0.05] to-black/40 border border-white/10">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-2xl">🎁</span>
            <div>
              <h2 className="text-xl font-bold">Indique e Ganhe</h2>
              <p className="text-sm text-gray-400">Ganhe 100 tokens para cada amigo que fizer qualquer plano pago.</p>
            </div>
          </div>
          <div className="bg-black/40 border border-white/10 rounded-xl p-4 mb-4">
            <label className="text-xs text-gray-500 block mb-1.5">Seu link de indicação</label>
            <div className="flex gap-2">
              <input
                readOnly
                value={`${typeof window !== 'undefined' ? window.location.origin : ''}/login?ref=${user?.id || ''}`}
                className="flex-1 bg-black/60 border border-white/10 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none"
                onClick={e => (e.target as HTMLInputElement).select()}
              />
              <button
                onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/login?ref=${user?.id || ''}`); showToast('Link copiado!', 'success'); }}
                className="px-3 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold cursor-pointer"
              >
                Copiar
              </button>
            </div>
          </div>
          <ShareButtons
            url={`${typeof window !== 'undefined' ? window.location.origin : ''}/login?ref=${user?.id || ''}`}
            text="Use o GeoLeads para extrair leads do Google Maps! Ganhe 10 tokens gratis ao se cadastrar."
          />
        </div>
      </main>
    </div>
  );
}
