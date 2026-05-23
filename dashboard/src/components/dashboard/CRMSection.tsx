import { useState } from 'react';
import { getLeadKey, normalizeCrmLead } from './dashboard-constants';
import { showToast } from '@/components/Toast';

function exportCrmToCsv(leads: any[], filename: string) {
  const cols = ['Nome', 'Telefone', 'Email', 'Site', 'Instagram', 'Facebook', 'TikTok', 'CNPJ', 'Estagio', 'Tags', 'Anotacoes', 'Cidade', 'Nicho', 'Avaliacao'];
  const rows = leads.map(l => cols.map(c => {
    const val = l[c.toLowerCase()] ?? '';
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
  enrichLoading: boolean;
  handleRemoveFromCRM: (nome: string) => void;
  handleToggleSelectCrmLead: (nome: string) => void;
  handleToggleSelectAllCrmLeads: (filteredLeads: any[]) => void;
  handleRemoveSelectedFromCRM: () => void;
  handleBulkStageChange: () => Promise<void>;
  handleReEnrichSelected: () => Promise<void>;
  handleReEnrichSingle: (lead: any) => Promise<void>;
  handleUpdateCRMLead: (nome: string, field: 'stage' | 'notes' | 'tags', value: string) => void;
  openWhatsApp: (lead: any) => void;
  waSentMessages?: any[];
  onImportLeads?: (leads: any[]) => void;
}

const CRM_PAGE_SIZE = 25;
const ALL_TAGS = ['Quente', 'Morno', 'Frio', 'Agendar', 'Ligou', 'Não respondeu', 'Indicação'];

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
  enrichLoading,
  handleRemoveFromCRM,
  handleToggleSelectCrmLead,
  handleToggleSelectAllCrmLeads,
  handleRemoveSelectedFromCRM,
  handleBulkStageChange,
  handleReEnrichSelected,
  handleReEnrichSingle,
  handleUpdateCRMLead,
  openWhatsApp,
  waSentMessages,
  onImportLeads,
}: CRMSectionProps) {
  const waSentNames = new Set((waSentMessages || []).map((m: any) => m.lead_name).filter(Boolean));
  const [crmFilterTag, setCrmFilterTag] = useState('all');
  const [crmSortField, setCrmSortField] = useState('nome');
  const [crmSortDir, setCrmSortDir] = useState<'asc' | 'desc'>('asc');
  const [tagInputs, setTagInputs] = useState<Record<string, string>>({});
  const [showTagMenu, setShowTagMenu] = useState<Record<string, boolean>>({});
  const [crmViewMode, setCrmViewMode] = useState<'table' | 'kanban'>('table');
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

  let filteredCrmLeads = crmLeads.filter(lead => {
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

  filteredCrmLeads.sort((a, b) => {
    let va = (a[crmSortField] || '').toString().toLowerCase();
    let vb = (b[crmSortField] || '').toString().toLowerCase();
    if (crmSortField === 'savedAt') { va = a.savedAt || ''; vb = b.savedAt || ''; }
    return crmSortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
  });
  const crmTotalPages = Math.max(1, Math.ceil(filteredCrmLeads.length / CRM_PAGE_SIZE));
  const safeCrmPage = Math.min(crmPage, crmTotalPages - 1);
  const paginatedCrmLeads = filteredCrmLeads.slice(safeCrmPage * CRM_PAGE_SIZE, (safeCrmPage + 1) * CRM_PAGE_SIZE);

  return (
    <div className="app-card p-7 rounded-[2rem] bg-gradient-to-b from-white/[0.03] to-black/40 border border-white/10 shadow-2xl relative overflow-hidden animate-slide-up">
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-500" />
      
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            📋 Seu CRM de Vendas
          </h2>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <p className="text-xs text-gray-500">Gerencie os leads que você já salvou e altere as etapas do funil comercial.</p>
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

        {/* SEARCH & STAGE FILTER */}
        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          {filteredCrmLeads.length > 0 && (
            <label className="flex items-center gap-2 text-xs text-gray-400 bg-white/5 border border-white/10 rounded-xl px-3 py-2 cursor-pointer hover:bg-white/10">
              <input 
                type="checkbox"
                checked={filteredCrmLeads.length > 0 && filteredCrmLeads.every(l => selectedCrmLeads.includes(l.nome))}
                onChange={() => handleToggleSelectAllCrmLeads(filteredCrmLeads)}
                className="rounded border-white/20 bg-black/40 text-blue-500 focus:ring-0 focus:ring-offset-0 cursor-pointer h-3.5 w-3.5"
              />
              Selecionar Todos
            </label>
          )}
          {selectedCrmLeads.length > 0 && (
            <>
              <button
                onClick={handleRemoveSelectedFromCRM}
                className="px-3.5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white border border-red-500/30 text-xs font-semibold cursor-pointer transition-colors"
              >
                🗑️ Excluir ({selectedCrmLeads.length})
              </button>
              <span className="text-xs text-gray-400 flex items-center gap-1.5">
                Mover para:
                <select
                  value={bulkStageTarget}
                  onChange={(e) => setBulkStageTarget(e.target.value)}
                  style={{ colorScheme: 'dark' }}
                  className="bg-black/50 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500 cursor-pointer"
                >
                  <option value="Novo">Novo Lead</option>
                  <option value="Em Contato">Em Contato</option>
                  <option value="Proposta">Proposta Enviada</option>
                  <option value="Fechado">Vendido / Ganho</option>
                  <option value="Perdido">Perdido</option>
                </select>
              </span>
              <button
                onClick={handleBulkStageChange}
                disabled={bulkStageLoading}
                className="px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white border border-blue-500/30 text-xs font-semibold cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {bulkStageLoading ? 'Movendo...' : 'Aplicar'}
              </button>
              <button
                onClick={handleReEnrichSelected}
                disabled={enrichLoading}
                className="px-3 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white border border-amber-500/30 text-xs font-semibold cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {enrichLoading ? 'Enriquecendo...' : '🔄 Re-enriquecer'}
              </button>
            </>
          )}
          <input 
            type="text" 
            placeholder="Buscar no CRM..."
            className="w-full sm:w-auto bg-black/50 border border-white/10 rounded-xl px-4 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500"
            value={crmSearch}
            onChange={(e) => setCrmSearch(e.target.value)}
          />
          <select
            value={crmFilterStage}
            onChange={(e) => setCrmFilterStage(e.target.value)}
            style={{ colorScheme: 'dark' }}
            className="w-full sm:w-auto bg-black/50 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500 cursor-pointer"
          >
            <option value="all">Todas as Etapas</option>
            <option value="Novo">Novo Lead</option>
            <option value="Em Contato">Em Contato</option>
            <option value="Proposta">Proposta Enviada</option>
            <option value="Fechado">Vendido / Ganho</option>
            <option value="Perdido">Perdido</option>
          </select>
          {allUsedTags.length > 0 && (
            <select
              value={crmFilterTag}
              onChange={(e) => setCrmFilterTag(e.target.value)}
              style={{ colorScheme: 'dark' }}
              className="w-full sm:w-auto bg-black/50 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="all">Todas as Tags</option>
              {allUsedTags.map((t: string) => <option key={t} value={t}>{t}</option>)}
            </select>
          )}
          {filteredCrmLeads.length > 0 && (
            <button
              onClick={() => exportCrmToCsv(filteredCrmLeads, `geoleads-crm-${new Date().toISOString().slice(0,10)}.csv`)}
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-500/30 text-xs font-semibold cursor-pointer transition-colors whitespace-nowrap"
            >
              📥 Exportar CSV ({filteredCrmLeads.length})
            </button>
          )}
          <button onClick={() => setShowImport(true)}
            className="px-3.5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white border border-cyan-500/30 text-xs font-semibold cursor-pointer transition-colors whitespace-nowrap">
            📥 Importar CSV
          </button>
          <button
            onClick={() => setCrmViewMode(v => v === 'table' ? 'kanban' : 'table')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-colors whitespace-nowrap border ${
              crmViewMode === 'kanban' ? 'bg-purple-600 border-purple-500/30 text-white' : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'
            }`}
          >
            {crmViewMode === 'kanban' ? '📋 Ver Tabela' : '📊 Kanban'}
          </button>
        </div>
      </div>

      {/* TABLE / CARDS CONTAINER */}
      {crmViewMode === 'table' && (
      <div className="rounded-2xl border border-white/5 bg-black/20 overflow-hidden">
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
                Lead Info {crmSortField === 'nome' ? (crmSortDir === 'asc' ? '↑' : '↓') : ''}
              </th>
              <th className="px-4 py-3 font-medium">Contatos</th>
              <th className="px-4 py-3 font-medium">Tags</th>
              <th className={`px-4 py-3 font-medium cursor-pointer hover:text-white select-none ${crmSortField === 'stage' ? 'text-white' : ''}`} onClick={() => { setCrmSortField('stage'); setCrmSortDir(d => d === 'asc' ? 'desc' : 'asc'); }}>
                Funil / Status {crmSortField === 'stage' ? (crmSortDir === 'asc' ? '↑' : '↓') : ''}
              </th>
              <th className="px-4 py-3 font-medium">Minhas Anotações</th>
              <th className="px-4 py-3 font-medium">Ações</th>
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
                  {lead.site && lead.site !== 'Sem site' && (
                    <a href={lead.site} target="_blank" className="text-xs text-blue-400 hover:underline mt-1 block">🌐 Site comercial</a>
                  )}
                  {lead.cnpj && (
                    <span className="block text-[11px] text-amber-300 font-mono mt-1">CNPJ {lead.cnpj}</span>
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
                  <div className="flex flex-wrap gap-1">
                    {(Array.isArray(lead.tags) ? lead.tags : []).map((tag: string) => (
                      <span key={tag} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/20 text-[10px]">
                        {tag}
                        <button onClick={() => toggleTag(lead.nome, tag)} className="hover:text-white ml-0.5 cursor-pointer">&times;</button>
                      </span>
                    ))}
                    <div className="relative">
                      <button onClick={() => setShowTagMenu(s => ({ ...s, [lead.nome]: !s[lead.nome] }))} className="px-1.5 py-0.5 rounded-full bg-white/5 text-gray-400 hover:text-white border border-white/10 text-[10px] cursor-pointer">+</button>
                      {showTagMenu[lead.nome] && (
                        <div className="absolute top-6 left-0 z-20 bg-gray-900 border border-white/10 rounded-xl p-2 shadow-2xl min-w-[140px]" onMouseLeave={() => setShowTagMenu(s => ({ ...s, [lead.nome]: false }))}>
                          {ALL_TAGS.filter(t => !(Array.isArray(lead.tags) ? lead.tags : []).includes(t)).map((tag: string) => (
                            <button key={tag} onClick={() => { toggleTag(lead.nome, tag); setShowTagMenu(s => ({ ...s, [lead.nome]: false })); }} className="block w-full text-left px-2 py-1 text-xs text-gray-300 hover:bg-white/5 rounded-lg cursor-pointer">{tag}</button>
                          ))}
                        </div>
                      )}
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
                    <option value="Novo">Novo Lead</option>
                    <option value="Em Contato">Em Contato</option>
                    <option value="Proposta">Proposta Enviada</option>
                    <option value="Fechado">Vendido / Ganho</option>
                    <option value="Perdido">Perdido</option>
                  </select>
                </td>
                <td className="px-4 py-4">
                  <textarea
                    placeholder="Clique para anotar detalhes..."
                    value={lead.notes || ''}
                    onChange={(e) => handleUpdateCRMLead(lead.nome, 'notes', e.target.value)}
                    className="w-full bg-black/40 border border-white/5 hover:border-white/10 focus:border-blue-500 focus:outline-none rounded-lg p-2 text-xs text-gray-300 resize-none h-14 transition-colors"
                  />
                </td>
                <td className="px-4 py-4">
                  <div className="flex items-center gap-2">
                    {waSentNames.has(lead.nome) && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20 font-bold" title="WhatsApp já enviado">✅ Enviado</span>
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
                        💬 Contatar
                      </button>
                    )}
                    {lead.site && lead.site !== 'Sem site' && (
                      <button
                        onClick={() => handleReEnrichSingle(lead)}
                        className="p-2 rounded bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 text-amber-400 transition-colors text-xs font-semibold cursor-pointer"
                      >
                        🔄 Re-enriquecer
                      </button>
                    )}
                    <button
                      onClick={() => handleRemoveFromCRM(lead.nome)}
                      className="p-2 rounded bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 transition-colors text-xs font-semibold cursor-pointer"
                    >
                      Excluir
                    </button>
                  </div>
                </td>
              </tr>
            ))}

            {filteredCrmLeads.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-16 text-center text-gray-500">
                  <div className="text-3xl mb-3">📁</div>
                  <p className="font-semibold">Nenhum lead encontrado no CRM.</p>
                  <p className="text-xs max-w-md mx-auto mt-1">Salve leads a partir do "Motor Extrator" para visualizá-los e gerenciá-los aqui no seu pipeline.</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Mobile Card List CRM */}
        <div className="mobile-card-list md:hidden p-3 sm:p-4">
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
                  {lead.site && lead.site !== 'Sem site' && (
                    <a href={lead.site} target="_blank" className="text-xs text-blue-400 hover:underline mt-1.5 block">🌐 Site comercial</a>
                  )}
                  {lead.cnpj && (
                    <span className="block text-[11px] text-amber-300 font-mono mt-1.5">CNPJ {lead.cnpj}</span>
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

              <div className="border-t border-white/5 pt-3 flex flex-wrap gap-1 items-center">
                <span className="text-[11px] text-gray-500 font-medium mr-1">Tags:</span>
                {(Array.isArray(lead.tags) ? lead.tags : []).map((tag: string) => (
                  <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/20 text-[10px]">
                    {tag}
                    <button onClick={() => toggleTag(lead.nome, tag)} className="hover:text-white ml-0.5 cursor-pointer">&times;</button>
                  </span>
                ))}
                <div className="relative inline-block">
                  <button onClick={() => setShowTagMenu(s => ({ ...s, [lead.nome]: !s[lead.nome] }))} className="px-2 py-0.5 rounded-full bg-white/5 text-gray-400 hover:text-white border border-white/10 text-[10px] cursor-pointer">+ Tag</button>
                  {showTagMenu[lead.nome] && (
                    <div className="absolute top-6 left-0 z-20 bg-gray-900 border border-white/10 rounded-xl p-2 shadow-2xl min-w-[140px]" onMouseLeave={() => setShowTagMenu(s => ({ ...s, [lead.nome]: false }))}>
                      {ALL_TAGS.filter(t => !(Array.isArray(lead.tags) ? lead.tags : []).includes(t)).map((tag: string) => (
                        <button key={tag} onClick={() => { toggleTag(lead.nome, tag); setShowTagMenu(s => ({ ...s, [lead.nome]: false })); }} className="block w-full text-left px-2 py-1 text-xs text-gray-300 hover:bg-white/5 rounded-lg cursor-pointer">{tag}</button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="border-t border-white/5 pt-3 flex flex-col gap-2">
                <span className="text-[11px] text-gray-500 font-medium">Funil / Status:</span>
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
                  <option value="Novo">Novo Lead</option>
                  <option value="Em Contato">Em Contato</option>
                  <option value="Proposta">Proposta Enviada</option>
                  <option value="Fechado">Vendido / Ganho</option>
                  <option value="Perdido">Perdido</option>
                </select>
              </div>

              <div className="border-t border-white/5 pt-3 flex flex-col gap-2">
                <span className="text-[11px] text-gray-500 font-medium">Minhas Anotações:</span>
                <textarea
                  placeholder="Clique para anotar detalhes..."
                  value={lead.notes || ''}
                  onChange={(e) => handleUpdateCRMLead(lead.nome, 'notes', e.target.value)}
                  className="w-full bg-black/40 border border-white/5 hover:border-white/10 focus:border-blue-500 focus:outline-none rounded-xl p-3 text-xs text-gray-300 resize-none h-16 transition-colors"
                />
              </div>

              <div className="flex flex-col sm:flex-row gap-2 border-t border-white/5 pt-3">
                {waSentNames.has(lead.nome) && (
                  <span className="text-[10px] px-2 py-1 rounded-full bg-green-500/10 text-green-400 border border-green-500/20 font-bold inline-flex items-center gap-1 w-fit">✅ WhatsApp Enviado</span>
                )}
                {lead.telefone && lead.telefone !== 'Não informado' && (
                  <button
                    onClick={() => openWhatsApp(lead)}
                    className="flex-1 py-2.5 rounded-xl bg-green-500/10 hover:bg-green-500/20 border border-green-500/20 text-green-400 transition-colors text-xs font-semibold cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    💬 Contatar
                  </button>
                )}
                {lead.site && lead.site !== 'Sem site' && (
                  <button
                    onClick={() => handleReEnrichSingle(lead)}
                    className="flex-1 py-2.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 text-amber-400 transition-colors text-xs font-semibold cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    🔄 Re-enriquecer
                  </button>
                )}
                <button
                  onClick={() => handleRemoveFromCRM(lead.nome)}
                  className="flex-1 py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 transition-colors text-xs font-semibold cursor-pointer flex items-center justify-center gap-1.5"
                >
                  Excluir
                </button>
              </div>
            </div>
          ))}

          {filteredCrmLeads.length === 0 && (
            <div className="py-16 text-center text-gray-500">
              <div className="text-3xl mb-3">📁</div>
              <p className="font-semibold text-sm">Nenhum lead encontrado no CRM.</p>
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
                  <span>{stage}</span>
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
                            <span key={tag} className="px-1 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/20 text-[9px]">{tag}</span>
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
                            → {s}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                  {stageLeads.length === 0 && (
                    <div className="text-center py-8 text-gray-600 text-[11px]">Nenhum lead</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {crmViewMode === 'table' && filteredCrmLeads.length > CRM_PAGE_SIZE && (
        <div className="flex items-center justify-between pt-4 text-xs text-gray-500">
          <span>
            Mostrando {safeCrmPage * CRM_PAGE_SIZE + 1}–{Math.min((safeCrmPage + 1) * CRM_PAGE_SIZE, filteredCrmLeads.length)} de {filteredCrmLeads.length}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCrmPage(Math.max(0, safeCrmPage - 1))}
              disabled={safeCrmPage === 0}
              className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 disabled:opacity-30 hover:bg-white/10 transition-colors cursor-pointer disabled:cursor-not-allowed"
            >
              ← Anterior
            </button>
            <button
              onClick={() => setCrmPage(Math.min(crmTotalPages - 1, safeCrmPage + 1))}
              disabled={safeCrmPage >= crmTotalPages - 1}
              className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 disabled:opacity-30 hover:bg-white/10 transition-colors cursor-pointer disabled:cursor-not-allowed"
            >
              Próximo →
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
              <h3 style={{fontSize:'1.125rem',fontWeight:700}}>📥 Importar Leads (CSV)</h3>
              <button onClick={() => { setShowImport(false); setImportPreview(null); }} style={{color:'#999',fontSize:'1.25rem',border:'none',background:'none',cursor:'pointer'}}>&times;</button>
            </div>

            {!importPreview ? (
              <div style={{display:'flex',flexDirection:'column',gap:'1rem'}}>
                <div style={{border:'2px dashed rgba(255,255,255,0.1)',borderRadius:'0.75rem',padding:'2rem',textAlign:'center'}}>
                  <input type="file" accept=".csv" onChange={e => setImportFile(e.target.files?.[0] || null)} style={{display:'none'}} id="csv-upload" />
                  <label htmlFor="csv-upload" style={{cursor:'pointer',display:'block'}}>
                    <div style={{fontSize:'2.25rem',marginBottom:'0.75rem'}}>📄</div>
                    <p style={{fontSize:'0.875rem',color:'#ccc',fontWeight:600}}>{importFile ? importFile.name : 'Clique para selecionar um arquivo CSV'}</p>
                    <p style={{fontSize:'0.6875rem',color:'#888',marginTop:'0.25rem'}}>Cabeçalhos esperados: Nome, Telefone, Email, Site, Instagram, Cidade, Nicho</p>
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
                      if (!token) { showToast('Faça login novamente.', 'error'); return; }
                      const res = await fetch('/api/import/csv', { method: 'POST', body: formData, headers: { Authorization: `Bearer ${token}` } });
                      const data = await res.json();
                      if (data.success) {
                        setImportPreview(data.leads);
                        setImportColumnMap(data.columnMap);
                        setImportUnmapped(data.unmappedColumns || []);
                        setImportCsvHeaders(data.csvHeaders);
                      } else throw new Error(data.error);
                    } catch (err: any) { showToast('Erro: ' + err.message, 'error'); }
                    finally { setImportLoading(false); }
                  }}
                  disabled={!importFile || importLoading}
                  style={{width:'100%',padding:'0.75rem',borderRadius:'0.75rem',fontWeight:700,color:'#fff',border:'none',cursor:'pointer',background:'linear-gradient(90deg,#0891b2,#2563eb)',opacity:(!importFile || importLoading)?0.5:1}}>
                  {importLoading ? 'Processando...' : '📤 Enviar e Analisar'}
                </button>
                <p style={{fontSize:'0.625rem',color:'#666',textAlign:'center'}}>O arquivo não é salvo no servidor. Processado em memória.</p>
              </div>
            ) : (
              <div style={{display:'flex',flexDirection:'column',gap:'1rem'}}>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                  <p style={{fontSize:'0.875rem',color:'#ccc'}}>{importPreview.length} leads detectados</p>
                  <button onClick={() => { setImportPreview(null); setImportFile(null); }} style={{fontSize:'0.75rem',color:'#888',border:'none',background:'none',cursor:'pointer'}}>← Voltar</button>
                </div>
                {importUnmapped.length > 0 && (
                  <div style={{background:'rgba(245,158,11,0.1)',border:'1px solid rgba(245,158,11,0.2)',borderRadius:'0.75rem',padding:'0.75rem'}}>
                    <p style={{fontSize:'0.75rem',color:'#fbbf24',fontWeight:600,marginBottom:'0.25rem'}}>Colunas não reconhecidas:</p>
                    <p style={{fontSize:'0.6875rem',color:'#fcd34d'}}>{importUnmapped.join(', ')}</p>
                    <p style={{fontSize:'0.6875rem',color:'rgba(251,191,36,0.7)',marginTop:'0.25rem'}}>Use: Nome, Telefone, Email, Site, Instagram, Cidade, Nicho</p>
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
                    ✅ Importar {importPreview.length} Leads
                  </button>
                  <button onClick={() => { setImportPreview(null); setImportFile(null); }} style={{padding:'0.75rem 1rem',borderRadius:'0.75rem',background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.1)',color:'#ccc',cursor:'pointer'}}>Cancelar</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
