import { NextRequest, NextResponse } from 'next/server';

const GEOLEADS_GUIDE = `GUIA COMPLETO: COMO EXTRAIR LEADS DO GOOGLE MAPS
=====================================================
Material gratuito — GeoLeads (geoleads.app)

O que você vai aprender:
  ✓ O que é extração de leads
  ✓ Por que Google Maps é a melhor fonte
  ✓ 5 nichos mais lucrativos pra começar
  ✓ Como evitar bloqueios
  ✓ Templates de mensagens que convertem

1. O QUE É EXTRAÇÃO DE LEADS?
──────────────────────────────
É o processo de buscar dados públicos de empresas no Google Maps
(nome, telefone, endereço, site, avaliação) e organizar numa planilha
pra você entrar em contato depois.

Com o GeoLeads, isso é 100% automático:
  → Escolhe o nicho (pizzaria, salão, academia...)
  → Escolhe a cidade
  → O sistema extrai centenas de leads em minutos
  → Pronto pra exportar ou enviar mensagem

2. POR QUE GOOGLE MAPS?
────────────────────────
   • Dados atualizados (empresas ativas)
   • Telefones com WhatsApp na maioria
   • Avaliações reais (sabe quem é bom)
   • Endereço + site + Instagram quando tem
   • 100% gratuito (só sua API key do Google)

3. 5 NICHOS MAIS LUCRATIVOS
────────────────────────────
  1) Restaurantes e Pizzarias   — sempre precisam de clientes
  2) Salões e Barbearias        — agenda vazia = prejuízo
  3) Mercados e Padarias        — concorrência alta
  4) Clínicas Odontológicas     — pacientes todo mês
  5) Pet Shops                  — mercado em crescimento

4. COMO EVITAR BLOQUEIO
────────────────────────
  • Máx 10-15 mensagens/dia por número
  • Delay de 5 a 15 minutos entre cada
  • Pausa de 2h a cada 5 envios
  • Só enviar em horário comercial (8h-20h)
  • Sempre pular números sem WhatsApp
  • Monitorar respostas e responder rápido

5. TEMPLATES QUE CONVERTEM
───────────────────────────
  "Olá {nome}! Tudo bem? Vi seu negócio no Google.
   Trabalho com prospecção automática no WhatsApp.
   Chama WhatsAI. Já ouviu falar?"

  "Oi {nome}! Tudo certo? Meu sistema encontra
   clientes no WhatsApp automaticamente pro seu
   negócio. Quer ver como funciona em 2 minutos?"

=========================================
Quer extrair leads agora?
Acesse: https://geoleads-production-6583.up.railway.app
=========================================
`;

const WHATSAI_TEMPLATES = `TEMPLATES DE MENSAGENS WHATSAPP QUE CONVERTEM
================================================
Material gratuito — WhatsAI (whatsai.app)

Índice:
  1. Templates por nicho
  2. Como personalizar
  3. Frases de abertura que funcionam
  4. Lidando com objeções
  5. Call to Action que vende

1. TEMPLATES POR NICHO
───────────────────────

RESTAURANTES:
  "Olá {nome}! Tudo bem? Vi seu restaurante no Google.
   Trabalho com prospecção automática no WhatsApp.
   Posso te mostrar como conseguir mais clientes?"

  "Oi {nome}! Vi que você tem um restaurante.
   Meu sistema encontra clientes no WhatsApp
   e leva mais gente até você. Interessado?"

SALÕES DE BELEZA:
  "Olá {nome}! Tudo bem? Vi seu salão no Google.
   Já pensou em ter um robô que prospecta
   clientes no WhatsApp pra você?"

  "Oi {nome}! Tenho uma ferramenta que envia
   mensagens automáticas no WhatsApp pra
   divulgar seu salão. Quer conhecer?"

ADVOCACIA:
  "Olá {nome}! Tudo bem? Vi seu escritório.
   Meu sistema encontra clientes no WhatsApp
   automaticamente pra advocacia. Topa ver?"

MERCADOS:
  "Olá {nome}! Tudo joia? Seu mercado apareceu
   no Google. Meu sistema divulga mercados
   no WhatsApp automaticamente. Quer saber?"

2. COMO PERSONALIZAR
────────────────────
  • Sempre use o nome da pessoa (não da empresa)
  • Mencione o nicho específico
  • Seja direto — ninguém tem paciência
  • Mostre benefício, não funcionalidade

3. FRASES DE ABERTURA QUE FUNCIONAM
────────────────────────────────────
  "Olá {nome}! Tudo bem?"
  "Oi {nome}! Tudo certo?"
  "E aí {nome}! Beleza?"
  "Bom dia {nome}! Tudo joia?"

  Evite: "Prezado", "Caro", "Gostaríamos de"

4. LIDANDO COM OBJEÇÕES
────────────────────────
  "Não tenho interesse" → "Entendo! Só pra saber,
  você já usa alguma forma de prospecção automática?"

  "Manda mais info" → "Claro! Resumindo: o sistema
  encontra clientes e manda msg no WhatsApp
  automático. Quer ver uma demo rápida?"

  "Quanto custa" → "R$29,90/mês com 7 dias grátis.
  Quer testar sem compromisso?"

5. CALL TO ACTION QUE VENDE
───────────────────────────
  ✓ "Quer ver como funciona?"
  ✓ "Topa uma demonstração rápida?"
  ✓ "Posso te mostrar em 2 minutos"
  ✓ "Quer testar grátis por 7 dias?"

=========================================
Quer automatizar agora?
Acesse: https://whatsai-app-production.up.railway.app
=========================================
`;

const CONTENT: Record<string, string> = {
  'guia-extracao-leads': GEOLEADS_GUIDE,
  'templates-whatsapp': WHATSAI_TEMPLATES,
};

export async function GET(req: NextRequest) {
  const file = req.nextUrl.searchParams.get('file');
  const product = req.nextUrl.searchParams.get('product');

  const content = file && CONTENT[file];

  if (!content) {
    return NextResponse.json({ error: 'Arquivo não encontrado' }, { status: 404 });
  }

  const filename = file!.includes('.txt') ? file! : `${file}.txt`;

  return new NextResponse(content, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-cache',
    },
  });
}
