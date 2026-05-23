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
- Admin: pixel010dev@gmail.com / 04092008we (senha tbm pode ser 1.2.3.4.5.6.7.8.9.10)
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
- supabase/migration_extraction_jobs.sql ✓ (rodado via supabase db push)
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

## Últimas alterações (22/05/2026) — quinta leva: Admin Panel + Filter Fix + Broad Region + CRM Dedup

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

## Últimas alterações (22/05/2026) — quinta leva: Admin + Filter Fix + Broad Region + CRM Dedup

### Painel Admin (Testimonials)
- Nova rota: `GET /api/admin/testimonials` — lista todos os depoimentos (admin client, auth guard por email)
- Nova rota: `PATCH /api/admin/testimonials/[id]` — aprova/rejeita depoimento por ID
- Nova página: `src/app/app/admin/page.tsx` — painel admin com lista de depoimentos pendentes e aprovados, botões de aprovar/rejeitar, guard de acesso para `pixel010dev@gmail.com`
- Acessível em `/app/admin` com link "← Dashboard" para voltar

### Fix: Filtro do Extrator eliminando leads antes da segunda passagem
- **Problema**: `preFilter` eliminava leads sem telefone/site do card ANTES da segunda passagem (place pages), que poderia recuperá-los
- **Fix**: `phone` e `site` removidos do `preFilter` e movidos para o `postFilter` — agora a segunda passagem roda primeiro, depois o filtro verifica
- Leads sem telefone/site no card agora recebem a segunda passagem (abre página individual do Maps) antes de serem filtrados

### Busca por região ampla (ex: "Brasil")
- Se o usuário digitar "Brasil", "Brazil", "todo Brasil" etc. na região, o motor busca apenas `"Academia Brasil"` no Maps (sem localização específica)
- Google Maps retorna resultados de várias cidades do país
- Flag `broadRegion` no response stats

### Fix de Tipos (TypeScript + Turbopack)
- `WhatsAppSection.tsx` e `ChatbotSection.tsx` usavam `export function` (named) mas dashboard importava como default — corrigido para `import { ... }`
- Prop types de `requireFeature`, `setActiveTab`, `showToast` e `updateChatbotRule` ajustados para corresponder aos tipos do dashboard (`FeatureKey`, `DashboardTab`, `ToastType`)
- **Build local**: `npx next build` compila sem erros

### Deduplicação com CRM
- Leads já salvos no CRM não aparecem mais nas buscas
- Frontend envia `existingLeadKeys` (nomes dos leads do CRM) no body da request
- Extractor pré-popula `scrapedNames` com esses nomes ANTES da extração
- Usuário não gasta tokens com leads que já possui

## Próximos passos sugeridos
1. ~~Melhorar SEO da landing page~~ (feito)
2. ~~Recolher testimonials reais dos usuários~~ (feito)
3. ~~Painel admin para aprovar testimonials~~ (feito)
4. Comprar domínio próprio (geoleads.com.br) + configurar DNS/SSL
5. Paginação no CRM (feito)
6. Gráficos no dashboard (feito)
7. ~~Melhorar extração de telefones~~ (feito)
8. ~~HackerRadar + animações~~ (feito)

## 🔴 PROBLEMA CRÍTICO: Segunda passagem (place pages) não extrai telefone/site

### O que acontece
A segunda passagem navega para `google.com/maps/place/...` (URL individual de cada lead) para buscar telefone e site que não foram encontrados no card. Mas a extração desses dados está falhando — leads entregues sem contato.

### O que já foi tentado
1. `waitUntil: 'networkidle'` timeout 12-15s — lento, ads impedem networkidle, goto timeout
2. `waitUntil: 'load'` + 2s wait — JS do Maps não renderiza dados a tempo
3. `waitUntil: 'domcontentloaded'` + LD+JSON — extrai do structured data no HTML inicial, sem precisar de JS
4. Selectors DOM (`[data-item-id*="phone"]`, `[aria-label*="telefone"]`, etc.) — falham se JS não renderizou
5. Regex no innerText — falha se página não carregou dados

### Abordagem atual (LD+JSON)
O Google embute dados estruturados no HTML inicial das páginas via `<script type="application/ld+json">`. Esse JSON contém `telephone`, `url`, `sameAs` (redes sociais), `address`. Extrair desses scripts é a abordagem mais promissora porque:
- Funciona com `domcontentloaded` (não espera JS)
- Dados são estruturados (não precisa regex)
- Inclui telefone, site, redes sociais

Hipótese: o LD+JSON pode só existir em páginas de busca, não em place pages individuais. Se for o caso, alternativas:
1. Em vez de navegar para place URL, extrair telefone/site clicando no card na página de busca para abrir o painel lateral
2. Usar a API Places do Google (requer API key)
3. Melhorar extração nos cards (primeira passagem)

### Solução alternativa (já funciona)
Botão "🔄 Re-enriquecer" no CRM: abre o SITE do lead e busca email, CNPJ, Instagram, Facebook, TikTok.
- Requer que o lead tenha site
- Funciona via `fetchHtml()` no servidor (não usa Playwright)
- Fallback de email por padrões (contato@dominio, comercial@dominio, etc.)

## Últimas alterações (22/05/2026) — sexta leva: Background Jobs + Extração Assíncrona + Otimizações

