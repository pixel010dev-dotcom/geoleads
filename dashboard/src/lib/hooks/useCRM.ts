'use client';

import { useState, useCallback } from 'react';
import type { CrmLead } from '@/types/crm';
import { showToast } from '@/components/Toast';
import { supabase } from '@/lib/supabase';
import { getLeadKey, crmLeadToRow, crmRowToLead } from '@/components/dashboard/dashboard-constants';

type CrmSyncStatus = 'local' | 'syncing' | 'cloud' | 'error';

interface UseCRMOptions {
  userId?: string | null;
}

interface UseCRMMethods {
  crmLeads: CrmLead[];
  setCrmLeads: (leads: CrmLead[]) => void;
  crmSearch: string;
  setCrmSearch: (v: string) => void;
  crmFilterStage: string;
  setCrmFilterStage: (v: string) => void;
  crmPage: number;
  setCrmPage: (v: number | ((prev: number) => number)) => void;
  crmSyncStatus: CrmSyncStatus;
  crmSyncMessage: string;
  loadCrmFromCloud: (userId: string) => Promise<CrmLead[]>;
  syncCrmToCloud: (leads: CrmLead[], targetUserId?: string) => Promise<void>;
  deleteCrmFromCloud: (leadKeys: string[], targetUserId?: string) => Promise<void>;
  addLeadsToCrm: (newLeads: CrmLead[], currentLeads: CrmLead[]) => Promise<CrmLead[]>;
}

export function useCRM({ userId }: UseCRMOptions = {}): UseCRMMethods {
  const [crmLeads, setCrmLeads] = useState<CrmLead[]>([]);
  const [crmSearch, setCrmSearch] = useState('');
  const [crmFilterStage, setCrmFilterStage] = useState('all');
  const [crmPage, setCrmPage] = useState(0);
  const [crmSyncStatus, setCrmSyncStatus] = useState<CrmSyncStatus>('local');
  const [crmSyncMessage, setCrmSyncMessage] = useState('CRM local');

  const loadCrmFromCloud = useCallback(async (targetUserId: string): Promise<CrmLead[]> => {
    const { data, error } = await supabase
      .from('crm_leads')
      .select('*')
      .eq('user_id', targetUserId)
      .order('saved_at', { ascending: false });
    if (error) throw error;
    return (data || []).map(crmRowToLead);
  }, []);

  const syncCrmToCloud = useCallback(async (leads: CrmLead[], targetUserId?: string) => {
    const uid = targetUserId || userId;
    if (!uid) {
      setCrmSyncStatus('local');
      setCrmSyncMessage('CRM local');
      return;
    }
    setCrmSyncStatus('syncing');
    setCrmSyncMessage('Sincronizando...');
    const rows = leads.map(lead => crmLeadToRow(lead, uid));
    if (rows.length === 0) {
      setCrmSyncStatus('cloud');
      setCrmSyncMessage('CRM na nuvem');
      return;
    }
    const { error } = await supabase
      .from('crm_leads')
      .upsert(rows, { onConflict: 'user_id,lead_key' });
    if (error) {
      console.warn('[CRM] cloud sync failed:', error.message);
      setCrmSyncStatus('error');
      setCrmSyncMessage('Salvo localmente');
      return;
    }
    setCrmSyncStatus('cloud');
    setCrmSyncMessage('CRM na nuvem');
  }, [userId]);

  const deleteCrmFromCloud = useCallback(async (leadKeys: string[], targetUserId?: string) => {
    const uid = targetUserId || userId;
    if (!uid || leadKeys.length === 0) return;
    const { error } = await supabase
      .from('crm_leads')
      .delete()
      .eq('user_id', uid)
      .in('lead_key', leadKeys);
    if (error) {
      console.warn('[CRM] cloud delete failed:', error.message);
      setCrmSyncStatus('error');
      setCrmSyncMessage('Exclusão só local');
    }
  }, [userId]);

  const addLeadsToCrm = useCallback(async (newLeads: CrmLead[], currentLeads: CrmLead[]): Promise<CrmLead[]> => {
    const existingKeys = new Set(currentLeads.map(l => getLeadKey(l)));
    const deduped = newLeads.filter(l => !existingKeys.has(getLeadKey(l)));
    if (deduped.length === 0) {
      showToast('Todos já estão no CRM.', 'info');
      return currentLeads;
    }
    const updated = [...deduped, ...currentLeads];
    setCrmLeads(updated);
    showToast(`${deduped.length} lead(s) adicionado(s) ao CRM.`, 'success');
    return updated;
  }, []);

  return {
    crmLeads, setCrmLeads,
    crmSearch, setCrmSearch,
    crmFilterStage, setCrmFilterStage,
    crmPage, setCrmPage,
    crmSyncStatus, crmSyncMessage,
    loadCrmFromCloud, syncCrmToCloud, deleteCrmFromCloud, addLeadsToCrm,
  };
}
