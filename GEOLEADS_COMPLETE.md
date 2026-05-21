# GEOLEADS - Documentação Completa do SaaS

> Data: 21/05/2026
> Repositório: https://github.com/pixel010dev-dotcom/geoleads.git
> Deploy: Railway (projeto `celebrated-wholeness`)

---

## 1. VISÃO GERAL

GeoLeads é um SaaS de extração de leads B2B que busca empresas no Google Maps, enriquece dados (e-mail, CNPJ, redes sociais) e oferece CRM + disparador WhatsApp + chatbot + IA para cópias de vendas.

---

## 2. ESTRUTURA DO PROJETO

```
lead_extractor_saas/
├── Dockerfile                    # Build Docker para Railway (Node 20 + Chrome)
├── railway.toml                  # Config Railway (DOCKERFILE builder)
├── motor_playwright.js           # Protótipo inicial do motor (não usado mais)
├── supabase/
│   └── schema.sql                # Schema completo do banco (rodar no Supabase SQL Editor)
├── dashboard/                    # Next.js App Router (Frontend + API)
│   ├── .env.local                # Chaves: Supabase, Mercado Pago
│   ├── package.json
│   ├── src/
│   │   ├── app/
│   │   │   ├── globals.css       # Estilos globais + animações
│   │   │   ├── layout.tsx        # Layout root
│   │   │   ├── page.tsx          # Dashboard principal (Motor, CRM, WhatsApp, Chatbot, IA, Suporte)
│   │   │   ├── login/page.tsx    # Tela de login/cadastro com email ou Google
│   │   │   ├── pricing/page.tsx  # Planos e pagamento PIX/cartão
│   │   │   ├── account/page.tsx  # Minha conta (tokens, plano, histórico)
│   │   │   ├── api/
│   │   │   │   ├── extract/route.ts           # Motor de extração (Playwright)
│   │   │   │   ├── checkout/route.ts          # Criar pagamento PIX/cartão
│   │   │   │   ├── checkout/status/route.ts   # Polling status do PIX
│   │   │   │   ├── chatbot/route.ts           # WhatsApp Chatbot (Baileys)
│   │   │   │   ├── ai-copy/route.ts           # IA generativa de cópias
│   │   │   │   └── mercado-pago/webhook/route.ts  # Webhook de pagamento
│   │   ├── lib/
│   │   │   ├── supabase.ts          # Cliente Supabase
│   │   │   ├── server-auth.ts        # Autenticação server-side
│   │   │   ├── plans.ts             # Definição de planos e features
│   │   │   ├── mercadopago-pix.ts    # Criar PIX no Mercado Pago
│   │   │   ├── mercadopago-checkout.ts # Preferência Checkout Pro
│   │   │   └── mercadopago-webhook.ts  # Processar webhook e creditar tokens
│   │   └── components/
│   │       ├── Globe.tsx            # Globo 3D animado (logo)
│   │       └── HackerRadar.tsx      # Radar cyberpunk (loading da extração)
```

---

## 3. PLANOS E PREÇOS

| Plano | Preço | Tokens | Features |
|-------|-------|--------|----------|
| Free | R$ 0 | 10 | Motor básico |
| Inicial | R$ 19,90 | 1.000 | CRM, CSV, Email, CNPJ |
| Profissional | R$ 49,90 | 3.500 | + Redes sociais, WhatsApp, IA |
| Max | R$ 97 | 10.000 | + Chatbot, Suporte prioritário |

Sistema de tokens: 1 token = 1 lead extraído. Compra-se no /pricing.

---

## 4. FUNCIONALIDADES PRINCIPAIS

### 4.1 Motor de Extração (`/api/extract`)
- Playwright headless Chromium no servidor
- Busca no Google Maps por termo + cidade
- Extrai: nome, telefone, avaliação, site
- Enriquecimento: visita site oficial → email, CNPJ, Instagram, Facebook, TikTok
- Corretor ortográfico inteligente (Levenshtein + dicionário)
- Normalizador de cidades (sp → São Paulo, bh → Belo Horizonte, etc.)
- Filtros: phone, email, insta, face, tiktok, cnpj, site
- Consome tokens do usuário

### 4.2 CRM (/dashboard tab "CRM")
- Salva leads com etapa do funil (Novo → Em Contato → Proposta → Fechado/Perdido)
- Anotações por lead
- Sincronia cloud (Supabase) + local (localStorage)
- Seleção múltipla e exclusão em lote
- Busca e filtro por etapa

### 4.3 Disparador WhatsApp (/dashboard tab "WhatsApp")
- Abre WhatsApp Web com mensagem personalizada
- Templates pré-definidos de abordagem
- Geração de templates com IA (Gemini ou fallback local)
- Fila assistida com delay configurável e variação humana
- Placeholders: {Nome}, {Cidade}, {Nicho}, {Site}, {Telefone}

### 4.4 Chatbot WhatsApp (/dashboard tab "Chatbot")
- Baseado em Baileys (WhatsApp Web API não oficial)
- QR Code para conectar
- Regras automáticas (palavra-chave → resposta)
- Configuração persistida no Supabase

### 4.5 Gerador de Cópias IA (/dashboard tab "IA")
- Gera mensagens de vendas com Gemini AI
- Fallback local (modelos pré-definidos)
- Tons: persuasivo, profissional, consultivo, casual

