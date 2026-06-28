# GeoLeads

Plataforma SaaS de **extracao de leads do Google Maps** + CRM + automacao de marketing.

## Deploy

[https://geoleads-production.up.railway.app](https://geoleads-production.up.railway.app)

## Scripts

| Script | Funcao |
|--------|--------|
| `ai_supervisor.py` | Supervisor autonomo que scanneia, diagnostica e corrige bots |
| `bot_utils.py` | Modulo compartilhado: texto, imagem, musica por IA |
| `twitter-bot.py` | Posta tweets sobre GeoLeads |
| `telegram-bot.py` | Posta no canal @The_omini_bot |
| `pinterest-bot.py` | Posta Pins com templates |
| `youtube-shorts-bot.py` | Cria + upload Shorts com FFmpeg |
| `generate-blog-post.py` | Gera post de blog via IA |
| `telegram_monitor.py` | Monitora extracoes e envia stats no PV |
| `scraping_worker.py` | Processa jobs de extracao pendentes |
| `auto_lead_pipeline.py` | Pipeline automatico de lead gen |

## Workflows (GitHub Actions)

Todos os scripts rodam via cron no GitHub Actions.
Ver `.github/workflows/` para detalhes.

## Setup

1. Configure os secrets no GitHub:
   ```
   python scripts/check_secrets.py
   ```
2. Os workflows rodam automaticamente nos horarios agendados
3. O `ai_supervisor.py` monitora e corrige falhas a cada 15min

## Variaveis de Ambiente

Copie `.env.example` e preencha:
```
cp .env.example .env
```

## Stack

- **Frontend + API:** Next.js 14 (App Router), TypeScript
- **DB:** Supabase (PostgreSQL)
- **Deploy:** Railway (Docker + Playwright)
- **Automacao:** GitHub Actions (cron)
- **IA:** DeepSeek V4 Flash via OpenRouter (gratis)
- **Imagem:** Gemini Imagen (gratis)
