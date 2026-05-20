import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { product, value, tone } = await request.json();

    if (!product || !value) {
      return NextResponse.json({ error: 'Preencha o produto e a proposta de valor.' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;

    // Se NÃO tiver chave API configurada, usamos os templates de fallback avançados
    if (!apiKey) {
      return NextResponse.json({
        success: true,
        source: 'local_fallback',
        copies: [
          {
            title: '📱 WhatsApp: Abordagem Curiosa (Alto engajamento)',
            desc: 'Ideal para quebrar o gelo e iniciar uma conversa fluida de forma informal.',
            text: `Olá {Nome}, tudo bem? Vi a página da sua empresa no Google e notei que vocês atendem em {Cidade}.\n\nTrabalho com ${product} especificamente para o nicho de {Nicho} e identifiquei 2 pontos no perfil de vocês que podem estar fazendo vocês perderem clientes para a concorrência hoje.\n\nSe eu te enviar um áudio de 45 segundos explicando como ajustar isso para ${value}, faria sentido para você?`
          },
          {
            title: '⚡ WhatsApp: Oferta Direta com Proposta de Valor',
            desc: 'Vá direto ao ponto focando no principal ganho que seu produto entrega.',
            text: `Olá {Nome}! Meu nome é Rodrigo, sou especialista em aceleração de negócios locais.\n\nAchei sua empresa em {Cidade} e vi que prestam um excelente serviço. Nós ajudamos empresas do nicho de {Nicho} a ${value} através do nosso método de ${product}.\n\nVocê teria 5 minutos para uma rápida ligação amanhã às 14h para vermos se conseguimos replicar esse resultado para a sua empresa?`
          },
          {
            title: '✉️ Cold Email: Estruturado de Alta Conversão',
            desc: 'Um e-mail profissional, conciso e com gatilhos mentais perfeitos.',
            text: `Assunto: Parceria comercial / Nova demanda de clientes para {Nome}\n\nOlá Equipe da {Nome},\n\nEspero que este e-mail os encontre bem.\n\nEstava mapeando as empresas de {Nicho} em {Cidade} e o perfil de vocês se destacou pela ótima nota de avaliação.\n\nDesenvolvemos uma solução de ${product} que tem como único objetivo ajudar vocês a ${value}.\n\nFaz sentido agendarmos uma conversa rápida de 10 minutos nesta semana para eu te mostrar como ajudamos negócios parecidos a crescerem?\n\nQual o melhor dia e horário para você?\n\nAbraço,\n[Seu Nome]\n[Seu Telefone]`
          }
        ]
      });
    }

    // Tradução amigável do tom para o prompt
    const toneText = tone === 'direct' ? 'Direto e Objetivo' 
                   : tone === 'curious' ? 'Curioso e Provocativo' 
                   : 'Persuasivo e Marcante';

    // Prompt detalhado solicitando resposta estritamente estruturada em JSON
    const prompt = `Você é um copywriter de elite especialista em vendas frias (outbound).
Gere 3 roteiros de vendas (copys) em português para prospecção fria baseados nestas informações:
- Produto/Serviço oferecido: ${product}
- Principal benefício/Ganho do cliente: ${value}
- Tom de voz: ${toneText}

IMPORTANTE: Você DEVE usar estritamente os seguintes placeholders/tags ao longo do texto dos roteiros, para que possamos substituí-los dinamicamente depois:
- {Nome} (para o nome da empresa/lead)
- {Cidade} (para a cidade da empresa)
- {Nicho} (para o nicho/ramo de atuação da empresa)
- {Site} (para o site comercial)
- {Telefone} (para o telefone de contato)

Exemplo de uso das tags: "Olá {Nome}, vi que vocês prestam serviços em {Cidade}..."

Estruture os 3 roteiros como um array JSON de objetos. Cada objeto deve possuir exatamente estas 3 chaves:
1. "title": Título curto do roteiro (ex: "📱 WhatsApp: Abordagem Curiosa")
2. "desc": Breve descrição de 1 frase explicando quando usar essa copy.
3. "text": O texto completo do roteiro (com parágrafos e quebras de linha normais \\n, contendo as tags descritas acima).

Responda APENAS com o JSON válido. Não inclua nenhuma explicação adicional, introdução ou formatação Markdown (como \`\`\`json ... \`\`\`).`;

    // Chamada à API do Gemini
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          responseMimeType: "application/json"
        }
      })
    });

    if (!res.ok) {
      throw new Error(`Falha na API do Gemini: ${res.statusText}`);
    }

    const data = await res.json();
    let textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // Limpeza de possíveis blocos de código Markdown gerados pelo modelo
    textResponse = textResponse.trim();
    if (textResponse.startsWith('```')) {
      textResponse = textResponse.replace(/^```(json)?/, '').replace(/```$/, '').trim();
    }

    const copies = JSON.parse(textResponse);

    return NextResponse.json({
      success: true,
      source: 'gemini_ai',
      copies
    });

  } catch (error: any) {
    console.error("ERRO NO COPYWRITER IA:", error.message);
    return NextResponse.json({ error: 'Erro ao gerar cópias: ' + error.message }, { status: 500 });
  }
}
