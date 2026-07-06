'use client';

import React from 'react';
import type { FeatureKey } from '@/lib/plans';
import type { SearchLead } from '@/app/api/extract/lib/types';
import type { CrmLead, ExtractStats } from '@/types/crm';
import HackerRadar from '@/components/HackerRadar';

import { Button } from '@/components/Button';
import { useTranslations } from '@/lib/i18n';

export interface ExtractorSectionProps {
  isExtracting: boolean;
  hasSearched: boolean;
  leads: SearchLead[];
  extractStats: ExtractStats | null;
  keyword: string;
  location: string;
  limit: number | '';
  filterRule: string;
  user: { id: string; email?: string } | null;
  handleExtract: (e: React.FormEvent) => Promise<void>;
  handleAddToCRM: (lead: SearchLead | CrmLead) => void;
  handleAddAllToCRM: () => void;
  openWhatsApp: (lead: SearchLead | CrmLead, customText?: string, options?: Record<string, any>) => void;
  exportToCSV: () => void;
  exportToXLSX: () => Promise<void>;
  fetchHistory: () => Promise<void>;
  showHistory: boolean;
  setShowHistory: (v: boolean) => void;
  historyLoading: boolean;
  historyData: Record<string, any>[];
  requireFeature: (feature: FeatureKey) => boolean;
  showLockedFeature: (feature: FeatureKey) => void;
  getUpgradePlan: (feature: FeatureKey) => { nameKey: string; shortNameKey: string; tokens: number };
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
  user,
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
  onCancel,
}: ExtractorSectionProps) {
  const { t, locale } = useTranslations();

  return (
    <>
      {/* Overview Cards */}
      {hasSearched && !isExtracting && leads.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5 animate-slide-up">
          {[
            { label: t('extractor.overviewLeads'), value: leads.length, color: 'text-blue-400' },
            { label: t('extractor.overviewTime'), value: `${extractStats?.time || 0}s`, color: 'text-cyan-400' },
            { label: t('extractor.overviewMapped'), value: extractStats?.scanned || 0, color: 'text-green-400' },
            { label: t('extractor.overviewCities'), value: extractStats?.cities_scanned || 1, color: 'text-purple-400' },
          ].map(s => (
            <div key={s.label} className="bg-black/30 border border-white/5 rounded-xl p-3 text-center">
              <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
              <div className="text-[10px] text-gray-500 mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 lg:gap-8 relative z-20">
        {/* PAINEL DE BUSCA */}
        <div className="lg:col-span-1 animate-slide-up" style={{ animationDelay: '0.1s' }}>
          <div className="app-card p-7 rounded-[2rem] bg-gradient-to-b from-white/[0.05] to-black/40 border border-white/10 shadow-2xl relative overflow-hidden group hover:border-blue-500/30 transition-all duration-500">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-500" />
            
            <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
              <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              {t('extractor.newExtraction')}
            </h2>

            <form onSubmit={handleExtract} className="space-y-5">

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">{t('extractor.whatToSearch')}</label>
                <input 
                  type="text" 
                  placeholder={t('extractor.whatPlaceholder')}
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">{t('extractor.cityRegion')}</label>
                <input 
                  type="text" 
                  placeholder={t('extractor.cityPlaceholder')}
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">{t('extractor.howManyLeads')}</label>
                <input 
                  type="number" min="1" max="10000" placeholder="10"
                  style={{ colorScheme: 'dark' }}
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                  value={limit}
                  onChange={(e) => setLimit(e.target.value === '' ? '' : Number(e.target.value))}
                  required
                />
              </div>




              
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
                  {t('extractor.stopExtraction')}
                </button>
              ) : (
                <Button type="submit" size="lg" className="w-full hover:shadow-[0_0_20px_rgba(59,130,246,0.5)]">
                  {user ? t('extractor.startExtraction') : t('extractor.createAccountToExtract')}
                </Button>
              )}
            </form>
          </div>
        </div>

        {/* PAINEL DE RESULTADOS */}
        <div className="lg:col-span-2 animate-slide-up" style={{ animationDelay: '0.2s' }}>
          <div className="app-card p-7 rounded-[2rem] bg-gradient-to-b from-white/[0.03] to-black/40 border border-white/10 h-full min-h-[400px] flex flex-col shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-cyan-400" />
            
            {/* Header dos resultados */}
            <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
              <div>
                <h2 className="text-xl font-semibold flex items-center gap-2">
                  {isExtracting ? t('extractor.extracting') : leads.length > 0 ? t('extractor.leadsFound') : t('extractor.resultsGallery')}
                  {leads.length > 0 && <span className="text-sm px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 font-bold">{leads.length}</span>}
                </h2>
                {extractStats && (
                  <div className="mt-1 space-y-0.5 animate-fade-in">
                    <p className="text-xs text-gray-500">
                      {t('extractor.mapped', { count: extractStats.scanned, time: extractStats.time })}
                    </p>
                    {extractStats.correctedKeyword && (
                      <p className="text-xs text-blue-400 font-medium">
                        {t('extractor.search', { query: `"${extractStats.correctedKeyword}${extractStats.broadRegion ? ` (${t('extractor.entireCountry')})` : ` ${t('extractor.in')} ${extractStats.correctedLocation}`}"` })}
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
                  {t('extractor.saveToCRM')}
                </button>
                <button 
                  onClick={exportToCSV}
                  disabled={leads.length === 0}
                  className="flex flex-1 sm:flex-none items-center justify-center gap-2 text-sm text-blue-400 hover:text-blue-300 transition-colors disabled:opacity-30 disabled:cursor-not-allowed bg-blue-500/10 px-4 py-2 rounded-lg border border-blue-500/20 cursor-pointer"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  {t('extractor.exportCSV')}
                </button>
                <button 
                  onClick={exportToXLSX}
                  disabled={leads.length === 0}
                  className="flex flex-1 sm:flex-none items-center justify-center gap-2 text-sm text-emerald-400 hover:text-emerald-300 transition-colors disabled:opacity-30 disabled:cursor-not-allowed bg-emerald-500/10 px-4 py-2 rounded-lg border border-emerald-500/20 cursor-pointer"
                >
                  {t('extractor.exportExcel')}
                </button>
                <button 
                  onClick={fetchHistory}
                  className="flex flex-1 sm:flex-none items-center justify-center gap-2 text-sm text-amber-400 hover:text-amber-300 transition-colors bg-amber-500/10 px-4 py-2 rounded-lg border border-amber-500/20 cursor-pointer"
                >
                  {t('extractor.history')}
                </button>
              </div>
            </div>

            {/* Loading State (High-tech Hacker Radar) */}
            {isExtracting && (
              <div className="flex-1 py-4">
                <HackerRadar keyword={keyword} location={location} extractStats={extractStats} />
              </div>
            )}

            {/* Cards de Resultados */}
            {!isExtracting && (
              <div className="flex-1 space-y-3 pr-1 overflow-y-auto max-h-[500px]">
                {leads.map((lead, i: number) => {
                  const ratingNum = parseFloat(lead.avaliacao);
                  const hasWhatsApp = lead.isMobile || lead.hasWhatsApp || false;
                  const phoneNumber = lead.telefone && lead.telefone !== 'Não informado' ? lead.telefone : null;
                  return (
                    <div 
                      key={i} 
                      className="bg-black/30 border border-white/5 hover:border-white/10 rounded-xl p-4 transition-all duration-200 animate-slide-up"
                      style={{ animationDelay: `${i * 0.03}s` }}
                    >
                      {/* Header: Name + Rating */}
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="min-w-0 flex-1">
                          <h3 className="font-bold text-white text-sm sm:text-base truncate">{lead.nome}</h3>
                          {lead.categoria && (
                            <p className="text-xs text-gray-500 mt-0.5 truncate">{lead.categoria}</p>
                          )}
                        </div>
                        {!isNaN(ratingNum) && (
                          <div className="flex items-center gap-1 text-yellow-400 text-xs flex-shrink-0">
                            <span className="flex">
                              {[1,2,3,4,5].map(i => (
                                <span key={i}>{i <= Math.round(ratingNum) ? '★' : '☆'}</span>
                              ))}
                            </span>
                            <span className="text-gray-400 ml-0.5">{ratingNum}</span>
                          </div>
                        )}
                      </div>

                      {/* Phone with WhatsApp/Landline badge */}
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-gray-200 font-mono text-sm">{phoneNumber || 'Não informado'}</span>
                        {phoneNumber && (
                          hasWhatsApp ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-500/15 text-green-400 border border-green-500/30 text-[10px] font-semibold">
                              <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                              WhatsApp
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-500/15 text-gray-400 border border-gray-500/30 text-[10px] font-semibold">
                              Fixo
                            </span>
                          )
                        )}
                      </div>

                      {/* Website */}
                      {lead.site && lead.site !== 'Sem site' && (
                        <a 
                          href={lead.site} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-blue-400 hover:text-blue-300 text-xs block truncate mb-1 max-w-full"
                        >
                          {lead.site}
                        </a>
                      )}

                      {/* Address */}
                      {lead.endereco && (
                        <p className="text-gray-500 text-xs truncate mb-1" title={lead.endereco}>
                          📍 {lead.endereco}
                        </p>
                      )}

                      {/* Action buttons */}
                      <div className="flex items-center gap-2 pt-3 mt-3 border-t border-white/5">
                        <button
                          onClick={() => handleAddToCRM(lead)}
                          className="flex-1 sm:flex-none px-3 py-2 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                          Salvar no CRM
                        </button>
                        {phoneNumber && (
                          hasWhatsApp ? (
                            <button
                              onClick={() => openWhatsApp(lead)}
                              className="flex-1 sm:flex-none px-3 py-2 rounded-lg bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20 text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5"
                            >
                              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                              </svg>
                              Usar WhatsApp
                            </button>
                          ) : (
                            <button
                              onClick={() => navigator.clipboard.writeText(phoneNumber)}
                              className="flex-1 sm:flex-none px-3 py-2 rounded-lg bg-gray-500/10 text-gray-400 border border-gray-500/20 hover:bg-gray-500/20 text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                              </svg>
                              Copiar Telefone
                            </button>
                          )
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Estado vazio: antes de buscar */}
                {leads.length === 0 && !hasSearched && !isExtracting && (
                  <div className="py-16 text-center">
                    <div className="text-4xl mb-4">🔍</div>
                    <p className="text-gray-300 font-medium text-lg mb-2">{t('extractor.emptyTitle')}</p>
                    <p className="text-gray-500 text-sm max-w-md mx-auto">
                      {t('extractor.emptyDesc')}
                    </p>
                  </div>
                )}

                {/* Estado vazio: depois de buscar e não achar nada */}
                {leads.length === 0 && hasSearched && !isExtracting && (
                  <div className="py-16 text-center">
                    <div className="text-4xl mb-4">🕵️</div>
                    <p className="text-gray-300 font-medium text-lg mb-2">{t('extractor.noResultsTitle')}</p>
                    <p className="text-gray-500 text-sm max-w-lg mx-auto">
                      {t('extractor.noResultsDesc')}
                      <br/><br/>
                      <span className="text-blue-400 font-semibold">{t('extractor.noResultsTokens')}</span>
                    </p>
                  </div>
                )}
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
                {t('extractor.historyTitle')}
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
                  <p className="text-gray-400">{t('extractor.historyEmpty')}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {historyData.map((h: Record<string, any>) => (
                    <div key={h.id} className="p-4 rounded-xl bg-white/[0.03] border border-white/5 hover:border-white/10 transition-colors">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div>
                          <span className="font-bold text-sm text-white">{h.keyword}</span>
                          <span className="text-gray-400 text-sm mx-1.5">{t('extractor.in')}</span>
                          <span className="font-bold text-sm text-blue-400">{h.location}</span>
                        </div>
                        <span className="text-[11px] text-gray-500 whitespace-nowrap">
                          {new Date(h.created_at).toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-3 text-xs text-gray-400">
                        <span>{t('extractor.historyLeads', { count: h.leads_found })}</span>
                        <span>{t('extractor.historyTokens', { count: h.tokens_spent })}</span>
                        <span>{t('extractor.historyTime', { time: h.search_time_seconds })}</span>
                        {h.filter_rule && h.filter_rule !== 'none' && (
                          <span>{t('extractor.historyFilter', { filter: h.filter_rule })}</span>
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
