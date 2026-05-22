import { getLeadKey, normalizeCrmLead } from './dashboard-constants';

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
  handleUpdateCRMLead: (nome: string, field: 'stage' | 'notes', value: string) => void;
  openWhatsApp: (lead: any) => void;
}

const CRM_PAGE_SIZE = 25;

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
}: CRMSectionProps) {
  const filteredCrmLeads = crmLeads.filter(lead => {
    const matchesSearch = 
      lead.nome.toLowerCase().includes(crmSearch.toLowerCase()) || 
      lead.telefone.toLowerCase().includes(crmSearch.toLowerCase()) ||
      lead.email?.toLowerCase().includes(crmSearch.toLowerCase()) ||
      lead.cnpj?.toLowerCase().includes(crmSearch.toLowerCase()) ||
      lead.nicho.toLowerCase().includes(crmSearch.toLowerCase()) ||
      lead.cidade.toLowerCase().includes(crmSearch.toLowerCase());
    if (crmFilterStage === 'all') return matchesSearch;
    return matchesSearch && lead.stage === crmFilterStage;
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
        </div>
      </div>

      {/* TABLE / CARDS CONTAINER */}
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
              <th className="px-4 py-3 font-medium">Lead Info</th>
              <th className="px-4 py-3 font-medium">Contatos</th>
              <th className="px-4 py-3 font-medium">Funil / Status</th>
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
                    {lead.telefone && lead.telefone !== 'Não informado' && (
                      <button
                        onClick={() => openWhatsApp(lead)}
                        className="p-2 rounded bg-green-500/10 hover:bg-green-500/20 border border-green-500/20 text-green-400 transition-colors text-xs font-semibold cursor-pointer"
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
                <td colSpan={6} className="px-4 py-16 text-center text-gray-500">
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

      {filteredCrmLeads.length > CRM_PAGE_SIZE && (
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
    </div>
  );
}
