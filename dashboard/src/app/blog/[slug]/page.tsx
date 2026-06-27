import { Metadata } from 'next';
import Link from 'next/link';

const POSTS: Record<string, { title: string; content: string[]; date: string; readTime: string; description: string }> = {
  'como-extrair-leads-google-maps': {
    title: 'Como Extrair Leads do Google Maps: Guia Completo 2026',
    description: 'Aprenda o passo a passo para extrair leads do Google Maps automaticamente. Descubra ferramentas, tecnicas e estrategias para gerar clientes todos os dias.',
    date: '15/06/2026',
    readTime: '8 min',
    content: [
      'O Google Maps e a maior base de dados de negocios do mundo. Milhoes de empresas cadastradas com telefone, endereco, horarios e avaliacoes. Para quem trabalha com prospeccao, isso e uma mina de ouro.',
      'Neste guia, voce vai aprender como extrair leads do Google Maps de forma eficiente e automatica.',
      '',
      '## Por que extrair leads do Google Maps?',
      'Diferente de outras fontes, o Google Maps oferece dados validados e atualizados. Cada negocio listado passou por um processo de verificacao, o que significa que os telefones e enderecos sao confiaveis.',
      'Além disso, a busca por nicho + cidade permite segmentar exatamente o tipo de cliente que voce quer atingir.',
      '',
      '## O que e possivel extrair?',
      'Com as ferramentas certas, e possivel extrair: nome do negocio, telefone, WhatsApp, site, email, endereco, CEP, avaliacao, horarios de funcionamento, Instagram, Facebook, TikTok e ate CNPJ.',
      '',
      '## Como funciona a extracao automatica',
      'Ferramentas como o GeoLeads usam navegadores automatizados para buscar no Google Maps. O processo e simples:',
      '1. Voce informa o nicho (ex: "dentista") e a cidade (ex: "São Paulo")',
      '2. O sistema navega pelo Maps e coleta os dados dos cards de resultados',
      '3. Os leads aparecem na tela em tempo real',
      '4. Dados sao enriquecidos com email e redes sociais visitando os sites dos negocios',
      '',
      '## Dicas para melhores resultados',
      '- Use nichos especificos: em vez de "restaurante", busque "pizzaria" ou "hamburgueria"',
      '- Varie as cidades: extraia de varias cidades para aumentar sua base',
      '- Aproveite os filtros: filtre leads com telefone, site ou email para maior qualidade',
      '- Integre com CRM: organize os leads em etapas e faca acompanhamento',
      '',
      'O GeoLeads foi desenvolvido para fazer todo esse processo de forma automatica, com entrega incremental e suporte a 140 cidades brasileiras.',
    ],
  },
  'prospeccao-b2b-whatsapp': {
    title: 'Prospeccao B2B pelo WhatsApp: Estrategias que Funcionam',
    description: 'Saiba como usar o WhatsApp para prospectar clientes sem ser bloqueado. Template de mensagens, horarios ideais e automatizacao inteligente.',
    date: '10/06/2026',
    readTime: '6 min',
    content: [
      'O WhatsApp se tornou o principal canal de comunicacao do brasileiro. Com mais de 150 milhoes de usuarios ativos no pais, e o lugar ideal para prospectar clientes.',
      'Mas prospeccao por WhatsApp exige estrategia. Enviar mensagens em massa sem criterio pode resultar em bloqueios e denuncias.',
      '',
      '## Estrategias que funcionam',
      '',
      '### 1. Personalizacao e a chave',
      'Nao envie mensagens genericas. Use o nome do contato, mencione a cidade e o nicho. Quanto mais personalizada a mensagem, maior a chance de resposta.',
      '',
      '### 2. Horario ideal',
      'Os melhores horarios para enviar mensagens de prospeccao sao: 9h-11h e 14h-16h, de segunda a quinta. Evite segundas de manha e sextas a tarde.',
      '',
      '### 3. Use templates testados',
      'Tenha 3-4 templates de mensagem e teste qual funciona melhor para seu nicho. Abordagem local, oferta direta, diagnostico gratuito e parceria sao abordagens que funcionam.',
      '',
      '### 4. Automatize com inteligencia',
      'Ferramentas como o GeoLeads permitem disparar mensagens automaticas com delay entre envios, simulando comportamento humano. Isso evita bloqueios.',
      '',
      '## Template de mensagem que converte',
      '"Ola {Nome}! Vi seu perfil comercial em {Cidade} e gostaria de saber se voces tem interesse em receber mais clientes de {Nicho}. Podemos conversar?"',
      '',
      'Essa abordagem funciona porque e direta, educada e mostra que voce pesquisou sobre o negocio.',
    ],
  },
  'crm-para-pequenas-empresas': {
    title: 'CRM para Pequenas Empresas: Como Organizar seus Leads',
    description: 'Um bom CRM pode dobrar sua taxa de conversao. Veja como organizar leads, definir etapas do funil e automatizar o acompanhamento.',
    date: '05/06/2026',
    readTime: '5 min',
    content: [
      'Muitas pequenas empresas ainda usam planilhas ou papel para gerenciar contatos. O problema? Leads se perdem, nenhum acompanhamento e feito, e as oportunidades viram pó.',
      'Um CRM (Customer Relationship Management) resolve isso. E um sistema que organiza seus contatos em etapas, permitindo acompanhar cada lead desde o primeiro contato ate o fechamento.',
      '',
      '## Por que sua empresa precisa de um CRM?',
      '- Nunca mais perca um lead: todos os contatos ficam salvos e organizados',
      '- Acompanhamento automatico: veja em qual etapa cada lead esta',
      '- Maior taxa de conversao: leads acompanhados convertem muito mais',
      '- Trabalho em equipe: varios vendedores podem usar o mesmo sistema',
      '',
      '## Etapas de um funil de vendas simples',
      '1. Novo: lead acabou de ser adicionado',
      '2. Em Contato: voce ja iniciou a conversa',
      '3. Proposta: enviou uma proposta comercial',
      '4. Fechado: fechou o negocio',
      '5. Perdido: nao avancou, mas pode ser reativado depois',
      '',
      '## CRM integrado com extracao de leads',
      'O GeoLeads ja vem com CRM integrado. Os leads extraidos do Google Maps podem ser salvos diretamente no CRM, com tags coloridas, notas e busca por etapa. Tudo sincronizado com a nuvem.',
    ],
  },
  'marketing-digital-para-corretores': {
    title: 'Marketing Digital para Corretores de Imoveis: Guia 2026',
    description: 'Corretores que usam tecnologia vendem mais. Descubra como extrair leads de imobiliarias e proprietarios no Google Maps.',
    date: '01/06/2026',
    readTime: '7 min',
    content: [
      'O mercado imobiliario brasileiro movimenta bilhoes de reais por ano. E os corretores que usam tecnologia para prospectar tem uma vantagem enorme sobre a concorrencia.',
      'Uma das estrategias mais eficientes e a extracao de leads de imobiliarias e corretores no Google Maps.',
      '',
      '## Por que prospectar imobiliarias?',
      'Imobiliarias sao intermediarias naturais. Elas tem acesso a proprietarios e compradores. Se voce oferecer um servico de valor para elas (captacao de clientes, por exemplo), pode fechar parcerias lucrativas.',
      '',
      '## O que extrair',
      'No Google Maps, voce encontra: nome da imobiliaria, telefone, WhatsApp, site, email, endereco, avaliacao dos clientes.',
      'Com o enriquecimento, da para descobrir o Instagram e Facebook da imobiliaria.',
      '',
      '## Estrategia de abordagem para imobiliarias',
      '1. Extraia leads de imobiliarias na sua regiao',
      '2. Analise o site e redes sociais da imobiliaria',
      '3. Prepare uma proposta de valor: como voce pode ajudar a gerar mais clientes',
      '4. Entre em contato pelo WhatsApp com uma mensagem personalizada',
      '',
      'Com o GeoLeads, voce consegue extrair centenas de imobiliarias em minutos e abordar todas pelo WhatsApp com templates personalizados.',
    ],
  },
  'enriquecimento-de-leads': {
    title: 'O Que e Enriquecimento de Leads e Por Que Voce Precisa',
    description: 'So ter o telefone nao basta. Saiba como enriquecer seus leads com email, CNPJ, Instagram e Facebook para aumentar suas chances de venda.',
    date: '28/05/2026',
    readTime: '4 min',
    content: [
      'Ter apenas o telefone de um lead limita suas opcoes de contato. Com o enriquecimento, voce adiciona camadas de informacao que aumentam dramaticamente suas chances de conversao.',
      '',
      '## O que e enriquecimento de leads?',
      'Enriquecimento e o processo de complementar os dados de um lead com informacoes adicionais obtidas de fontes publicas. No caso do GeoLeads, o enriquecimento visita o site do negocio e extrai:',
      '- Email de contato',
      '- CNPJ',
      '- Instagram',
      '- Facebook',
      '- TikTok',
      '',
      '## Por que enriquecer e importante?',
      '- Multiplos canais de contato: se o telefone nao responder, voce tem o email',
      '- Validacao: um lead com CNPJ e redes sociais e mais confiavel',
      '- Personalizacao: conhecendo as redes sociais, voce adapta a abordagem',
      '- Segmentacao: filtre leads que tem email ou Instagram para campanhas especificas',
      '',
      '## Enriquecimento automatico no GeoLeads',
      'O GeoLeads faz o enriquecimento automaticamente durante a extracao. Cada lead com site tem seus dados complementados em tempo real. E se um lead antigo precisar ser re-enriquecido, o botao "Re-enriquecer" no CRM faz isso em um clique.',
    ],
  },
};

