'use client';

import { useState, useEffect, useCallback, type FormEvent } from 'react';
import { supabase } from '@/lib/supabase';
import { showToast } from '@/components/Toast';
import { useTranslations } from '@/lib/i18n';

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
  const { t, locale } = useTranslations();
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
      else showToast(t('autovendas.errorLoading'), 'error');
    } catch {
      showToast(t('autovendas.errorLoading'), 'error');
    } finally {
      setLoading(false);
    }
  }, [getHeaders, t]);

  useEffect(() => { fetchCampaigns(); }, [fetchCampaigns]);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!nicho.trim() || !regiao.trim() || !mensagem.trim()) {
      showToast(t('autovendas.fillFields'), 'warning');
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
        showToast(t('autovendas.campaignCreated'), 'success');
        setShowForm(false);
        setNicho('');
        setRegiao('');
        setMensagem(defaultMessage);
        setLeadsAlvo(50);
        fetchCampaigns();
      } else {
        showToast(data.error || t('autovendas.errorCreating'), 'error');
      }
    } catch {
      showToast(t('autovendas.errorCreating'), 'error');
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
        const msgMap: Record<string, string> = {
          start: t('autovendas.campaignStarted'),
          pause: t('autovendas.campaignPaused'),
          cancel: t('autovendas.campaignCancelled'),
          delete: t('autovendas.campaignDeleted'),
        };
        showToast(msgMap[action] || '', 'success');
        fetchCampaigns();
      } else {
        showToast(data.error || t('autovendas.actionError'), 'error');
      }
    } catch {
      showToast(t('autovendas.actionError'), 'error');
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
        showToast(data.reused ? t('autovendas.pixAlreadyGenerated') : t('autovendas.pixGenerated'), 'success');
      } else {
        showToast(data.error || t('autovendas.errorGeneratingPix'), 'error');
      }
    } catch {
      showToast(t('autovendas.errorGeneratingPayment'), 'error');
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
        showToast(data.approved ? t('autovendas.paymentApproved') : t('autovendas.paymentPending'), data.approved ? 'success' : 'warning');
      } else {
        showToast(data.error || t('autovendas.errorCheckingPayment'), 'error');
      }
    } catch {
      showToast(t('autovendas.errorCheckingPayment'), 'error');
    } finally {
      setPaymentChecking(prev => ({ ...prev, [campaignId]: false }));
    }
  };

  const handleCopyPix = async (code?: string) => {
    if (!code) {
      showToast(t('autovendas.pixCodeUnavailable'), 'warning');
      return;
    }

    try {
      await navigator.clipboard.writeText(code);
      showToast(t('autovendas.pixCodeCopied'), 'success');
    } catch {
      showToast(t('autovendas.pixCopyFailed'), 'error');
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
      showToast(t('autovendas.errorLoadingLeads'), 'error');
    } finally {
      setLeadsLoading(false);
    }
  };

  const statusLabel: Record<CampaignStatus, string> = {
    draft: t('autovendas.statusDraft'),
    pending_payment: t('autovendas.statusAwaitingPix'),
    paid: t('autovendas.statusPaid'),
    running: t('autovendas.statusRunning'),
    paused: t('autovendas.statusPaused'),
    completed: t('autovendas.statusCompleted'),
    cancelled: t('autovendas.statusCancelled')
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
        <h2 className="text-lg font-bold">{t('autovendas.title')}</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold cursor-pointer transition-colors"
        >
          {showForm ? t('autovendas.close') : t('autovendas.newCampaign')}
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <div className="app-card p-4 rounded-xl bg-gradient-to-br from-blue-500/10 to-transparent border border-white/5">
          <p className="text-2xl font-bold text-blue-400">{campaigns.length}</p>
          <p className="text-[11px] text-gray-400">{t('autovendas.campaigns')}</p>
        </div>
        <div className="app-card p-4 rounded-xl bg-gradient-to-br from-green-500/10 to-transparent border border-white/5">
          <p className="text-2xl font-bold text-green-400">{totalExtracted}</p>
          <p className="text-[11px] text-gray-400">{t('autovendas.leadsExtracted')}</p>
        </div>
        <div className="app-card p-4 rounded-xl bg-gradient-to-br from-cyan-500/10 to-transparent border border-white/5">
          <p className="text-2xl font-bold text-cyan-400">{totalMessaged}</p>
          <p className="text-[11px] text-gray-400">{t('autovendas.messages')}</p>
        </div>
        <div className="app-card p-4 rounded-xl bg-gradient-to-br from-amber-500/10 to-transparent border border-white/5">
          <p className="text-2xl font-bold text-amber-400">{totalResponses}</p>
          <p className="text-[11px] text-gray-400">{t('autovendas.replies')}</p>
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="app-card p-5 rounded-2xl border border-white/10 space-y-4 mb-4">
          <h3 className="text-sm font-bold text-white">{t('autovendas.createCampaign')}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-400 block mb-1">{t('autovendas.nicheLabel')}</label>
              <input value={nicho} onChange={e => setNicho(e.target.value)} placeholder={t('autovendas.nichePlaceholder')} className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">{t('autovendas.regionLabel')}</label>
              <input value={regiao} onChange={e => setRegiao(e.target.value)} placeholder={t('autovendas.regionPlaceholder')} className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500" />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">{t('autovendas.messageLabel')}</label>
            <textarea value={mensagem} onChange={e => setMensagem(e.target.value)} rows={3} className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 resize-none" />
            <p className="text-[10px] text-gray-500 mt-1">{t('autovendas.messageHint')}</p>
          </div>
          <div className="flex flex-wrap items-end gap-4">
            <div className="w-32">
              <label className="text-xs text-gray-400 block mb-1">{t('autovendas.leadTarget')}</label>
              <input type="number" value={leadsAlvo} onChange={e => setLeadsAlvo(Number(e.target.value))} min={10} max={200} className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500" />
            </div>
            <p className="text-xs text-gray-500 pb-2">{t('autovendas.pricePerLead', { count: formatMoney(getCampaignPrice(leadsAlvo)), price: '0,50' })}</p>
          </div>
          <button type="submit" disabled={creating} className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white text-sm font-bold cursor-pointer disabled:opacity-50 transition-all">
            {creating ? t('autovendas.creating') : t('autovendas.createButton', { price: formatMoney(getCampaignPrice(leadsAlvo)) })}
          </button>
        </form>
      )}

      {loading ? (
        <div className="text-center py-8 text-gray-500 text-sm">{t('autovendas.loading')}</div>
      ) : campaigns.length === 0 ? (
        <div className="app-card p-8 rounded-2xl border border-white/5 text-center">
          <p className="text-gray-400 text-sm mb-2">{t('autovendas.noCampaigns')}</p>
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
                      <span>{campaign.total_extracted || 0} {t('autovendas.leadsExtracted').toLowerCase()}</span>
                      <span>{campaign.total_messaged || 0} {t('autovendas.messages').toLowerCase()}</span>
                      <span>{campaign.total_responses || 0} {t('autovendas.replies').toLowerCase()}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {canGeneratePix && !hasPix && (
                      <button onClick={() => handleGeneratePayment(campaign.id)} disabled={isPaymentLoading} className="px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-500 text-white text-[10px] font-bold cursor-pointer disabled:opacity-50">
                        {isPaymentLoading ? t('autovendas.generating') : t('autovendas.generatePix')}
                      </button>
                    )}
                    {showPixPanel && (
                      <button onClick={() => handleCheckPayment(campaign.id)} disabled={isPaymentChecking} className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-[10px] font-bold cursor-pointer disabled:opacity-50">
                        {isPaymentChecking ? t('autovendas.checking') : t('autovendas.updatePayment')}
                      </button>
                    )}
                    {campaign.status === 'paid' && (
                      <button onClick={() => handleAction(campaign.id, 'start')} className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold cursor-pointer">
                        {t('autovendas.start')}
                      </button>
                    )}
                    {campaign.status === 'running' && (
                      <button onClick={() => handleAction(campaign.id, 'pause')} className="px-3 py-1.5 rounded-lg bg-yellow-600 hover:bg-yellow-500 text-white text-[10px] font-bold cursor-pointer">
                        {t('autovendas.pause')}
                      </button>
                    )}
                    {(campaign.status === 'draft' || campaign.status === 'pending_payment') && (
                      <button onClick={() => handleAction(campaign.id, campaign.status === 'draft' ? 'delete' : 'cancel')} className="px-3 py-1.5 rounded-lg bg-red-600/30 hover:bg-red-600/50 text-red-400 text-[10px] font-bold cursor-pointer">
                        {campaign.status === 'draft' ? t('autovendas.delete') : t('autovendas.cancel')}
                      </button>
                    )}
                    {(campaign.status === 'paused' || campaign.status === 'completed') && (
                      <button onClick={() => handleAction(campaign.id, 'cancel')} className="px-3 py-1.5 rounded-lg bg-red-600/30 hover:bg-red-600/50 text-red-400 text-[10px] font-bold cursor-pointer">
                        {t('autovendas.cancel')}
                      </button>
                    )}
                    {campaign.status === 'cancelled' && (
                      <button onClick={() => handleAction(campaign.id, 'delete')} className="px-3 py-1.5 rounded-lg bg-red-600/30 hover:bg-red-600/50 text-red-400 text-[10px] font-bold cursor-pointer">
                        {t('autovendas.delete')}
                      </button>
                    )}
                    <button onClick={() => toggleExpanded(campaign.id)} className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 text-[10px] cursor-pointer">
                      {expandedCampaign === campaign.id ? t('autovendas.hide') : t('autovendas.view')} {t('autovendas.leadsExtracted').toLowerCase()}
                    </button>
                  </div>
                </div>

                {showPixPanel && (
                  <div className="border-t border-white/5 p-4 bg-amber-500/5">
                    <div className="grid grid-cols-1 lg:grid-cols-[1fr_160px] gap-4 items-start">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <p className="text-sm font-bold text-white">{t('autovendas.pixCopyPaste')}</p>
                          <span className="text-[10px] text-amber-300 border border-amber-500/30 rounded-full px-2 py-0.5">
                            {formatMoney(getCampaignPrice(campaign.leads_alvo))}
                          </span>
                        </div>
                        <textarea readOnly value={campaign.payment_pix_code || ''} className="w-full min-h-24 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white font-mono resize-none focus:outline-none" />
                        <div className="flex flex-wrap gap-2 mt-3">
                          <button onClick={() => handleCopyPix(campaign.payment_pix_code)} className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white text-[10px] font-bold cursor-pointer">
                            {t('autovendas.copyCode')}
                          </button>
                          <button onClick={() => handleCheckPayment(campaign.id)} disabled={isPaymentChecking} className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold cursor-pointer disabled:opacity-50">
                            {isPaymentChecking ? t('autovendas.checking') : t('autovendas.alreadyPaid')}
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
                      <p className="text-xs text-gray-500 text-center py-2">{t('autovendas.loadingLeads')}</p>
                    ) : campaignLeads.length === 0 ? (
                      <p className="text-xs text-gray-500 text-center py-2">{t('autovendas.noLeadsYet')}</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-gray-500 border-b border-white/5">
                              <th className="text-left py-1 pr-2">{t('autovendas.leadName')}</th>
                              <th className="text-left py-1 pr-2">{t('autovendas.leadPhone')}</th>
                              <th className="text-left py-1 pr-2">{t('enrich.tableStatus')}</th>
                              <th className="text-left py-1">{t('autovendas.sentAt')}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {campaignLeads.map((lead: any) => (
                              <tr key={lead.id} className="border-b border-white/5 text-gray-300">
                                <td className="py-1.5 pr-2">{lead.nome || '-'}</td>
                                <td className="py-1.5 pr-2">{lead.telefone || '-'}</td>
                                <td className="py-1.5 pr-2">
                                  <span className={`${lead.status === 'responded' ? 'text-green-400' : lead.status === 'sent' ? 'text-blue-400' : 'text-gray-400'}`}>
                                    {lead.status === 'pending' ? t('autovendas.leadPending') : lead.status === 'sent' ? t('autovendas.leadSent') : lead.status === 'responded' ? t('autovendas.leadReplied') : t('autovendas.leadNoInterest')}
                                  </span>
                                </td>
                                <td className="py-1.5">{lead.sent_at ? new Date(lead.sent_at).toLocaleString(locale === 'en' ? 'en-US' : 'pt-BR') : '-'}</td>
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
