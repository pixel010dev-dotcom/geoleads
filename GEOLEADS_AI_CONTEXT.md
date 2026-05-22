# GEOLEADS - CONTEXTO COMPLETO PARA IA

> Versão: 21/05/2026
> Deploy: https://geoleads-production.up.railway.app
> Último commit: 93c64e5

---

## 1. CHAVES E CREDENCIAIS (ler do .env.local)

```env
# Supabase (Banco + Auth)
NEXT_PUBLIC_SUPABASE_URL=https://mwnpwrzwgwrqqlomqhux.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im13bnB3cnp3Z3dycXFsb21xaHV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyMzg4MjQsImV4cCI6MjA5NDgxNDgyNH0.2gQPLPtkHXCItXSO3HEx_SfGckYZZNCC2Xv6vY93vmQ
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im13bnB3cnp3Z3dycXFsb21xaHV4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTIzODgyNCwiZXhwIjoyMDk0ODE0ODI0fQ.YVZQ3cPMJaPjBnggkEV4SxNeh4Y-PVisP2ST5YF0rl8

# Mercado Pago (Pagamentos)
MERCADO_PAGO_ACCESS_TOKEN=APP_USR-5707742565758256-051921-c508cef03e6602e38ec037568bd6a7c2-3414579388

# Gemini AI (Geração de cópias) - Preenchida
GEMINI_API_KEY=AIzaSyAV5qEALNBQwk-kxvdHwzjpgSaBdNeUOrY

# URL pública
NEXT_PUBLIC_APP_URL=https://geoleads-production.up.railway.app
```

**Onde estão configuradas:**
- `.env.local` (local, ignore pelo git)
- Railway Dashboard (produção): `https://railway.com/project/daa0713e-b687-49a8-a4f3-104fa143192b/service/fd85fae1-dc30-4bc1-8924-ec04be3b3ecb`

---

## 2. ARQUITETURA GERAL

```
┌─────────────────────────────────────────────┐
│              Next.js 16 App                  │
│           (App Router + React 19)            │
│                                              │
│  ┌─────────┐  ┌──────────┐  ┌────────────┐  │
│  │ Dashboard│  │  /pricing│  │  /login     │  │
│  │  (Tabs)  │  │  Planos  │  │  Auth       │  │
│  └────┬─────┘  └────┬─────┘  └──────┬─────┘  │
│       │             │               │        │
│  ┌────▼─────────────▼───────────────▼─────┐  │
│  │         API Routes (Next.js)           │  │
│  │                                        │  │
│  │  /api/extract      → Playwright        │  │
│  │  /api/checkout     → Mercado Pago      │  │
│  │  /api/checkout/status → Polling PIX    │  │
│  │  /api/mercado-pago/webhook → Webhook   │  │
│  │  /api/ai-copy      → Gemini AI         │  │
│  │  /api/chatbot      → Baileys WhatsApp  │  │
│  └──────────┬─────────────────────────────┘  │
│             │                                │
└─────────────┼────────────────────────────────┘
              │
    ┌─────────┴─────────┐
    │                   │
┌───▼────┐        ┌────▼──────┐
│Supabase│        │Mercado Pago│
│ Postgres│        │  PIX + CC  │
│ Auth   │        │ Webhook    │
└────────┘        └───────────┘
```

---

## 3. FUNCIONALIDADES DETALHADAS

### 3.1 Motor de Extração (`/api/extract`)
**Arquivo:** `src/app/api/extract/route.ts`

Fluxo:
1. Usuário autentica com Bearer JWT
2. Envia `{ keyword, location, limit, filterRule }`
3. Server valida tokens do usuário no Supabase
4. Lança Playwright Chromium headless
5. Abre `https://www.google.com/maps/search/{keyword} em {location}`
6. Rolagem infinita até atingir `limit` leads
7. Para cada lead, extrai: nome, telefone, avaliação, site
8. **Enriquecimento:** visita o site oficial, busca email, CNPJ, Instagram, Facebook, TikTok
9. Aplica filtros configurados
10. Debita tokens do usuário no Supabase
11. Retorna JSON com leads + stats

