import { Metadata } from 'next';
import Link from 'next/link';
import { getNicheBySlug, getCityBySlug, getAllComboSlugs, CITIES, NICHES } from '@/lib/cities-data';

export const dynamic = 'force-static';
export const revalidate = 86400;

export async function generateStaticParams() {
  return getAllComboSlugs();
}

export async function generateMetadata({ params }: { params: { nicho: string; cidade: string } }): Promise<Metadata> {
  const niche = getNicheBySlug(params.nicho);
  const city = getCityBySlug(params.cidade);
  if (!niche || !city) return { title: 'GeoLeads - Extraia Leads do Google Maps' };

  const title = `Extrair Leads de ${niche.name} em ${city.name}${city.state ? `, ${city.state}` : ''} | GeoLeads`;
  const description = `Encontre ${niche.name.toLowerCase()}s em ${city.name}${city.state ? `, ${city.state}` : ''}. Extraia telefone, email, site e WhatsApp de negocios de ${niche.name.toLowerCase()} no Google Maps automaticamente. Ferramenta de lead generation.`;

  return {
    title,
    description,
    openGraph: { title, description, url: `/nicho/${niche.slug}/${city.slug}`, siteName: 'GeoLeads', type: 'website', locale: 'pt_BR' },
    twitter: { card: 'summary_large_image', title, description },
    robots: { index: true, follow: true },
    alternates: { canonical: `https://geoleads-production.up.railway.app/nicho/${niche.slug}/${city.slug}` },
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

  return (
    <div className="min-h-screen bg-black text-white">
      <nav className="border-b border-white/5 bg-black/40 backdrop-blur-2xl sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="font-extrabold text-xl tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">Geo<span className="text-blue-400">Leads</span></span>
          </Link>
          <Link href="/login?next=/app/dashboard" className="px-5 py-2 rounded-xl bg-blue-500 hover:bg-blue-400 text-black text-sm font-bold transition-colors">Testar Gratis</Link>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 py-12 lg:py-20">
        <section className="text-center mb-16">
          <h1 className="text-3xl sm:text-5xl font-extrabold mb-6 leading-tight">
            Extrair Leads de <span className="text-blue-400">{niche.name}</span> em <span className="text-blue-400">{city.name}</span>
          </h1>
          <p className="text-lg sm:text-xl text-gray-400 max-w-3xl mx-auto mb-8 leading-relaxed">
            Encontre {niche.name.toLowerCase()}s em {cityDisplay}. Extraia telefone, email, site, WhatsApp e redes sociais de negocios de {niche.name.toLowerCase()} no Google Maps em minutos. Dados enriquecidos com CNPJ e Instagram.
          </p>
          <Link href={`/login?next=/app/dashboard`} className="inline-block px-8 py-4 rounded-2xl bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-400 hover:to-indigo-400 text-black font-bold text-lg transition-all">
            Extrair 10 Leads Gratis Agora
          </Link>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
          <div className="bg-gradient-to-b from-white/[0.05] to-black/40 border border-white/10 rounded-2xl p-6 text-center">
            <div className="text-3xl mb-3">🎯</div>
            <h3 className="font-bold mb-2">Busca Segmentada</h3>
            <p className="text-sm text-gray-400">Encontre {niche.name.toLowerCase()}s especificos em {city.name} com filtros por telefone, site, email e redes sociais.</p>
          </div>
          <div className="bg-gradient-to-b from-white/[0.05] to-black/40 border border-white/10 rounded-2xl p-6 text-center">
            <div className="text-3xl mb-3">⚡</div>
            <h3 className="font-bold mb-2">Entrega Rapida</h3>
            <p className="text-sm text-gray-400">Leads aparecem na tela em tempo real. Prontos para serem abordados no WhatsApp ou CRM.</p>
          </div>
          <div className="bg-gradient-to-b from-white/[0.05] to-black/40 border border-white/10 rounded-2xl p-6 text-center">
            <div className="text-3xl mb-3">📊</div>
            <h3 className="font-bold mb-2">CRM Integrado</h3>
            <p className="text-sm text-gray-400">Organize seus leads de {niche.name} em {city.name} em etapas: Novo, Em Contato, Proposta, Fechado.</p>
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

        {sameNicheCities.length > 0 && (
          <section className="mb-16">
            <h2 className="text-2xl sm:text-3xl font-bold mb-8 text-center">{niche.name} em outras cidades</h2>
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
              { step: '1', title: 'Informe o nicho', desc: `Digite "${niche.name}" e a cidade "${city.name}"` },
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

        <section className="text-center bg-gradient-to-b from-blue-500/10 to-transparent border border-blue-500/20 rounded-2xl p-8 lg:p-12">
          <h2 className="text-2xl sm:text-3xl font-bold mb-4">Comece agora - 10 leads gratis</h2>
          <p className="text-gray-400 mb-6 max-w-xl mx-auto">Extraia {niche.name.toLowerCase()}s em {city.name} agora mesmo. Sem cartao de credito.</p>
          <Link href={`/login?next=/app/dashboard`} className="inline-block px-8 py-4 rounded-2xl bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-400 hover:to-indigo-400 text-black font-bold text-lg transition-all">Testar Gratis</Link>
        </section>

        <footer className="mt-16 pt-8 border-t border-white/10 text-center text-sm text-gray-500">
          <Link href="/" className="hover:text-white transition-colors">GeoLeads</Link> - <Link href="/pricing" className="hover:text-white transition-colors">Precos</Link> - <Link href="/privacy" className="hover:text-white transition-colors">Privacidade</Link> - <Link href="/terms" className="hover:text-white transition-colors">Termos</Link>
        </footer>
      </main>
    </div>
  );
}
