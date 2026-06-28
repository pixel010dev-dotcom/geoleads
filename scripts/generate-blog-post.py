from datetime import datetime
import requests
import json
import os
import random
import re

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

if not SLUG:
    SLUG = random.choice(TOPICS)
    SLUG = SLUG.lower().replace(" ", "-")
    SLUG = re.sub(r"[^a-z0-9-]", "", SLUG)

slug_clean = SLUG.replace("-", " ")

prompt = """Escreva um post de blog em portugues brasileiro sobre: {slug_clean}.

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
        ]
    }
)

data = resp.json()
try:
    raw = data["choices"][0]["message"]["content"]
    # Extract JSON from response
    json_match = re.search(r"\{.*\}", raw, re.DOTALL)
    if json_match:
        post = json.loads(json_match.group())
    else:
        raise ValueError("No JSON found in response")
except Exception as e:
    print(f"Error parsing response: {e}")
    print(resp.text[:500])
    exit(1)

title = post["title"]
description = post["description"]
content = post["content"]

# Save blog post files
post_dir = "dashboard/src/app/blog/[slug]"
os.makedirs(post_dir, exist_ok=True)

# Save the listing page update
# We'll append to the posts array in page.tsx
listing_file = "dashboard/src/app/blog/page.tsx"
with open(listing_file, "r", encoding="utf-8") as f:
    listing = f.read()

# Find the last post entry and add new one
new_entry = """  {{
    slug: '{SLUG}',
    title: '{title}',
    excerpt: '{description}',
    date: '{datetime.now().strftime("%d/%m/%Y")}',
    readTime: '{max(3, len(content) // 12)} min',
  }},
"""

# Insert before the closing bracket of posts array
listing = listing.replace("];", f"{new_entry}];")

with open(listing_file, "w", encoding="utf-8") as f:
    f.write(listing)

# Save the post content in [slug]/page.tsx
post_content_file = "dashboard/src/app/blog/[slug]/page.tsx"
with open(post_content_file, "r", encoding="utf-8") as f:
    post_content_data = f.read()

new_post_entry = """  '{SLUG}': {{
    title: '{title}',
    description: '{description}',
    date: '{datetime.now().strftime("%d/%m/%Y")}',
    readTime: '{max(3, len(content) // 12)} min',
    content: {json.dumps(content)},
  }},
"""

# Insert before the closing of POSTS
post_content_data = post_content_data.replace("};\n\nexport async function generateStaticParams", f"}};\n\n{new_post_entry}\nexport async function generateStaticParams")

with open(post_content_file, "w", encoding="utf-8") as f:
    f.write(post_content_data)

print(f"✅ Blog post generated: {title}")
print(f"   Slug: {SLUG}")
print(f"   Content lines: {len(content)}")
