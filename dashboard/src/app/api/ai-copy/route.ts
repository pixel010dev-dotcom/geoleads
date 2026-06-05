import { NextResponse } from 'next/server';
import { getAuthUser, requireFeature } from '@/lib/server-auth';

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

const parseCopies = (text: string): CopyResult[] => {
  const cleaned = text.trim().replace(/^```json/i, '').replace(/^```/i, '').replace(/```$/i, '').trim();
  const parsed = JSON.parse(cleaned);
  const items = Array.isArray(parsed) ? parsed : parsed?.copies;

  if (!Array.isArray(items)) return [];

  return items
    .map((item) => ({
      title: sanitize(item?.title, 'Modelo de abordagem'),
      desc: sanitize(item?.desc, 'Copy gerada para prospecção.'),
      text: sanitize(item?.text)
    }))
    .filter((item) => item.title && item.desc && item.text)
    .slice(0, 6);
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

    const body = await request.json();
    const product = sanitize(body.product);
    const value = sanitize(body.value);
    const tone = sanitize(body.tone, 'persuasive');
    const channel = sanitize(body.channel, 'mixed');
    const audience = sanitize(body.audience, 'empresas locais');

    if (!product || !value) {
      return NextResponse.json({ error: 'Preencha o produto e a proposta de valor.' }, { status: 400 });
    }

    const localCopies = buildLocalCopies({ product, value, tone, channel, audience });
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json({
        success: true,
        source: 'local_fallback',
        model: 'local',
        copies: localCopies
      });
    }

    const model = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
    const toneText = toneLabels[tone] || toneLabels.persuasive;
    const channelText = channelLabels[channel] || channelLabels.mixed;
    const variationSeed = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    const prompt = `Você é um copywriter B2B especialista em prospecção fria por ${channelText}.
Gere 4 modelos diferentes em português do Brasil para abordagem comercial.

Oferta:
- Produto/serviço: ${product}
- Principal ganho prometido: ${value}
- Público alvo: ${audience}
- Tom: ${toneText}
- Semente de variação: ${variationSeed}

Regras obrigatórias:
- Use abordagem ética, humana e sem promessa milagrosa.
- Não diga que já conversou com o lead.
- Varie abertura, ângulo, CTA e tamanho entre os modelos.
- Use placeholders compatíveis com o GeoLeads: ${tags}.
- Para WhatsApp, mantenha mensagens naturais e curtas.
- Para e-mail, inclua assunto no campo text.

Responda somente JSON válido, como array de objetos.
Cada objeto deve ter exatamente:
- "title": string
- "desc": string
- "text": string`;

    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.92,
          topP: 0.95,
          responseMimeType: 'application/json'
        }
      })
    });

    if (!res.ok) {
      return NextResponse.json({
        success: true,
        source: 'local_fallback',
        model: 'local',
        warning: `Gemini indisponível (${res.status}). Usei modelos locais.`,
        copies: localCopies
      });
    }

    const data = await res.json();
    const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const copies = parseCopies(textResponse);

    return NextResponse.json({
      success: true,
      source: copies.length > 0 ? 'gemini_ai' : 'local_fallback',
      model: copies.length > 0 ? model : 'local',
      copies: copies.length > 0 ? copies : localCopies
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'erro desconhecido';
    console.error('ERRO NO COPYWRITER IA:', message);

    return NextResponse.json({
      error: `Erro ao gerar cópias: ${message}`
    }, { status: 500 });
  }
}
