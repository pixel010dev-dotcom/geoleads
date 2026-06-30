'use client';

import { useMemo } from 'react';
import { useTranslations } from '@/lib/i18n';
import { ResponsiveContainer, PieChart, Pie, Cell, Area, AreaChart } from 'recharts';

const COLORS = ['#3b82f6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444'];

export default function DashboardCharts({ tokens, leads, planName }: { tokens: number; leads: any[]; planName?: string }) {
  const { t, locale } = useTranslations();
  const totalLeads = leads.length;

  const stageLabels = useMemo(() => ({
    Novo: t('charts.stageNew'),
    'Em Contato': t('charts.stageContact'),
    Proposta: t('charts.stageProposal'),
    Fechado: t('charts.stageWon'),
    Perdido: t('charts.stageLost'),
  }), [t]);

  const leadsByStage = useMemo(() => {
    const stages: Record<string, number> = {};
    for (const lead of leads) {
      const stage = lead.stage || 'Novo';
      stages[stage] = (stages[stage] || 0) + 1;
    }
    return Object.entries(stages)
      .map(([name, value]) => ({ name: stageLabels[name as keyof typeof stageLabels] || name, value }))
      .sort((a, b) => b.value - a.value);
  }, [leads, stageLabels]);

  const leadsByMonth = useMemo(() => {
    const months: Record<string, number> = {};
    const now = new Date();
    for (const lead of leads) {
      if (lead.savedAt || lead.saved_at) {
        const d = new Date(lead.savedAt || lead.saved_at);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        months[key] = (months[key] || 0) + 1;
      }
    }
    const last6 = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString(locale === 'en' ? 'en-US' : 'pt-BR', { month: 'short', year: '2-digit' }).replace(/\./g, '');
      last6.push({ month: label, leads: months[key] || 0 });
    }
    return last6;
  }, [leads, locale]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      {/* Token Balance */}
      <div className="app-card p-5 rounded-2xl">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider">{t('charts.tokenBalance')}</span>
          <span className="text-lg">🪙</span>
        </div>
        <div className="text-3xl font-extrabold text-white mb-2">{tokens.toLocaleString(locale === 'en' ? 'en-US' : 'pt-BR')}</div>
        <div className="h-2 bg-white/5 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full transition-all"
            style={{ width: `${Math.min(100, (tokens / 2000) * 100)}%` }}
          />
        </div>
        <p className="text-[10px] text-gray-500 mt-2">{t('charts.planInfo', { plan: planName || 'Max', used: tokens.toLocaleString(locale === 'en' ? 'en-US' : 'pt-BR'), total: '2.000' })}</p>
      </div>

      {/* Total Leads */}
      <div className="app-card p-5 rounded-2xl">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider">{t('charts.totalLeads')}</span>
          <span className="text-lg">📊</span>
        </div>
        <div className="text-3xl font-extrabold text-white mb-2">{totalLeads}</div>
        <div className="h-24">
          {totalLeads > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={leadsByMonth}>
                <defs>
                  <linearGradient id="leadsGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area type="monotone" dataKey="leads" stroke="#3b82f6" fill="url(#leadsGradient)" strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500 text-xs text-center">
              {t('charts.noLeads')}
            </div>
          )}
        </div>
      </div>

      {/* Leads by Stage */}
      <div className="app-card p-5 rounded-2xl">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider">{t('charts.leadsByStage')}</span>
          <span className="text-lg">🎯</span>
        </div>
        {leadsByStage.length > 0 ? (
          <div className="flex items-center gap-4">
            <div className="w-24 h-24 flex-shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={leadsByStage} cx="50%" cy="50%" innerRadius={20} outerRadius={36} dataKey="value" stroke="none">
                    {leadsByStage.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 min-w-0 space-y-1">
              {leadsByStage.map((item, i) => (
                <div key={item.name} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[i] }} />
                    <span className="text-gray-400 truncate">{item.name}</span>
                  </div>
                  <span className="text-white font-bold ml-2">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-24 text-gray-500 text-xs text-center">
            {t('charts.noLeadsCRM')}
          </div>
        )}
      </div>
    </div>
  );
}
