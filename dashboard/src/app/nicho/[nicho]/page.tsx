import { Metadata } from 'next';
import Link from 'next/link';
import { getNicheBySlug, getAllNicheSlugs, CITIES, NICHES } from '@/lib/cities-data';

export const dynamic = 'force-static';
export const revalidate = 86400;

export async function generateStaticParams() {
  return getAllNicheSlugs().map(nicho => ({ nicho }));
}

export async function generateMetadata({ params }: { params: { nicho: string } }): Promise<Metadata> {
  const niche = getNicheBySlug(params.nicho);
  if (!niche) return { title: 'GeoLeads - Extraia Leads do Google Maps' };

  const title = `Extrair Leads de ${niche.name} | GeoLeads`;
  const description = `Encontre ${niche.name.toLowerCase()}s em qualquer cidade do Brasil. Extraia telefone, email, site e WhatsApp de negocios de ${niche.name.toLowerCase()} no Google Maps automaticamente.`;

  return {
    title,
    description,
    openGraph: { title, description, url: `/nicho/${niche.slug}`, siteName: 'GeoLeads', type: 'website', locale: 'pt_BR' },
    twitter: { card: 'summary_large_image', title, description },
    robots: { index: true, follow: true },
    alternates: { canonical: `https://geoleads-production.up.railway.app/nicho/${niche.slug}` },
  };
}

export default function NichePage({ params }: { params: { nicho: string } }) {
  const niche = getNicheBySlug(params.nicho);
  if (!niche) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center"><h1 className="text-2xl font-bold mb-4">Nicho nao encontrado</h1><Link href="/" className="text-blue-400 hover:underline">Voltar</Link></div>
      </div>
    );
  }

  const otherNiches = NICHES.filter(n => n.slug !== niche.slug);

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
          <h1 className="text-3xl sm:text-5xl font-extrabold mb-6 leading-tight">Extrair Leads de <span className="text-blue-400">{niche.name}</span></h1>
          <p className="text-lg sm:text-xl text-gray-400 max-w-3xl mx-auto mb-8 leading-relaxed">
            Encontre {niche.name.toLowerCase()}s em todo o Brasil. Extraia telefone, email, site, WhatsApp e redes sociais de negocios de {niche.name.toLowerCase()} no Google Maps em minutos.
          </p>
          <Link href={`/login?next=/app/dashboard`} className="inline-block px-8 py-4 rounded-2xl bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-400 hover:to-indigo-400 text-black font-bold text-lg transition-all">
            Extrair 10 Leads Gratis Agora
          </Link>
        </section>

        <section className="mb-16">
          <h2 className="text-2xl sm:text-3xl font-bold mb-8 text-center">Cidades disponiveis para {niche.name}</h2>
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

        <section className="text-center bg-gradient-to-b from-blue-500/10 to-transparent border border-blue-500/20 rounded-2xl p-8 lg:p-12">
          <h2 className="text-2xl sm:text-3xl font-bold mb-4">Comece a extrair leads de {niche.name} agora</h2>
          <p className="text-gray-400 mb-6 max-w-xl mx-auto">Sem cartao de credito. 10 leads gratis para testar.</p>
          <Link href={`/login?next=/app/dashboard`} className="inline-block px-8 py-4 rounded-2xl bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-400 hover:to-indigo-400 text-black font-bold text-lg transition-all">Testar Gratis</Link>
        </section>

        <footer className="mt-16 pt-8 border-t border-white/10 text-center text-sm text-gray-500">
          <Link href="/" className="hover:text-white transition-colors">GeoLeads</Link> - <Link href="/pricing" className="hover:text-white transition-colors">Precos</Link> - <Link href="/privacy" className="hover:text-white transition-colors">Privacidade</Link> - <Link href="/terms" className="hover:text-white transition-colors">Termos</Link>
        </footer>
      </main>
    </div>
  );
}
