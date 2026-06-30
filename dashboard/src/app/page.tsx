'use client';

import Link from 'next/link';
import ScrollReveal from '@/components/ScrollReveal';
import Globe from '@/components/Globe';
import DashboardPreview from '@/components/DashboardPreview';
import AnimatedStats from '@/components/AnimatedStats';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { Button } from '@/components/Button';
import { useTranslations } from '@/lib/i18n';
import { useEffect, useState, useRef } from 'react';
import { IconPhone, IconBuilding, IconMail, IconCamera, IconWhatsApp, IconBot, IconChart, IconDownload } from '@/components/FeatureIcon';
import SocialProofWidget from '@/components/dashboard/SocialProofWidget';
import { socialProofMsgs } from '@/components/dashboard/dashboard-constants';
import LeadCaptureModal from '@/components/LeadCaptureModal';

const LIVE_LEADS = 18427;
const LIVE_USERS = 342;

function LiveCounter({ value, label }: { value: number; label: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        const dur = 2000;
        const step = Math.ceil(value / (dur / 16));
        const id = setInterval(() => {
          setCount(p => {
            const next = p + step;
            if (next >= value) { clearInterval(id); return value; }
            return next;
          });
        }, 16);
        observer.disconnect();
      }
    }, { threshold: 0.3 });
    observer.observe(el);
    return () => observer.disconnect();
  }, [value]);
  return (
    <div className="text-center">
      <span ref={ref} className="text-2xl sm:text-4xl font-extrabold text-white tabular-nums">{count.toLocaleString()}</span>
      <p className="text-xs sm:text-sm text-gray-400 mt-1">{label}</p>
    </div>
  );
}

