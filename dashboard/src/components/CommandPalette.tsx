'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { CrmLead } from '@/types/crm';
import { getLeadKey } from './dashboard/dashboard-constants';

interface Action {
  id: string;
  label: string;
  description?: string;
  shortcut?: string;
  icon?: string;
  action: () => void;
}

interface CommandPaletteProps {
  crmLeads?: CrmLead[];
  actions?: Action[];
  onSelectLead?: (lead: CrmLead) => void;
}

export default function CommandPalette({ crmLeads = [], actions = [], onSelectLead }: CommandPaletteProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const defaultActions: Action[] = [
    { id: 'extract', label: 'Nova extração', icon: '🔎', description: 'Extrair leads do Google Maps', action: () => {} },
    { id: 'import', label: 'Importar CSV', icon: '📄', description: 'Importar leads de arquivo CSV', action: () => {} },
    { id: 'dashboard', label: 'Ir para Dashboard', icon: '📊', description: 'Voltar ao painel principal', action: () => router.push('/app/dashboard') },
    { id: 'pricing', label: 'Ver planos', icon: '💰', description: 'Comparar planos disponíveis', action: () => router.push('/pricing') },
  ];

  const allActions = [...defaultActions, ...actions];

  const filteredActions = query
    ? allActions.filter(a =>
        a.label.toLowerCase().includes(query.toLowerCase()) ||
        a.description?.toLowerCase().includes(query.toLowerCase())
      )
    : allActions;

  const filteredLeads = crmLeads.length > 0 && query
    ? crmLeads.filter(l =>
        l.nome.toLowerCase().includes(query.toLowerCase()) ||
        l.cidade?.toLowerCase().includes(query.toLowerCase()) ||
        l.nicho?.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 5)
    : [];

  const totalItems = filteredActions.length + filteredLeads.length;

  const close = useCallback(() => {
    setOpen(false);
    setQuery('');
    setSelectedIndex(0);
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(prev => !prev);
      }
      if (e.key === 'Escape' && open) {
        close();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, close]);

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(i => Math.min(i + 1, totalItems - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex < filteredActions.length) {
        filteredActions[selectedIndex].action();
        close();
      } else {
        const leadIndex = selectedIndex - filteredActions.length;
        if (filteredLeads[leadIndex] && onSelectLead) {
          onSelectLead(filteredLeads[leadIndex]);
          close();
        }
      }
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]" onClick={close}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-lg mx-4 bg-[#0c0c12] border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-scale-in"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5">
          <svg className="w-5 h-5 text-gray-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => { setQuery(e.target.value); setSelectedIndex(0); }}
            onKeyDown={handleKeyDown}
            placeholder="Pesquisar leads, ações, páginas..."
            className="flex-1 bg-transparent text-white text-sm outline-none placeholder-gray-500"
          />
          <kbd className="hidden sm:inline-flex px-1.5 py-0.5 rounded bg-white/5 text-[10px] text-gray-500 font-mono">ESC</kbd>
        </div>

        <div className="max-h-80 overflow-y-auto p-2 space-y-0.5">
          {filteredActions.map((item, i) => (
            <button
              key={item.id}
              onClick={() => { item.action(); close(); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors ${
                i === selectedIndex ? 'bg-blue-500/10 text-blue-300' : 'text-gray-300 hover:bg-white/5'
              }`}
            >
              <span className="text-lg">{item.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">{item.label}</div>
                {item.description && (
                  <div className="text-xs text-gray-500 truncate">{item.description}</div>
                )}
              </div>
              {item.shortcut && (
                <kbd className="px-1.5 py-0.5 rounded bg-white/5 text-[10px] text-gray-500 font-mono shrink-0">{item.shortcut}</kbd>
              )}
            </button>
          ))}

          {filteredLeads.length > 0 && (
            <>
              <div className="px-3 py-1.5 text-[10px] uppercase tracking-widest text-gray-600 font-bold">Leads</div>
              {filteredLeads.map((lead, i) => {
                const idx = filteredActions.length + i;
                return (
                  <button
                    key={getLeadKey(lead)}
                    onClick={() => { onSelectLead?.(lead); close(); }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors ${
                      idx === selectedIndex ? 'bg-blue-500/10 text-blue-300' : 'text-gray-300 hover:bg-white/5'
                    }`}
                  >
                    <span className="text-lg">👤</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium">{lead.nome}</div>
                      <div className="text-xs text-gray-500 truncate">
                        {lead.cidade}{lead.nicho ? ` · ${lead.nicho}` : ''}
                      </div>
                    </div>
                    {lead.telefone && lead.telefone !== 'Não informado' && (
                      <span className="text-xs text-green-400">✓ WhatsApp</span>
                    )}
                  </button>
                );
              })}
            </>
          )}

          {query && filteredActions.length === 0 && filteredLeads.length === 0 && (
            <div className="px-3 py-8 text-center text-sm text-gray-500">
              Nenhum resultado para &ldquo;{query}&rdquo;
            </div>
          )}
        </div>

        {totalItems > 0 && (
          <div className="flex items-center gap-3 px-4 py-2 border-t border-white/5 text-[10px] text-gray-600">
            <span>↑↓ Navegar</span>
            <span>Enter Selecionar</span>
            <span>Esc Fechar</span>
          </div>
        )}
      </div>
    </div>
  );
}
