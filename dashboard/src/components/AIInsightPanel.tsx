'use client';

import { useMemo } from 'react';
import type { CrmLead } from '@/types/crm';

interface AIInsightPanelProps {
  crmLeads: CrmLead[];
}

interface Insight {
  icon: string;
  title: string;
  description: string;
  type: 'opportunity' | 'warning' | 'info';
  action?: string;
}

export default function AIInsightPanel({ crmLeads }: AIInsightPanelProps) {
  const insights = useMemo<Insight[]>(() => {
    const result: Insight[] = [];

    const total = crmLeads.length;
    if (total === 0) {
      result.push({
        icon: '💡',
        title: 'Comece extraindo leads',
        description: 'Use o extrator do Google Maps para encontrar seus primeiros clientes.',
        type: 'info',
        action: 'Extrair leads',
      });
      return result;
    }

    const withPhone = crmLeads.filter(l => l.telefone && l.telefone !== 'Não informado').length;
    const withSite = crmLeads.filter(l => l.site && l.site !== 'Sem site').length;

    // Oportunidade: leads com WhatsApp disponível
    if (withPhone >= 5) {
      result.push({
        icon: '📱',
        title: `${withPhone} leads com WhatsApp`,
        description: 'Estes leads têm telefone válido. Mande uma mensagem agora!',
        type: 'opportunity',
        action: 'Iniciar disparo',
      });
    }

    // Info: estatísticas gerais
    if (total >= 3) {
      const comps: string[] = [];
      if (withPhone > 0) comps.push(`${withPhone} com telefone`);
      if (withSite > 0) comps.push(`${withSite} com site`);

      result.push({
        icon: '📊',
        title: `${total} leads no CRM`,
        description: comps.join(' · ') || 'Nenhum dado de contato disponível',
        type: 'info',
      });
    }

    return result.slice(0, 3);
  }, [crmLeads]);

  if (insights.length === 0) return null;

  return (
    <div className="space-y-3 mb-6">
      {insights.map((insight, i) => (
        <div
          key={i}
          className={`p-4 rounded-xl border ${
            insight.type === 'opportunity'
              ? 'bg-green-500/5 border-green-500/15'
              : insight.type === 'warning'
              ? 'bg-amber-500/5 border-amber-500/15'
              : 'bg-blue-500/5 border-blue-500/15'
          }`}
        >
          <div className="flex items-start gap-3">
            <span className="text-lg flex-shrink-0">{insight.icon}</span>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm text-white">{insight.title}</p>
              <p className="text-xs text-gray-400 mt-0.5">{insight.description}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}