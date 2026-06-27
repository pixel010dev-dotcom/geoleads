import requests
import os
import json
import random

TOKEN = os.environ.get("PINTEREST_TOKEN", "")
APP_URL = "https://geoleads-production.up.railway.app"

PINS = [
    {"title": "Extracao de Leads no Google Maps", "desc": "Aprenda como extrair leads do Google Maps automaticamente. Ferramenta gratuita para gerar clientes.", "url": f"{APP_URL}/cidade/sao-paulo"},
    {"title": "Prospeccao B2B pelo WhatsApp", "desc": "Estrategias de prospeccao B2B pelo WhatsApp. Template de mensagens, horarios ideais e automacao.", "url": f"{APP_URL}/blog/prospeccao-b2b-whatsapp"},
    {"title": "CRM para Pequenas Empresas", "desc": "Organize seus leads com CRM integrado. Do Google Maps ao funil de vendas em um clique.", "url": f"{APP_URL}/blog/crm-para-pequenas-empresas"},
    {"title": "Enriquecimento de Leads", "desc": "Saiba como enriquecer leads com email, CNPJ e Instagram. Aumente suas chances de conversao.", "url": f"{APP_URL}/blog/enriquecimento-de-leads"},
    {"title": "Calculadora de Leads", "desc": "Descubra quantos leads voce pode extrair no seu nicho e cidade. Calculadora gratuita.", "url": f"{APP_URL}/calculadora-leads"},
    {"title": "Extrair Leads de Advogados", "desc": "Encontre advogados em qualquer cidade. Extracao automatica de telefone, email e site.", "url": f"{APP_URL}/nicho/advogado/sao-paulo"},
    {"title": "Extrair Leads de Dentistas", "desc": "Encontre dentistas no Google Maps. Dados completos com telefone, WhatsApp e redes sociais.", "url": f"{APP_URL}/nicho/dentista/sao-paulo"},
    {"title": "AutoVendas Automatico", "desc": "Campanhas automaticas de lead generation. Extraia, enriqueca e aborde leads sem fazer nada.", "url": f"{APP_URL}/pricing"},
]

CITIES = [
    "sao-paulo", "rio-de-janeiro", "belo-horizonte", "brasilia",
    "salvador", "fortaleza", "curitiba", "recife", "porto-alegre", "campinas"
]

def pin_image_url(text):
    return f"https://placehold.co/600x900/1a1a2e/3b82f6?text={text.replace(' ', '+')[:50]}"

def create_pin(title, description, url, image_url):
    headers = {
        "Authorization": f"Bearer {TOKEN}",
        "Content-Type": "application/json",
    }
    board_id = get_or_create_board()

    data = {
        "board_id": board_id,
        "title": title,
        "description": description,
        "link": url,
        "media_source": {
            "source_type": "image_url",
            "url": image_url,
        },
    }
    resp = requests.post(
        "https://api.pinterest.com/v5/pins",
        headers=headers,
        json=data,
    )
    return resp.json()

def get_or_create_board():
    headers = {"Authorization": f"Bearer {TOKEN}"}
    boards = requests.get("https://api.pinterest.com/v5/boards", headers=headers).json()
    for b in boards.get("items", []):
        if b["name"] == "Extracao de Leads":
            return b["id"]

    data = {
        "name": "Extracao de Leads",
        "description": "Dicas e ferramentas para extracao de leads no Google Maps",
    }
    resp = requests.post("https://api.pinterest.com/v5/boards", headers=headers, json=data)
    return resp.json().get("id")

if __name__ == "__main__":
    if not TOKEN:
        print("No Pinterest token")
        exit(1)

    pin = random.choice(PINS)

    if "{cidade}" in pin["title"]:
        city = random.choice(CITIES)
        pin["title"] = pin["title"].replace("{cidade}", city.replace("-", " ").title())
        pin["url"] = pin["url"].replace("{cidade}", city)

    img = pin_image_url(pin["title"])
    result = create_pin(pin["title"], pin["desc"], pin["url"], img)
    print(f"Pinned: {pin['title']}")
    print(json.dumps(result, indent=2)[:300])
