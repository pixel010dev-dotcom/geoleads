# GeoLeads

Plataforma SaaS de **extracao de leads do Google Maps** + CRM + automacao de marketing.

## Deploy

[https://geoleads-production.up.railway.app](https://geoleads-production.up.railway.app)

---

## Scripts

| Script | Funcao | Cron |
|--------|--------|------|
| `ai_supervisor.py` | Supervisor autonomo: scan, diagnostico, auto-fix, auto-aprimoramento | 15/15min (FAST) + 8h/20h (DEEP) + 12:00 BRT (self_improve) |
| `scraping_worker.py` | Worker de extracao que processa jobs pendentes do Supabase | 10/10min |
| `bot_utils.py` | Modulo compartilhado: texto, imagem, musica por IA | - |
| `twitter-bot.py` | Posta tweets sobre GeoLeads | variavel |
| `telegram-bot.py` | Posta no canal @The_omini_bot | variavel |
| `pinterest-bot.py` | Posta Pins com templates | variavel |
| `youtube-shorts-bot.py` | Cria + upload Shorts com FFmpeg | variavel |
| `generate-blog-post.py` | Gera post de blog via IA | variavel |
| `telegram_monitor.py` | Monitora extracoes e envia stats no PV | variavel |
| `auto_lead_pipeline.py` | Pipeline automatico de lead gen | variavel |
| `check_secrets.py` | Verifica variaveis de ambiente configuradas | manual |
| `dashboard_aprendizado.py` | Gera dashboard HTML do aprendizado do supervisor | manual |

## Workflows (GitHub Actions)

| Workflow | Trigger | Descricao |
|----------|---------|-----------|
| `ai-supervisor.yml` | 15/15min + agendado | Executa ciclo FAST ou DEEP do supervisor |
| `scraping-worker.yml` | 10/10min | Processa jobs de extracao |
| `self-improve.yml` | 12:00 BRT (15:00 UTC) | Auto-aprimoramento: scan, correcao, evolucao (1h timeout) |
| Demais workflows | variavel | Rodam os bots individuais |

## Auto-Aprimoramento (self_improve)

O AI Supervisor tem um ciclo de **auto-aprimoramento diario as 12:00 BRT** que:

1. Escaneia TODOS os scripts `.py` em `scripts/`
2. Verifica syntax de cada um
3. Corrige `bare except:` → `except Exception:`
4. Checa imports locais quebrados
5. Valida YAML de todos os workflows
6. Detecta secrets faltando (vs `.env.example`)
7. Chama IA (DeepSeek) para sugestoes de melhoria (a cada 2 ciclos)
8. Salva aprendizado em `.self_improve_log.json` (ultimos 30 dias)
9. Reporta resultado no Telegram PV

### Dashboard de Aprendizado

```bash
python scripts/dashboard_aprendizado.py
```

Abre um dashboard HTML com historico de correcoes, padroes de fix e estatisticas.

### Testes

```bash
python -m pytest scripts/tests/test_self_improve.py -v
```

## AI Supervisor (detalhes)

### Modos de Operacao

| Modo | Frequencia | Custo | Acao |
|------|-----------|-------|------|
| **FAST** | 15/15min | Gratis | Scan logs → detecta ModuleNotFoundError → auto-fix YAML (7 patterns) → report PV |
| **DEEP** | 2x/dia (8h/20h BRT) | IA (DeepSeek) | Scan → diagnostico → AutoFixer → Healer → report completo |
| **Self_Improve** | 12:00 BRT | IA (DeepSeek) | Escaneia todos scripts → corrige → evolui → salva aprendizado |

### Super Poderes do AutoFixer

- **Auto-revert**: Se o mesmo bot continuar falhando apos fix, desfaz automaticamente
- **Smoke test**: Verifica imports locais + syntax de todos scripts/ antes de commitar
- **Memoria**: Salva padroes de erro em `.fix_patterns.json` para aprendizado continuo
- **Prompt melhorado**: IA recebe guia de tipos de erro + historico de patterns
- **Contexto completo**: IA le o `CONTEXTO.md` automaticamente

## Setup

1. Configure os secrets no GitHub:
   ```bash
   python scripts/check_secrets.py
   ```
2. Os workflows rodam automaticamente nos horarios agendados
3. O `ai_supervisor.py` monitora e corrige falhas

## Variaveis de Ambiente

Copie `.env.example` e preencha:
```bash
cp .env.example .env
```

## Documentacao Detalhada

O arquivo [`scripts/CONTEXTO.md`](scripts/CONTEXTO.md) contem a documentacao
completa do projeto: arquitetura, credenciais, erros comuns e decisoes tecnicas.
E atualizado automaticamente pelo AI Supervisor.

## Stack

- **Frontend + API:** Next.js 14 (App Router), TypeScript
- **DB:** Supabase (PostgreSQL)
- **Deploy:** Railway (Docker + Playwright)
- **Automacao:** GitHub Actions (cron)
- **IA:** DeepSeek V4 Flash via OpenRouter (gratis)
- **Imagem:** Gemini Imagen (gratis)
- **Bots:** Python 3.11+
