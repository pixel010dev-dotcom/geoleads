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

          {/* WhatsApp viral button */}
          <a
            href={`https://wa.me/?text=${encodeURIComponent('🎉 Acabei de ganhar tokens extras no GeoLeads! É uma ferramenta que extrai leads do Google Maps e dispara no WhatsApp automaticamente. Testa grátis: ' + referralUrl)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl bg-green-600 hover:bg-green-500 text-white font-bold text-sm transition-all mb-3 cursor-pointer"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            Compartilhar no WhatsApp e Ganhar Tokens
          </a>

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