### Background Job System (Extração Assíncrona)
- `POST /api/extract` agora cria um `extraction_jobs` no Supabase e retorna `{ jobId }` imediatamente
- `runExtraction()` executa em background (fire-and-forget) com todo o motor de extração
- `GET /api/extract/job/[jobId]` — polling de status (running, completed, failed, cancelled)
- `PATCH /api/extract/job/[jobId]` — cancelamento da extração
- Frontend: `startPolling(jobId)` a cada 3s, recupera job pendente do localStorage ao recarregar
- `checkCancelled()` consulta Supabase a cada cidade e para se job foi cancelado
- Migration: `supabase/migration_extraction_jobs.sql` (tabela + RLS policies)
- Rodado via `supabase db push`

### Otimizações de Velocidade
- `maxScrollPerCity`: 12 → 8 (broad region)
- Delay entre scrolls: 1200-2000ms → 800-1400ms
- Delay pós-load: 1500-2500ms → 1000-1500ms
- Timeout waitForSelector feed: 8s → 5s
- Limite 2ª passagem: 30 → 20

### Correção de Fórmula de Tempo Estimado
- Frontend: `sec = 10 + cidades × 2 + leads × 1.5 + 15` (antes era `5 + leads × 1.8`)
- Capado em 600s (limite do backend)
- Conta navegação por cidade + overhead da 2ª passagem

### Correção do Gargalo da Segunda Passagem
- `waitUntil: 'networkidle'` (antes `load`) — espera XHR de dados do Maps finalizar
- `waitForTimeout(3000)` para JS renderizar (antes 2000ms)
- `waitForTimeout(500)` pós-scroll (antes 300ms)
- Selector `waitForSelector` removido (silent catch desperdiçava tempo)
- Regex de telefone expandido: 3 padrões (`+55 (11)...`, `5511...`, `(11)...`)
- Agora busca leads sem telefone **OU sem site** na 2ª passagem (antes só sem telefone)
- Limite 2ª passagem: 25 leads (antes 20)
- MAX_TIME guard adicionado no loop da 2ª passagem
- Novas estratégias de telefone nos cards: `[data-item-id*="phone"]` + regex com suporte a +55

### MAX_TIME Ajustado (Qualidade > Velocidade)
- Broad: `15s + leads × 3s` (antes `5s + leads × 2s`). Ex: 10 leads → 45s (antes 25s)
- Specific city: 60s (antes 50s)

### Entrega Incremental de Leads
- Leads salvos no Supabase (`extraction_jobs.leads`) a cada cidade concluída
- Frontend: status `running` já atualiza a tabela de leads (entrega em tempo real)
- Status `cancelled` tratado no polling (não mostra toast de erro)

### Fix: Response POST sem success:true
- Frontend verificava `data.success && data.jobId` mas o POST retornava só `{ jobId }`
- Causava "Erro desconhecido" no frontend

## Próximos passos sugeridos
1. ~~Melhorar SEO da landing page~~ (feito)
2. ~~Recolher testimonials reais dos usuários~~ (feito)
3. ~~Painel admin para aprovar testimonials~~ (feito)
4. Comprar domínio próprio (geoleads.com.br) + configurar DNS/SSL
5. ~~Paginação no CRM~~ (feito)
6. ~~Gráficos no dashboard~~ (feito)
7. ~~Melhorar extração de telefones~~ (feito)
8. ~~HackerRadar + animações~~ (feito)
9. Background job system + polling (feito)
10. Otimizações de velocidade + qualidade extração (feito)
11. **PENDENTE: Qualidade da extração de telefone/site nas place pages do Maps ainda não está capturando dados reais** — testar com 10 leads "Academias"/"Brasil" e verificar se telefones e sites estão sendo extraídos
12. **PENDENTE: Verificar se o frontend exibe leads incrementalmente durante extração** (status running)

## Últimas alterações (22/05/2026) — oitava leva: Ajuste de limites + Otimizações + Segurança

### Limites de extração realistas
- Max extração: 500 → **200** (Google Maps web limita ~80-100/cidade, com bairros ~200)
- route.ts: `Math.min(requestedLimit, 200, auth.tokens)`
- ExtractorSection.tsx: input `max="200"`
- Landpage: "200+ Leads Qualificados"

### Tokens por plano reajustados
| Plano | Antes | Agora |
|-------|-------|-------|
| Free | 10 | 10 |
| Starter | 1.000 | **400** |
| Pro | 3.500 | **1.200** |
| Agency | 10.000 | **2.400** |

### Segurança aplicada
- Validação de URL no `fetchHtml()` com `new URL()` try/catch (evita SSRF)
- Timeout de 3.5s em todas requisições HTTP externas (abort controller)
- Rate limiting: max 2 extrações simultâneas por usuário, 10 global
- Input sanitization básica: `filterRule` parse com trim/filter
- Tokens checados antes da extração (`requestedLimit > auth.tokens`)
- Todas queries Supabase usam `.eq('id', ...)` com parâmetros (evita SQL injection)
- `eval()` / `Function()` não usados em nenhum lugar do código
- Sem dependências com vulnerabilidades conhecidas

### Performance
- Parallelismo na segunda passagem: Promise.all com concorrência 5 (place pages)
- Cache de enriquecimento por domínio (`enrichCache` Map)
- Resource blocking stealth: 204 no content em vez de abort (menos detectável)
- Rate limiting de chamadas à API: `eachLimit` do async

### Changelog
- AGENTS.md atualizado com esta entrada
<!-- END:geoleads-changelog -->