**Corretor Ortográfico:**
- Dicionário de erros comuns (`adivogado → advogado`, `pissaria → pizzaria`)
- Levenshtein distance contra 60+ nichos comerciais brasileiros
- Normalizador de cidades (`sp → São Paulo`, `bh → Belo Horizonte`)

**Filtros Disponíveis:**
| Filtro | Feature Key | Plano Mínimo |
|--------|-------------|--------------|
| Trazer tudo | extractor | Free |
| Só Telefone | extractor | Free |
| Só Site | extractor | Free |
| Só CNPJ | cnpjEnrichment | Inicial |
| Só E-mail | emailEnrichment | Inicial |
| Só Instagram | socialEnrichment | Pro |
| Só Facebook | socialEnrichment | Pro |
| Só TikTok | socialEnrichment | Pro |

### 3.2 Sistema de Planos e Tokens
**Arquivo:** `src/lib/plans.ts`

| Plano | Preço | Tokens | Features |
|-------|-------|--------|----------|
| Free | R$ 0 | 10 | Motor básico |
| Inicial | R$ 19,90 | 1.000 | CRM, CSV, Email, CNPJ |
| Profissional | R$ 49,90 | 3.500 | + Redes sociais, WhatsApp, IA |
| Max | R$ 97 | 10.000 | + Chatbot, Suporte prioritário |

- Token = 1 lead extraído
- Novo usuário ganha 10 tokens grátis
- `getPlanIdFromTokens(tokens)` infere o plano baseado no saldo
- `hasFeature(planId, featureKey)` verifica acesso

### 3.3 Pagamento PIX / Cartão
**Arquivos:**
- `src/lib/mercadopago-pix.ts` → Cria pagamento PIX
- `src/lib/mercadopago-checkout.ts` → Preferência Checkout Pro
- `src/lib/mercadopago-webhook.ts` → Processa webhook e credita tokens
- `src/app/api/checkout/route.ts` → Rota principal de checkout
- `src/app/api/checkout/status/route.ts` → Polling de status

**Fluxo PIX:**
1. Usuário seleciona plano em `/pricing`
2. Clica "Pagar com PIX"
3. `POST /api/checkout` → cria pagamento no MP
4. Retorna QR Code base64 + código copia-e-cola
5. Modal exibe QR Code + botão copiar
6. Polling a cada 5s via `/api/checkout/status`
7. Webhook do MP confirma pagamento → credita tokens
8. Cliente redirecionado para `/` com `?checkout=success`

**Fluxo Cartão:**
1. Usuário clica "Pagar com cartão"
2. Redireciona para Checkout Pro do Mercado Pago
3. Após pagamento, MP redireciona de volta para `/`

**Webhook:**
- URL: `{APP_URL}/api/mercado-pago/webhook`
- Eventos: `payment.updated`, `payment.created`
- Usa `SUPABASE_SERVICE_ROLE_KEY` para creditar tokens via admin
- Verifica duplicidade em `payment_history`

### 3.4 Login e Auth
**Arquivos:**
- `src/app/login/page.tsx` → Tela de login
- `src/lib/server-auth.ts` → Auth server-side
- `src/lib/supabase.ts` → Cliente Supabase

**Métodos:**
- Email + senha (com confirmação de email)
- Google OAuth (botão na tela, precisa ativar no Supabase)

**Trigger:** `on_auth_user_created` → cria profile com 10 tokens

**Segurança:**
- `getAuthUser(request)` → extrai Bearer token, valida JWT no Supabase
- RLS Policies em todas as tabelas
- Webhook usa Service Role Key (admin)

### 3.5 CRM (Dashboard)
**Arquivo:** `src/app/page.tsx` (tab "CRM")

Funcionalidades:
- Salvar leads extraídos
- Etapas do funil: Novo → Em Contato → Proposta → Fechado/Perdido
- Anotações por lead
- Busca e filtro por etapa
- Seleção múltipla e exclusão em lote
- Sincronia cloud (Supabase) + fallback local (localStorage)
- Exportação CSV (plano Inicial+)

### 3.6 Disparador WhatsApp (Dashboard)
**Arquivo:** `src/app/page.tsx` (tab "WhatsApp")

