import { Metadata } from 'next';
import Link from 'next/link';
import { getNicheBySlug, getCityBySlug, getAllComboSlugs, CITIES, NICHES } from '@/lib/cities-data';

export const dynamic = 'force-dynamic';

const APP_URL = 'https://geoleads-production.up.railway.app';

export async function generateMetadata({ params }: { params: { nicho: string; cidade: string } }): Promise<Metadata> {
  const niche = getNicheBySlug(params.nicho);
  const city = getCityBySlug(params.cidade);
  if (!niche || !city) return { title: 'GeoLeads - Extraia Leads do Google Maps' };

  const title = `Extrair Leads de ${niche.name} em ${city.name}${city.state ? `, ${city.state}` : ''} | GeoLeads`;
  const description = `Encontre ${niche.name.toLowerCase()}s em ${city.name}${city.state ? `, ${city.state}` : ''}. Extraia telefone, email, site e WhatsApp de negocios de ${niche.name.toLowerCase()} no Google Maps automaticamente. Ferramenta de lead generation.`;

  return {
    title,
    description,
    openGraph: { title, description, url: `${APP_URL}/nicho/${niche.slug}/${city.slug}`, siteName: 'GeoLeads', type: 'website', locale: 'pt_BR' },
    twitter: { card: 'summary_large_image', title, description },
    robots: { index: true, follow: true },
    alternates: { canonical: `${APP_URL}/nicho/${niche.slug}/${city.slug}` },
  };
}

