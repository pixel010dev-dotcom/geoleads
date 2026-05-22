import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import ScrollReveal from '@/components/ScrollReveal';

export default async function LandingPage() {
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

  const testimonialsList: { name: string; stars: number; text: string; role: string }[] =
    realTestimonials && realTestimonials.length > 0
      ? realTestimonials.map(t => ({ name: t.name, stars: t.rating, text: t.feedback || '', role: t.role || '' })).filter(t => t.text)
      : fallback;
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
            description: 'Motor de extração de leads B2B via Google Maps com CRM, WhatsApp e IA.',
            url: 'https://geoleads-production.up.railway.app',
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
        <div className="app-container min-h-16 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 sm:gap-3 cursor-default">
            <div
              className="relative rounded-full overflow-hidden select-none flex-shrink-0"
              style={{ width: 32, height: 32, background: 'radial-gradient(circle at 35% 35%, #00d9ff 0%, #0052ff 50%, #000c3b 100%)', boxShadow: 'inset -4px -4px 8px rgba(0,0,0,0.8), inset 4px 4px 8px rgba(255,255,255,0.3), 0 0 12px rgba(0,217,255,0.5)', border: '1px solid rgba(0,217,255,0.3)' }}
            >
              <div className="absolute inset-0 rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.35) 0%, transparent 55%)', zIndex: 3 }} />
              <div className="absolute inset-0 rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle at 75% 75%, transparent 35%, rgba(0,0,0,0.8) 100%)', zIndex: 2 }} />
            </div>
            <span className="font-extrabold text-xl sm:text-2xl tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
              Geo<span className="text-blue-400">Leads</span>
            </span>
          </div>
          <div className="flex items-center gap-2.5 sm:gap-4 text-xs sm:text-sm">
            <Link href="/pricing" className="px-3.5 py-1.5 rounded-full text-gray-300 hover:text-white transition-colors font-medium">
              Preços
            </Link>
            <Link href="/login" className="px-4 py-2 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-gray-200 hover:text-white transition-all font-medium">
              Entrar
            </Link>
            <Link href="/login" className="px-4 py-2 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold transition-all shadow-[0_4px_15px_rgba(59,130,246,0.3)] hover:shadow-[0_8px_25px_rgba(59,130,246,0.4)] hover:-translate-y-0.5 active:scale-95">
              Criar Conta Grátis
            </Link>
          </div>
        </div>
      </nav>

      <main className="relative z-10">
        <section className="app-container pt-16 sm:pt-24 pb-12 sm:pb-20">
          <ScrollReveal>
            <div className="max-w-4xl mx-auto text-center">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-300 text-xs font-bold mb-6">
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                Motor Online · Já são 4.200+ leads extraídos
              </div>
              <h1 className="text-4xl sm:text-5xl md:text-7xl font-extrabold tracking-tight leading-[1.08] mb-6">
                Extraia{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-cyan-300 to-indigo-400">
                  500+ Leads Qualificados
                </span>{' '}
                em 3 Minutos
              </h1>
              <p className="text-base sm:text-lg md:text-xl text-gray-400 max-w-2xl mx-auto leading-relaxed mb-8">
                Do Google Maps ao WhatsApp. Com CNPJ, e-mail e redes sociais validados — tudo em um fluxo só. Sem planilhas, sem trabalho manual, sem stress.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
                <Link
                  href="/login"
                  className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-base transition-all shadow-[0_8px_30px_rgba(59,130,246,0.35)] hover:shadow-[0_12px_40px_rgba(59,130,246,0.5)] hover:-translate-y-1 active:scale-95 text-center"
                >
                  Extraia 10 Leads Grátis Agora
                </Link>
                <Link
                  href="/pricing"
                  className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-200 hover:text-white font-medium text-base transition-all text-center"
                >
                  Ver Planos
                </Link>
              </div>
            </div>
          </ScrollReveal>
        </section>

        <section className="app-container py-16 sm:py-24">
          <ScrollReveal>
            <div className="max-w-5xl mx-auto">
              <div className="text-center mb-12">
                <span className="badge-blue mb-3">Como funciona</span>
                <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight mt-3">Três passos para sua próxima venda</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {steps.map((step, i) => (
                  <ScrollReveal key={i} delay={i * 100}>
                    <div className="app-card p-8 rounded-[2rem] text-center group hover:border-blue-500/30 transition-all duration-500">
                      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600/20 to-indigo-600/20 border border-blue-500/20 flex items-center justify-center mx-auto mb-5 text-2xl group-hover:scale-110 transition-transform">
                        {step.icon}
                      </div>
                      <div className="w-8 h-8 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-sm font-bold flex items-center justify-center mx-auto mb-4">
                        {i + 1}
                      </div>
                      <h3 className="text-lg font-bold mb-2">{step.title}</h3>
                      <p className="text-sm text-gray-400 leading-relaxed">{step.desc}</p>
                    </div>
                  </ScrollReveal>
                ))}
              </div>
            </div>
          </ScrollReveal>
        </section>

        <section className="app-container py-16 sm:py-24">
          <ScrollReveal>
            <div className="max-w-5xl mx-auto">
              <div className="text-center mb-12">
                <span className="badge-purple mb-3">Ferramentas</span>
                <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight mt-3">Tudo que você precisa para prospectar</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {features.map((f, i) => (
                  <ScrollReveal key={i} delay={i * 60}>
                    <div className="app-card p-6 rounded-2xl hover:border-white/15 transition-all">
                      <span className="text-2xl mb-3 block">{f.icon}</span>
                      <h3 className="font-bold text-sm mb-1">{f.title}</h3>
                      <p className="text-xs text-gray-500 leading-relaxed">{f.desc}</p>
                    </div>
                  </ScrollReveal>
                ))}
              </div>
            </div>
          </ScrollReveal>
        </section>

        {/* TESTIMONIALS */}
        <section className="app-container py-16 sm:py-24">
          <ScrollReveal>
            <div className="max-w-5xl mx-auto">
              <div className="text-center mb-12">
                <span className="badge-purple mb-3">Depoimentos</span>
                <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight mt-3">Quem usa, recomenda</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {testimonialsList.map((t, i) => (
                  <ScrollReveal key={i} delay={i * 120}>
                    <div className="app-card p-6 rounded-2xl flex flex-col">
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

        <section className="app-container py-16 sm:py-24">
          <ScrollReveal>
            <div className="max-w-3xl mx-auto text-center">
              <div className="app-card p-10 sm:p-14 rounded-[2.5rem] bg-gradient-to-b from-blue-600/10 to-black/40 border border-blue-500/20 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-cyan-500" />
                <span className="text-4xl mb-4 block">🚀</span>
                <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight mb-4">Pronto para começar?</h2>
                <p className="text-gray-400 max-w-md mx-auto mb-8 text-sm sm:text-base">
                  10 tokens grátis para testar. Sem cartão de crédito. Em 2 minutos você já está extraindo leads.
                </p>
                <Link
                  href="/login"
                  className="inline-flex px-10 py-4 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-base transition-all shadow-[0_8px_30px_rgba(59,130,246,0.35)] hover:shadow-[0_12px_40px_rgba(59,130,246,0.5)] hover:-translate-y-1 active:scale-95"
                >
                  Criar Conta Grátis
                </Link>
                <p className="text-xs text-gray-500 mt-4">Já tem conta? <Link href="/login" className="text-blue-400 hover:text-blue-300">Entrar</Link></p>
              </div>
            </div>
          </ScrollReveal>
        </section>
      </main>

      <footer className="border-t border-white/5 bg-black/20">
        <div className="app-container py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-gray-500">
          <span>&copy; {new Date().getFullYear()} GeoLeads. Todos os direitos reservados.</span>
          <div className="flex items-center gap-4">
            <a href="mailto:pixel010dev@gmail.com?subject=Contato%20GeoLeads" className="hover:text-gray-300 transition-colors">Suporte</a>
            <Link href="/pricing" className="hover:text-gray-300 transition-colors">Preços</Link>
            <Link href="/login" className="hover:text-gray-300 transition-colors">Entrar</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

