# GEOLEADS — Status Completo (29/06/2026)

---

## 1. DEPLOY

| Item | Valor |
|------|-------|
| **URL** | https://geoleads-production-6583.up.railway.app |
| **Railway Dashboard** | https://railway.com/project/306b3250-7565-4dcb-802c-e46f676b78cf |
| **Plano** | Trial ($5/mês) — 30 dias restantes |
| **Conta** | diogopfeifer0@gmail.com |
| **GitHub** | https://github.com/pixel010dev-dotcom/geoleads |
| **Auto-deploy** | GitHub Action (push na main) |

### Páginas — Status HTTP
| Rota | Status |
|------|--------|
| `/` (Home) | 200 ✅ |
| `/login` | 200 ✅ |
| `/pricing` | 200 ✅ |
| `/blog` | 200 ✅ |
| `/calculadora-leads` | 200 ✅ |
| `/nicho/restaurante` | 200 ✅ |
| `/robots.txt` | 200 ✅ |
| `/api/mercado-pago/webhook` | Responde (POST) ✅ |
| `/sitemap.xml` | 200 ✅ |

---

## 2. SUPABASE (não mudou)

| Item | Valor |
|------|-------|
| **URL** | https://mwnpwrzwgwrqqlomqhux.supabase.co |
| **Dashboard** | https://supabase.com/dashboard/project/mwnpwrzwgwrqqlomqhux |
| **Site URL (configurado)** | https://geoleads-production-6583.up.railway.app ✅ |
| **URI Allow List** | https://geoleads-production-6583.up.railway.app/** ✅ |
| **Google OAuth** | Funcionando ✅ |
| **PAT** | sbp_c59def7fbc8097a0e2772ac827045c0ce7f7cd26 |

### Providers ativos
- Google (Client ID: 86652749660-cjkmshc0ptu9rs6ftd049qffd2clvr8k.apps.googleusercontent.com)
- Email/Senha (magic link)

---

## 3. VARIÁVEIS DE AMBIENTE (Railway)

