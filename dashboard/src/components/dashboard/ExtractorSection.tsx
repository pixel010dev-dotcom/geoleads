import React from 'react';
import { FeatureKey, PlanId } from '@/lib/plans';
import HackerRadar from '@/components/HackerRadar';
import { filterOptions, quickSearches } from './dashboard-constants';

export interface ExtractorSectionProps {
  isExtracting: boolean;
  hasSearched: boolean;
  leads: any[];
  extractStats: any;
  keyword: string;
  location: string;
  limit: number | '';
  filterRule: string;
  tokens: number | null;
  user: any;
  currentPlan: { name: string; shortName: string; tokens: number };
  planId: PlanId;
  handleExtract: (e: React.FormEvent) => Promise<void>;
  handleAddToCRM: (lead: any) => void;
  handleAddAllToCRM: () => void;
  openWhatsApp: (lead: any, customText?: string, options?: any) => void;
  exportToCSV: () => void;
  exportToXLSX: () => Promise<void>;
  fetchHistory: () => Promise<void>;
  showHistory: boolean;
  setShowHistory: (v: boolean) => void;
  historyLoading: boolean;
  historyData: any[];
  requireFeature: (feature: FeatureKey) => boolean;
  showLockedFeature: (feature: FeatureKey) => void;
  getUpgradePlan: (feature: FeatureKey) => { name: string; shortName: string; tokens: number };
  setKeyword: (v: string) => void;
  setLocation: (v: string) => void;
  setLimit: (v: number | '') => void;
  setFilterRule: (v: string) => void;
  onCancel?: () => void;
}

