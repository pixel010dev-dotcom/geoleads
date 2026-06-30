'use client';

import type { CrmLead } from '@/types/crm';

function computeLeadScore(lead: CrmLead): number {
  let score = 0;
  if (lead.telefone && lead.telefone !== 'Não informado') score += 30;
  if (lead.email && lead.email !== 'Não informado') score += 20;
  if (lead.cnpj && lead.cnpj !== 'Não informado') score += 20;
  if (lead.instagram || lead.facebook || lead.tiktok) score += 15;
  if (lead.site && lead.site !== 'Sem site') score += 15;
  return Math.min(score, 100);
}

function scoreLabel(score: number): { label: string; color: string; icon: string } {
  if (score >= 80) return { label: 'Alto', color: 'text-green-400', icon: '🔥' };
  if (score >= 50) return { label: 'Médio', color: 'text-amber-400', icon: '⚡' };
  return { label: 'Baixo', color: 'text-gray-500', icon: '💤' };
}

export function LeadScoreBadge({ lead }: { lead: CrmLead }) {
  const score = computeLeadScore(lead);
  const { label, color, icon } = scoreLabel(score);

  return (
    <span className={`inline-flex items-center gap-1 text-xs font-bold ${color}`} title={`Score: ${score}/100`}>
      <span className="text-[10px]">{icon}</span>
      <span>{label}</span>
      <span className="text-[10px] opacity-60">({score})</span>
    </span>
  );
}

export function LeadScoreBar({ lead }: { lead: CrmLead }) {
  const score = computeLeadScore(lead);
  const { label, color } = scoreLabel(score);

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${score}%`,
            background: score >= 80
              ? 'linear-gradient(90deg, #10b981, #34d399)'
              : score >= 50
                ? 'linear-gradient(90deg, #f59e0b, #fbbf24)'
                : 'linear-gradient(90deg, #6b7280, #9ca3af)',
          }}
        />
      </div>
      <span className={`text-[10px] font-bold ${color} w-12 text-right`}>
        {label} ({score})
      </span>
    </div>
  );
}

export function computeLeadScores(leads: CrmLead[]): {
  byScore: CrmLead[];
  highCount: number;
  mediumCount: number;
  lowCount: number;
  averageScore: number;
} {
  const withScores = leads.map(l => ({ lead: l, score: computeLeadScore(l) }));
  const highCount = withScores.filter(s => s.score >= 80).length;
  const mediumCount = withScores.filter(s => s.score >= 50 && s.score < 80).length;
  const lowCount = withScores.filter(s => s.score < 50).length;
  const averageScore = leads.length > 0
    ? Math.round(withScores.reduce((sum, s) => sum + s.score, 0) / leads.length)
    : 0;
  const byScore = withScores.sort((a, b) => b.score - a.score).map(s => s.lead);

  return { byScore, highCount, mediumCount, lowCount, averageScore };
}
