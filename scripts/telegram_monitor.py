"""
telegram_monitor.py — Bot do Telegram que monitora extrações GeoLeads em tempo real

Funcionalidades:
- Notifica quando extração completa (leads, qualidade, tempo)
- Comando /stats — estatísticas gerais
- Comando /status — últimos jobs
- Comando /ping — verifica se está vivo
- Resumo diário automático

Rodar via GitHub Actions a cada 5 minutos ou como processo contínuo.
"""

import os
import json
import time
import requests
from datetime import datetime, timedelta, timezone

# ──────────── CONFIG ────────────

TELEGRAM_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "8755188266:AAE0U4gaMc7dKByW_wFeoOEvpm00_E-va-w")
TELEGRAM_ADMIN_ID = os.environ.get("TELEGRAM_ADMIN_ID", "8955181160")  # ID do admin pra DM
TELEGRAM_CHANNEL = os.environ.get("TELEGRAM_CHANNEL_ID", "-1003870508744")  # Fallback pro grupo
SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "https://mwnpwrzwgwrqqlomqhux.supabase.co")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im13bnB3cnp3Z3dycXFsb21xaHV4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTIzODgyNCwiZXhwIjoyMDk0ODE0ODI0fQ.YVZQ3cPMJaPjBnggkEV4SxNeh4Y-PVisP2ST5YF0rl8")
APP_URL = os.environ.get("APP_URL", "https://geoleads-production.up.railway.app")

STATE_FILE = os.path.join(os.path.dirname(__file__), ".monitor_state.json")

# ──────────── HELPERS ────────────

def supabase_get(table, query=""):
    url = f"{SUPABASE_URL}/rest/v1/{table}?{query}"
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
    }
    r = requests.get(url, headers=headers, timeout=10)
    if r.status_code == 200:
        return r.json()
    return []

def send_telegram(text, parse_mode="HTML", admin_only=True):
    """Envia mensagem. Se admin_only=True, manda DM pro admin. Senão, manda pro grupo."""
    url = f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendMessage"
    chat_id = TELEGRAM_ADMIN_ID if (admin_only and TELEGRAM_ADMIN_ID) else TELEGRAM_CHANNEL
    payload = {"chat_id": chat_id, "text": text, "parse_mode": parse_mode}
    try:
        r = requests.post(url, json=payload, timeout=10)
        return r.status_code == 200
    except:
        return False

def load_state():
    try:
        with open(STATE_FILE, "r") as f:
            return json.load(f)
    except:
        return {"last_job_id": None, "last_check": None, "daily_stats": {}}

def save_state(state):
    with open(STATE_FILE, "w") as f:
        json.dump(state, f)

# ──────────── QUALIDADE ────────────

def quality_emoji(score):
    if score >= 70: return "🔥"
    if score >= 40: return "⚡"
    if score >= 10: return "❄️"
    return "🗑️"

def quality_label(score):
    if score >= 70: return "Alta"
    if score >= 40: return "Média"
    if score >= 10: return "Baixa"
    return "Lixo"

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

# ──────────── NOTIFICAÇÕES ────────────

def notify_extraction_complete(job):
    leads = job.get("leads") or []
    total = len(leads)
    keyword = job.get("keyword", "?")
    location = job.get("location", "?")
    time_s = job.get("search_time_seconds", 0)

    scores = [score_lead(l) for l in leads]
    high = sum(1 for s in scores if s >= 70)
    med = sum(1 for s in scores if 40 <= s < 70)
    low = sum(1 for s in scores if 10 <= s < 40)
    trash = sum(1 for s in scores if s < 10)

    with_phone = sum(1 for l in leads if l.get("telefone") and l["telefone"] != "Não informado")
    with_site = sum(1 for l in leads if l.get("site") and l["site"] != "Sem site")
    with_email = sum(1 for l in leads if l.get("email"))
    with_insta = sum(1 for l in leads if l.get("instagram"))

    top3 = sorted(zip(scores, leads), key=lambda x: x[0], reverse=True)[:3]
    top3_text = ""
    for sc, l in top3:
        name = (l.get("nome") or "?")[:35]
        phone = l.get("telefone", "")
        if phone and phone != "Não informado":
            phone = phone[:20]
        top3_text += f"  {quality_emoji(sc)} <b>{name}</b>"
        if phone:
            top3_text += f" — {phone}"
        top3_text += "\n"

    text = f"""<b>🎯 Extração Completa</b>

<b>Busca:</b> {keyword} em {location}
<b>Resultado:</b> {total} leads em {time_s}s

<b>📊 Qualidade:</b>
  🔥 Alta: {high} | ⚡ Média: {med} | ❄️ Baixa: {low} | 🗑️ Lixo: {trash}

<b>📞 Dados:</b>
  📱 Telefone: {with_phone}/{total}
  🌐 Site: {with_site}/{total}
  ✉️ Email: {with_email}/{total}
  📸 Instagram: {with_insta}/{total}

<b>🏆 Top 3:</b>
{top3_text}
<b>🔗 Abrir Dashboard:</b> {APP_URL}/dashboard"""

    send_telegram(text)

