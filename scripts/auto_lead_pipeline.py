"""
auto_lead_pipeline.py — Pipeline automático de geração de leads

Configura nichos + cidades, roda extração via API, enriquece leads,
salva no CRM, e manda resumo no Telegram.

Uso:
  python auto_lead_pipeline.py                    # Roda todas as cidades
  python auto_lead_pipeline.py --city "Curitiba"  # Só uma cidade
  python auto_lead_pipeline.py --dry-run          # Só mostra o que faria
"""

import os
import sys
import json
import time
import requests
from datetime import datetime

# ──────────── CONFIG ────────────

SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
APP_URL = os.environ.get("APP_URL")
TELEGRAM_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN")
TELEGRAM_ADMIN_ID = os.environ.get("TELEGRAM_ADMIN_ID")
TELEGRAM_CHANNEL = os.environ.get("TELEGRAM_CHANNEL_ID")

# Nichos e cidades pra buscar
PIPELINE_CONFIG = [
    {"niche": "dentista", "cities": ["São Paulo", "Curitiba", "Rio de Janeiro"], "limit": 20},
    {"niche": "academia", "cities": ["São Paulo", "Curitiba"], "limit": 15},
    {"niche": "restaurante", "cities": ["São Paulo"], "limit": 15},
    {"niche": "advogado", "cities": ["Curitiba", "São Paulo"], "limit": 15},
    {"niche": "petshop", "cities": ["Curitiba"], "limit": 10},
]

# ──────────── HELPERS ────────────

def send_telegram(text):
    url = f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendMessage"
    chat_id = TELEGRAM_ADMIN_ID if TELEGRAM_ADMIN_ID else TELEGRAM_CHANNEL
    try:
        requests.post(url, json={"chat_id": chat_id, "text": text, "parse_mode": "HTML"}, timeout=10)
    except:
        pass

def supabase_get(table, query=""):
    url = f"{SUPABASE_URL}/rest/v1/{table}?{query}"
    headers = {"apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}"}
    r = requests.get(url, headers=headers, timeout=10)
    return r.json() if r.status_code == 200 else []

def supabase_insert(table, data):
    url = f"{SUPABASE_URL}/rest/v1/{table}"
    headers = {"apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}", "Content-Type": "application/json", "Prefer": "return=minimal"}
    r = requests.post(url, headers=headers, json=data, timeout=10)
    return r.status_code in (200, 201)

def score_lead(lead):
    s = 0
    if lead.get("nome"): s += 15
    if lead.get("telefone") and lead["telefone"] != "Não informado": s += 20
    if lead.get("site") and lead["site"] != "Sem site": s += 15
    if lead.get("email"): s += 15
    if lead.get("cnpj"): s += 10
    if lead.get("instagram"): s += 8
    if lead.get("facebook"): s += 8
    if lead.get("tiktok"): s += 8
    if lead.get("linkedin"): s += 8
    if lead.get("endereco"): s += 10
    if lead.get("avaliacao") and lead["avaliacao"] != "N/A": s += 5
    return s

def quality_emoji(score):
    if score >= 70: return "🔥"
    if score >= 40: return "⚡"
    if score >= 10: return "❄️"
    return "🗑️"

# ──────────── PIPELINE ────────────

def run_extraction(niche, city, limit, dry_run=False):
    """Rodar extração via API e retornar leads"""
    if dry_run:
        print(f"  [DRY-RUN] Extrairia {limit} leads de '{niche}' em '{city}'")
        return []

    print(f"  Extraindo {limit} leads de '{niche}' em '{city}'...")

    # Usa service role pra criar job direto no Supabase
    # (sem precisar de JWT do usuário)
    job_data = {
        "user_id": "00000000-0000-0000-0000-000000000000",  # System user
        "status": "running",
        "keyword": niche,
        "location": city,
        "filter_rule": "",
        "leads_count": 0,
        "scanned": 0,
        "cities_scanned": 0,
        "search_time_seconds": 0,
        "started_at": datetime.utcnow().isoformat() + "Z",
    }

    headers = {"apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}", "Content-Type": "application/json"}

    # Insere job
    r = requests.post(f"{SUPABASE_URL}/rest/v1/extraction_jobs", headers=headers, json=job_data, timeout=10)
    if r.status_code not in (200, 201):
        print(f"  Erro ao criar job: {r.status_code}")
        return []

    job_id = r.json()[0]["id"] if r.json() else None
    if not job_id:
        print("  Erro: job ID não retornado")
        return []

    # Chama a API de extração via HTTP (com service role bypassando auth)
    # Na verdade, vamos usar as estratégias diretamente via Supabase Edge Function
    # Por enquanto, retorna leads mockados pra demonstração
    print(f"  Job {job_id} criado. Aguardando extração...")

    # Polling do job
    for i in range(60):  # Max 5 min
        time.sleep(5)
        r = requests.get(f"{SUPABASE_URL}/rest/v1/extraction_jobs?id=eq.{job_id}&select=*", headers=headers, timeout=10)
        if r.status_code == 200 and r.json():
            job = r.json()[0]
            if job["status"] in ("completed", "failed", "cancelled"):
                leads = job.get("leads") or []
                print(f"  Job concluído: {len(leads)} leads em {job.get('search_time_seconds', 0)}s")
                return leads

    print("  Timeout: job não concluído em 5 min")
    return []

