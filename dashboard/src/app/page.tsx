'use client';

import Link from 'next/link';
import ScrollReveal from '@/components/ScrollReveal';
import Globe from '@/components/Globe';
import DashboardPreview from '@/components/DashboardPreview';
import AnimatedStats from '@/components/AnimatedStats';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { useTranslations } from '@/lib/i18n';
import { useEffect, useState } from 'react';
import { IconPhone, IconBuilding, IconMail, IconCamera, IconWhatsApp, IconBot, IconChart, IconDownload } from '@/components/FeatureIcon';

export default function LandingPage() {
  const { t } = useTranslations();
  const [testimonialsList, setTestimonialsList] = useState<{ name: string; stars: number; text: string; role: string }[]>([]);

  useEffect(() => {
    async function fetchTestimonials() {
      const { supabase } = await import('@/lib/supabase');
      const { data: realTestimonials } = await supabase
        .from('testimonials')
        .select('name, rating, feedback, role')
        .eq('approved', true)
        .order('created_at', { ascending: false })
        .limit(6);

      const fallback = [
        { stars: 5, text: 'Triplicou minha prospecção. Antes eu passava 20 horas por semana catando leads manualmente. Agora em 30 minutos tenho uma lista pronta com CNPJ, email e WhatsApp.', name: 'Ricardo Silva', role: 'Diretor de Vendas' },
        { stars: 5, text: 'Uso pra encontrar distribuidores pro meu e-commerce. Em 1 semana fechei parceria com 3 lojas. O CNPJ validado e as redes sociais fazem toda diferença.', name: 'Juliana Costa', role: 'E-commerce B2B' },
        { stars: 5, text: 'O chatbot WhatsApp respondeu 80% das perguntas sozinho no primeiro mês. Economizei horas de atendimento e ainda fechei 4 contratos.', name: 'André Oliveira', role: 'Agência Digital' },
      ];

      const list = realTestimonials && realTestimonials.length > 0
        ? realTestimonials.map(t => ({ name: t.name, stars: t.rating, text: t.feedback || '', role: t.role || '' })).filter(t => t.text)
        : fallback;

      setTestimonialsList(list);
    }
    fetchTestimonials();
  }, []);

  const faq = [
    { q: t('faq.q1'), a: t('faq.a1') },
    { q: t('faq.q2'), a: t('faq.a2') },
    { q: t('faq.q3'), a: t('faq.a3') },
    { q: t('faq.q4'), a: t('faq.a4') },
    { q: t('faq.q5'), a: t('faq.a5') },
    { q: t('faq.q6'), a: t('faq.a6') },
  ];

  const features = [
    { iconSvg: IconPhone, title: t('tools.phone.title'), desc: t('tools.phone.desc') },
    { iconSvg: IconBuilding, title: t('tools.cnpj.title'), desc: t('tools.cnpj.desc') },
    { iconSvg: IconMail, title: t('tools.email.title'), desc: t('tools.email.desc') },
    { iconSvg: IconCamera, title: t('tools.social.title'), desc: t('tools.social.desc') },
    { iconSvg: IconWhatsApp, title: t('tools.whatsapp.title'), desc: t('tools.whatsapp.desc') },
    { iconSvg: IconBot, title: t('tools.chatbot.title'), desc: t('tools.chatbot.desc') },
    { iconSvg: IconChart, title: t('tools.crm.title'), desc: t('tools.crm.desc') },
    { iconSvg: IconDownload, title: t('tools.export.title'), desc: t('tools.export.desc') },
  ];

  return (
    <div className="app-shell min-h-screen text-white font-sans selection:bg-blue-500/30 relative overflow-x-hidden">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'SoftwareApplication',
            name: 'GeoLeads',
            applicationCategory: 'BusinessApplication',
            operatingSystem: 'Web',
            description: t('footer.description'),
            url: process.env.NEXT_PUBLIC_APP_URL || 'https://geoleads-production.up.railway.app',
            offers: {
              '@type': 'AggregateOffer',
              offerCount: 4,
              availability: 'https://schema.org/InStock',
            },
          }),
        }}
      />
      <div className="absolute inset-0 bg-grid-pattern pointer-events-none opacity-40" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[min(720px,92vw)] h-[260px] bg-blue-700/10 blur-[90px] rounded-full pointer-events-none" />
      <div className="floating-orb floating-orb-1" />
      <div className="floating-orb floating-orb-2" />
      <div className="floating-orb floating-orb-3" />

      <nav className="border-b border-white/5 bg-black/40 backdrop-blur-2xl sticky top-0 z-50">
        <div className="app-container min-h-14 py-2 sm:py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 sm:gap-3 cursor-default">
            <Globe size={28} />
            <span className="font-extrabold text-lg sm:text-xl tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
              Geo<span className="text-blue-400">Leads</span>
            </span>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-3 text-xs sm:text-sm">
            <LanguageSwitcher />
            <Link href="/pricing" className="hidden sm:inline-flex px-2.5 py-1.5 rounded-full text-gray-300 hover:text-white transition-colors font-medium">
              {t('nav.pricing')}
            </Link>
            <Link href="/login" className="hidden sm:inline-flex px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-gray-200 hover:text-white transition-all font-medium">
              {t('nav.login')}
            </Link>
            <Link href="/login" className="px-3 sm:px-4 py-2 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold transition-all shadow-[0_4px_15px_rgba(59,130,246,0.3)] hover:shadow-[0_8px_25px_rgba(59,130,246,0.4)] hover:-translate-y-0.5 active:scale-95 text-xs sm:text-sm whitespace-nowrap">
              {t('nav.signup')}
            </Link>
          </div>
        </div>
      </nav>

      <main className="relative z-10">
        <section className="app-container pt-12 sm:pt-24 pb-10 sm:pb-20">
          <ScrollReveal>
            <div className="max-w-4xl mx-auto text-center">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-300 text-xs font-bold mb-5">
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                {t('hero.badge').split('{count}')[0]}
                <span className="text-blue-200 font-extrabold tabular-nums">4.200+</span>
                {t('hero.badge').split('{count}')[1]}
              </div>
              <h1 className="text-[clamp(1.75rem,6vw,3.75rem)] font-extrabold tracking-tight leading-[1.08] mb-4">
                {t('hero.title').split(t('hero.titleHighlight'))[0]}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-cyan-300 to-indigo-400">
                  {t('hero.titleHighlight')}
                </span>
                {t('hero.title').split(t('hero.titleHighlight'))[1]}
              </h1>
              <p className="text-sm sm:text-base md:text-lg text-gray-300 max-w-2xl mx-auto leading-relaxed mb-6 sm:mb-8">
                {t('hero.subtitle')}
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
                <Link
                  href="/login"
                  className="w-full sm:w-auto px-6 sm:px-8 py-3 sm:py-4 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-sm sm:text-base transition-all shadow-[0_8px_30px_rgba(59,130,246,0.35)] hover:shadow-[0_12px_40px_rgba(59,130,246,0.5)] hover:-translate-y-1 active:scale-95 text-center"
                >
                  {t('hero.cta')}
                </Link>
                <Link
                  href="/pricing"
                  className="w-full sm:w-auto px-6 sm:px-8 py-3 sm:py-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 hover:text-white font-medium text-sm sm:text-base transition-all text-center"
                >
                  {t('hero.ctaSecondary')}
                </Link>
              </div>
              <p className="text-xs text-gray-500 mt-4">{t('hero.footnote')}</p>
            </div>
          </ScrollReveal>
        </section>

        <section className="app-container py-12 sm:py-24">
          <ScrollReveal>
            <div className="max-w-5xl mx-auto">
              <div className="text-center mb-10 sm:mb-12">
                <span className="badge-blue mb-3">{t('howItWorks.title')}</span>
                <h2 className="text-xl sm:text-3xl font-extrabold tracking-tight mt-3">{t('howItWorks.subtitle')}</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5">
                <ScrollReveal delay={0}>
                  <div className="app-card p-6 sm:p-8 rounded-2xl sm:rounded-[2rem] text-center group hover:border-blue-500/30 transition-all duration-500">
                    <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-blue-600/20 to-indigo-600/20 border border-blue-500/20 flex items-center justify-center mx-auto mb-4 sm:mb-5 text-xl sm:text-2xl group-hover:scale-110 transition-transform">
                      🎯
                    </div>
                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs sm:text-sm font-bold flex items-center justify-center mx-auto mb-3 sm:mb-4">
                      1
                    </div>
                    <h3 className="text-base sm:text-lg font-bold mb-2">{t('howItWorks.step1.title')}</h3>
                    <p className="text-xs sm:text-sm text-gray-400 leading-relaxed">{t('howItWorks.step1.desc')}</p>
                  </div>
                </ScrollReveal>
                <ScrollReveal delay={100}>
                  <div className="app-card p-6 sm:p-8 rounded-2xl sm:rounded-[2rem] text-center group hover:border-blue-500/30 transition-all duration-500">
                    <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-blue-600/20 to-indigo-600/20 border border-blue-500/20 flex items-center justify-center mx-auto mb-4 sm:mb-5 text-xl sm:text-2xl group-hover:scale-110 transition-transform">
                      📋
                    </div>
                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs sm:text-sm font-bold flex items-center justify-center mx-auto mb-3 sm:mb-4">
                      2
                    </div>
                    <h3 className="text-base sm:text-lg font-bold mb-2">{t('howItWorks.step2.title')}</h3>
                    <p className="text-xs sm:text-sm text-gray-400 leading-relaxed">{t('howItWorks.step2.desc')}</p>
                  </div>
                </ScrollReveal>
                <ScrollReveal delay={200}>
                  <div className="app-card p-6 sm:p-8 rounded-2xl sm:rounded-[2rem] text-center group hover:border-blue-500/30 transition-all duration-500">
                    <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-blue-600/20 to-indigo-600/20 border border-blue-500/20 flex items-center justify-center mx-auto mb-4 sm:mb-5 text-xl sm:text-2xl group-hover:scale-110 transition-transform">
                      💬
                    </div>
                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs sm:text-sm font-bold flex items-center justify-center mx-auto mb-3 sm:mb-4">
                      3
                    </div>
                    <h3 className="text-base sm:text-lg font-bold mb-2">{t('howItWorks.step3.title')}</h3>
                    <p className="text-xs sm:text-sm text-gray-400 leading-relaxed">{t('howItWorks.step3.desc')}</p>
                  </div>
                </ScrollReveal>
              </div>
            </div>
          </ScrollReveal>
        </section>

        <DashboardPreview />

        <section className="app-container py-12 sm:py-24">
          <ScrollReveal>
            <div className="max-w-5xl mx-auto">
              <div className="text-center mb-10 sm:mb-12">
                <span className="badge-purple mb-3">{t('tools.title')}</span>
                <h2 className="text-xl sm:text-3xl font-extrabold tracking-tight mt-3">{t('tools.subtitle')}</h2>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                {features.map((f, i) => {
                  const Icon = f.iconSvg;
                  return (
                    <ScrollReveal key={i} delay={i * 60}>
                      <div className="app-card p-4 sm:p-5 rounded-xl sm:rounded-2xl hover:border-white/15 transition-all h-full flex flex-col items-start">
                        {Icon && <Icon className="w-7 h-7 sm:w-8 sm:h-8 mb-2 sm:mb-3" />}
                        <h3 className="font-bold text-xs sm:text-sm mb-1">{f.title}</h3>
                        <p className="text-[11px] sm:text-xs text-gray-500 leading-relaxed">{f.desc}</p>
                      </div>
                    </ScrollReveal>
                  );
                })}
              </div>
            </div>
          </ScrollReveal>
        </section>

        <AnimatedStats />

        <section className="app-container py-12 sm:py-24">
          <ScrollReveal>
            <div className="max-w-5xl mx-auto">
              <div className="text-center mb-10 sm:mb-12">
                <span className="badge-purple mb-3">{t('testimonials.title')}</span>
                <h2 className="text-xl sm:text-3xl font-extrabold tracking-tight mt-3">{t('testimonials.subtitle')}</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
                {testimonialsList.slice(0, 3).map((t, i) => (
                  <ScrollReveal key={i} delay={i * 120}>
                    <div className="app-card p-5 sm:p-6 rounded-xl sm:rounded-2xl flex flex-col">
                      <div className="flex items-center gap-1 mb-3">
                        {Array.from({ length: 5 }).map((_, j) => (
                          <span key={j} className={j < t.stars ? 'text-amber-400' : 'text-gray-600'}>★</span>
                        ))}
                      </div>
                      <p className="text-sm text-gray-300 leading-relaxed flex-1">"{t.text}"</p>
                      <div className="mt-4 pt-4 border-t border-white/5">
                        <p className="text-sm font-bold text-white">{t.name}</p>
                        <p className="text-xs text-gray-500">{t.role}</p>
                      </div>
                    </div>
                  </ScrollReveal>
                ))}
              </div>
            </div>
          </ScrollReveal>
        </section>

        <section className="app-container py-12 sm:py-24">
          <ScrollReveal>
            <div className="max-w-3xl mx-auto">
              <div className="text-center mb-10 sm:mb-12">
                <span className="badge-blue mb-3">{t('faq.title')}</span>
                <h2 className="text-xl sm:text-3xl font-extrabold tracking-tight mt-3">{t('faq.subtitle')}</h2>
              </div>
              <div className="space-y-3 sm:space-y-4">
                {faq.map((item, i) => (
                  <details key={i} className="app-card p-4 sm:p-5 rounded-xl sm:rounded-2xl group open:border-blue-500/30 transition-all cursor-pointer">
                    <summary className="text-sm sm:text-base font-bold text-gray-200 group-open:text-blue-300 transition-colors list-none flex items-center justify-between gap-3">
                      {item.q}
                      <span className="text-blue-400 text-lg shrink-0 group-open:rotate-180 transition-transform">▾</span>
                    </summary>
                    <p className="mt-3 text-xs sm:text-sm text-gray-400 leading-relaxed border-t border-white/5 pt-3">{item.a}</p>
                  </details>
                ))}
              </div>
            </div>
          </ScrollReveal>
        </section>

        <section className="app-container py-12 sm:py-24">
          <ScrollReveal>
            <div className="max-w-3xl mx-auto text-center">
              <div className="app-card p-8 sm:p-14 rounded-[2rem] sm:rounded-[2.5rem] bg-gradient-to-b from-blue-600/10 to-black/40 border border-blue-500/20 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-cyan-500" />
                <span className="text-3xl sm:text-4xl mb-3 sm:mb-4 block">🚀</span>
                <h2 className="text-xl sm:text-4xl font-extrabold tracking-tight mb-3 sm:mb-4">{t('cta.title')}</h2>
                <p className="text-gray-400 max-w-md mx-auto mb-6 sm:mb-8 text-sm sm:text-base">
                  {t('cta.subtitle')}
                </p>
                <Link
                  href="/login"
                  className="inline-flex px-8 sm:px-10 py-3 sm:py-4 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-sm sm:text-base transition-all shadow-[0_8px_30px_rgba(59,130,246,0.35)] hover:shadow-[0_12px_40px_rgba(59,130,246,0.5)] hover:-translate-y-1 active:scale-95"
                >
                  {t('cta.button')}
                </Link>
                <p className="text-xs text-gray-500 mt-4">
                  {t('cta.login').replace(t('nav.login'), '')}
                  <Link href="/login" className="text-blue-400 hover:text-blue-300">{t('nav.login')}</Link>
                </p>
              </div>
            </div>
          </ScrollReveal>
        </section>
      </main>

      <footer className="border-t border-white/5 bg-black/20">
        <div className="app-container py-8 sm:py-10">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-6 sm:gap-8 mb-6 sm:mb-8 text-xs text-gray-500">
            <div className="col-span-2 sm:col-span-1">
              <div className="font-extrabold text-base text-white mb-3">Geo<span className="text-blue-400">Leads</span></div>
              <p className="leading-relaxed">{t('footer.description')}</p>
            </div>
            <div>
              <div className="font-bold text-sm text-gray-300 mb-3">{t('footer.links')}</div>
              <div className="flex flex-col gap-1.5 sm:gap-2">
                <Link href="/pricing" className="hover:text-gray-300 transition-colors">{t('footer.pricing')}</Link>
                <Link href="/privacy" className="hover:text-gray-300 transition-colors">{t('footer.privacy')}</Link>
                <Link href="/terms" className="hover:text-gray-300 transition-colors">{t('footer.terms')}</Link>
                <Link href="/login" className="hover:text-gray-300 transition-colors">{t('nav.login')}</Link>
              </div>
            </div>
            <div>
              <div className="font-bold text-sm text-gray-300 mb-3">{t('footer.contact')}</div>
              <div className="flex flex-col gap-1.5 sm:gap-2">
                <a href="mailto:pixel010dev@gmail.com" className="hover:text-gray-300 transition-colors">pixel010dev@gmail.com</a>
                <span>Guilherme Oliveira</span>
                <span>São Paulo, Brasil</span>
              </div>
            </div>
          </div>
          <div className="text-center text-xs text-gray-600 pt-5 sm:pt-6 border-t border-white/5">
            {t('footer.rights', { year: new Date().getFullYear() })}
          </div>
        </div>
      </footer>
    </div>
  );
}
