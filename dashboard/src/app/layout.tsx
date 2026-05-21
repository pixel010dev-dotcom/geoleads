import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GeoLeads - Motor de Extração de Leads B2B",
  description: "Encontre clientes potenciais em qualquer lugar do mundo. Extração inteligente de leads via Google Maps com CRM, WhatsApp e IA.",
  keywords: ["leads", "B2B", "extração", "Google Maps", "CRM", "WhatsApp", "SaaS"],
  authors: [{ name: "GeoLeads" }],
  openGraph: {
    title: "GeoLeads - Motor de Extração de Leads B2B",
    description: "A maior máquina de leads B2B do Brasil.",
    type: "website",
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