export default function ExtractorSection({
  isExtracting,
  hasSearched,
  leads,
  extractStats,
  keyword,
  location,
  limit,
  filterRule,
  tokens,
  user,
  currentPlan,
  planId,
  handleExtract,
  handleAddToCRM,
  handleAddAllToCRM,
  openWhatsApp,
  exportToCSV,
  exportToXLSX,
  fetchHistory,
  showHistory,
  setShowHistory,
  historyLoading,
  historyData,
  requireFeature,
  showLockedFeature,
  getUpgradePlan,
  setKeyword,
  setLocation,
  setLimit,
  setFilterRule,
  onCancel,
}: ExtractorSectionProps) {
  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 lg:gap-8 relative z-20">
        {/* PAINEL DE BUSCA */}
        <div className="lg:col-span-1 animate-slide-up" style={{ animationDelay: '0.1s' }}>
          <div className="app-card p-7 rounded-[2rem] bg-gradient-to-b from-white/[0.05] to-black/40 border border-white/10 shadow-2xl relative overflow-hidden group hover:border-blue-500/30 transition-all duration-500">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-500" />
            
            <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
              <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              Nova Extração Avançada
            </h2>

            <form onSubmit={handleExtract} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Comece por um modelo rápido</label>
                <div className="quick-preset-grid">
                  {quickSearches.map((preset) => (
                    <button
                      key={`${preset.keyword}-${preset.location}`}
                      type="button"
                      onClick={() => {
                        setKeyword(preset.keyword);
                        setLocation(preset.location);
                        setFilterRule('none');
                      }}
                      className="quick-preset"
                    >
                      <span>{preset.keyword}</span>
                      <small>{preset.location}</small>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">O que você procura?</label>
                <input 
                  type="text" 
                  placeholder="ex: Academias, Dentistas..."
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Qual cidade/região?</label>
                <input 
                  type="text" 
                  placeholder="ex: São Paulo, SP"
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Quantos Leads? (-1 Token/Lead)</label>
                <input 
                  type="number" min="1" max="500"
                  style={{ colorScheme: 'dark' }}
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                  value={limit}
                  onChange={(e) => setLimit(e.target.value === '' ? '' : Number(e.target.value))}
                  required
                />
              </div>

              {/* PREMIUM GRID CHIPS FOR FILTER SELECTOR */}
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Filtros (selecione um ou mais)</label>
                <div className="extract-filter-grid">
                  {filterOptions.map((opt) => {
                    const selectedSet = new Set(filterRule.split(',').map(s => s.trim()).filter(Boolean));
                    const isSelected = filterRule === 'none' && opt.value === 'none' ? true : selectedSet.has(opt.value);
                    const isLocked = !requireFeature(opt.feature);
                    const requiredPlan = getUpgradePlan(opt.feature);
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => {
                          if (isLocked) { showLockedFeature(opt.feature); return; }
                          if (opt.value === 'none') { setFilterRule('none'); return; }
                          const current = new Set(filterRule.split(',').map(s => s.trim()).filter(Boolean));
                          if (current.has(opt.value)) current.delete(opt.value); else current.add(opt.value);
                          if (current.size === 0) { setFilterRule('none'); return; }
                          current.delete('none');
                          setFilterRule(Array.from(current).join(','));
                        }}
                        className={`filter-option-card ${
                          isLocked
                            ? 'is-locked'
                            : isSelected
                              ? 'is-selected'
                              : ''
                        }`}
                      >
                        <span className="text-xl flex items-center justify-between">
                          <span>{opt.icon}</span>
                          {isLocked && <span className="text-[10px] text-amber-300">🔒 {requiredPlan.shortName}</span>}
                        </span>
                        <span className="text-xs font-bold leading-tight block text-gray-200 mt-1">{opt.label}</span>
                        {isSelected && (
                          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-blue-400" />
                        )}
                      </button>
                    );
                  })}
                </div>
                <p className="text-[11px] text-gray-500 mt-2">Você só consome tokens pelos leads que possuírem o item escolhido.</p>
              </div>

              {/* Estimated time */}
              {(() => {
                const l = Number(limit) || 0;
                if (l <= 0) return null;
                const isBroad = /brasil|brazil|todos os estados|nacional|pa[ií]s inteiro|mundo/i.test(location);
                if (isBroad) {
                  const leadsPerCity = 3.5;
                  const cities = Math.min(Math.ceil(l / leadsPerCity), 140);
                  let sec = 10 + cities * 2 + l * 1.5 + 15;
                  if (sec > 600) sec = 600;
                  if (sec > 120) {
                    return <p className="text-xs text-blue-400/70 text-center -mt-2">⏱ Tempo estimado: ~{Math.ceil(sec / 60)} minuto{Math.ceil(sec / 60) > 1 ? 's' : ''} (~{cities} cidades em {Math.min(27, Math.ceil(cities / 4))} estados)</p>;
                  }
                  return <p className="text-xs text-blue-400/70 text-center -mt-2">⏱ Tempo estimado: ~{Math.ceil(sec)} segundos (~{cities} cidades)</p>;
                } else {
                  const sec = 5 + l * 3.5;
                  return <p className="text-xs text-blue-400/70 text-center -mt-2">⏱ Tempo estimado: ~{Math.ceil(sec)} segundos</p>;
                }
              })()}
              
              {isExtracting ? (
                <button 
                  type="button"
                  onClick={() => onCancel?.()}
                  className="w-full py-3.5 rounded-xl font-bold bg-red-600/80 hover:bg-red-600 text-white transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                  </svg>
                  ⏹ Parar Extração
                </button>
              ) : (
                <button 
                  type="submit"
                  className="w-full py-3.5 rounded-xl font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 hover:shadow-[0_0_20px_rgba(59,130,246,0.5)] hover:-translate-y-1 active:scale-95 transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {user ? '🚀 Iniciar Extração' : '🔒 Criar Conta para Extrair'}
                </button>
              )}
            </form>
          </div>
        </div>

        {/* PAINEL DE RESULTADOS */}
        <div className="lg:col-span-2 animate-slide-up" style={{ animationDelay: '0.2s' }}>
          <div className="app-card p-7 rounded-[2rem] bg-gradient-to-b from-white/[0.03] to-black/40 border border-white/10 h-full min-h-[400px] flex flex-col shadow-2xl">
            
            {/* Header dos resultados */}
            <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
              <div>
                <h2 className="text-xl font-semibold">
                  {isExtracting ? '⏳ Extraindo...' : leads.length > 0 ? `✅ ${leads.length} Leads Encontrados!` : 'Vitrine de Resultados'}
                </h2>
                {extractStats && (
                  <div className="mt-1 space-y-0.5 animate-fade-in">
                    <p className="text-xs text-gray-500">
                      Mapeou {extractStats.scanned} empresas em {extractStats.time} segundos.
                    </p>
                    {extractStats.correctedKeyword && (
                      <p className="text-xs text-blue-400 font-medium">
                        ✨ Busca: "{extractStats.correctedKeyword}{extractStats.broadRegion ? ' (país inteiro)' : ` em ${extractStats.correctedLocation}`}"
                      </p>
                    )}
                  </div>
                )}
              </div>
              <div className="app-action-row w-full sm:w-auto">
                <button 
                  onClick={handleAddAllToCRM}
                  disabled={leads.length === 0}
                  className="flex flex-1 sm:flex-none items-center justify-center gap-2 text-sm text-gray-200 hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed bg-white/5 hover:bg-white/10 px-4 py-2 rounded-lg border border-white/10 cursor-pointer"
                >
                  📁 Salvar no CRM
                </button>
                <button 
                  onClick={exportToCSV}
                  disabled={leads.length === 0}
                  className="flex flex-1 sm:flex-none items-center justify-center gap-2 text-sm text-blue-400 hover:text-blue-300 transition-colors disabled:opacity-30 disabled:cursor-not-allowed bg-blue-500/10 px-4 py-2 rounded-lg border border-blue-500/20 cursor-pointer"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Exportar CSV
                </button>
                <button 
                  onClick={exportToXLSX}
                  disabled={leads.length === 0}
                  className="flex flex-1 sm:flex-none items-center justify-center gap-2 text-sm text-emerald-400 hover:text-emerald-300 transition-colors disabled:opacity-30 disabled:cursor-not-allowed bg-emerald-500/10 px-4 py-2 rounded-lg border border-emerald-500/20 cursor-pointer"
                >
                  📊 Excel
                </button>
                <button 
                  onClick={fetchHistory}
                  className="flex flex-1 sm:flex-none items-center justify-center gap-2 text-sm text-amber-400 hover:text-amber-300 transition-colors bg-amber-500/10 px-4 py-2 rounded-lg border border-amber-500/20 cursor-pointer"
                >
                  🕐 Histórico
                </button>
              </div>
            </div>

            {/* Loading State (High-tech Hacker Radar) */}
            {isExtracting && (
              <div className="flex-1 py-4">
                <HackerRadar keyword={keyword} location={location} />
              </div>
            )}

            {/* Tabela de Resultados */}
            {!isExtracting && (
              <div className="flex-1 rounded-2xl border border-white/5 bg-black/20 overflow-hidden relative overflow-y-auto max-h-[500px]">
                <table className="hidden md:table w-full text-left text-sm">
                  <thead className="bg-white/5 border-b border-white/5 text-gray-400 sticky top-0 backdrop-blur-md z-10">
                    <tr>
                      <th className="px-4 py-3 font-medium">Empresa</th>
                      <th className="px-4 py-3 font-medium">Contato</th>
                      <th className="px-4 py-3 font-medium">E-mail</th>
                      <th className="px-4 py-3 font-medium">Redes</th>
                      <th className="px-4 py-3 font-medium">Categoria</th>
                      <th className="px-4 py-3 font-medium">Endereço</th>
                      <th className="px-4 py-3 font-medium">Horários</th>
                      <th className="px-4 py-3 font-medium">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {leads.map((lead: any, i: number) => (
                      <tr key={i} className="hover:bg-white/[0.06] transition-colors animate-slide-up" style={{ animationDelay: `${i * 0.03}s` }}>
                        <td className="px-4 py-4 font-medium text-gray-200">
                          <div>{lead.nome}</div>
                          {lead.site && lead.site !== 'Sem site' ? (
                            <a href={lead.site} target="_blank" className="inline-block text-xs text-blue-400 hover:underline mt-1">🌐 Site Oficial</a>
                          ) : (
                            <span className="text-xs text-gray-600 mt-1 block">Sem site comercial</span>
                          )}
                          {lead.cnpj && (
                            <span className="block text-[11px] text-amber-300 font-mono mt-1">CNPJ {lead.cnpj}</span>
                          )}
                        </td>
                        <td className="px-4 py-4 text-gray-400 font-mono text-xs">
                          <div className="flex flex-col gap-1">
                            <span>{lead.telefone}</span>
                            {lead.telefone && lead.telefone !== 'Não informado' && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-green-500/10 text-green-400 border border-green-500/20 text-[10px] w-fit">
                                ✓ Válido
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-4 text-xs">
                          {lead.email ? (
                            <a href={`mailto:${lead.email}`} className="text-purple-400 hover:underline font-mono">{lead.email}</a>
                          ) : (
                            <span className="text-gray-600">—</span>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex flex-col gap-1">
                            {lead.instagram && (
                              <a href={lead.instagram} target="_blank" className="text-pink-400 text-xs hover:underline">📷 Instagram</a>
                            )}
                            {lead.facebook && (
                              <a href={lead.facebook} target="_blank" className="text-blue-500 text-xs hover:underline">📘 Facebook</a>
                            )}
                            {lead.tiktok && (
                              <a href={lead.tiktok} target="_blank" className="text-cyan-300 text-xs hover:underline">🎵 TikTok</a>
                            )}
                            {!lead.instagram && !lead.facebook && !lead.tiktok && (
                              <span className="text-gray-600 text-xs">—</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-4 text-xs text-gray-400">
                          {lead.categoria || '-'}
                        </td>
                        <td className="px-4 py-4 text-xs text-gray-400 max-w-[200px] truncate" title={lead.endereco || '-'}>
                          {lead.endereco || '-'}
                        </td>
                        <td className="px-4 py-4 text-xs text-gray-400">
                          {lead.horarios || '-'}
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2">
                            <button 
                              onClick={() => handleAddToCRM(lead)}
                              className="p-2 rounded bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10 hover:border-white/20 transition-all text-xs cursor-pointer flex items-center gap-1"
                              title="Salvar no CRM"
                            >
                              📁 Salvar
                            </button>
                            {lead.telefone && lead.telefone !== 'Não informado' && (
                              <button 
                                onClick={() => openWhatsApp(lead)}
                                className="p-2 rounded bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20 transition-colors text-xs cursor-pointer"
                                title="WhatsApp Direto"
                              >
                                💬 Whatsapp
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                    
                    {/* Estado vazio: antes de buscar */}
                    {leads.length === 0 && !hasSearched && !isExtracting && (
                      <tr>
                        <td colSpan={8} className="px-4 py-16 text-center">
                          <div className="text-4xl mb-4">🔍</div>
                          <p className="text-gray-300 font-medium text-lg mb-2">Pronto para começar!</p>
                          <p className="text-gray-500 text-sm max-w-md mx-auto">
                            Preencha o formulário ao lado com o nicho e a cidade desejada, defina a quantidade de leads e clique em <span className="text-blue-400 font-semibold">Iniciar Extração</span>.
                          </p>
                        </td>
                      </tr>
                    )}

                    {/* Estado vazio: depois de buscar e não achar nada */}
                    {leads.length === 0 && hasSearched && !isExtracting && (
                      <tr>
                        <td colSpan={8} className="px-4 py-16 text-center">
                          <div className="text-4xl mb-4">🕵️</div>
                          <p className="text-gray-300 font-medium text-lg mb-2">Nenhum lead encontrado</p>
                          <p className="text-gray-500 text-sm max-w-lg mx-auto">
                            O motor não encontrou empresas que atendam ao filtro selecionado nessa região.
                            <br/><br/>
                            <span className="text-blue-400 font-semibold">Nenhum Token foi descontado.</span> Tente mudar o filtro para "Trazer tudo" ou busque outra cidade.
                          </p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>

                {/* Mobile Card List */}
                <div className="mobile-card-list md:hidden p-3 sm:p-4">
                  {leads.map((lead: any, i: number) => (
                    <div 
                      key={i} 
                      className="p-4 rounded-xl bg-white/[0.02] border border-white/5 flex flex-col gap-3 animate-slide-up"
                      style={{ animationDelay: `${i * 0.03}s` }}
                    >
                      <div>
                        <div className="font-bold text-gray-200 text-sm">{lead.nome}</div>
                        {lead.site && lead.site !== 'Sem site' ? (
                          <a href={lead.site} target="_blank" className="inline-block text-xs text-blue-400 hover:underline mt-1">🌐 Site Oficial</a>
                        ) : (
                          <span className="text-xs text-gray-600 mt-1 block">Sem site comercial</span>
                        )}
                        {lead.cnpj && (
                          <span className="block text-[11px] text-amber-300 font-mono mt-1">CNPJ {lead.cnpj}</span>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs border-t border-white/5 pt-3">
                        <div>
                          <span className="text-gray-500 block mb-0.5">Contato</span>
                          <span className="font-mono text-gray-300 block break-words">{lead.telefone}</span>
                          {lead.telefone && lead.telefone !== 'Não informado' && (
                            <span className="inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 rounded bg-green-500/10 text-green-400 border border-green-500/20 text-[9px] w-fit">
                              ✓ Válido
                            </span>
                          )}
                        </div>
                        <div>
                          <span className="text-gray-500 block mb-0.5">E-mail</span>
                          {lead.email ? (
                            <a href={`mailto:${lead.email}`} className="text-purple-400 hover:underline font-mono block break-all">{lead.email}</a>
                          ) : (
                            <span className="text-gray-600 block">—</span>
                          )}
                        </div>
                      </div>

                      <div className="flex justify-between items-center border-t border-white/5 pt-3 gap-2 flex-wrap">
                        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                          {lead.instagram && (
                            <a href={lead.instagram} target="_blank" className="text-pink-400 text-xs hover:underline bg-pink-500/5 px-2 py-1 rounded border border-pink-500/10">📷 Insta</a>
                          )}
                          {lead.facebook && (
                            <a href={lead.facebook} target="_blank" className="text-blue-500 text-xs hover:underline bg-blue-500/5 px-2 py-1 rounded border border-blue-500/10">📘 Face</a>
                          )}
                          {lead.tiktok && (
                            <a href={lead.tiktok} target="_blank" className="text-cyan-300 text-xs hover:underline bg-cyan-500/5 px-2 py-1 rounded border border-cyan-500/10">🎵 TikTok</a>
                          )}
                        </div>

                        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto mt-2 sm:mt-0">
                          <button 
                            onClick={() => handleAddToCRM(lead)}
                            className="w-full sm:w-auto px-3 py-2 rounded bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10 text-xs cursor-pointer flex items-center justify-center gap-1"
                          >
                            📁 Salvar
                          </button>
                          {lead.telefone && lead.telefone !== 'Não informado' && (
                            <button 
                              onClick={() => openWhatsApp(lead)}
                              className="w-full sm:w-auto px-3 py-2 rounded bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20 text-xs cursor-pointer flex items-center justify-center gap-1"
                            >
                              💬 WhatsApp
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Estado vazio: antes de buscar */}
                  {leads.length === 0 && !hasSearched && !isExtracting && (
                    <div className="py-16 text-center">
                      <div className="text-4xl mb-4">🔍</div>
                      <p className="text-gray-300 font-medium text-lg mb-2">Pronto para começar!</p>
                      <p className="text-gray-500 text-xs max-w-xs mx-auto">
                        Preencha o formulário acima com o nicho e a cidade desejada, defina a quantidade de leads e clique em <span className="text-blue-400 font-semibold">Iniciar Extração</span>.
                      </p>
                    </div>
                  )}

                  {/* Estado vazio: depois de buscar e não achar nada */}
                  {leads.length === 0 && hasSearched && !isExtracting && (
                    <div className="py-16 text-center">
                      <div className="text-4xl mb-4">🕵️</div>
                      <p className="text-gray-300 font-medium text-lg mb-2">Nenhum lead encontrado</p>
                      <p className="text-gray-500 text-xs max-w-xs mx-auto">
                        O motor não encontrou empresas que atendam ao filtro selecionado nessa região. Tente mudar o filtro ou busque outra cidade.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* History Modal */}
      {showHistory && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-12 sm:pt-16 px-4">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowHistory(false)} />
          <div className="relative w-full max-w-2xl max-h-[80vh] bg-gray-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-slide-up">
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <h3 className="text-lg font-bold flex items-center gap-2">
                🕐 Histórico de Extrações
              </h3>
              <button
                onClick={() => setShowHistory(false)}
                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors cursor-pointer"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="overflow-y-auto max-h-[calc(80vh-64px)] p-4">
              {historyLoading ? (
                <div className="flex items-center justify-center py-12">
                  <svg className="animate-spin h-6 w-6 text-blue-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                </div>
              ) : historyData.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-3xl mb-3">📭</div>
                  <p className="text-gray-400">Nenhuma extração encontrada.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {historyData.map((h: any) => (
                    <div key={h.id} className="p-4 rounded-xl bg-white/[0.03] border border-white/5 hover:border-white/10 transition-colors">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div>
                          <span className="font-bold text-sm text-white">{h.keyword}</span>
                          <span className="text-gray-400 text-sm mx-1.5">em</span>
                          <span className="font-bold text-sm text-blue-400">{h.location}</span>
                        </div>
                        <span className="text-[11px] text-gray-500 whitespace-nowrap">
                          {new Date(h.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-3 text-xs text-gray-400">
                        <span>🔹 {h.leads_found} leads encontrados</span>
                        <span>🔹 {h.tokens_spent} tokens gastos</span>
                        <span>🔹 {h.search_time_seconds}s de busca</span>
                        {h.filter_rule && h.filter_rule !== 'none' && (
                          <span>🔹 Filtro: {h.filter_rule}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
