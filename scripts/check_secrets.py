#!/usr/bin/env python3
"""check_secrets.py - Verifica variaveis de ambiente.
Uso: python scripts/check_secrets.py"""
import os

SECRETS = {
    "TELEGRAM_BOT_TOKEN": "Telegram Bot",
    "TELEGRAM_ADMIN_ID": "Admin ID",
    "TELEGRAM_CHANNEL_ID": "Canal ID",
    "GH_TOKEN": "GitHub API",
    "SUPABASE_URL": "Supabase URL",
    "SUPABASE_SERVICE_ROLE_KEY": "Supabase Key",
    "NEXT_PUBLIC_SUPABASE_URL": "Supabase Public",
    "APP_URL": "App URL",
    "CRON_SECRET": "Cron Secret",
    "OPENROUTER_API_KEY": "OpenRouter",
    "GEMINI_API_KEY": "Gemini",
    "HF_API_TOKEN": "HuggingFace",
    "CF_API_TOKEN": "Cloudflare",
    "CF_ACCOUNT_ID": "CF Account",
    "TWITTER_CONSUMER_KEY": "Twitter Key",
    "TWITTER_CONSUMER_SECRET": "Twitter Secret",
    "TWITTER_ACCESS_TOKEN": "Twitter Token",
    "TWITTER_ACCESS_SECRET": "Twitter Access",
    "PINTEREST_TOKEN": "Pinterest",
    "GOOGLE_CLIENT_ID": "Google ID",
    "GOOGLE_CLIENT_SECRET": "Google Secret",
    "GOOGLE_REFRESH_TOKEN": "Google Refresh",
    "PIXABAY_API_KEY": "Pixabay",
}

ok = sum(1 for e in SECRETS if os.environ.get(e))
miss = len(SECRETS) - ok
print(f"GeoLeads: {ok} configuradas, {miss} faltando")
if miss:
    print("Faltam:")
    for e, d in sorted(SECRETS.items()):
        if not os.environ.get(e):
            print(f"  - {e} ({d})")
