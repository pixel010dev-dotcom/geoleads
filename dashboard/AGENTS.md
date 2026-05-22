<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:geoleads-credentials -->
# GeoLeads Credentials

## Supabase
- URL: https://mwnpwrzwgwrqqlomqhux.supabase.co
- Anon Key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im13bnB3cnp3Z3dycXFsb21xaHV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyMzg4MjQsImV4cCI6MjA5NDgxNDgyNH0.2gQPLPtkHXCItXSO3HEx_SfGckYZZNCC2Xv6vY93vmQ
- Service Role Key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im13bnB3cnp3Z3dycXFsb21xaHV4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTIzODgyNCwiZXhwIjoyMDk0ODE0ODI0fQ.YVZQ3cPMJaPjBnggkEV4SxNeh4Y-PVisP2ST5YF0rl8

## Users
- Admin: diogopfeifer0@gmail.com / 04092008we (senha tbm pode ser 1.2.3.4.5.6.7.8.9.10)
- Dev: pixel010dev@gmail.com / 04092008we (senha tbm pode ser 1.2.3.4.5.6.7.8.9.10)
- Supabase user ID (admin): c3c7478e-e93e-499d-9742-de15ac37e2c0

## Mercado Pago
- Access Token (prod): APP_USR-5707742565758256-051921-c508cef03e6602e38ec037568bd6a7c2-3414579388
- Access Token (prod #2): APP_USR-7f678261-af00-4442-ac82-f4e80a724f39
- Webhook URL: https://geoleads-production.up.railway.app/api/mercado-pago/webhook
- Modo simulado: setar MERCADO_PAGO_ACCESS_TOKEN = SIMULATED_

## Gemini
- API Key: AIzaSyAV5qEALNBQwk-kxvdHwzjpgSaBdNeUOrY

## Railway
- URL: https://geoleads-production.up.railway.app
- Projeto: celebrated-wholeness
- Service ID: fd85fae1-dc30-4bc1-8924-ec04be3b3ecb
- Dashboard: https://railway.com/project/daa0713e-b687-49a8-a4f3-104fa143192b/service/fd85fae1-dc30-4bc1-8924-ec04be3b3ecb

## GitHub
- Repo: https://github.com/pixel010dev-dotcom/geoleads.git

## Mercado Pago (web)
- Login: pixel010dev@gmail.com / 04092008we
- Or: diogopfeifer0@gmail.com / 04092008we

## WhatsApp (Baileys)
- Sessao persistente via Supabase (tabela `whatsapp_sessions`)
- Auto-disparo via /api/chatbot/send (requer bot conectado)
- Historico em `whatsapp_messages`
- Custom auth state: src/lib/baileys-auth-supabase.ts
- Feature keys: whatsappSender (Pro+), chatbot (Max+)

## SQL pendente
- Rodar supabase/migration_whatsapp_persist.sql no SQL Editor do Supabase
- Cria tabelas: whatsapp_sessions, whatsapp_messages
- Rodar supabase/migration_testimonials.sql no SQL Editor do Supabase
- Cria tabela: testimonials (para feedback/avaliações)
- URL SQL Editor: https://supabase.com/dashboard/project/mwnpwrzwgwrqqlomqhux/sql/new
<!-- END:geoleads-credentials -->

<!-- BEGIN:geoleads-changelog -->
# GeoLeads Changelog

## Últimas alterações (22/05/2026)

### Landing Page (src/app/page.tsx)
- Hero reescrito: "Extraia 500+ Leads Qualificados em 3 Minutos"
- CTA principal: "Extraia 10 Leads Grátis Agora"
- Seção de depoimentos (3 cards) com rating stars
- Textos de features melhorados com benefícios explícitos

### Pricing (src/app/pricing/page.tsx)
- Plano Free agora aparece no grid (antes só pagos)
- Tabela de comparação com todas as features lado a lado
- Import de `allFeatureKeys` e `featureLabels` do plans.ts

### Dashboard Charts (src/components/DashboardCharts.tsx)
- Gráficos: saldo de tokens, leads/mês (área), leads por estágio (pizza)
- Usa Recharts (instalado: npm install recharts)
- Estado vazio com mensagem quando sem leads
- Importado em dashboard/page.tsx, renderizado acima das tabs

### CRM Paginação (dashboard/page.tsx)
- Paginação com 25 leads por página
- Estado: crmPage, CRM_PAGE_SIZE
- Botões "Anterior / Próximo" com contagem
- Reseta página quando filtro de busca ou estágio muda

### WhatsApp Connection Fixes
- Buffer serialization fix: reviveBuffers() em baileys-auth-supabase.ts
- Converte objetos `{type:"Buffer",data:[...]}` do Supabase de volta pra Buffer nativo
- Error handling: badSession (500) para reconexão, restartRequired (515) com backoff maior
- Nova action `reset_session` pra limpar creds corrompidas
- Debug logging: console.log [WAP-DEBUG] no close handler

### Toast Notifications
- src/components/Toast.tsx: showToast() global
- 22 alert() substituídos no dashboard

### WhatsApp Pairing Code
- Backend: action 'pair' com requestPairingCode()
- Frontend: input de telefone + botão "Parear"
- Exibe código na tela para usuário digitar no WhatsApp

## Build & Deploy
- Build: npx next build (ou npx tsc --noEmit pra TS check)
- Deploy: git push → Railway auto-deploy
- Local: npm run dev (porta 3001)
- .env.local: NEXT_PUBLIC_APP_URL=http://localhost:3001 (local) ou https://geoleads-production.up.railway.app (produção)

## Últimas alterações (22/05/2026) — segunda leva

### SEO (landing page)
- Metadata enriquecida no layout.tsx: title.template, alternates.canonical, twitter card, robots, googleBot, metadataBase
- robots.ts criado (disallow /app/ /api/ /_next/)
- sitemap.ts criado (/, /pricing, /login)
- JSON-LD (SoftwareApplication) adicionado na landing page
- Landing page virou async server component — busca testimonials reais do Supabase com fallback hardcoded

### Depoimentos / Feedback
- Migration SQL: supabase/migration_testimonials.sql (cria tabela `testimonials` com RLS)
- API POST /api/feedback — salva avaliação do dashboard no Supabase (admin client)
- API GET /api/testimonials — retorna apenas approved=true para landing page
- Dashboard feedback form agora faz submit real para /api/feedback (antes só setava state local)
- Landing page busca testimonials aprovados, fallback pros 3 hardcoded

### Agendado
- Usuário precisa rodar migration_testimonials.sql no SQL Editor do Supabase

## Próximos passos sugeridos
1. ~~Melhorar SEO da landing page~~ (feito)
2. ~~Recolher testimonials reais dos usuários~~ (feito — precisa rodar migration)
3. Comprar domínio próprio (geoleads.com.br) + configurar DNS/SSL
4. Painel admin para aprovar testimonials
5. Paginação no CRM (feito)
6. Gráficos no dashboard (feito)
<!-- END:geoleads-changelog -->
