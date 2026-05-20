"use client";

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Globe from '@/components/Globe';
import HackerRadar from '@/components/HackerRadar';

export default function Home() {
  // Navigation
  const [activeTab, setActiveTab] = useState<'extractor' | 'crm' | 'whatsapp' | 'ia' | 'support'>('extractor');

  // Extractor States
  const [keyword, setKeyword] = useState('');
  const [location, setLocation] = useState('');
  const [limit, setLimit] = useState<number | ''>(10);
  const [isExtracting, setIsExtracting] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [leads, setLeads] = useState<any[]>([]);
  const [extractStats, setExtractStats] = useState<any>(null);
  const [filterRule, setFilterRule] = useState('none');
  
  // Auth & Account
  const [user, setUser] = useState<any>(null);
  const [tokens, setTokens] = useState<number | null>(null);

  // CRM States
  const [crmLeads, setCrmLeads] = useState<any[]>([]);
  const [crmSearch, setCrmSearch] = useState('');
  const [crmFilterStage, setCrmFilterStage] = useState('all');
  const [selectedCrmLeads, setSelectedCrmLeads] = useState<string[]>([]);

  // WhatsApp Sender States
  const [waTemplate, setWaTemplate] = useState('Olá {Nome}! Vi seu perfil comercial em {Cidade} e gostaria de saber se vocês têm interesse em receber mais clientes de {Nicho}. Podemos conversar?');
  const [waSentStatus, setWaSentStatus] = useState<Record<string, boolean>>({});
  const [isSendingBulk, setIsSendingBulk] = useState(false);
  const [bulkDelay, setBulkDelay] = useState(20);
  const [bulkSimulateHuman, setBulkSimulateHuman] = useState(true);
  const [bulkIndex, setBulkIndex] = useState(-1);
  const [bulkTimer, setBulkTimer] = useState(0);
  const [bulkAutoNext, setBulkAutoNext] = useState(true);

  // AI Copywriter States
  const [aiProduct, setAiProduct] = useState('');
  const [aiValue, setAiValue] = useState('');
  const [aiTone, setAiTone] = useState('persuasive');
  const [generatedCopies, setGeneratedCopies] = useState<any[] | null>(null);
  const [isGeneratingCopies, setIsGeneratingCopies] = useState(false);

  // Support Tab States
  const [supportRating, setSupportRating] = useState<number>(0);
  const [supportFeedback, setSupportFeedback] = useState('');
  const [supportSubmitted, setSupportSubmitted] = useState(false);
  const [hoveredStar, setHoveredStar] = useState<number | null>(null);

  // Load User, Tokens and local CRM Data on Mount
  useEffect(() => {
    const loadData = async () => {
      // Load Supabase session
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUser(session.user);
        const { data } = await supabase
          .from('profiles')
          .select('tokens')
          .eq('id', session.user.id)
          .single();
        if (data) setTokens(data.tokens);
      }
      
      // Load CRM from LocalStorage
      const localCrm = localStorage.getItem('geoleads_crm');
      if (localCrm) {
        try {
          setCrmLeads(JSON.parse(localCrm));
        } catch(e) {}
      }
    };
    loadData();
  }, []);

  // Save CRM to LocalStorage whenever it changes
  const saveCrmToLocal = (updatedCrm: any[]) => {
    setCrmLeads(updatedCrm);
    localStorage.setItem('geoleads_crm', JSON.stringify(updatedCrm));
  };

  // Add lead to CRM
  const handleAddToCRM = (lead: any) => {
    const exists = crmLeads.some(l => l.nome === lead.nome);
    if (exists) {
      alert(`O lead "${lead.nome}" já está cadastrado no seu CRM.`);
      return;
    }

    const newCrmLead = {
      ...lead,
      stage: 'Novo',
      notes: '',
      savedAt: new Date().toISOString(),
      nicho: keyword || 'Geral',
      cidade: location || 'Geral'
    };

    const updated = [newCrmLead, ...crmLeads];
    saveCrmToLocal(updated);
    alert(`"${lead.nome}" foi salvo com sucesso no CRM!`);
  };

  // Save all current leads to CRM
  const handleAddAllToCRM = () => {
    if (leads.length === 0) return;
    let addedCount = 0;
    const updated = [...crmLeads];

    leads.forEach(lead => {
      const exists = updated.some(l => l.nome === lead.nome);
      if (!exists) {
        updated.unshift({
          ...lead,
          stage: 'Novo',
          notes: '',
          savedAt: new Date().toISOString(),
          nicho: keyword || 'Geral',
          cidade: location || 'Geral'
        });
        addedCount++;
      }
    });

    if (addedCount > 0) {
      saveCrmToLocal(updated);
      alert(`${addedCount} novos leads foram adicionados ao seu CRM!`);
    } else {
      alert('Todos esses leads já existem no CRM.');
    }
  };

  // Remove lead from CRM
  const handleRemoveFromCRM = (nome: string) => {
    if (confirm(`Tem certeza que deseja excluir o lead "${nome}" do CRM?`)) {
      const updated = crmLeads.filter(l => l.nome !== nome);
      saveCrmToLocal(updated);
      setSelectedCrmLeads(prev => prev.filter(n => n !== nome));
    }
  };

  // Toggle selection for a single lead
  const handleToggleSelectCrmLead = (nome: string) => {
    setSelectedCrmLeads(prev => 
      prev.includes(nome) ? prev.filter(n => n !== nome) : [...prev, nome]
    );
  };

  // Toggle selection for all filtered leads
  const handleToggleSelectAllCrmLeads = (filteredLeads: any[]) => {
    const allFilteredNames = filteredLeads.map(l => l.nome);
    const areAllSelected = allFilteredNames.every(name => selectedCrmLeads.includes(name));
    
    if (areAllSelected) {
      setSelectedCrmLeads(prev => prev.filter(name => !allFilteredNames.includes(name)));
    } else {
      setSelectedCrmLeads(prev => {
        const unique = new Set([...prev, ...allFilteredNames]);
        return Array.from(unique);
      });
    }
  };

  // Bulk remove selected leads from CRM
  const handleRemoveSelectedFromCRM = () => {
    if (selectedCrmLeads.length === 0) return;
    if (confirm(`Tem certeza que deseja excluir os ${selectedCrmLeads.length} leads selecionados do CRM?`)) {
      const updated = crmLeads.filter(l => !selectedCrmLeads.includes(l.nome));
      saveCrmToLocal(updated);
      setSelectedCrmLeads([]);
    }
  };

  // WhatsApp Guided Bulk Sending Effect
  useEffect(() => {
    let intervalId: any;
    if (isSendingBulk && bulkTimer > 0) {
      intervalId = setInterval(() => {
        setBulkTimer(prev => prev - 1);
      }, 1000);
    } else if (isSendingBulk && bulkTimer === 0 && bulkIndex >= 0) {
      const dispatchableLeads = crmLeads.filter(l => l.telefone && l.telefone !== 'Não informado');
      const nextIndex = bulkIndex + 1;
      
      if (nextIndex < dispatchableLeads.length) {
        if (bulkAutoNext) {
          handleTriggerBulkSendLead(nextIndex);
        } else {
          setIsSendingBulk(false);
        }
      } else {
        alert('Disparo em massa concluído! Todos os contatos elegíveis da lista foram abertos.');
        setIsSendingBulk(false);
        setBulkIndex(-1);
      }
    }
    return () => clearInterval(intervalId);
  }, [isSendingBulk, bulkTimer, bulkIndex, bulkAutoNext]);

  const handleStartBulkSending = () => {
    const dispatchableLeads = crmLeads.filter(l => l.telefone && l.telefone !== 'Não informado');
    if (dispatchableLeads.length === 0) {
      alert('Nenhum lead com telefone disponível para disparo no CRM.');
      return;
    }
    setIsSendingBulk(true);
    handleTriggerBulkSendLead(0);
  };

  const handleTriggerBulkSendLead = (index: number) => {
    const dispatchableLeads = crmLeads.filter(l => l.telefone && l.telefone !== 'Não informado');
    if (index < 0 || index >= dispatchableLeads.length) return;
    
    const lead = dispatchableLeads[index];
    setBulkIndex(index);
    
    let delay = Number(bulkDelay);
    if (bulkSimulateHuman) {
      const variance = Math.floor(Math.random() * 9) - 4; // -4 a +4 segundos de variação humana
      delay = Math.max(10, delay + variance);
    }
    setBulkTimer(delay);
    openWhatsApp(lead, waTemplate);
  };

  const handleStopBulkSending = () => {
    setIsSendingBulk(false);
    setBulkIndex(-1);
    setBulkTimer(0);
  };

  // Update CRM Lead field (stage or notes)
  const handleUpdateCRMLead = (nome: string, field: 'stage' | 'notes', value: string) => {
    const updated = crmLeads.map(l => {
      if (l.nome === nome) {
        return { ...l, [field]: value };
      }
      return l;
    });
    saveCrmToLocal(updated);
  };

  // Extraction trigger
  const handleExtract = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      window.location.href = '/login';
      return;
    }
    if (tokens !== null && Number(limit) > tokens) {
      alert(`Saldo insuficiente! Você pediu ${limit} leads mas tem ${tokens} tokens. Reduza a quantidade ou compre mais tokens.`);
      return;
    }

    setIsExtracting(true);
    setHasSearched(false);
    setLeads([]);
    setExtractStats(null);

    try {
      const res = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword, location, limit: Number(limit), filterRule })
      });
      
      const data = await res.json();
      
      if (data.success && data.leads) {
        setLeads(data.leads);
        if (data.stats) {
          setExtractStats(data.stats);
          if (data.stats.correctedKeyword) setKeyword(data.stats.correctedKeyword);
          if (data.stats.correctedLocation) setLocation(data.stats.correctedLocation);
        }
        
        // Desconta tokens (1 por lead retornado)
        const gastos = data.leads.length;
        if (tokens !== null && gastos > 0) {
          const novoSaldo = tokens - gastos;
          setTokens(novoSaldo);
          await supabase.from('profiles').update({ tokens: novoSaldo }).eq('id', user.id);
        }
      } else if (data.error) {
        alert("Erro do Motor: " + data.error);
      }
    } catch(error) {
      console.error(error);
      alert("Erro de conexão com o motor. Verifique se o servidor está rodando.");
    } finally {
      setIsExtracting(false);
      setHasSearched(true);
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    window.location.reload();
  };

  const exportToCSV = () => {
    if (leads.length === 0) return;
    const headers = ['Empresa', 'Telefone', 'E-mail', 'Avaliação', 'Instagram', 'Facebook', 'Site'];
    const csvContent = [
      headers.join(','),
      ...leads.map(l => [
        `"${l.nome}"`,
        `"${l.telefone}"`,
        `"${l.email || ''}"`,
        `"${l.avaliacao}"`,
        `"${l.instagram || ''}"`,
        `"${l.facebook || ''}"`,
        `"${l.site}"`
      ].join(','))
    ].join('\n');
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `GeoLeads_${keyword}_${new Date().toLocaleDateString('pt-BR')}.csv`;
    link.click();
  };

  // WhatsApp Trigger Helper
  const openWhatsApp = (lead: any, customText?: string) => {
    if (!lead.telefone || lead.telefone === 'Não informado') {
      alert('Este lead não possui número de telefone válido.');
      return;
    }
    const number = lead.telefone.replace(/\D/g, ''); 
    if (number.length < 10) {
      alert('Número de telefone inválido para WhatsApp.');
      return;
    }

    let msg = '';
    if (customText) {
      msg = customText
        .replace(/{Nome}/g, lead.nome)
        .replace(/{Telefone}/g, lead.telefone)
        .replace(/{Site}/g, lead.site || 'Sem site')
        .replace(/{Cidade}/g, lead.cidade || location || 'sua região')
        .replace(/{Nicho}/g, lead.nicho || keyword || 'comércio');
    } else {
      msg = `Olá! Vi o perfil da *${lead.nome}* no Google e gostaria de saber mais sobre os serviços de vocês. Podemos conversar?`;
    }

    const messageEncoded = encodeURIComponent(msg);
    window.open(`https://wa.me/55${number}?text=${messageEncoded}`, '_blank');
    
    // Mark as sent
    setWaSentStatus(prev => ({ ...prev, [lead.nome]: true }));
  };

  // AI Message Copywriting Engine (Gemini integration with local fallback)
  const generateAICopies = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiProduct || !aiValue) {
      alert('Preencha os campos para gerar copys.');
      return;
    }

    setIsGeneratingCopies(true);
    setGeneratedCopies(null);

    try {
      const res = await fetch('/api/ai-copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product: aiProduct, value: aiValue, tone: aiTone })
      });
      const data = await res.json();
      if (data.success && data.copies) {
        setGeneratedCopies(data.copies);
      } else {
        alert('Erro ao gerar roteiros: ' + (data.error || 'Erro inesperado.'));
      }
    } catch (err: any) {
      console.error(err);
      alert('Erro de conexão ao gerar roteiros. Verifique seu servidor.');
    } finally {
      setIsGeneratingCopies(false);
    }
  };

  // Filter options config for beautiful Grid Selection
  const filterOptions = [
    { value: 'none', label: 'Trazer tudo', icon: '🔍', desc: 'Recomendado para varredura completa' },
    { value: 'phone', label: 'Só Telefone', icon: '📞', desc: 'Filtra empresas com contato telefônico' },
    { value: 'email', label: 'Só E-mail', icon: '✉️', desc: 'Filtra empresas com e-mail no site' },
    { value: 'insta', label: 'Só Instagram', icon: '📷', desc: 'Extrai apenas contas com Instagram' },
    { value: 'face', label: 'Só Facebook', icon: '📘', desc: 'Filtra leads que possuem página Facebook' },
    { value: 'site', label: 'Só Site', icon: '🌐', desc: 'Filtra apenas empresas com site próprio' },
  ];

  // CRM Filter / Search logic
  const filteredCrmLeads = crmLeads.filter(lead => {
    const matchesSearch = 
      lead.nome.toLowerCase().includes(crmSearch.toLowerCase()) || 
      lead.telefone.toLowerCase().includes(crmSearch.toLowerCase()) ||
      lead.email?.toLowerCase().includes(crmSearch.toLowerCase()) ||
      lead.nicho.toLowerCase().includes(crmSearch.toLowerCase()) ||
      lead.cidade.toLowerCase().includes(crmSearch.toLowerCase());
    
    if (crmFilterStage === 'all') return matchesSearch;
    return matchesSearch && lead.stage === crmFilterStage;
  });

  const displayLeads = leads.length > 0 ? leads : [];

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans selection:bg-blue-500/30 relative pb-16">
      <div className="absolute inset-0 bg-grid-pattern pointer-events-none opacity-40" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-blue-600/20 blur-[120px] rounded-full pointer-events-none" />

      {/* NAVBAR */}
      <nav className="border-b border-white/5 bg-black/40 backdrop-blur-2xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3 group cursor-default">
            <Globe size={32} />
            <span className="font-extrabold text-xl sm:text-2xl tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">Geo<span className="text-blue-400">Leads</span></span>
          </div>
          
          <div className="flex items-center gap-2.5 sm:gap-4 text-xs sm:text-sm">
            {user ? (
              <>
                <div className="px-2.5 py-1 sm:px-4 sm:py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-300 font-bold whitespace-nowrap">
                  💰 {tokens !== null ? tokens.toLocaleString('pt-BR') : '...'} <span className="hidden sm:inline">Tokens</span>
                </div>
                <a href="/pricing" className="text-gray-400 hover:text-white transition-colors font-medium">Planos</a>
                <button onClick={logout} className="text-red-400 hover:text-red-300 font-medium cursor-pointer">Sair</button>
              </>
            ) : (
              <>
                <div className="px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-full bg-white/5 border border-white/10 flex items-center gap-1.5 text-[11px] sm:text-xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse shadow-[0_0_8px_rgba(74,222,128,0.8)]" />
                  <span className="hidden sm:inline">Motor Online</span>
                </div>
                <a href="/login" className="px-3.5 py-1.5 sm:px-5 sm:py-2 rounded-full bg-white text-black font-semibold hover:bg-gray-200 transition-all text-xs sm:text-sm shadow-[0_0_15px_rgba(255,255,255,0.2)]">
                  Entrar
                </a>
              </>
            )}
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12 relative z-10">
        <header className="mb-8">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight mb-4 leading-tight">
            A Maior Máquina de <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">Leads B2B</span>
          </h1>
          <p className="text-gray-400 text-sm sm:text-base md:text-lg max-w-2xl mb-6 sm:mb-8 leading-relaxed">
            Encontre clientes potenciais em qualquer lugar do mundo. Defina o nicho, a região e deixe a nossa inteligência extrair os contatos, sites e muito mais.
          </p>

          {/* TAB NAVIGATION BAR */}
          <div className="flex border-b border-white/10 gap-2 mb-6 max-w-3xl overflow-x-auto pb-1 no-scrollbar">
            <button 
              onClick={() => setActiveTab('extractor')}
              className={`px-3.5 py-2 sm:px-5 sm:py-2.5 rounded-t-xl text-xs sm:text-sm font-semibold transition-all duration-200 cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${activeTab === 'extractor' ? 'bg-blue-600/15 border-b-2 border-blue-500 text-blue-400' : 'text-gray-400 hover:text-white'}`}
            >
              🚀 Motor Extrator
            </button>
            <button 
              onClick={() => setActiveTab('crm')}
              className={`px-3.5 py-2 sm:px-5 sm:py-2.5 rounded-t-xl text-xs sm:text-sm font-semibold transition-all duration-200 cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${activeTab === 'crm' ? 'bg-blue-600/15 border-b-2 border-blue-500 text-blue-400' : 'text-gray-400 hover:text-white'}`}
            >
              📋 CRM de Leads
              {crmLeads.length > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-blue-500 text-black text-[10px] font-bold">{crmLeads.length}</span>
              )}
            </button>
            <button 
              onClick={() => setActiveTab('whatsapp')}
              className={`px-3.5 py-2 sm:px-5 sm:py-2.5 rounded-t-xl text-xs sm:text-sm font-semibold transition-all duration-200 cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${activeTab === 'whatsapp' ? 'bg-blue-600/15 border-b-2 border-blue-500 text-blue-400' : 'text-gray-400 hover:text-white'}`}
            >
              ⚡ Disparador WhatsApp
            </button>
            <button 
              onClick={() => setActiveTab('ia')}
              className={`px-3.5 py-2 sm:px-5 sm:py-2.5 rounded-t-xl text-xs sm:text-sm font-semibold transition-all duration-200 cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${activeTab === 'ia' ? 'bg-blue-600/15 border-b-2 border-blue-500 text-blue-400' : 'text-gray-400 hover:text-white'}`}
            >
              🤖 Gerador de Copys IA
            </button>
            <button 
              onClick={() => setActiveTab('support')}
              className={`px-3.5 py-2 sm:px-5 sm:py-2.5 rounded-t-xl text-xs sm:text-sm font-semibold transition-all duration-200 cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${activeTab === 'support' ? 'bg-blue-600/15 border-b-2 border-blue-500 text-blue-400' : 'text-gray-400 hover:text-white'}`}
            >
              🙋‍♀️ Suporte & Avaliação
            </button>
          </div>
        </header>

        {/* ==================== TAB 1: EXTRACTOR ==================== */}
        {activeTab === 'extractor' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 relative z-20">
            {/* PAINEL DE BUSCA */}
            <div className="lg:col-span-1 animate-slide-up" style={{ animationDelay: '0.1s' }}>
              <div className="p-7 rounded-[2rem] bg-gradient-to-b from-white/[0.05] to-black/40 border border-white/10 backdrop-blur-xl shadow-2xl relative overflow-hidden group hover:border-blue-500/30 transition-all duration-500">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-500" />
                
                <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
                  <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  Nova Extração Avançada
                </h2>

                <form onSubmit={handleExtract} className="space-y-5">
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
                    <label className="block text-sm font-medium text-gray-400 mb-2">Exigência Obrigatória (Cobrança Justa)</label>
                    <div className="grid grid-cols-2 gap-2.5">
                      {filterOptions.map((opt) => {
                        const isSelected = filterRule === opt.value;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => setFilterRule(opt.value)}
                            className={`p-3 rounded-xl border text-left transition-all duration-200 cursor-pointer flex flex-col justify-between h-20 relative overflow-hidden ${isSelected ? 'bg-blue-600/10 border-blue-500 shadow-[0_0_12px_rgba(59,130,246,0.2)]' : 'bg-black/40 border-white/5 hover:bg-white/[0.04] hover:border-white/20'}`}
                          >
                            <span className="text-xl">{opt.icon}</span>
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
                  
                  <button 
                    type="submit"
                    disabled={isExtracting}
                    className={`w-full py-3.5 rounded-xl font-bold text-white transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer ${isExtracting ? 'bg-blue-600/50 cursor-wait' : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 hover:shadow-[0_0_20px_rgba(59,130,246,0.5)] hover:-translate-y-1 active:scale-95'}`}
                  >
                    {isExtracting ? (
                      <>
                        <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Motor Trabalhando...
                      </>
                    ) : (
                      user ? '🚀 Iniciar Extração' : '🔒 Criar Conta para Extrair'
                    )}
                  </button>
                </form>
              </div>
            </div>

            {/* PAINEL DE RESULTADOS */}
            <div className="lg:col-span-2 animate-slide-up" style={{ animationDelay: '0.2s' }}>
              <div className="p-7 rounded-[2rem] bg-gradient-to-b from-white/[0.03] to-black/40 border border-white/10 backdrop-blur-xl h-full min-h-[400px] flex flex-col shadow-2xl">
                
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
                            ✨ Busca normalizada: "{extractStats.correctedKeyword} em {extractStats.correctedLocation}"
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={handleAddAllToCRM}
                      disabled={leads.length === 0}
                      className="flex items-center gap-2 text-sm text-gray-200 hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed bg-white/5 hover:bg-white/10 px-4 py-2 rounded-lg border border-white/10 cursor-pointer"
                    >
                      📁 Salvar no CRM
                    </button>
                    <button 
                      onClick={exportToCSV}
                      disabled={leads.length === 0}
                      className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 transition-colors disabled:opacity-30 disabled:cursor-not-allowed bg-blue-500/10 px-4 py-2 rounded-lg border border-blue-500/20 cursor-pointer"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      Exportar CSV
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
                          <th className="px-4 py-3 font-medium">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {displayLeads.map((lead: any, i: number) => (
                          <tr key={i} className="hover:bg-white/[0.06] transition-colors animate-slide-up" style={{ animationDelay: `${i * 0.03}s` }}>
                            <td className="px-4 py-4 font-medium text-gray-200">
                              <div>{lead.nome}</div>
                              {lead.site && lead.site !== 'Sem site' ? (
                                <a href={lead.site} target="_blank" className="inline-block text-xs text-blue-400 hover:underline mt-1">🌐 Site Oficial</a>
                              ) : (
                                <span className="text-xs text-gray-600 mt-1 block">Sem site comercial</span>
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
                                {!lead.instagram && !lead.facebook && (
                                  <span className="text-gray-600 text-xs">—</span>
                                )}
                              </div>
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
                        {displayLeads.length === 0 && !hasSearched && !isExtracting && (
                          <tr>
                            <td colSpan={5} className="px-4 py-16 text-center">
                              <div className="text-4xl mb-4">🔍</div>
                              <p className="text-gray-300 font-medium text-lg mb-2">Pronto para começar!</p>
                              <p className="text-gray-500 text-sm max-w-md mx-auto">
                                Preencha o formulário ao lado com o nicho e a cidade desejada, defina a quantidade de leads e clique em <span className="text-blue-400 font-semibold">Iniciar Extração</span>.
                              </p>
                            </td>
                          </tr>
                        )}

                        {/* Estado vazio: depois de buscar e não achar nada */}
                        {displayLeads.length === 0 && hasSearched && !isExtracting && (
                          <tr>
                            <td colSpan={5} className="px-4 py-16 text-center">
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
                    <div className="md:hidden space-y-3 p-4">
                      {displayLeads.map((lead: any, i: number) => (
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
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-xs border-t border-white/5 pt-3">
                            <div>
                              <span className="text-gray-500 block mb-0.5">Contato</span>
                              <span className="font-mono text-gray-300 block">{lead.telefone}</span>
                              {lead.telefone && lead.telefone !== 'Não informado' && (
                                <span className="inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 rounded bg-green-500/10 text-green-400 border border-green-500/20 text-[9px] w-fit">
                                  ✓ Válido
                                </span>
                              )}
                            </div>
                            <div>
                              <span className="text-gray-500 block mb-0.5">E-mail</span>
                              {lead.email ? (
                                <a href={`mailto:${lead.email}`} className="text-purple-400 hover:underline font-mono block truncate">{lead.email}</a>
                              ) : (
                                <span className="text-gray-600 block">—</span>
                              )}
                            </div>
                          </div>

                          <div className="flex justify-between items-center border-t border-white/5 pt-3 gap-2 flex-wrap">
                            <div className="flex gap-2">
                              {lead.instagram && (
                                <a href={lead.instagram} target="_blank" className="text-pink-400 text-xs hover:underline bg-pink-500/5 px-2 py-1 rounded border border-pink-500/10">📷 Insta</a>
                              )}
                              {lead.facebook && (
                                <a href={lead.facebook} target="_blank" className="text-blue-500 text-xs hover:underline bg-blue-500/5 px-2 py-1 rounded border border-blue-500/10">📘 Face</a>
                              )}
                            </div>

                            <div className="flex gap-2 w-full xs:w-auto mt-2 xs:mt-0">
                              <button 
                                onClick={() => handleAddToCRM(lead)}
                                className="flex-1 xs:flex-initial px-3 py-2 rounded bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10 text-xs cursor-pointer flex items-center justify-center gap-1"
                              >
                                📁 Salvar
                              </button>
                              {lead.telefone && lead.telefone !== 'Não informado' && (
                                <button 
                                  onClick={() => openWhatsApp(lead)}
                                  className="flex-1 xs:flex-initial px-3 py-2 rounded bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20 text-xs cursor-pointer flex items-center justify-center gap-1"
                                >
                                  💬 WhatsApp
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}

                      {/* Estado vazio: antes de buscar */}
                      {displayLeads.length === 0 && !hasSearched && !isExtracting && (
                        <div className="py-16 text-center">
                          <div className="text-4xl mb-4">🔍</div>
                          <p className="text-gray-300 font-medium text-lg mb-2">Pronto para começar!</p>
                          <p className="text-gray-500 text-xs max-w-xs mx-auto">
                            Preencha o formulário acima com o nicho e a cidade desejada, defina a quantidade de leads e clique em <span className="text-blue-400 font-semibold">Iniciar Extração</span>.
                          </p>
                        </div>
                      )}

                      {/* Estado vazio: depois de buscar e não achar nada */}
                      {displayLeads.length === 0 && hasSearched && !isExtracting && (
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
        )}

        {/* ==================== TAB 2: CRM ==================== */}
        {activeTab === 'crm' && (
          <div className="p-7 rounded-[2rem] bg-gradient-to-b from-white/[0.03] to-black/40 border border-white/10 backdrop-blur-xl shadow-2xl relative overflow-hidden animate-slide-up">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-500" />
            
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
              <div>
                <h2 className="text-2xl font-bold flex items-center gap-2">
                  📋 Seu CRM de Vendas
                </h2>
                <p className="text-xs text-gray-500 mt-1">Gerencie os leads que você já salvou e altere as etapas do funil comercial.</p>
              </div>

              {/* SEARCH & STAGE FILTER */}
              <div className="flex flex-wrap items-center gap-2.5">
                {filteredCrmLeads.length > 0 && (
                  <label className="flex items-center gap-2 text-xs text-gray-400 bg-white/5 border border-white/10 rounded-xl px-3 py-2 cursor-pointer hover:bg-white/10">
                    <input 
                      type="checkbox"
                      checked={filteredCrmLeads.length > 0 && filteredCrmLeads.every(l => selectedCrmLeads.includes(l.nome))}
                      onChange={() => handleToggleSelectAllCrmLeads(filteredCrmLeads)}
                      className="rounded border-white/20 bg-black/40 text-blue-500 focus:ring-0 focus:ring-offset-0 cursor-pointer h-3.5 w-3.5"
                    />
                    Selecionar Todos
                  </label>
                )}
                {selectedCrmLeads.length > 0 && (
                  <button
                    onClick={handleRemoveSelectedFromCRM}
                    className="px-3.5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white border border-red-500/30 text-xs font-semibold cursor-pointer transition-colors"
                  >
                    🗑️ Excluir ({selectedCrmLeads.length})
                  </button>
                )}
                <input 
                  type="text" 
                  placeholder="Buscar no CRM..."
                  className="bg-black/50 border border-white/10 rounded-xl px-4 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500"
                  value={crmSearch}
                  onChange={(e) => setCrmSearch(e.target.value)}
                />
                <select
                  value={crmFilterStage}
                  onChange={(e) => setCrmFilterStage(e.target.value)}
                  style={{ colorScheme: 'dark' }}
                  className="bg-black/50 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500 cursor-pointer"
                >
                  <option value="all">Todas as Etapas</option>
                  <option value="Novo">Novo Lead</option>
                  <option value="Em Contato">Em Contato</option>
                  <option value="Proposta">Proposta Enviada</option>
                  <option value="Fechado">Vendido / Ganho</option>
                  <option value="Perdido">Perdido</option>
                </select>
              </div>
            </div>

            {/* TABLE / CARDS CONTAINER */}
            <div className="rounded-2xl border border-white/5 bg-black/20 overflow-hidden">
              {/* Desktop Table */}
              <table className="hidden md:table w-full text-left text-sm">
                <thead className="bg-white/5 border-b border-white/5 text-gray-400">
                  <tr>
                    <th className="px-4 py-3 font-medium w-10 text-center">
                      <input 
                        type="checkbox"
                        checked={filteredCrmLeads.length > 0 && filteredCrmLeads.every(l => selectedCrmLeads.includes(l.nome))}
                        onChange={() => handleToggleSelectAllCrmLeads(filteredCrmLeads)}
                        className="rounded border-white/20 bg-black/40 text-blue-500 focus:ring-0 focus:ring-offset-0 cursor-pointer h-4 w-4"
                      />
                    </th>
                    <th className="px-4 py-3 font-medium">Lead Info</th>
                    <th className="px-4 py-3 font-medium">Contatos</th>
                    <th className="px-4 py-3 font-medium">Funil / Status</th>
                    <th className="px-4 py-3 font-medium">Minhas Anotações</th>
                    <th className="px-4 py-3 font-medium">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredCrmLeads.map((lead, i) => (
                    <tr key={i} className={`hover:bg-white/[0.03] transition-colors ${selectedCrmLeads.includes(lead.nome) ? 'bg-blue-500/5' : ''}`}>
                      <td className="px-4 py-4 text-center">
                        <input 
                          type="checkbox"
                          checked={selectedCrmLeads.includes(lead.nome)}
                          onChange={() => handleToggleSelectCrmLead(lead.nome)}
                          className="rounded border-white/20 bg-black/40 text-blue-500 focus:ring-0 focus:ring-offset-0 cursor-pointer h-4 w-4"
                        />
                      </td>
                      <td className="px-4 py-4 font-medium text-gray-200">
                        <div className="font-bold">{lead.nome}</div>
                        <div className="text-xs text-gray-500 mt-0.5">{lead.nicho} · {lead.cidade}</div>
                        {lead.site && lead.site !== 'Sem site' && (
                          <a href={lead.site} target="_blank" className="text-xs text-blue-400 hover:underline mt-1 block">🌐 Site comercial</a>
                        )}
                      </td>
                      <td className="px-4 py-4 text-xs font-mono">
                        <div className="space-y-1">
                          {lead.telefone && lead.telefone !== 'Não informado' && (
                            <div className="text-gray-300">📞 {lead.telefone}</div>
                          )}
                          {lead.email && (
                            <div className="text-purple-400">✉️ {lead.email}</div>
                          )}
                          {lead.instagram && (
                            <a href={lead.instagram} target="_blank" className="text-pink-400 block hover:underline">📷 Instagram</a>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <select
                          value={lead.stage || 'Novo'}
                          onChange={(e) => handleUpdateCRMLead(lead.nome, 'stage', e.target.value)}
                          style={{ colorScheme: 'dark' }}
                          className={`px-3 py-1.5 rounded-lg border text-xs font-bold focus:outline-none cursor-pointer ${
                            lead.stage === 'Novo' ? 'bg-blue-500/10 border-blue-500/30 text-blue-400' :
                            lead.stage === 'Em Contato' ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' :
                            lead.stage === 'Proposta' ? 'bg-purple-500/10 border-purple-500/30 text-purple-400' :
                            lead.stage === 'Fechado' ? 'bg-green-500/10 border-green-500/30 text-green-400' :
                            'bg-red-500/10 border-red-500/30 text-red-400'
                          }`}
                        >
                          <option value="Novo">Novo Lead</option>
                          <option value="Em Contato">Em Contato</option>
                          <option value="Proposta">Proposta Enviada</option>
                          <option value="Fechado">Vendido / Ganho</option>
                          <option value="Perdido">Perdido</option>
                        </select>
                      </td>
                      <td className="px-4 py-4">
                        <textarea
                          placeholder="Clique para anotar detalhes..."
                          value={lead.notes || ''}
                          onChange={(e) => handleUpdateCRMLead(lead.nome, 'notes', e.target.value)}
                          className="w-full bg-black/40 border border-white/5 hover:border-white/10 focus:border-blue-500 focus:outline-none rounded-lg p-2 text-xs text-gray-300 resize-none h-14 transition-colors"
                        />
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          {lead.telefone && lead.telefone !== 'Não informado' && (
                            <button
                              onClick={() => openWhatsApp(lead)}
                              className="p-2 rounded bg-green-500/10 hover:bg-green-500/20 border border-green-500/20 text-green-400 transition-colors text-xs font-semibold cursor-pointer"
                            >
                              💬 Contatar
                            </button>
                          )}
                          <button
                            onClick={() => handleRemoveFromCRM(lead.nome)}
                            className="p-2 rounded bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 transition-colors text-xs font-semibold cursor-pointer"
                          >
                            Excluir
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}

                  {filteredCrmLeads.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-16 text-center text-gray-500">
                        <div className="text-3xl mb-3">📁</div>
                        <p className="font-semibold">Nenhum lead encontrado no CRM.</p>
                        <p className="text-xs max-w-md mx-auto mt-1">Salve leads a partir do "Motor Extrator" para visualizá-los e gerenciá-los aqui no seu pipeline.</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>

              {/* Mobile Card List CRM */}
              <div className="md:hidden space-y-4 p-4">
                {filteredCrmLeads.map((lead, i) => (
                  <div 
                    key={i} 
                    className={`p-4 rounded-xl border transition-all ${
                      selectedCrmLeads.includes(lead.nome) 
                        ? 'bg-blue-950/20 border-blue-500/30' 
                        : 'bg-white/[0.02] border-white/5'
                    } flex flex-col gap-4`}
                  >
                    <div className="flex items-start gap-3">
                      <input 
                        type="checkbox"
                        checked={selectedCrmLeads.includes(lead.nome)}
                        onChange={() => handleToggleSelectCrmLead(lead.nome)}
                        className="rounded border-white/20 bg-black/40 text-blue-500 focus:ring-0 focus:ring-offset-0 cursor-pointer h-4 w-4 mt-0.5"
                      />
                      <div className="flex-1">
                        <div className="font-bold text-gray-200 text-sm">{lead.nome}</div>
                        <div className="text-xs text-gray-500 mt-1">{lead.nicho} · {lead.cidade}</div>
                        {lead.site && lead.site !== 'Sem site' && (
                          <a href={lead.site} target="_blank" className="text-xs text-blue-400 hover:underline mt-1.5 block">🌐 Site comercial</a>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2 border-t border-white/5 pt-3">
                      {lead.telefone && lead.telefone !== 'Não informado' && (
                        <div className="text-xs text-gray-300 flex items-center gap-2 font-mono">
                          <span className="opacity-60">📞</span> {lead.telefone}
                        </div>
                      )}
                      {lead.email && (
                        <div className="text-xs text-purple-400 flex items-center gap-2 font-mono truncate">
                          <span className="opacity-60">✉️</span> {lead.email}
                        </div>
                      )}
                      {lead.instagram && (
                        <a href={lead.instagram} target="_blank" className="text-xs text-pink-400 flex items-center gap-2 hover:underline">
                          <span className="opacity-60">📷</span> Instagram
                        </a>
                      )}
                    </div>

                    <div className="border-t border-white/5 pt-3 flex flex-col gap-2">
                      <span className="text-[11px] text-gray-500 font-medium">Funil / Status:</span>
                      <select
                        value={lead.stage || 'Novo'}
                        onChange={(e) => handleUpdateCRMLead(lead.nome, 'stage', e.target.value)}
                        style={{ colorScheme: 'dark' }}
                        className={`w-full px-3 py-2 rounded-xl border text-xs font-bold focus:outline-none cursor-pointer ${
                          lead.stage === 'Novo' ? 'bg-blue-500/10 border-blue-500/30 text-blue-400' :
                          lead.stage === 'Em Contato' ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' :
                          lead.stage === 'Proposta' ? 'bg-purple-500/10 border-purple-500/30 text-purple-400' :
                          lead.stage === 'Fechado' ? 'bg-green-500/10 border-green-500/30 text-green-400' :
                          'bg-red-500/10 border-red-500/30 text-red-400'
                        }`}
                      >
                        <option value="Novo">Novo Lead</option>
                        <option value="Em Contato">Em Contato</option>
                        <option value="Proposta">Proposta Enviada</option>
                        <option value="Fechado">Vendido / Ganho</option>
                        <option value="Perdido">Perdido</option>
                      </select>
                    </div>

                    <div className="border-t border-white/5 pt-3 flex flex-col gap-2">
                      <span className="text-[11px] text-gray-500 font-medium">Minhas Anotações:</span>
                      <textarea
                        placeholder="Clique para anotar detalhes..."
                        value={lead.notes || ''}
                        onChange={(e) => handleUpdateCRMLead(lead.nome, 'notes', e.target.value)}
                        className="w-full bg-black/40 border border-white/5 hover:border-white/10 focus:border-blue-500 focus:outline-none rounded-xl p-3 text-xs text-gray-300 resize-none h-16 transition-colors"
                      />
                    </div>

                    <div className="flex gap-2 border-t border-white/5 pt-3">
                      {lead.telefone && lead.telefone !== 'Não informado' && (
                        <button
                          onClick={() => openWhatsApp(lead)}
                          className="flex-1 py-2.5 rounded-xl bg-green-500/10 hover:bg-green-500/20 border border-green-500/20 text-green-400 transition-colors text-xs font-semibold cursor-pointer flex items-center justify-center gap-1.5"
                        >
                          💬 Contatar
                        </button>
                      )}
                      <button
                        onClick={() => handleRemoveFromCRM(lead.nome)}
                        className="flex-1 py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 transition-colors text-xs font-semibold cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        Excluir
                      </button>
                    </div>
                  </div>
                ))}

                {filteredCrmLeads.length === 0 && (
                  <div className="py-16 text-center text-gray-500">
                    <div className="text-3xl mb-3">📁</div>
                    <p className="font-semibold text-sm">Nenhum lead encontrado no CRM.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ==================== TAB 3: WHATSAPP BULK ==================== */}
        {activeTab === 'whatsapp' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 relative z-20 animate-slide-up">
            
            {/* CONFIGURAÇÃO DO DISPARO */}
            <div className="lg:col-span-1 space-y-6">
              {/* MODELO DE MENSAGEM */}
              <div className="p-7 rounded-[2rem] bg-gradient-to-b from-white/[0.05] to-black/40 border border-white/10 backdrop-blur-xl shadow-2xl relative">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-green-500 to-emerald-500" />
                <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  ⚡ Mensagem Modelo
                </h3>
                <p className="text-xs text-gray-400 mb-4">
                  Crie sua mensagem e utilize as tags mágicas. Elas serão preenchidas automaticamente para cada cliente.
                </p>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-2">Mensagem (Suporta Tags):</label>
                    <textarea
                      rows={5}
                      className="w-full bg-black/50 border border-white/10 rounded-xl p-3.5 text-sm text-white focus:outline-none focus:border-green-500 transition-all resize-none"
                      value={waTemplate}
                      onChange={(e) => setWaTemplate(e.target.value)}
                    />
                  </div>

                  {/* TAG HELPERS */}
                  <div>
                    <label className="block text-[11px] font-medium text-gray-500 mb-2">Clique para inserir Tag:</label>
                    <div className="flex flex-wrap gap-1.5">
                      {['{Nome}', '{Cidade}', '{Nicho}', '{Site}', '{Telefone}'].map(tag => (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => setWaTemplate(prev => prev + tag)}
                          className="px-2.5 py-1 rounded bg-white/5 hover:bg-white/10 border border-white/15 text-[11px] font-mono text-gray-300 hover:text-white transition-all cursor-pointer"
                        >
                          {tag}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 text-[11px] text-gray-400 space-y-2">
                    <span className="font-bold text-gray-200 block">Como funciona o Disparador Web?</span>
                    Ao clicar em "Disparar", o sistema abrirá a aba do WhatsApp Web com a mensagem totalmente personalizada no seu navegador. Basta dar Enter no WhatsApp para enviar. É 100% livre de bloqueios!
                  </div>
                </div>
              </div>

              {/* PAINEL DE DISPARO EM MASSA E ANTIBAN */}
              <div className="p-7 rounded-[2rem] bg-gradient-to-b from-white/[0.05] to-black/40 border border-white/10 backdrop-blur-xl shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500 to-orange-500" />
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  🚀 Disparo Guiado em Massa
                </h3>
                <p className="text-xs text-gray-400 mb-4">
                  Envie mensagens sequencialmente com intervalos inteligentes para proteger sua conta do WhatsApp.
                </p>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1">Intervalo entre Mensagens (segundos):</label>
                    <input 
                      type="number" 
                      min={10}
                      max={120}
                      className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-red-500 font-mono"
                      value={bulkDelay}
                      onChange={(e) => setBulkDelay(Math.max(10, Number(e.target.value)))}
                    />
                  </div>

                  <div className="space-y-2.5">
                    <label className="flex items-center gap-2.5 text-xs text-gray-300 cursor-pointer">
                      <input 
                        type="checkbox"
                        checked={bulkSimulateHuman}
                        onChange={(e) => setBulkSimulateHuman(e.target.checked)}
                        className="rounded border-white/20 bg-black/40 text-red-500 focus:ring-0 cursor-pointer h-4 w-4"
                      />
                      Simular comportamento humano (+/- 4s randômicos)
                    </label>

                    <label className="flex items-center gap-2.5 text-xs text-gray-300 cursor-pointer">
                      <input 
                        type="checkbox"
                        checked={bulkAutoNext}
                        onChange={(e) => setBulkAutoNext(e.target.checked)}
                        className="rounded border-white/20 bg-black/40 text-red-500 focus:ring-0 cursor-pointer h-4 w-4"
                      />
                      Avançar automaticamente para o próximo lead
                    </label>
                  </div>

                  {/* ALERTA DE BLOQUEIO DESTAQUE */}
                  <div className="p-4 rounded-xl bg-red-950/20 border border-red-500/20 text-xs text-red-400 leading-relaxed space-y-1">
                    <span className="font-bold flex items-center gap-1">⚠️ AVISO DE RISCO DE BLOQUEIO</span>
                    O WhatsApp possui algoritmos severos de detecção de spam. Evite enviar em massa para listas frias (contatos que nunca falaram com você), use mensagens personalizadas com tags dinâmicas e mantenha o intervalo seguro acima de 20 segundos.
                  </div>

                  {isSendingBulk ? (
                    <button 
                      type="button"
                      onClick={handleStopBulkSending}
                      className="w-full py-3 rounded-xl font-bold text-white bg-red-600 hover:bg-red-700 border border-red-500/30 cursor-pointer flex items-center justify-center gap-2 transition-colors"
                    >
                      ⏹ Pausar Disparo em Massa
                    </button>
                  ) : (
                    <button 
                      type="button"
                      onClick={handleStartBulkSending}
                      className="w-full py-3 rounded-xl font-bold text-white bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 hover:shadow-[0_0_15px_rgba(239,68,68,0.3)] cursor-pointer flex items-center justify-center gap-2 transition-all"
                    >
                      🚀 Iniciar Disparo em Massa
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* LISTA DE DISPARO */}
            <div className="lg:col-span-2">
              <div className="p-7 rounded-[2rem] bg-gradient-to-b from-white/[0.03] to-black/40 border border-white/10 backdrop-blur-xl shadow-2xl h-full flex flex-col">
                <div className="mb-6 flex justify-between items-center">
                  <div>
                    <h3 className="text-xl font-semibold">Leads Prontos para Abordagem</h3>
                    <p className="text-xs text-gray-500 mt-1">Lista com telefones extraídos do seu CRM.</p>
                  </div>
                  <div className="text-xs px-3 py-1.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20 font-bold">
                    Total: {crmLeads.filter(l => l.telefone && l.telefone !== 'Não informado').length} leads com telefone
                  </div>
                </div>

                {/* BANNER DE FILA ATIVA */}
                {isSendingBulk && bulkIndex >= 0 && (
                  <div className="mb-6 p-5 rounded-2xl bg-green-500/10 border border-green-500/20 text-sm text-green-400 flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-pulse">
                    <div>
                      <span className="font-bold block">Fila de Disparo Guiada Ativa!</span>
                      Processando lead {bulkIndex + 1} de {crmLeads.filter(l => l.telefone && l.telefone !== 'Não informado').length}.
                      Próxima aba abre em <span className="font-mono font-bold text-white bg-green-500 px-2 py-0.5 rounded text-xs ml-1">{bulkTimer}s</span>...
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => handleTriggerBulkSendLead(bulkIndex)}
                        className="px-3.5 py-1.5 rounded-lg bg-green-500/20 hover:bg-green-500/30 text-green-300 border border-green-500/30 text-xs font-semibold cursor-pointer"
                      >
                        ⚡ Abrir Agora
                      </button>
                      <button 
                        onClick={handleStopBulkSending}
                        className="px-3.5 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30 text-xs font-semibold cursor-pointer"
                      >
                        ⏹ Parar Fila
                      </button>
                    </div>
                  </div>
                )}

                <div className="flex-1 rounded-2xl border border-white/5 bg-black/20 overflow-hidden overflow-y-auto max-h-[500px]">
                  <table className="hidden md:table w-full text-left text-sm">
                    <thead className="bg-white/5 border-b border-white/5 text-gray-400 sticky top-0">
                      <tr>
                        <th className="px-4 py-3 font-medium">Nome / Empresa</th>
                        <th className="px-4 py-3 font-medium">Telefone</th>
                        <th className="px-4 py-3 font-medium">Preview da Abordagem</th>
                        <th className="px-4 py-3 font-medium">Status / Ação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {crmLeads
                        .filter(l => l.telefone && l.telefone !== 'Não informado')
                        .map((lead, i) => {
                          const isSent = waSentStatus[lead.nome] || false;
                          const isActive = i === bulkIndex;
                          const previewText = waTemplate
                            .replace(/{Nome}/g, lead.nome)
                            .replace(/{Telefone}/g, lead.telefone)
                            .replace(/{Site}/g, lead.site || 'Sem site')
                            .replace(/{Cidade}/g, lead.cidade || 'Região')
                            .replace(/{Nicho}/g, lead.nicho || 'Geral');

                          return (
                            <tr key={i} className={`transition-all duration-300 ${
                              isActive 
                                ? 'bg-green-500/10 border-l-4 border-l-green-500' 
                                : 'hover:bg-white/[0.03]'
                            }`}>
                              <td className="px-4 py-4 font-bold text-gray-200">
                                {lead.nome}
                                <span className="block text-[10px] text-gray-500 font-normal mt-0.5">{lead.nicho} · {lead.cidade}</span>
                              </td>
                              <td className="px-4 py-4 text-xs font-mono text-gray-400">
                                {lead.telefone}
                              </td>
                              <td className="px-4 py-4 text-xs text-gray-400 max-w-xs truncate" title={previewText}>
                                {previewText}
                              </td>
                              <td className="px-4 py-4">
                                <button
                                  onClick={() => {
                                    if (isSendingBulk) {
                                      handleTriggerBulkSendLead(i);
                                    } else {
                                      openWhatsApp(lead, waTemplate);
                                    }
                                  }}
                                  className={`px-3 py-2 rounded-lg font-bold text-xs cursor-pointer border transition-all ${
                                    isActive
                                      ? 'bg-green-500 text-black border-green-400 hover:bg-green-400 font-extrabold'
                                      : isSent 
                                        ? 'bg-green-500/10 border-green-500/30 text-green-400 hover:bg-green-500/20' 
                                        : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20 text-gray-200'
                                  }`}
                                >
                                  {isActive ? '👉 Fila Ativa' : isSent ? '✓ Re-enviar' : '⚡ Disparar'}
                                </button>
                              </td>
                            </tr>
                          );
                        })}

                      {crmLeads.filter(l => l.telefone && l.telefone !== 'Não informado').length === 0 && (
                        <tr>
                          <td colSpan={4} className="px-4 py-16 text-center text-gray-500">
                            <div className="text-3xl mb-3">💬</div>
                            <p className="font-semibold">Nenhum lead com telefone no CRM.</p>
                            <p className="text-xs max-w-md mx-auto mt-1">Vá para o Extrator, faça buscas com filtros e salve os contatos no seu CRM para liberá-los aqui.</p>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>

                  {/* Mobile Card List WhatsApp */}
                  <div className="md:hidden space-y-4 p-4">
                    {crmLeads
                      .filter(l => l.telefone && l.telefone !== 'Não informado')
                      .map((lead, i) => {
                        const isSent = waSentStatus[lead.nome] || false;
                        const isActive = i === bulkIndex;
                        const previewText = waTemplate
                          .replace(/{Nome}/g, lead.nome)
                          .replace(/{Telefone}/g, lead.telefone)
                          .replace(/{Site}/g, lead.site || 'Sem site')
                          .replace(/{Cidade}/g, lead.cidade || 'Região')
                          .replace(/{Nicho}/g, lead.nicho || 'Geral');

                        return (
                          <div 
                            key={i} 
                            className={`p-4 rounded-xl border transition-all duration-300 ${
                              isActive
                                ? 'bg-green-950/20 border-green-500/30 shadow-[0_0_15px_rgba(34,197,94,0.15)] animate-pulse'
                                : 'bg-white/[0.02] border-white/5'
                            } flex flex-col gap-3`}
                          >
                            <div className="flex justify-between items-start">
                              <div>
                                <div className="font-bold text-gray-200 text-sm">{lead.nome}</div>
                                <div className="text-xs text-gray-500 mt-0.5">{lead.nicho} · {lead.cidade}</div>
                              </div>
                              <span className="text-xs font-mono text-gray-400 bg-white/5 px-2 py-0.5 rounded border border-white/10">{lead.telefone}</span>
                            </div>

                            <div className="bg-black/50 border border-white/5 rounded-xl p-3 text-xs text-gray-400 font-sans italic leading-relaxed">
                              "{previewText}"
                            </div>

                            <button
                              onClick={() => {
                                if (isSendingBulk) {
                                  handleTriggerBulkSendLead(i);
                                } else {
                                  openWhatsApp(lead, waTemplate);
                                }
                              }}
                              className={`w-full py-2.5 rounded-xl font-bold text-xs cursor-pointer border transition-all flex items-center justify-center gap-1.5 ${
                                isActive
                                  ? 'bg-green-500 text-black border-green-400 hover:bg-green-400 font-extrabold'
                                  : isSent 
                                    ? 'bg-green-500/10 border-green-500/30 text-green-400 hover:bg-green-500/20' 
                                    : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20 text-gray-200'
                              }`}
                            >
                              {isActive ? '👉 Fila de Disparo Ativa' : isSent ? '✓ Re-enviar Abordagem' : '⚡ Disparar no WhatsApp'}
                            </button>
                          </div>
                        );
                      })}

                    {crmLeads.filter(l => l.telefone && l.telefone !== 'Não informado').length === 0 && (
                      <div className="py-16 text-center text-gray-500">
                        <div className="text-3xl mb-3">💬</div>
                        <p className="font-semibold text-sm">Nenhum lead com telefone no CRM.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ==================== TAB 4: AI MESSAGE GENERATOR ==================== */}
        {activeTab === 'ia' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 relative z-20 animate-slide-up">
            
            {/* PAINEL DE ENTRADAS */}
            <div className="lg:col-span-1">
              <div className="p-7 rounded-[2rem] bg-gradient-to-b from-white/[0.05] to-black/40 border border-white/10 backdrop-blur-xl shadow-2xl relative">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 to-indigo-500" />
                
                <h3 className="text-xl font-semibold mb-6 flex items-center gap-2">
                  🤖 Gerador de Copys IA
                </h3>

                <form onSubmit={generateAICopies} className="space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">O que a sua empresa vende?</label>
                    <input 
                      type="text" 
                      placeholder="ex: Gestão de Tráfego Pago, Software ERP..."
                      className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all"
                      value={aiProduct}
                      onChange={(e) => setAiProduct(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">Qual o maior ganho/proposta de valor?</label>
                    <textarea 
                      rows={3}
                      placeholder="ex: Colocar mais clientes na porta todos os dias e aumentar o faturamento em 30%"
                      className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all resize-none"
                      value={aiValue}
                      onChange={(e) => setAiValue(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">Tom de Voz</label>
                    <select
                      value={aiTone}
                      onChange={(e) => setAiTone(e.target.value)}
                      style={{ colorScheme: 'dark' }}
                      className="w-full bg-black/80 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all cursor-pointer"
                    >
                      <option value="persuasive">Persuasivo & Marcante</option>
                      <option value="direct">Curto & Direto ao Ponto</option>
                      <option value="curious">Curioso & Provocativo</option>
                    </select>
                  </div>
                  
                  <button 
                    type="submit"
                    className="w-full py-3.5 rounded-xl font-bold text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 hover:shadow-[0_0_20px_rgba(168,85,247,0.4)] transition-all duration-200 cursor-pointer"
                  >
                    ✨ Gerar Roteiros de Alta Conversão
                  </button>
                </form>
              </div>
            </div>

            {/* RESULTADO DAS COPYS */}
            <div className="lg:col-span-2">
              <div className="p-7 rounded-[2rem] bg-gradient-to-b from-white/[0.03] to-black/40 border border-white/10 backdrop-blur-xl h-full flex flex-col shadow-2xl">
                <h3 className="text-xl font-semibold mb-6">Modelos Prontos Prontos para Uso</h3>

                {generatedCopies ? (
                  <div className="space-y-6 overflow-y-auto max-h-[550px] pr-2">
                    {generatedCopies.map((copy, index) => (
                      <div key={index} className="p-6 rounded-2xl bg-white/[0.02] border border-white/5 relative group hover:border-purple-500/30 transition-all">
                        <h4 className="text-sm font-bold text-purple-400 mb-1">{copy.title}</h4>
                        <p className="text-[11px] text-gray-500 mb-4">{copy.desc}</p>
                        
                        <pre className="text-xs bg-black/50 border border-white/5 rounded-xl p-4 font-sans text-gray-300 leading-relaxed whitespace-pre-wrap select-all">
                          {copy.text}
                        </pre>

                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(copy.text);
                            alert('Copiado para a área de transferência!');
                          }}
                          className="w-full sm:w-auto mt-3 sm:mt-0 sm:absolute sm:top-6 sm:right-6 px-3 py-1.5 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/20 text-xs font-semibold cursor-pointer transition-colors flex items-center justify-center gap-1.5"
                        >
                          📋 Copiar Roteiro
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-center py-16 text-gray-500">
                    <div className="text-5xl mb-4">🤖</div>
                    <p className="font-semibold text-lg text-gray-300">Crie copys personalizadas sem esforço</p>
                    <p className="text-sm max-w-sm mt-1 mx-auto text-gray-500">Insira as informações da sua oferta no painel ao lado e a IA criará roteiros comerciais prontos, otimizados para prospecção fria.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ==================== TAB 5: SUPPORT & RATING ==================== */}
        {activeTab === 'support' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative z-20 animate-slide-up">
            {/* CARD 1: CONTATO E SUPORTE */}
            <div className="p-7 rounded-[2rem] bg-gradient-to-b from-white/[0.05] to-black/40 border border-white/10 backdrop-blur-xl shadow-2xl relative overflow-hidden group hover:border-blue-500/30 transition-all duration-500">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-500" />
              
              <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                🙋‍♀️ Central de Suporte & Atendimento
              </h3>
              <p className="text-sm text-gray-400 mb-6 leading-relaxed">
                Precisa de ajuda com o extrator, tem dúvidas sobre faturamento ou quer sugerir alguma melhoria no sistema? Nossa equipe está pronta para responder!
              </p>

              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-gray-500 uppercase block font-bold tracking-wider">E-mail de Suporte</span>
                    <span className="text-sm text-gray-200 font-medium font-mono">pixel010dev@gmail.com</span>
                  </div>
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText('pixel010dev@gmail.com');
                      alert('E-mail copiado com sucesso!');
                    }}
                    className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-gray-300 cursor-pointer transition-colors"
                  >
                    📋 Copiar
                  </button>
                </div>

                <a 
                  href="mailto:pixel010dev@gmail.com?subject=Suporte GeoLeads&body=Olá equipe GeoLeads,"
                  className="w-full py-3.5 rounded-xl font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 hover:shadow-[0_0_20px_rgba(59,130,246,0.4)] transition-all duration-200 cursor-pointer flex items-center justify-center gap-2"
                >
                  ✉️ Abrir Chamado por E-mail
                </a>
              </div>
            </div>

            {/* CARD 2: AVALIAÇÃO DE DESEMPENHO */}
            <div className="p-7 rounded-[2rem] bg-gradient-to-b from-white/[0.05] to-black/40 border border-white/10 backdrop-blur-xl shadow-2xl relative overflow-hidden group hover:border-purple-500/30 transition-all duration-500">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 to-indigo-500" />
              
              <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                ⭐ Avalie a sua Experiência
              </h3>
              <p className="text-sm text-gray-400 mb-6 leading-relaxed">
                Sua opinião nos ajuda a evoluir a plataforma. Como tem sido sua experiência no GeoLeads?
              </p>

              {supportSubmitted ? (
                <div className="py-8 text-center text-green-400 animate-fade-in">
                  <div className="text-5xl mb-3">🎉</div>
                  <h4 className="font-bold text-lg text-gray-100">Muito obrigado pela avaliação!</h4>
                  <p className="text-xs text-gray-500 mt-1 max-w-xs mx-auto leading-relaxed">Seu feedback foi registrado e será lido pela nossa equipe de desenvolvimento.</p>
                  <button 
                    onClick={() => {
                      setSupportSubmitted(false);
                      setSupportRating(0);
                      setSupportFeedback('');
                    }}
                    className="mt-6 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-gray-300 hover:bg-white/10 cursor-pointer transition-colors"
                  >
                    Avaliar Novamente
                  </button>
                </div>
              ) : (
                <form 
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (supportRating === 0) {
                      alert('Por favor, selecione uma nota de 1 a 5 estrelas.');
                      return;
                    }
                    setSupportSubmitted(true);
                  }}
                  className="space-y-5"
                >
                  <div className="flex flex-col items-center justify-center p-4 bg-black/35 rounded-xl border border-white/5">
                    <span className="text-xs text-gray-500 mb-2 font-medium">Sua nota de 1 a 5 estrelas:</span>
                    <div className="flex gap-2">
                      {[1, 2, 3, 4, 5].map(star => {
                        const StarIsHighlighted = (hoveredStar !== null ? star <= hoveredStar : star <= supportRating);
                        return (
                          <button
                            key={star}
                            type="button"
                            onClick={() => setSupportRating(star)}
                            onMouseEnter={() => setHoveredStar(star)}
                            onMouseLeave={() => setHoveredStar(null)}
                            className="text-3xl focus:outline-none transition-transform hover:scale-125 cursor-pointer duration-100"
                          >
                            {StarIsHighlighted ? '★' : '☆'}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1">Como podemos melhorar? (Opcional):</label>
                    <textarea 
                      rows={3}
                      placeholder="Deixe sua sugestão ou elogio..."
                      className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all resize-none text-sm"
                      value={supportFeedback}
                      onChange={(e) => setSupportFeedback(e.target.value)}
                    />
                  </div>

                  <button 
                    type="submit"
                    className="w-full py-3.5 rounded-xl font-bold text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 hover:shadow-[0_0_20px_rgba(168,85,247,0.4)] transition-all duration-200 cursor-pointer"
                  >
                    Enviar Avaliação
                  </button>
                </form>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Widget de Prova Social */}
      <div className="fixed bottom-6 right-6 px-4 py-3 bg-black/60 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl flex items-center gap-3 animate-slide-up hover:-translate-y-1 transition-transform cursor-default z-50" style={{ animationDelay: '1s' }}>
        <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.8)]" />
        <p className="text-xs text-gray-300 font-medium">
          <span className="text-white font-bold">Mateus C.</span> extraiu <span className="text-blue-400 font-bold">150 Leads</span> agora
        </p>
      </div>
    </div>
  );
}
