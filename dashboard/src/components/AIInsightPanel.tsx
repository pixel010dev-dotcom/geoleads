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
    const withEmail = crmLeads.filter(l => l.email && l.email !== 'Não informado').length;
    const withCnpj = crmLeads.filter(l => l.cnpj && l.cnpj !== 'Não informado').length;
    const withSocial = crmLeads.filter(l => l.instagram || l.facebook || l.tiktok).length;
    const withSite = crmLeads.filter(l => l.site && l.site !== 'Sem site').length;

    // Oportunidade: leads com telefone mas sem WhatsApp disparado
    const withoutWhatsApp = crmLeads.filter(l =>
      l.telefone && l.telefone !== 'Não informado'
    ).length;
    if (withoutWhatsApp >= 5) {
      result.push({
        icon: '📱',
        title: `${withoutWhatsApp} leads prontos para WhatsApp`,
        description: 'Estes leads têm telefone válido. Que tal iniciar uma campanha de disparo?',
        type: 'opportunity',
        action: 'Iniciar disparo',
      });
    }

    // Oportunidade: leads sem enriquecimento
    const needsEnrich = crmLeads.filter(l =>
      (!l.email || l.email === 'Não informado') ||
      (!l.cnpj || l.cnpj === 'Não informado')
    ).length;
    if (needsEnrich >= 3) {
      result.push({
        icon: '✨',
        title: `${needsEnrich} leads podem ser enriquecidos`,
        description: 'Email e CNPJ podem ser descobertos para melhorar a qualificação.',
        type: 'opportunity',
        action: 'Enriquecer leads',
      });
    }

    // Warning: leads sem telefone
    const noPhone = crmLeads.filter(l =>
      !l.telefone || l.telefone === 'Não informado'
    ).length;
    if (noPhone > 0) {
      result.push({
        icon: '⚠️',
        title: `${noPhone} leads sem telefone`,
        description: 'Leads sem telefone têm baixa chance de conversão. Considere enriquecê-los.',
        type: 'warning',
      });
    }

    // Info: estatísticas gerais
    if (total >= 3) {
      result.push({
        icon: '📊',
        title: `${total} leads no CRM`,
        description: `${withPhone} com telefone · ${withEmail} com email · ${withCnpj} com CNPJ · ${withSocial} com redes sociais · ${withSite} com site`,
        type: 'info',
      });
    }

    // Oportunidade: leads com CNPJ mas sem dados de contato
    const cnpjOnly = crmLeads.filter(l =>
      l.cnpj && l.cnpj !== 'Não informado' &&
      (!l.email || l.email === 'Não informado') &&
      (!l.telefone || l.telefone === 'Não informado')
    ).length;
    if (cnpjOnly >= 2) {
      result.push({
        icon: '🏢',
        title: `${cnpjOnly} leads com CNPJ mas sem contato`,
        description: 'O CNPJ pode ser usado para buscar telefone e email via BrasilAPI.',
        type: 'opportunity',
        action: 'Enriquecer por CNPJ',
      });
    }

    // Warning: dados desatualizados
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const oldLeads = crmLeads.filter(l => {
      if (!l.savedAt) return false;
      const d = new Date(l.savedAt).getTime();
      return isNaN(d) || d < weekAgo;
    }).length;
    if (oldLeads > 0 && oldLeads > total * 0.5) {
      result.push({
        icon: '🕐',
        title: `${oldLeads} leads podem estar desatualizados`,
        description: 'Mais da metade dos seus leads foram adicionados há mais de 7 dias.',
        type: 'warning',
      });
    }

    // Limit to 5 insights
    return result.slice(0, 5);
  }, [crmLeads]);

  if (insights.length === 0) return null;

  return (
    <div className="space-y-2">
      <h3 className="text-xs uppercase tracking-widest text-gray-500 font-bold px-1">Insights</h3>
      <div className="space-y-1.5">
        {insights.map((insight, i) => (
          <div
            key={i}
            className={`p-3 rounded-xl text-sm ${
              insight.type === 'opportunity'
                ? 'bg-green-500/5 border border-green-500/10'
                : insight.type === 'warning'
                  ? 'bg-amber-500/5 border border-amber-500/10'
                  : 'bg-blue-500/5 border border-blue-500/10'
            }`}
          >
            <div className="flex items-start gap-2.5">
              <span className="text-base mt-0.5">{insight.icon}</span>
              <div className="flex-1 min-w-0">
                <p className={`font-bold text-xs ${
                  insight.type === 'opportunity'
                    ? 'text-green-300'
                    : insight.type === 'warning'
                      ? 'text-amber-300'
                      : 'text-blue-300'
                }`}>
                  {insight.title}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">{insight.description}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
