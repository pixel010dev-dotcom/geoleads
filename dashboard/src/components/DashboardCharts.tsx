'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { ResponsiveContainer, PieChart, Pie, Cell, Area, AreaChart } from 'recharts';

const COLORS = ['#3b82f6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444'];
const STAGE_LABELS: Record<string, string> = {
  Novo: 'Novo',
  'Em Contato': 'Em Contato',
  Proposta: 'Proposta',
  Fechado: 'Fechado',
  Perdido: 'Perdido',
};

export default function DashboardCharts({ userId }: { userId: string }) {
  const [leadsByMonth, setLeadsByMonth] = useState<{ month: string; leads: number }[]>([]);
  const [leadsByStage, setLeadsByStage] = useState<{ name: string; value: number }[]>([]);
  const [totalLeads, setTotalLeads] = useState(0);
  const [tokenBalance, setTokenBalance] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;

    const fetchData = async () => {
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('tokens')
          .eq('id', userId)
          .single();
        setTokenBalance(profile?.tokens ?? 0);

        const { data: leads } = await supabase
          .from('crm_leads')
          .select('stage, saved_at')
          .eq('user_id', userId);

        if (!leads) return;

        setTotalLeads(leads.length);

        const stages: Record<string, number> = {};
        const months: Record<string, number> = {};
        const now = new Date();

        for (const lead of leads) {
          const stage = lead.stage || 'Novo';
          stages[stage] = (stages[stage] || 0) + 1;

          if (lead.saved_at) {
            const d = new Date(lead.saved_at);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            months[key] = (months[key] || 0) + 1;
          }
        }

        const stageData = Object.entries(stages)
          .map(([name, value]) => ({ name: STAGE_LABELS[name] || name, value }))
          .sort((a, b) => b.value - a.value);
        setLeadsByStage(stageData);

        const last6 = [];
        for (let i = 5; i >= 0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          const label = d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }).replace(/\./g, '');
          last6.push({ month: label, leads: months[key] || 0 });
        }
        setLeadsByMonth(last6);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [userId]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="app-card p-5 rounded-2xl animate-pulse">
            <div className="h-4 bg-white/5 rounded w-1/2 mb-3" />
            <div className="h-8 bg-white/5 rounded w-1/3 mb-2" />
            <div className="h-24 bg-white/5 rounded" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      {/* Token Balance */}
      <div className="app-card p-5 rounded-2xl">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Saldo de Tokens</span>
          <span className="text-lg">🪙</span>
        </div>
        <div className="text-3xl font-extrabold text-white mb-2">{tokenBalance.toLocaleString('pt-BR')}</div>
        <div className="h-2 bg-white/5 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full transition-all"
            style={{ width: `${Math.min(100, (tokenBalance / 10000) * 100)}%` }}
          />
        </div>
        <p className="text-[10px] text-gray-500 mt-2">Baseado em 10.000 tokens</p>
      </div>

      {/* Total Leads */}
      <div className="app-card p-5 rounded-2xl">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Total de Leads</span>
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
              Nenhum lead ainda.<br />Extraia seus primeiros leads!
            </div>
          )}
        </div>
      </div>

      {/* Leads by Stage */}
      <div className="app-card p-5 rounded-2xl">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Leads por Estágio</span>
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
            Nenhum lead no CRM.<br />Salve leads para ver a distribuição.
          </div>
        )}
      </div>
    </div>
  );
}
