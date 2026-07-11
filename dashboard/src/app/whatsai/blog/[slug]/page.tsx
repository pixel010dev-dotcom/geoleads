import { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/Button';
import NewsletterSignup from '@/components/NewsletterSignup';

type Article = { title: string; desc: string; date: string; time: string; content: string[] };
const POSTS: Record<string, Article> = {
  'prospeccao-automatica-whatsapp': {
    title: 'Prospecção Automática no WhatsApp: O Guia Completo',
    desc: 'Aprenda como automatizar a prospecção de clientes no WhatsApp sem ser bloqueado. Estratégias, ferramentas e templates que funcionam.',
    date: '01/07/2026', time: '7 min',
    content: [
      'Prospecção manual é coisa do passado. Enquanto você dorme, seus concorrentes estão sendo abordados por sistemas automatizados que não param.',
      'O WhatsApp é o maior canal de comunicação do brasileiro. São 150 milhões de usuários ativos. É onde seus clientes em potencial passam o tempo.',
      '',
      '## Por que automatizar a prospecção?',
      'Automatizar a prospecção no WhatsApp não é sobre enviar spam. É sobre escalar o que funciona:',
      '- Um vendedor humano consegue abordar 20-30 leads por dia no máximo',
      '- Um sistema automatizado consegue abordar 50-300 leads por dia',
      '- O sistema trabalha 24h, nos finais de semana e feriados',
      '- Cada lead recebe uma mensagem personalizada com nome, nicho e cidade',
      '',
      '## Como funciona a prospecção automática',
      'Ferramentas como o WhatsAI integram três etapas em um fluxo único:',
      '',
      '### 1. Captura de leads',
      'Os leads são extraídos do Google Maps com base no nicho e cidade escolhidos. O sistema coleta nome, telefone, WhatsApp e outros dados do negócio.',
      '',
      '### 2. Envio inteligente',
      'As mensagens são enviadas com delay variável (5-15 minutos), simulando comportamento humano. O sistema pula números que não estão no WhatsApp.',
      '',
      '### 3. Monitoramento e resposta',
      'Após enviar, o sistema monitora a conversa por 10 minutos. Se o lead responder, uma resposta automática é enviada para manter o engajamento.',
      '',
      '## Templates que convertem',
      'O segredo está na personalização. Mensagens genéricas são ignoradas. Mensagens que mencionam o nome do negócio, nicho e cidade têm taxa de resposta 4× maior.',
      '',
      'Template exemplo:',
      '"Olá {Nome}! Vi seu {Nicho} no Google. Trabalho com um sistema que encontra clientes no WhatsApp e aborda eles automaticamente pro seu negócio. Chama WhatsAI. Já ouviu falar?"',
      '',
      '## Cuidados para não ser bloqueado',
      '- Máximo de 10-15 mensagens por dia por conta',
      '- Intervalo de 5-15 minutos entre cada envio',
      '- Pausa de 2 horas a cada 5 mensagens enviadas',
      '- Nunca enviar mensagens idênticas para vários contatos',
      '- Evitar horários noturnos (22h às 8h)',
      '',
      'Com o WhatsAI, todas essas regras são aplicadas automaticamente. Você só precisa escolher o nicho e região.',
    ],
  },
  'whatsapp-para-restaurantes': {
    title: 'WhatsApp para Restaurantes: Como Atrair Mais Clientes',
    desc: 'Descubra como restaurantes estão usando o WhatsApp para atrair clientes automaticamente.',
    date: '28/06/2026', time: '5 min',
    content: [
      'Restaurantes vivem de fluxo de clientes. Em dias movimentados, lotam. Em dias tranquilos, o prejuízo é certo. O WhatsApp resolve isso.',
      '',
      '## O problema dos restaurantes',
      'A maioria dos restaurantes depende de clientes que já conhecem o local. Poucos fazem prospecção ativa. Mas quem faz, cresce mais rápido.',
      '',
      '## Como o WhatsAI ajuda restaurantes',
      'O sistema encontra restaurantes no Google Maps e envia uma mensagem personalizada para o dono ou gerente. A abordagem é direta e focada em trazer mais clientes.',
      '',
      '## Resultados reais',
      'Nossos testes em Foz do Iguaçu mostraram que 1 em cada 24 contatos respondeu e se tornou um lead qualificado. Uma taxa de 4% de conversão na primeira mensagem.',
      '',
      'Com follow-up e persistência, essa taxa pode chegar a 10-15%.',
    ],
  },
  'whatsapp-para-saloes': {
    title: 'WhatsApp para Salões de Beleza: Guia de Prospecção',
    desc: 'Salões que usam WhatsApp para prospectar crescem 3× mais rápido.',
    date: '25/06/2026', time: '5 min',
    content: [
      'Salões de beleza têm um desafio único: horários ociosos. Uma cadeira vazia é dinheiro perdido. A prospecção ativa no WhatsApp resolve isso.',
      '',
      '## Por que salões precisam de prospecção automática',
      'Diferente de restaurantes, salões dependem de agendamento. Se o cliente não agenda, o horário fica vazio. Com prospecção automática, você preenche a agenda antes mesmo de abrir.',
      '',
      '## Nicho ideal para WhatsAI',
      'Salões de beleza são um dos nichos que mais respondem à prospecção no WhatsApp. São negócios que:',
      '- Já usam WhatsApp no dia a dia',
      '- Tem horários ociosos para preencher',
      '- Donos estão abertos a novas estratégias',
      '',
      'Com o WhatsAI, você aborda salões da sua região automaticamente e oferece uma solução que enche a agenda deles.',
    ],
  },
  'evitar-bloqueio-whatsapp': {
    title: 'Como Evitar Bloqueio no WhatsApp ao Automatizar',
    desc: 'As 5 principais causas de bloqueio no WhatsApp e como evitá-las.',
    date: '22/06/2026', time: '6 min',
    content: [
      'O maior medo de quem automatiza WhatsApp é o bloqueio. E com razão — perder uma conta com anos de contatos é um prejuízo enorme.',
      '',
      '## Por que o WhatsApp bloqueia?',
      'O WhatsApp tem sistemas automatizados que detectam padrões de comportamento não humano. Os principais gatilhos são:',
      '',
      '### 1. Velocidade de envio',
      'Enviar dezenas de mensagens em poucos minutos é o principal motivo de bloqueio. O WhatsAI usa delay de 5-15 minutos entre cada envio.',
      '',
      '### 2. Mensagens idênticas',
      'Enviar o mesmo texto para vários contatos é um padrão fácil de detectar. O WhatsAI varia cada mensagem automaticamente.',
      '',
      '### 3. Volume diário excessivo',
      'Mais de 50 mensagens por dia aumenta drasticamente o risco. O limite seguro é 10-15 mensagens por dia.',
      '',
      '### 4. Horário inadequado',
      'Enviar mensagens entre 22h e 8h é suspeito. O WhatsAI só envia em horário comercial.',
      '',
      '### 5. Rejeição em massa',
      'Se muitos contatos não têm WhatsApp, a taxa de rejeição dispara e o sistema desconfia. O WhatsAI verifica se o número existe antes de enviar.',
      '',
      'Com o WhatsAI, todas essas proteções são automáticas. Você não precisa se preocupar com bloqueios.',
    ],
  },
  'whatsapp-para-advogados': {
    title: 'WhatsApp para Advogados: Como Conseguir Mais Clientes',
    desc: 'Estratégias de prospecção no WhatsApp para advogados.',
    date: '19/06/2026', time: '5 min',
    content: [
      'Advocacia é um mercado competitivo. Escritórios que dominam a prospecção digital crescem enquanto outros estagnam.',
      '',
      '## O potencial do WhatsApp para advogados',
      'O WhatsApp já é o principal canal de comunicação entre advogados e clientes. Usar o mesmo canal para prospectar é o próximo passo natural.',
      '',
      '## Nicho de advocacia no WhatsAI',
      'O sistema encontra escritórios de advocacia no Google Maps e envia mensagens personalizadas. A abordagem é profissional e focada em gerar mais clientes para o escritório.',
      '',
      '## Vantagens para quem prospecta',
      '- Escritórios de advocacia estão sempre buscando mais clientes',
      '- WhatsApp é o canal profissional padrão na área',
      '- A taxa de resposta tende a ser maior que em nichos de varejo',
      '',
      'O WhatsAI automatiza todo o processo: da captura do lead à mensagem personalizada. Você só acompanha quem respondeu.',
    ],
  },
};

export async function generateStaticParams() {
  return Object.keys(POSTS).map(slug => ({ slug }));
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const post = POSTS[params.slug];
  if (!post) return { title: 'Blog | WhatsAI' };

  return {
    title: `${post.title} | WhatsAI Blog`,
    description: post.desc,
    robots: { index: false, follow: false },
    openGraph: { title: `${post.title} | WhatsAI Blog`, description: post.desc, type: 'article', publishedTime: post.date, locale: 'pt_BR' },
  };
}

export default function WhatsAIBlogPost({ params }: { params: { slug: string } }) {
  const post = POSTS[params.slug];
  if (!post) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Post não encontrado</h1>
          <Link href="/whatsai/blog" className="text-green-400 hover:underline">Voltar ao blog</Link>
        </div>
      </div>
    );
  }

  const related = Object.entries(POSTS)
    .filter(([k]) => k !== params.slug)
    .sort(() => Math.random() - 0.5)
    .slice(0, 3);

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
            <Link href="/whatsai/blog" className="text-gray-400 hover:text-white transition-colors">Blog</Link>
          </div>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-4 py-12">
        <Link href="/whatsai/blog" className="text-sm text-green-400 hover:underline mb-4 inline-block">&larr; Voltar ao blog</Link>
        <h1 className="text-2xl sm:text-4xl font-extrabold leading-tight mb-2">{post.title}</h1>
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-8">
          <span>{post.date}</span><span>·</span><span>{post.time} de leitura</span>
        </div>

        <article className="prose prose-invert max-w-none leading-relaxed text-gray-300 space-y-4">
          {post.content.map((line, i) => {
            if (line.startsWith('## ')) return <h2 key={i} className="text-xl font-bold text-white mt-8 mb-4">{line.replace('## ', '')}</h2>;
            if (line.startsWith('### ')) return <h3 key={i} className="text-lg font-bold text-white mt-6 mb-3">{line.replace('### ', '')}</h3>;
            if (line.startsWith('- ')) return <li key={i} className="text-gray-300 ml-4">{line.replace('- ', '')}</li>;
            if (line === '') return <div key={i} className="h-3" />;
            return <p key={i} className="text-gray-300 leading-relaxed">{line}</p>;
          })}
        </article>

        {/* CTA */}
        <div className="mt-12 p-6 rounded-2xl bg-gradient-to-b from-green-500/10 to-transparent border border-green-500/20 text-center">
          <h3 className="text-xl font-bold mb-2">Quer prospectar no WhatsApp?</h3>
          <p className="text-gray-400 mb-4">O WhatsAI encontra, aborda e gerencia clientes automaticamente.</p>
          <Link
            href="/whatsai#cta"
            className="inline-block px-6 py-3 rounded-xl bg-green-500 hover:bg-green-400 text-black font-bold transition-all"
          >
            Quero Conhecer
          </Link>
        </div>

        {/* Newsletter */}
        <div className="mt-6 mb-10">
          <NewsletterSignup source={`whatsai-blog-${params.slug}`} />
        </div>

        {/* Related */}
        {related.length > 0 && (
          <div>
            <h3 className="text-lg font-bold mb-4">📖 Leia também</h3>
            <div className="grid gap-3">
              {related.map(([slug, r]) => (
                <Link key={slug} href={`/whatsai/blog/${slug}`} className="block p-4 rounded-xl border border-white/5 hover:bg-white/[0.02] transition-colors">
                  <h4 className="font-bold text-sm mb-1">{r.title}</h4>
                  <p className="text-xs text-gray-500 line-clamp-2">{r.desc}</p>
                </Link>
              ))}
            </div>
          </div>
        )}
      </main>

      <footer className="border-t border-white/5 py-8 px-4 text-center text-xs text-gray-600">
        <p>WhatsAI © 2026 — Produto do ecossistema GeoLeads</p>
      </footer>
    </div>
  );
}
