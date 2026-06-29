import { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/Button';

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
  'extracao-automatica-leads': {
    title: 'Extracao Automatica de Leads: Como Economizar Horas por Semana',
    description: 'Automatize a extracao de leads do Google Maps e economize dezenas de horas por semana. Ferramentas, roteiros e melhores praticas.',
    date: '20/06/2026',
    readTime: '6 min',
    content: [
      'Se voce ainda extrai leads manualmente do Google Maps — copiando telefone por telefone — esta perdendo dezenas de horas que poderiam ser usadas para vender.',
      'A extracao automatica de leads e o maior diferencial competitivo para quem trabalha com prospeccao digital.',
      '',
      '## Quanto tempo voce economiza?',
      'Uma pessoa leva em media 30 segundos para copiar os dados de um card do Google Maps. Em 100 leads, sao 50 minutos de trabalho braçal e repetitivo.',
      'Com uma ferramenta automatica, esses mesmos 100 leads sao extraidos em 5 a 10 minutos. Uma economia de 80% do tempo.',
      '',
      '## O que uma boa ferramenta de extracao deve ter',
      '- Busca por nicho e cidade: essencial para segmentar',
      '- Extracao de telefone, site, email e redes sociais',
      '- Enriquecimento automatico: visitar o site do lead e capturar dados extras',
      '- Exportacao CSV: para usar os leads em qualquer lugar',
      '- CRM integrado: para gerenciar o funil de vendas',
      '',
      '## O GeoLeads como solucao completa',
      'O GeoLeads foi construido para automatizar todo o processo. Voce informa o nicho e a cidade, e o sistema extrai, enriquece e organiza os leads automaticamente. Sem planilhas, sem copiar e colar.',
      'Teste gratuitamente e veja quanto tempo voce pode economizar.',
    ],
  },
  'whatsapp-marketing-automacao': {
    title: 'WhatsApp Marketing Automacao: Dispare sem Ser Bloqueado',
    description: 'Aprenda a automatizar disparos no WhatsApp sem risco de bloqueio. Estrategias de aquecimento, limites diarios e templates inteligentes.',
    date: '22/06/2026',
    readTime: '7 min',
    content: [
      'Automatizar disparos no WhatsApp e o sonho de todo vendedor digital. Mas fazer isso sem criterio e a receita para o bloqueio.',
      'A boa noticia? Existe uma forma inteligente de automatizar que respeita os limites da plataforma e mantem sua conta segura.',
      '',
      '## Por que contas sao bloqueadas?',
      'O WhatsApp detecta padroes de comportamento automatizado: envio simultaneo para muitos contatos, mensagens identicas, alta frequencia sem pausa.',
      'Para evitar bloqueios, a automatizacao precisa simular comportamento humano.',
      '',
      '## Estrategias de automacao segura',
      '',
      '### 1. Aquecimento gradual',
      'Nao comece disparando para 500 contatos no primeiro dia. Comece com 10-20 envios por dia e aumente gradualmente. Isso cria um historico de uso legitimo.',
      '',
      '### 2. Intervalo entre mensagens',
      'Cada envio deve ter um intervalo aleatorio de 30 a 90 segundos. Mensagens enviadas em rajadas sao facilmente detectadas como automacao.',
      '',
      '### 3. Variacao de mensagens',
      'Nao envie o mesmo texto para todos. Pequenas variacoes no template (nome, cidade, nicho) fazem cada mensagem parecer unica.',
      '',
      '### 4. Limite diario inteligente',
      'O ideal e nao ultrapassar 50-100 mensagens por dia por conta. Acima disso, o risco de bloqueio cresce exponencialmente.',
      '',
      '## Automacao assistida vs automacao cega',
      'O GeoLeads usa automacao assistida: as mensagens sao preparadas em fila, mas o usuario ve e autoriza o envio. Nada de disparo cego. Isso oferece o equilibrio perfeito entre produtividade e seguranca.',
    ],
  },
  'lead-generation-b2b-estrategias': {
    title: 'Lead Generation B2B: Estrategias Avancadas para 2026',
    description: 'As melhores estrategias de lead generation B2B para 2026. Da extracao ao fechamento, um guia completo para vender mais.',
    date: '24/06/2026',
    readTime: '8 min',
    content: [
      'Gerar leads B2B de qualidade e o maior desafio das empresas que vendem para outras empresas. Em 2026, as estrategias que funcionavam ha 2 anos ja nao entregam os mesmos resultados.',
      'Este guia reune as estrategias mais eficientes do momento.',
      '',
      '## 1. Extracao de leads nichada',
      'Em vez de comprar listas genericas de empresas, extraia leads segmentados do Google Maps. Voce define exatamente o nicho, a cidade e o porte da empresa que quer atingir.',
      'Isso garante leads qualificados desde o primeiro contato.',
      '',
      '## 2. Enriquecimento multicanal',
      'Um lead com telefone, email, Instagram e site e 5x mais valioso que um lead com apenas telefone. O enriquecimento permite abordar o cliente pelo canal que ele prefere.',
      '',
      '## 3. Abordagem personalizada em escala',
      'Com templates inteligentes e dados de enriquecimento, e possivel personalizar centenas de mensagens sem perder a escala. Use o nicho, a cidade e ate o Instagram do lead na abordagem.',
      '',
      '## 4. CRM com funil de vendas',
      'Nao adianta gerar leads se voce nao tem um processo para acompanha-los. Um CRM organiza os leads em etapas (novo, contatado, proposta, fechado) e dispara lembretes automaticos.',
      '',
      '## 5. Automacao que vende',
      'Ferramentas como AutoVendas permitem criar campanhas automaticas de lead gen: o sistema extrai, enriquece, aborda e gerencia o lead do inicio ao fim, com voce no controle.',
      '',
      'O GeoLeads reune todas essas estrategias em uma unica plataforma. Da extracao inteligente ao fechamento da venda.',
    ],
  },
  'analise-concorrencia-google-maps': {
    title: 'Como Analisar a Concorrencia pelo Google Maps',
    description: 'Descubra como usar o Google Maps para espionar concorrentes, identificar lacunas no mercado e encontrar nichos lucrativos.',
    date: '25/06/2026',
    readTime: '5 min',
    content: [
      'O Google Maps nao e so uma ferramenta de navegacao. E uma base de dados completa sobre concorrentes, tendencias de mercado e oportunidades de negocio.',
      'Neste artigo, voce vai aprender a usar o Maps para analisar a concorrencia e encontrar nichos lucrativos.',
      '',
      '## O que a avaliacao dos concorrentes revela',
      'Empresas com avaliacao acima de 4.5 estrelas e muitos reviews sao referencias no nicho. Analise o que elas estao fazendo de diferente: fotos, descricao, horario estendido, respostas a avaliacoes.',
      'Empresas com avaliacao baixa (menos de 3.5) representam oportunidades. Clientes insatisfeitos estao abertos a novas opcoes.',
      '',
      '## Densidade de concorrentes por regiao',
      'Pesquise um nicho em diferentes cidades e veja quantas empresas aparecem. Se uma cidade tem 200 dentistas e outra tem 20, a segunda tem menos concorrencia e mais potencial para quem esta comecando.',
      '',
      '## Nichos com baixa concorrencia digital',
      'Muitos negocios tradicionais (marceneiros, serralheiros, pintores) ainda nao tem presenca digital forte. Isso significa que eles sao mais faceis de abordar e tem maior necessidade dos seus servicos.',
      '',
      '## Ferramenta pratica',
      'Com o GeoLeads, voce pode extrair todos os concorrentes de um nicho e cidade, ver a distribuicao de avaliacoes, telefones e sites, e identificar exatamente onde estao as oportunidades.',
    ],
  },
  'vender-mais-whatsapp-business': {
    title: 'Como Vender Mais com WhatsApp Business: Guia Completo',
    description: 'Domine o WhatsApp Business para vendas. Catalogo, respostas rapidas, rotulos e integracao com CRM para fechar mais negocios.',
    date: '26/06/2026',
    readTime: '6 min',
    content: [
      'O WhatsApp Business e a versao gratuita e poderosa do WhatsApp para empresas. Com recursos que o WhatsApp comum nao oferece, ele pode transformar a forma como voce vende.',
      'Mas muitos empreendedores usam apenas para responder mensagens, ignorando funcionalidades que poderiam dobrar as vendas.',
      '',
      '## Recursos essenciais do WhatsApp Business para vendas',
      '',
      '### Catalogo de produtos',
      'Crie um catalogo com fotos, precos e descricoes dos seus servicos ou produtos. O cliente ve tudo sem sair do WhatsApp. Perda de tempo com "manda o catalogo ai" acaba.',
      '',
      '### Respostas rapidas',
      'Crie templates para as perguntas mais frequentes: "Qual o valor?", "Tem disponibilidade?", "Qual o prazo?". Uma resposta rapida salva minutos por atendimento.',
      '',
      '### Rotulos (etiquetas)',
      'Organize seus contatos em listas: Novo Cliente, Proposta Enviada, Fechou, Aguardando Retorno. Nunca mais perca o controle de onde esta cada negociacao.',
      '',
      '### Mensagem de ausencia e saudacao',
      'Configure mensagem automatica para quando voce estiver offline e uma saudacao para quando o cliente inicia a conversa. Profissionalismo 24h.',
      '',
      '## Integracao com CRM: o verdadeiro poder',
      'O GeoLeads integra o WhatsApp Business com o CRM. As conversas sao linkadas aos leads, e voce ve todo o historico de contato. Nao precisa mais anotar nada em bloco de notas.',
      'Com o disparador assistido, voce pode enviar mensagens em sequencia, com intervalos e templates personalizados. Tudo dentro da plataforma.',
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
            <Button href="/login?next=/app/dashboard" size="sm" className="bg-blue-500 hover:bg-blue-400 text-black shadow-none">
              Testar Gratis
            </Button>
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
          <Button href="/login?next=/app/dashboard" className="bg-blue-500 hover:bg-blue-400 text-black shadow-none">
            Testar Gratis
          </Button>
        </div>
      </main>
    </div>
  );
}
