import { Metadata } from 'next';
import Link from 'next/link';

const NICHOS: Record<string, { title: string; desc: string; h1: string; intro: string }> = {
  restaurantes: {
    title: 'WhatsAI para Restaurantes',
    desc: 'Automatize a prospecção de restaurantes no WhatsApp. Encontre donos de restaurantes na sua região e ofereça sua solução automaticamente.',
    h1: 'WhatsAI para Restaurantes',
    intro: 'Restaurantes precisam de clientes todos os dias. Com o WhatsAI, você encontra donos de restaurantes no Google Maps e envia mensagens personalizadas automaticamente. O sistema aborda pizzarias, hamburguerias, bares e qualquer outro tipo de restaurante na sua região.',
  },
  'saloes-de-beleza': {
    title: 'WhatsAI para Salões de Beleza',
    desc: 'Prospecte salões de beleza no WhatsApp automaticamente. Capture cabeleireiros, manicures e esteticistas na sua cidade.',
    h1: 'WhatsAI para Salões de Beleza',
    intro: 'Salões de beleza vivem de agenda cheia. Com o WhatsAI, você encontra salões, barbearias e clínicas de estética no Google Maps e aborda os donos com uma mensagem personalizada. O sistema faz tudo automaticamente enquanto você foca no que importa.',
  },
  advocacia: {
    title: 'WhatsAI para Advogados',
    desc: 'Prospecte escritórios de advocacia no WhatsApp. Encontre advogados na sua região e ofereça seus serviços com mensagens automáticas.',
    h1: 'WhatsAI para Advocacia',
    intro: 'Escritórios de advocacia estão sempre em busca de mais clientes. Com o WhatsAI, você encontra advogados no Google Maps e envia mensagens personalizadas automaticamente. O sistema aborda cada escritório como se fosse uma abordagem humana.',
  },
  academias: {
    title: 'WhatsAI para Academias',
    desc: 'Automatize a prospecção de academias no WhatsApp. Encontre donos de academia na sua região e ofereça sua solução.',
    h1: 'WhatsAI para Academias',
    intro: 'Academias competem por cada aluno. Com o WhatsAI, você encontra academias, estúdios de pilates e centros de treinamento no Google Maps e aborda os donos com mensagens automáticas personalizadas.',
  },
  clinicas: {
    title: 'WhatsAI para Clínicas Odontológicas',
    desc: 'Prospecte clínicas odontológicas no WhatsApp. Encontre dentistas na sua região com mensagens automáticas.',
    h1: 'WhatsAI para Clínicas Odontológicas',
    intro: 'Dentistas precisam de pacientes. Com o WhatsAI, você encontra clínicas odontológicas no Google Maps e envia mensagens personalizadas para os responsáveis. O sistema aborda cada clínica de forma única e profissional.',
  },
  'pet-shops': {
    title: 'WhatsAI para Pet Shops',
    desc: 'Automatize a prospecção de pet shops no WhatsApp. Encontre donos de petshops na sua região.',
    h1: 'WhatsAI para Pet Shops',
    intro: 'Pet shops precisam de tutores para seus serviços. Com o WhatsAI, você encontra pet shops, clínicas veterinárias e lojas de animais no Google Maps e aborda os donos automaticamente com mensagens personalizadas.',
  },
};

export async function generateStaticParams() {
  return Object.keys(NICHOS).map(slug => ({ slug }));
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const n = NICHOS[params.slug];
  if (!n) return { title: 'WhatsAI' };
  return {
    title: `${n.title} | WhatsAI`,
    description: n.desc,
    openGraph: { title: `${n.title} | WhatsAI`, description: n.desc, locale: 'pt_BR' },
    twitter: { card: 'summary_large_image', title: n.title, description: n.desc },
    robots: { index: false, follow: false },
  };
}