Funcionalidades:
- Abre WhatsApp Web com mensagem personalizada
- Templates pré-definidos: Abordagem Local, Oferta Direta, Diagnóstico Grátis, Parceria
- Placeholders: `{Nome}`, `{Cidade}`, `{Nicho}`, `{Site}`, `{Telefone}`
- Geração de templates com IA (Gemini ou fallback local)
- Fila assistida com delay configurável (10-120s) e variação humana
- Não envia automaticamente (abre link wa.me para usuário clicar em enviar)

### 3.7 Chatbot WhatsApp
**Arquivo:** `src/app/api/chatbot/route.ts`

Tecnologia: Baileys (biblioteca WhatsApp Web não oficial)
- Conecta via QR Code
- Regras automáticas (keyword → resposta)
- Sessão em memória (Map global) - NÃO persiste entre deploys
- Configuração salva no Supabase

### 3.8 Gerador de Cópias IA
**Arquivo:** `src/app/api/ai-copy/route.ts`

- Usa Gemini API (`gemini-3.1-flash-lite`)
- Fallback local com templates estáticos se API offline
- Tons: persuasivo, direto, curioso, amigável
- Canais: WhatsApp, Email, Misto
- Plano mínimo: Profissional

### 3.9 Globo Animado (Logo)
**Arquivo:** `src/components/Globe.tsx`

- SVG de continentes em loop horizontal infinito
- Background radial-gradient (azul ciano)
- Efeito de reflexo atmosférico
- Clique direito + arrastar para acelerar rotação

### 3.10 HackerRadar (Loading)
**Arquivo:** `src/components/HackerRadar.tsx`

- Radar girando estilo cyberpunk
- Blips pulsando em posições aleatórias
- Logs estilo terminal
- Usado durante extração de leads

---

## 4. BANCO DE DADOS (Supabase PostgreSQL)

**Arquivo schema:** `supabase/schema.sql`

### Tabelas

**profiles**
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | uuid PK | FK para auth.users |
| email | text | |
| plan_id | text | 'free', 'starter', 'pro', 'agency' |
| tokens | integer | Saldo de tokens |
| created_at | timestamptz | |
| updated_at | timestamptz | |

**crm_leads**
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | uuid PK | |
| user_id | uuid FK | |
| lead_key | text | Unique por user |
| nome | text | |
| telefone | text | |
| email | text | |
| site | text | |
| avaliacao | text | |
| instagram | text | |
| facebook | text | |
| tiktok | text | |
| cnpj | text | |
| stage | text | Novo, Em Contato, Proposta, Fechado, Perdido |
| notes | text | |
| nicho | text | |
| cidade | text | |
| payload | jsonb | Dados completos |
| saved_at | timestamptz | |

**payment_history**
| Coluna | Tipo |
|--------|------|
| id | uuid PK |
| user_id | uuid FK |
| mp_payment_id | text unique |
| plan_id | text |
| tokens_added | integer |
| amount | numeric |
| status | text |
| created_at | timestamptz |

**chatbot_configs**
| Coluna | Tipo |
|--------|------|
| id | uuid PK |
| user_id | uuid FK unique |
| enabled | boolean |
| business_name | text |
| welcome_message | text |
| fallback_message | text |
| rules | jsonb |

**cnpj_companies**
| Coluna | Tipo |
|--------|------|
| id | uuid PK |
| cnpj | text unique |
| razao_social | text |
| nome_fantasia | text |
| telefone, email | text |
| endereco, cidade, uf, cep | text |
| situacao | text |
| site | text |
| instagram, facebook, tiktok | text |

**social_enrichment_cache**
| Coluna | Tipo |
|--------|------|
| id | uuid PK |
| company_name, city, niche | text |
| instagram, facebook, tiktok, linkedin, twitter | text |

### RLS Policies
- Tabelas de usuário: CRUD apenas próprio perfil
- Tabelas públicas (cnpj, social): SELECT público, INSERT/UPDATE service

### Trigger
- `on_auth_user_created`: cria profile com 10 tokens ao registrar

---

## 5. INFRAESTRUTURA

### Railway
- **Projeto:** `celebrated-wholeness`
- **Service:** `geoleads`
- **URL:** https://geoleads-production.up.railway.app
- **Build:** Dockerfile (Node 20 + Chromium)
- **Comando deploy:** `railway up` (da raiz do projeto)

