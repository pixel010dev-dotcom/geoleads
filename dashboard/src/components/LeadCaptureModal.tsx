'use client';

import { useState, useEffect } from 'react';
import Globe from '@/components/Globe';

export default function LeadCaptureModal() {
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (dismissed) return;
    if (localStorage.getItem('geoleads_lead_capture_dismissed')) return;
    const timer = setTimeout(() => setVisible(true), 45000);
    return () => clearTimeout(timer);
  }, [dismissed]);

  const handleDismiss = () => {
    setVisible(false);
    setDismissed(true);
    try { localStorage.setItem('geoleads_lead_capture_dismissed', 'true'); } catch {}
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    try {
      await fetch('/api/email/welcome', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name: 'Lead' }),
      });
      setSent(true);
      try { localStorage.setItem('geoleads_lead_capture_dismissed', 'true'); } catch {}
    } catch {}
    setLoading(false);
  };

  if (!visible || sent) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={handleDismiss}>
      <div className="app-card w-full max-w-md p-6 sm:p-8 rounded-[2rem] bg-gradient-to-b from-white/[0.08] to-black/60 border border-white/10 shadow-2xl relative overflow-hidden animate-scale-in" onClick={e => e.stopPropagation()}>
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-500" />
        <button onClick={handleDismiss} className="absolute top-4 right-4 text-gray-500 hover:text-white cursor-pointer text-lg">&times;</button>
        <div className="text-center mb-6">
          <Globe size={40} className="mx-auto mb-3" />
          <h2 className="text-xl font-bold mb-2">📚 Guia Completo de Prospeccao B2B</h2>
          <p className="text-sm text-gray-400">Aprenda as estrategias que ja geraram <b className="text-blue-300">18.000+ leads</b> para nossos usuarios. Estratégias praticas de extracao e abordagem no WhatsApp.</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Seu melhor email" required
            className="w-full bg-black/60 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-blue-500/50" />
          <button type="submit" disabled={loading}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-400 hover:to-indigo-400 text-black font-bold text-sm transition-all cursor-pointer relative overflow-hidden group/btn">
            <span className="absolute inset-0 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-600 bg-[length:200%_100%] animate-gradient-x" style={{ animationDuration: '4s' }} />
            <span className="relative">{loading ? 'Enviando...' : 'Baixar Guia Gratis →'}</span>
          </button>
        </form>
        <p className="text-[10px] text-gray-600 text-center mt-4">Sem spam. Descadastre-se quando quiser. Receba tambem 10 tokens de bonus!</p>
      </div>
    </div>
  );
}
