'use client';

import { useState, useRef, useEffect } from 'react';
import type { CrmLead, BatchResult } from '@/types/crm';
import { Button } from '@/components/Button';
import { useTranslations } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';

interface Props {
  crmLeads: CrmLead[];
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

interface BatchProgress {
  batchId: string;
  total: number;
  completed: number;
  failed: number;
  percentage: number;
  status: string;
  results: BatchResult[];
}

export default function EnrichSection({ crmLeads, showToast }: Props) {
  const { t } = useTranslations();
  const [, setEnrichStatus] = useState<Record<string, string>>({});
  const [batchProgress, setBatchProgress] = useState<BatchProgress | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const batchIdRef = useRef<string | null>(null);

  const enrichedLeads = crmLeads.filter(l => l.email || l.instagram || l.facebook || l.tiktok || l.linkedin);
  const needsEnrichment = crmLeads.filter(l => !l.email && !l.instagram && !l.facebook && !l.tiktok && !l.linkedin);

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

            if (data.completed > 0) {
              showToast(`${data.completed} leads enriquecidos!`, 'success');
            }
            if (data.failed > 0) {
              showToast(`${data.failed} leads falharam.`, 'error');
            }
          }
        }
      } catch (e) { console.warn('[ENRICH:EnrichSection] poll:', e); }
    }, 1500);
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
    <div className="app-card p-7 rounded-[2rem] bg-gradient-to-b from-white/[0.03] to-black/40 border border-white/10 shadow-2xl relative overflow-hidden animate-slide-up mb-6" id="enrich-section">
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 to-pink-500" />
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">{t('enrich.title')}</h2>
          <p className="text-xs text-gray-400 mt-1">{t('enrich.desc')}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-[11px] text-gray-500 bg-white/5 border border-white/10 rounded-lg px-3 py-2 whitespace-nowrap">
            {enrichedLeads.length}/{crmLeads.length} {t('enrich.complete')}
          </div>
          {needsEnrichment.length > 0 && (
            <Button onClick={enrichAll} disabled={isBatchRunning} variant="primary" size="sm"
              className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 shadow-lg shadow-purple-600/20">
              {isBatchRunning ? t('enrich.enriching') : `${t('enrich.enrichAll')} (${needsEnrichment.length})`}
            </Button>
          )}
        </div>
      </div>

      {isBatchRunning && batchProgress && (
        <div className="mb-5 bg-blue-500/5 border border-blue-500/15 rounded-xl p-4">
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

      <div className="grid grid-cols-4 gap-3 mb-5">
        <div className="bg-black/30 border border-white/5 rounded-xl p-3 text-center">
          <div className="text-xl font-bold text-gray-200">{crmLeads.length}</div>
          <div className="text-[10px] text-gray-500 mt-0.5">{t('enrich.totalCRM')}</div>
        </div>
        <div className="bg-black/30 border border-white/5 rounded-xl p-3 text-center">
          <div className="text-xl font-bold text-green-400">{enrichedLeads.length}</div>
          <div className="text-[10px] text-gray-500 mt-0.5">{t('enrich.complete')}</div>
        </div>
        <div className="bg-black/30 border border-white/5 rounded-xl p-3 text-center">
          <div className="text-xl font-bold text-amber-400">{needsEnrichment.length}</div>
          <div className="text-[10px] text-gray-500 mt-0.5">{t('enrich.needDataLabel')}</div>
        </div>
        <div className="bg-black/30 border border-white/5 rounded-xl p-3 text-center">
          <div className="text-xl font-bold text-purple-400">{needsEnrichment.length}</div>
          <div className="text-[10px] text-gray-500 mt-0.5">{t('enrich.readyToEnrich')}</div>
        </div>
      </div>

      <div className="bg-purple-500/5 border border-purple-500/15 rounded-xl p-4">
        <h3 className="text-sm font-bold text-purple-300 mb-2">⚡ {t('enrich.howItWorksTitle')}</h3>
        <ol className="text-xs text-gray-400 space-y-1 list-decimal list-inside">
          <li>{t('enrich.howItWorks1')}</li>
          <li>{t('enrich.howItWorks2')}</li>
          <li>{t('enrich.howItWorks3')}</li>
        </ol>
      </div>
    </div>
  );
}
