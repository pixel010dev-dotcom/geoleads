'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { CITIES, NICHE_EXAMPLES } from '@/lib/cities-data';

const LEAD_DENSITY: Record<string, number> = {
  advogado: 420, dentista: 380, academia: 180, restaurante: 560,
  pizzaria: 140, hamburgueria: 110, mercado: 90, padaria: 130,
  oficina: 95, imobiliaria: 75, clinica: 200, hospital: 50,
  escola: 85, faculdade: 40, hotel: 110, pousada: 60,
  consultorio: 170, salao: 260, barbeiro: 150, estetica: 190,
  nutricionista: 85, psicologo: 210, fisioterapeuta: 95,
  veterinario: 110, pet: 140, farmacia: 70, churrascaria: 45,
  sorveteria: 55, cafeteria: 120, sushi: 65, construtora: 40,
  eletricista: 30, encanador: 25, pintor: 35, marceneiro: 28,
};

const CITY_MULTIPLIER: Record<string, number> = {
  'sao-paulo': 12, 'rio-de-janeiro': 8, 'belo-horizonte': 5,
  'brasilia': 4, 'salvador': 4, 'fortaleza': 4, 'curitiba': 4,
  'recife': 3, 'porto-alegre': 3, 'campinas': 3,
  'guarulhos': 2.5, 'sao-bernardo': 2, 'santo-andre': 2,
  'osasco': 2, 'sao-jose-dos-campos': 2, 'ribeirao-preto': 2,
  'uberlandia': 1.5, 'contagem': 1.5, 'duque-de-caxias': 1.5,
  'nova-iguacu': 1.5, 'niteroi': 1.5, 'sao-luis': 1.5,
  'maceio': 1.5, 'natal': 1.5, 'teresina': 1.5,
  'joao-pessoa': 1.5, 'aracaju': 1.2, 'campo-grande': 1.2,
  'cuiaba': 1.2, 'goiania': 1.5, 'belem': 1.5,
  'manaus': 1.5, 'vitoria': 1.2, 'florianopolis': 1.2,
  'londrina': 1.2, 'joinville': 1.2, 'blumenau': 1,
};

