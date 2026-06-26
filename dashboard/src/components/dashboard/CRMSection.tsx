'use client';

import { useState, useMemo } from 'react';
import { getLeadKey, normalizeCrmLead } from './dashboard-constants';
import { showToast } from '@/components/Toast';
import dynamic from 'next/dynamic';
import { useTranslations } from '@/lib/i18n';

const HackMap = dynamic(() => import('@/components/HackMap'), { ssr: false, loading: () => <div className="h-[320px] sm:h-[400px] rounded-2xl bg-black/50 border border-green-500/20 flex items-center justify-center text-green-400/50 text-sm font-mono">INICIALIZANDO MAPA...</div> });

function exportCrmToCsv(t: Function, leads: any[], filename: string) {
  const cols = [
    t('crm.csvName'),
    t('crm.csvPhone'),
    t('crm.csvEmail'),
    t('crm.csvSite'),
    t('crm.csvInstagram'),
    t('crm.csvFacebook'),
    t('crm.csvTiktok'),
    t('crm.csvCnpj'),
    t('crm.tableFunnel'),
    t('crm.tableTags'),
    t('crm.tableNotes'),
    t('crm.csvCity'),
    t('crm.csvNiche'),
    t('crm.csvRating'),
  ];
  const keyMap: Record<string, string> = {
    [t('crm.csvName')]: 'nome',
    [t('crm.csvPhone')]: 'telefone',
    [t('crm.csvEmail')]: 'email',
    [t('crm.csvSite')]: 'site',
    [t('crm.csvInstagram')]: 'instagram',
    [t('crm.csvFacebook')]: 'facebook',
    [t('crm.csvTiktok')]: 'tiktok',
    [t('crm.csvCnpj')]: 'cnpj',
  };
  const rows = leads.map(l => cols.map(c => {
    const field = keyMap[c] || c.toLowerCase();
    const val = l[field] ?? '';
    const str = Array.isArray(val) ? val.join('; ') : String(val);
    return `"${str.replace(/"/g, '""')}"`;
  }).join(','));
  const bom = '\uFEFF';
  const blob = new Blob([bom + cols.join(',') + '\n' + rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export interface CRMSectionProps {
  crmLeads: any[];
  crmSearch: string;
  setCrmSearch: (v: string) => void;
  crmFilterStage: string;
  setCrmFilterStage: (v: string) => void;
  selectedCrmLeads: string[];
  setSelectedCrmLeads: (v: string[]) => void;
  crmSyncStatus: string;
  crmSyncMessage: string;
  crmPage: number;
  setCrmPage: (v: number) => void;
  bulkStageLoading: boolean;
  bulkStageTarget: string;
  setBulkStageTarget: (v: string) => void;
  handleRemoveFromCRM: (nome: string) => void;
  handleToggleSelectCrmLead: (nome: string) => void;
  handleToggleSelectAllCrmLeads: (filteredLeads: any[]) => void;
  handleRemoveSelectedFromCRM: () => void;
  handleBulkStageChange: () => Promise<void>;
  handleUpdateCRMLead: (nome: string, field: 'stage' | 'notes' | 'tags', value: string) => void;
  openWhatsApp: (lead: any) => void;
  waSentMessages?: any[];
  onImportLeads?: (leads: any[]) => void;
  batchEnrichProgress?: { total: number; completed: number; failed: number; percentage: number; status: string } | null;
}

const CRM_PAGE_SIZE = 25;

const TAG_CONFIG: Record<string, { icon: string; color: string }> = {
  'Quente': { icon: '🔥', color: 'bg-red-500/15 border-red-500/25 text-red-300' },
  'Morno': { icon: '⚡', color: 'bg-amber-500/15 border-amber-500/25 text-amber-300' },
  'Frio': { icon: '❄️', color: 'bg-blue-500/15 border-blue-500/25 text-blue-300' },
  'Agendar': { icon: '📅', color: 'bg-purple-500/15 border-purple-500/25 text-purple-300' },
  'Ligou': { icon: '📞', color: 'bg-green-500/15 border-green-500/25 text-green-300' },
  'Não respondeu': { icon: '🔇', color: 'bg-gray-500/15 border-gray-500/25 text-gray-300' },
  'Indicação': { icon: '👥', color: 'bg-orange-500/15 border-orange-500/25 text-orange-300' },
};
const ALL_TAGS = Object.keys(TAG_CONFIG);

function getTagLabel(tag: string, t: Function): string {
  const tagKeyMap: Record<string, string> = {
    'Quente': 'crm.hotLabel',
    'Morno': 'crm.warmLabel',
    'Frio': 'crm.coldLabel',
    'Agendar': 'crm.scheduleLabel',
    'Ligou': 'crm.calledLabel',
    'Não respondeu': 'crm.noAnswerLabel',
    'Indicação': 'crm.referralLabel',
  };
  if (tagKeyMap[tag]) return t(tagKeyMap[tag]);
  return tag;
}

function TagBadge({ tag, onRemove, t: tFn }: { tag: string; onRemove?: () => void; t: Function }) {
  const cfg = TAG_CONFIG[tag];
  const base = 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-medium';
  const style = cfg?.color || 'bg-indigo-500/15 border-indigo-500/25 text-indigo-300';
  return (
    <span className={`${base} ${style}`}>
      {cfg?.icon && <span>{cfg.icon}</span>}
      {getTagLabel(tag, tFn)}
      {onRemove && (
        <button onClick={onRemove} className="hover:text-white ml-0.5 cursor-pointer text-[13px] leading-none opacity-60 hover:opacity-100 transition-opacity">&times;</button>
      )}
    </span>
  );
}

export default function CRMSection({
  crmLeads,
  crmSearch,
  setCrmSearch,
  crmFilterStage,
  setCrmFilterStage,
  selectedCrmLeads,
  setSelectedCrmLeads,
  crmSyncStatus,
  crmSyncMessage,
  crmPage,
  setCrmPage,
  bulkStageLoading,
  bulkStageTarget,
  setBulkStageTarget,
  handleRemoveFromCRM,
  handleToggleSelectCrmLead,
  handleToggleSelectAllCrmLeads,
  handleRemoveSelectedFromCRM,
  handleBulkStageChange,
  handleUpdateCRMLead,
  openWhatsApp,
  waSentMessages,
  onImportLeads,
  batchEnrichProgress,
}: CRMSectionProps) {
  const { t, locale } = useTranslations();
  const waSentNames = new Set((waSentMessages || []).map((m: any) => m.lead_name).filter(Boolean));
  const [crmFilterTag, setCrmFilterTag] = useState('all');
  const [crmSortField, setCrmSortField] = useState('nome');
  const [crmSortDir, setCrmSortDir] = useState<'asc' | 'desc'>('asc');
  const [tagInputs, setTagInputs] = useState<Record<string, string>>({});
  const [showTagMenu, setShowTagMenu] = useState<Record<string, boolean>>({});
  const [crmViewMode, setCrmViewMode] = useState<'table' | 'kanban' | 'map'>('table');
  const [showImport, setShowImport] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<any[] | null>(null);
  const [importColumnMap, setImportColumnMap] = useState<Record<string, string>>({});
  const [importLoading, setImportLoading] = useState(false);
  const [importUnmapped, setImportUnmapped] = useState<string[]>([]);
  const [importCsvHeaders, setImportCsvHeaders] = useState<string[]>([]);

  const toggleTag = (leadNome: string, tag: string) => {
    const lead = crmLeads.find(l => l.nome === leadNome);
    if (!lead) return;
    const tags = Array.isArray(lead.tags) ? [...lead.tags] : [];
    const idx = tags.indexOf(tag);
    if (idx >= 0) tags.splice(idx, 1);
    else tags.push(tag);
    handleUpdateCRMLead(leadNome, 'tags', tags.join(','));
  };

  const allUsedTags = [...new Set(crmLeads.flatMap(l => Array.isArray(l.tags) ? l.tags : []))].sort();

  const filteredCrmLeads = useMemo(() => {
    const filtered = crmLeads.filter(lead => {
      const matchesSearch = 
        lead.nome.toLowerCase().includes(crmSearch.toLowerCase()) || 
        lead.telefone.toLowerCase().includes(crmSearch.toLowerCase()) ||
        lead.email?.toLowerCase().includes(crmSearch.toLowerCase()) ||
        lead.cnpj?.toLowerCase().includes(crmSearch.toLowerCase()) ||
        lead.nicho.toLowerCase().includes(crmSearch.toLowerCase()) ||
        lead.cidade.toLowerCase().includes(crmSearch.toLowerCase());
      if (crmFilterStage !== 'all' && lead.stage !== crmFilterStage) return false;
      if (crmFilterTag !== 'all') {
        const tags = Array.isArray(lead.tags) ? lead.tags : [];
        if (!tags.includes(crmFilterTag)) return false;
      }
      return matchesSearch;
    });
    filtered.sort((a, b) => {
      let va = (a[crmSortField] || '').toString().toLowerCase();
      let vb = (b[crmSortField] || '').toString().toLowerCase();
      if (crmSortField === 'savedAt') { va = a.savedAt || ''; vb = b.savedAt || ''; }
      return crmSortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
    });
    return filtered;
  }, [crmLeads, crmSearch, crmFilterStage, crmFilterTag, crmSortField, crmSortDir]);
  const crmTotalPages = Math.max(1, Math.ceil(filteredCrmLeads.length / CRM_PAGE_SIZE));
  const safeCrmPage = Math.min(crmPage, crmTotalPages - 1);
  const paginatedCrmLeads = filteredCrmLeads.slice(safeCrmPage * CRM_PAGE_SIZE, (safeCrmPage + 1) * CRM_PAGE_SIZE);

  const stageLabel = (stage: string): string => {
    const map: Record<string, string> = {
      'Novo': 'crm.stageNew',
      'Em Contato': 'crm.stageContact',
      'Proposta': 'crm.stageProposal',
      'Fechado': 'crm.stageWon',
      'Perdido': 'crm.stageLost',
    };
    return map[stage] ? t(map[stage]) : stage;
  };

  return (
    <div className="app-card p-7 rounded-[2rem] bg-gradient-to-b from-white/[0.03] to-black/40 border border-white/10 shadow-2xl relative overflow-hidden animate-slide-up">
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-500" />
      
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            {t('crm.title')}
          </h2>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <p className="text-xs text-gray-500">{t('crm.subtitle')}</p>
            <span className={`text-[10px] px-2 py-1 rounded-full border font-bold ${
              crmSyncStatus === 'cloud' ? 'bg-green-500/10 border-green-500/20 text-green-400' :
              crmSyncStatus === 'syncing' ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' :
              crmSyncStatus === 'error' ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' :
              'bg-white/5 border-white/10 text-gray-400'
            }`}>
              {crmSyncMessage}
            </span>
          </div>
        </div>

        {/* TOOLBAR: Search + Filters */}
        <div className="flex flex-wrap items-center gap-2 w-full">
          <input 
            type="text" 
            placeholder={t('crm.search')}
            className="flex-1 min-w-[140px] bg-black/50 border border-white/10 rounded-xl px-4 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500"
            value={crmSearch}
            onChange={(e) => setCrmSearch(e.target.value)}
          />
          <select
            value={crmFilterStage}
            onChange={(e) => setCrmFilterStage(e.target.value)}
            style={{ colorScheme: 'dark' }}
            className="bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 cursor-pointer"
          >
            <option value="all">{t('crm.filterStage')}: {t('crm.filterAll')}</option>
            <option value="Novo">{t('crm.stageNew')}</option>
            <option value="Em Contato">{t('crm.stageContact')}</option>
            <option value="Proposta">{t('crm.stageProposal')}</option>
            <option value="Fechado">{t('crm.stageWon')}</option>
            <option value="Perdido">{t('crm.stageLost')}</option>
          </select>
          {allUsedTags.length > 0 && (
            <select
              value={crmFilterTag}
              onChange={(e) => setCrmFilterTag(e.target.value)}
              style={{ colorScheme: 'dark' }}
              className="bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="all">{t('crm.filterTag')}: {t('crm.filterAll')}</option>
              {allUsedTags.map((tag: string) => <option key={tag} value={tag}>{getTagLabel(tag, t)}</option>)}
            </select>
          )}
          {/* Right side: actions */}
          <div className="flex items-center gap-2 ml-auto">
            <button onClick={() => setShowImport(true)}
              className="px-3 py-2 rounded-xl bg-cyan-600/80 hover:bg-cyan-600 text-white border border-cyan-500/30 text-xs font-semibold cursor-pointer transition-colors whitespace-nowrap">
              {t('crm.importCSV')}
            </button>
            {filteredCrmLeads.length > 0 && (
              <button
                onClick={() => exportCrmToCsv(t, filteredCrmLeads, `geoleads-crm-${new Date().toISOString().slice(0,10)}.csv`)}
                className="px-3 py-2 rounded-xl bg-emerald-600/80 hover:bg-emerald-600 text-white border border-emerald-500/30 text-xs font-semibold cursor-pointer transition-colors whitespace-nowrap"
              >
                {t('crm.exportCSV', { count: filteredCrmLeads.length })}
              </button>
            )}
            <button
              onClick={() => setCrmViewMode(v => v === 'table' ? 'kanban' : v === 'kanban' ? 'map' : 'table')}
              className={`px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-colors whitespace-nowrap border ${
                crmViewMode === 'kanban' ? 'bg-purple-600 border-purple-500/30 text-white' : crmViewMode === 'map' ? 'bg-green-700 border-green-500/30 text-white' : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'
              }`}
            >
              {crmViewMode === 'table' ? t('crm.viewKanban') : crmViewMode === 'kanban' ? t('crm.viewMap') : t('crm.viewTable')}
            </button>
          </div>
        </div>

        {/* BULK ACTIONS BAR */}
        {selectedCrmLeads.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2 px-3 py-2 rounded-xl bg-blue-500/5 border border-blue-500/15">
            <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer">
              <input 
                type="checkbox"
                checked={filteredCrmLeads.length > 0 && filteredCrmLeads.every(l => selectedCrmLeads.includes(l.nome))}
                onChange={() => handleToggleSelectAllCrmLeads(filteredCrmLeads)}
                className="rounded border-white/20 bg-black/40 text-blue-500 focus:ring-0 focus:ring-offset-0 cursor-pointer h-3.5 w-3.5"
              />
              {t('crm.selectAll')}
            </label>
            <span className="text-xs text-blue-300 font-semibold">{selectedCrmLeads.length} selecionados</span>
            <div className="flex items-center gap-1.5 ml-2">
              <span className="text-[11px] text-gray-400">{t('crm.moveTo')}</span>
              <select
                value={bulkStageTarget}
                onChange={(e) => setBulkStageTarget(e.target.value)}
                style={{ colorScheme: 'dark' }}
                className="bg-black/50 border border-white/10 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-blue-500 cursor-pointer"
              >
                <option value="Novo">{t('crm.stageNew')}</option>
                <option value="Em Contato">{t('crm.stageContact')}</option>
                <option value="Proposta">{t('crm.stageProposal')}</option>
                <option value="Fechado">{t('crm.stageWon')}</option>
                <option value="Perdido">{t('crm.stageLost')}</option>
              </select>
              <button
                onClick={handleBulkStageChange}
                disabled={bulkStageLoading}
                className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white border border-blue-500/30 text-[11px] font-semibold cursor-pointer transition-colors disabled:opacity-50"
              >
                {bulkStageLoading ? t('crm.applying') : t('crm.apply')}
              </button>
            </div>
            <button
              onClick={handleRemoveSelectedFromCRM}
              className="ml-auto px-3 py-1.5 rounded-lg bg-red-600/80 hover:bg-red-600 text-white border border-red-500/30 text-[11px] font-semibold cursor-pointer transition-colors"
            >
              {t('crm.delete', { count: selectedCrmLeads.length })}
            </button>
          </div>
        )}
      </div>

      {/* BATCH ENRICHMENT PROGRESS BAR */}
      {batchEnrichProgress?.status === 'running' && (
        <div className="mb-4 bg-purple-500/5 border border-purple-500/15 rounded-xl p-3">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
              <span className="text-xs font-bold text-purple-300">Enriquecendo leads...</span>
            </div>
            <span className="text-xs text-gray-400 font-mono">
              {batchEnrichProgress.completed + batchEnrichProgress.failed}/{batchEnrichProgress.total} ({batchEnrichProgress.percentage}%)
            </span>
          </div>
          <div className="w-full h-2 bg-black/30 rounded-full overflow-hidden border border-white/5">
            <div
              className="h-full bg-gradient-to-r from-purple-600 to-pink-600 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${batchEnrichProgress.percentage}%` }}
            />
          </div>
          <div className="flex gap-3 mt-1.5 text-[10px]">
            <span className="text-green-400">{batchEnrichProgress.completed} concluídos</span>
            {batchEnrichProgress.failed > 0 && <span className="text-red-400">{batchEnrichProgress.failed} falhas</span>}
          </div>
        </div>
      )}

      {/* TABLE / CARDS CONTAINER */}
      {crmViewMode === 'table' && (
      <div className="rounded-2xl border border-white/5 bg-black/20 overflow-hidden overflow-y-auto max-h-[520px]">
        {/* Desktop Table */}
        <table className="hidden md:table w-full text-left text-sm">
          <thead className="bg-white/5 border-b border-white/5 text-gray-400">
            <tr>
              <th className="px-4 py-3 font-medium w-10 text-center">
                <input 
                  type="checkbox"
                  checked={filteredCrmLeads.length > 0 && filteredCrmLeads.every(l => selectedCrmLeads.includes(l.nome))}
                  onChange={() => handleToggleSelectAllCrmLeads(filteredCrmLeads)}
                  className="rounded border-white/20 bg-black/40 text-blue-500 focus:ring-0 focus:ring-offset-0 cursor-pointer h-4 w-4"
                />
              </th>
              <th className={`px-4 py-3 font-medium cursor-pointer hover:text-white select-none ${crmSortField === 'nome' ? 'text-white' : ''}`} onClick={() => { setCrmSortField('nome'); setCrmSortDir(d => d === 'asc' ? 'desc' : 'asc'); }}>
                {t('crm.tableLead')} {crmSortField === 'nome' ? (crmSortDir === 'asc' ? '↑' : '↓') : ''}
              </th>
              <th className="px-4 py-3 font-medium">{t('crm.tableContacts')}</th>
              <th className="px-4 py-3 font-medium">{t('crm.tableTags')}</th>
              <th className={`px-4 py-3 font-medium cursor-pointer hover:text-white select-none ${crmSortField === 'stage' ? 'text-white' : ''}`} onClick={() => { setCrmSortField('stage'); setCrmSortDir(d => d === 'asc' ? 'desc' : 'asc'); }}>
                {t('crm.tableFunnel')} {crmSortField === 'stage' ? (crmSortDir === 'asc' ? '↑' : '↓') : ''}
              </th>
              <th className="px-4 py-3 font-medium">{t('crm.tableNotes')}</th>
              <th className="px-4 py-3 font-medium">{t('crm.tableActions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {paginatedCrmLeads.map((lead, i) => (
              <tr key={i} className={`hover:bg-white/[0.03] transition-colors ${selectedCrmLeads.includes(lead.nome) ? 'bg-blue-500/5' : ''}`}>
                <td className="px-4 py-4 text-center">
                  <input 
                    type="checkbox"
                    checked={selectedCrmLeads.includes(lead.nome)}
                    onChange={() => handleToggleSelectCrmLead(lead.nome)}
                    className="rounded border-white/20 bg-black/40 text-blue-500 focus:ring-0 focus:ring-offset-0 cursor-pointer h-4 w-4"
                  />
                </td>
                <td className="px-4 py-4 font-medium text-gray-200">
                  <div className="font-bold">{lead.nome}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{lead.nicho} · {lead.cidade}</div>
                  {lead.site && lead.site !== 'Sem site' ? (
                    <a href={lead.site} target="_blank" className="text-xs text-blue-400 hover:underline mt-1 block">{t('crm.website')}</a>
                  ) : (
                    <span className="text-xs text-gray-600 mt-1 block">{t('crm.noWebsite')}</span>
                  )}
                  {lead.cnpj && (
                    <span className="block text-[11px] text-amber-300 font-mono mt-1">{t('crm.cnpj', { number: lead.cnpj })}</span>
                  )}
                </td>
                <td className="px-4 py-4 text-xs font-mono">
                  <div className="space-y-1">
                    {lead.telefone && lead.telefone !== 'Não informado' && (
                      <div className="text-gray-300">📞 {lead.telefone}</div>
                    )}
                    {lead.email && (
                      <div className="text-purple-400">✉️ {lead.email}</div>
                    )}
                    {lead.instagram && (
                      <a href={lead.instagram} target="_blank" className="text-pink-400 block hover:underline">📷 Instagram</a>
                    )}
                    {lead.facebook && (
                      <a href={lead.facebook} target="_blank" className="text-blue-400 block hover:underline">📘 Facebook</a>
                    )}
                    {lead.tiktok && (
                      <a href={lead.tiktok} target="_blank" className="text-cyan-300 block hover:underline">🎵 TikTok</a>
                    )}
                  </div>
                </td>
                <td className="px-4 py-4">
                  <div className="flex flex-wrap gap-1.5 items-center min-h-[28px]">
                    {(Array.isArray(lead.tags) ? lead.tags : []).map((tag: string) => (
                      <TagBadge key={tag} tag={tag} onRemove={() => toggleTag(lead.nome, tag)} t={t} />
                    ))}
                    <div className="flex items-center gap-1">
                      <select
                        value=""
                        onChange={(e) => { if (e.target.value) { toggleTag(lead.nome, e.target.value); } }}
                        style={{ colorScheme: 'dark' }}
                        className="px-2 py-1 rounded-lg bg-black/50 border border-white/10 text-[11px] text-gray-400 focus:outline-none focus:border-blue-500 cursor-pointer w-[28px] appearance-none"
                      >
                        <option value="">+</option>
                        {ALL_TAGS.filter(tag => !(Array.isArray(lead.tags) ? lead.tags : []).includes(tag)).map((tag: string) => (
                          <option key={tag} value={tag}>{getTagLabel(tag, t)}</option>
                        ))}
                      </select>
                      <input
                        type="text"
                        placeholder={t('crm.newTagPlaceholder')}
                        value={tagInputs[lead.nome] || ''}
                        onChange={(e) => setTagInputs(s => ({ ...s, [lead.nome]: e.target.value }))}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && tagInputs[lead.nome]?.trim()) {
                            toggleTag(lead.nome, tagInputs[lead.nome].trim());
                            setTagInputs(s => ({ ...s, [lead.nome]: '' }));
                          }
                        }}
                        className="w-16 bg-black/40 border border-white/5 rounded-lg px-1.5 py-1 text-[10px] text-gray-300 placeholder-gray-600 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>
                </td>
                <td className="px-4 py-4">
                  <select
                    value={lead.stage || 'Novo'}
                    onChange={(e) => handleUpdateCRMLead(lead.nome, 'stage', e.target.value)}
                    style={{ colorScheme: 'dark' }}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-bold focus:outline-none cursor-pointer ${
                      lead.stage === 'Novo' ? 'bg-blue-500/10 border-blue-500/30 text-blue-400' :
                      lead.stage === 'Em Contato' ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' :
                      lead.stage === 'Proposta' ? 'bg-purple-500/10 border-purple-500/30 text-purple-400' :
                      lead.stage === 'Fechado' ? 'bg-green-500/10 border-green-500/30 text-green-400' :
                      'bg-red-500/10 border-red-500/30 text-red-400'
                    }`}
                  >
                    <option value="Novo">{t('crm.stageNew')}</option>
                    <option value="Em Contato">{t('crm.stageContact')}</option>
                    <option value="Proposta">{t('crm.stageProposal')}</option>
                    <option value="Fechado">{t('crm.stageWon')}</option>
                    <option value="Perdido">{t('crm.stageLost')}</option>
                  </select>
                </td>
                <td className="px-4 py-4">
                  <textarea
                    placeholder={t('crm.clickToAnnotate')}
                    value={lead.notes || ''}
                    onChange={(e) => handleUpdateCRMLead(lead.nome, 'notes', e.target.value)}
                    className="w-full bg-black/40 border border-white/5 hover:border-white/10 focus:border-blue-500 focus:outline-none rounded-lg p-2 text-xs text-gray-300 resize-none h-14 transition-colors"
                  />
                </td>
                <td className="px-4 py-4">
                  <div className="flex items-center gap-2">
                    {waSentNames.has(lead.nome) && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20 font-bold" title={t('crm.whatsappSent')}>{t('crm.whatsappSent')}</span>
                    )}
                    {lead.telefone && lead.telefone !== 'Não informado' && (
                      <button
                        onClick={() => openWhatsApp(lead)}
                        className={`p-2 rounded border transition-colors text-xs font-semibold cursor-pointer ${
                          waSentNames.has(lead.nome)
                            ? 'bg-green-500/10 hover:bg-green-500/20 border-green-500/20 text-green-400'
                            : 'bg-green-500/10 hover:bg-green-500/20 border-green-500/20 text-green-400'
                        }`}
                      >
                        💬 {t('crm.contact')}
                      </button>
                    )}
                    <button
                      onClick={() => handleRemoveFromCRM(lead.nome)}
                      className="p-2 rounded bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 transition-colors text-xs font-semibold cursor-pointer"
                    >
                      {t('crm.deleteSingle')}
                    </button>
                  </div>
                </td>
              </tr>
            ))}

            {filteredCrmLeads.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-16 text-center text-gray-500">
                  <div className="text-3xl mb-3">📁</div>
                  <p className="font-semibold">{t('crm.empty')}</p>
                  <p className="text-xs max-w-md mx-auto mt-1">{t('crm.empty')} {t('crm.subtitle')}</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Mobile Card List CRM */}
        <div className="mobile-card-list md:hidden p-3 sm:p-4 max-h-[400px] overflow-y-auto">
          {paginatedCrmLeads.map((lead, i) => (
            <div 
              key={i} 
              className={`p-4 rounded-xl border transition-all ${
                selectedCrmLeads.includes(lead.nome) 
                  ? 'bg-blue-950/20 border-blue-500/30' 
                  : 'bg-white/[0.02] border-white/5'
              } flex flex-col gap-4`}
            >
              <div className="flex items-start gap-3">
                <input 
                  type="checkbox"
                  checked={selectedCrmLeads.includes(lead.nome)}
                  onChange={() => handleToggleSelectCrmLead(lead.nome)}
                  className="rounded border-white/20 bg-black/40 text-blue-500 focus:ring-0 focus:ring-offset-0 cursor-pointer h-4 w-4 mt-0.5"
                />
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-gray-200 text-sm">{lead.nome}</div>
                  <div className="text-xs text-gray-500 mt-1">{lead.nicho} · {lead.cidade}</div>
                  {lead.site && lead.site !== 'Sem site' ? (
                    <a href={lead.site} target="_blank" className="text-xs text-blue-400 hover:underline mt-1.5 block">{t('crm.website')}</a>
                  ) : (
                    <span className="text-xs text-gray-600 mt-1.5 block">{t('crm.noWebsite')}</span>
                  )}
                  {lead.cnpj && (
                    <span className="block text-[11px] text-amber-300 font-mono mt-1.5">{t('crm.cnpj', { number: lead.cnpj })}</span>
                  )}
                </div>
              </div>

              <div className="space-y-2 border-t border-white/5 pt-3">
                {lead.telefone && lead.telefone !== 'Não informado' && (
                  <div className="text-xs text-gray-300 flex items-center gap-2 font-mono">
                    <span className="opacity-60">📞</span> {lead.telefone}
                  </div>
                )}
                {lead.email && (
                  <div className="text-xs text-purple-400 flex items-center gap-2 font-mono break-all">
                    <span className="opacity-60">✉️</span> {lead.email}
                  </div>
                )}
                {lead.instagram && (
                  <a href={lead.instagram} target="_blank" className="text-xs text-pink-400 flex items-center gap-2 hover:underline">
                    <span className="opacity-60">📷</span> Instagram
                  </a>
                )}
                {lead.facebook && (
                  <a href={lead.facebook} target="_blank" className="text-xs text-blue-400 flex items-center gap-2 hover:underline">
                    <span className="opacity-60">📘</span> Facebook
                  </a>
                )}
                {lead.tiktok && (
                  <a href={lead.tiktok} target="_blank" className="text-xs text-cyan-300 flex items-center gap-2 hover:underline">
                    <span className="opacity-60">🎵</span> TikTok
                  </a>
                )}
              </div>

              <div className="border-t border-white/5 pt-3">
                <span className="text-[11px] text-gray-500 font-medium block mb-2">{t('crm.tableTags')}:</span>
                <div className="flex flex-wrap gap-1.5 items-center">
                  {(Array.isArray(lead.tags) ? lead.tags : []).map((tag: string) => (
                    <TagBadge key={tag} tag={tag} onRemove={() => toggleTag(lead.nome, tag)} t={t} />
                  ))}
                  <div className="flex items-center gap-1">
                    <select
                      value=""
                      onChange={(e) => { if (e.target.value) { toggleTag(lead.nome, e.target.value); } }}
                      style={{ colorScheme: 'dark' }}
                      className="px-2 py-1 rounded-lg bg-black/50 border border-white/10 text-[11px] text-gray-400 focus:outline-none focus:border-blue-500 cursor-pointer w-[28px] appearance-none"
                    >
                      <option value="">+</option>
                      {ALL_TAGS.filter(tag => !(Array.isArray(lead.tags) ? lead.tags : []).includes(tag)).map((tag: string) => (
                        <option key={tag} value={tag}>{TAG_CONFIG[tag]?.icon || ''} {getTagLabel(tag, t)}</option>
                      ))}
                    </select>
                    <input
                      type="text"
                      placeholder={t('crm.newTagPlaceholder')}
                      value={tagInputs[lead.nome] || ''}
                      onChange={(e) => setTagInputs(s => ({ ...s, [lead.nome]: e.target.value }))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && tagInputs[lead.nome]?.trim()) {
                          toggleTag(lead.nome, tagInputs[lead.nome].trim());
                          setTagInputs(s => ({ ...s, [lead.nome]: '' }));
                        }
                      }}
                      className="w-20 bg-black/40 border border-white/5 rounded-lg px-2 py-1 text-[10px] text-gray-300 placeholder-gray-600 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>
              <div className="border-t border-white/5 pt-3 flex flex-col gap-2">
                <span className="text-[11px] text-gray-500 font-medium">{t('crm.tableFunnel')}:</span>
                <select
                  value={lead.stage || 'Novo'}
                  onChange={(e) => handleUpdateCRMLead(lead.nome, 'stage', e.target.value)}
                  style={{ colorScheme: 'dark' }}
                  className={`w-full px-3 py-2 rounded-xl border text-xs font-bold focus:outline-none cursor-pointer ${
                    lead.stage === 'Novo' ? 'bg-blue-500/10 border-blue-500/30 text-blue-400' :
                    lead.stage === 'Em Contato' ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' :
                    lead.stage === 'Proposta' ? 'bg-purple-500/10 border-purple-500/30 text-purple-400' :
                    lead.stage === 'Fechado' ? 'bg-green-500/10 border-green-500/30 text-green-400' :
                    'bg-red-500/10 border-red-500/30 text-red-400'
                  }`}
                >
                  <option value="Novo">{t('crm.stageNew')}</option>
                  <option value="Em Contato">{t('crm.stageContact')}</option>
                  <option value="Proposta">{t('crm.stageProposal')}</option>
                  <option value="Fechado">{t('crm.stageWon')}</option>
                  <option value="Perdido">{t('crm.stageLost')}</option>
                </select>
              </div>

              <div className="border-t border-white/5 pt-3 flex flex-col gap-2">
                <span className="text-[11px] text-gray-500 font-medium">{t('crm.tableNotes')}:</span>
                <textarea
                  placeholder={t('crm.clickToAnnotate')}
                  value={lead.notes || ''}
                  onChange={(e) => handleUpdateCRMLead(lead.nome, 'notes', e.target.value)}
                  className="w-full bg-black/40 border border-white/5 hover:border-white/10 focus:border-blue-500 focus:outline-none rounded-xl p-3 text-xs text-gray-300 resize-none h-16 transition-colors"
                />
              </div>

              <div className="flex flex-col sm:flex-row gap-2 border-t border-white/5 pt-3">
                {waSentNames.has(lead.nome) && (
                  <span className="text-[10px] px-2 py-1 rounded-full bg-green-500/10 text-green-400 border border-green-500/20 font-bold inline-flex items-center gap-1 w-fit">{t('crm.whatsappSent')}</span>
                )}
                {lead.telefone && lead.telefone !== 'Não informado' && (
                  <button
                    onClick={() => openWhatsApp(lead)}
                    className="flex-1 py-2.5 rounded-xl bg-green-500/10 hover:bg-green-500/20 border border-green-500/20 text-green-400 transition-colors text-xs font-semibold cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    💬 {t('crm.contact')}
                  </button>
                )}
                <button
                  onClick={() => handleRemoveFromCRM(lead.nome)}
                  className="flex-1 py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 transition-colors text-xs font-semibold cursor-pointer flex items-center justify-center gap-1.5"
                >
                  {t('crm.deleteSingle')}
                </button>
              </div>
            </div>
          ))}

          {filteredCrmLeads.length === 0 && (
            <div className="py-16 text-center text-gray-500">
              <div className="text-3xl mb-3">📁</div>
              <p className="font-semibold text-sm">{t('crm.empty')}</p>
            </div>
          )}
        </div>
      </div>
      )}

      {/* KANBAN VIEW */}
      {crmViewMode === 'kanban' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 mt-4">
          {['Novo', 'Em Contato', 'Proposta', 'Fechado', 'Perdido'].map(stage => {
            const stageLeads = filteredCrmLeads.filter(l => (l.stage || 'Novo') === stage);
            const stageColors: Record<string, string> = {
              'Novo': 'border-blue-500/30 bg-blue-500/5',
              'Em Contato': 'border-amber-500/30 bg-amber-500/5',
              'Proposta': 'border-purple-500/30 bg-purple-500/5',
              'Fechado': 'border-green-500/30 bg-green-500/5',
              'Perdido': 'border-red-500/30 bg-red-500/5',
            };
            const headerColors: Record<string, string> = {
              'Novo': 'text-blue-400',
              'Em Contato': 'text-amber-400',
              'Proposta': 'text-purple-400',
              'Fechado': 'text-green-400',
              'Perdido': 'text-red-400',
            };
            return (
              <div key={stage} className={`rounded-xl border ${stageColors[stage]} p-3 min-h-[200px]`}>
                <div className={`text-xs font-bold uppercase tracking-wider mb-3 flex items-center justify-between ${headerColors[stage]}`}>
                  <span>{stageLabel(stage)}</span>
                  <span className="text-white/40 font-mono">{stageLeads.length}</span>
                </div>
                <div className="space-y-2">
                  {stageLeads.slice(0, 30).map(lead => (
                    <div key={lead.nome} className="bg-black/60 border border-white/5 rounded-lg p-3 hover:border-white/20 transition-colors group">
                      <div className="font-bold text-gray-200 text-xs truncate">{lead.nome}</div>
                      <div className="text-[10px] text-gray-500 mt-0.5 truncate">{lead.nicho} · {lead.cidade}</div>
                      {lead.telefone && lead.telefone !== 'Não informado' && (
                        <div className="text-[10px] text-gray-400 font-mono mt-1">📞 {lead.telefone}</div>
                      )}
                      {lead.email && (
                        <div className="text-[10px] text-purple-400 truncate">✉️ {lead.email}</div>
                      )}
                      {(Array.isArray(lead.tags) ? lead.tags : []).length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {(Array.isArray(lead.tags) ? lead.tags : []).slice(0, 3).map((tag: string) => (
                            <TagBadge key={tag} tag={tag} t={t} />
                          ))}
                        </div>
                      )}
                      <div className="flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        {lead.telefone && lead.telefone !== 'Não informado' && (
                          <button onClick={() => openWhatsApp(lead)} className="flex-1 py-1 rounded bg-green-500/10 hover:bg-green-500/20 border border-green-500/20 text-green-400 text-[9px] font-semibold cursor-pointer">💬</button>
                        )}
                        <button onClick={() => handleRemoveFromCRM(lead.nome)} className="px-1.5 py-1 rounded bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 text-[9px] font-semibold cursor-pointer">✕</button>
                      </div>
                      <div className="flex gap-1 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        {['Novo', 'Em Contato', 'Proposta', 'Fechado', 'Perdido'].filter(s => s !== stage).map(s => (
                          <button key={s} onClick={() => handleUpdateCRMLead(lead.nome, 'stage', s)}
                            className="px-1 py-0.5 rounded bg-white/5 hover:bg-white/10 border border-white/10 text-[8px] text-gray-400 cursor-pointer truncate">
                            → {stageLabel(s)}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                  {stageLeads.length === 0 && (
                    <div className="text-center py-8 text-gray-600 text-[11px]">{t('crm.empty')}</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MAP VIEW */}
      {crmViewMode === 'map' && (
        <div className="mt-4">
          <HackMap leads={filteredCrmLeads} />
        </div>
      )}

      {crmViewMode === 'table' && filteredCrmLeads.length > CRM_PAGE_SIZE && (
        <div className="flex items-center justify-between pt-4 text-xs text-gray-500">
          <span>
            {t('crm.pagination', { from: safeCrmPage * CRM_PAGE_SIZE + 1, to: Math.min((safeCrmPage + 1) * CRM_PAGE_SIZE, filteredCrmLeads.length), total: filteredCrmLeads.length })}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCrmPage(Math.max(0, safeCrmPage - 1))}
              disabled={safeCrmPage === 0}
              className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 disabled:opacity-30 hover:bg-white/10 transition-colors cursor-pointer disabled:cursor-not-allowed"
            >
              {t('crm.previous')}
            </button>
            <button
              onClick={() => setCrmPage(Math.min(crmTotalPages - 1, safeCrmPage + 1))}
              disabled={safeCrmPage >= crmTotalPages - 1}
              className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 disabled:opacity-30 hover:bg-white/10 transition-colors cursor-pointer disabled:cursor-not-allowed"
            >
              {t('crm.next')}
            </button>
          </div>
        </div>
      )}

      {/* IMPORT CSV MODAL */}
      {showImport && (
        <div style={{position:'fixed',inset:0,zIndex:9999,display:'flex',alignItems:'flex-start',justifyContent:'center',background:'rgba(0,0,0,0.6)',padding:'0.5rem 1rem 2rem',overflowY:'auto'}}
          onClick={() => { setShowImport(false); setImportPreview(null); }}>
          <div style={{width:'100%',maxWidth:'42rem',maxHeight:'85vh',background:'#111',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'1.5rem',padding:'1.5rem',boxShadow:'0 25px 50px rgba(0,0,0,0.5)',overflow:'auto'}}
            onClick={e => e.stopPropagation()}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'1rem'}}>
              <h3 style={{fontSize:'1.125rem',fontWeight:700}}>{t('crm.importTitle')}</h3>
              <button onClick={() => { setShowImport(false); setImportPreview(null); }} style={{color:'#999',fontSize:'1.25rem',border:'none',background:'none',cursor:'pointer'}}>&times;</button>
            </div>

            {!importPreview ? (
              <div style={{display:'flex',flexDirection:'column',gap:'1rem'}}>
                <div style={{border:'2px dashed rgba(255,255,255,0.1)',borderRadius:'0.75rem',padding:'2rem',textAlign:'center'}}>
                  <input type="file" accept=".csv" onChange={e => setImportFile(e.target.files?.[0] || null)} style={{display:'none'}} id="csv-upload" />
                  <label htmlFor="csv-upload" style={{cursor:'pointer',display:'block'}}>
                    <div style={{fontSize:'2.25rem',marginBottom:'0.75rem'}}>📄</div>
                    <p style={{fontSize:'0.875rem',color:'#ccc',fontWeight:600}}>{importFile ? importFile.name : t('crm.importClick')}</p>
                    <p style={{fontSize:'0.6875rem',color:'#888',marginTop:'0.25rem'}}>{t('crm.importHeaders')}</p>
                  </label>
                </div>
                <button onClick={async () => {
                    if (!importFile) return;
                    setImportLoading(true);
                    try {
                      const formData = new FormData();
                      formData.append('file', importFile);
                      const { data: { session } } = await (await import('@/lib/supabase')).supabase.auth.getSession();
                      const token = session?.access_token;
                      if (!token) { showToast(t('crm.importLoginError'), 'error'); return; }
                      const res = await fetch('/api/import/csv', { method: 'POST', body: formData, headers: { Authorization: `Bearer ${token}` } });
                      const data = await res.json();
                      if (data.success) {
                        setImportPreview(data.leads);
                        setImportColumnMap(data.columnMap);
                        setImportUnmapped(data.unmappedColumns || []);
                        setImportCsvHeaders(data.csvHeaders);
                      } else throw new Error(data.error);
                    } catch (err: any) { showToast(t('crm.importError', { message: err.message }), 'error'); }
                    finally { setImportLoading(false); }
                  }}
                  disabled={!importFile || importLoading}
                  style={{width:'100%',padding:'0.75rem',borderRadius:'0.75rem',fontWeight:700,color:'#fff',border:'none',cursor:'pointer',background:'linear-gradient(90deg,#0891b2,#2563eb)',opacity:(!importFile || importLoading)?0.5:1}}>
                  {                  importLoading ? t('crm.importProcessing') : t('crm.importUpload')}
                </button>
                <p style={{fontSize:'0.625rem',color:'#666',textAlign:'center'}}>{t('crm.importNoServer')}</p>
              </div>
            ) : (
              <div style={{display:'flex',flexDirection:'column',gap:'1rem'}}>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                  <p style={{fontSize:'0.875rem',color:'#ccc'}}>{t('crm.importDetected', { count: importPreview.length })}</p>
                  <button onClick={() => { setImportPreview(null); setImportFile(null); }} style={{fontSize:'0.75rem',color:'#888',border:'none',background:'none',cursor:'pointer'}}>← {t('crm.importBack')}</button>
                </div>
                {importUnmapped.length > 0 && (
                  <div style={{background:'rgba(245,158,11,0.1)',border:'1px solid rgba(245,158,11,0.2)',borderRadius:'0.75rem',padding:'0.75rem'}}>
                    <p style={{fontSize:'0.75rem',color:'#fbbf24',fontWeight:600,marginBottom:'0.25rem'}}>{t('crm.importUnrecognized')}</p>
                    <p style={{fontSize:'0.6875rem',color:'#fcd34d'}}>{importUnmapped.join(', ')}</p>
                    <p style={{fontSize:'0.6875rem',color:'rgba(251,191,36,0.7)',marginTop:'0.25rem'}}>{t('crm.importHeaders')}</p>
                  </div>
                )}
                <div style={{maxHeight:'13rem',overflowY:'auto',border:'1px solid rgba(255,255,255,0.05)',borderRadius:'0.75rem',background:'rgba(0,0,0,0.3)'}}>
                  <table style={{width:'100%',fontSize:'0.75rem'}}>
                    <thead style={{background:'rgba(255,255,255,0.05)',color:'#999',position:'sticky',top:0}}>
                      <tr>{(importCsvHeaders.filter(h => importColumnMap[h]).length > 0 ? importCsvHeaders.filter(h => importColumnMap[h]) : importCsvHeaders).map(h => <th key={h} style={{padding:'0.5rem 0.75rem',textAlign:'left'}}>{importColumnMap[h] || h}</th>)}</tr>
                    </thead>
                    <tbody style={{borderTop:'1px solid rgba(255,255,255,0.05)'}}>
                      {importPreview.slice(0, 10).map((lead: any, i: number) => (
                        <tr key={i}>
                          {(importCsvHeaders.filter(h => importColumnMap[h]).length > 0 ? importCsvHeaders.filter(h => importColumnMap[h]) : importCsvHeaders).map(h => <td key={h} style={{padding:'0.5rem 0.75rem',color:'#999',maxWidth:'120px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{lead[importColumnMap[h] || h] || '—'}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div style={{display:'flex',gap:'0.5rem'}}>
                  <button onClick={() => {
                      if (onImportLeads) onImportLeads(importPreview);
                      setShowImport(false);
                      setImportPreview(null);
                      setImportFile(null);
                    }}
                    style={{flex:1,padding:'0.75rem',borderRadius:'0.75rem',fontWeight:700,color:'#fff',border:'none',cursor:'pointer',background:'linear-gradient(90deg,#16a34a,#059669)'}}>
                    {t('crm.importConfirm', { count: importPreview.length })}
                  </button>
                  <button onClick={() => { setImportPreview(null); setImportFile(null); }} style={{padding:'0.75rem 1rem',borderRadius:'0.75rem',background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.1)',color:'#ccc',cursor:'pointer'}}>{t('crm.importCancel')}</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
