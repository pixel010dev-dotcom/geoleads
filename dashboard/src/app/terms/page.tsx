"use client";

import Link from 'next/link';
import { useTranslations } from '@/lib/i18n';

export default function TermsPage() {
  const { t } = useTranslations();

  return (
    <div className="min-h-screen text-white font-sans selection:bg-blue-500/30 bg-black relative overflow-x-hidden">
      <div className="absolute inset-0 bg-grid-pattern pointer-events-none opacity-30" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[min(600px,92vw)] h-[200px] bg-blue-700/10 blur-[90px] rounded-full pointer-events-none" />

      <nav className="border-b border-white/5 bg-black/40 backdrop-blur-2xl sticky top-0 z-50">
        <div className="app-container min-h-14 py-2 flex items-center justify-between gap-3">
          <Link href="/" className="font-extrabold text-lg tracking-tight text-white">Geo<span className="text-blue-400">Leads</span></Link>
          <Link href="/" className="text-xs text-gray-400 hover:text-white transition-colors">{t('terms.back')}</Link>
        </div>
      </nav>

      <main className="app-container py-10 sm:py-16 relative z-10 max-w-3xl">
        <h1 className="text-3xl sm:text-4xl font-extrabold mb-2">{t('terms.title')}</h1>
        <p className="text-sm text-gray-500 mb-8">{t('terms.updated')}</p>

        <div className="space-y-6 text-sm sm:text-base text-gray-300 leading-relaxed">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
            <section key={i}>
              <h2 className="text-lg font-bold text-white mb-2">{t(`terms.sections.${i}.title`)}</h2>
              <p>{t(`terms.sections.${i}.text`)}</p>
            </section>
          ))}
        </div>
      </main>

      <footer className="border-t border-white/5 mt-12 py-6 text-center text-xs text-gray-600">
        <p>&copy; 2026 GeoLeads. Todos os direitos reservados.</p>
      </footer>
    </div>
  );
}
