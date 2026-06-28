"""
bot_utils.py — Módulo central compartilhado por todos os bots GeoLeads

Funcionalidades:
- Geração de texto via OpenRouter (modelos grátis)
- Geração de imagem via FLUX.1-schnell (OpenRouter)
- Download de música royalty-free
- Sistema de conteúdo estratégico (calendário, formatos, temas)
- Download de imagens da web como fallback
"""

import requests
import os
import json
import random
import hashlib
from datetime import datetime

# ──────────── CONFIG ────────────

OPENROUTER_KEY = os.environ.get("OPENROUTER_API_KEY", "")
OPENROUTER_MODEL = os.environ.get("OPENROUTER_MODEL", "deepseek/deepseek-v4-flash:free")
GEMINI_KEY = os.environ.get("GEMINI_API_KEY", "")
APP_URL = os.environ.get("APP_URL", "https://geoleads-production.up.railway.app")

# ──────────── TIPOS DE CONTEÚDO ────────────

CONTENT_FORMATS = [
    "dica", "case", "comparativo", "pergunta", "lista",
    "estatistica", "tutorial", "trend", "myth", "historia"
]

NICHIOS = [
    "dentistas", "advogados", "corretores", "medicos",
    "restaurantes", "academias", "clinicas", "oficinas",
    "imobiliarias", "consultorios", "salões de beleza", "pet shops"
]

def generate_text(prompt, system_prompt=None, model=None, max_tokens=500):
    """Gera texto via OpenRouter com fallback."""
    if not OPENROUTER_KEY:
        return None
    try:
        resp = requests.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {OPENROUTER_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": model or OPENROUTER_MODEL,
                "messages": [
                    {"role": "system", "content": system_prompt or "Você é um especialista em marketing digital brasileiro. Responda apenas o que foi pedido, sem explicações extras."},
                    {"role": "user", "content": prompt},
                ],
                "max_tokens": max_tokens,
            },
            timeout=60,
        )
        return resp.json()["choices"][0]["message"]["content"].strip()
    except Exception as e:
        print(f"[bot_utils] generate_text error: {e}")
        return None

def generate_image_via_gemini(prompt):
    """Gera imagem via Gemini Imagen 2.0 (GRATIS)."""
    if not GEMINI_KEY:
        return None
    try:
        resp = requests.post(
            f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp-image-generation:generateContent?key={GEMINI_KEY}",
            headers={"Content-Type": "application/json"},
            json={
                "contents": [{"parts": [{"text": prompt}]}],
                "generationConfig": {"temperature": 1, "candidateCount": 1},
            },
            timeout=30,
        )
        data = resp.json()
        for part in data.get("candidates", [{}])[0].get("content", {}).get("parts", []):
            if "inlineData" in part:
                import base64
                return base64.b64decode(part["inlineData"]["data"])
        print("[bot_utils] Gemini empty response: no inlineData")
    except Exception as e:
        print(f"[bot_utils] generate_image_via_gemini error: {e}")
    return None

def generate_image_via_hf(prompt):
    """Gera imagem via HuggingFace Inference API (FLUX.1-schnell GRATIS)."""
    hf_key = os.environ.get("HF_API_TOKEN", "")
    if not hf_key:
        return None
    try:
        resp = requests.post(
            "https://api-inference.huggingface.co/models/black-forest-labs/FLUX.1-schnell",
            headers={"Authorization": f"Bearer {hf_key}"},
            json={"inputs": prompt},
            timeout=60,
        )
        if resp.ok:
            return resp.content
        print(f"[bot_utils] HF error: {resp.status_code}")
    except Exception as e:
        print(f"[bot_utils] HF error: {e}")
    return None

def generate_image_via_cf(prompt):
    """Gera imagem via Cloudflare Workers AI (Stable Diffusion GRATIS)."""
    cf_token = os.environ.get("CF_API_TOKEN", "")
    cf_account = os.environ.get("CF_ACCOUNT_ID", "")
    if not cf_token or not cf_account:
        return None
    try:
        resp = requests.post(
            f"https://api.cloudflare.com/client/v4/accounts/{cf_account}/ai/run/@cf/stabilityai/stable-diffusion-xl-base-1.0",
            headers={"Authorization": f"Bearer {cf_token}"},
            json={"prompt": prompt},
            timeout=60,
        )
        if resp.ok and len(resp.content) > 1000:
            return resp.content
        print(f"[bot_utils] CF error: {resp.status_code}, size: {len(resp.content)} bytes")
    except Exception as e:
        print(f"[bot_utils] CF error: {e}")
    return None

def generate_post_image(topic, style="professional marketing digital"):
    """Tenta: 1) Gemini Imagen (gratis), 2) HuggingFace FLUX (gratis), 3) Cloudflare SD (gratis)."""
    prompt = f"Professional digital marketing image about {topic}, {style}, clean design, modern, Brazilian market, 1024x1024"
    
    img = generate_image_via_gemini(prompt)
    if img:
        print(f"[bot_utils] Image via Gemini: {topic[:40]}")
        return img
    
    img = generate_image_via_hf(prompt)
    if img:
        print(f"[bot_utils] Image via HuggingFace FLUX: {topic[:40]}")
        return img
    
    img = generate_image_via_cf(prompt)
    if img:
        print(f"[bot_utils] Image via Cloudflare SD: {topic[:40]}")
        return img
    
    print("[bot_utils] No image generated (all free APIs failed)")
    return None

# ──────────── CONTEÚDO ESTRATÉGICO ────────────

