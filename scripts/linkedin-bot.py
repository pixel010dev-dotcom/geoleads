import requests
import os
import json
import random
import io
import re

ACCESS_TOKEN = os.environ.get("LINKEDIN_ACCESS_TOKEN", "")
OPENROUTER_KEY = os.environ.get("OPENROUTER_API_KEY", "")
GEMINI_KEY = os.environ.get("GEMINI_API_KEY", "")
APP_URL = "https://geoleads-production.up.railway.app"

TOPICS = [
    "extracao de leads Google Maps automatizada",
    "prospeccao B2B com dados enriquecidos",
    "automacao de vendas com WhatsApp",
    "CRM para pequenas empresas",
    "enriquecimento de dados de leads",
    "ferramentas de prospeccao 2026",
    "lead generation para corretores",
    "chatbot WhatsApp para vendas",
    "como extrair clientes do Google Maps",
    "vendas automatizadas para pequenos negocios",
]

def generate_text(prompt, model="openrouter/free"):
    try:
        resp = requests.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {OPENROUTER_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": model,
                "messages": [
                    {"role": "system", "content": "Voce e um especialista em marketing digital brasileiro. Responda apenas no formato pedido."},
                    {"role": "user", "content": prompt},
                ],
            },
            timeout=60,
        )
        return resp.json()["choices"][0]["message"]["content"].strip()
    except:
        return None

def generate_image_via_gemini(prompt):
    if not GEMINI_KEY:
        return None
    try:
        resp = requests.post(
            f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key={GEMINI_KEY}",
            headers={"Content-Type": "application/json"},
            json={
                "contents": [{"parts": [{"text": prompt}]}],
                "generationConfig": {"temperature": 1},
            },
            timeout=30,
        )
        data = resp.json()
        for part in data.get("candidates", [{}])[0].get("content", {}).get("parts", []):
            if "inlineData" in part:
                import base64
                return io.BytesIO(base64.b64decode(part["inlineData"]["data"]))
    except:
        pass
    return None

def generate_post():
    topic = random.choice(TOPICS)
    prompt = f"""Crie UM post curto para LinkedIn em portugues brasileiro sobre: {topic}
Regras:
- TITULO: linha unica curta e chamativa (max 100 chars)
- TEXTO: 2-3 paragrafos curtos, tom profissional, max 250 palavras
- IMAGE: descricao EM INGLES para gerar imagem de marketing digital (max 200 chars)
- Inclua o link {APP_URL}/login naturalmente no texto

Formato:
TITULO: <linha>
TEXTO: <texto>
IMAGE: <descricao>"""

    result = generate_text(prompt)
    if not result:
        return fallback_post()

    lines = result.split("\n")
    headline = ""
    text = ""
    image_prompt = ""
    section = ""

    for line in lines:
        upper = line.upper().strip()
        if upper.startswith("TITULO:"):
            headline = line.split(":", 1)[1].strip()
            section = "text"
        elif upper.startswith("TEXTO:"):
            text = line.split(":", 1)[1].strip()
            section = "text"
        elif upper.startswith("IMAGE:"):
            image_prompt = line.split(":", 1)[1].strip()
            section = "image"
        elif section == "text" and line.strip():
            text += "\n" + line.strip()
        elif section == "image" and line.strip():
            image_prompt += " " + line.strip()

    if not headline or not text:
        return fallback_post()

    return headline.strip(), text.strip(), image_prompt.strip()

def fallback_post():
    templates = [
        ("Extraia leads do Google Maps em minutos",
         "Chega de prospeccao manual! Com o GeoLeads voce extrai telefone, email, CNPJ e redes sociais de qualquer negocio no Google Maps automaticamente.\n\nTeste gratis: {url}/login",
         "Professional digital marketing dashboard showing lead extraction from Google Maps on laptop screen, modern design, blue and purple gradient"),
        ("Automatize sua prospeccao B2B",
         "O segredo da prospeccao B2B em 2026: extraia dados do Google Maps, enriqueca com CNPJ e Instagram, aborde no WhatsApp. Tudo automatizado com o GeoLeads.\n\n{url}/blog/prospeccao-b2b-whatsapp",
         "Business professional analyzing data charts and growth metrics on multiple monitors, modern office"),
        ("CRM integrado com extracao de leads",
         "Leads extraidos vao direto pro seu funil de vendas. O GeoLeads tem CRM integrado com etapas, tags e historico completo.\n\nNunca mais perca um contato. {url}/login",
         "Modern CRM dashboard interface showing lead pipeline and sales funnel visualization, clean UI design"),
    ]
    t = random.choice(templates)
    return t[0], t[1].format(url=APP_URL), t[2]