const steps = [
  {
    icon: '🔍',
    title: 'Extraia leads',
    desc: 'Escolha nicho e cidade. O motor varre o Google Maps e entrega nome, telefone, email, site, CNPJ e redes sociais de cada negócio.',
  },
  {
    icon: '📋',
    title: 'Organize no CRM',
    desc: 'Salve, filtre, categorize por estágio (Novo, Em Contato, Proposta, Fechado) e nunca perca o controle dos seus contatos.',
  },
  {
    icon: '💬',
    title: 'Aborde pelo WhatsApp',
    desc: 'Dispare mensagens personalizadas com um clique. Use modelos prontos ou gere copys com IA. O bot também responde automaticamente.',
  },
];

const features = [
  { icon: '📞', title: 'Telefone e Site', desc: 'Priorize leads com contato disponível para abordagem imediata.' },
  { icon: '🏢', title: 'CNPJ Oficial', desc: 'Enriqueça com dados da Receita Federal automaticamente.' },
  { icon: '✉️', title: 'Caçador de E-mails', desc: 'Descobre e-mails institucionais a partir do site oficial.' },
  { icon: '📸', title: 'Redes Sociais', desc: 'Instagram, Facebook e TikTok quando disponíveis.' },
  { icon: '💬', title: 'Disparador WhatsApp', desc: 'Fila assistida com templates, IA e envio direto pelo bot.' },
  { icon: '🤖', title: 'Chatbot Automático', desc: 'Responda leads automaticamente com regras personalizadas.' },
  { icon: '📊', title: 'CRM Integrado', desc: 'Gerencie tudo sem sair da plataforma.' },
  { icon: '📥', title: 'Exportação CSV', desc: 'Exporte seus leads para usar onde quiser.' },
];