export default function NicheCityPage({ params }: { params: { nicho: string; cidade: string } }) {
  const niche = getNicheBySlug(params.nicho);
  const city = getCityBySlug(params.cidade);

  if (!niche || !city) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center"><h1 className="text-2xl font-bold mb-4">Pagina nao encontrada</h1><Link href="/" className="text-blue-400 hover:underline">Voltar</Link></div>
      </div>
    );
  }

  const sameCityNiches = NICHES.filter(n => n.slug !== niche.slug);
  const sameNicheCities = CITIES.filter(c => c.slug !== city.slug);
  const cityDisplay = `${city.name}${city.state ? `, ${city.state}` : ''}`;
  const nicheName = niche.name;

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'GeoLeads', item: APP_URL },
      { '@type': 'ListItem', position: 2, name: `Extrair ${nicheName}`, item: `${APP_URL}/nicho/${niche.slug}` },
      { '@type': 'ListItem', position: 3, name: `${nicheName} em ${city.name}`, item: `${APP_URL}/nicho/${niche.slug}/${city.slug}` },
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
            <Link href="/login?next=/app/dashboard" className="px-5 py-2 rounded-xl bg-blue-500 hover:bg-blue-400 text-black text-sm font-bold transition-colors">Testar Gratis</Link>
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 py-12 lg:py-20">
        <nav className="text-sm text-gray-500 mb-8 flex flex-wrap items-center gap-1" aria-label="Breadcrumb">
          <Link href="/" className="hover:text-white transition-colors">GeoLeads</Link>
          <span>/</span>
          <Link href={`/nicho/${niche.slug}`} className="hover:text-white transition-colors">{nicheName}</Link>
          <span>/</span>
          <span className="text-gray-300">{city.name}</span>
        </nav>

        <section className="text-center mb-16">
          <h1 className="text-3xl sm:text-5xl font-extrabold mb-6 leading-tight">
            Extrair Leads de <span className="text-blue-400">{nicheName}</span> em <span className="text-blue-400">{city.name}</span>
          </h1>
          <p className="text-lg sm:text-xl text-gray-400 max-w-3xl mx-auto mb-8 leading-relaxed">
            Encontre {nicheName.toLowerCase()}s em {cityDisplay}. Extraia telefone, email, site, WhatsApp e redes sociais de negocios de {nicheName.toLowerCase()} no Google Maps em minutos. Dados enriquecidos com CNPJ e Instagram.
          </p>
          <Link href={`/login?next=/app/dashboard`} className="inline-block px-8 py-4 rounded-2xl bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-400 hover:to-indigo-400 text-black font-bold text-lg transition-all">
            Extrair 10 Leads Gratis Agora
          </Link>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
          <div className="bg-gradient-to-b from-white/[0.05] to-black/40 border border-white/10 rounded-2xl p-6 text-center">
            <div className="text-3xl mb-3">🎯</div>
            <h3 className="font-bold mb-2">Busca Segmentada</h3>
            <p className="text-sm text-gray-400">Encontre {nicheName.toLowerCase()}s especificos em {city.name} com filtros por telefone, site, email e redes sociais.</p>
          </div>
          <div className="bg-gradient-to-b from-white/[0.05] to-black/40 border border-white/10 rounded-2xl p-6 text-center">
            <div className="text-3xl mb-3">⚡</div>
            <h3 className="font-bold mb-2">Entrega Rapida</h3>
            <p className="text-sm text-gray-400">Leads aparecem na tela em tempo real. Prontos para serem abordados no WhatsApp ou CRM.</p>
          </div>
          <div className="bg-gradient-to-b from-white/[0.05] to-black/40 border border-white/10 rounded-2xl p-6 text-center">
            <div className="text-3xl mb-3">📊</div>
            <h3 className="font-bold mb-2">CRM Integrado</h3>
            <p className="text-sm text-gray-400">Organize seus leads de {nicheName} em {city.name} em etapas: Novo, Em Contato, Proposta, Fechado.</p>
          </div>
        </section>

        <section className="mb-16">
          <h2 className="text-2xl sm:text-3xl font-bold mb-8 text-center">O que voce vai extrair</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto">
            {[
              { icon: '📞', label: 'Telefone' },
              { icon: '🌐', label: 'Site' },
              { icon: '📧', label: 'Email' },
              { icon: '💬', label: 'WhatsApp' },
              { icon: '📸', label: 'Instagram' },
              { icon: '📘', label: 'Facebook' },
              { icon: '🎵', label: 'TikTok' },
              { icon: '📋', label: 'CNPJ' },
            ].map(item => (
              <div key={item.label} className="bg-white/5 rounded-xl p-4 text-center border border-white/5">
                <span className="text-2xl">{item.icon}</span>
                <p className="text-sm mt-1 text-gray-300">{item.label}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mb-16">
          <h2 className="text-2xl sm:text-3xl font-bold mb-8 text-center">Por que prospectar {nicheName.toLowerCase()}s em {city.name}?</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-gradient-to-b from-white/[0.05] to-black/40 border border-white/10 rounded-2xl p-6">
              <h3 className="font-bold text-lg mb-3">Prospecção direcionada</h3>
              <p className="text-sm text-gray-400 leading-relaxed">Em vez de comprar listas genéricas, você encontra exatamente os {nicheName.toLowerCase()}s de {city.name} que estão ativos e cadastrados no Google Maps. Leads quentes e qualificados.</p>
            </div>
            <div className="bg-gradient-to-b from-white/[0.05] to-black/40 border border-white/10 rounded-2xl p-6">
              <h3 className="font-bold text-lg mb-3">Dados completos</h3>
              <p className="text-sm text-gray-400 leading-relaxed">Cada lead de {nicheName.toLowerCase()} em {city.name} vem com telefone, WhatsApp, site, email, CNPJ, Instagram e Facebook. Multiplos canais de contato para maximizar suas chances.</p>
            </div>
            <div className="bg-gradient-to-b from-white/[0.05] to-black/40 border border-white/10 rounded-2xl p-6">
              <h3 className="font-bold text-lg mb-3">Economia de tempo</h3>
              <p className="text-sm text-gray-400 leading-relaxed">O que levaria um dia inteiro para catar manualmente no Maps, o GeoLeads faz em 5 minutos. Você foca no que importa: vender.</p>
            </div>
            <div className="bg-gradient-to-b from-white/[0.05] to-black/40 border border-white/10 rounded-2xl p-6">
              <h3 className="font-bold text-lg mb-3">Abordagem via WhatsApp</h3>
              <p className="text-sm text-gray-400 leading-relaxed">O GeoLeads tem disparador assistido no WhatsApp com fila inteligente. Envie mensagens personalizadas para cada {nicheName.toLowerCase()} de {city.name} sem risco de bloqueio.</p>
            </div>
          </div>
        </section>

        {sameNicheCities.length > 0 && (
          <section className="mb-16">
            <h2 className="text-2xl sm:text-3xl font-bold mb-8 text-center">{nicheName} em outras cidades</h2>
            <div className="flex flex-wrap justify-center gap-3">
              {sameNicheCities.slice(0, 24).map(c => (
                <Link key={c.slug} href={`/nicho/${niche.slug}/${c.slug}`}
                  className="px-4 py-2 rounded-full bg-white/5 border border-white/10 text-sm text-gray-300 hover:text-white hover:border-blue-400 transition-colors">
                  {c.name}
                </Link>
              ))}
            </div>
          </section>
        )}

        <section className="mb-16">
          <h2 className="text-2xl sm:text-3xl font-bold mb-8 text-center">Outros nichos em {city.name}</h2>
          <div className="flex flex-wrap justify-center gap-3">
            {sameCityNiches.map(n => (
              <Link key={n.slug} href={`/nicho/${n.slug}/${city.slug}`}
                className="px-4 py-2 rounded-full bg-white/5 border border-white/10 text-sm text-gray-300 hover:text-white hover:border-blue-400 transition-colors">
                {n.name}
              </Link>
            ))}
          </div>
        </section>

        <section className="mb-16">
          <h2 className="text-2xl sm:text-3xl font-bold mb-8 text-center">Como funciona</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[
              { step: '1', title: 'Informe o nicho', desc: `Digite "${nicheName}" e a cidade "${city.name}"` },
              { step: '2', title: 'Extracao automatica', desc: 'Navegamos pelo Google Maps e coletamos todos os dados' },
              { step: '3', title: 'Dados enriquecidos', desc: 'Visitamos os sites para encontrar email, CNPJ, Instagram' },
              { step: '4', title: 'Aborde no WhatsApp', desc: 'Dispare mensagens automaticas com templates prontos' },
            ].map(item => (
              <div key={item.step} className="bg-gradient-to-b from-white/[0.05] to-black/40 border border-white/10 rounded-2xl p-5">
                <span className="text-2xl font-bold text-blue-400">{item.step}.</span>
                <h3 className="font-bold mt-2 mb-1">{item.title}</h3>
                <p className="text-sm text-gray-400">{item.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mb-16">
          <h2 className="text-2xl sm:text-3xl font-bold mb-8 text-center">Perguntas frequentes</h2>
          <div className="max-w-3xl mx-auto space-y-3">
            {[
              { q: `Como extrair ${nicheName.toLowerCase()}s em ${city.name}?`, a: `Acesse o GeoLeads, informe o nicho "${nicheName.toLowerCase()}" e a cidade "${city.name}". O sistema extrai automaticamente todos os ${nicheName.toLowerCase()}s cadastrados no Google Maps da regiao.` },
              { q: `Preciso de cartao para testar?`, a: 'Nao. Oferecemos 10 tokens gratuitos sem cartao de credito. Voce pode extrair e testar antes de decidir.' },
              { q: `Quanto custa para extrair ${nicheName.toLowerCase()}s em ${city.name}?`, a: `O plano gratuito ja permite extrair ${nicheName.toLowerCase()}s em ${city.name}. Para volume maior, planos a partir de R$ 9,90/mes com 300 tokens.` },
              { q: `Posso abordar os ${nicheName.toLowerCase()}s pelo WhatsApp?`, a: `Sim. O GeoLeads tem disparador assistido com fila inteligente. Envie mensagens personalizadas para cada ${nicheName.toLowerCase()} sem risco de bloqueio.` },
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

        <section className="text-center bg-gradient-to-b from-blue-500/10 to-transparent border border-blue-500/20 rounded-2xl p-8 lg:p-12">
          <h2 className="text-2xl sm:text-3xl font-bold mb-4">Comece agora - 10 leads gratis</h2>
          <p className="text-gray-400 mb-6 max-w-xl mx-auto">Extraia {nicheName.toLowerCase()}s em {city.name} agora mesmo. Sem cartao de credito.</p>
          <Link href={`/login?next=/app/dashboard`} className="inline-block px-8 py-4 rounded-2xl bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-400 hover:to-indigo-400 text-black font-bold text-lg transition-all">Testar Gratis</Link>
        </section>

        <footer className="mt-16 pt-8 border-t border-white/10 text-center text-sm text-gray-500">
          <Link href="/" className="hover:text-white transition-colors">GeoLeads</Link> - <Link href="/pricing" className="hover:text-white transition-colors">Precos</Link> - <Link href="/blog" className="hover:text-white transition-colors">Blog</Link> - <Link href="/privacy" className="hover:text-white transition-colors">Privacidade</Link> - <Link href="/terms" className="hover:text-white transition-colors">Termos</Link>
        </footer>
      </main>
    </div>
  );
}
