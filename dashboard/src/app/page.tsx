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
  const [liveFeed, setLiveFeed] = useState<{ name: string; city: string; qty: string } | null>(null);

  // Live lead extraction feed (mock, cycles through realistic examples)
  useEffect(() => {
    const feedItems = [
      { name: 'Carlos M.', city: 'São Paulo', qty: '47 leads' },
      { name: 'Ana J.', city: 'Rio de Janeiro', qty: '32 leads' },
      { name: 'Lucas F.', city: 'Belo Horizonte', qty: '28 leads' },
      { name: 'Patrícia L.', city: 'Curitiba', qty: '53 leads' },
      { name: 'Ricardo T.', city: 'Brasília', qty: '19 leads' },
      { name: 'Fernanda R.', city: 'Salvador', qty: '41 leads' },
    ];
    let idx = 0;
    const showFeed = () => {
      setLiveFeed(feedItems[idx % feedItems.length]);
      idx++;
      setTimeout(() => setLiveFeed(null), 5000);
    };
    showFeed();
    const interval = setInterval(showFeed, 12000);
    return () => clearInterval(interval);
  }, []);

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
        { stars: 5, text: 'Triplicou minha prospecção. Antes eu passava 20 horas por semana catando leads manualmente. Agora em 30 minutos tenho uma lista pronta com telefone, site e WhatsApp.', name: 'Ricardo Silva', role: 'Diretor de Vendas' },
        { stars: 5, text: 'Uso pra encontrar distribuidores pro meu e-commerce. Em 1 semana fechei parceria com 3 lojas. O WhatsApp direto e os dados completos fazem toda diferença.', name: 'Juliana Costa', role: 'E-commerce B2B' },
        { stars: 5, text: 'O chatbot WhatsApp respondeu 80% das perguntas sozinho no primeiro mês. Economizei horas de atendimento e ainda fechei 4 contratos.', name: 'André Oliveira', role: 'Agência Digital' },
        { stars: 5, text: 'Já testei 4 ferramentas diferentes. Nenhuma entrega tantos dados quanto o GeoLeads. Telefone, site e endereço tudo validado pelo Google.', name: 'Fernanda Lima', role: 'Marketing B2B' },
        { stars: 5, text: 'Em 2 dias extraí 200 leads de imobiliárias na minha cidade. Fechei contrato com 5 em uma semana. Recomendo de olhos fechados.', name: 'Carlos Andrade', role: 'Corretor Imóveis' },
      ];

      const list = realTestimonials && realTestimonials.length > 0
        ? realTestimonials.map(t => ({ name: t.name, stars: t.rating, text: t.feedback || '', role: t.role || '' })).filter(t => t.text)
        : fallback;

      setTestimonialsList(list);
    }
    fetchTestimonials();
  }, []);

  // Auto-rotate testimonials
  useEffect(() => {
    if (testimonialsList.length <= 3) return;
    const maxPage = Math.ceil(testimonialsList.length / 3) - 1;
    const interval = setInterval(() => {
      setTestimonialPage(p => (p >= maxPage ? 0 : p + 1));
    }, 5000);
    return () => clearInterval(interval);
  }, [testimonialsList.length]);

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

  const pricingPlans = [
    { name: 'Teste', price: 'Grátis', tokens: '5 leads', featured: false, cta: 'Criar Conta', href: '/login' },
    { name: 'Starter', price: 'R$9,90', tokens: '300 leads/mês', featured: true, cta: 'Começar Agora', href: '/pricing' },
    { name: 'Pro', price: 'R$29,90', tokens: '1.000 leads/mês', featured: false, cta: 'Assinar', href: '/pricing' },
    { name: 'Agency', price: 'R$67,90', tokens: '3.000 leads/mês', featured: false, cta: 'Assinar', href: '/pricing' },
  ];

  const featureProducts = [
    { name: 'Extrator Maps', desc: 'Extraia dados de qualquer nicho do Google Maps automaticamente', icon: '🔍', gradient: 'from-blue-600 to-indigo-600' },
    { name: 'CRM', desc: 'Gerencie leads em estágios com tags, notas e kanban visual', icon: '📋', gradient: 'from-purple-600 to-pink-600' },
    { name: 'WhatsApp', desc: 'Disparo assistido com fila inteligente e templates prontos', icon: '💬', gradient: 'from-green-600 to-emerald-600' },
    { name: 'IA', desc: 'Chatbot automático que qualifica e responde leads 24h', icon: '🤖', gradient: 'from-cyan-600 to-blue-600' },
    { name: 'AutoVendas', desc: 'Funil automatizado que vende por você enquanto dorme', icon: '⚡', gradient: 'from-amber-600 to-orange-600' },
  ];

  const steps = [
    { icon: '🔍', number: '01', title: 'Busque', desc: 'Escolha o nicho e a cidade. O motor varre o Google Maps em segundos.' },
    { icon: '📥', number: '02', title: 'Extraia', desc: 'Receba telefone, WhatsApp, site, endereço e categoria — direto do Google Maps.' },
    { icon: '🚀', number: '03', title: 'Venda', desc: 'Dispare mensagens no WhatsApp com um clique ou use o chatbot IA.' },
  ];

  return (
    <div className="min-h-screen bg-black text-white font-sans selection:bg-blue-500/30 relative overflow-x-hidden">
      {/* Animated background gradient */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-gradient-to-br from-blue-600/10 to-indigo-600/5 blur-[120px] rounded-full animate-pulse" style={{ animationDuration: '8s' }} />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-gradient-to-tl from-indigo-600/8 to-blue-600/3 blur-[120px] rounded-full animate-pulse" style={{ animationDuration: '10s', animationDelay: '2s' }} />
        <div className="absolute top-[40%] left-[50%] translate-x-[-50%] w-[40%] h-[40%] bg-gradient-to-r from-cyan-600/5 to-blue-600/5 blur-[100px] rounded-full animate-pulse" style={{ animationDuration: '12s', animationDelay: '4s' }} />
        {/* Grid pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.015)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.015)_1px,transparent_1px)] bg-[size:60px_60px] [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_70%)]" />
      </div>

      {/* Schema markup */}
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

      {/* NAV */}
      <nav className="border-b border-white/[0.04] bg-black/60 backdrop-blur-2xl sticky top-0 z-50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 sm:gap-3 cursor-default">
            <Globe size={28} />
            <span className="font-extrabold text-lg sm:text-xl tracking-tight bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
              Geo<span className="text-blue-400">Leads</span>
            </span>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-3 text-xs sm:text-sm">
            <LanguageSwitcher />
            <Link href="/pricing" className="hidden sm:inline-flex px-3 py-1.5 text-gray-400 hover:text-white transition-colors font-medium">
              {t('nav.pricing')}
            </Link>
            <Link href="/login" className="hidden sm:inline-flex px-4 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-gray-300 hover:text-white transition-all font-medium">
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
            <div className="w-full max-w-md p-6 sm:p-8 rounded-2xl bg-zinc-900 border border-blue-500/30 shadow-2xl relative overflow-hidden text-center animate-scale-in" onClick={e => e.stopPropagation()}>
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-500 to-red-500" />
              <span className="text-4xl mb-3 block">🔥</span>
              <h2 className="text-xl font-bold mb-2">Nao vai perder essa oportunidade!</h2>
              <p className="text-sm text-gray-400 mb-3">Teste o GeoLeads agora mesmo e receba <b className="text-blue-300">10 tokens gratuitos</b> para extrair seus primeiros leads.</p>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-bold mb-5">
                🛡️ Risco zero — cancele quando quiser
              </div>
              <Button href="/login" size="lg" className="w-full relative overflow-hidden group/btn" onClick={() => { try { localStorage.setItem('geoleads_exit_dismissed', 'true'); } catch {} }}>
                <span className="absolute inset-0 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-600 bg-[length:200%_100%] animate-gradient-x transition-opacity" style={{ animationDuration: '4s' }} />
                <span className="relative">Quero meus 10 Leads Gratis</span>
              </Button>
              <button onClick={() => { setExitVisible(false); try { localStorage.setItem('geoleads_exit_dismissed', 'true'); } catch {} }}
                className="mt-3 text-xs text-gray-600 hover:text-gray-400 cursor-pointer transition-colors">Nao, obrigado. Talvez depois.</button>
              <p className="text-[10px] text-gray-700 mt-2">Sem cartao de credito • Ativacao instantanea • 7 dias de garantia</p>
            </div>
          </div>
        )}

        {/* ===== HERO ===== */}
        <section className="relative overflow-hidden">
          {/* Hero gradient animation */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[max(600px,60vw)] h-[500px] bg-gradient-to-b from-blue-500/15 via-indigo-500/10 to-transparent blur-[100px] rounded-full animate-gradient-x" style={{ animationDuration: '6s' }} />
            <div className="absolute top-[5%] right-[10%] w-[300px] h-[300px] bg-gradient-to-br from-cyan-500/10 to-blue-500/5 blur-[80px] rounded-full animate-float" />
          </div>

          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-20 sm:pt-28 pb-10 sm:pb-16">
            <ScrollReveal>
              <div className="max-w-4xl mx-auto text-center relative">
                {/* Live badge */}
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-500/[0.07] border border-blue-500/15 text-blue-300 text-xs sm:text-sm font-medium mb-6 sm:mb-8">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-400" />
                  </span>
                  {t('hero.badge').split('{count}')[0]}
                  <span className="text-blue-200 font-extrabold tabular-nums">{(LIVE_LEADS).toLocaleString()}+</span>
                  {t('hero.badge').split('{count}')[1]}
                </div>

                {/* Main headline */}
                <h1 className="text-[clamp(2rem,7vw,4.5rem)] font-extrabold tracking-tight leading-[1.05] mb-5">
                  {t('hero.title').split(t('hero.titleHighlight'))[0]}
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-cyan-300 to-indigo-400">
                    {t('hero.titleHighlight')}
                  </span>
                  {t('hero.title').split(t('hero.titleHighlight'))[1]}
                </h1>

                {/* Subtitle */}
                <p className="text-base sm:text-lg md:text-xl text-gray-400 max-w-2xl mx-auto leading-relaxed mb-8 sm:mb-10">
                  {t('hero.subtitle')}
                </p>

                {/* CTAs */}
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
                  <Button href="/login" size="lg" className="w-full sm:w-auto text-base px-10 relative overflow-hidden group">
                    <span className="absolute inset-0 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-600 bg-[length:200%_100%] animate-gradient-x group-hover:opacity-90 transition-opacity" style={{ animationDuration: '4s' }} />
                    <span className="relative">{t('hero.cta')}</span>
                  </Button>
                  <Button href="/pricing" variant="secondary" size="lg" className="w-full sm:w-auto text-base border-white/10 hover:border-white/20">
                    {t('hero.ctaSecondary')}
                  </Button>
                </div>

                {/* Urgency microcopy */}
                <p className="text-xs sm:text-sm text-emerald-400/70 mt-3 flex items-center justify-center gap-1.5">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
                  </span>
                  <span><b className="text-emerald-300">{LIVE_LEADS.toLocaleString()}+</b> leads extraídos hoje</span>
                </p>

                {/* Trust badges */}
                <div className="flex items-center justify-center gap-4 sm:gap-6 mt-6 text-xs sm:text-sm text-gray-500">
                  <span className="flex items-center gap-1.5 text-gray-400">
                    <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                    Sem cartão
                  </span>
                  <span className="flex items-center gap-1.5 text-gray-400">
                    <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                    Pagamento seguro
                  </span>
                  <span className="flex items-center gap-1.5 text-gray-400">
                    <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                    Ativação instantânea
                  </span>
                </div>
              </div>
            </ScrollReveal>
          </div>
        </section>

        {/* ===== STATS BAR ===== */}
        <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pb-8 sm:pb-12">
          <ScrollReveal>
            <div className="max-w-5xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-px bg-white/[0.04] rounded-2xl overflow-hidden border border-white/[0.04]">
              <div className="bg-black/60 backdrop-blur-sm p-5 sm:p-8">
                <LiveCounter value={LIVE_LEADS} label="Leads extraídos" />
              </div>
              <div className="bg-black/60 backdrop-blur-sm p-5 sm:p-8">
                <LiveCounter value={140} label="Cidades disponíveis" />
              </div>
              <div className="bg-black/60 backdrop-blur-sm p-5 sm:p-8">
                <LiveCounter value={34} label="Nichos segmentados" />
              </div>
              <div className="bg-black/60 backdrop-blur-sm p-5 sm:p-8">
                <LiveCounter value={LIVE_USERS} label="Usuários ativos" />
              </div>
            </div>
          </ScrollReveal>
        </section>

        {/* ===== HOW IT WORKS ===== */}
        <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 sm:py-24" id="como-funciona">
          <ScrollReveal>
            <div className="max-w-5xl mx-auto">
              {/* Section header */}
              <div className="text-center mb-12 sm:mb-16">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-500/[0.07] border border-indigo-500/15 text-indigo-300 text-xs sm:text-sm font-medium mb-4">
                  <span className="text-indigo-400">⚡</span>
                  {t('howItWorks.title')}
                </div>
                <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight mt-4 bg-gradient-to-b from-white to-gray-400 bg-clip-text text-transparent">
                  {t('howItWorks.subtitle')}
                </h2>
                <p className="text-gray-500 text-sm sm:text-base mt-3 max-w-lg mx-auto">Do Google Maps ao WhatsApp em menos de 5 minutos. Sem planilhas, sem complicação.</p>
              </div>

              {/* Desktop progress line */}
              <div className="hidden sm:flex items-center justify-between mb-10 max-w-2xl mx-auto relative">
                <div className="absolute left-0 right-0 top-1/2 h-0.5 bg-gradient-to-r from-blue-500/20 via-blue-500/40 to-indigo-500/20 -translate-y-1/2" />
                {steps.map((_, i) => (
                  <div key={i} className="relative z-10 flex flex-col items-center gap-2">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all duration-500 ${
                      i === 0 ? 'bg-blue-500/20 border-blue-400 text-blue-300 shadow-[0_0_15px_rgba(59,130,246,0.3)]' :
                      i === 1 ? 'bg-indigo-500/20 border-indigo-400 text-indigo-300' :
                      'bg-purple-500/20 border-purple-400 text-purple-300'
                    }`}>
                      {i + 1}
                    </div>
                    <span className={`text-[10px] font-bold uppercase tracking-wider ${
                      i === 0 ? 'text-blue-400' : i === 1 ? 'text-indigo-400' : 'text-purple-400'
                    }`}>
                      {i === 0 ? 'Busca' : i === 1 ? 'Extrai' : 'Vende'}
                    </span>
                  </div>
                ))}
              </div>

              {/* Steps grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
                {steps.map((step, i) => (
                  <ScrollReveal key={i} delay={i * 150}>
                    <div className="group relative p-6 sm:p-8 rounded-2xl bg-white/[0.02] border border-white/[0.06] hover:border-blue-500/30 transition-all duration-500">
                      {/* Hover glow */}
                      <div className="absolute inset-0 rounded-2xl bg-gradient-to-b from-blue-500/0 via-blue-500/0 to-blue-500/0 group-hover:from-blue-500/[0.02] group-hover:via-blue-500/[0.02] transition-all duration-500 pointer-events-none" />

                      <div className="relative">
                        {/* Step icon + number */}
                        <div className="flex items-center gap-3 mb-5">
                          <span className="text-4xl">{step.icon}</span>
                          <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${
                            i === 0 ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' :
                            i === 1 ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400' :
                            'bg-purple-500/10 border-purple-500/20 text-purple-400'
                          }`}>
                            Passo {i + 1}
                          </span>
                        </div>

                        <h3 className="text-lg sm:text-xl font-bold text-white mb-2">{step.title}</h3>
                        <p className="text-sm text-gray-400 leading-relaxed mb-4">{step.desc}</p>

                        {/* Time estimate per step */}
                        <div className="flex items-center gap-1.5 text-[11px] text-gray-600">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          {i === 0 ? '~30 segundos' : i === 1 ? '~2 minutos' : '~1 minuto'}
                        </div>
                      </div>
                    </div>
                  </ScrollReveal>
                ))}
              </div>

              {/* Mobile CTA in how-it-works */}
              <div className="text-center mt-10 sm:hidden">
                <Button href="/login" size="md" className="w-full max-w-xs">
                  {t('hero.cta')}
                </Button>
              </div>
            </div>
          </ScrollReveal>
        </section>

        {/* ===== DASHBOARD PREVIEW ===== */}
        <DashboardPreview />

        {/* ===== FEATURES PRODUCTS ===== */}
        <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
          <ScrollReveal>
            <div className="max-w-5xl mx-auto">
              <div className="text-center mb-12 sm:mb-16">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-purple-500/[0.07] border border-purple-500/15 text-purple-300 text-xs sm:text-sm font-medium mb-4">
                  <span className="text-purple-400">🛠️</span>
                  {t('tools.title')}
                </div>
                <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight mt-4 bg-gradient-to-b from-white to-gray-400 bg-clip-text text-transparent">
                  {t('tools.subtitle')}
                </h2>
              </div>

              {/* Feature product cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4 mb-12 sm:mb-16">
                {featureProducts.map((fp, i) => (
                  <ScrollReveal key={i} delay={i * 80}>
                    <div className="group relative p-5 sm:p-6 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:border-blue-500/30 transition-all duration-300 text-center h-full">
                      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${fp.gradient} bg-opacity-20 flex items-center justify-center mx-auto mb-3 sm:mb-4 text-2xl group-hover:scale-110 transition-transform duration-300`}>
                        {fp.icon}
                      </div>
                      <h3 className="font-bold text-sm sm:text-base text-white mb-1.5">{fp.name}</h3>
                      <p className="text-xs sm:text-sm text-gray-500 leading-relaxed">{fp.desc}</p>
                    </div>
                  </ScrollReveal>
                ))}
              </div>

              {/* Original feature grid */}
              <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                {features.map((f, i) => {
                  const Icon = f.iconSvg;
                  return (
                    <ScrollReveal key={i} delay={i * 60}>
                      <div className="group relative p-4 sm:p-5 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:border-white/15 transition-all h-full flex flex-col items-start"
                        onMouseMove={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          e.currentTarget.style.setProperty('--mouse-x', `${e.clientX - rect.left}px`);
                          e.currentTarget.style.setProperty('--mouse-y', `${e.clientY - rect.top}px`);
                        }}
                      >
                        {/* Hover spotlight */}
                        <div className="absolute inset-0 rounded-xl bg-[radial-gradient(circle_at_var(--mouse-x,50%)_var(--mouse-y,50%),rgba(59,130,246,0.08),transparent_60%)] opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                        {Icon && <Icon className="w-7 h-7 sm:w-8 sm:h-8 mb-2 sm:mb-3 relative" />}
                        <h3 className="font-bold text-xs sm:text-sm mb-1 text-white relative">{f.title}</h3>
                        <p className="text-[11px] sm:text-xs text-gray-500 leading-relaxed relative">{f.desc}</p>
                      </div>
                    </ScrollReveal>
                  );
                })}
              </div>
            </div>
          </ScrollReveal>
        </section>

        {/* ===== ANIMATED STATS ===== */}
        <AnimatedStats />

        {/* ===== PRICING PREVIEW ===== */}
        <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
          <ScrollReveal>
            <div className="max-w-5xl mx-auto">
              <div className="text-center mb-12 sm:mb-16">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-500/[0.07] border border-blue-500/15 text-blue-300 text-xs sm:text-sm font-medium mb-4">
                  <span className="text-blue-400">💰</span>
                  {t('pricing.title')}
                </div>
                <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight mt-4 bg-gradient-to-b from-white to-gray-400 bg-clip-text text-transparent">
                  {t('pricing.subtitle')}
                </h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
                {pricingPlans.map((plan, i) => (
                  <ScrollReveal key={i} delay={i * 100}>
                    <div className={`relative group p-6 sm:p-7 rounded-2xl border transition-all duration-300 ${
                      plan.featured
                        ? 'bg-gradient-to-b from-blue-600/[0.12] to-indigo-600/[0.06] border-blue-500/30 shadow-[0_0_30px_-5px_rgba(59,130,246,0.15)]'
                        : 'bg-white/[0.02] border-white/[0.06] hover:border-white/15'
                    }`}>
                      {plan.featured && (
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-[10px] font-bold tracking-wider uppercase">
                          Mais Popular
                        </div>
                      )}
                      <div className="mb-4 sm:mb-5">
                        <h3 className="text-sm font-semibold text-gray-300 mb-1">{plan.name}</h3>
                        <div className="flex items-baseline gap-1">
                          <span className="text-3xl sm:text-4xl font-extrabold text-white">{plan.price}</span>
                          {plan.price !== 'Grátis' && <span className="text-sm text-gray-500">/mês</span>}
                        </div>
                        <p className="text-xs text-gray-500 mt-1">{plan.tokens}</p>
                      </div>
                      <Button
                        href={plan.href}
                        variant={plan.featured ? 'primary' : 'secondary'}
                        size="md"
                        className="w-full text-sm"
                      >
                        {plan.cta}
                      </Button>
                    </div>
                  </ScrollReveal>
                ))}
              </div>

              <div className="text-center mt-6">
                <Link href="/pricing" className="inline-flex items-center gap-1.5 text-sm text-blue-400 hover:text-blue-300 transition-colors font-medium">
                  Ver comparação completa
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </Link>
              </div>
            </div>
          </ScrollReveal>
        </section>

        {/* ===== TESTIMONIALS ===== */}
        <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
          <ScrollReveal>
            <div className="max-w-5xl mx-auto">
              <div className="text-center mb-12 sm:mb-16">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/[0.07] border border-amber-500/15 text-amber-300 text-xs sm:text-sm font-medium mb-4">
                  <span className="text-amber-400">⭐</span>
                  {t('testimonials.title')}
                </div>
                <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight mt-4 bg-gradient-to-b from-white to-gray-400 bg-clip-text text-transparent">
                  {t('testimonials.subtitle')}
                </h2>
              </div>

              <div className="overflow-hidden">
                <div
                  className="testimonial-track"
                  style={{ transform: `translateX(-${testimonialPage * 100}%)` }}
                >
                  {testimonialsList.map((t, i) => (
                    <div key={i} className="min-w-full sm:min-w-[33.333%] px-2">
                      <div className="p-5 sm:p-6 rounded-xl sm:rounded-2xl bg-white/[0.02] border border-white/[0.06] flex flex-col h-full hover:border-white/15 transition-all duration-300">
                        <div className="flex items-center gap-1 mb-3">
                          {Array.from({ length: 5 }).map((_, j) => (
                            <span key={j} className={j < t.stars ? 'text-amber-400' : 'text-gray-600'}>★</span>
                          ))}
                        </div>
                        <p className="text-sm text-gray-300 leading-relaxed flex-1">&ldquo;{t.text}&rdquo;</p>
                        <div className="mt-4 pt-4 border-t border-white/[0.04]">
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

        {/* ===== FAQ ===== */}
        <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
          <ScrollReveal>
            <div className="max-w-3xl mx-auto">
              <div className="text-center mb-12 sm:mb-16">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-500/[0.07] border border-blue-500/15 text-blue-300 text-xs sm:text-sm font-medium mb-4">
                  <span className="text-blue-400">❓</span>
                  {t('faq.title')}
                </div>
                <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight mt-4 bg-gradient-to-b from-white to-gray-400 bg-clip-text text-transparent">
                  {t('faq.subtitle')}
                </h2>
              </div>
              <div className="space-y-3 sm:space-y-4">
                {faq.map((item, i) => (
                  <details key={i} className="group p-4 sm:p-5 rounded-xl bg-white/[0.02] border border-white/[0.06] open:border-blue-500/30 transition-all cursor-pointer">
                    <summary className="text-sm sm:text-base font-semibold text-gray-300 group-open:text-blue-300 transition-colors list-none flex items-center justify-between gap-3">
                      {item.q}
                      <svg className="w-4 h-4 text-blue-400 shrink-0 group-open:rotate-180 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </summary>
                    <p className="mt-3 text-xs sm:text-sm text-gray-500 leading-relaxed border-t border-white/[0.04] pt-3">{item.a}</p>
                  </details>
                ))}
              </div>
            </div>
          </ScrollReveal>
        </section>

        {/* ===== COMPARISON SECTION ===== */}
        <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
          <ScrollReveal>
            <div className="max-w-4xl mx-auto">
              <div className="text-center mb-10 sm:mb-14">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/[0.07] border border-emerald-500/15 text-emerald-300 text-xs sm:text-sm font-medium mb-4">
                  <span className="text-emerald-400">📊</span>
                  Antes vs Depois
                </div>
                <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight mt-4 bg-gradient-to-b from-white to-gray-400 bg-clip-text text-transparent">
                  O que muda com o GeoLeads?
                </h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                <div className="p-5 sm:p-6 rounded-2xl bg-white/[0.02] border border-red-500/20 bg-gradient-to-b from-red-500/[0.04] to-transparent">
                  <h3 className="text-base sm:text-lg font-bold mb-4 flex items-center gap-2 text-red-300">
                    <span className="w-6 h-6 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 text-xs">✕</span>
                    Sem ferramenta
                  </h3>
                  <ul className="space-y-3 text-sm text-gray-500">
                    <li className="flex items-start gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-red-500/10 flex items-center justify-center text-red-400 text-xs shrink-0 mt-0.5">✕</span>
                      <span>Horas catando lead por lead no Maps</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-red-500/10 flex items-center justify-center text-red-400 text-xs shrink-0 mt-0.5">✕</span>
                      <span>Planilha infinita no Excel</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-red-500/10 flex items-center justify-center text-red-400 text-xs shrink-0 mt-0.5">✕</span>
                      <span>Só telefone — sem email, CNPJ ou redes</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-red-500/10 flex items-center justify-center text-red-400 text-xs shrink-0 mt-0.5">✕</span>
                      <span>Abordagem manual um por um no WhatsApp</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-red-500/10 flex items-center justify-center text-red-400 text-xs shrink-0 mt-0.5">✕</span>
                      <span>Zero acompanhamento de leads</span>
                    </li>
                  </ul>
                </div>
                <div className="p-5 sm:p-6 rounded-2xl bg-white/[0.02] border border-emerald-500/20 bg-gradient-to-b from-emerald-500/[0.04] to-transparent">
                  <h3 className="text-base sm:text-lg font-bold mb-4 flex items-center gap-2 text-emerald-300">
                    <span className="w-6 h-6 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 text-xs">✓</span>
                    Com GeoLeads
                  </h3>
                  <ul className="space-y-3 text-sm text-gray-300">
                    <li className="flex items-start gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400 text-xs shrink-0 mt-0.5">✓</span>
                      <span><b className="text-white">100 leads em 5 minutos</b> — automático</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400 text-xs shrink-0 mt-0.5">✓</span>
                      <span>CRM completo com tags e notas</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400 text-xs shrink-0 mt-0.5">✓</span>
                      <span>Telefone + Email + CNPJ + Instagram + TikTok</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400 text-xs shrink-0 mt-0.5">✓</span>
                      <span>Disparo assistido no WhatsApp com fila inteligente</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400 text-xs shrink-0 mt-0.5">✓</span>
                      <span>Funil de vendas com AutoVendas 24h</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </ScrollReveal>
        </section>

        {/* ===== CTA ===== */}
        <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
          <ScrollReveal>
            <div className="max-w-3xl mx-auto text-center">
              <div className="relative p-8 sm:p-14 rounded-3xl bg-gradient-to-b from-blue-600/[0.08] to-black/60 border border-blue-500/20 overflow-hidden group">
                {/* Glow effect */}
                <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-[400px] h-[200px] bg-blue-500/10 blur-[80px] rounded-full group-hover:bg-blue-500/20 transition-all duration-700" />
                <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-blue-500 to-transparent" />

                <span className="text-3xl sm:text-4xl mb-4 block relative">🚀</span>
                <h2 className="text-xl sm:text-4xl font-extrabold tracking-tight mb-3 sm:mb-4 relative">
                  {t('cta.title')}
                </h2>
                <p className="text-gray-400 max-w-md mx-auto mb-6 sm:mb-8 text-sm sm:text-base relative">
                  {t('cta.subtitle')}
                </p>
                <div className="flex flex-wrap items-center justify-center gap-3 mb-6 relative">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-bold">
                    🛡️ Garantia 7 dias
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-300 text-xs font-bold">
                    ⚡ Ativação instantânea
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 text-xs font-bold">
                    🔒 Sem risco
                  </span>
                </div>
                <div className="relative">
                  <Button href="/login" size="lg" className="relative overflow-hidden group/btn">
                    <span className="absolute inset-0 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-600 bg-[length:200%_100%] animate-gradient-x" style={{ animationDuration: '4s' }} />
                    <span className="relative">{t('cta.button')}</span>
                  </Button>
                </div>
                <p className="text-xs text-gray-500 mt-4 relative">
                  {t('cta.login').replace(t('nav.login'), '')}
                  <Link href="/login" className="text-blue-400 hover:text-blue-300 font-medium">{t('nav.login')}</Link>
                </p>
              </div>
            </div>
          </ScrollReveal>
        </section>
      </main>

      {/* ===== FOOTER ===== */}
      <footer className="border-t border-white/[0.04] bg-black/40">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-8 sm:gap-12 mb-8 sm:mb-10 text-xs sm:text-sm text-gray-500">
            <div className="col-span-2 sm:col-span-1">
              <div className="font-extrabold text-base sm:text-lg text-white mb-3 flex items-center gap-2">
                <Globe size={20} />
                Geo<span className="text-blue-400">Leads</span>
              </div>
              <p className="leading-relaxed text-gray-500 max-w-xs">{t('footer.description')}</p>
              <div className="flex items-center gap-3 mt-4">
                <a href="mailto:pixel010dev@gmail.com" className="text-gray-500 hover:text-white transition-colors" aria-label="Email">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </a>
              </div>
            </div>
            <div>
              <div className="font-semibold text-sm text-gray-300 mb-4">{t('footer.links')}</div>
              <div className="flex flex-col gap-2">
                <Link href="/pricing" className="hover:text-gray-300 transition-colors">{t('footer.pricing')}</Link>
                <Link href="/afiliados" className="hover:text-gray-300 transition-colors">Indique e Ganhe</Link>
                <Link href="/privacy" className="hover:text-gray-300 transition-colors">{t('footer.privacy')}</Link>
                <Link href="/terms" className="hover:text-gray-300 transition-colors">{t('footer.terms')}</Link>
                <Link href="/login" className="hover:text-gray-300 transition-colors">{t('nav.login')}</Link>
              </div>
            </div>
            <div>
              <div className="font-semibold text-sm text-gray-300 mb-4">{t('footer.contact')}</div>
              <div className="flex flex-col gap-2">
                <a href="mailto:pixel010dev@gmail.com" className="hover:text-gray-300 transition-colors">pixel010dev@gmail.com</a>
                <span className="text-gray-500">Guilherme Oliveira</span>
                <span className="text-gray-500">São Paulo, Brasil</span>
              </div>
            </div>
          </div>
          <div className="text-center text-xs text-gray-600 pt-6 sm:pt-8 border-t border-white/[0.04]">
            {t('footer.rights', { year: new Date().getFullYear() })}
          </div>
        </div>
      </footer>
      <SocialProofWidget proofIndex={proofIndex} proofVisible={proofVisible} />

      {/* Mobile sticky CTA bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 sm:hidden bg-gradient-to-t from-black via-black/95 to-transparent pt-8 pb-4 px-4 pointer-events-none">
        <div className="pointer-events-auto">
          <Button href="/login" size="md" className="w-full shadow-2xl shadow-blue-600/20">
            <span className="absolute inset-0 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-600 bg-[length:200%_100%] animate-gradient-x" style={{ animationDuration: '4s' }} />
            <span className="relative">{t('hero.cta')}</span>
          </Button>
        </div>
      </div>
      
      {/* Live feed notification */}
      {liveFeed && (
        <div className="fixed bottom-20 right-6 z-50 max-w-xs animate-slide-up">
          <div className="px-4 py-3 bg-gradient-to-r from-blue-600/20 to-indigo-600/20 border border-blue-500/20 rounded-xl backdrop-blur-xl shadow-2xl flex items-center gap-3">
            <div className="relative">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold">
                {liveFeed.name.charAt(0)}
              </div>
              <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-green-400 animate-ping" />
              <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-green-400" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-gray-300 font-medium leading-snug">
                <span className="text-white font-bold">{liveFeed.name}</span> acabou de extrair{' '}
                <span className="text-emerald-400 font-bold">{liveFeed.qty}</span>
              </p>
              <p className="text-[10px] text-gray-500">📍 {liveFeed.city} · agora mesmo</p>
            </div>
          </div>
        </div>
      )}
      
      <LeadCaptureModal />
    </div>
  );
}
