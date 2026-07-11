'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';

interface LeadMagnetProps {
  product: 'geoleads' | 'whatsai';
  title: string;
  subtitle: string;
  description: string;
  benefits: string[];
  fileName: string;
  fileUrl?: string;
  previewImage?: string;
}

export default function LeadMagnetGate({
  product,
  title,
  subtitle,
  description,
  benefits,
  fileName,
}: LeadMagnetProps) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [step, setStep] = useState<'form' | 'loading' | 'done'>('form');
  const [error, setError] = useState('');

  const bg = product === 'geoleads'
    ? 'from-blue-600 to-indigo-800'
    : 'from-green-600 to-emerald-800';

  const accent = product === 'geoleads' ? 'blue-400' : 'green-400';

  const handleDownload = useCallback(async () => {
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Email inválido');
      return;
    }
    if (!name || name.length < 2) {
      setError('Digite seu nome');
      return;
    }
    setError('');
    setStep('loading');

    try {
      const res = await fetch('/api/lead-magnet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name, source: fileName.replace('.', '-'), product }),
      });
      if (!res.ok) throw new Error('Erro ao registrar');

      // Trigger download
      const dlRes = await fetch(`/api/lead-magnet/download?file=${fileName}&product=${product}`);
      if (!dlRes.ok) throw new Error('Erro ao baixar');

      const blob = await dlRes.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);

      setStep('done');
    } catch {
      setError('Erro ao processar. Tenta de novo.');
      setStep('form');
    }
  }, [email, name, fileName, product]);

  return (
    <div className="min-h-screen bg-black text-white">
      {/* NAV */}
      <nav className="fixed top-0 w-full border-b border-white/5 bg-black/40 backdrop-blur-2xl z-50">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href={product === 'geoleads' ? '/' : '/whatsai'} className="text-lg font-black tracking-tight">
            {product === 'geoleads' ? (
              <><span className="text-blue-400">Geo</span><span className="text-white">Leads</span></>
            ) : (
              <><span className="text-white">Whats</span><span className="text-green-400">AI</span></>
            )}
          </Link>
          <Link href={product === 'geoleads' ? '/' : '/whatsai'} className="text-sm text-gray-400 hover:text-white transition-colors">
            ← Voltar
          </Link>
        </div>
      </nav>

      <div className="pt-20 pb-16 px-4">
        <div className="max-w-4xl mx-auto grid md:grid-cols-2 gap-8 items-start">
          {/* LEFT - Benefits */}
          <div className="pt-8">
            <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-${accent}/10 border border-${accent}/20 text-${accent} text-xs font-medium mb-4`}>
              📥 Material Grátis
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold leading-tight mb-3">{title}</h1>
            <p className="text-lg text-gray-400 mb-2">{subtitle}</p>
            <p className="text-sm text-gray-500 mb-6">{description}</p>

            <div className="space-y-3 mb-8">
              {benefits.map((b, i) => (
                <div key={i} className="flex items-start gap-3 text-sm text-gray-300">
                  <span className={`text-${accent} mt-0.5`}>✓</span>
                  {b}
                </div>
              ))}
            </div>

            <div className={`p-4 rounded-xl bg-${accent}/5 border border-${accent}/10 text-xs text-gray-400`}>
              🔒 Seu email está seguro. Não enviamos spam.
            </div>
          </div>

          {/* RIGHT - Form */}
          <div className={`p-6 sm:p-8 rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.03] to-white/[0.01] ${step === 'done' ? '' : ''}`}>
            {step === 'done' ? (
              <div className="text-center py-8">
                <div className="text-5xl mb-4">🎉</div>
                <h2 className="text-2xl font-bold mb-2">Download iniciado!</h2>
                <p className="text-gray-400 text-sm mb-4">
                  O material já deve ter baixado. Se não baixou,{' '}
                  <button
                    onClick={handleDownload}
                    className={`text-${accent} underline hover:no-underline`}
                  >
                    clica aqui
                  </button>.
                </p>
                <p className="text-xs text-gray-500">
                  Em breve vamos mandar mais conteúdos no seu email.
                </p>
              </div>
            ) : (
              <>
                <div className="text-center mb-6">
                  <div className="text-3xl mb-2">📩</div>
                  <h2 className="text-xl font-bold">Baixe grátis agora</h2>
                  <p className="text-sm text-gray-400 mt-1">Só precisa do seu email pra enviar</p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-xs text-gray-500 block mb-1.5">Seu nome</label>
                    <input
                      type="text"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      placeholder="Digite seu nome"
                      className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1.5">Melhor email</label>
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="seu@email.com"
                      className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  {error && (
                    <div className="text-red-400 text-xs">{error}</div>
                  )}

                  <button
                    onClick={handleDownload}
                    disabled={step === 'loading'}
                    className={`w-full py-3 rounded-xl bg-gradient-to-r ${product === 'geoleads' ? 'from-blue-500 to-indigo-600' : 'from-green-500 to-emerald-600'} hover:opacity-90 text-white font-bold transition-all text-sm disabled:opacity-50`}
                  >
                    {step === 'loading' ? '⏳ Preparando...' : `📥 Baixar ${fileName}`}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
