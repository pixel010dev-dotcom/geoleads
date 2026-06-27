'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from '@/lib/i18n';
import ShareButtons from '@/components/ShareButtons';
import Globe from '@/components/Globe';
import type { ToastType } from '@/components/Toast';

interface ReferralStats {
  totalReferred: number;
  paidConversions: number;
  conversionRate: number;
  totalTokensEarned: number;
}

export default function ReferralSection({ user, showToast }: { user: { id: string; email?: string } | null; showToast: (msg: string, type?: ToastType) => void }) {
  const { t } = useTranslations();
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const referralUrl = typeof window !== 'undefined' ? `${window.location.origin}/login?ref=${user?.id || ''}` : '';
  const shareText = 'Use o GeoLeads para extrair leads do Google Maps e turbinar suas vendas! Ganhe 100 tokens gratis ao se cadastrar.';

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const res = await fetch('/api/referral/stats');
      const data = await res.json();
      if (data.success) setStats(data.stats);
    } catch (err) {
      console.error('Erro ao carregar stats de indicacao:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="app-card p-6 rounded-2xl bg-gradient-to-b from-white/[0.05] to-black/40 border border-white/10">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-3xl">🎁</span>
          <div>
            <h2 className="text-xl font-bold">{t('dashboard.referralTitle')}</h2>
            <p className="text-sm text-gray-400">{t('dashboard.referralDesc')}</p>
          </div>
        </div>

        <div className="bg-black/40 border border-white/10 rounded-xl p-4 mb-4">
          <label className="text-xs text-gray-500 block mb-1.5">Seu link de indicação</label>
          <div className="flex gap-2">
            <input
              readOnly
              value={referralUrl}
              className="flex-1 bg-black/60 border border-white/10 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none"
              onClick={e => (e.target as HTMLInputElement).select()}
            />
            <button
              onClick={() => { navigator.clipboard.writeText(referralUrl); setCopied(true); showToast('Link copiado!', 'success'); setTimeout(() => setCopied(false), 2000); }}
              className="px-3 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold cursor-pointer"
            >
              {copied ? '✓' : t('dashboard.copyLink')}
            </button>
          </div>
        </div>

        <div className="mb-2">
          <p className="text-xs text-gray-500 mb-2 font-medium">Compartilhar</p>
          <ShareButtons
            url={referralUrl}
            text={shareText}
            onCopy={() => { showToast('Link copiado!', 'success'); }}
          />
        </div>

        <p className="text-[11px] text-gray-500 mt-4 leading-relaxed">{t('dashboard.referralAutoCredit')}</p>
      </div>

      <div className="app-card p-6 rounded-2xl bg-gradient-to-b from-white/[0.05] to-black/40 border border-white/10">
        <h3 className="text-lg font-bold mb-4">📊 Estatisticas de Indicacao</h3>
        {loading ? (
          <div className="flex justify-center py-6">
            <Globe size={24} className="animate-pulse" />
          </div>
        ) : stats ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-black/40 rounded-xl p-4 text-center border border-white/5">
              <p className="text-2xl font-bold text-blue-400">{stats.totalReferred}</p>
              <p className="text-xs text-gray-400 mt-1">Pessoas Indicadas</p>
            </div>
            <div className="bg-black/40 rounded-xl p-4 text-center border border-white/5">
              <p className="text-2xl font-bold text-green-400">{stats.paidConversions}</p>
              <p className="text-xs text-gray-400 mt-1">Conversoes Pagas</p>
            </div>
            <div className="bg-black/40 rounded-xl p-4 text-center border border-white/5">
              <p className="text-2xl font-bold text-amber-400">{stats.conversionRate}%</p>
              <p className="text-xs text-gray-400 mt-1">Taxa de Conversao</p>
            </div>
            <div className="bg-black/40 rounded-xl p-4 text-center border border-white/5">
              <p className="text-2xl font-bold text-purple-400">{stats.totalTokensEarned.toLocaleString('pt-BR')}</p>
              <p className="text-xs text-gray-400 mt-1">Tokens Ganhos</p>
            </div>
          </div>
        ) : (
          <p className="text-gray-500 text-sm text-center py-4">Nenhuma indicacao ainda. Compartilhe seu link!</p>
        )}
      </div>
    </div>
  );
}
