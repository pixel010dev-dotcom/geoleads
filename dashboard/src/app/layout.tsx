import type { Metadata } from "next";
import "./globals.css";

const googleVerification = '2xD0DF7y2_22UwNCUufufnKH5OmElr2qv2faSiotQNw';

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://geoleads-production.up.railway.app';

export const metadata: Metadata = {
  title: {
    default: "GeoLeads - Motor de Extração de Leads B2B",
    template: "%s | GeoLeads",
  },
  description: "Encontre clientes potenciais em qualquer lugar do mundo. Extração inteligente de leads via Google Maps com CRM, WhatsApp e IA.",
  keywords: ["leads", "B2B", "extração de leads", "Google Maps", "CRM", "WhatsApp marketing", "SaaS", "prospecção", "vendas B2B", "geração de leads"],
  authors: [{ name: "GeoLeads" }],
  creator: "GeoLeads",
  publisher: "GeoLeads",
  metadataBase: new URL(baseUrl),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: "GeoLeads - Motor de Extração de Leads B2B",
    description: "Extraia 200+ leads qualificados com CNPJ, e-mail e WhatsApp em 3 minutos. Do Google Maps ao CRM, tudo em um fluxo.",
    url: '/',
    siteName: "GeoLeads",
    type: "website",
    locale: "pt_BR",
  },
  twitter: {
    card: "summary_large_image",
    title: "GeoLeads - Motor de Extração de Leads B2B",
    description: "Extraia 200+ leads qualificados com CNPJ, e-mail e WhatsApp em 3 minutos.",
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
