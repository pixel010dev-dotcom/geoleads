'use client';

import { useState, useMemo } from 'react';
import { showToast } from '@/components/Toast';

type SocialFilter = 'all' | 'facebook' | 'instagram' | 'tiktok';

const SOCIAL_ICONS: Record<string, string> = {
  facebook: '📘',
  instagram: '📷',
  tiktok: '🎵'
};

const SOCIAL_LABELS: Record<string, string> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  tiktok: 'TikTok'
};

export default function FacebookAds({
  crmLeads = [],
  showToast: toast,
  onUpdateCRM
}: {
  crmLeads: any[];
  showToast?: (msg: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
  onUpdateCRM?: (leads: any[]) => void;
}) {
  const [filter, setFilter] = useState<SocialFilter>('all');
  const [search, setSearch] = useState('');

  const t = toast || showToast;

  const leadsWithSocial = useMemo(() => {
    return crmLeads.filter(l => l.facebook || l.instagram || l.tiktok);
  }, [crmLeads]);

  const stats = useMemo(() => ({
    total: leadsWithSocial.length,
    facebook: leadsWithSocial.filter(l => l.facebook).length,
    instagram: leadsWithSocial.filter(l => l.instagram).length,
    tiktok: leadsWithSocial.filter(l => l.tiktok).length,
  }), [leadsWithSocial]);

  const filtered = useMemo(() => {
    let list = leadsWithSocial;
    if (filter === 'facebook') list = list.filter(l => l.facebook);
    else if (filter === 'instagram') list = list.filter(l => l.instagram);
    else if (filter === 'tiktok') list = list.filter(l => l.tiktok);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(l => l.nome?.toLowerCase().includes(q) || l.telefone?.includes(q));
    }
    return list;
  }, [leadsWithSocial, filter, search]);

  const markVisited = (lead: any) => {
    if (!onUpdateCRM) return;
    const tags = Array.isArray(lead.tags) ? lead.tags : [];
    if (tags.includes('🟢 Visitado')) {
      t('Já marcado como visitado.', 'info');
      return;
    }
    const updated = crmLeads.map(l =>
      l.nome === lead.nome ? { ...l, tags: [...tags, '🟢 Visitado'] } : l
    );
    onUpdateCRM(updated);
    t(`"${lead.nome}" marcado como visitado!`, 'success');
  };

  const copyLink = (url: string, label: string) => {
    navigator.clipboard.writeText(url);
    t(`Link do ${label} copiado!`, 'success');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">📘 Redes dos Leads</h2>
        <span className="text-xs text-gray-500 bg-white/5 px-3 py-1.5 rounded-full border border-white/10">
          {stats.total} leads com redes
        </span>
      </div>

      {crmLeads.length === 0 && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-6 text-center">
          <p className="text-amber-400 font-semibold mb-1">Nenhum lead no CRM</p>
          <p className="text-gray-400 text-sm">Extraia leads primeiro e salve no CRM para ver as redes sociais aqui.</p>
        </div>
      )}

      {crmLeads.length > 0 && stats.total === 0 && (
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-6 text-center">
          <p className="text-blue-400 font-semibold mb-1">Nenhuma rede social encontrada</p>
          <p className="text-gray-400 text-sm">Os leads no CRM ainda não têm Facebook, Instagram ou TikTok registrados. Tente re-enriquecer os leads na aba Dados.</p>
        </div>
      )}

      {stats.total > 0 && (
        <>
          <div className="grid grid-cols-4 gap-2 sm:gap-3">
            {[
              { key: 'all' as SocialFilter, label: 'Todos', count: stats.total, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
              { key: 'facebook' as SocialFilter, label: '📘 Facebook', count: stats.facebook, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
              { key: 'instagram' as SocialFilter, label: '📷 Instagram', count: stats.instagram, color: 'text-pink-400', bg: 'bg-pink-500/10 border-pink-500/20' },
              { key: 'tiktok' as SocialFilter, label: '🎵 TikTok', count: stats.tiktok, color: 'text-gray-300', bg: 'bg-white/5 border-white/10' },
            ].map(s => (
              <button key={s.key} onClick={() => setFilter(s.key)} className={`rounded-xl p-3 border text-left transition-all cursor-pointer ${filter === s.key ? `${s.bg} ${s.color}` : 'bg-black/20 border-white/5 text-gray-400 hover:bg-white/5'}`}>
                <div className="text-lg font-bold">{s.count}</div>
                <div className="text-xs">{s.label}</div>
              </button>
            ))}
          </div>

          <div className="relative">
            <input
              type="text" placeholder="Buscar por nome ou telefone..." value={search} onChange={e => setSearch(e.target.value)}
              className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50"
            />
          </div>

          {filtered.length === 0 && (
            <div className="text-center py-8 text-gray-500 text-sm">Nenhum lead encontrado com esse filtro.</div>
          )}

          <div className="space-y-2">
            {filtered.map((lead, i) => (
              <div key={i} className="rounded-xl border border-white/5 bg-black/30 p-3 sm:p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">{lead.nome}</span>
                      {lead.telefone && lead.telefone !== 'Não informado' && (
                        <span className="text-xs text-gray-500">{lead.telefone}</span>
                      )}
                    </div>
                  </div>
                  {Array.isArray(lead.tags) && lead.tags.includes('🟢 Visitado') && (
                    <span className="text-[10px] text-green-400 bg-green-500/10 px-2 py-0.5 rounded-full border border-green-500/20 whitespace-nowrap">🟢 Visitado</span>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {['facebook', 'instagram', 'tiktok'].map(social => {
                    const url = lead[social];
                    if (!url) return null;
                    return (
                      <div key={social} className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs">
                        <span>{SOCIAL_ICONS[social]}</span>
                        <span className="text-gray-400 max-w-[120px] truncate">{url.replace(/https?:\/\/(www\.)?/, '')}</span>
                        <a href={url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 ml-1 cursor-pointer" title={`Abrir ${SOCIAL_LABELS[social]}`}>↗</a>
                        <button onClick={() => copyLink(url, SOCIAL_LABELS[social])} className="text-gray-500 hover:text-white ml-0.5 cursor-pointer" title={`Copiar link do ${SOCIAL_LABELS[social]}`}>📋</button>
                      </div>
                    );
                  })}
                  <button onClick={() => markVisited(lead)} className="text-[11px] px-2.5 py-1.5 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 hover:bg-green-500/20 cursor-pointer transition-colors">
                    ✅ Marcar visitado
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
