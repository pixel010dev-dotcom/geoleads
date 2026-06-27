import requests
import os
import json
import random
import base64
import hashlib
import hmac
import time
import urllib.parse

CONSUMER_KEY = os.environ.get("TWITTER_CONSUMER_KEY", "")
CONSUMER_SECRET = os.environ.get("TWITTER_CONSUMER_SECRET", "")
ACCESS_TOKEN = os.environ.get("TWITTER_ACCESS_TOKEN", "")
ACCESS_SECRET = os.environ.get("TWITTER_ACCESS_SECRET", "")
OPENROUTER_KEY = os.environ.get("OPENROUTER_API_KEY", "")

TWEET_TEMPLATES = [
    "Extraia leads do Google Maps em 5 minutos e dispare no WhatsApp automaticamente. Teste gratis: https://geoleads-production.up.railway.app/login",
    "Sabia que da pra extrair telefone, email, CNPJ e Instagram de qualquer negocio no Google Maps? O GeoLeads faz isso automaticamente.",
    "Prospeccao manual ta te matando? 100 leads que levariam horas sao extraidos em 5 min com o GeoLeads. Teste gratis: https://geoleads-production.up.railway.app/login",
    "O segredo da prospeccao B2B em 2026: extraia dados do Google Maps, enriqueca com CNPJ e redes sociais, aborde no WhatsApp. Tudo automatizado.",
    "3 dados que todo lead precisa ter: telefone, email e CNPJ. O GeoLeads extrai os 3 automaticamente do Google Maps.",
    "Corretores: parem de catar lead manualmente. Extraia imobiliarias inteiras do Google Maps em minutos com o GeoLeads.",
    "Automatize sua prospeccao: o GeoLeads extrai, enriquece e aborda leads no WhatsApp enquanto voce dorme. AutoVendas ativo 24h.",
    "Nao compre lista de lead gelada. Extraia dados frescos do Google Maps com CNPJ validado e Instagram. Resultado real.",
    "O GeoLeads tem CRM integrado. Leads extraidos vao direto pro seu funil de vendas. Nunca mais perca um contato.",
    "Quer testar a extracao de leads do Google Maps? Sao 10 tokens gratis sem cartao. https://geoleads-production.up.railway.app/login",
    "Enriquecimento de leads: o que e e por que so telefone nao basta. Descubra no blog do GeoLeads. Link na bio.",
    "140 cidades brasileiras disponiveis. Escolha nicho + cidade e extraia centenas de leads em minutos. Gratis para testar.",
    "Sabia que 80% dos negocios no Google Maps tem site mas nao aparece na busca? O GeoLeads encontra eles pra voce.",
    "O que voce faria com +200 leads quentes toda semana? O GeoLeads te da isso. Comece gratis: https://geoleads-production.up.railway.app/login",
    "Dica de prospeccao: busque por nicho + cidade no GeoLeads. Ex: dentista + Sao Paulo = 300+ leads em 5 min.",
    "Instagram de leads: o GeoLeads enriquece cada lead com rede social. Mais dados = mais personalizacao = mais vendas.",
    "Chatbot WhatsApp que responde 80% das perguntas sozinho. Integrado com extracao de leads do Google Maps. Tudo num lugar.",
    "Planos a partir de R$9,90/mes com 300 tokens. Cada token = 1 lead completo com telefone, email e CNPJ.",
    "Garantia de 7 dias. Se o GeoLeads nao entregar resultado, devolvemos seu dinheiro. Sem risco.",
    "Exporte seus leads para CSV, Excel ou use o CRM integrado. O GeoLeads se adapta ao seu fluxo.",
]

def generate_ai_tweet():
    if not OPENROUTER_KEY:
        return random.choice(TWEET_TEMPLATES)

    try:
        resp = requests.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {OPENROUTER_KEY}",
                "Content-Type": "application/json"
            },
            json={
                "model": "deepseek/deepseek-v4-flash-free",
                "messages": [
                    {"role": "system", "content": "Gere UM tweet curto (<260 chars) em portugues brasileiro sobre extracao de leads do Google Maps. Inclua o link https://geoleads-production.up.railway.app/login naturalmente. Sem hashtags. Responda apenas o texto do tweet."},
                    {"role": "user", "content": "Gere um tweet dica de prospeccao B2B usando Google Maps."}
                ]
            },
            timeout=30
        )
        text = resp.json()["choices"][0]["message"]["content"].strip()
        if len(text) <= 280:
            return text
    except:
        pass
    return random.choice(TWEET_TEMPLATES)

def make_oauth_header(method, url, params):
    oauth = {
        "oauth_consumer_key": CONSUMER_KEY,
        "oauth_nonce": hashlib.md5(str(time.time()).encode()).hexdigest(),
        "oauth_signature_method": "HMAC-SHA1",
        "oauth_timestamp": str(int(time.time())),
        "oauth_token": ACCESS_TOKEN,
        "oauth_version": "1.0",
    }

    all_params = {**oauth, **params}
    keys = sorted(all_params.keys())
    sig_base = "&".join(f"{urllib.parse.quote(k, safe='')}={urllib.parse.quote(str(all_params[k]), safe='')}" for k in keys)
    sig_string = f"{method}&{urllib.parse.quote(url, safe='')}&{urllib.parse.quote(sig_base, safe='')}"
    sig_key = f"{urllib.parse.quote(CONSUMER_SECRET, safe='')}&{urllib.parse.quote(ACCESS_SECRET, safe='')}"
    signature = base64.b64encode(hmac.new(sig_key.encode(), sig_string.encode(), hashlib.sha1).digest()).decode()
    oauth["oauth_signature"] = signature

    header = "OAuth " + ", ".join(f'{k}="{urllib.parse.quote(str(v), safe="")}"' for k, v in sorted(oauth.items()))
    return header

def tweet(text):
    url = "https://api.twitter.com/2/tweets"
    params = {"text": text}
    body = json.dumps(params)
    headers = {
        "Authorization": make_oauth_header("POST", url, params),
        "Content-Type": "application/json",
    }
    resp = requests.post(url, headers=headers, data=body)
    return resp.json()

if __name__ == "__main__":
    text = generate_ai_tweet()
    print(f"Tweeting: {text}")
    result = tweet(text)
    print(f"Result: {json.dumps(result, indent=2)}")
