'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Globe from '@/components/Globe';
import { Button } from '@/components/Button';
import { supabase } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';

const COPY = {
  pageTitle: 'Programa de Indicação | GeoLeads',
  pageDescription: 'Ganhe tokens extras indicando o GeoLeads para amigos e colegas. Programa de afiliados com bônus automático.',
  nav: {
    geo: 'Geo',
    leads: 'Leads',
    pricing: 'Preços',
    login: 'Entrar',
    signup: 'Criar Conta',
  },
  hero: {
    badge: '🎁 Programa de Indicação',
    title: 'Indique e Ganhe',
    subtitle: 'Compartilhe o GeoLeads com amigos e colegas. Para cada amigo que fizer um plano pago, vocês dois ganham <strong>100 tokens extras</strong>.',
    cta: 'Quero Participar',
  },
  benefits: {
    title: 'Benefícios',
    items: [
      {
        icon: '🪙',
        title: '100 Tokens por Indicação',
        desc: 'Ganhe 100 tokens toda vez que um amigo assinar qualquer plano pago do GeoLeads.',
      },
      {
        icon: '⚡',
        title: 'Crédito Automático',
        desc: 'Assim que o pagamento do amigo for confirmado, os tokens caem na sua conta automaticamente. Sem burocracia.',
      },
      {
        icon: '♾️',
        title: 'Sem Limite de Indicações',
        desc: 'Indique quantas pessoas quiser. Não há limite máximo de tokens que você pode ganhar.',
      },
      {
        icon: '🎯',
        title: 'Link Único',
        desc: 'Seu link de indicação é gerado automaticamente. Compartilhe onde quiser — WhatsApp, email, redes sociais.',
      },
    ],
  },
  howItWorks: {
    title: 'Como Funciona',
    steps: [
      { icon: '1', title: 'Crie sua conta', desc: 'Cadastre-se no GeoLeads (é grátis para começar).' },
      { icon: '2', title: 'Copie seu link', desc: 'Acesse o dashboard e copie seu link exclusivo de indicação.' },
      { icon: '3', title: 'Compartilhe', desc: 'Envie o link para amigos, grupos de WhatsApp ou publique nas redes.' },
      { icon: '4', title: 'Ganhe tokens', desc: 'Quando alguém assinar pelo seu link, você ganha 100 tokens automaticamente.' },
    ],
  },
  commission: {
    title: 'Quanto Você Pode Ganhar',
    subtitle: 'Veja quantos tokens você acumula conforme indica mais pessoas:',
    rows: [
      { label: '1 indicação', tokens: '100 tokens' },
      { label: '5 indicações', tokens: '500 tokens' },
      { label: '10 indicações', tokens: '1.000 tokens' },
      { label: '50 indicações', tokens: '5.000 tokens' },
      { label: '100 indicações', tokens: '10.000 tokens' },
    ],
  },
  loggedIn: {
    title: 'Seu Link de Indicação',
    description: 'Copie o link abaixo e compartilhe com seus amigos:',
    copied: 'Copiado!',
    copyLink: 'Copiar Link',
    shareWhatsApp: 'Compartilhar no WhatsApp',
    shareWhatsAppMessage: '🎉 Acabei de ganhar tokens extras no GeoLeads! É uma ferramenta que extrai leads do Google Maps e dispara no WhatsApp automaticamente. Testa grátis: ',
  },
  loggedOut: {
    title: 'Participar do Programa',
    description: 'Crie sua conta grátis e comece a indicar agora mesmo.',
    login: 'Entrar',
    signup: 'Criar Conta Grátis',
  },
  faq: {
    title: 'FAQ',
    subtitle: 'Dúvidas Frequentes',
    items: [
      {
        q: 'Como sei se minha indicação foi registrada?',
        a: 'Quando alguém clica no seu link e cria uma conta, o sistema registra automaticamente. Você pode acompanhar suas indicações no dashboard, na aba "Indique".',
      },
      {
        q: 'Quando recebo os tokens?',
        a: 'Os 100 tokens são creditados automaticamente assim que o pagamento do seu amigo for confirmado pelo sistema (Mercado Pago).',
      },
      {
        q: 'Meu amigo também ganha tokens?',
        a: 'Sim! Quem se cadastra pelo seu link também começa com 5 leads grátis e pode ativar qualquer plano pago para continuar usando.',
      },
      {
        q: 'Tem limite de indicações?',
        a: 'Não. Você pode indicar quantas pessoas quiser e ganhar 100 tokens por cada amigo que assinar um plano pago.',
      },
      {
        q: 'Posso indicar para qualquer pessoa?',
        a: 'Sim! Qualquer pessoa que ainda não tenha conta no GeoLeads pode usar seu link. Vale para amigos, colegas de trabalho, grupos de WhatsApp, redes sociais e muito mais.',
      },
      {
        q: 'Os tokens têm validade?',
        a: 'Os tokens ganhos por indicação não expiram. Use-os para realizar extrações de leads quando quiser, dentro do seu plano atual.',
      },
    ],
  },
  footer: {
    description: 'Motor de extração de leads B2B. Encontre clientes no Google Maps, WhatsApp e redes sociais.',
    links: 'Links',
    pricing: 'Preços',
    privacy: 'Privacidade',
    terms: 'Termos',
    contact: 'Contato',
    rights: '© {year} GeoLeads. Todos os direitos reservados.',
  },
};

