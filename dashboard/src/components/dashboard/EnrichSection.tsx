'use client';

import { useState, useRef, useEffect } from 'react';
import { getLeadKey } from './dashboard-constants';
import { useTranslations } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';

interface Props {
  crmLeads: any[];
  handleReEnrichSingle: (lead: any) => Promise<void>;
  handleReEnrichSelected: () => Promise<void>;
  enrichLoading: boolean;
  selectedCrmLeads: string[];
  setSelectedCrmLeads: React.Dispatch<React.SetStateAction<string[]>>;
  openWhatsApp: (lead: any) => void;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

interface BatchProgress {
  batchId: string;
  total: number;
  completed: number;
  failed: number;
  percentage: number;
  status: string;
  results: any[];
}

export default function EnrichSection({ crmLeads, handleReEnrichSingle, handleReEnrichSelected, enrichLoading, selectedCrmLeads, setSelectedCrmLeads, openWhatsApp, showToast }: Props) {
  const { t } = useTranslations();
  const [enrichStatus, setEnrichStatus] = useState<Record<string, string>>({});
  const [batchProgress, setBatchProgress] = useState<BatchProgress | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const batchIdRef = useRef<string | null>(null);

  const enrichedLeads = crmLeads.filter(l => l.email || l.instagram || l.facebook || l.tiktok);
  const needsEnrichment = crmLeads.filter(l => !l.email && !l.instagram && !l.facebook && !l.tiktok);
  // Mostra todos os leads que precisam de enriquecimento (o motor descobre site automaticamente)
  const leadsToEnrich = needsEnrichment.length > 0 ? needsEnrichment : crmLeads.filter(l => (l.site && l.site !== 'Sem site') || l.placeUrl);

  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  const pollBatchProgress = async (batchId: string) => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    batchIdRef.current = batchId;

    pollingRef.current = setInterval(async () => {
      if (!batchIdRef.current) return;
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) return;
        const res = await fetch(`/api/lead-enrich/batch?batchId=${batchIdRef.current}`, {
          headers: { Authorization: `Bearer ${session.access_token}` }
        });
        const data = await res.json();
        if (data.success) {
          setBatchProgress(data);
          if (data.status === 'completed' || data.status === 'failed') {
            if (pollingRef.current) clearInterval(pollingRef.current);
            pollingRef.current = null;
            batchIdRef.current = null;

            if (data.results && data.results.length > 0) {
              const newStatus: Record<string, string> = {};
              data.results.forEach((r: any) => {
                newStatus[r.nome] = r.error ? 'erro' : 'concluido';
              });
              setEnrichStatus(prev => ({ ...prev, ...newStatus }));
            }

            if (data.completed > 0) {
              showToast(`${data.completed} leads enriquecidos!`, 'success');
            }
            if (data.failed > 0) {
              showToast(`${data.failed} leads falharam.`, 'error');
            }
          }
        }
      } catch { /* silence */ }
    }, 1500);
  };

  const handleEnrich = async (lead: any) => {
    setEnrichStatus(s => ({ ...s, [lead.nome]: 'buscando...' }));
    try {
      await handleReEnrichSingle(lead);
      setEnrichStatus(s => ({ ...s, [lead.nome]: 'concluido' }));
    } catch {
      setEnrichStatus(s => ({ ...s, [lead.nome]: 'erro' }));
    }
  };

  const enrichAll = async () => {
    const leadsToProcess = needsEnrichment.slice(0, 50);

    setEnrichStatus({});
    setBatchProgress({
      batchId: '',
      total: leadsToProcess.length,
      completed: 0,
      failed: 0,
      percentage: 0,
      status: 'running',
      results: [],
    });

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;

      const res = await fetch('/api/lead-enrich/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          leads: leadsToProcess.map(l => ({
            nome: l.nome,
            site: l.site,
            cidade: l.cidade,
            cnpj: l.cnpj,
            email: l.email,
            instagram: l.instagram,
            facebook: l.facebook,
            tiktok: l.tiktok,
          }))
        }),
      });

      const data = await res.json();
      if (data.success && data.batchId) {
        pollBatchProgress(data.batchId);
      } else {
        showToast(data.error || 'Erro ao iniciar lote.', 'error');
        setBatchProgress(null);
      }
    } catch (err: any) {
      showToast(err.message || 'Erro de conexão.', 'error');
      setBatchProgress(null);
    }
  };

  const isBatchRunning = batchProgress?.status === 'running';

  return (
    <div className="space-y-6">
      <div className="app-card p-7 rounded-[2rem] bg-gradient-to-b from-white/[0.03] to-black/40 border border-white/10 shadow-2xl relative overflow-hidden animate-slide-up" id="enrich-section">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 to-pink-500" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">{t('enrich.title')}</h2>
            <p className="text-sm text-gray-400 mt-1">{t('enrich.desc')}</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-xs text-gray-500 bg-white/5 border border-white/10 rounded-lg px-3 py-2">
              {t('enrich.needData', { count: needsEnrichment.length, done: enrichedLeads.length })}
            </div>
            {needsEnrichment.length > 0 && (
              <button onClick={enrichAll} disabled={isBatchRunning} className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white text-xs font-bold cursor-pointer disabled:opacity-50 transition-all shadow-lg shadow-purple-600/20">
                {isBatchRunning ? t('enrich.enriching') : t('enrich.enrichAll')}
              </button>
            )}
          </div>
        </div>

        {isBatchRunning && batchProgress && (
          <div className="mb-6 bg-blue-500/5 border border-blue-500/15 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                <span className="text-xs font-bold text-blue-300">{t('enrich.enriching')}</span>
              </div>
              <span className="text-xs text-gray-400 font-mono">
                {batchProgress.completed + batchProgress.failed}/{batchProgress.total} ({batchProgress.percentage}%)
              </span>
            </div>
            <div className="w-full h-3 bg-black/30 rounded-full overflow-hidden border border-white/5">
              <div
                className="h-full bg-gradient-to-r from-purple-600 to-pink-600 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${batchProgress.percentage}%` }}
              />
            </div>
            <div className="flex gap-4 mt-2 text-[11px]">
              <span className="text-green-400">{batchProgress.completed} {t('enrich.completedLabel')}</span>
              {batchProgress.failed > 0 && <span className="text-red-400">{batchProgress.failed} {t('enrich.failedLabel')}</span>}
              <span className="text-gray-500">{batchProgress.total - batchProgress.completed - batchProgress.failed} {t('enrich.pendingLabel')}</span>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div className="bg-black/30 border border-white/5 rounded-xl p-3 text-center">
            <div className="text-2xl font-bold text-gray-200">{crmLeads.length}</div>
            <div className="text-[10px] text-gray-500 mt-0.5">{t('enrich.totalCRM')}</div>
          </div>
          <div className="bg-black/30 border border-white/5 rounded-xl p-3 text-center">
            <div className="text-2xl font-bold text-green-400">{enrichedLeads.length}</div>
            <div className="text-[10px] text-gray-500 mt-0.5">{t('enrich.complete')}</div>
          </div>
          <div className="bg-black/30 border border-white/5 rounded-xl p-3 text-center">
            <div className="text-2xl font-bold text-amber-400">{needsEnrichment.length}</div>
            <div className="text-[10px] text-gray-500 mt-0.5">{t('enrich.needDataLabel')}</div>
          </div>
          <div className="bg-black/30 border border-white/5 rounded-xl p-3 text-center">
            <div className="text-2xl font-bold text-purple-400">{leadsToEnrich.length}</div>
            <div className="text-[10px] text-gray-500 mt-0.5">{t('enrich.readyToEnrich')}</div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/5 bg-black/20 overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-white/5 border-b border-white/5 text-gray-400">
              <tr>
                <th className="px-4 py-3 font-medium w-10 text-center">
                  <input type="checkbox" checked={leadsToEnrich.length > 0 && leadsToEnrich.every(l => selectedCrmLeads.includes(l.nome))}
                    onChange={() => setSelectedCrmLeads(leadsToEnrich.map(l => l.nome))}
                    className="rounded border-white/20 bg-black/40 text-blue-500 cursor-pointer h-4 w-4" />
                </th>
                <th className="px-4 py-3 font-medium">{t('enrich.tableLead')}</th>
                <th className="px-4 py-3 font-medium">{t('enrich.tableMissing')}</th>
                <th className="px-4 py-3 font-medium">{t('enrich.tableStatus')}</th>
                <th className="px-4 py-3 font-medium">{t('enrich.tableAction')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {leadsToEnrich.slice(0, 30).map((lead, i) => {
                const missing = [];
                if (!lead.email) missing.push('Email');
                if (!lead.cnpj) missing.push('CNPJ');
                if (!lead.instagram) missing.push('Instagram');
                if (!lead.facebook) missing.push('Facebook');
                if (!lead.tiktok) missing.push('TikTok');
                const status = enrichStatus[lead.nome];

                return (
                  <tr key={i} className="hover:bg-white/[0.03] transition-colors">
                    <td className="px-4 py-4 text-center">
                      <input type="checkbox" checked={selectedCrmLeads.includes(lead.nome)}
                        onChange={() => setSelectedCrmLeads(prev => prev.includes(lead.nome) ? prev.filter(n => n !== lead.nome) : [...prev, lead.nome])}
                        className="rounded border-white/20 bg-black/40 text-blue-500 cursor-pointer h-4 w-4" />
                    </td>
                    <td className="px-4 py-4">
                      <div className="font-bold text-gray-200">{lead.nome}</div>
                      <div className="text-xs text-gray-500">{lead.nicho} · {lead.cidade}</div>
                      {lead.telefone !== 'Não informado' && <div className="text-xs text-gray-400 font-mono mt-0.5">📞 {lead.telefone}</div>}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-wrap gap-1">
                        {missing.map(m => (
                          <span key={m} className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            m === 'Email' ? 'bg-red-500/10 text-red-300 border border-red-500/20' :
                            m === 'CNPJ' ? 'bg-amber-500/10 text-amber-300 border border-amber-500/20' :
                            'bg-blue-500/10 text-blue-300 border border-blue-500/20'
                          }`}>{m}</span>
                        ))}
                        {missing.length === 0 && <span className="text-[10px] text-green-400">{t('enrich.completeBadge')}</span>}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      {status === 'buscando...' && <span className="text-xs text-blue-400 animate-pulse">{t('enrich.statusSearching')}</span>}
                      {status === 'concluido' && <span className="text-xs text-green-400">✅ {t('enrich.statusDone')}</span>}
                      {status === 'erro' && <span className="text-xs text-red-400">❌ {t('enrich.statusError')}</span>}
                      {!status && missing.length === 0 && <span className="text-xs text-green-400/60">{t('enrich.completeBadge')}</span>}
                      {!status && missing.length > 0 && <span className="text-xs text-gray-500">{t('enrich.statusPending')}</span>}
                    </td>
                    <td className="px-4 py-4">
                      {missing.length > 0 && status !== 'buscando...' && (
                        <button onClick={() => handleEnrich(lead)} disabled={isBatchRunning}
                          className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white border border-purple-500/30 text-xs font-semibold cursor-pointer disabled:opacity-50 transition-colors">
                          {t('enrich.searchData')}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {leadsToEnrich.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-16 text-center text-gray-500">
                  <div className="text-3xl mb-3">🔍</div>
                  <p className="font-semibold">{t('enrich.noLeadsWithSite')}</p>
                  <p className="text-xs mt-1">{t('enrich.noLeadsHint')}</p>
                </td></tr>
              )}
            </tbody>
          </table>
        </div>

        {leadsToEnrich.length > 30 && (
          <p className="text-xs text-gray-500 text-center mt-3">{t('enrich.showMore', { total: leadsToEnrich.length })}</p>
        )}

        <div className="bg-purple-500/5 border border-purple-500/15 rounded-xl p-4 mt-6">
          <h3 className="text-sm font-bold text-purple-300 mb-2">⚡ {t('enrich.howItWorksTitle')}</h3>
          <ol className="text-xs text-gray-400 space-y-1 list-decimal list-inside">
            <li>{t('enrich.howItWorks1')}</li>
            <li>{t('enrich.howItWorks2')}</li>
            <li>{t('enrich.howItWorks3')}</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
