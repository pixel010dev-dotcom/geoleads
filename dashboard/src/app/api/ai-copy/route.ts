import { NextResponse } from 'next/server';
import { getAuthUser, requireFeature } from '@/lib/server-auth';
import { AIProvider } from '@/lib/ai-provider';
import { checkApiRateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type CopyResult = {
  title: string;
  desc: string;
  text: string;
};

const tags = '{Nome}, {Cidade}, {Nicho}, {Site}, {Telefone}';

const toneLabels: Record<string, string> = {
  persuasive: 'persuasivo, consultivo e convincente',
  direct: 'curto, direto e objetivo',
  curious: 'curioso, provocativo e leve',
  friendly: 'humano, próximo e natural'
};

const channelLabels: Record<string, string> = {
  whatsapp: 'WhatsApp',
  email: 'Cold Email',
  mixed: 'WhatsApp e Cold Email'
};

const pick = <T,>(items: T[], offset = 0) => items[(Math.floor(Math.random() * items.length) + offset) % items.length];

const shuffle = <T,>(items: T[]) => {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

const sanitize = (value: unknown, fallback = '') => (
  typeof value === 'string' ? value.trim().slice(0, 800) : fallback
);

const buildLocalCopies = ({
  product,
  value,
  tone,
  channel,
  audience
}: {
  product: string;
  value: string;
  tone: string;
  channel: string;
  audience: string;
}): CopyResult[] => {
  const toneHint = toneLabels[tone] || toneLabels.persuasive;
  const audienceHint = audience || 'empresas locais';
  const proof = pick([
    'sem depender de indicação todo mês',
    'com uma abordagem mais previsível',
    'sem aumentar sua rotina operacional',
    'com um plano simples de primeira conversa'
  ]);
  const hook = pick([
    'vi o perfil de vocês no Google',
    'estava mapeando empresas da região',
    'notei que vocês aparecem para buscas locais',
    'estava olhando negócios de {Nicho} em {Cidade}'
  ]);
  const cta = pick([
    'posso te mandar uma ideia rápida por aqui?',
    'faz sentido eu te explicar em 2 mensagens?',
    'quer que eu te mostre um exemplo aplicado ao negócio de vocês?',
    'posso te enviar um diagnóstico simples?'
  ]);

  const whatsappCopies: CopyResult[] = [
    {
      title: 'WhatsApp: Abertura consultiva',
      desc: `Primeiro contato ${toneHint} para validar interesse sem parecer spam.`,
      text: `Olá {Nome}, tudo bem? ${hook} e vi que vocês atuam com {Nicho} em {Cidade}.\n\nHoje eu ajudo ${audienceHint} com ${product} para ${value}, ${proof}.\n\n${cta}`
    },
    {
      title: 'WhatsApp: Dor + solução',
      desc: 'Boa para leads frios quando você quer abrir conversa com contexto.',
      text: `Oi {Nome}! Uma coisa que vejo bastante em empresas de {Nicho} é ter bom serviço, mas pouca previsibilidade para atrair novos clientes em {Cidade}.\n\nMeu trabalho com ${product} é ajudar exatamente nisso: ${value}.\n\nSe fizer sentido, eu posso te mandar uma sugestão curta para aplicar no caso de vocês.`
    },
    {
      title: 'WhatsApp: Diagnóstico gratuito',
      desc: 'Modelo leve para oferecer análise antes de vender.',
      text: `Olá {Nome}. Fiz uma análise rápida do posicionamento online de empresas de {Nicho} em {Cidade} e encontrei alguns pontos que costumam travar novas oportunidades.\n\nEu trabalho com ${product} para ${value}.\n\nQuer que eu te mande um diagnóstico gratuito e direto ao ponto?`
    },
    {
      title: 'WhatsApp: Parceria local',
      desc: 'Abordagem mais suave para nichos sensíveis.',
      text: `Oi {Nome}, tudo certo? Estou buscando empresas de {Nicho} em {Cidade} para uma possível parceria local.\n\nA ideia é usar ${product} para ${value} sem atrapalhar a rotina da equipe.\n\nFaz sentido conversarmos por aqui?`
    }
  ];

  const emailCopies: CopyResult[] = [
    {
      title: 'Email: Proposta objetiva',
      desc: 'Email curto para apresentar valor e pedir uma conversa rápida.',
      text: `Assunto: Ideia para {Nome} em {Cidade}\n\nOlá, equipe da {Nome}.\n\nEncontrei vocês pesquisando empresas de {Nicho} em {Cidade} e achei que faria sentido compartilhar uma ideia.\n\nTrabalho com ${product} para ajudar ${audienceHint} a ${value}.\n\nSe for prioridade para vocês, posso te mostrar em 10 minutos como isso funcionaria na prática.\n\nQual melhor horário esta semana?`
    },
    {
      title: 'Email: Diagnóstico',
      desc: 'Útil quando a oferta depende de mostrar oportunidade antes.',
      text: `Assunto: Diagnóstico rápido para {Nome}\n\nOlá.\n\nEstava analisando negócios de {Nicho} em {Cidade} e vi uma oportunidade simples para melhorar a captação de clientes da {Nome}.\n\nMinha solução de ${product} tem foco em ${value}.\n\nPosso enviar um diagnóstico gratuito com 2 ou 3 pontos práticos?`
    }
  ];

  const pool = channel === 'email' ? emailCopies : channel === 'mixed' ? [...whatsappCopies, ...emailCopies] : whatsappCopies;
  return shuffle(pool).slice(0, 4);
};

const tryParseJSON = (text: string): CopyResult[] => {
  let cleaned = text.trim();
  cleaned = cleaned.replace(/^```json\s*/i, '');
  cleaned = cleaned.replace(/^```\s*/i, '');
  cleaned = cleaned.replace(/\s*```$/i, '');
  cleaned = cleaned.trim();

  try {
    const parsed = JSON.parse(cleaned);
    const items = Array.isArray(parsed) ? parsed : parsed?.copies;
    if (!Array.isArray(items)) return [];
    return items
      .map((item: unknown) => ({
        title: sanitize((item as Record<string, unknown>)?.title, 'Modelo de abordagem'),
        desc: sanitize((item as Record<string, unknown>)?.desc, 'Copy gerada para prospecção.'),
        text: sanitize((item as Record<string, unknown>)?.text)
      }))
      .filter((item) => item.title && item.desc && item.text)
      .slice(0, 6);
  } catch {
    const braceMatch = cleaned.match(/(\[[\s\S]*?\])/);
    if (braceMatch) {
      try {
        const parsed = JSON.parse(braceMatch[0]);
        if (Array.isArray(parsed)) {
          return parsed
            .map((item: unknown) => ({
              title: sanitize((item as Record<string, unknown>)?.title, 'Modelo'),
              desc: sanitize((item as Record<string, unknown>)?.desc, ''),
              text: sanitize((item as Record<string, unknown>)?.text)
            }))
            .filter((item) => item.title && item.text)
            .slice(0, 6);
        }
      } catch { /* empty */ }
    }
    return [];
  }
};

const buildCopyPrompt = ({
  product, value, tone, channel, audience,
  leadName, leadCompany, leadCity, leadNiche
}: {
  product: string; value: string; tone: string; channel: string; audience: string;
  leadName?: string; leadCompany?: string; leadCity?: string; leadNiche?: string;
}): string => {
  const toneText = toneLabels[tone] || toneLabels.persuasive;
  const channelText = channelLabels[channel] || channelLabels.mixed;

  const leadContext = (leadName || leadCompany)
    ? `\n\nCONTEXTO DO LEAD:\n- Nome: ${leadName || '—'}\n- Empresa: ${leadCompany || '—'}\n- Cidade: ${leadCity || '—'}\n- Nicho: ${leadNiche || audience}\n`
    : `\n- Público alvo: ${audience}\n`;

  return `Você é um copywriter B2B especialista em prospecção fria por ${channelText}.

SUA OFERTA:
- Produto/serviço: ${product}
- Principal ganho prometido: ${value}${leadContext}
- Tom: ${toneText}

EXEMPLO DE COPY EXCELENTE (personalizada, específica, com contexto):
{
  "title": "WhatsApp: Abordagem consultiva com dado concreto",
  "desc": "Primeiro contato personalizado que mostra pesquisa prévia.",
  "text": "Olá {Nome}, vi que a {Empresa} tem um trabalho forte em {Nicho} em {Cidade}. Já ajudou empresas similares a {value}. Posso te mandar uma ideia rápida?"
}

EXEMPLO DE COPY RUIM (genérica, evite):
{
  "title": "WhatsApp: Genérica",
  "desc": "Abordagem sem personalização.",
  "text": "Olá, tudo bem? Gostaria de apresentar meu produto que é muito bom e vai ajudar sua empresa. Tem interesse?"
}

REGRAS OBRIGATÓRIAS:
- PERSONALIZE para o lead sempre que possível.
- Use abordagem ética, humana e sem promessa milagrosa.
- Não diga que já conversou com o lead.
- Varie abertura, ângulo, CTA e tamanho entre os modelos.
- Use placeholders: ${tags}.
- {Empresa} placeholder disponível para nome da empresa.
- Para WhatsApp: máximo 300 caracteres, linguagem natural.
- Para e-mail: máximo 500 caracteres, inclua assunto no campo "text" iniciando com "Assunto:".
- Seja específico, não genérico. Evite frases como "vi seu perfil" sem contexto.
- LGPD: não pareça spam, seja respeitoso.

Responda SOMENTE JSON válido, como array de objetos.
Cada objeto deve ter exatamente:
- "title": string (título curto descritivo)
- "desc": string (descrição de 1 linha)
- "text": string (copy completa)

Gere 4 modelos variados.`;
};

export async function POST(request: Request) {
  try {
    const auth = await getAuthUser(request);
    if (!auth) {
      return NextResponse.json({ error: 'Nao autenticado. Faca login para usar a IA.' }, { status: 401 });
    }

    if (!requireFeature(auth.planId, 'aiCopy')) {
      return NextResponse.json({ error: 'Gerador de copys com IA exige plano Profissional ou superior.' }, { status: 403 });
    }

    const rateLimit = checkApiRateLimit(`ai-copy:${auth.user.id}`);
    if (!rateLimit.allowed) {
      return NextResponse.json({ error: 'Muitas requisições. Aguarde 1 minuto.' }, { status: 429 });
    }

    const body = await request.json();
    const product = sanitize(body.product);
    const value = sanitize(body.value);
    const tone = sanitize(body.tone, 'persuasive');
    const channel = sanitize(body.channel, 'mixed');
    const audience = sanitize(body.audience, 'empresas locais');
    const leadName = sanitize(body.leadName);
    const leadCompany = sanitize(body.leadCompany);
    const leadCity = sanitize(body.leadCity);
    const leadNiche = sanitize(body.leadNiche);

    if (!product || !value) {
      return NextResponse.json({ error: 'Preencha o produto e a proposta de valor.' }, { status: 400 });
    }

    const localCopies = buildLocalCopies({ product, value, tone, channel, audience });

    const prompt = buildCopyPrompt({
      product, value, tone, channel, audience,
      leadName, leadCompany, leadCity, leadNiche
    });

    const result = await AIProvider.generate({
      messages: [
        { role: 'system', content: 'Você é um copywriter B2B especializado em prospecção fria. Gere apenas JSON válido.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.75,
      maxTokens: 2048,
    });

    if (!result.content || result.fromFallback) {
      return NextResponse.json({
        success: true,
        source: 'local_fallback',
        model: result.provider || 'local',
        warning: result.provider === 'security_filter'
          ? 'Entrada bloqueada pelo filtro de segurança.'
          : 'Provedores IA indisponíveis no momento. Usei modelos locais.',
        copies: localCopies
      });
    }

    const copies = tryParseJSON(result.content);

    return NextResponse.json({
      success: true,
      source: copies.length > 0 ? `${result.provider}_ai` : 'local_fallback',
      model: copies.length > 0 ? result.model : 'local',
      latency: result.latency,
      copies: copies.length > 0 ? copies : localCopies
    });

  } catch (error: unknown) {
    console.error('ERRO NO COPYWRITER IA:', error);

    return NextResponse.json({
      error: 'Erro ao gerar cópias. Tente novamente.'
    }, { status: 500 });
  }
}
