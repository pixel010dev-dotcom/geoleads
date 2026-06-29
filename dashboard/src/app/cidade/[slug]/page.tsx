import { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/Button';
import { getCityBySlug, getAllCitySlugs, CITIES, NICHE_EXAMPLES } from '@/lib/cities-data';

export const dynamic = 'force-static';
export const revalidate = 86400;

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://geoleads-production.up.railway.app';

const faqData = [
  { q: 'Como extrair leads do Google Maps?', a: 'Com o GeoLeads voce informa o nicho e a cidade, e o sistema navega automaticamente pelo Google Maps coletando nome, telefone, site, email e endereco de cada negocio. Em minutos voce tem uma lista pronta para usar.' },
  { q: 'Preciso de cartao de credito para testar?', a: 'Nao. Oferecemos 10 tokens gratuitos sem necessidade de cartao. Voce pode extrair seus primeiros leads e testar todas as funcionalidades antes de assinar.' },
  { q: 'Quais dados posso extrair?', a: 'Telefone, WhatsApp, site, email, endereco, CEP, avaliacao, horarios, Instagram, Facebook, TikTok e CNPJ. Os dados sao enriquecidos automaticamente visitando os sites dos negocios.' },
  { q: 'Funciona para qualquer nicho?', a: 'Sim. Qualquer negocio cadastrado no Google Maps pode ser extraido: advogados, dentistas, restaurantes, lojas, oficinas, imobiliarias, construtoras, clinicas, academias e muito mais.' },
  { q: 'Posso usar os leads para disparar no WhatsApp?', a: 'Sim. O GeoLeads tem disparador assistido com fila inteligente, intervalos entre mensagens e templates personalizados para voce abordar cada lead sem risco de bloqueio.' },
];

export async function generateStaticParams() {
  return getAllCitySlugs().map(slug => ({ slug }));
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const city = getCityBySlug(params.slug);
  if (!city) return { title: 'GeoLeads - Extraia Leads do Google Maps' };

  const title = `Extrair Leads de ${city.name}${city.state ? ` - ${city.state}` : ''} | GeoLeads`;
  const description = `Extraia leads de ${city.name} no Google Maps automaticamente. Encontre telefone, email, site e WhatsApp de negocios em ${city.name}. Ferramenta de lead generation gratis.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `${APP_URL}/cidade/${city.slug}`,
      siteName: 'GeoLeads',
      type: 'website',
      locale: 'pt_BR',
    },
    twitter: { card: 'summary_large_image', title, description },
    robots: { index: true, follow: true },
    alternates: { canonical: `${APP_URL}/cidade/${city.slug}` },
  };
}

function slugify(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export default function CityPage({ params }: { params: { slug: string } }) {
  const city = getCityBySlug(params.slug);
  if (!city) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Cidade nao encontrada</h1>
          <Link href="/" className="text-blue-400 hover:underline">Voltar ao inicio</Link>
        </div>
      </div>
    );
  }

  const cityNichePages = NICHE_EXAMPLES.slice(0, 10).map(n => ({
    name: n,
    slug: slugify(n),
    url: `${APP_URL}/nicho/${slugify(n)}/${city.slug}`,
  }));

  const similarCities = CITIES
    .filter(c => c.state === city.state && c.name !== city.name)
    .slice(0, 6);

  const cityName = `${city.name}${city.state ? `, ${city.state}` : ''}`;

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqData.map(item => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: item.a },
    })),
  };

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'GeoLeads', item: APP_URL },
      { '@type': 'ListItem', position: 2, name: `Extrair leads ${city.name}`, item: `${APP_URL}/cidade/${city.slug}` },
    ],
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />

      <nav className="border-b border-white/5 bg-black/40 backdrop-blur-2xl sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="font-extrabold text-xl tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
              Geo<span className="text-blue-400">Leads</span>
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/blog" className="text-sm text-gray-400 hover:text-white transition-colors hidden sm:inline">Blog</Link>
            <Button href="/login?next=/app/dashboard" size="sm" className="bg-blue-500 hover:bg-blue-400 text-black shadow-none">
              Testar Gratis
            </Button>
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 py-12 lg:py-20">
        {/* Breadcrumbs visiveis */}
        <nav className="text-sm text-gray-500 mb-8 flex flex-wrap items-center gap-1" aria-label="Breadcrumb">
          <Link href="/" className="hover:text-white transition-colors">GeoLeads</Link>
          <span>/</span>
          <span className="text-gray-300">Extrair leads {city.name}</span>
        </nav>

        <section className="text-center mb-16">
          <h1 className="text-3xl sm:text-5xl font-extrabold mb-6 leading-tight">
            Extrair Leads de <span className="text-blue-400">{cityName}</span>
          </h1>
          <p className="text-lg sm:text-xl text-gray-400 max-w-3xl mx-auto mb-8 leading-relaxed">
            Encontre telefone, email, site, WhatsApp e redes sociais de negocios em {city.name} automaticamente.
            Nossa ferramenta extrai leads do Google Maps em minutos. Ideal para quem quer prospectar clientes em {city.name} sem gastar horas navegando manualmente.
          </p>
          <Button href={`/login?next=/app/dashboard`} size="lg" className="bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-400 hover:to-indigo-400 text-black shadow-none">
            Extrair 10 Leads Gratis Agora
          </Button>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
          <div className="bg-gradient-to-b from-white/[0.05] to-black/40 border border-white/10 rounded-2xl p-6 text-center">
            <div className="text-3xl mb-3">🎯</div>
            <h3 className="font-bold mb-2">Busca Inteligente</h3>
            <p className="text-sm text-gray-400">Encontre negocios de qualquer nicho em {city.name} com filtros por telefone, site, email e redes sociais.</p>
          </div>
          <div className="bg-gradient-to-b from-white/[0.05] to-black/40 border border-white/10 rounded-2xl p-6 text-center">
            <div className="text-3xl mb-3">⚡</div>
            <h3 className="font-bold mb-2">Entrega Rapida</h3>
            <p className="text-sm text-gray-400">Leads aparecem na tela em tempo real enquanto a extracao acontece. Prontos para serem abordados no WhatsApp ou CRM.</p>
          </div>
          <div className="bg-gradient-to-b from-white/[0.05] to-black/40 border border-white/10 rounded-2xl p-6 text-center">
            <div className="text-3xl mb-3">📊</div>
            <h3 className="font-bold mb-2">CRM Integrado</h3>
            <p className="text-sm text-gray-400">Organize seus leads de {city.name} em etapas: Novo, Em Contato, Proposta, Fechado. Controle total do funil.</p>
          </div>
        </section>

        <section className="mb-16">
          <h2 className="text-2xl sm:text-3xl font-bold mb-8 text-center">
            Nichos para extrair em {city.name}
          </h2>
          <div className="flex flex-wrap justify-center gap-3">
            {NICHE_EXAMPLES.slice(0, 20).map(niche => (
              <Link
                key={niche}
                href={`/nicho/${slugify(niche)}/${city.slug}`}
                className="px-4 py-2 rounded-full bg-white/5 border border-white/10 text-sm text-gray-300 hover:text-white hover:border-blue-400 transition-colors"
              >
                {niche.charAt(0).toUpperCase() + niche.slice(1)} em {city.name}
              </Link>
            ))}
          </div>
        </section>

        <section className="mb-16">
          <h2 className="text-2xl sm:text-3xl font-bold mb-8 text-center">
            Por que extrair leads de {city.name}?
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-gradient-to-b from-white/[0.05] to-black/40 border border-white/10 rounded-2xl p-6">
              <h3 className="font-bold text-lg mb-3">Economia de tempo</h3>
              <p className="text-sm text-gray-400 leading-relaxed">
                Em vez de passar horas copiando telefone por telefone do Google Maps, o GeoLeads extrai automaticamente
                centenas de leads de {city.name} em minutos. O que levava um dia inteiro, agora leva uma pausa do cafe.
              </p>
            </div>
            <div className="bg-gradient-to-b from-white/[0.05] to-black/40 border border-white/10 rounded-2xl p-6">
              <h3 className="font-bold text-lg mb-3">Dados completos</h3>
              <p className="text-sm text-gray-400 leading-relaxed">
                Nao so telefone. Cada lead de {city.name} vem com site, email, CNPJ, Instagram, Facebook e TikTok
                quando disponiveis. Quanto mais dados, mais canais de abordagem e maior chance de conversao.
              </p>
            </div>
            <div className="bg-gradient-to-b from-white/[0.05] to-black/40 border border-white/10 rounded-2xl p-6">
              <h3 className="font-bold text-lg mb-3">Segmentacao precisa</h3>
              <p className="text-sm text-gray-400 leading-relaxed">
                Escolha exatamente o nicho que voce quer atingir: dentistas, advogados, restaurantes, academias.
                O GeoLeads busca apenas negocios do segmento escolhido dentro de {city.name}, sem ruido.
              </p>
            </div>
            <div className="bg-gradient-to-b from-white/[0.05] to-black/40 border border-white/10 rounded-2xl p-6">
              <h3 className="font-bold text-lg mb-3">Abordagem integrada</h3>
              <p className="text-sm text-gray-400 leading-relaxed">
                Apos extrair, salve os leads no CRM integrado e dispare mensagens personalizadas pelo WhatsApp
                com templates de IA. Tudo em um lugar so, sem precisar de ferramentas externas.
              </p>
            </div>
          </div>
        </section>

        <section className="mb-16">
          <h2 className="text-2xl sm:text-3xl font-bold mb-8 text-center">
            Paginas de nicho em {city.name}
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {cityNichePages.map(n => (
              <Link
                key={n.url}
                href={n.url.replace(APP_URL, '')}
                className="bg-gradient-to-b from-white/[0.05] to-black/40 border border-white/10 rounded-xl p-4 text-center hover:border-blue-400 transition-all text-sm"
              >
                <span className="text-gray-300 hover:text-white">{n.name.charAt(0).toUpperCase() + n.name.slice(1)}</span>
                <span className="block text-xs text-gray-500 mt-1">{city.name}</span>
              </Link>
            ))}
          </div>
        </section>

        {similarCities.length > 0 && (
          <section className="mb-16">
            <h2 className="text-2xl sm:text-3xl font-bold mb-8 text-center">
              Outras cidades em {city.stateFull}
            </h2>
            <div className="flex flex-wrap justify-center gap-3">
              {similarCities.map(sc => (
                <Link
                  key={sc.slug}
                  href={`/cidade/${sc.slug}`}
                  className="px-4 py-2 rounded-full bg-white/5 border border-white/10 text-sm text-gray-300 hover:text-white hover:border-blue-400 transition-colors"
                >
                  {sc.name}
                </Link>
              ))}
            </div>
          </section>
        )}

        <section className="mb-16">
          <h2 className="text-2xl sm:text-3xl font-bold mb-8 text-center">Como funciona</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[
              { step: '1', title: 'Informe o nicho', desc: `Digite o tipo de negocio que voce quer encontrar em ${city.name}` },
              { step: '2', title: 'Extracao automatica', desc: 'Navegamos pelo Google Maps e coletamos nome, telefone, site, email e endereco' },
              { step: '3', title: 'Dados enriquecidos', desc: 'Visitamos os sites dos negocios para encontrar email, CNPJ, Instagram e Facebook' },
              { step: '4', title: 'Aborde no WhatsApp', desc: 'Dispare mensagens automaticas com templates personalizados direto do dashboard' },
            ].map(item => (
              <div key={item.step} className="bg-gradient-to-b from-white/[0.05] to-black/40 border border-white/10 rounded-2xl p-5">
                <span className="text-2xl font-bold text-blue-400">{item.step}.</span>
                <h3 className="font-bold mt-2 mb-1">{item.title}</h3>
                <p className="text-sm text-gray-400">{item.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* FAQ + FAQ Schema */}
        <section className="mb-16">
          <h2 className="text-2xl sm:text-3xl font-bold mb-8 text-center">
            Perguntas frequentes sobre extracao de leads em {city.name}
          </h2>
          <div className="max-w-3xl mx-auto space-y-3">
            {faqData.map((item, i) => (
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

        {similarCities.length > 0 && (
          <section className="mb-16 text-center">
            <h2 className="text-2xl sm:text-3xl font-bold mb-4">Quer explorar outras cidades?</h2>
            <p className="text-gray-400 mb-6">Veja tambem paginas de nicho especifico em {city.name}:</p>
            <div className="flex flex-wrap justify-center gap-3">
              {NICHE_EXAMPLES.slice(0, 10).map(niche => (
                <Link
                  key={niche}
                  href={`/nicho/${slugify(niche)}`}
                  className="px-4 py-2 rounded-full bg-white/5 border border-white/10 text-sm text-gray-300 hover:text-white hover:border-blue-400 transition-colors"
                >
                  {niche.charAt(0).toUpperCase() + niche.slice(1)}
                </Link>
              ))}
            </div>
          </section>
        )}

        <section className="text-center bg-gradient-to-b from-blue-500/10 to-transparent border border-blue-500/20 rounded-2xl p-8 lg:p-12">
          <h2 className="text-2xl sm:text-3xl font-bold mb-4">
            Comece a extrair leads de {city.name} agora
          </h2>
          <p className="text-gray-400 mb-6 max-w-xl mx-auto">
            Sem cartao de credito. 10 leads gratis para testar.
          </p>
          <Button href={`/login?next=/app/dashboard`} size="lg" className="bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-400 hover:to-indigo-400 text-black shadow-none">
            Testar Gratis
          </Button>
        </section>

        <footer className="mt-16 pt-8 border-t border-white/10 text-center text-sm text-gray-500">
          <Link href="/" className="hover:text-white transition-colors">GeoLeads</Link>
          {' - '}
          <Link href="/pricing" className="hover:text-white transition-colors">Precos</Link>
          {' - '}
          <Link href="/blog" className="hover:text-white transition-colors">Blog</Link>
          {' - '}
          <Link href="/privacy" className="hover:text-white transition-colors">Privacidade</Link>
          {' - '}
          <Link href="/terms" className="hover:text-white transition-colors">Termos</Link>
        </footer>
      </main>
    </div>
  );
}
