'use client';

import { useState, useRef, useCallback } from 'react';
import type { SearchLead } from '@/app/api/extract/lib/types';
import type { ExtractStats } from '@/types/crm';
import { showToast } from '@/components/Toast';
type ExtractionFilter = 'none' | 'has_phone' | 'has_cnpj' | 'has_email' | 'has_whatsapp';

interface UseExtractionReturn {
  keyword: string;
  setKeyword: (v: string) => void;
  location: string;
  setLocation: (v: string) => void;
  limit: number | '';
  setLimit: (v: number | '') => void;
  isExtracting: boolean;
  hasSearched: boolean;
  leads: SearchLead[];
  extractStats: ExtractStats | null;
  filterRule: ExtractionFilter;
  setFilterRule: (v: ExtractionFilter) => void;
  startExtraction: (getHeaders: () => Promise<Record<string, string> | null>) => Promise<void>;
  cancelExtraction: () => Promise<void>;
  reset: () => void;
}

export function useExtraction(): UseExtractionReturn {
  const [keyword, setKeyword] = useState('');
  const [location, setLocation] = useState('');
  const [limit, setLimit] = useState<number | ''>(10);
  const [isExtracting, setIsExtracting] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [leads, setLeads] = useState<SearchLead[]>([]);
  const [extractStats, setExtractStats] = useState<ExtractStats | null>(null);
  const [filterRule, setFilterRule] = useState<ExtractionFilter>('none');

  const currentJobIdRef = useRef<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollCountRef = useRef(0);
  const mountedRef = useRef(true);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const startExtraction = useCallback(async (getHeaders: () => Promise<Record<string, string> | null>) => {
    setIsExtracting(true);
    setHasSearched(false);
    setLeads([]);
    setExtractStats(null);

    const headers = await getHeaders();
    if (!headers) { setIsExtracting(false); return; }

    try {
      const res = await fetch('/api/extract', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          keyword: keyword.trim(),
          location: location.trim(),
          limit: limit || 50,
          language: 'pt-BR',
          region: 'BR',
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Erro ao iniciar extração' }));
        showToast(err.error || 'Erro ao iniciar extração', 'error');
        setIsExtracting(false);
        return;
      }

      const { jobId } = await res.json();
      if (!jobId) {
        showToast('Resposta inválida do servidor.', 'error');
        setIsExtracting(false);
        return;
      }

      currentJobIdRef.current = jobId;
      pollCountRef.current = 0;

      pollRef.current = setInterval(async () => {
        try {
          const statusRes = await fetch(`/api/extract/job/${jobId}`, { headers });
          if (!statusRes.ok) { stopPolling(); setIsExtracting(false); return; }
          const data = await statusRes.json();

          if (data.leads) setLeads(data.leads);
          if (data.stats) setExtractStats(data.stats);

          pollCountRef.current++;

          if (data.status === 'completed' || data.status === 'failed' || data.error || pollCountRef.current > 90) {
            stopPolling();
            setIsExtracting(false);
            setHasSearched(true);
            if (data.error) showToast(data.error, 'error');
          }
        } catch {
          stopPolling();
          setIsExtracting(false);
        }
      }, 2000);
    } catch (err: any) {
      showToast(err.message || 'Erro de rede', 'error');
      setIsExtracting(false);
    }
  }, [keyword, location, limit, stopPolling]);

  const cancelExtraction = useCallback(async () => {
    stopPolling();
    setIsExtracting(false);
    if (currentJobIdRef.current) {
      try {
        await fetch(`/api/extract/cancel`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jobId: currentJobIdRef.current }),
        });
      } catch { /* ignore */ }
    }
  }, [stopPolling]);

  const reset = useCallback(() => {
    stopPolling();
    setIsExtracting(false);
    setHasSearched(false);
    setLeads([]);
    setExtractStats(null);
    setFilterRule('none');
  }, [stopPolling]);

  return {
    keyword, setKeyword,
    location, setLocation,
    limit, setLimit,
    isExtracting, hasSearched,
    leads, extractStats,
    filterRule, setFilterRule,
    startExtraction, cancelExtraction, reset,
  };
}
