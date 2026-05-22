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
- URL SQL Editor: https://supabase.com/dashboard/project/mwnpwrzwgwrqqlomqhux/sql/new
<!-- END:geoleads-credentials -->