export default function LandingPage() {
  const { t } = useTranslations();
  const [testimonialsList, setTestimonialsList] = useState<{ name: string; stars: number; text: string; role: string }[]>([]);
  const [testimonialPage, setTestimonialPage] = useState(0);
  const [proofIndex, setProofIndex] = useState(0);
  const [proofVisible, setProofVisible] = useState(true);
  const [exitVisible, setExitVisible] = useState(false);

  // Social proof cycling
  useEffect(() => {
    const cycle = setInterval(() => {
      setProofVisible(false);
      setTimeout(() => {
        setProofIndex(i => (i + 1) % socialProofMsgs.length);
        setProofVisible(true);
      }, 800);
    }, 6000);
    return () => clearInterval(cycle);
  }, []);

  // Exit intent
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (e.clientY <= 5 && !localStorage.getItem('geoleads_exit_dismissed')) {
        setExitVisible(true);
      }
    };
    document.addEventListener('mouseleave', handler);
    return () => document.removeEventListener('mouseleave', handler);
  }, []);

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
        { stars: 5, text: 'Já testei 4 ferramentas diferentes. Nenhuma entrega tantos dados quanto o GeoLeads. O enriquecimento com CNPJ e Instagram é diferencial.', name: 'Fernanda Lima', role: 'Marketing B2B' },
        { stars: 5, text: 'Em 2 dias extraí 200 leads de imobiliárias na minha cidade. Fechei contrato com 5 em uma semana. Recomendo de olhos fechados.', name: 'Carlos Andrade', role: 'Corretor Imóveis' },
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
            url: process.env.NEXT_PUBLIC_APP_URL || 'https://geoleads-production-6583.up.railway.app',
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
            <Link href="/pricing" className="nav-link hidden sm:inline-flex px-2.5 py-1.5 rounded-full text-gray-300 hover:text-white transition-colors font-medium">
              {t('nav.pricing')}
            </Link>
            <Link href="/login" className="nav-link hidden sm:inline-flex px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-gray-200 hover:text-white transition-all font-medium">
              {t('nav.login')}
            </Link>
            <Button href="/login" size="sm" className="text-xs sm:text-sm">
              {t('nav.signup')}
            </Button>
          </div>
        </div>
      </nav>

      <main className="relative z-10">
        {/* EXIT INTENT POPUP */}
        {exitVisible && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={() => { setExitVisible(false); try { localStorage.setItem('geoleads_exit_dismissed', 'true'); } catch {} }}>
            <div className="app-card w-full max-w-md p-6 sm:p-8 rounded-[2rem] bg-gradient-to-b from-white/[0.08] to-black/60 border border-blue-500/30 shadow-2xl relative overflow-hidden text-center" onClick={e => e.stopPropagation()}>
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-500 to-red-500" />
              <span className="text-4xl mb-3 block">⏳</span>
              <h2 className="text-xl font-bold mb-2">Espera! Nao va ainda.</h2>
              <p className="text-sm text-gray-400 mb-5">Teste o GeoLeads gratuitamente agora mesmo. Sao <b>10 tokens</b> para extrair seus primeiros leads sem pagar nada.</p>
              <Button href="/login" size="lg" className="w-full bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-400 hover:to-indigo-400 text-black shadow-none" onClick={() => { try { localStorage.setItem('geoleads_exit_dismissed', 'true'); } catch {} }}>
                Quero Testar Gratis
              </Button>
              <button onClick={() => { setExitVisible(false); try { localStorage.setItem('geoleads_exit_dismissed', 'true'); } catch {} }}
                className="mt-3 text-xs text-gray-500 hover:text-gray-400 cursor-pointer">Nao, obrigado</button>
            </div>
          </div>
        )}

        <section className="app-container pt-12 sm:pt-24 pb-6 sm:pb-12">
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
                <Button href="/login" size="lg" className="w-full sm:w-auto cta-glow">
                  {t('hero.cta')} — {t('hero.footnote')}
                </Button>
                <Button href="/pricing" variant="secondary" size="lg" className="w-full sm:w-auto">
                  {t('hero.ctaSecondary')}
                </Button>
              </div>
              <div className="flex items-center justify-center gap-4 mt-5 text-xs text-gray-500">
                <span className="flex items-center gap-1">✅ Sem cartao</span>
                <span className="flex items-center gap-1">🔒 Pagamento seguro</span>
                <span className="flex items-center gap-1">⚡ Ativacao instantanea</span>
              </div>
            </div>
          </ScrollReveal>
        </section>

        {/* TRUST BAR */}
        <section className="app-container pb-8">
          <ScrollReveal>
            <div className="max-w-4xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6 p-5 sm:p-6 rounded-2xl bg-white/[0.03] border border-white/5">
              <LiveCounter value={LIVE_LEADS} label="Leads extraidos" />
              <LiveCounter value={140} label="Cidades disponiveis" />
              <LiveCounter value={34} label="Nichos segmentados" />
              <LiveCounter value={LIVE_USERS} label="Usuarios ativos" />
            </div>
          </ScrollReveal>
        </section>

        {/* COMPARISON SECTION */}
        <section className="app-container py-12 sm:py-16">
          <ScrollReveal>
            <div className="max-w-4xl mx-auto">
              <div className="text-center mb-8 sm:mb-10">
                <span className="badge-purple mb-3">Antes vs Depois</span>
                <h2 className="text-xl sm:text-3xl font-extrabold tracking-tight mt-3">O que muda com o GeoLeads?</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="app-card p-5 sm:p-6 rounded-2xl border border-red-500/20 bg-red-500/5">
                  <h3 className="text-base sm:text-lg font-bold mb-4 flex items-center gap-2"><span className="text-red-400">✕</span> Sem ferramenta</h3>
                  <ul className="space-y-2.5 text-sm text-gray-400">
                    <li className="flex items-start gap-2"><span className="text-red-400 mt-0.5 shrink-0">✕</span> <span>Horas catando lead por lead no Maps</span></li>
                    <li className="flex items-start gap-2"><span className="text-red-400 mt-0.5 shrink-0">✕</span> <span>Planilha infinita no Excel</span></li>
                    <li className="flex items-start gap-2"><span className="text-red-400 mt-0.5 shrink-0">✕</span> <span>So telefone — sem email, CNPJ ou redes</span></li>
                    <li className="flex items-start gap-2"><span className="text-red-400 mt-0.5 shrink-0">✕</span> <span>Abordagem manual um por um no WhatsApp</span></li>
                    <li className="flex items-start gap-2"><span className="text-red-400 mt-0.5 shrink-0">✕</span> <span>Zero acompanhamento de leads</span></li>
                  </ul>
                </div>
                <div className="app-card p-5 sm:p-6 rounded-2xl border border-green-500/20 bg-green-500/5">
                  <h3 className="text-base sm:text-lg font-bold mb-4 flex items-center gap-2"><span className="text-green-400">✓</span> Com GeoLeads</h3>
                  <ul className="space-y-2.5 text-sm text-gray-300">
                    <li className="flex items-start gap-2"><span className="text-green-400 mt-0.5 shrink-0">✓</span> <span><b>100 leads em 5 minutos</b> — automático</span></li>
                    <li className="flex items-start gap-2"><span className="text-green-400 mt-0.5 shrink-0">✓</span> <span>CRM completo com tags e notas</span></li>
                    <li className="flex items-start gap-2"><span className="text-green-400 mt-0.5 shrink-0">✓</span> <span>Telefone + Email + CNPJ + Instagram + TikTok</span></li>
                    <li className="flex items-start gap-2"><span className="text-green-400 mt-0.5 shrink-0">✓</span> <span>Disparo assistido no WhatsApp com fila inteligente</span></li>
                    <li className="flex items-start gap-2"><span className="text-green-400 mt-0.5 shrink-0">✓</span> <span>Funil de vendas com AutoVendas 24h</span></li>
                  </ul>
                </div>
              </div>
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
                  <div className="glow-card card-border-glow app-card p-6 sm:p-8 rounded-2xl sm:rounded-[2rem] text-center group hover:border-blue-500/40 transition-all duration-500"
                    onMouseMove={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      e.currentTarget.style.setProperty('--mouse-x', `${e.clientX - rect.left}px`);
                      e.currentTarget.style.setProperty('--mouse-y', `${e.clientY - rect.top}px`);
                    }}
                  >
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
                  <div className="glow-card card-border-glow app-card p-6 sm:p-8 rounded-2xl sm:rounded-[2rem] text-center group hover:border-blue-500/40 transition-all duration-500"
                    onMouseMove={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      e.currentTarget.style.setProperty('--mouse-x', `${e.clientX - rect.left}px`);
                      e.currentTarget.style.setProperty('--mouse-y', `${e.clientY - rect.top}px`);
                    }}
                  >
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
                  <div className="glow-card card-border-glow app-card p-6 sm:p-8 rounded-2xl sm:rounded-[2rem] text-center group hover:border-blue-500/40 transition-all duration-500"
                    onMouseMove={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      e.currentTarget.style.setProperty('--mouse-x', `${e.clientX - rect.left}px`);
                      e.currentTarget.style.setProperty('--mouse-y', `${e.clientY - rect.top}px`);
                    }}
                  >
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
                      <div className="glow-card card-border-glow app-card p-4 sm:p-5 rounded-xl sm:rounded-2xl hover:border-white/20 transition-all h-full flex flex-col items-start"
                        onMouseMove={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          e.currentTarget.style.setProperty('--mouse-x', `${e.clientX - rect.left}px`);
                          e.currentTarget.style.setProperty('--mouse-y', `${e.clientY - rect.top}px`);
                        }}
                      >
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
              <div className="overflow-hidden">
                <div
                  className="testimonial-track"
                  style={{ transform: `translateX(-${testimonialPage * 100}%)` }}
                >
                  {testimonialsList.map((t, i) => (
                    <div key={i} className="min-w-full sm:min-w-[33.333%] px-2">
                      <div className="app-card p-5 sm:p-6 rounded-xl sm:rounded-2xl flex flex-col h-full">
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
                    </div>
                  ))}
                </div>
              </div>
              {testimonialsList.length > 3 && (
                <div className="flex items-center justify-center gap-2 mt-6">
                  {Array.from({ length: Math.ceil(testimonialsList.length / 3) }).map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setTestimonialPage(i)}
                      className={`testimonial-dot ${i === testimonialPage ? 'active' : ''}`}
                      aria-label={`Página ${i + 1}`}
                    />
                  ))}
                </div>
              )}
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
                  <details key={i} className="accordion-premium app-card p-4 sm:p-5 rounded-xl sm:rounded-2xl group open:border-blue-500/30 transition-all cursor-pointer">
                    <summary className="text-sm sm:text-base font-bold text-gray-200 group-open:text-blue-300 transition-colors list-none flex items-center justify-between gap-3">
                      {item.q}
                      <span className="text-blue-400 text-lg shrink-0 group-open:rotate-180 transition-transform">▾</span>
                    </summary>
                    <div className="accordion-content">
                      <div>
                        <p className="mt-3 text-xs sm:text-sm text-gray-400 leading-relaxed border-t border-white/5 pt-3">{item.a}</p>
                      </div>
                    </div>
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
                <div className="flex flex-wrap items-center justify-center gap-3 mb-6">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-bold">
                    🛡️ Garantia 7 dias
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-300 text-xs font-bold">
                    ⚡ Ativacao instantanea
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 text-xs font-bold">
                    🔒 Sem risco
                  </span>
                </div>
                <Button href="/login" size="lg" className="cta-glow">
                  {t('cta.button')}
                </Button>
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
      <SocialProofWidget proofIndex={proofIndex} proofVisible={proofVisible} />
      <LeadCaptureModal />
    </div>
  );
}