### Dockerfile
- Base: `node:20-bookworm-slim`
- Instala dependências do Chromium
- `WORKDIR /app/dashboard`
- `npm ci --legacy-peer-deps`
- `npx playwright install chromium --with-deps`
- `npm run build`
- `CMD: npm run start -H 0.0.0.0 -p ${PORT:-3000}`

### Variáveis Railway
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
MERCADO_PAGO_ACCESS_TOKEN
NEXT_PUBLIC_APP_URL=https://geoleads-production.up.railway.app
GEMINI_API_KEY
```

---

## 6. PÁGINAS E ROTAS

| Rota | Arquivo | Descrição |
|------|---------|-----------|
| `/` | `src/app/page.tsx` | Dashboard principal (Motor, CRM, WhatsApp, Chatbot, IA, Suporte) |
| `/login` | `src/app/login/page.tsx` | Login com email/senha ou Google |
| `/pricing` | `src/app/pricing/page.tsx` | Planos e pagamento PIX/cartão |
| `/account` | `src/app/account/page.tsx` | Minha conta (tokens, plano, histórico) |
| `/api/extract` | `src/app/api/extract/route.ts` | Motor de extração Playwright |
| `/api/checkout` | `src/app/api/checkout/route.ts` | Criar pagamento (PIX ou cartão) |
| `/api/checkout/status` | `src/app/api/checkout/status/route.ts` | Polling status do PIX |
| `/api/mercado-pago/webhook` | `src/app/api/mercado-pago/webhook/route.ts` | Webhook de pagamento |
| `/api/ai-copy` | `src/app/api/ai-copy/route.ts` | Gerar cópias com IA |
| `/api/chatbot` | `src/app/api/chatbot/route.ts` | Chatbot WhatsApp (Baileys) |

---

## 7. DEPENDÊNCIAS PRINCIPAIS (package.json)

```json
{
  "next": "16.2.6",
  "react": "19.2.4",
  "react-dom": "19.2.4",
  "@supabase/supabase-js": "^2.106.0",
  "@supabase/ssr": "^0.10.3",
  "mercadopago": "^2.12.1",
  "playwright": "^1.60.0",
  "@whiskeysockets/baileys": "^7.0.0-rc12",
  "qrcode": "^1.5.4",
  "pino": "^10.3.1",
  "tailwindcss": "^4",
  "typescript": "^5"
}
```

---

## 8. COMANDOS DE DESENVOLVIMENTO

```bash
# Instalar dependências
cd dashboard && npm ci --legacy-peer-deps

# Rodar local
cd dashboard && npm run dev

# Build
cd dashboard && npm run build

# Deploy Railway (da raiz do projeto)
railway up

# Ver status Railway
railway status

# Ver variáveis Railway
railway variables

