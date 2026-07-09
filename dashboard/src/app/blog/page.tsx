import Link from 'next/link';
import type { Metadata } from 'next';
import { Button } from '@/components/Button';

export const metadata: Metadata = {
  title: 'Blog | GeoLeads - Dicas de Prospeccao e Lead Generation',
  description: 'Aprenda como extrair leads do Google Maps, melhorar sua prospeccao B2B e fechar mais vendas com dicas praticas.',
};

const posts = [
  {
    slug: 'como-extrair-leads-google-maps',
    title: 'Como Extrair Leads do Google Maps: Guia Completo 2026',
    excerpt: 'Aprenda o passo a passo para extrair leads do Google Maps automaticamente. Descubra ferramentas, tecnicas e estrategias para gerar clientes todos os dias.',
    date: '15/06/2026',
    readTime: '8 min',
  },
  {
    slug: 'prospeccao-b2b-whatsapp',
    title: 'Prospeccao B2B pelo WhatsApp: Estrategias que Funcionam',
    excerpt: 'Saiba como usar o WhatsApp para prospectar clientes sem ser bloqueado. Template de mensagens, horarios ideais e automatizacao inteligente.',
    date: '10/06/2026',
    readTime: '6 min',
  },
  {
    slug: 'crm-para-pequenas-empresas',
    title: 'CRM para Pequenas Empresas: Como Organizar seus Leads',
    excerpt: 'Um bom CRM pode dobrar sua taxa de conversao. Veja como organizar leads, definir etapas do funil e automatizar o acompanhamento.',
    date: '05/06/2026',
    readTime: '5 min',
  },
  {
    slug: 'marketing-digital-para-corretores',
    title: 'Marketing Digital para Corretores de Imoveis: Guia 2026',
    excerpt: 'Corretores que usam tecnologia vendem mais. Descubra como extrair leads de imobiliarias e proprietarios no Google Maps.',
    date: '01/06/2026',
    readTime: '7 min',
  },
  {
    slug: 'extracao-automatica-leads',
    title: 'Extracao Automatica de Leads: Como Economizar Horas por Semana',
    excerpt: 'Automatize a extracao de leads do Google Maps e economize dezenas de horas por semana. Ferramentas, roteiros e melhores praticas.',
    date: '20/06/2026',
    readTime: '6 min',
  },
  {
    slug: 'whatsapp-marketing-automacao',
    title: 'WhatsApp Marketing Automacao: Dispare sem Ser Bloqueado',
    excerpt: 'Aprenda a automatizar disparos no WhatsApp sem risco de bloqueio. Estrategias de aquecimento, limites diarios e templates inteligentes.',
    date: '22/06/2026',
    readTime: '7 min',
  },
  {
    slug: 'lead-generation-b2b-estrategias',
    title: 'Lead Generation B2B: Estrategias Avancadas para 2026',
    excerpt: 'As melhores estrategias de lead generation B2B para 2026. Da extracao ao fechamento, um guia completo para vender mais.',
    date: '24/06/2026',
    readTime: '8 min',
  },
  {
    slug: 'analise-concorrencia-google-maps',
    title: 'Como Analisar a Concorrencia pelo Google Maps',
    excerpt: 'Descubra como usar o Google Maps para espionar concorrentes, identificar lacunas no mercado e encontrar nichos lucrativos.',
    date: '25/06/2026',
    readTime: '5 min',
  },
  {
    slug: 'vender-mais-whatsapp-business',
    title: 'Como Vender Mais com WhatsApp Business: Guia Completo',
    excerpt: 'Domine o WhatsApp Business para vendas. Catalogo, respostas rapidas, rotulos e integracao com CRM para fechar mais negocios.',
    date: '26/06/2026',
    readTime: '6 min',
  },
];

export default function BlogPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <nav className="border-b border-white/5 bg-black/40 backdrop-blur-2xl sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="font-extrabold text-xl tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
              Geo<span className="text-blue-400">Leads</span>
            </span>
          </Link>
          <Button href="/login?next=/app/dashboard" size="sm" className="bg-blue-500 hover:bg-blue-400 text-black shadow-none">
            Testar Gratis
          </Button>
        </div>
      </nav>
      <main className="max-w-4xl mx-auto px-4 py-12">
        <h1 className="text-3xl sm:text-4xl font-extrabold mb-4">Blog</h1>
        <p className="text-gray-400 mb-10 text-lg">Dicas e estrategias de prospeccao e lead generation</p>
        <div className="space-y-6">
          {posts.map(post => (
            <Link key={post.slug} href={`/blog/${post.slug}`} className="block group">
              <article className="bg-gradient-to-b from-white/[0.05] to-black/40 border border-white/10 rounded-2xl p-6 hover:border-blue-500/30 transition-all">
                <div className="flex items-center gap-3 text-xs text-gray-500 mb-2">
                  <span>{post.date}</span>
                  <span>·</span>
                  <span>{post.readTime} de leitura</span>
                </div>
                <h2 className="text-xl font-bold mb-2 group-hover:text-blue-400 transition-colors">{post.title}</h2>
                <p className="text-gray-400 text-sm leading-relaxed">{post.excerpt}</p>
              </article>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