export default function WhatsaiNichoPage({ params }: { params: { slug: string } }) {
  const n = NICHOS[params.slug];
  if (!n) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Página não encontrada</h1>
          <Link href="/whatsai" className="text-green-400 hover:underline">Voltar</Link>
        </div>
      </div>
    );
  }

  const slugify = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const otherNiches = Object.entries(NICHOS).filter(([k]) => k !== params.slug);

  return (
    <div className="min-h-screen bg-black text-white">
      {/* BANNER — Produto Real */}
      <div className="bg-gradient-to-r from-green-500/10 via-emerald-500/10 to-green-500/10 border-b border-green-500/20 text-center py-2 text-xs text-gray-300">
        🚀 Produto completo disponível em{' '}
        <a
          href="https://whatsai-app-production.up.railway.app"
          target="_blank" rel="noopener noreferrer"
          className="text-green-400 font-bold underline hover:text-green-300"
        >
          whatsai.app →
        </a>
      </div>

      <nav className="border-b border-white/5 bg-black/40 backdrop-blur-2xl sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/whatsai" className="flex items-center gap-2">
            <span className="text-xl font-black tracking-tight">
              <span className="text-white">Whats</span><span className="text-green-400">AI</span>
            </span>
          </Link>
          <div className="flex items-center gap-3 text-sm">
            <Link href="/whatsai/blog" className="text-gray-400 hover:text-white transition-colors">Blog</Link>
            <a
              href="https://whatsai-app-production.up.railway.app"
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 rounded-lg bg-green-500 hover:bg-green-400 text-black font-bold transition-all text-sm"
            >
              Acessar Produto →
            </a>
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 py-16">
        <div className="mb-8">
          <Link href="/whatsai" className="text-sm text-green-400 hover:underline mb-4 inline-block">&larr; WhatsAI</Link>
          <h1 className="text-3xl sm:text-5xl font-extrabold mb-4">{n.h1}</h1>
          <p className="text-gray-400 text-lg leading-relaxed">{n.intro}</p>
        </div>

        {/* Como funciona */}
        <div className="grid md:grid-cols-3 gap-4 my-12">
          <div className="p-5 rounded-xl border border-white/5 bg-white/[0.02]">
            <div className="text-2xl mb-3">1️⃣</div>
            <h3 className="font-bold text-sm mb-1.5">Captura automática</h3>
            <p className="text-xs text-gray-500">Buscamos todos os {n.h1.replace('WhatsAI para ', '').toLowerCase()} no Google Maps da sua região.</p>
          </div>
          <div className="p-5 rounded-xl border border-white/5 bg-white/[0.02]">
            <div className="text-2xl mb-3">2️⃣</div>
            <h3 className="font-bold text-sm mb-1.5">Mensagem personalizada</h3>
            <p className="text-xs text-gray-500">Cada lead recebe uma mensagem única com seu nome e nicho, vendendo o WhatsAI.</p>
          </div>
          <div className="p-5 rounded-xl border border-white/5 bg-white/[0.02]">
            <div className="text-2xl mb-3">3️⃣</div>
            <h3 className="font-bold text-sm mb-1.5">Monitoramento 24h</h3>
            <p className="text-xs text-gray-500">Se o lead responder, o sistema avisa e você entra pra fechar.</p>
          </div>
        </div>

        {/* Outros nichos */}
        <div className="my-12">
          <h2 className="text-xl font-bold mb-4">Outros nichos</h2>
          <div className="flex flex-wrap gap-2">
            {otherNiches.map(([slug, n2]) => (
              <Link
                key={slug}
                href={`/whatsai/para/${slug}`}
                className="px-4 py-2 rounded-lg border border-white/10 hover:bg-white/[0.03] text-sm transition-colors"
              >
                {n2.h1.replace('WhatsAI para ', '')}
              </Link>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="p-8 rounded-2xl bg-gradient-to-b from-green-500/10 to-transparent border border-green-500/20 text-center">
          <h2 className="text-2xl font-bold mb-2">Pronto para começar?</h2>
          <p className="text-gray-400 mb-6">
            O WhatsAI já está disponível por <strong className="text-white">R$29,90/mês</strong> com 7 dias grátis.
          </p>
          <a
            href="https://whatsai-app-production.up.railway.app"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block px-8 py-3 rounded-xl bg-green-500 hover:bg-green-400 text-black font-bold transition-all shadow-lg shadow-green-500/25"
          >
            Acessar WhatsAI Agora →
          </a>
        </div>
      </main>

      <footer className="border-t border-white/5 py-8 px-4 text-center text-xs text-gray-600">
        <p className="mb-2">WhatsAI © 2026 — <a href="https://whatsai-app-production.up.railway.app" target="_blank" rel="noopener noreferrer" className="text-green-400 hover:underline">Acessar Produto Completo →</a></p>
        <p>Parte do ecossistema GeoLeads</p>
      </footer>
    </div>
  );
}
