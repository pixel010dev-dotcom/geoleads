import type { Metadata } from "next";
import { Inter } from 'next/font/google';
import "./globals.css";
import { I18nProvider } from '@/lib/i18n';
import { cookies } from 'next/headers';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

const googleVerification = '2xD0DF7y2_22UwNCUufufnKH5OmElr2qv2faSiotQNw';

export async function generateMetadata(): Promise<Metadata> {
  const cookieStore = await cookies();
  const locale = cookieStore.get('geoleads_locale')?.value || 'pt-BR';
  const isEn = locale === 'en';

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://geoleads-production-6583.up.railway.app';

  return {
    title: {
      default: isEn ? 'GeoLeads - B2B Lead Generation Engine' : 'GeoLeads - Motor de Extração de Leads B2B',
      template: '%s | GeoLeads',
    },
    description: isEn
      ? 'Find potential clients anywhere in the world. Smart lead extraction from Google Maps with CRM, WhatsApp and AI.'
      : 'Encontre clientes potenciais em qualquer lugar do mundo. Extração inteligente de leads via Google Maps com CRM, WhatsApp e IA.',
    keywords: isEn
      ? ['leads', 'prospecting', 'google maps', 'business data', 'whatsapp', 'b2b', 'sales', 'lead generation']
      : ['leads', 'prospecção', 'google maps', 'cnpj', 'whatsapp', 'b2b', 'vendas', 'extração de leads', 'gerar leads'],
    authors: [{ name: 'GeoLeads' }],
    creator: 'GeoLeads',
    publisher: 'GeoLeads',
    metadataBase: new URL(baseUrl),
    alternates: {
      canonical: '/',
      languages: {
        'pt-BR': `${baseUrl}/`,
        'en': `${baseUrl}/en`,
      },
    },
    openGraph: {
      title: isEn ? 'GeoLeads - B2B Lead Generation Engine' : 'GeoLeads - Motor de Extração de Leads B2B',
      description: isEn
        ? 'Extract 200+ qualified leads with tax ID, email and WhatsApp in 3 minutes. From Google Maps to CRM, all in one flow.'
        : 'Extraia 200+ leads qualificados com CNPJ, e-mail e WhatsApp em 3 minutos. Do Google Maps ao CRM, tudo em um fluxo.',
      url: '/',
      siteName: 'GeoLeads',
      type: 'website',
      locale: isEn ? 'en_US' : 'pt_BR',
    },
    twitter: {
      card: 'summary_large_image',
      title: isEn ? 'GeoLeads - B2B Lead Generation Engine' : 'GeoLeads - Motor de Extração de Leads B2B',
      description: isEn
        ? 'Extract 200+ qualified leads with tax ID, email and WhatsApp in 3 minutes.'
        : 'Extraia 200+ leads qualificados com CNPJ, e-mail e WhatsApp em 3 minutos.',
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-video-preview': -1,
        'max-image-preview': 'large',
        'max-snippet': -1,
      },
    },
    verification: {
      google: googleVerification,
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const locale = cookieStore.get('geoleads_locale')?.value || 'pt-BR';

  return (
    <html lang={locale === 'en' ? 'en' : 'pt-BR'} className={`h-full antialiased ${inter.variable}`}>
      <body className="min-h-full flex flex-col font-sans">
        {/* Schema.org */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'SoftwareApplication',
              name: 'GeoLeads',
              applicationCategory: 'BusinessApplication',
              operatingSystem: 'Web',
              description: 'Extração inteligente de leads via Google Maps com CRM, WhatsApp e IA.',
              offers: {
                '@type': 'Offer',
                price: '0',
                priceCurrency: 'BRL',
              },
              author: {
                '@type': 'Person',
                name: 'Guilherme Oliveira',
                email: 'pixel010dev@gmail.com',
              },
            }),
          }}
        />

        {/* Analytics: Plausible (configurar NEXT_PUBLIC_PLAUSIBLE_DOMAIN no .env) */}
        {process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN && (
          <script
            defer
            data-domain={process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN}
            src="https://plausible.io/js/script.js"
          />
        )}

        {/* Analytics: Google (configurar NEXT_PUBLIC_GA_ID no .env) */}
        {process.env.NEXT_PUBLIC_GA_ID && (
          <>
            <script async src={`https://www.googletagmanager.com/gtag/js?id=${process.env.NEXT_PUBLIC_GA_ID}`} />
            <script
              dangerouslySetInnerHTML={{
                __html: `
                  window.dataLayer = window.dataLayer || [];
                  function gtag(){dataLayer.push(arguments);}
                  gtag('js', new Date());
                  gtag('config', '${process.env.NEXT_PUBLIC_GA_ID}');
                `,
              }}
            />
          </>
        )}

        <I18nProvider>{children}</I18nProvider>
      </body>
    </html>
  );
}
