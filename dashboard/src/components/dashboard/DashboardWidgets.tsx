'use client';

import Link from 'next/link';
import type { FeatureKey } from '@/lib/plans';
import type { DashboardTab } from './dashboard-constants';
import { tabUpgradeCopy } from './dashboard-constants';
import { useTranslations } from '@/lib/i18n';

export function LockedFeaturePanel({ feature, activeTab, currentPlan, getUpgradePlan }: {
  feature: FeatureKey;
  activeTab: DashboardTab;
  currentPlan: { nameKey: string };
  getUpgradePlan: (feature: FeatureKey) => { nameKey: string; tokens: number; shortNameKey: string };
}) {
  const { t } = useTranslations();
  const requiredPlan = getUpgradePlan(feature);
  const fallbackCopy = {
    titleKey: 'lockedFeature.title',
    descKey: 'lockedFeature.desc',
  };
  const copy = activeTab !== 'extractor' && activeTab !== 'support'
    ? (tabUpgradeCopy as Record<string, any>)[activeTab] || fallbackCopy
    : fallbackCopy;

  return (
    <div className="app-card p-7 rounded-[2rem] bg-gradient-to-b from-white/[0.05] to-black/40 border border-white/10 shadow-2xl animate-slide-up">
      <div className="max-w-2xl">
        <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-bold mb-4">
          {t('lockedFeature.badge', { name: t(requiredPlan.nameKey) })}
        </span>
        <h2 className="text-2xl font-bold mb-2">{t(copy.titleKey, { name: t(requiredPlan.nameKey) })}</h2>
        <p className="text-gray-400 text-sm leading-relaxed mb-5">{t(copy.descKey)}</p>
        <div className="flex flex-wrap gap-2 mb-6">
          <span className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs text-gray-300">
            {t('lockedFeature.currentPlan', { name: t(currentPlan.nameKey) })}
          </span>
          <span className="px-3 py-1.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-300">
            {t('lockedFeature.tokensIncluded', { count: requiredPlan.tokens })}
          </span>
        </div>
        <Link
          href="/pricing"
          className="inline-flex items-center justify-center px-5 py-3 rounded-xl bg-white text-black font-bold text-sm hover:bg-gray-200 transition-colors"
        >
          {t('lockedFeature.viewPlans')}
        </Link>
      </div>
    </div>
  );
}

export function LeadGuideWidget({ user, currentPlan, tokens, onNavigate }: {
  user: { id: string; email?: string } | null;
  currentPlan: { nameKey: string };
  tokens: number | null;
  onNavigate: (tab: DashboardTab) => void;
}) {
  const { t, locale } = useTranslations();

  const plans = [
    { name: 'Free', price: 'Grátis', tokens: '5', popular: false },
    { name: 'Starter', price: 'R$ 9,90', tokens: '300', popular: false },
    { name: 'Pro', price: 'R$ 29,90', tokens: '1.000', popular: true },
    { name: 'Agency', price: 'R$ 67,90', tokens: '3.000', popular: false },
    { name: 'API', price: 'R$ 97', tokens: '10.000', popular: false },
  ];

  return (
    <div className="lead-guide-widget">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <span className="text-xs text-blue-300 font-bold uppercase tracking-wide">{t('widget.title')}</span>
          <h3 className="text-lg font-bold mt-1">{t('widget.subtitle')}</h3>
        </div>
        <span className="px-2.5 py-1 rounded-full bg-green-500/10 border border-green-500/20 text-green-300 text-[11px] font-bold">
          {t('widget.motorOk')}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-4">
        <button type="button" onClick={() => onNavigate('extractor')} className="lead-step is-active">
          <b>1</b>
          <span>{t('widget.search')}</span>
        </button>
        <button type="button" onClick={() => onNavigate('crm')} className="lead-step">
          <b>2</b>
          <span>{t('widget.save')}</span>
        </button>
        <button type="button" onClick={() => onNavigate('whatsapp')} className="lead-step">
          <b>3</b>
          <span>{t('widget.approach')}</span>
        </button>
      </div>

      <div className="rounded-2xl bg-black/25 border border-white/10 p-4 mb-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs text-gray-500">{t('widget.currentPlan')}</p>
            <p className="font-bold text-white">{user ? t(currentPlan.nameKey) : t('widget.freeAccount')}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500">{t('widget.balance')}</p>
            <p className="font-bold text-blue-300">{tokens !== null ? tokens.toLocaleString(locale === 'en' ? 'en-US' : 'pt-BR') : '5'} {t('widget.tokens')}</p>
          </div>
        </div>
      </div>

      {/* Plan pricing cards */}
      <div className="grid grid-cols-3 gap-1.5 mb-4">
        {plans.map((plan) => (
          <div
            key={plan.name}
            className={`relative rounded-xl p-2.5 text-center border transition-all ${
              plan.popular
                ? 'bg-blue-500/15 border-blue-500/30 shadow-[0_0_12px_rgba(59,130,246,0.15)]'
                : 'bg-black/20 border-white/5 hover:border-white/20'
            }`}
          >
            {plan.popular && (
              <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-blue-500 text-white leading-tight">
                {t('widget.popular')}
              </span>
            )}
            <p className="text-[11px] font-bold text-gray-300">{plan.name}</p>
            <p className={`text-sm font-extrabold ${plan.popular ? 'text-blue-300' : 'text-white'}`}>{plan.price}</p>
            <p className="text-[9px] text-gray-500">{plan.tokens} tokens</p>
          </div>
        ))}
      </div>

      <Link href="/pricing" className="inline-flex w-full items-center justify-center rounded-xl bg-white text-black font-bold text-sm py-3 hover:bg-gray-200 transition-colors">
        {t('widget.buyOrUpgrade')}
      </Link>
    </div>
  );
}
