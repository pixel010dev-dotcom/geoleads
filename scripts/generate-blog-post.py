#!/usr/bin/env python3
"""
generate-blog-post.py — Gera posts de blog via IA e salva como arquivo Markdown.

MODO SEGURO: NÃO modifica arquivos .tsx. Gera apenas .md em /dashboard/src/content/blog/.
O desenvolvedor registra manualmente no blog/page.tsx quando quiser publicar.

Uso:
  python scripts/generate-blog-post.py                    # Gera post aleatório
  python scripts/generate-blog-post.py --slug "meu-titulo"  # Slug específico
"""

from datetime import datetime
import requests
import json
import os
import random
import re
import sys
import argparse

OPENROUTER_KEY = os.environ.get("OPENROUTER_API_KEY", "")
SLUG = os.environ.get("BLOG_SLUG", "")

TOPICS = [
    "como conseguir clientes no google maps para pequenas empresas",
    "ferramenta de extracao de leads google maps gratuita",
    "prospeccao de clientes pelo whatsapp 2026",
    "gerar leads qualificados b2b para iniciantes",
    "automacao de vendas para corretores de imoveis",
    "enriquecimento de dados de clientes com cnpj e instagram",
    "estrategias de cold outreach no whatsapp que funcionam",
    "como encontrar fornecedores no google maps passo a passo",
    "crm gratuito para microempreendedor organizar leads",
    "disparo em massa whatsapp sem ser bloqueado",
    "como extrair leads do google maps para imobiliaria",
    "marketing digital para advogados captar clientes",
    "vender mais no whatsapp business com automacao",
    "como analisar concorrencia pelo google maps",
    "guias de prospeccao digital para agencias",
    "como montar base de leads qualificados do zero",
    "whatsapp marketing para ecommerce b2b",
    "extracao de dados de empresas no google maps",
    "funil de vendas digital para prestadores de servico",
    "inteligencia artificial para gerar leads"
]

def parse_args():
    parser = argparse.ArgumentParser(description="Gera post de blog via IA")
    parser.add_argument("--slug", help="Slug específico para o post")
    parser.add_argument("--dry-run", action="store_true", help="Mostra o que geraria sem salvar")
    return parser.parse_args()

def generate_slug():
    """Gera slug aleatório baseado nos tópicos."""
    global SLUG
    if not SLUG:
        topic = random.choice(TOPICS)
        SLUG = topic.lower().replace(" ", "-")
        SLUG = re.sub(r"[^a-z0-9-]", "", SLUG)
    return SLUG

def generate_post(slug):
    """Gera um post via OpenRouter e retorna dicionário com title, description, content."""
    slug_clean = slug.replace("-", " ")

    prompt = f"""Escreva um post de blog em portugues brasileiro sobre: {slug_clean}.

Requisitos:
- Titulo SEO amigavel (max 60 chars)
- Descricao meta (max 160 chars)
- Minimo 500 palavras
- Use ## para subtitulos e ### para sub-subtitulos
- Inclua exemplos praticos e numeros
- Termine com um CTA natural para o GeoLeads (extracao de leads do Google Maps)
- Seja direto e valioso, sem enrolacao

Retorne APENAS UM JSON valido neste formato exato:
{{"title": "O titulo do post", "description": "A descricao meta", "content": ["linha1", "linha2", "linha3"]}}

Cada linha do content e um paragrafo, heading ou lista. Use "## " no inicio para headings, "- " para listas."""

    if not OPENROUTER_KEY:
        print("ERROR: OPENROUTER_API_KEY nao configurada")
        print("Gere o post manualmente ou configure a env var")
        return None

    try:
        resp = requests.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {OPENROUTER_KEY}",
                "Content-Type": "application/json"
            },
            json={
                "model": "deepseek/deepseek-v4-flash:free",
                "messages": [
                    {"role": "system", "content": "Voce e um especialista em lead generation. Responda apenas com JSON valido."},
                    {"role": "user", "content": prompt}
                ],
                "max_tokens": 2000,
                "temperature": 0.7
            },
            timeout=60
        )

        data = resp.json()
        raw = data["choices"][0]["message"]["content"]
        json_match = re.search(r"\{.*\}", raw, re.DOTALL)
        if json_match:
            post = json.loads(json_match.group())
            return post
        else:
            print("ERROR: No JSON found in response")
            print(raw[:500])
            return None
    except Exception as e:
        print(f"ERROR: {e}")
        return None

def save_post(post, slug):
    """Salva o post como arquivo Markdown."""
    today = datetime.now().strftime("%Y-%m-%d")
    posts_dir = "dashboard/src/content/blog"
    os.makedirs(posts_dir, exist_ok=True)

    content_text = "\n".join(post["content"])

    md_content = f"""---
title: "{post['title']}"
description: "{post['description']}"
date: "{today}"
slug: "{slug}"
readingTime: "{max(3, len(post['content']) // 12)} min"
---

{content_text}
"""

    md_path = os.path.join(posts_dir, f"{slug}.md")
    with open(md_path, "w", encoding="utf-8") as f:
        f.write(md_content)

    print(f"✅ Post salvo: {md_path}")
    return md_path

def main():
    args = parse_args()
    slug = args.slug or generate_slug()

    if args.dry_run:
        print(f"[DRY-RUN] Slug: {slug}")
        print(f"[DRY-RUN] Topic: {slug.replace('-', ' ')}")
        print("[DRY-RUN] Geraria um post e salvaria em dashboard/src/content/blog/")
        return 0

    post = generate_post(slug)
    if not post:
        print("Falha ao gerar post")
        return 1

    path = save_post(post, slug)

    print(f"\n📝 Resumo:")
    print(f"  Título: {post['title']}")
    print(f"  Slug: {slug}")
    print(f"  Descrição: {post['description']}")
    print(f"  Conteúdo: {len(post['content'])} linhas")
    print(f"  Arquivo: {path}")
    print(f"\n⚠️  Para publicar no site:")
    print(f"   1. Edite dashboard/src/app/blog/page.tsx")
    print(f"   2. Adicione entry no array POSTS")
    print(f"   3. Crie [slug]/page.tsx que leia de /src/content/blog/{slug}.md")
    print(f"   (ou use o componente BlogPostLoader para carregar automaticamente)")

    return 0

if __name__ == "__main__":
    sys.exit(main())