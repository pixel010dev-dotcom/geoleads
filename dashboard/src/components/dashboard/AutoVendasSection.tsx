'use client';

import { useState, useEffect, useCallback, type FormEvent } from 'react';
import { supabase } from '@/lib/supabase';
import { showToast } from '@/components/Toast';

type CampaignStatus = 'draft' | 'pending_payment' | 'paid' | 'running' | 'paused' | 'completed' | 'cancelled';

interface Campaign {
  id: string;
  nicho: string;
  regiao: string;
  mensagem_template: string;
  leads_alvo: number;
  status: CampaignStatus;
  whatsapp_connected: boolean;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  total_extracted: number;
  total_messaged: number;
  total_responses: number;
  payment_status: string;
  payment_id?: string;
  payment_pix_code?: string;
  payment_pix_qr?: string;
}

const defaultMessage = 'Ola {Nome}, tudo bem? Vi que voce atua em {Cidade} no segmento de {Nicho}. Tenho uma proposta que pode te interessar. Vamos conversar?';

const formatMoney = (value: number) => value.toLocaleString('pt-BR', {
  style: 'currency',
  currency: 'BRL'
});

const getCampaignPrice = (leadsAlvo?: number | null) => (leadsAlvo || 50) * 0.5;

export default function AutoVendasSection() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const [nicho, setNicho] = useState('');
  const [regiao, setRegiao] = useState('');
  const [mensagem, setMensagem] = useState(defaultMessage);
  const [leadsAlvo, setLeadsAlvo] = useState(50);
  const [creating, setCreating] = useState(false);

  const [expandedCampaign, setExpandedCampaign] = useState<string | null>(null);
  const [campaignLeads, setCampaignLeads] = useState<any[]>([]);
  const [leadsLoading, setLeadsLoading] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState<Record<string, boolean>>({});
  const [paymentChecking, setPaymentChecking] = useState<Record<string, boolean>>({});

  const getHeaders = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) return null;
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  }, []);

  const updateCampaign = useCallback((campaign: Campaign) => {
    setCampaigns(prev => prev.map(item => item.id === campaign.id ? { ...item, ...campaign } : item));
  }, []);

  const fetchCampaigns = useCallback(async () => {
    setLoading(true);
    try {
      const headers = await getHeaders();
      if (!headers) return;
      const res = await fetch('/api/autovendas/campaign', { headers, cache: 'no-store' });
      const data = await res.json();
      if (data.success) setCampaigns(data.campaigns || []);
      else showToast(data.error || 'Erro ao carregar campanhas.', 'error');
    } catch {
      showToast('Erro ao carregar campanhas.', 'error');
    } finally {
      setLoading(false);
    }
  }, [getHeaders]);

  useEffect(() => { fetchCampaigns(); }, [fetchCampaigns]);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!nicho.trim() || !regiao.trim() || !mensagem.trim()) {
      showToast('Preencha nicho, regiao e mensagem.', 'warning');
      return;
    }

    setCreating(true);
    try {
      const headers = await getHeaders();
      if (!headers) return;
      const res = await fetch('/api/autovendas/campaign', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          nicho,
          regiao,
          mensagem_template: mensagem,
          leads_alvo: leadsAlvo
        })
      });
      const data = await res.json();
      if (data.success) {
        showToast('Campanha criada.', 'success');
        setShowForm(false);
        setNicho('');
        setRegiao('');
        setMensagem(defaultMessage);
        setLeadsAlvo(50);
        fetchCampaigns();
      } else {
        showToast(data.error || 'Erro ao criar campanha.', 'error');
      }
    } catch {
      showToast('Erro ao criar campanha.', 'error');
    } finally {
      setCreating(false);
    }
  };

  const handleAction = async (campaignId: string, action: 'start' | 'pause' | 'cancel' | 'delete') => {
    try {
      const headers = await getHeaders();
      if (!headers) return;
      const method = action === 'delete' ? 'DELETE' : 'PATCH';
      const res = await fetch(`/api/autovendas/campaign/${campaignId}`, {
        method,
        headers,
        body: action === 'delete' ? undefined : JSON.stringify({ action })
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Campanha ${action === 'start' ? 'iniciada' : action === 'pause' ? 'pausada' : action === 'cancel' ? 'cancelada' : 'removida'}.`, 'success');
        fetchCampaigns();
      } else {
        showToast(data.error || 'Erro na acao.', 'error');
      }
    } catch {
      showToast('Erro na acao.', 'error');
    }
  };

  const handleGeneratePayment = async (campaignId: string) => {
    setPaymentLoading(prev => ({ ...prev, [campaignId]: true }));
    try {
      const headers = await getHeaders();
      if (!headers) return;
      const res = await fetch('/api/autovendas/payment', {
        method: 'POST',
        headers,
        body: JSON.stringify({ campaignId })
      });
      const data = await res.json();
      if (data.success && data.pix) {
        if (data.campaign) {
          updateCampaign(data.campaign);
        } else {
          setCampaigns(prev => prev.map(c => c.id === campaignId ? {
            ...c,
            status: 'pending_payment',
            payment_status: 'pending',
            payment_id: String(data.pix.paymentId || c.payment_id || ''),
            payment_pix_code: data.pix.code,
            payment_pix_qr: data.pix.qr
          } : c));
        }
        showToast(data.reused ? 'PIX ja estava gerado.' : 'PIX gerado.', 'success');
      } else {
        showToast(data.error || 'Erro ao gerar PIX.', 'error');
      }
    } catch {
      showToast('Erro ao gerar pagamento.', 'error');
    } finally {
      setPaymentLoading(prev => ({ ...prev, [campaignId]: false }));
    }
  };

  const handleCheckPayment = async (campaignId: string) => {
    setPaymentChecking(prev => ({ ...prev, [campaignId]: true }));
    try {
      const headers = await getHeaders();
      if (!headers) return;
      const res = await fetch(`/api/autovendas/payment?campaignId=${encodeURIComponent(campaignId)}`, {
        headers,
        cache: 'no-store'
      });
      const data = await res.json();
      if (data.success) {
        if (data.campaign) updateCampaign(data.campaign);
        showToast(data.approved ? 'Pagamento aprovado.' : 'Pagamento ainda pendente.', data.approved ? 'success' : 'warning');
      } else {
        showToast(data.error || 'Erro ao consultar pagamento.', 'error');
      }
    } catch {
      showToast('Erro ao consultar pagamento.', 'error');
    } finally {
      setPaymentChecking(prev => ({ ...prev, [campaignId]: false }));
    }
  };

  const handleCopyPix = async (code?: string) => {
    if (!code) {
      showToast('Codigo PIX indisponivel.', 'warning');
      return;
    }

    try {
      await navigator.clipboard.writeText(code);
      showToast('Codigo PIX copiado.', 'success');
    } catch {
      showToast('Nao foi possivel copiar automaticamente.', 'error');
    }
  };

  const toggleExpanded = async (campaignId: string) => {
    if (expandedCampaign === campaignId) {
      setExpandedCampaign(null);
      setCampaignLeads([]);
      return;
    }
    setExpandedCampaign(campaignId);
    setLeadsLoading(true);
    try {
      const headers = await getHeaders();
      if (!headers) return;
      const res = await fetch(`/api/autovendas/campaign/${campaignId}/leads`, { headers, cache: 'no-store' });
      const data = await res.json();
      if (data.success) setCampaignLeads(data.leads || []);
    } catch {
      showToast('Erro ao carregar leads.', 'error');
    } finally {
      setLeadsLoading(false);
    }
  };

  const statusLabel: Record<CampaignStatus, string> = {
    draft: 'Rascunho',
    pending_payment: 'Aguardando PIX',
    paid: 'Pago',
    running: 'Rodando',
    paused: 'Pausada',
    completed: 'Concluida',
    cancelled: 'Cancelada'
  };

  const statusColor: Record<CampaignStatus, string> = {
    draft: 'text-gray-400',
    pending_payment: 'text-amber-400',
    paid: 'text-green-400',
    running: 'text-blue-400',
    paused: 'text-yellow-400',
    completed: 'text-emerald-400',
    cancelled: 'text-red-400'
  };

  const totalExtracted = campaigns.reduce((sum, campaign) => sum + (campaign.total_extracted || 0), 0);
  const totalMessaged = campaigns.reduce((sum, campaign) => sum + (campaign.total_messaged || 0), 0);
  const totalResponses = campaigns.reduce((sum, campaign) => sum + (campaign.total_responses || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 mb-2">
        <h2 className="text-lg font-bold">AutoVendas</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold cursor-pointer transition-colors"
        >
          {showForm ? 'Fechar' : '+ Nova Campanha'}
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <div className="app-card p-4 rounded-xl bg-gradient-to-br from-blue-500/10 to-transparent border border-white/5">
          <p className="text-2xl font-bold text-blue-400">{campaigns.length}</p>
          <p className="text-[11px] text-gray-400">Campanhas</p>
        </div>
        <div className="app-card p-4 rounded-xl bg-gradient-to-br from-green-500/10 to-transparent border border-white/5">
          <p className="text-2xl font-bold text-green-400">{totalExtracted}</p>
          <p className="text-[11px] text-gray-400">Leads extraidos</p>
        </div>
        <div className="app-card p-4 rounded-xl bg-gradient-to-br from-cyan-500/10 to-transparent border border-white/5">
          <p className="text-2xl font-bold text-cyan-400">{totalMessaged}</p>
          <p className="text-[11px] text-gray-400">Mensagens</p>
        </div>
        <div className="app-card p-4 rounded-xl bg-gradient-to-br from-amber-500/10 to-transparent border border-white/5">
          <p className="text-2xl font-bold text-amber-400">{totalResponses}</p>
          <p className="text-[11px] text-gray-400">Respostas</p>
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="app-card p-5 rounded-2xl border border-white/10 space-y-4 mb-4">
          <h3 className="text-sm font-bold text-white">Criar campanha</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-400 block mb-1">Nicho / segmento</label>
              <input value={nicho} onChange={e => setNicho(e.target.value)} placeholder="ex: Clinicas de estetica" className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Regiao</label>
              <input value={regiao} onChange={e => setRegiao(e.target.value)} placeholder="ex: Sao Paulo, SP" className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500" />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">Mensagem template</label>
            <textarea value={mensagem} onChange={e => setMensagem(e.target.value)} rows={3} className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 resize-none" />
            <p className="text-[10px] text-gray-500 mt-1">Variaveis: {'{Nome}'}, {'{Cidade}'}, {'{Nicho}'}</p>
          </div>
          <div className="flex flex-wrap items-end gap-4">
            <div className="w-32">
              <label className="text-xs text-gray-400 block mb-1">Leads alvo</label>
              <input type="number" value={leadsAlvo} onChange={e => setLeadsAlvo(Number(e.target.value))} min={10} max={200} className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500" />
            </div>
            <p className="text-xs text-gray-500 pb-2">{formatMoney(getCampaignPrice(leadsAlvo))} - R$0,50 por lead</p>
          </div>
          <button type="submit" disabled={creating} className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white text-sm font-bold cursor-pointer disabled:opacity-50 transition-all">
            {creating ? 'Criando...' : `Criar campanha - ${formatMoney(getCampaignPrice(leadsAlvo))}`}
          </button>
        </form>
      )}

      {loading ? (
        <div className="text-center py-8 text-gray-500 text-sm">Carregando campanhas...</div>
      ) : campaigns.length === 0 ? (
        <div className="app-card p-8 rounded-2xl border border-white/5 text-center">
          <p className="text-gray-400 text-sm mb-2">Nenhuma campanha ainda.</p>
          <p className="text-gray-500 text-xs">Crie sua primeira campanha para comecar.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {campaigns.map(campaign => {
            const hasPix = Boolean(campaign.payment_pix_code);
            const canGeneratePix = campaign.status === 'draft' && campaign.payment_status !== 'paid';
            const showPixPanel = hasPix && campaign.payment_status === 'pending';
            const isPaymentLoading = Boolean(paymentLoading[campaign.id]);
            const isPaymentChecking = Boolean(paymentChecking[campaign.id]);

            return (
              <div key={campaign.id} className="app-card rounded-2xl border border-white/5 overflow-hidden">
                <div className="p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="text-sm font-bold text-white truncate">{campaign.nicho}</h4>
                      <span className={`text-[10px] font-semibold ${statusColor[campaign.status] || 'text-gray-400'}`}>{statusLabel[campaign.status] || campaign.status}</span>
                    </div>
                    <p className="text-xs text-gray-400">{campaign.regiao} - {campaign.leads_alvo} leads - {formatMoney(getCampaignPrice(campaign.leads_alvo))}</p>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-[10px] text-gray-500">
                      <span>{campaign.total_extracted || 0} extraidos</span>
                      <span>{campaign.total_messaged || 0} enviados</span>
                      <span>{campaign.total_responses || 0} respostas</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {canGeneratePix && !hasPix && (
                      <button onClick={() => handleGeneratePayment(campaign.id)} disabled={isPaymentLoading} className="px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-500 text-white text-[10px] font-bold cursor-pointer disabled:opacity-50">
                        {isPaymentLoading ? 'Gerando...' : 'Gerar PIX'}
                      </button>
                    )}
                    {showPixPanel && (
                      <button onClick={() => handleCheckPayment(campaign.id)} disabled={isPaymentChecking} className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-[10px] font-bold cursor-pointer disabled:opacity-50">
                        {isPaymentChecking ? 'Consultando...' : 'Atualizar pagamento'}
                      </button>
                    )}
                    {campaign.status === 'paid' && (
                      <button onClick={() => handleAction(campaign.id, 'start')} className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold cursor-pointer">
                        Iniciar
                      </button>
                    )}
                    {campaign.status === 'running' && (
                      <button onClick={() => handleAction(campaign.id, 'pause')} className="px-3 py-1.5 rounded-lg bg-yellow-600 hover:bg-yellow-500 text-white text-[10px] font-bold cursor-pointer">
                        Pausar
                      </button>
                    )}
                    {(campaign.status === 'draft' || campaign.status === 'pending_payment') && (
                      <button onClick={() => handleAction(campaign.id, campaign.status === 'draft' ? 'delete' : 'cancel')} className="px-3 py-1.5 rounded-lg bg-red-600/30 hover:bg-red-600/50 text-red-400 text-[10px] font-bold cursor-pointer">
                        {campaign.status === 'draft' ? 'Excluir' : 'Cancelar'}
                      </button>
                    )}
                    {(campaign.status === 'paused' || campaign.status === 'completed') && (
                      <button onClick={() => handleAction(campaign.id, 'cancel')} className="px-3 py-1.5 rounded-lg bg-red-600/30 hover:bg-red-600/50 text-red-400 text-[10px] font-bold cursor-pointer">
                        Cancelar
                      </button>
                    )}
                    {campaign.status === 'cancelled' && (
                      <button onClick={() => handleAction(campaign.id, 'delete')} className="px-3 py-1.5 rounded-lg bg-red-600/30 hover:bg-red-600/50 text-red-400 text-[10px] font-bold cursor-pointer">
                        Excluir
                      </button>
                    )}
                    <button onClick={() => toggleExpanded(campaign.id)} className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 text-[10px] cursor-pointer">
                      {expandedCampaign === campaign.id ? 'Ocultar' : 'Ver'} leads
                    </button>
                  </div>
                </div>

                {showPixPanel && (
                  <div className="border-t border-white/5 p-4 bg-amber-500/5">
                    <div className="grid grid-cols-1 lg:grid-cols-[1fr_160px] gap-4 items-start">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <p className="text-sm font-bold text-white">PIX copia e cola</p>
                          <span className="text-[10px] text-amber-300 border border-amber-500/30 rounded-full px-2 py-0.5">
                            {formatMoney(getCampaignPrice(campaign.leads_alvo))}
                          </span>
                        </div>
                        <textarea readOnly value={campaign.payment_pix_code || ''} className="w-full min-h-24 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white font-mono resize-none focus:outline-none" />
                        <div className="flex flex-wrap gap-2 mt-3">
                          <button onClick={() => handleCopyPix(campaign.payment_pix_code)} className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white text-[10px] font-bold cursor-pointer">
                            Copiar codigo
                          </button>
                          <button onClick={() => handleCheckPayment(campaign.id)} disabled={isPaymentChecking} className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold cursor-pointer disabled:opacity-50">
                            {isPaymentChecking ? 'Consultando...' : 'Ja paguei'}
                          </button>
                        </div>
                      </div>
                      {campaign.payment_pix_qr && (
                        <div className="bg-white rounded-xl p-3 w-40 h-40 mx-auto lg:mx-0">
                          <img src={campaign.payment_pix_qr} alt="QR Code PIX" className="w-full h-full object-contain" />
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {expandedCampaign === campaign.id && (
                  <div className="border-t border-white/5 p-4 bg-black/20">
                    {leadsLoading ? (
                      <p className="text-xs text-gray-500 text-center py-2">Carregando leads...</p>
                    ) : campaignLeads.length === 0 ? (
                      <p className="text-xs text-gray-500 text-center py-2">Nenhum lead capturado ainda.</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-gray-500 border-b border-white/5">
                              <th className="text-left py-1 pr-2">Nome</th>
                              <th className="text-left py-1 pr-2">Telefone</th>
                              <th className="text-left py-1 pr-2">Status</th>
                              <th className="text-left py-1">Enviado em</th>
                            </tr>
                          </thead>
                          <tbody>
                            {campaignLeads.map((lead: any) => (
                              <tr key={lead.id} className="border-b border-white/5 text-gray-300">
                                <td className="py-1.5 pr-2">{lead.nome || '-'}</td>
                                <td className="py-1.5 pr-2">{lead.telefone || '-'}</td>
                                <td className="py-1.5 pr-2">
                                  <span className={`${lead.status === 'responded' ? 'text-green-400' : lead.status === 'sent' ? 'text-blue-400' : 'text-gray-400'}`}>
                                    {lead.status === 'pending' ? 'Pendente' : lead.status === 'sent' ? 'Enviado' : lead.status === 'responded' ? 'Respondeu' : 'Sem interesse'}
                                  </span>
                                </td>
                                <td className="py-1.5">{lead.sent_at ? new Date(lead.sent_at).toLocaleString('pt-BR') : '-'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