def get_weekday_context():
    """Retorna contexto baseado no dia da semana para posts sazonais."""
    weekday = datetime.now().weekday()
    contexts = {
        0: "começo de semana, planejamento",
        1: "terça-feira, produtividade",
        2: "quarta-feira, dicas e estratégias",
        3: "quinta-feira, cases e resultados",
        4: "sexta-feira, tendências e novidades",
        5: "sábado, conteúdo leve",
        6: "domingo, reflexão e planejamento",
    }
    return contexts.get(weekday, "conteúdo geral")

def get_seasonal_topic():
    """Retorna um tópico sazonal baseado no mês."""
    month = datetime.now().month
    topics = {
        1: "planejamento anual de prospecção",
        2: "carnaval e prospecção digital",
        3: "mulheres empreendedoras nos negócios",
        4: "organização financeira para pequenas empresas",
        5: "dia do trabalho e automação",
        6: "festas juninas e marketing local",
        7: "férias e vendas online",
        8: "dia dos pais e prestação de serviços",
        9: "independência e novos negócios",
        10: "dia das crianças e pequenos comércios",
        11: "black friday para pequenas empresas",
        12: "natal e vendas de fim de ano",
    }
    return topics.get(month, "prospecção de leads")

def generate_varied_content(topic=None, niche=None, format_type=None):
    """Gera conteúdo variado para postagens.
    
    Retorna: (titulo, texto, image_prompt, tags)
    """
    if not topic:
        topic = get_seasonal_topic()
    if not niche:
        niche = random.choice(NICHIOS)
    if not format_type:
        format_type = random.choice(CONTENT_FORMATS)
    
    weekday_ctx = get_weekday_context()
    
    format_prompts = {
        "dica": f"Crie UMA dica prática e direta sobre {topic} para {niche}. Formato: 'DICA: ...' seguido de 2-3 linhas de explicação.",
        "case": f"Crie UM mini case (fictício mas realista) sobre {topic} para {niche}. Inclua números. Ex: 'O dentista João extraiu 50 leads em uma semana usando...'",
        "comparativo": f"Crie UM comparativo rápido entre fazer prospecção manual vs automatizada para {niche} no contexto de {topic}.",
        "pergunta": f"Crie UMA pergunta engajadora para {niche} sobre {topic}. Algo que gere reflexão e comentários.",
        "lista": f"Crie UMA lista de 3-5 itens sobre {topic} para {niche}. Formato objetivo.",
        "estatistica": f"Crie UMA estatística ou dado relevante sobre {topic} no mercado de {niche}. Pode ser fictício mas realista.",
        "tutorial": f"Crie UM mini tutorial em 3 passos sobre {topic} para {niche}.",
        "trend": f"Crie UM post sobre tendência atual de {topic} para {niche} em 2026.",
        "myth": f"Crie UM post desmistificando um mito comum sobre {topic} para {niche}.",
        "historia": f"Crie UMA história curta inspiradora de um profissional de {niche} que transformou seus resultados com {topic}.",
    }

    prompt = format_prompts.get(format_type, format_prompts["dica"])
    prompt += f"\n\nContexto: {weekday_ctx}. Nicho: {niche}."
    prompt += "\n\nFormato da resposta:\nTITULO: [titulo curto em portugues]\nTEXTO: [conteudo do post em 2-3 paragrafos]\nTAGS: [3 hashtags separadas por virgula]"

    result = generate_text(prompt, max_tokens=600)
    if not result:
        return None

    title = ""
    text = ""
    tags = "geoleads, leads, prospeccao"

    capture = False
    for line in result.split("\n"):
        ul = line.strip().upper()
        if ul.startswith("TITULO:") or ul.startswith("TITULO:"):
            title = line.split(":", 1)[1].strip()
        elif ul.startswith("TEXTO:"):
            capture = True
            text = line.split(":", 1)[1].strip() if ":" in line else ""
            continue
        elif ul.startswith("TAGS:"):
            tags = line.split(":", 1)[1].strip()
            capture = False
        elif capture and line.strip():
            text += " " + line.strip()

    if not title:
        title = f"Dica de {topic} para {niche}"
    if not text:
        text = result[:300]

    image_prompt = f"{topic} {niche} digital marketing Brazil"
    return (title.strip(), text.strip(), image_prompt, tags.strip())


def save_image_to_file(image_bytes, prefix="img", ext=".png"):
    if not image_bytes:
        return None
    tmp = os.path.join(os.path.dirname(os.path.abspath(__file__)), "tmp")
    os.makedirs(tmp, exist_ok=True)
    path = os.path.join(tmp, f"{prefix}_{hashlib.md5(image_bytes).hexdigest()[:8]}{ext}")
    with open(path, "wb") as f:
        f.write(image_bytes)
    return path

def download_music(query="upbeat corporate background music"):
    """Download video from Pixabay (ffmpeg extracts audio automatically)."""
    key = os.environ.get("PIXABAY_API_KEY", "")
    if not key:
        return None
    try:
        # Usar API de videos (funcionou nos testes - 533 resultados)
        resp = requests.get("https://pixabay.com/api/videos/",
            params={"key": key, "q": query, "safesearch": "true",
                    "per_page": 10, "order": "popular"},
            timeout=15)
        if resp.ok:
            hits = resp.json().get("hits", [])
            for hit in hits[:5]:
                videos = hit.get("videos", {})
                for size in ["small", "medium"]:
                    if size in videos and "url" in videos[size]:
                        r = requests.get(videos[size]["url"], timeout=30)
                        if r.ok and len(r.content) > 5000:
                            path = save_image_to_file(r.content, "music", ".mp4")
                            print(f"[bot_utils] Music video: {hit.get('tags', 'unknown')}")
                            return path
        print("[bot_utils] No music found")
    except Exception as e:
        print(f"[bot_utils] download_music error: {e}")
    return None

def truncate_text(text, max_len=240):
    if len(text) <= max_len:
        return text
    return text[:max_len-3] + "..."
