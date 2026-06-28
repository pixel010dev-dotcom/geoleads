# CONTEXTO — GeoLeads

> **Arquivo de contexto do projeto.**
> Toda IA que modificar este repositório DEVE atualizar este arquivo com mudanças relevantes.
> Mantenha-o conciso, mas completo. Use português.

---

## 1. O que é o GeoLeads

Plataforma SaaS de **extração de leads do Google Maps** + **CRM** + **automação de marketing**.
Público: pequenas empresas brasileiras (dentistas, advogados, corretores, etc).
Deploy: https://geoleads-production.up.railway.app

---

## 2. Stack

- **Frontend + API:** Next.js 14 (App Router), TypeScript
- **DB:** Supabase (PostgreSQL), 15+ tabelas com RLS
- **Deploy:** Railway (Docker + Playwright/Chromium)
- **Automação:** GitHub Actions (cron jobs)
- **IA:** DeepSeek V4 Flash via OpenRouter (grátis) + OpenCode Zen

---

## 3. Scripts (./scripts/)

| Arquivo | Função | Cron | API Keys |
|---------|--------|------|----------|
| `bot_utils.py` | Módulo compartilhado: geração de texto, imagem, música, conteúdo variado | — | OPENROUTER_API_KEY, GEMINI_API_KEY, HF_API_TOKEN, CF_API_TOKEN |
| `twitter-bot.py` | Posta tweets sobre GeoLeads (OAuth 1.0a) | 8h/12h/18h/21h BRT | TWITTER_CONSUMER_*, TWITTER_ACCESS_*, OPENROUTER_API_KEY |
| `pinterest-bot.py` | Posta Pins com templates fixos | 10h/20h BRT | PINTEREST_TOKEN |
| `telegram-bot.py` | Posta conteúdo no canal @The_omini_bot | 8h/12h/18h BRT | TELEGRAM_BOT_TOKEN, TELEGRAM_CHANNEL_ID |
| `youtube-shorts-bot.py` | Cria + upload Shorts (imagem + música via FFmpeg) | 3x/semana | GOOGLE_CLIENT_*, GOOGLE_REFRESH_TOKEN |
| `generate-blog-post.py` | Gera post de blog via IA e publica na API | 1x/semana (segunda) | OPENROUTER_API_KEY |
| `telegram_monitor.py` | Monitora extrações e envia stats no PV do admin | 5/5min | TELEGRAM_BOT_TOKEN, SUPABASE_* |
| `ai_supervisor.py` | Supervisor autônomo: scan IA -> diagnostico -> auto-fix -> report | 15/15min | OPENROUTER_API_KEY, GH_TOKEN, TELEGRAM_*, múltiplas |
| `auto_lead_pipeline.py` | Pipeline automático de lead gen | — | (várias) |

### Padrão comum dos bots
1. GitHub Actions cron dispara workflow
2. Workflow roda `pip install requests` (ou outras deps)
3. Script roda, faz sua tarefa, printa resultado
4. Se falha, próximo supervisor detecta e tenta corrigir

### Geracao de imagem (bot_utils.py)
Fallback chain: **Gemini Imagen** (GEMINI_API_KEY) → **HuggingFace FLUX.1** (HF_API_TOKEN) → **Cloudflare SD** (CF_API_TOKEN) → placeholder

### Seguranca
- NENHUM script deve ter secrets hardcoded como fallback em `os.environ.get()`
- Use apenas `os.environ.get("VAR")` sem segundo argumento — falha se nao estiver configurado
- Excecao: `get-youtube-token.py` (dev tool) tem fallbacks para client_id/client_secret OAuth
- `APP_URL` deve sempre vir de env var com fallback, nunca hardcoded direto

### AutoFixer (modo deep)
Gera script Python arbitrário via DeepSeek, executa em subprocesso, commita.
Se admin mandar "reverte" no PV, o próximo ciclo desfaz o último fix.

Fluxo completo:
1. AI gera script de correcao (com contexto do CONTEXTO.md)
2. Script executado com timeout 300s
3. Pode instalar pacotes (pip install) e fazer web search
4. Syntax check com py_compile em todos .py alterados
5. Se syntax check falhar, tenta gerar novo fix (1 retry)
6. Se houver mudancas estruturais, alerta admin se CONTEXTO.md nao foi atualizado
7. git commit + push
8. Notifica admin no PV

---

## 4. Workflows (./.github/workflows/)

| Arquivo | Disparo | O que faz |
|---------|---------|-----------|
| `twitter-bot.yml` | 0 11,15,21,0 * * * | Roda twitter-bot.py |
| `pinterest-bot.yml` | 0 13,23 * * * (10h/20h BRT) | Roda pinterest-bot.py |
| `telegram-bot.yml` | 0 11,15,21 * * * | Roda telegram-bot.py |
| `youtube-shorts-bot.yml` | 0 11 * * 1,3,5 (seg/qua/sex) | Roda youtube-shorts-bot.py |
| `auto-blog.yml` | 0 9 * * 1 (segunda) | Roda generate-blog-post.py |
| `telegram-monitor.yml` | */5 * * * * | Roda telegram_monitor.py |
| `drip-cron.yml` | 0 * * * * (1h) | Chama /api/drip/process |
| `auto-pipeline.yml` | 0 7 * * 1 | Roda auto_lead_pipeline.py |
| `ai-supervisor.yml` | */15 * * * * | Roda ai_supervisor.py (modo deep 2x/dia auto-detectado) |

