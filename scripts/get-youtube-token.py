
"""
YouTube OAuth Token Generator - GeoLeads
Projeto: geoleads-youtube (OWNER: pixel010dev)
Test user ja configurado - pode rodar sem bloqueio
"""

import os, json, pickle
from google_auth_oauthlib.flow import InstalledAppFlow

SCOPES = ["https://www.googleapis.com/auth/youtube.upload"]
TOKEN_FILE = "youtube_token.pickle"

CLIENT_CONFIG = {
    "installed": {
        "client_id": os.environ.get("GOOGLE_CLIENT_ID", "45933989727-24rb40fetl49gsms3104rmukta5cagej"),
        "client_secret": os.environ.get("GOOGLE_CLIENT_SECRET", "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"),
        "redirect_uris": ["http://localhost"],
        "auth_uri": "https://accounts.google.com/o/oauth2/auth",
        "token_uri": "https://oauth2.googleapis.com/token"
    }
}

print("=" * 60)
print("YouTube OAuth Token Generator - GeoLeads")
print("Projeto: geoleads-youtube (test user OK)")
print("=" * 60)
print()

flow = InstalledAppFlow.from_client_config(CLIENT_CONFIG, SCOPES)

print("Abrindo navegador para autorizacao...")
print("Faca login com pixel010dev@gmail.com e clique em PERMITIR")
print()
print("Aguardando autorizacao...")

creds = flow.run_local_server(port=0, open_browser=True)

print()
print("=" * 60)
print("SUCESSO! Token gerado!")
print("=" * 60)

with open(TOKEN_FILE, "wb") as f:
    pickle.dump(creds, f)
print(f"Token salvo em: {TOKEN_FILE}")
print()
print("GOOGLE_REFRESH_TOKEN:")
print(creds.refresh_token)
print()
print("Copie o REFRESH_TOKEN acima e adicione no GitHub Secrets!")
