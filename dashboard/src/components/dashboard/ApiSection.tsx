'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/Button';
import { showToast } from '@/components/Toast';

interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  last_chars: string;
  created_at: string;
  last_used_at: string | null;
  revoked: boolean;
}

export default function ApiSection() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [newKeyName, setNewKeyName] = useState('');
  const [creating, setCreating] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);

  const fetchKeys = useCallback(async () => {
    try {
      const res = await fetch('/api/keys');
      const data = await res.json();
      setKeys(data.keys || []);
    } catch (e) {
      console.error('Fetch keys error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchKeys(); }, [fetchKeys]);

  const createKey = async () => {
    if (!newKeyName.trim()) {
      showToast('Dê um nome para sua chave', 'error');
      return;
    }
    setCreating(true);
    try {
      const res = await fetch('/api/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newKeyName.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        setNewKey(data.key);
        setNewKeyName('');
        fetchKeys();
        showToast('Chave criada!', 'success');
      } else {
        showToast(data.error || 'Erro ao criar chave', 'error');
      }
    } catch (e) {
      showToast('Erro ao criar chave', 'error');
    } finally {
      setCreating(false);
    }
  };

  const revokeKey = async (keyId: string) => {
    if (!confirm('Revogar esta chave? Esta ação não pode ser desfeita.')) return;
    try {
      await fetch('/api/keys', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyId }),
      });
      fetchKeys();
      showToast('Chave revogada', 'success');
    } catch (e) {
      showToast('Erro ao revogar', 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="p-6 rounded-2xl bg-gradient-to-b from-purple-600/10 to-transparent border border-purple-500/20">
        <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
          🔌 API GeoLeads
        </h2>
        <p className="text-sm text-gray-400">
          Gere chaves de API para integrar a extração de leads do GeoLeads nos seus próprios sistemas.
          Cada requisição consome 1 token.
        </p>
      </div>

      {/* Criar nova chave */}
      <div className="p-5 rounded-xl bg-white/[0.02] border border-white/[0.06]">
        <h3 className="text-sm font-semibold text-white mb-3">Criar nova chave</h3>
        <div className="flex gap-2">
          <input
            type="text"
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            placeholder="Nome da chave (ex: Meu App)"
            className="flex-1 px-3 py-2 rounded-lg bg-black/40 border border-white/10 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-purple-500/50"
          />
          <Button
            onClick={createKey}
            disabled={creating}
            size="sm"
            className="bg-purple-600 hover:bg-purple-500 text-white"
          >
            {creating ? 'Criando...' : 'Gerar Chave'}
          </Button>
        </div>

        {/* Chave recém-criada */}
        {newKey && (
          <div className="mt-4 p-4 rounded-lg bg-green-500/10 border border-green-500/30">
            <p className="text-xs text-green-400 font-semibold mb-2">✅ Chave criada! Copie AGORA — não será mostrada novamente:</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 px-3 py-2 rounded bg-black/60 text-green-300 text-xs font-mono break-all">
                {newKey}
              </code>
              <button
                onClick={() => { navigator.clipboard.writeText(newKey); showToast('Copiado!', 'success'); }}
                className="px-3 py-2 rounded-lg bg-green-500/20 text-green-400 border border-green-500/30 hover:bg-green-500/30 text-xs font-semibold cursor-pointer"
              >
                Copiar
              </button>
            </div>
            <button onClick={() => setNewKey(null)} className="mt-2 text-xs text-gray-500 hover:text-gray-400 cursor-pointer">
              Fechar
            </button>
          </div>
        )}
      </div>

      {/* Lista de chaves */}
      <div className="p-5 rounded-xl bg-white/[0.02] border border-white/[0.06]">
        <h3 className="text-sm font-semibold text-white mb-3">Suas chaves</h3>
        {loading ? (
          <div className="py-8 text-center text-gray-500 text-sm">Carregando...</div>
        ) : keys.length === 0 ? (
          <div className="py-8 text-center">
            <div className="text-3xl mb-2">🔑</div>
            <p className="text-gray-500 text-sm">Nenhuma chave criada ainda.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {keys.map((key) => (
              <div key={key.id} className={`p-3 rounded-lg border ${key.revoked ? 'bg-red-500/5 border-red-500/20 opacity-60' : 'bg-black/30 border-white/10'}`}>
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-white text-sm truncate">{key.name}</span>
                      {key.revoked && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400 font-semibold">Revogada</span>}
                    </div>
                    <code className="text-xs text-gray-500 font-mono">{key.prefix}...{key.last_chars}</code>
                    <p className="text-[10px] text-gray-600 mt-0.5">
                      Criada: {new Date(key.created_at).toLocaleDateString('pt-BR')}
                      {key.last_used_at && ` • Último uso: ${new Date(key.last_used_at).toLocaleDateString('pt-BR')}`}
                    </p>
                  </div>
                  {!key.revoked && (
                    <button
                      onClick={() => revokeKey(key.id)}
                      className="px-2 py-1 rounded text-xs text-red-400 hover:bg-red-500/10 border border-red-500/20 cursor-pointer"
                    >
                      Revogar
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Documentação */}
      <div className="p-5 rounded-xl bg-white/[0.02] border border-white/[0.06]">
        <h3 className="text-sm font-semibold text-white mb-3">Como usar</h3>
        <div className="space-y-3 text-xs">
          <div>
            <p className="text-gray-400 mb-1">Endpoint:</p>
            <code className="block px-3 py-2 rounded bg-black/60 text-blue-300 font-mono break-all">
              GET /api/v1/extract?keyword=dentista&location=São Paulo&limit=10
            </code>
          </div>
          <div>
            <p className="text-gray-400 mb-1">Header:</p>
            <code className="block px-3 py-2 rounded bg-black/60 text-green-300 font-mono">
              x-api-key: gl_sua_chave_aqui
            </code>
          </div>
          <div>
            <p className="text-gray-400 mb-1">Resposta:</p>
            <code className="block px-3 py-2 rounded bg-black/60 text-gray-300 font-mono text-[10px] overflow-x-auto">
{`{
  "success": true,
  "leads": [
    {
      "nome": "Clínica Sorriso",
      "telefone": "+55 11 99999-0000",
      "isMobile": true,
      "site": "https://...",
      "endereco": "Rua...",
      "categoria": "Dentista",
      "avaliacao": "4.5",
      "placeUrl": "https://..."
    }
  ],
  "total": 10,
  "tokens_used": 10
}`}
            </code>
          </div>
        </div>
      </div>
    </div>
  );
}