def generate_image(prompt):
    img = generate_image_via_gemini(prompt)
    if img:
        print("Image generated via Gemini (Imagen) - FREE")
        return img
    print("No image generated (free tier quota exceeded, posting text only)")
    return None

def get_person_urn():
    resp = requests.get(
        "https://api.linkedin.com/v2/userinfo",
        headers={"Authorization": f"Bearer {ACCESS_TOKEN}"}
    )
    if not resp.ok:
        return None
    return f"urn:li:person:{resp.json()['sub']}"

def upload_image_to_linkedin(image_bytes):
    person_id = requests.get(
        "https://api.linkedin.com/v2/userinfo",
        headers={"Authorization": f"Bearer {ACCESS_TOKEN}"}
    ).json()["sub"]

    init = requests.post(
        "https://api.linkedin.com/rest/images?action=initializeUpload",
        headers={
            "Authorization": f"Bearer {ACCESS_TOKEN}",
            "LinkedIn-Version": "202412",
            "X-Restli-Protocol-Version": "2.0.0",
            "Content-Type": "application/json",
        },
        json={"initializeUploadRequest": {"owner": f"urn:li:person:{person_id}"}},
    )
    if not init.ok:
        return None

    data = init.json()
    upload_url = data["value"]["uploadMechanism"]["com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"]["uploadUrl"]
    image_urn = data["value"]["image"]

    requests.put(upload_url, data=image_bytes, headers={
        "Authorization": f"Bearer {ACCESS_TOKEN}",
        "Content-Type": "application/octet-stream",
    })
    return image_urn

def create_post(author, headline, text, image_urn=None):
    body = {
        "author": author,
        "commentary": f"{headline}\n\n{text}",
        "visibility": "PUBLIC",
        "distribution": {
            "feedDistribution": "MAIN_FEED",
            "targetEntities": [],
            "thirdPartyDistributionChannels": []
        },
        "lifecycleState": "PUBLISHED",
        "isReshareDisabledByAuthor": False,
    }
    if image_urn:
        body["content"] = [{
            "type": "IMAGE",
            "image": {"id": image_urn, "altText": headline},
        }]

    resp = requests.post(
        "https://api.linkedin.com/rest/posts",
        headers={
            "Authorization": f"Bearer {ACCESS_TOKEN}",
            "LinkedIn-Version": "202412",
            "X-Restli-Protocol-Version": "2.0.0",
            "Content-Type": "application/json",
        },
        json=body,
    )
    return resp

if __name__ == "__main__":
    if not ACCESS_TOKEN:
        print("ERRO: LINKEDIN_ACCESS_TOKEN nao configurado")
        exit(1)

    if not OPENROUTER_KEY:
        print("ERRO: OPENROUTER_API_KEY nao configurado")
        exit(1)

    author = get_person_urn()
    if not author:
        print("ERRO: nao foi possivel obter URN do LinkedIn")
        exit(1)

    headline, text, image_prompt = generate_post()
    print(f"Headline: {headline}")
    print(f"Text: {text[:120]}...")
    print(f"Image prompt: {image_prompt[:80]}...")

    image_urn = None
    if image_prompt:
        img_data = generate_image(image_prompt)
        if img_data:
            image_urn = upload_image_to_linkedin(img_data.getvalue())
            print(f"Image uploaded: {image_urn}" if image_urn else "Image upload failed")
            img_data.close()

    result = create_post(author, headline, text, image_urn)
    print(f"Status: {result.status_code}")
    if result.ok:
        print("Post criado com sucesso no LinkedIn!")
    else:
        print(f"Erro: {result.text[:300]}")