export async function generateStaticParams() {
  return Object.keys(POSTS).map(slug => ({ slug }));
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const post = POSTS[params.slug];
  if (!post) return { title: 'Blog | GeoLeads' };

  return {
    title: `${post.title} | GeoLeads Blog`,
    description: post.description,
    openGraph: {
      title: post.title,
      description: post.description,
      type: 'article',
      publishedTime: post.date,
      locale: 'pt_BR',
    },
    twitter: { card: 'summary_large_image', title: post.title, description: post.description },
  };
}

export default function BlogPostPage({ params }: { params: { slug: string } }) {
  const post = POSTS[params.slug];

  if (!post) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Post nao encontrado</h1>
          <Link href="/blog" className="text-blue-400 hover:underline">Voltar ao blog</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <nav className="border-b border-white/5 bg-black/40 backdrop-blur-2xl sticky top-0 z-50">
        <div className="max-w-3xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="font-extrabold text-xl tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
              Geo<span className="text-blue-400">Leads</span>
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/blog" className="text-sm text-gray-400 hover:text-white transition-colors">Blog</Link>
            <Link href="/login?next=/app/dashboard" className="px-4 py-2 rounded-xl bg-blue-500 hover:bg-blue-400 text-black text-sm font-bold transition-colors">
              Testar Gratis
            </Link>
          </div>
        </div>
      </nav>
      <main className="max-w-3xl mx-auto px-4 py-12">
        <div className="mb-8">
          <Link href="/blog" className="text-sm text-blue-400 hover:underline mb-4 inline-block">&larr; Voltar ao blog</Link>
          <h1 className="text-2xl sm:text-4xl font-extrabold leading-tight">{post.title}</h1>
          <div className="flex items-center gap-3 text-sm text-gray-500 mt-4">
            <span>{post.date}</span>
            <span>·</span>
            <span>{post.readTime} de leitura</span>
          </div>
        </div>
        <article className="prose prose-invert max-w-none leading-relaxed text-gray-300 space-y-4">
          {post.content.map((line, i) => {
            if (line.startsWith('## ')) {
              return <h2 key={i} className="text-xl font-bold text-white mt-8 mb-4">{line.replace('## ', '')}</h2>;
            }
            if (line.startsWith('### ')) {
              return <h3 key={i} className="text-lg font-bold text-white mt-6 mb-3">{line.replace('### ', '')}</h3>;
            }
            if (line.startsWith('- ')) {
              return <li key={i} className="text-gray-300 ml-4">{line.replace('- ', '')}</li>;
            }
            if (line === '') return <div key={i} className="h-2" />;
            return <p key={i} className="text-gray-300 leading-relaxed">{line}</p>;
          })}
        </article>
        <div className="mt-12 p-6 rounded-2xl bg-gradient-to-b from-blue-500/10 to-transparent border border-blue-500/20 text-center">
          <h3 className="text-xl font-bold mb-2">Quer extrair leads agora?</h3>
          <p className="text-gray-400 mb-4">Teste o GeoLeads gratuitamente. Sem cartao de credito.</p>
          <Link href="/login?next=/app/dashboard" className="inline-block px-6 py-3 rounded-xl bg-blue-500 hover:bg-blue-400 text-black font-bold transition-colors">
            Testar Gratis
          </Link>
        </div>
      </main>
    </div>
  );
}
