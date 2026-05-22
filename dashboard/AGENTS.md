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

## SQL aplicado
- supabase/migration_whatsapp_persist.sql ✓
- supabase/migration_testimonials.sql ✓
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
- ~~Usuário precisa rodar migration_testimonials.sql no SQL Editor do Supabase~~ (rodado via CLI com PAT)

## Últimas alterações (22/05/2026) — terceira leva

### Motor de Extração — Telefones
- Nova 4ª estratégia de telefone: `button[data-value][data-tooltip*="telefone"]` nos cards do Maps
- Segunda passada PÓS-scroll: abre até 15 place pages individuais (`page.goto(placeUrl)`) para leads sem telefone
- Extrai telefone do painel de detalhes do Maps (botão `data-item-id*="phone"` + aria-label + regex fallback)
- Place URL extraída junto com nome/telefone/site no evaluate()

### HackerRadar v2 (components/HackerRadar.tsx)
- Radar com DUAS camadas de varredura (verde + azul) girando em direções opostas
- Blips agora tem ciclo de vida (`life`): surgem, brilham e desaparecem suavemente (opacity + scale)
- 14 templates de log (antes 9), intervalo reduzido de 2000ms → 800ms
- Fade-in nos logs, status bar com indicador pulsante, mais cores de blip

### ScrollReveal (components/ScrollReveal.tsx)
- Novo componente client-side que anima seções ao entrar no viewport (IntersectionObserver)
- Landing page: hero, steps (staggered 100ms), features (staggered 60ms), testimonials (staggered 120ms), CTA — todos com fade+slide up

### Mobile / Responsivo
- globals.css: fonte 16px mínima em inputs/buttons (evita zoom automático no iOS)
- Padding reduzido no container mobile (2rem → 1rem)
- Orbs flutuantes desligados no mobile (display:none)
- Cards com padding/border-radius reduzidos

### Botão "Conecte o Chatbot"
- Agora redireciona pra aba chatbot (`setActiveTab('chatbot')`) em vez de ficar disabled
- Cor: âmbar quando desconectado, verde quando conectado

### Migrations rodadas
- supabase/migration_whatsapp_persist.sql ✓
- supabase/migration_testimonials.sql ✓

## Últimas alterações (22/05/2026) — quarta leva: Deep Bug Fix + Motor v3 + Features

### Motor de Extração v3 (route.ts)
- Anti-bot detection: user agent realístico, viewport 1920x1080, locale pt-BR, timezone America/Sao_Paulo, geolocation SP, navigator.webdriver=false
- Resource blocking stealth: 204 no content em vez de abort (menos detectável)
- Cookies de consentimento do Google definidos proativamente ANTES da navegação (evita popup)
- Delay randomizado entre scrolls (1200-2000ms) e após load (1500-2500ms)
- Paralelismo na segunda passada: abre até 5 place pages simultaneamente (Promise.all com concorrência 5)
- Limite da segunda passada aumentado de 15 para 30 leads
- Novas estratégias de telefone: a[href^="tel:"], a[href*="wa.me"/whatsapp.com], [itemprop="telephone"]
- Deduplicação melhorada: agora usa nome + telefone como chave composta (scrapedPhones Set)
- Avaliação corrigida: usa aria-label semântico [role="img"][aria-label*="estrelas"] em vez de regex frágil
- Novo campo CEP extraído dos cards (\d{5}-?\d{3})
- Novo campo reviewCount extraído

### Navegação Interna (SPA)
- Todos os 7 window.location.href substituídos por router.push() (dashboard, account, pricing, login)
- Todos os 6 <a href="/..."> substituídos por Next.js <Link href="/..."> (dashboard, account)
- window.location.reload() substituído por router.push() (dashboard logout) e refetch (account retry)
- LockedFeaturePanel e LeadGuideWidget movidos para fora do componente Home (quebravam reconciliação do React)
- 3 alert() no pricing substituídos por showToast()
- Toast component adicionado na página de pricing
- Login page: redirect agora usa router.push()

### Extração Histórico
- Nova tabela extraction_history (SQL migration em supabase/migration_extraction_history.sql)
- API GET /api/extract/history — retorna últimas 50 extrações do usuário
- Extrator salva histórico automaticamente após cada extração
- Dashboard: botão "🕐 Histórico" abaixo do extrator + modal com tabela

### CRM Bulk Actions
- "Mover para:" dropdown no CRM para alterar stage de múltiplos leads selecionados
- Suporta: Novo, Em Contato, Proposta, Fechado, Cliente
- Integrado com o sistema de seleção múltipla e saveCrm() existente

### Email Notification (Feedback)
- Nova lib email.ts com nodemailer (Gmail SMTP)
- /api/feedback agora envia email de notificação quando feedback é submetido
- .env.example atualizado com SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, NOTIFICATION_EMAIL

### Suporte
- Footer da landing page: link "Suporte" via mailto
- Dashboard: botão "🌐 Abrir no Gmail Web" no card de suporte

### Bug Fixes
- ScrollReveal: setTimeout limpo no cleanup do useEffect
- Extract route: browser.close() com try-catch no catch handler
- Chatbot route: handlers connection.update e messages.upsert com try-catch externo (evita unhandled promise rejections)
- @types/nodemailer instalado (TS build fix)

## Próximos passos sugeridos
1. ~~Melhorar SEO da landing page~~ (feito)
2. ~~Recolher testimonials reais dos usuários~~ (feito)
3. Comprar domínio próprio (geoleads.com.br) + configurar DNS/SSL
4. Painel admin para aprovar testimonials
5. Paginação no CRM (feito)
6. Gráficos no dashboard (feito)
7. ~~Melhorar extração de telefones~~ (feito)
8. ~~HackerRadar + animações~~ (feito)
<!-- END:geoleads-changelog -->
