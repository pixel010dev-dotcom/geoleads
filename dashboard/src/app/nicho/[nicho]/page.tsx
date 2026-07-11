import { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/Button';
import { getNicheBySlug, getAllNicheSlugs, CITIES, NICHES } from '@/lib/cities-data';

export const dynamic = 'force-static';
export const revalidate = 86400;

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://geoleads-production-6583.up.railway.app';

const BLOG_ARTICLES = [
  { slug: 'prospeccao-b2b-whatsapp', title: 'Prospecção B2B no WhatsApp' },
  { slug: 'lead-generation-b2b-estrategias', title: 'Estratégias de Lead Generation' },
  { slug: 'analise-concorrencia-google-maps', title: 'Análise de Concorrência no Google Maps' },
];

export async function generateStaticParams() {
  return getAllNicheSlugs().map(nicho => ({ nicho }));
}

export async function generateMetadata({ params }: { params: { nicho: string } }): Promise<Metadata> {
  const niche = getNicheBySlug(params.nicho);
  if (!niche) return { title: 'GeoLeads - Extraia Leads do Google Maps' };

  const title = `Extrair Leads de ${niche.name} | GeoLeads`;
  const description = `Encontre ${niche.name.toLowerCase()}s em qualquer cidade do Brasil. Extraia telefone, email, site e WhatsApp de negócios de ${niche.name.toLowerCase()} no Google Maps automaticamente.`;

  return {
    title,
    description,
    openGraph: { title, description, url: `${APP_URL}/nicho/${niche.slug}`, siteName: 'GeoLeads', type: 'website', locale: 'pt_BR' },
    twitter: { card: 'summary_large_image', title, description },
    robots: { index: true, follow: true },
    alternates: { canonical: `${APP_URL}/nicho/${niche.slug}` },
  };
}

export default function NichePage({ params }: { params: { nicho: string } }) {
  const niche = getNicheBySlug(params.nicho);
  if (!niche) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center"><h1 className="text-2xl font-bold mb-4">Nicho não encontrado</h1><Link href="/" className="text-blue-400 hover:underline">Voltar</Link></div>
      </div>
    );
  }

  const otherNiches = NICHES.filter(n => n.slug !== niche.slug);
  const nicheName = niche.name;

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'GeoLeads', item: APP_URL },
      { '@type': 'ListItem', position: 2, name: `Extrair ${nicheName}`, item: `${APP_URL}/nicho/${niche.slug}` },
    ],
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />

      <nav className="border-b border-white/5 bg-black/40 backdrop-blur-2xl sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="font-extrabold text-xl tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">Geo<span className="text-blue-400">Leads</span></span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/blog" className="text-sm text-gray-400 hover:text-white transition-colors hidden sm:inline">Blog</Link>
            <Button href="/login?next=/app/dashboard" size="sm" className="bg-blue-500 hover:bg-blue-400 text-black shadow-none">Testar Grátis</Button>
          </div>
        </div>
      </nav>
      <main className="max-w-6xl mx-auto px-4 py-12 lg:py-20">
        <nav className="text-sm text-gray-500 mb-8 flex flex-wrap items-center gap-1" aria-label="Breadcrumb">
          <Link href="/" className="hover:text-white transition-colors">GeoLeads</Link>
          <span>/</span>
          <span className="text-gray-300">Extrair {nicheName}</span>
        </nav>

        <section className="text-center mb-16">
          <h1 className="text-3xl sm:text-5xl font-extrabold mb-6 leading-tight">Extrair Leads de <span className="text-blue-400">{nicheName}</span></h1>
          <p className="text-lg sm:text-xl text-gray-400 max-w-3xl mx-auto mb-8 leading-relaxed">
            Encontre {nicheName.toLowerCase()}s em todo o Brasil. Extraia telefone, email, site, WhatsApp e redes sociais de negócios de {nicheName.toLowerCase()} no Google Maps em minutos.
            Ideal para quem quer prospectar {nicheName.toLowerCase()}s sem gastar horas navegando manualmente.
          </p>
          <Button href={`/login?next=/app/dashboard`} size="lg" className="bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-400 hover:to-indigo-400 text-black shadow-none">
            Extrair 10 Leads Grátis Agora
          </Button>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
          <div className="bg-gradient-to-b from-white/[0.05] to-black/40 border border-white/10 rounded-2xl p-6 text-center">
            <div className="text-3xl mb-3">🎯</div>
            <h3 className="font-bold mb-2">Dados completos</h3>
            <p className="text-sm text-gray-400">Telefone, WhatsApp, site, email, CNPJ, Instagram e Facebook de cada {nicheName.toLowerCase()} encontrado.</p>
          </div>
          <div className="bg-gradient-to-b from-white/[0.05] to-black/40 border border-white/10 rounded-2xl p-6 text-center">
            <div className="text-3xl mb-3">🌎</div>
            <h3 className="font-bold mb-2">140 cidades</h3>
            <p className="text-sm text-gray-400">Disponível em 140 cidades brasileiras. Encontre {nicheName.toLowerCase()}s onde estiver.</p>
          </div>
          <div className="bg-gradient-to-b from-white/[0.05] to-black/40 border border-white/10 rounded-2xl p-6 text-center">
            <div className="text-3xl mb-3">⚡</div>
            <h3 className="font-bold mb-2">Automação total</h3>
            <p className="text-sm text-gray-400">Extraia, enriqueça e aborde {nicheName.toLowerCase()}s no WhatsApp em minutos, tudo automatizado.</p>
          </div>
        </section>

        <section className="mb-16">
          <h2 className="text-2xl sm:text-3xl font-bold mb-8 text-center">Por que prospectar {nicheName.toLowerCase()}s?</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-gradient-to-b from-white/[0.05] to-black/40 border border-white/10 rounded-2xl p-6">
              <h3 className="font-bold text-lg mb-3">Alta demanda</h3>
              <p className="text-sm text-gray-400 leading-relaxed">{nicheName}s estão sempre em busca de mais clientes. Se você oferece um serviço que ajuda {nicheName.toLowerCase()}s a crescer, a conversão é natural.</p>
            </div>
            <div className="bg-gradient-to-b from-white/[0.05] to-black/40 border border-white/10 rounded-2xl p-6">
              <h3 className="font-bold text-lg mb-3">Dados públicos</h3>
              <p className="text-sm text-gray-400 leading-relaxed">Todos os {nicheName.toLowerCase()}s cadastrados no Google Maps têm dados públicos que podem ser extraídos legalmente. Sem risco jurídico.</p>
            </div>
            <div className="bg-gradient-to-b from-white/[0.05] to-black/40 border border-white/10 rounded-2xl p-6">
              <h3 className="font-bold text-lg mb-3">Segmentação geográfica</h3>
              <p className="text-sm text-gray-400 leading-relaxed">Escolha cidades específicas para encontrar {nicheName.toLowerCase()}s próximos a você ou em regiões que fazem sentido para seu negócio.</p>
            </div>
            <div className="bg-gradient-to-b from-white/[0.05] to-black/40 border border-white/10 rounded-2xl p-6">
              <h3 className="font-bold text-lg mb-3">Escalabilidade</h3>
              <p className="text-sm text-gray-400 leading-relaxed">Prospectar {nicheName.toLowerCase()}s manualmente limita seu resultado. Com automação, você escala de 10 para 1.000 leads por dia sem aumentar esforço.</p>
            </div>
          </div>
        </section>

        <section className="mb-16">
          <h2 className="text-2xl sm:text-3xl font-bold mb-8 text-center">Cidades disponíveis para {nicheName}</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {CITIES.map(city => (
              <Link key={city.slug} href={`/nicho/${niche.slug}/${city.slug}`}
                className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-gray-300 hover:text-white hover:border-blue-400 transition-colors text-center">
                {city.name}
              </Link>
            ))}
          </div>
        </section>

        <section className="mb-16">
          <h2 className="text-2xl sm:text-3xl font-bold mb-8 text-center">Outros nichos</h2>
          <div className="flex flex-wrap justify-center gap-3">
            {otherNiches.map(n => (
              <Link key={n.slug} href={`/nicho/${n.slug}`}
                className="px-4 py-2 rounded-full bg-white/5 border border-white/10 text-sm text-gray-300 hover:text-white hover:border-blue-400 transition-colors">
                {n.name}
              </Link>
            ))}
          </div>
        </section>

        <section className="mb-16">
          <h2 className="text-2xl sm:text-3xl font-bold mb-8 text-center">Perguntas frequentes</h2>
          <div className="max-w-3xl mx-auto space-y-3">
            {[
              { q: `Como extrair leads de ${nicheName.toLowerCase()}?`, a: `Informe o nicho "${nicheName.toLowerCase()}" e a cidade desejada no GeoLeads. O sistema extrai automaticamente todos os ${nicheName.toLowerCase()}s cadastrados no Google Maps daquela região.` },
              { q: `Quanto custa para extrair ${nicheName.toLowerCase()}s?`, a: 'O plano gratuito oferece 10 tokens. Planos pagos começam em R$ 9,90/mês com 300 tokens. Cada token equivale a um lead extraído.' },
              { q: `Quais dados de ${nicheName.toLowerCase()}s posso obter?`, a: `Nome, telefone, WhatsApp, site, email, endereço, CNPJ, Instagram, Facebook e TikTok. O enriquecimento visita o site do ${nicheName.toLowerCase()} para capturar dados adicionais.` },
              { q: `Funciona para qualquer cidade?`, a: `Sim. O GeoLeads funciona em 140 cidades brasileiras. Basta selecionar a cidade e começar a extração de ${nicheName.toLowerCase()}s.` },
            ].map((item, i) => (
              <details key={i} className="bg-gradient-to-b from-white/[0.05] to-black/40 border border-white/10 rounded-xl p-4 group open:border-blue-500/30 transition-all cursor-pointer">
                <summary className="text-sm sm:text-base font-bold text-gray-200 group-open:text-blue-300 transition-colors list-none flex items-center justify-between gap-3">
                  {item.q}
                  <span className="text-blue-400 text-lg shrink-0 group-open:rotate-180 transition-transform">▾</span>
                </summary>
                <p className="mt-3 text-xs sm:text-sm text-gray-400 leading-relaxed border-t border-white/5 pt-3">{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* BLOG ARTICLES */}
        <section className="mb-16">
          <h2 className="text-2xl sm:text-3xl font-bold mb-8 text-center">Artigos sobre prospecção</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl mx-auto">
            {BLOG_ARTICLES.map(art => (
              <Link key={art.slug} href={`/blog/${art.slug}`}
                className="bg-gradient-to-b from-white/[0.05] to-black/40 border border-white/10 rounded-xl p-5 hover:border-blue-400 transition-all">
                <h3 className="font-bold text-sm mb-2">{art.title}</h3>
                <p className="text-xs text-gray-500">Leia mais →</p>
              </Link>
            ))}
          </div>
        </section>

        {/* LEAD MAGNET */}
        <section className="mb-16 text-center bg-gradient-to-b from-purple-500/10 to-transparent border border-purple-500/20 rounded-2xl p-8">
          <div className="text-3xl mb-3">📘</div>
          <h2 className="text-2xl sm:text-3xl font-bold mb-3">Baixe o Guia Grátis de Extração</h2>
          <p className="text-gray-400 mb-6 max-w-lg mx-auto text-sm">
            Aprenda os 5 nichos mais lucrativos, como evitar bloqueio no WhatsApp e templates prontos.
          </p>
          <Link href="/recursos/guia-extracao-leads"
            className="inline-flex px-6 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-400 hover:to-pink-400 text-white font-bold transition-all text-sm">
            📥 Baixar Grátis
          </Link>
        </section>

        <section className="text-center bg-gradient-to-b from-blue-500/10 to-transparent border border-blue-500/20 rounded-2xl p-8 lg:p-12">
          <h2 className="text-2xl sm:text-3xl font-bold mb-4">Comece a extrair leads de {nicheName} agora</h2>
          <p className="text-gray-400 mb-6 max-w-xl mx-auto">Sem cartão de crédito. 10 leads grátis para testar.</p>
          <Button href={`/login?next=/app/dashboard`} size="lg" className="bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-400 hover:to-indigo-400 text-black shadow-none">Testar Grátis</Button>
        </section>

        <footer className="mt-16 pt-8 border-t border-white/10 text-center text-sm text-gray-500">
          <Link href="/" className="hover:text-white transition-colors">GeoLeads</Link> - <Link href="/pricing" className="hover:text-white transition-colors">Preços</Link> - <Link href="/blog" className="hover:text-white transition-colors">Blog</Link> - <Link href="/recursos/guia-extracao-leads" className="hover:text-blue-300 transition-colors">Guia de Extração</Link> - <Link href="/privacy" className="hover:text-white transition-colors">Privacidade</Link> - <Link href="/terms" className="hover:text-white transition-colors">Termos</Link>
        </footer>
      </main>
    </div>
  );
}