function slugify(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export default function CalculadoraPage() {
  const [niche, setNiche] = useState('');
  const [citySlug, setCitySlug] = useState('');
  const [leadPrice, setLeadPrice] = useState(25);

  const nicheSlug = slugify(niche);
  const density = LEAD_DENSITY[nicheSlug] || 50;
  const multiplier = CITY_MULTIPLIER[citySlug] || 1;
  const estimatedLeads = Math.round(density * multiplier);
  const monthlyValue = estimatedLeads * leadPrice;
  const extractionTime = Math.round(estimatedLeads / 20);

  const nicheUrl = nicheSlug && citySlug ? `/nicho/${nicheSlug}/${citySlug}` : null;

  const cityName = citySlug ? CITIES.find(c => c.slug === citySlug)?.name || citySlug : '';

  return (
    <div className="min-h-screen bg-black text-white">
      <nav className="border-b border-white/5 bg-black/40 backdrop-blur-2xl sticky top-0 z-50">
        <div className="max-w-3xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="font-extrabold text-xl tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">Geo<span className="text-blue-400">Leads</span></span>
          </Link>
          <Link href="/login?next=/app/dashboard" className="px-5 py-2 rounded-xl bg-blue-500 hover:bg-blue-400 text-black text-sm font-bold transition-colors">Testar Gratis</Link>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-4 py-12">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-300 text-xs font-bold mb-4">Calculadora Gratuita</div>
          <h1 className="text-3xl sm:text-4xl font-extrabold mb-4">Calculadora de Potencial de Leads</h1>
          <p className="text-gray-400">Descubra quantos leads voce pode extrair no Google Maps para seu nicho e cidade.</p>
        </div>

        <div className="app-card p-6 sm:p-8 rounded-[2rem] border border-white/10 bg-gradient-to-b from-white/[0.05] to-black/60 mb-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="text-xs text-gray-400 font-bold mb-1.5 block">Nicho</label>
              <input value={niche} onChange={e => setNiche(e.target.value)} placeholder="ex: dentista, advogado, pizzaria"
                className="w-full bg-black/60 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-blue-500/50" />
              <div className="flex flex-wrap gap-1.5 mt-2">
                {NICHE_EXAMPLES.slice(0, 8).map(n => (
                  <button key={n} onClick={() => setNiche(n)}
                    className={`text-[10px] px-2 py-1 rounded-full border cursor-pointer transition-colors ${niche === n ? 'bg-blue-500/20 border-blue-500/50 text-blue-300' : 'border-white/10 text-gray-500 hover:text-gray-300'}`}>{n}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-400 font-bold mb-1.5 block">Cidade</label>
              <select value={citySlug} onChange={e => setCitySlug(e.target.value)}
                className="w-full bg-black/60 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500/50">
                <option value="">Selecione uma cidade</option>
                {CITIES.map(c => <option key={c.slug} value={c.slug}>{c.name}{c.state ? ` - ${c.state}` : ''}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-400 font-bold mb-1.5 block">Valor medio por lead (R$)</label>
            <input type="range" min="5" max="200" value={leadPrice} onChange={e => setLeadPrice(Number(e.target.value))}
              className="w-full accent-blue-500" />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>R$ 5</span>
              <span className="text-white font-bold">R$ {leadPrice}</span>
              <span>R$ 200</span>
            </div>
          </div>
        </div>

        {niche && citySlug && (
          <div className="app-card p-6 sm:p-8 rounded-[2rem] border border-blue-500/20 bg-gradient-to-b from-blue-500/10 to-black/60 text-center mb-8">
            <p className="text-sm text-gray-400 mb-2">Potencial estimado em {cityName}</p>
            <p className="text-3xl sm:text-5xl font-extrabold text-blue-400 mb-2">{estimatedLeads.toLocaleString()}</p>
            <p className="text-sm text-gray-400 mb-6">{niche.charAt(0).toUpperCase() + niche.slice(1)}(s) encontrados</p>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-white/[0.05] rounded-xl p-4">
                <p className="text-2xl font-bold text-green-400">R$ {monthlyValue.toLocaleString()}</p>
                <p className="text-xs text-gray-500">Valor mensal estimado</p>
              </div>
              <div className="bg-white/[0.05] rounded-xl p-4">
                <p className="text-2xl font-bold text-cyan-400">{extractionTime} min</p>
                <p className="text-xs text-gray-500">Tempo de extracao</p>
              </div>
            </div>

            <p className="text-xs text-gray-500 mb-4">Com o GeoLeads, voce extrai todos esses leads em menos de {extractionTime} minutos. Manualmente, levaria horas.</p>

            {nicheUrl && (
              <Link href={nicheUrl}
                className="inline-block px-6 py-3 rounded-xl bg-blue-500 hover:bg-blue-400 text-black font-bold text-sm transition-all mb-3">
                Ver pagina de {niche} em {cityName}
              </Link>
            )}

            <Link href="/login?next=/app/dashboard"
              className="block w-full py-3.5 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-400 hover:to-indigo-400 text-black font-bold text-sm transition-all text-center">
              Extrair {estimatedLeads} Leads Gratis Agora
            </Link>
          </div>
        )}

        <section className="text-center">
          <h2 className="text-lg font-bold mb-4">Nichos populares para calcular</h2>
          <div className="flex flex-wrap justify-center gap-2">
            {NICHE_EXAMPLES.slice(0, 12).map(n => (
              <button key={n} onClick={() => setNiche(n)}
                className={`px-3 py-1.5 rounded-full text-xs border cursor-pointer transition-colors ${niche === n ? 'bg-blue-500/20 border-blue-500/50 text-blue-300' : 'border-white/10 text-gray-500 hover:text-gray-300'}`}>
                {n}
              </button>
            ))}
          </div>
        </section>

        <footer className="mt-16 pt-8 border-t border-white/10 text-center text-sm text-gray-500">
          <Link href="/" className="hover:text-white">GeoLeads</Link> - <Link href="/pricing" className="hover:text-white">Precos</Link> - <Link href="/blog" className="hover:text-white">Blog</Link>
        </footer>
      </main>
    </div>
  );
}