### Supabase
```
NEXT_PUBLIC_SUPABASE_URL=https://mwnpwrzwgwrqqlomqhux.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### AI
```
GEMINI_API_KEY=AIzaSyAV5qEALNBQwk-kxvdHwzjpgSaBdNeUOrY
GEMINI_MODEL=gemini-1.5-flash
OPENROUTER_API_KEY=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
```

### Pagamentos
```
MERCADO_PAGO_ACCESS_TOKEN=APP_USR-8143486344050111-051921-871e59c3c38b0995f166650ee1635168-1176662512
MERCADO_PAGO_WEBHOOK_SECRET=TAR7kVWz8wde2hlCaKYfgUO3N6JySGom
```

### App
```
NEXT_PUBLIC_APP_URL=https://geoleads-production-6583.up.railway.app
CRON_SECRET=xyPinHgjVIzrBhbHktRlZZjGb07e858WAzlq5cNpHfk=
ADMIN_EMAIL=pixel010dev@gmail.com
```

### Telegram
```
TELEGRAM_BOT_TOKEN=8755188266:AAE0U4gaMc7dKByW_wFeoOEvpm00_E-va-w
TELEGRAM_CHANNEL_ID=-1003870508744
```

### Email
```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=pixel010dev@gmail.com
SMTP_PASS=04092008we
```

### Autovendas
```
AUTOVENDAS_WEBHOOK_SECRET=s20E7RAk0YyQollS76vKGew8c5eJGaYllgb-IQbSaaY
AUTOVENDAS_PRICE_PER_LEAD=0.5
```

### Infra
```
CF_WORKER_URL=https://geoleads-proxy.pixel010dev.workers.dev
```

---

## 4. WEBSITE — Funcionalidades

### Frontend (Next.js 16.2.6 + Tailwind CSS 4)
- Landing page com Globe animado
- Login (email/senha + Google OAuth)
- Pricing com Mercado Pago (PIX)
- Blog multi-idioma
- Calculadora de leads
- Nicho/Cidade pages (SEO)
- Dashboard protegido
- Sitemap + Robots.txt

### Dashboard
| Seção | Funcionalidade |
|-------|---------------|
| **Extractor** | Extrai leads do Google Maps por nicho + cidade |
| **CRM** | Gerencia leads extraídos, filtra, exporta CSV |
| **Enriquecimento** | Busca email, Instagram, Facebook, TikTok dos leads |
| **WhatsApp** | Disparo em massa com templates IA, fila inteligente |
| **Chatbot** | Conexão WhatsApp via QR code (Baileys) |
| **IA/Copy** | Geração de copy de marketing por IA |
| **Autovendas** | Venda automatizada de leads |
| **Suporte** | Ticket de suporte |
| **Indique e Ganhe** | Programa de referral |

### API Routes
| Rota | Função |
|------|--------|
| `/api/extract` | Extração de leads |
| `/api/lead-enrich/batch` | Enriquecimento em lote |
| `/api/mercado-pago/webhook` | Webhook de pagamentos |
| `/api/checkout` | Checkout Mercado Pago |
| `/api/drip/process` | Processamento drip de email |
| `/api/autovendas/webhook` | Webhook autovendas |
| `/api/email/*` | Emails transacionais |

### Bot Scripts (Python)
| Script | Função | Status |
|--------|--------|--------|
| `telegram-bot.py` | Monitor + notificações | OK |
| `twitter-bot.py` | Postagem automática Twitter | OK |
| `pinterest-bot.py` | Postagem automática Pinterest | OK |
| `youtube-shorts-bot.py` | Upload YouTube Shorts | Falta refresh token |
| `ai_supervisor.py` | Supervisor automático (30min) | OK |
| `scraping_worker.py` | Worker de scraping contínuo | OK |
| `reconciliation-worker.js` | Reconciliação de pagamentos | OK |

### API Routes — Disparador WhatsApp
| Rota | Função |
|------|--------|
| `/api/chatbot/send` | Envio via bot Baileys (com rate limiting) |
| `/api/chatbot/campaign` | CRUD de campanhas |
| `/api/chatbot/messages` | Histórico de mensagens |
| `/api/chatbot/stats` | Estatísticas de envio |
| `/api/cron/process-campaigns` | CRON: executa campanhas agendadas (10min) |
| `/api/cron/process-follow-ups` | CRON: dispara follow-ups pendentes (15min) |

### Novas Tabelas (Supabase)
| Tabela | Função |
|--------|--------|
| `wa_followups` | Follow-ups automáticos agendados |
| `wa_campaign_leads` | Status individual de cada lead em campanhas |
| `wa_rate_tracker` | Controle de rate limit por sessão |
| `whatsapp_sessions` (expandida) | Agora com `session_label`, `proxy_url`, `rate_limit_*`, `active`, `last_ban_check` |

---

## 5. MERCADO PAGO

| Item | Status |
|------|--------|
| **Access Token** | Configurado |
| **Webhook** | https://geoleads-production-6583.up.railway.app/api/mercado-pago/webhook ✅ |
| **Webhook Secret** | Configurado |
| **PIX** | Habilitado |
| **Checkout** | Transparente (integrado) |

---

## 6. BOTS & AUTOMAÇÕES

### GitHub Actions
| Workflow | Gatilho | Descrição |
|----------|---------|-----------|
| `deploy-dashboard.yml` | Push na main | Deploy Railway |
| `ai-supervisor.yml` | A cada 30min | Supervisor IA |
| `telegram-monitor.yml` | A cada 15min | Monitor de extrações |
| `telegram-daily-stats.yml` | Diário 09:00 | Stats diários |
| `drip-cron.yml` | A cada 1h | Processamento drip email |
| `auto-pipeline.yml` | 3x/dia | Pipeline automático |
| `twitter-bot.yml` | A cada 2h | Postagem Twitter |
| `pinterest-bot.yml` | A cada 4h | Postagem Pinterest |
| `youtube-shorts-bot.yml` | Diário | YouTube Shorts (precisa refresh token) |

---

## 7. PENDENTES

### Alta
- [ ] **Testar extração real** — fazer login e rodar extração
- [ ] **Testar pagamento real** — comprar um plano no site
- [ ] **YouTube Shorts** — obter refresh token do Google (rodar `get-youtube-token.py`)

### Média
- [ ] **Aceitar convite GitHub** — `diogopfeifer0-wq` precisa aceitar em github.com/pixel010dev-dotcom/geoleads/invitations
- [ ] **Adicionar secret APP_URL no GitHub** — valor: https://geoleads-production-6583.up.railway.app
- [ ] **Reddit credenciais** — pendente

### Baixa
- [ ] **Domínio próprio** — geoleads.com.br (~R$40/ano no Registro.br)
- [ ] **PWA** — suporte a app instalável
- [ ] **Multi-idioma / Stripe** — para clientes internacionais
- [ ] **Cache de CNPJ** — API Receita Federal

---

## 8. ARQUITETURA TÉCNICA

```
geoleads/
├── dashboard/              ← Next.js 16.2.6 (frontend + API)
│   ├── src/
│   │   ├── app/            ← Pages e API routes
│   │   │   ├── api/        → extract, mercado-pago, email, autovendas, drip
│   │   │   ├── login/      → Login com Google + email/senha
│   │   │   ├── pricing/    → Planos e checkout
│   │   │   ├── nicho/      → Páginas SEO por nicho
│   │   │   └── cidade/     → Páginas SEO por cidade
│   │   ├── components/     → React components
│   │   │   └── dashboard/  → Extractor, CRM, WhatsApp, Chatbot, etc
│   │   └── lib/            → Supabase, AI providers, i18n, etc
│   └── Dockerfile
├── scripts/                ← Bots Python
├── .github/workflows/      ← GitHub Actions
└── railway.toml            ← Cron jobs Railway
```

---

## 9. CHAVES API COMPLETAS

Todas as chaves estão no vault do Obsidian: `Geoleads/03-Credenciais.md`

Resumo:
- **Gemini:** AIzaSyAV5qEALNBQwk-kxvdHwzjpgSaBdNeUOrY
- **OpenRouter:** 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
- **Supabase PAT:** sbp_c59def7fbc8097a0e2772ac827045c0ce7f7cd26
- **Mercado Pago:** APP_USR-8143486344050111-051921-871e59c3c38b0995f166650ee1635168-1176662512
- **Telegram:** 8755188266:AAE0U4gaMc7dKByW_wFeoOEvpm00_E-va-w
- **Twitter:** (consumer + access tokens no .env.local)
- **Pinterest:** pina_AMAXSLYYAD7POBYAGAAC2D2G64ZQPHYBQBIQCEMN5MYKJNPQTKWTKSUF2BWHFBVWI4GQXBJLYZLDFWMH7HPN7ZFSG7GLDPAA
- **Hugging Face:** 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
- **Cloudflare:** cfut_OUUYOnfw9FLGKf3rcQd1smObPKVtUa0HyDkUdQUF366f0192

---

## 10. LINGUAGENS & TECNOLOGIAS

| Tecnologia | Versão | Uso |
|------------|--------|-----|
| **Next.js** | 16.2.6 | Framework web |
| **React** | 19.2.4 | UI |
| **TypeScript** | 5.x | Tipagem |
| **Tailwind CSS** | 4 | Estilização |
| **Supabase** | JS v2 | Banco + Auth |
| **Mercado Pago** | SDK v2 | Pagamentos |
| **Baileys** | v7 | WhatsApp |
| **Playwright** | v1.61 | Scraping |
| **Node.js** | 20 | Runtime |
| **Python** | 3.11 | Bots |
| **Docker** | — | Container |