# Atualizar variável Railway
railway variables set CHAVE=valor
```

---

## 9. MELHORIAS FUTURAS (PRÓXIMOS PASSOS)

1. **Disparo WhatsApp real** - Integrar com Baileys para enviar mensagens automaticamente
2. **Persistência do Chatbot** - Salvar credenciais Baileys no Supabase (não só em memória)
3. **Landing Page** - Criar página de vendas do GeoLeads
4. **Domínio próprio** - Comprar e configurar domínio personalizado
5. **Mercado Pago Produção** - Ativar credenciais de produção (atualmente em teste)
6. **Google Login** - Terminar configuração no Supabase + Google Cloud
7. **Cache de CNPJ** - Integrar com API da Receita Federal para enriquecimento automático
8. **Dashboard analytics** - Gráficos de uso, leads por mês, conversão
9. **Webhook Stripe** - Alternativa de pagamento internacional
10. **App mobile** - PWA ou React Native
11. **Email automático** - Disparo de campanhas por email
12. **Multi-idioma** - Suporte a inglês/espanhol

---

## 10. ESTRUTURA COMPLETA DE ARQUIVOS

```
lead_extractor_saas/
├── .gitignore
├── .git/
├── GEOLEADS_COMPLETE.md          # Documentação resumida
├── GEOLEADS_AI_CONTEXT.md        # ESTE ARQUIVO - Contexto completo para IA
├── Dockerfile                    # Build Docker (Node 20 + Chromium)
├── railway.toml                  # Config Railway
├── motor_playwright.js           # Protótipo inicial (não usado)
├── supabase/
│   └── schema.sql                # Schema completo do banco
├── dashboard/
│   ├── .env.local                # Chaves e segredos
│   ├── package.json
│   ├── next.config.ts
│   ├── tsconfig.json
│   ├── src/
│   │   ├── app/
│   │   │   ├── globals.css       # CSS global + animações
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx          # Dashboard (~3000 linhas)
│   │   │   ├── login/page.tsx
│   │   │   ├── pricing/page.tsx
│   │   │   ├── account/page.tsx
│   │   │   └── api/
│   │   │       ├── extract/route.ts        # Motor Playwright
│   │   │       ├── checkout/route.ts       # PIX + Cartão
│   │   │       ├── checkout/status/route.ts
│   │   │       ├── ai-copy/route.ts        # Gemini IA
│   │   │       ├── chatbot/route.ts        # Baileys WhatsApp
│   │   │       └── mercado-pago/webhook/route.ts
│   │   ├── lib/
│   │   │   ├── supabase.ts
│   │   │   ├── server-auth.ts
│   │   │   ├── plans.ts
│   │   │   ├── mercadopago-pix.ts
│   │   │   ├── mercadopago-checkout.ts
│   │   │   └── mercadopago-webhook.ts
│   │   └── components/
│   │       ├── Globe.tsx
│   │       └── HackerRadar.tsx
```

---

## 11. COMO CADA API FUNCIONA (FLUXO COMPLETO)

### Extração de Leads
1. Frontend → `POST /api/extract` com `{keyword, location, limit, filterRule}` + Bearer token
2. Backend valida auth, tokens, permissão do plano
3. `smartNormalizeQuery()` corrige digitação (ex: "adivogado sp" → "Advogado São Paulo")
4. Playwright abre Google Maps headless, rola resultados
5. Para cada card, extrai nome, telefone, avaliação, site
6. `enrichLead()` visita site oficial → busca email, CNPJ, Instagram, Facebook, TikTok
7. Aplica `preFilter()` e `postFilter()` conforme `filterRule`
8. Debita tokens: `UPDATE profiles SET tokens = tokens - {gastos}`
9. Retorna `{leads, stats}`

### Pagamento PIX
1. Frontend → `POST /api/checkout` com `{planId, method: 'pix'}` + Bearer token
2. Backend chama `createPixPayment()` → cria `Payment` no MP com `payment_method_id: 'pix'`
3. MP retorna `qr_code` (copia-e-cola) + `qr_code_base64`
4. Frontend exibe modal com QR Code + botão copiar
5. Frontend inicia polling: `GET /api/checkout/status?paymentId=X` a cada 5s
6. MP envia webhook para `/api/mercado-pago/webhook` quando pagamento é aprovado
7. Webhook valida assinatura, verifica duplicidade, credita tokens no Supabase

### Geração de Cópias IA
1. Frontend → `POST /api/ai-copy` com `{product, value, tone, channel}` + Bearer token
2. Valida plano (mínimo: Profissional)
3. Se `GEMINI_API_KEY` vazia → retorna fallback local
4. Monta prompt estruturado para Gemini com tone, channel, audience
5. `POST https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent`
6. Parseia resposta JSON, sanitiza, retorna `{copies: [{title, desc, text}]}`
7. Se Gemini falhar → fallback local

### Chatbot WhatsApp
1. Frontend → `POST /api/chatbot` com `{action: 'connect'}` + Bearer token
2. Backend cria sessão Baileys, emite QR Code
3. Frontend exibe QR Code para escanear
4. Bot conectado responde automaticamente a mensagens
5. Regras: keyword → resposta pré-definida
6. Fallback: mensagem padrão de "atendente vai responder"

---

## 12. ESTADO ATUAL DO SITE

- **Deploy:** Online ✅
- **URL:** https://geoleads-production.up.railway.app
- **Login:** Funcionando (email/senha com confirmação)
- **Extrações:** Playwright funcional no servidor
- **PIX:** Gerando QR Code e polling
- **Cartão:** Redirecionando para Checkout Pro MP
- **Gemini IA:** API key configurada ✅
- **Webhook MP:** Endpoint pronto
- **Suporte:** Funcionando (avaliação + feedback)
- **Chatbot:** Código pronto, QR Code funcional