### Permissões
- `ai-supervisor.yml` tem `contents: write` + `actions: read` (pode commitar auto-fixes)

---

## 5. AI Supervisor (ai_supervisor.py)

### Modos
- **fast** (padrão, 15/15min): scan + auto-fix YAML (pip install) + report Telegram. Sem custo.
- **deep** (11h/23h UTC = 8h/20h BRT): scan + diagnóstico DeepSeek + auto-fix (AutoFixer) + report

### AutoFixer (modo deep)
Gera script Python arbitrário via DeepSeek, executa em subprocesso, commita.
Se admin mandar "reverte" no PV, o próximo ciclo desfaz o último fix.

### Fluxo de cada ciclo (deep)
Scan → diagnóstico IA → auto-fix (script gerado + exec + commit) → reverte se admin pediu → Healer → report Telegram

---

## 6. Credenciais (GitHub Secrets)

### Obrigatórias (sem isso nada funciona)
- `GH_TOKEN` — API GitHub (commits, scan logs)
- `TELEGRAM_BOT_TOKEN` — Bot @The_omini_bot (token: 8755188266:AAE0U4gaMc7dKByW_wFeoOEvpm00_E-va-w)
- `TELEGRAM_CHANNEL_ID` — Canal: -1003870508744

### Admin
- `TELEGRAM_ADMIN_ID` — 8955181160 (notificações vão pro PV)

### Bots
- `TWITTER_CONSUMER_KEY`, `TWITTER_CONSUMER_SECRET`, `TWITTER_ACCESS_TOKEN`, `TWITTER_ACCESS_SECRET`
- `PINTEREST_TOKEN`
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN` (YouTube Shorts)

### IA
- `OPENROUTER_API_KEY` — primário (DeepSeek V4 Flash FREE)
- `OPENCODE_ZEN_KEY` — primário (deepseek-v4-flash via opencode.ai/zen)
- `GEMINI_API_KEY` — imagem (Gemini Imagen)
- `HF_API_TOKEN` — imagem fallback (FLUX.1-schnell)
- `CF_API_TOKEN` — imagem fallback (Cloudflare SD)

### Infra
- `SUPABASE_URL` — https://mwnpwrzwgwrqqlomqhux.supabase.co
- `SUPABASE_SERVICE_ROLE_KEY` — admin do Supabase
- `RAILWAY_URL` — https://geoleads-production.up.railway.app

---

## 7. Arquitetura do DB (Supabase)

15 tabelas principais: `profiles`, `crm_leads`, `payment_history`, `extraction_history`,
`extraction_jobs`, `chatbot_configs`, `whatsapp_sessions`, `whatsapp_messages`,
`testimonials`, `autovendas_campaigns`, `autovendas_leads`, `cnpj_companies`,
`social_enrichment_cache`, `chatbot_conversations`, `whatsapp_campaigns`

---

## 8. Decisões importantes

- **Railway free trial** — manter enquanto durar, depois migrar pra Hobby ($5/mês) ou Oracle Always Free
- **Telegram admin** — notificações de falha e extrações vão pro PV (8955181160), NUNCA pro canal público
- **Horários BRT** — todos os bots otimizados pra público brasileiro (UTC-3)
- **Modelo IA padrão** — `deepseek/deepseek-v4-flash:free` via OpenRouter (primário) + OpenCode Zen (fallback)
- **Imagem grátis** — Gemini Imagen é prioridade, sem custo
- **YouTube Shorts** — usa FFmpeg, requer `google-auth-oauthlib` + `google-api-python-client`
- **AutoFixer** — poder total de edição, mas sempre commita + notifica. Reversão via "reverte" no PV

---

## 9. Erros comuns e soluções

| Erro | Causa | Fix |
|------|-------|-----|
| `ModuleNotFoundError: No module named 'requests'` | Workflow sem pip install | Adicionar `pip install requests` no YAML |
| `401 Unauthorized` | Token expirou/inválido | Renovar token no provedor + GitHub Secret |
| `ffmpeg not found` | FFmpeg não instalado | `sudo apt-get install ffmpeg` ou `brew install ffmpeg` |
| `quotaExceeded` | Cota da API excedida | Aguardar ou trocar chave |
| `Invalid OAuth 2.0 credentials` | Google refresh token expirou | Rodar `get-youtube-token.py` manualmente |
| `name 'image_path' is not defined` | Variável usada antes de definida | Verificar escopo no script |
| `429 Too Many Requests` | Rate limit | Adicionar `time.sleep(random.uniform(1,3))` |