export default function AfiliadosPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    document.title = COPY.pageTitle;
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user || null);
      setLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });
    return () => listener?.subscription?.unsubscribe();
  }, []);

  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'description';
    meta.content = COPY.pageDescription;
    document.head.appendChild(meta);
    return () => { document.head.removeChild(meta); };
  }, []);

  const referralUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/login?ref=${user?.id || ''}`
    : '';

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(referralUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
      const input = document.querySelector<HTMLInputElement>('#referral-link-input');
      if (input) { input.select(); document.execCommand('copy'); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    }
  };

  return (
    <div className="min-h-screen bg-black text-white font-sans selection:bg-blue-500/30 relative overflow-x-hidden">
      {/* Animated background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-gradient-to-br from-amber-600/10 to-orange-600/5 blur-[120px] rounded-full animate-pulse" style={{ animationDuration: '8s' }} />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-gradient-to-tl from-orange-600/8 to-amber-600/3 blur-[120px] rounded-full animate-pulse" style={{ animationDuration: '10s', animationDelay: '2s' }} />
        <div className="absolute top-[40%] left-[50%] -translate-x-1/2 w-[40%] h-[40%] bg-gradient-to-r from-yellow-600/5 to-amber-600/5 blur-[100px] rounded-full animate-pulse" style={{ animationDuration: '12s', animationDelay: '4s' }} />
        {/* Grid pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.015)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.015)_1px,transparent_1px)] bg-[size:60px_60px] [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_70%)]" />
      </div>

      {/* NAV */}
      <nav className="relative border-b border-white/[0.04] bg-black/60 backdrop-blur-2xl sticky top-0 z-50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-2 sm:gap-3">
            <Globe size={28} />
            <span className="font-extrabold text-lg sm:text-xl tracking-tight bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
              Geo<span className="text-blue-400">Leads</span>
            </span>
          </Link>
          <div className="flex items-center gap-1.5 sm:gap-3 text-xs sm:text-sm">
            <Link
              href="/pricing"
              className="hidden sm:inline-flex px-3 py-1.5 text-gray-400 hover:text-white transition-colors font-medium"
            >
              {COPY.nav.pricing}
            </Link>
            {user ? (
              <Link
                href="/app/dashboard"
                className="px-4 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 hover:text-amber-200 transition-all font-bold text-xs sm:text-sm"
              >
                Dashboard
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="hidden sm:inline-flex px-4 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-gray-300 hover:text-white transition-all font-medium"
                >
                  {COPY.nav.login}
                </Link>
                <Button href="/login" size="sm" className="text-xs sm:text-sm">
                  {COPY.nav.signup}
                </Button>
              </>
            )}
          </div>
        </div>
      </nav>

      <div className="relative">
        {/* ===== HERO ===== */}
        <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-16 sm:pt-24 pb-12 sm:pb-16">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/[0.07] border border-amber-500/15 text-amber-300 text-xs sm:text-sm font-medium mb-4 sm:mb-6">
              <span className="text-amber-400">🎁</span>
              {COPY.hero.badge}
            </div>
            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight mb-4 sm:mb-6 bg-gradient-to-b from-white to-gray-400 bg-clip-text text-transparent">
              {COPY.hero.title}
            </h1>
            <p
              className="text-base sm:text-lg text-gray-400 max-w-2xl mx-auto mb-8 sm:mb-10 leading-relaxed"
              dangerouslySetInnerHTML={{ __html: COPY.hero.subtitle }}
            />
            {user ? (
              <div className="max-w-xl mx-auto">
                <div className="app-card p-5 sm:p-6 rounded-2xl bg-gradient-to-b from-white/[0.04] to-black/40 border border-white/10 mb-4 text-left">
                  <h2 className="text-lg font-bold mb-1">{COPY.loggedIn.title}</h2>
                  <p className="text-sm text-gray-400 mb-4">{COPY.loggedIn.description}</p>
                  <div className="flex gap-2 mb-4">
                    <input
                      id="referral-link-input"
                      readOnly
                      value={referralUrl}
                      className="flex-1 bg-black/60 border border-white/10 rounded-lg px-3 py-2 text-xs sm:text-sm text-white font-mono focus:outline-none focus:border-amber-500/50 transition-colors"
                      onClick={(e) => (e.target as HTMLInputElement).select()}
                    />
                    <button
                      onClick={handleCopyLink}
                      className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap"
                    >
                      {copied ? COPY.loggedIn.copied : COPY.loggedIn.copyLink}
                    </button>
                  </div>
                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(COPY.loggedIn.shareWhatsAppMessage + referralUrl)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl bg-green-600 hover:bg-green-500 text-white font-bold text-sm transition-all cursor-pointer"
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                    </svg>
                    {COPY.loggedIn.shareWhatsApp}
                  </a>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4">
                <Button href="/login" size="lg" className="relative overflow-hidden group/btn">
                  <span className="absolute inset-0 bg-gradient-to-r from-amber-600 via-orange-600 to-amber-600 bg-[length:200%_100%] animate-gradient-x" style={{ animationDuration: '4s' }} />
                  <span className="relative">{COPY.loggedOut.signup}</span>
                </Button>
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center px-8 py-3.5 rounded-2xl text-sm font-medium bg-white/5 hover:bg-white/10 border border-white/10 text-gray-200 hover:text-white transition-all"
                >
                  {COPY.loggedOut.login}
                </Link>
              </div>
            )}
          </div>
        </section>

        {/* ===== BENEFITS ===== */}
        <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 sm:py-20">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-10 sm:mb-14">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-500/[0.07] border border-blue-500/15 text-blue-300 text-xs sm:text-sm font-medium mb-4">
                <span className="text-blue-400">🚀</span>
                {COPY.benefits.title}
              </div>
              <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight bg-gradient-to-b from-white to-gray-400 bg-clip-text text-transparent">
                Por que indicar o GeoLeads?
              </h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
              {COPY.benefits.items.map((item, i) => (
                <div
                  key={i}
                  className="group relative p-5 sm:p-6 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:border-amber-500/30 transition-all duration-300 text-center h-full"
                >
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-600/20 to-orange-600/20 flex items-center justify-center mx-auto mb-3 sm:mb-4 text-2xl group-hover:scale-110 transition-transform duration-300">
                    {item.icon}
                  </div>
                  <h3 className="font-bold text-sm sm:text-base text-white mb-1.5">{item.title}</h3>
                  <p className="text-xs sm:text-sm text-gray-500 leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ===== HOW IT WORKS ===== */}
        <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 sm:py-20">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-10 sm:mb-14">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/[0.07] border border-emerald-500/15 text-emerald-300 text-xs sm:text-sm font-medium mb-4">
                <span className="text-emerald-400">📋</span>
                {COPY.howItWorks.title}
              </div>
              <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight bg-gradient-to-b from-white to-gray-400 bg-clip-text text-transparent">
                Indique em 4 passos
              </h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
              {COPY.howItWorks.steps.map((step, i) => (
                <div key={i} className="relative">
                  <div className="flex flex-col items-center text-center p-5 sm:p-6 rounded-xl bg-white/[0.02] border border-white/[0.06] h-full">
                    <div className="w-10 h-10 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 font-bold text-lg mb-3">
                      {step.icon}
                    </div>
                    <h3 className="font-bold text-sm sm:text-base text-white mb-1.5">{step.title}</h3>
                    <p className="text-xs sm:text-sm text-gray-500 leading-relaxed">{step.desc}</p>
                  </div>
                  {i < COPY.howItWorks.steps.length - 1 && (
                    <div className="hidden lg:block absolute top-1/2 -right-3 transform -translate-y-1/2 text-gray-600 text-xl">
                      →
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ===== COMMISSION TABLE ===== */}
        <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 sm:py-20">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-10 sm:mb-14">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-purple-500/[0.07] border border-purple-500/15 text-purple-300 text-xs sm:text-sm font-medium mb-4">
                <span className="text-purple-400">🪙</span>
                {COPY.commission.title}
              </div>
              <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight bg-gradient-to-b from-white to-gray-400 bg-clip-text text-transparent">
                {COPY.commission.subtitle}
              </h2>
            </div>
            <div className="app-card p-6 sm:p-8 rounded-2xl bg-gradient-to-b from-white/[0.04] to-black/40 border border-white/10">
              <div className="space-y-3">
                {COPY.commission.rows.map((row, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-4 rounded-xl bg-black/40 border border-white/[0.04] hover:border-amber-500/20 transition-all"
                  >
                    <span className="text-sm sm:text-base text-gray-300 font-medium">{row.label}</span>
                    <span className="text-sm sm:text-base font-bold text-amber-400">{row.tokens}</span>
                  </div>
                ))}
              </div>
              <div className="mt-6 p-4 rounded-xl bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 text-center">
                <p className="text-sm text-amber-300 font-semibold">
                  ✨ Quanto mais você indica, mais tokens acumula — sem limites!
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ===== CTA ===== */}
        <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 sm:py-20">
          <div className="max-w-3xl mx-auto text-center">
            <div className="relative p-8 sm:p-14 rounded-3xl bg-gradient-to-b from-amber-600/[0.08] to-black/60 border border-amber-500/20 overflow-hidden group">
              <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-[400px] h-[200px] bg-amber-500/10 blur-[80px] rounded-full group-hover:bg-amber-500/20 transition-all duration-700" />
              <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-amber-500 to-transparent" />

              <span className="text-3xl sm:text-4xl mb-4 block relative">🚀</span>
              <h2 className="text-xl sm:text-3xl font-extrabold tracking-tight mb-3 sm:mb-4 relative">
                Comece a Indicar Agora
              </h2>
              <p className="text-gray-400 max-w-md mx-auto mb-6 sm:mb-8 text-sm sm:text-base relative">
                Crie sua conta grátis, copie seu link e compartilhe com amigos. Ganhe tokens ilimitados!
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3 mb-6 relative">
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-bold">
                  🪙 100 tokens por indicação
                </span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-300 text-xs font-bold">
                  ⚡ Crédito automático
                </span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 text-xs font-bold">
                  ♾️ Sem limites
                </span>
              </div>
              <div className="relative">
                <Button
                  href={user ? '/app/dashboard' : '/login'}
                  size="lg"
                  className="relative overflow-hidden group/btn"
                >
                  <span className="absolute inset-0 bg-gradient-to-r from-amber-600 via-orange-600 to-amber-600 bg-[length:200%_100%] animate-gradient-x" style={{ animationDuration: '4s' }} />
                  <span className="relative">
                    {user ? 'Ir para o Dashboard' : COPY.hero.cta}
                  </span>
                </Button>
              </div>
              {!user && (
                <p className="text-xs text-gray-500 mt-4 relative">
                  Já tem conta?{' '}
                  <Link href="/login" className="text-blue-400 hover:text-blue-300 font-medium">Faça login</Link>
                </p>
              )}
            </div>
          </div>
        </section>

        {/* ===== FAQ ===== */}
        <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 sm:py-20">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-10 sm:mb-14">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-500/[0.07] border border-blue-500/15 text-blue-300 text-xs sm:text-sm font-medium mb-4">
                <span className="text-blue-400">❓</span>
                {COPY.faq.title}
              </div>
              <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight bg-gradient-to-b from-white to-gray-400 bg-clip-text text-transparent">
                {COPY.faq.subtitle}
              </h2>
            </div>
            <div className="space-y-3 sm:space-y-4">
              {COPY.faq.items.map((item, i) => (
                <details
                  key={i}
                  className="group p-4 sm:p-5 rounded-xl bg-white/[0.02] border border-white/[0.06] open:border-amber-500/30 transition-all cursor-pointer"
                >
                  <summary className="text-sm sm:text-base font-semibold text-gray-300 group-open:text-amber-300 transition-colors list-none flex items-center justify-between gap-3">
                    {item.q}
                    <svg className="w-4 h-4 text-amber-400 shrink-0 group-open:rotate-180 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </summary>
                  <p className="mt-3 text-xs sm:text-sm text-gray-500 leading-relaxed border-t border-white/[0.04] pt-3">{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ===== FOOTER ===== */}
        <footer className="border-t border-white/[0.04] py-10 sm:py-14">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 sm:gap-8 mb-8 sm:mb-10">
              <div className="col-span-2 sm:col-span-1">
                <div className="flex items-center gap-2 mb-3">
                  <Globe size={24} />
                  <span className="font-extrabold text-base bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
                    Geo<span className="text-blue-400">Leads</span>
                  </span>
                </div>
                <p className="text-xs text-gray-500 leading-relaxed">{COPY.footer.description}</p>
              </div>
              <div>
                <div className="font-semibold text-sm text-gray-300 mb-4">{COPY.footer.links}</div>
                <div className="flex flex-col gap-2">
                  <Link href="/pricing" className="text-xs text-gray-500 hover:text-gray-300 transition-colors">{COPY.footer.pricing}</Link>
                  <Link href="/afiliados" className="text-xs text-gray-500 hover:text-gray-300 transition-colors">Programa de Indicação</Link>
                  <Link href="/privacy" className="text-xs text-gray-500 hover:text-gray-300 transition-colors">{COPY.footer.privacy}</Link>
                  <Link href="/terms" className="text-xs text-gray-500 hover:text-gray-300 transition-colors">{COPY.footer.terms}</Link>
                </div>
              </div>
              <div>
                <div className="font-semibold text-sm text-gray-300 mb-4">{COPY.footer.contact}</div>
                <div className="flex flex-col gap-2">
                  <a href="mailto:pixel010dev@gmail.com" className="text-xs text-gray-500 hover:text-gray-300 transition-colors">pixel010dev@gmail.com</a>
                  <span className="text-xs text-gray-500">Guilherme Oliveira</span>
                  <span className="text-xs text-gray-500">São Paulo, Brasil</span>
                </div>
              </div>
            </div>
            <div className="text-center text-xs text-gray-600 pt-6 sm:pt-8 border-t border-white/[0.04]">
              {COPY.footer.rights.replace('{year}', String(new Date().getFullYear()))}
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