def notify_extraction_failed(job):
    keyword = job.get("keyword", "?")
    location = job.get("location", "?")
    error = job.get("error", "Erro desconhecido")
    text = f"""<b>❌ Extração Falhou</b>

<b>Busca:</b> {keyword} em {location}
<b>Erro:</b> {error[:200]}"""
    send_telegram(text)

# ──────────── COMANDOS ────────────

def cmd_stats():
    now = datetime.now(timezone.utc)
    today = now.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    week_ago = (now - timedelta(days=7)).isoformat()

    jobs_today = supabase_get("extraction_jobs", f"created_at=gte.{today}&select=id,status,leads_count,search_time_seconds")
    jobs_week = supabase_get("extraction_jobs", f"created_at=gte.{week_ago}&select=id,status,leads_count,search_time_seconds")
    users = supabase_get("profiles", "select=id")

    total_today = len(jobs_today)
    total_week = len(jobs_week)
    leads_today = sum(j.get("leads_count", 0) or 0 for j in jobs_today)
    leads_week = sum(j.get("leads_count", 0) or 0 for j in jobs_week)
    success_today = sum(1 for j in jobs_today if j.get("status") == "completed")

    text = f"""<b>📈 Estatísticas GeoLeads</b>

<b>Hoje:</b> {total_today} extrações, {leads_today} leads
<b>7 dias:</b> {total_week} extrações, {leads_week} leads
<b>Taxa sucesso:</b> {success_today}/{total_today} ({round(success_today/max(total_today,1)*100)}%)
<b>Usuários:</b> {len(users)}

<b>🔗 Dashboard:</b> {APP_URL}/dashboard"""

    send_telegram(text)

def cmd_status():
    jobs = supabase_get("extraction_jobs", "order=created_at.desc&limit=5&select=keyword,location,status,leads_count,created_at")
    if not jobs:
        send_telegram("<b>📋 Últimos Jobs:</b>\nNenhum job encontrado.")
        return

    text = "<b>📋 Últimos 5 Jobs:</b>\n\n"
    for j in jobs:
        status = "✅" if j.get("status") == "completed" else "❌" if j.get("status") == "failed" else "⏳"
        kw = (j.get("keyword") or "?")[:20]
        loc = (j.get("location") or "?")[:15]
        leads = j.get("leads_count", 0) or 0
        created = j.get("created_at", "")[:16].replace("T", " ")
        text += f"{status} <b>{kw}</b> em {loc} — {leads} leads ({created})\n"

    send_telegram(text)

# ──────────── MONITOR ────────────

def check_new_completions():
    state = load_state()
    last_id = state.get("last_job_id")

    query = "status=eq.completed&order=created_at.desc&limit=5"
    if last_id:
        query += f"&id=gt.{last_id}"

    jobs = supabase_get("extraction_jobs", query)
    if not jobs:
        return

    for job in reversed(jobs):
        if job.get("id") == last_id:
            continue
        if job.get("delivered"):
            notify_extraction_complete(job)

    state["last_job_id"] = jobs[0]["id"]
    state["last_check"] = datetime.now(timezone.utc).isoformat()
    save_state(state)

def check_failed():
    state = load_state()
    last_check = state.get("last_check") or datetime.now(timezone.utc).isoformat()

    jobs = supabase_get("extraction_jobs", f"status=eq.failed&created_at=gt.{last_check}&order=created_at.desc&limit=5")
    for job in jobs:
        notify_extraction_failed(job)

# ──────────── MAIN ────────────

def main():
    print(f"[{datetime.now()}] Telegram Monitor iniciado")

    # Verifica se há comandos pendentes (via webhook ou polling)
    # Por enquanto, roda como monitor periódico
    while True:
        try:
            check_new_completions()
            check_failed()
        except Exception as e:
            print(f"[ERROR] {e}")

        time.sleep(300)  # 5 minutos

if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1:
        cmd = sys.argv[1]
        if cmd == "stats":
            cmd_stats()
        elif cmd == "status":
            cmd_status()
        elif cmd == "once":
            check_new_completions()
            check_failed()
        elif cmd == "test":
            send_telegram("<b>🤖 GeoLeads Monitor Online</b>\n\nMonitorando extrações em tempo real...")
            print("Mensagem enviada!")
        else:
            print(f"Comando desconhecido: {cmd}")
            print("Uso: python telegram_monitor.py [stats|status|once|test]")
    else:
        main()
