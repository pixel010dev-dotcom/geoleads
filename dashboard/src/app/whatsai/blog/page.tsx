import { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Blog | WhatsAI - Automação de WhatsApp',
  description: 'Aprenda a automatizar a prospecção de clientes no WhatsApp com o WhatsAI.',
  robots: { index: false, follow: false },
};

const POSTS = [
  { slug: 'prospeccao-automatica-whatsapp', title: 'Prospecção Automática no WhatsApp: O Guia Completo', desc: 'Aprenda como automatizar a prospecção de clientes no WhatsApp sem ser bloqueado. Estratégias, ferramentas e templates que funcionam.', date: '01/07/2026', time: '7 min' },
  { slug: 'whatsapp-para-restaurantes', title: 'WhatsApp para Restaurantes: Como Atrair Mais Clientes', desc: 'Descubra como restaurantes estão usando o WhatsApp para atrair clientes automaticamente. Estratégias práticas para aumentar o faturamento.', date: '28/06/2026', time: '5 min' },
  { slug: 'whatsapp-para-saloes', title: 'WhatsApp para Salões de Beleza: Guia de Prospecção', desc: 'Salões que usam WhatsApp para prospectar crescem 3× mais rápido. Veja como automatizar suas campanhas e nunca mais ficar com horário vazio.', date: '25/06/2026', time: '5 min' },
  { slug: 'evitar-bloqueio-whatsapp', title: 'Como Evitar Bloqueio no WhatsApp ao Automatizar', desc: 'As 5 principais causas de bloqueio no WhatsApp e como evitá-las. Guia completo para manter sua conta segura enquanto automatiza.', date: '22/06/2026', time: '6 min' },
  { slug: 'whatsapp-para-advogados', title: 'WhatsApp para Advogados: Como Conseguir Mais Clientes', desc: 'Estratégias de prospecção no WhatsApp para advogados. Capture leads de forma automática e aumente sua carteira de clientes.', date: '19/06/2026', time: '5 min' },
];

export default function WhatsAIBlogPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <nav className="border-b border-white/5 bg-black/40 backdrop-blur-2xl sticky top-0 z-50">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/whatsai" className="flex items-center gap-2">
            <span className="text-xl font-black tracking-tight">
              <span className="text-white">Whats</span><span className="text-green-400">AI</span>
            </span>
          </Link>
          <div className="flex items-center gap-3 text-sm">
            <Link href="/whatsai" className="text-gray-400 hover:text-white transition-colors">Início</Link>
          </div>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-extrabold mb-2">📖 Blog do WhatsAI</h1>
        <p className="text-gray-400 mb-10">Dicas e estratégias de prospecção automática no WhatsApp</p>

        <div className="space-y-4">
          {POSTS.map(p => (
            <Link
              key={p.slug}
              href={`/whatsai/blog/${p.slug}`}
              className="block p-5 rounded-xl border border-white/5 hover:bg-white/[0.02] transition-colors"
            >
              <h2 className="font-bold text-base mb-1">{p.title}</h2>
              <p className="text-sm text-gray-500 mb-2 line-clamp-2">{p.desc}</p>
              <div className="flex items-center gap-2 text-xs text-gray-600">
                <span>{p.date}</span>
                <span>·</span>
                <span>{p.time}</span>
              </div>
            </Link>
          ))}
        </div>
      </main>

      <footer className="border-t border-white/5 py-8 px-4 text-center text-xs text-gray-600">
        <p>WhatsAI © 2026 — Produto do ecossistema GeoLeads</p>
      </footer>
    </div>
  );
}