### 4.6 Pagamento PIX (/pricing)
- Gera QR Code PIX via Mercado Pago API
- Modal animado com QR Code + código copia-e-cola
- Polling automático a cada 5s
- Webhook para crédito automático de tokens
- Cartão via Checkout Pro (redireciona para MP)

---

## 5. TECNOLOGIAS

| Camada | Tecnologia |
|--------|-----------|
| Frontend | Next.js 15 (App Router), React, TailwindCSS |
| Backend | Next.js API Routes |
| Banco | Supabase (PostgreSQL) |
| Auth | Supabase Auth (email + Google OAuth) |
| Pagamento | Mercado Pago (PIX + Checkout Pro) |
| Scraping | Playwright (Chromium) |
| IA | Google Gemini API |
| WhatsApp | Baileys |
| Hospedagem | Railway (Docker) |
| Domínio | (pendente) |

---

## 6. INFRAESTRUTURA

### 6.1 Supabase
- Project URL: https://mwnpwrzwgwrqqlomqhux.supabase.co
- Rodar `supabase/schema.sql` no SQL Editor para criar:
  - profiles (tokens, plan_id)
  - crm_leads (lead_key, stage, notes, payload)
  - chatbot_configs (rules, business_name)
  - payment_history (mp_payment_id, tokens_added)
  - cnpj_companies (base de CNPJ)
  - social_enrichment_cache (cache de redes sociais)
- Trigger: `on_auth_user_created` → cria profile com 10 tokens grátis

### 6.2 Railway
- Projeto: `celebrated-wholeness`
- Build: Dockerfile
- Variáveis de ambiente necessárias:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `MERCADO_PAGO_ACCESS_TOKEN`
  - `NEXT_PUBLIC_APP_URL` (URL do deploy)
  - `GEMINI_API_KEY` (opcional, fallback local)

### 6.3 Mercado Pago
- Access Token: APP_USR-... (configurado)
- Webhook URL: `{APP_URL}/api/mercado-pago/webhook`
- Configurar no painel MP: Produção → Webhooks → apontar para a URL acima

---

## 7. VARIÁVEIS DE AMBIENTE (.env.local)

```
NEXT_PUBLIC_SUPABASE_URL=https://mwnpwrzwgwrqqlomqhux.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
MERCADO_PAGO_ACCESS_TOKEN=APP_USR-...
NEXT_PUBLIC_APP_URL=http://localhost:3000
GEMINI_API_KEY=                   # ← PRECISA SER PREENCHIDA
```

---

## 8. AREAS QUE PRECISAM DE ATENÇÃO

### 8.1 Gemini API Key
- `GEMINI_API_KEY` está vazia no `.env.local`
- A IA de cópias funciona com fallback local, mas não usa Gemini até preencher
- Obter em: https://aistudio.google.com/apikey

### 8.2 Mercado Pago Produção
- Token atual é de TESTE
- Para produção: ativar credenciais de produção no MP (precisa de site oficial)
- Configurar webhook no painel MP após deploy

### 8.3 Login com Google
- Botão existe mas desabilitado (mostra "Em breve")
- Ativar no Supabase: Authentication → Providers → Google
- Criar projeto no Google Cloud Console, gerar Client ID

### 8.4 Domínio Personalizado
- Adquirir domínio (ex: geoleads.com.br)
- Configurar no Railway: Settings → Custom Domain

### 8.5 WhatsApp Chatbot
- Usa Baileys (biblioteca não oficial)
- Sessão é em memória (Map), não persiste entre deploys
- Ideal: salvar credenciais no Supabase

---

## 9. COMANDOS ÚTEIS

```bash
# Desenvolvimento
cd dashboard && npm run dev

# Build
cd dashboard && npm run build

# Railway Deploy
railway up

# Git Push
git add . && git commit -m "mensagem" && git push origin main
```

---

## 10. MONETIZAÇÃO

1. Cliente acessa `/pricing`
2. Escolhe plano (Inicial R$19,90 / Pro R$49,90 / Max R$97)
3. Gera PIX via Mercado Pago
4. Paga → Webhook chega → Tokens creditados automaticamente
5. Cliente extrai leads consumindo tokens
6. Quando acabar, compra novamente

---

## 11. PRÓXIMOS PASSOS (prioridade)

1. ⬜ Preencher GEMINI_API_KEY
2. ⬜ Fazer deploy no Railway (railway up)
3. ⬜ Rodar schema.sql no Supabase SQL Editor
4. ⬜ Configurar webhook do MP no painel Mercado Pago
5. ⬜ Ativar Google Login no Supabase + Google Cloud
6. ⬜ Comprar domínio e configurar SSL
7. ⬜ Ativar credenciais de produção do MP
8. ⬜ Melhorar persistência do WhatsApp chatbot (salvar credenciais)
9. ⬜ Adicionar integração WhatsApp para disparo real (CRM de mensagens)
10. ⬜ Criar landing page de vendas

---

## 12. ARQUITETURA DE SEGURANÇA

- Autenticação: Supabase Auth (RLS habilitado em todas as tabelas)
- Server-side: validação de token JWT em todas as APIs
- Admin: apenas com SUPABASE_SERVICE_ROLE_KEY (webhook)
- Tokens: debitados após extração bem-sucedida
- Pagamento: processado pelo Mercado Pago (nunca lidamos com cartão)
- RLS Policies:
  - profiles: SELECT/UPDATE only own
  - crm_leads: CRUD only own
  - payment_history: SELECT own, INSERT service
  - cnpj_companies: SELECT public, INSERT/UPDATE service
