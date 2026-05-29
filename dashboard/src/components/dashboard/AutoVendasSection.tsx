'use client';

import { useState, useEffect, useCallback } from 'react';
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

export default function AutoVendasSection() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const [nicho, setNicho] = useState('');
  const [regiao, setRegiao] = useState('');
  const [mensagem, setMensagem] = useState('Olá {Nome}, tudo bem? Vi que você atua em {Cidade} no segmento de {Nicho}. Tenho uma proposta que pode te interessar. Vamos conversar?');
  const [leadsAlvo, setLeadsAlvo] = useState(50);
  const [creating, setCreating] = useState(false);

  const [expandedCampaign, setExpandedCampaign] = useState<string | null>(null);
  const [campaignLeads, setCampaignLeads] = useState<any[]>([]);
  const [leadsLoading, setLeadsLoading] = useState(false);

  const getHeaders = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) return null;
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  }, []);

  const fetchCampaigns = useCallback(async () => {
    setLoading(true);
    try {
      const headers = await getHeaders();
      if (!headers) return;
      const res = await fetch('/api/autovendas/campaign', { headers });
      const data = await res.json();
      if (data.success) setCampaigns(data.campaigns || []);
    } catch { showToast('Erro ao carregar campanhas.', 'error'); }
    finally { setLoading(false); }
  }, [getHeaders]);

  useEffect(() => { fetchCampaigns(); }, [fetchCampaigns]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nicho || !regiao || !mensagem) { showToast('Preencha nicho, região e mensagem.', 'warning'); return; }
    setCreating(true);
    try {
      const headers = await getHeaders();
      if (!headers) return;
      const res = await fetch('/api/autovendas/campaign', {
        method: 'POST', headers,
        body: JSON.stringify({ nicho, regiao, mensagem_template: mensagem, leads_alvo: leadsAlvo })
      });
      const data = await res.json();
      if (data.success) {
        showToast('Campanha criada!', 'success');
        setShowForm(false);
        setNicho(''); setRegiao('');
        setMensagem('Olá {Nome}, tudo bem? Vi que você atua em {Cidade} no segmento de {Nicho}. Tenho uma proposta que pode te interessar. Vamos conversar?');
        setLeadsAlvo(50);
        fetchCampaigns();
      } else showToast(data.error || 'Erro ao criar.', 'error');
    } catch { showToast('Erro ao criar campanha.', 'error'); }
    finally { setCreating(false); }
  };

  const handleAction = async (campaignId: string, action: 'start' | 'pause' | 'cancel' | 'delete') => {
    try {
      const headers = await getHeaders();
      if (!headers) return;
      const method = action === 'delete' ? 'DELETE' : 'PATCH';
      const res = await fetch(`/api/autovendas/campaign/${campaignId}`, {
        method, headers,
        body: JSON.stringify({ action })
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Campanha ${action === 'start' ? 'iniciada' : action === 'pause' ? 'pausada' : action === 'cancel' ? 'cancelada' : 'removida'}!`, 'success');
        fetchCampaigns();
      } else showToast(data.error || 'Erro.', 'error');
    } catch { showToast('Erro na ação.', 'error'); }
  };

  const handleGeneratePayment = async (campaignId: string) => {
    try {
      const headers = await getHeaders();
      if (!headers) return;
      const res = await fetch('/api/autovendas/payment', {
        method: 'POST', headers,
        body: JSON.stringify({ campaignId })
      });
      const data = await res.json();
      if (data.success && data.pix) {
        setCampaigns(prev => prev.map(c => c.id === campaignId ? {
          ...c,
          status: 'pending_payment',
          payment_status: 'pending',
          payment_pix_code: data.pix.code,
          payment_pix_qr: data.pix.qr
        } : c));
        showToast('PIX gerado! Copie o código ou escaneie o QR.', 'success');
      } else showToast(data.error || 'Erro ao gerar PIX.', 'error');
    } catch { showToast('Erro ao gerar pagamento.', 'error'); }
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
      const res = await fetch(`/api/autovendas/campaign/${campaignId}/leads`, { headers });
      const data = await res.json();
      if (data.success) setCampaignLeads(data.leads || []);
    } catch {} finally { setLeadsLoading(false); }
  };

  const statusLabel: Record<CampaignStatus, string> = {
    draft: 'Rascunho',
    pending_payment: 'Aguardando PIX',
    paid: 'Pago',
    running: 'Rodando',
    paused: 'Pausada',
    completed: 'Concluída',
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

  const totalExtracted = campaigns.reduce((s, c) => s + c.total_extracted, 0);
  const totalMessaged = campaigns.reduce((s, c) => s + c.total_messaged, 0);
  const totalResponses = campaigns.reduce((s, c) => s + c.total_responses, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-lg font-bold">🤖 AutoVendas — Campanhas Automáticas</h2>
        <button onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold cursor-pointer transition-colors">
          {showForm ? '✕ Fechar' : '+ Nova Campanha'}
        </button>
      </div>

      <div className="grid grid-cols-4 gap-3 mb-4">
        <div className="app-card p-4 rounded-xl bg-gradient-to-br from-blue-500/10 to-transparent border border-white/5">
          <p className="text-2xl font-bold text-blue-400">{campaigns.length}</p>
          <p className="text-[11px] text-gray-400">Campanhas</p>
        </div>
        <div className="app-card p-4 rounded-xl bg-gradient-to-br from-green-500/10 to-transparent border border-white/5">
          <p className="text-2xl font-bold text-green-400">{totalExtracted}</p>
          <p className="text-[11px] text-gray-400">Leads Extraídos</p>
        </div>
        <div className="app-card p-4 rounded-xl bg-gradient-to-br from-cyan-500/10 to-transparent border border-white/5">
          <p className="text-2xl font-bold text-cyan-400">{totalMessaged}</p>
          <p className="text-[11px] text-gray-400">Mensagens Enviadas</p>
        </div>
        <div className="app-card p-4 rounded-xl bg-gradient-to-br from-amber-500/10 to-transparent border border-white/5">
          <p className="text-2xl font-bold text-amber-400">{totalResponses}</p>
          <p className="text-[11px] text-gray-400">Respostas</p>
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="app-card p-5 rounded-2xl border border-white/10 space-y-4 mb-4">
          <h3 className="text-sm font-bold text-white">Criar Campanha AutoVendas</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-400 block mb-1">Nicho / Segmento</label>
              <input value={nicho} onChange={e => setNicho(e.target.value)} placeholder="ex: Clínicas de estética" className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Região</label>
              <input value={regiao} onChange={e => setRegiao(e.target.value)} placeholder="ex: São Paulo, SP" className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500" />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">Mensagem Template</label>
            <textarea value={mensagem} onChange={e => setMensagem(e.target.value)} rows={3} className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 resize-none" />
            <p className="text-[10px] text-gray-500 mt-1">Use {'{Nome}'}, {'{Cidade}'}, {'{Nicho}'} como variáveis</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="w-32">
              <label className="text-xs text-gray-400 block mb-1">Leads Alvo</label>
              <input type="number" value={leadsAlvo} onChange={e => setLeadsAlvo(Number(e.target.value))} min={10} max={200} className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500" />
            </div>
            <p className="text-xs text-gray-500 self-end pb-2">R$ {(leadsAlvo * 0.5).toFixed(2)} · R$0,50 por lead</p>
          </div>
          <button type="submit" disabled={creating} className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white text-sm font-bold cursor-pointer disabled:opacity-50 transition-all">
            {creating ? 'Criando...' : `Criar Campanha — R$ ${(leadsAlvo * 0.5).toFixed(2)}`}
          </button>
        </form>
      )}

      {loading ? (
        <div className="text-center py-8 text-gray-500 text-sm">Carregando campanhas...</div>
      ) : campaigns.length === 0 ? (
        <div className="app-card p-8 rounded-2xl border border-white/5 text-center">
          <p className="text-gray-400 text-sm mb-2">Nenhuma campanha ainda.</p>
          <p className="text-gray-500 text-xs">Crie sua primeira campanha para começar a gerar leads automaticamente.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {campaigns.map(campaign => (
            <div key={campaign.id} className="app-card rounded-2xl border border-white/5 overflow-hidden">
              <div className="p-4 flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="text-sm font-bold text-white">{campaign.nicho}</h4>
                    <span className={`text-[10px] font-semibold ${statusColor[campaign.status]}`}>{statusLabel[campaign.status]}</span>
                  </div>
                  <p className="text-xs text-gray-400">{campaign.regiao} · {campaign.leads_alvo} leads alvo</p>
                  <div className="flex gap-4 mt-1 text-[10px] text-gray-500">
                    <span>📥 {campaign.total_extracted} extraídos</span>
                    <span>📤 {campaign.total_messaged} enviados</span>
                    <span>💬 {campaign.total_responses} respostas</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {(campaign.status === 'draft' || campaign.status === 'pending_payment') && (
                    <>
                      {campaign.status === 'draft' && !campaign.payment_pix_code ? (
                        <button onClick={() => handleGeneratePayment(campaign.id)} className="px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-500 text-white text-[10px] font-bold cursor-pointer">
                          Gerar PIX
                        </button>
                      ) : (
                        <div className="relative group">
                          <button className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-[10px] font-bold cursor-pointer">
                            Pix Gerado
                          </button>
                          <div className="absolute right-0 top-full mt-2 bg-black/90 border border-white/10 rounded-xl p-3 w-64 z-50 hidden group-hover:block">
                            <p className="text-[10px] text-gray-400 mb-1">Código PIX:</p>
                            <p className="text-xs text-white font-mono break-all mb-2">{campaign.payment_pix_code}</p>
                            {campaign.payment_pix_qr && <img src={campaign.payment_pix_qr} alt="QR PIX" className="w-32 h-32 mx-auto" />}
                            <p className="text-[9px] text-amber-300 mt-1">Após pagamento, clique em Iniciar</p>
                          </div>
                        </div>
                      )}
                      {campaign.status === 'draft' && (
                        <button onClick={() => handleAction(campaign.id, 'delete')} className="px-3 py-1.5 rounded-lg bg-red-600/30 hover:bg-red-600/50 text-red-400 text-[10px] font-bold cursor-pointer">
                          Excluir
                        </button>
                      )}
                    </>
                  )}
                  {campaign.status === 'paid' && (
                    <button onClick={() => handleAction(campaign.id, 'start')} className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold cursor-pointer">
                      ▶ Iniciar
                    </button>
                  )}
                  {campaign.status === 'running' && (
                    <button onClick={() => handleAction(campaign.id, 'pause')} className="px-3 py-1.5 rounded-lg bg-yellow-600 hover:bg-yellow-500 text-white text-[10px] font-bold cursor-pointer">
                      ⏸ Pausar
                    </button>
                  )}
                  {(campaign.status === 'paused' || campaign.status === 'completed') && (
                    <button onClick={() => handleAction(campaign.id, 'cancel')} className="px-3 py-1.5 rounded-lg bg-red-600/30 hover:bg-red-600/50 text-red-400 text-[10px] font-bold cursor-pointer">
                      Cancelar
                    </button>
                  )}
                  <button onClick={() => toggleExpanded(campaign.id)} className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 text-[10px] cursor-pointer">
                    {expandedCampaign === campaign.id ? '▲' : '▼'} Leads
                  </button>
                </div>
              </div>

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
                              <td className="py-1.5 pr-2">{lead.nome || '—'}</td>
                              <td className="py-1.5 pr-2">{lead.telefone || '—'}</td>
                              <td className="py-1.5 pr-2">
                                <span className={`${lead.status === 'responded' ? 'text-green-400' : lead.status === 'sent' ? 'text-blue-400' : 'text-gray-400'}`}>
                                  {lead.status === 'pending' ? 'Pendente' : lead.status === 'sent' ? 'Enviado' : lead.status === 'responded' ? 'Respondeu' : 'Sem interesse'}
                                </span>
                              </td>
                              <td className="py-1.5">{lead.sent_at ? new Date(lead.sent_at).toLocaleString('pt-BR') : '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="app-card p-5 rounded-2xl border border-white/5 bg-gradient-to-br from-blue-500/5 to-transparent">
        <h4 className="text-sm font-bold text-white mb-2">Como funciona o AutoVendas</h4>
        <ol className="text-xs text-gray-400 space-y-1.5 list-decimal list-inside">
          <li>Crie uma campanha escolhendo nicho, região e mensagem</li>
          <li>Gere o PIX e pague (R$0,50 por lead — mínimo R$5 para 10 leads)</li>
          <li>Conecte seu WhatsApp na aba <strong className="text-blue-400">Disparo</strong> ou <strong className="text-amber-400">Auto-Resposta</strong></li>
          <li>Inicie a campanha — o sistema extrai leads do Maps e dispara automaticamente</li>
          <li>Acompanhe respostas em tempo real aqui mesmo</li>
        </ol>
      </div>
    </div>
  );
}
