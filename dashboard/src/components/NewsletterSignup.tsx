'use client';

import { useState, FormEvent } from 'react';

export default function NewsletterSignup({ source = 'blog' }: { source?: string }) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [msg, setMsg] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setStatus('error');
      setMsg('Email inválido');
      return;
    }
    setStatus('loading');
    try {
      const res = await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, source }),
      });
      const data = await res.json();
      if (data.ok) {
        setStatus('success');
        setMsg('Cadastrado! Fique de olho no email.');
      } else {
        setStatus('error');
        setMsg(data.message || data.error || 'Erro ao cadastrar');
      }
    } catch {
      setStatus('error');
      setMsg('Erro de conexão');
    }
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
      <h3 className="text-lg font-bold mb-1">📬 Receba novidades</h3>
      <p className="text-sm text-gray-500 mb-4">
        Dicas de prospecção, lead generation e WhatsApp direto no seu email.
      </p>
      {status === 'success' ? (
        <p className="text-green-400 text-sm">{msg}</p>
      ) : (
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="seu@email.com"
            className="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-blue-500"
          />
          <button
            type="submit"
            disabled={status === 'loading'}
            className="px-4 py-2 rounded-lg bg-blue-500 text-black font-bold text-sm hover:bg-blue-400 disabled:opacity-50 transition-all"
          >
            {status === 'loading' ? '...' : 'Assinar'}
          </button>
        </form>
      )}
      {status === 'error' && <p className="text-red-400 text-xs mt-2">{msg}</p>}
    </div>
  );
}