def save_leads_to_crm(leads, niche, city, user_id="00000000-0000-0000-0000-000000000000"):
    """Salva leads no CRM do sistema"""
    saved = 0
    for lead in leads:
        score = score_lead(lead)
        if score < 10:  # Pula lixo
            continue

        nome = lead.get("nome", "")
        telefone = lead.get("telefone", "")
        lead_key = f"{nome.lower()}|{telefone}"

        crm_data = {
            "user_id": user_id,
            "lead_key": lead_key,
            "nome": nome,
            "telefone": telefone,
            "site": lead.get("site", ""),
            "email": lead.get("email", ""),
            "cnpj": lead.get("cnpj", ""),
            "instagram": lead.get("instagram", ""),
            "facebook": lead.get("facebook", ""),
            "tiktok": lead.get("tiktok", ""),
            "linkedin": lead.get("linkedin", ""),
            "endereco": lead.get("endereco", ""),
            "avaliacao": lead.get("avaliacao", ""),
            "categoria": lead.get("categoria", ""),
            "cidade": city,
            "nicho": niche,
            "stage": "Novo",
            "notes": f"Auto-pipeline: {niche} em {city}",
            "tags": [],
            "saved_at": datetime.utcnow().isoformat() + "Z",
        }

        if supabase_insert("crm_leads", crm_data):
            saved += 1

    return saved

def run_pipeline(city_filter=None, dry_run=False):
    """Rodar pipeline completo"""
    print(f"\n{'='*60}")
    print(f"  GeoLeads Auto Pipeline — {datetime.now().strftime('%d/%m/%Y %H:%M')}")
    print(f"{'='*60}\n")

    total_extracted = 0
    total_saved = 0
    results = []

    for config in PIPELINE_CONFIG:
        niche = config["niche"]
        cities = config["cities"]
        limit = config["limit"]

        if city_filter:
            cities = [c for c in cities if c.lower() == city_filter.lower()]
            if not cities:
                continue

        for city in cities:
            print(f"\n[{niche.upper()}] {city}")

            leads = run_extraction(niche, city, limit, dry_run)
            total_extracted += len(leads)

            if leads and not dry_run:
                saved = save_leads_to_crm(leads, niche, city)
                total_saved += saved
                results.append({"niche": niche, "city": city, "extracted": len(leads), "saved": saved})

            time.sleep(2)  # Rate limit

    # Resumo
    print(f"\n{'='*60}")
    print(f"  RESUMO: {total_extracted} extraídos, {total_saved} salvos no CRM")
    print(f"{'='*60}\n")

    # Manda resumo no Telegram
    if not dry_run and (total_extracted > 0 or results):
        text = f"🚀 <b>Pipeline Auto Concluído</b>\n\n"
        text += f"📊 <b>Total:</b> {total_extracted} leads extraídos, {total_saved} salvos\n\n"
        for r in results:
            text += f"• <b>{r['niche']}</b> em {r['city']}: {r['extracted']} → {r['saved']} CRM\n"
        text += f"\n🔗 {APP_URL}/dashboard"
        send_telegram(text)

    return {"extracted": total_extracted, "saved": total_saved, "results": results}

# ──────────── MAIN ────────────

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="GeoLeads Auto Pipeline")
    parser.add_argument("--city", help="Filtrar uma cidade específica")
    parser.add_argument("--dry-run", action="store_true", help="Mostrar o que faria sem executar")
    parser.add_argument("--test-telegram", action="store_true", help="Testar notificação Telegram")
    args = parser.parse_args()

    if args.test_telegram:
        send_telegram("🤖 <b>GeoLeads Pipeline Online</b>\n\nPipeline automático de leads configurado e pronto!")
        print("Mensagem de teste enviada!")
    else:
        run_pipeline(city_filter=args.city, dry_run=args.dry_run)
