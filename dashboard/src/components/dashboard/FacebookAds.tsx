'use client';

import { useState, useEffect, useCallback } from 'react';
import { showToast } from '@/components/Toast';

interface Campaign {
  id: string;
  name: string;
  status: string;
  daily_budget: string;
  spend: string;
  impressions: string;
  reach: string;
  objective: string;
  created_time: string;
  start_time?: string;
  stop_time?: string;
}

export default function FacebookAds({ showToast: toast }: { showToast?: (msg: string, type?: 'success' | 'error' | 'warning' | 'info') => void }) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [configured, setConfigured] = useState(true);
  const [error, setError] = useState('');

  const t = toast || showToast;

  const fetchCampaigns = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data: { session } } = await (await import('@/lib/supabase')).supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) { t('Faça login novamente.', 'error'); return; }
      const res = await fetch('/api/facebook/ads', { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (data.error) {
        if (data.error.includes('FACEBOOK_ACCESS_TOKEN') || data.error.includes('FACEBOOK_AD_ACCOUNT')) {
          setConfigured(false);
        } else {
          setError(data.error);
        }
        return;
      }
      setCampaigns(data.campaigns || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { fetchCampaigns(); }, [fetchCampaigns]);

  const toggleCampaign = async (campaign: Campaign) => {
    const newStatus = campaign.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
    try {
      const { data: { session } } = await (await import('@/lib/supabase')).supabase.auth.getSession();
      const res = await fetch('/api/facebook/ads', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ campaignId: campaign.id, status: newStatus }),
      });
      const data = await res.json();
      if (data.success) {
        t(newStatus === 'ACTIVE' ? 'Campanha ativada!' : 'Campanha pausada!', 'success');
        fetchCampaigns();
      } else throw new Error(data.error);
    } catch (err: any) {
      t('Erro: ' + err.message, 'error');
    }
  };

  const deleteCampaign = async (campaign: Campaign) => {
    try {
      const { data: { session } } = await (await import('@/lib/supabase')).supabase.auth.getSession();
      const res = await fetch('/api/facebook/ads', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ campaignId: campaign.id }),
      });
      const data = await res.json();
      if (data.success) {
        t('Campanha excluída!', 'success');
        fetchCampaigns();
      } else throw new Error(data.error);
    } catch (err: any) {
      t('Erro: ' + err.message, 'error');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">📢 Anúncios Facebook</h2>
        <button onClick={fetchCampaigns} disabled={loading}
          className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs text-gray-300 hover:bg-white/10 cursor-pointer disabled:opacity-50">
          {loading ? 'Atualizando...' : '↻ Atualizar'}
        </button>
      </div>

      {!configured && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 text-sm">
          <p className="text-amber-400 font-semibold mb-2">⚙️ Configuração necessária</p>
          <div className="text-gray-300 space-y-1 text-xs">
            <p>1. Vá em <a href="https://developers.facebook.com" target="_blank" className="text-blue-400 hover:underline">developers.facebook.com</a> e crie um App</p>
            <p>2. Adicione o produto <strong>Marketing API</strong></p>
            <p>3. Crie um <strong>Token de Acesso</strong> (long-lived) com permissões de ads_management</p>
            <p>4. Adicione no Railway as variáveis:</p>
            <pre className="bg-black/50 p-2 rounded-lg text-green-400 mt-1">
              FACEBOOK_ACCESS_TOKEN=seu_token_aki<br />
              FACEBOOK_AD_ACCOUNT=835417109643595
            </pre>
          </div>
        </div>
      )}

      {error && !configured && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-xs text-red-400">{error}</div>
      )}

      {loading && configured && (
        <div className="text-center py-8 text-gray-500 text-sm">Carregando campanhas...</div>
      )}

      {!loading && configured && campaigns.length === 0 && !error && (
        <div className="text-center py-8 text-gray-500 text-sm">Nenhuma campanha encontrada.</div>
      )}

      {campaigns.map((c) => (
        <div key={c.id} className="rounded-xl border border-white/5 bg-black/30 p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${c.status === 'ACTIVE' ? 'bg-green-400 animate-pulse' : 'bg-gray-500'}`} />
              <span className="font-semibold text-sm">{c.name}</span>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => toggleCampaign(c)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer border ${
                  c.status === 'ACTIVE' ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' : 'bg-green-500/10 border-green-500/20 text-green-400'
                }`}>
                {c.status === 'ACTIVE' ? '⏸ Pausar' : '▶ Ativar'}
              </button>
              <button onClick={() => deleteCampaign(c)}
                className="px-2.5 py-1 rounded-lg text-xs bg-red-500/10 border border-red-500/20 text-red-400 cursor-pointer">🗑</button>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs text-gray-400">
            <div><span className="text-gray-500">Status:</span> {c.status === 'ACTIVE' ? 'Ativo' : c.status === 'PAUSED' ? 'Pausado' : c.status}</div>
            <div><span className="text-gray-500">Gasto:</span> R$ {parseFloat(c.spend || '0').toFixed(2)}</div>
            <div><span className="text-gray-500">Impressões:</span> {parseInt(c.impressions || '0').toLocaleString()}</div>
            <div><span className="text-gray-500">Alcance:</span> {parseInt(c.reach || '0').toLocaleString()}</div>
            <div><span className="text-gray-500">Orçamento:</span> R$ {parseFloat(c.daily_budget || '0') / 100}/dia</div>
            <div><span className="text-gray-500">Objetivo:</span> {c.objective || '-'}</div>
            <div><span className="text-gray-500">Criada:</span> {new Date(c.created_time).toLocaleDateString('pt-BR')}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
