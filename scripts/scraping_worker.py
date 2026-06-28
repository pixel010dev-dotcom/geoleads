#!/usr/bin/env python3
"""
scraping_worker.py — Worker de extracao que processa jobs pendentes do Supabase.

Uso:
  python scripts/scraping_worker.py --once
  python scripts/scraping_worker.py --dry-run
  python scripts/scraping_worker.py --job JOB_ID
"""

import os, sys, time, requests
from datetime import datetime

SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL") or os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
TELEGRAM_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN")
TELEGRAM_ADMIN_ID = os.environ.get("TELEGRAM_ADMIN_ID")
APP_URL = os.environ.get("APP_URL", "https://geoleads-production.up.railway.app")
CRON_SECRET = os.environ.get("CRON_SECRET", "")
MAX_JOBS = 5

def log(msg):
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {msg}")

def send_tg(text):
    if not TELEGRAM_TOKEN or not TELEGRAM_ADMIN_ID:
        return False
    try:
        r = requests.post(f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendMessage",
            json={"chat_id": TELEGRAM_ADMIN_ID, "text": text, "parse_mode": "HTML"}, timeout=10)
        return r.status_code == 200
    except: return False

def sb_get(table, query=""):
    if not SUPABASE_URL or not SUPABASE_KEY: return []
    h = {"apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}"}
    try:
        r = requests.get(f"{SUPABASE_URL}/rest/v1/{table}?{query}", headers=h, timeout=15)
        return r.json() if r.status_code == 200 else []
    except: return []

def sb_upd(table, id_val, data):
    if not SUPABASE_URL or not SUPABASE_KEY: return False
    h = {"apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}", "Content-Type": "application/json", "Prefer": "return=minimal"}
    try:
        r = requests.patch(f"{SUPABASE_URL}/rest/v1/{table}?id=eq.{id_val}", headers=h, json=data, timeout=15)
        return r.status_code in (200, 204)
    except: return False

def get_pending():
    jobs = sb_get("extraction_jobs",
        f"status=in.(pending,running)&order=created_at.asc&limit={MAX_JOBS}&select=id,keyword,location,status,user_id,leads_count,filter_rule")
    log(f"Found {len(jobs)} pending jobs")
    return jobs

def process_via_api(job):
    jid, kw, loc = job.get("id"), job.get("keyword", "?"), job.get("location", "?")
    limit = job.get("leads_count", 20) or 20
    log(f"  Job {jid}: {kw} em {loc}")
    try:
        r = requests.post(f"{APP_URL}/api/extract",
            json={"keyword": kw, "location": loc, "limit": limit},
            headers={"Content-Type": "application/json", "x-cron-secret": CRON_SECRET},
            timeout=30)
        if r.status_code == 200 and r.json().get("success"):
            log(f"  API aceitou! Novo job: {r.json().get('jobId')}")
            return {"status": "processing", "api_job": r.json().get('jobId')}
        log(f"  API: HTTP {r.status_code} (requer auth)")
        return {"status": "pending", "error": f"HTTP {r.status_code}"}
    except Exception as e:
        log(f"  API offline: {e}")
        return {"status": "pending", "error": str(e)[:80]}

def run_once():
    jobs = get_pending()
    if not jobs:
        return {"processed": 0}
    results = []
    for i, job in enumerate(jobs[:MAX_JOBS]):
        log(f"\n[{i+1}/{len(jobs)}]")
        r = process_via_api(job)
        results.append(r)
    log(f"\nResults: {sum(1 for r in results if r['status']=='processing')} ok, "
         f"{sum(1 for r in results if r['status']=='pending')} pending")
    s = sum(1 for r in results if r.get('status') == 'processing')
    p = sum(1 for r in results if r.get('status') == 'pending')
    send_tg(f"🔧 Worker: {len(results)} jobs | \u2705 {s} processando | \u23f3 {p} pendentes")
    return {"processed": len(results)}

def main():
    import argparse
    p = argparse.ArgumentParser()
    p.add_argument("--once", action="store_true")
    p.add_argument("--job")
    p.add_argument("--dry-run", action="store_true")
    args = p.parse_args()
    if not SUPABASE_URL or not SUPABASE_KEY:
        log("ERROR: SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY obrigatorios")
        return 1
    if args.dry_run:
        jobs = get_pending()
        log(f"DRY-RUN: {len(jobs)} jobs")
        for j in jobs: log(f"  {j['id']}: {j.get('keyword')} em {j.get('location')}")
        return 0
    if args.job:
        jobs = sb_get("extraction_jobs", f"id=eq.{args.job}&select=*")
        if jobs: process_via_api(jobs[0])
        else: log(f"Job {args.job} nao encontrado")
        return 0
    run_once() if args.once else run_loop()
    return 0

def run_loop():
    log("Worker iniciado (loop: 12 ciclos)")
    for i in range(12):
        log(f"\n--- Cycle {i+1}/12 ---")
        try: run_once()
        except Exception as e: log(f"ERROR: {e}")
        if i < 11: time.sleep(300)
    log("Worker finalizado")

if __name__ == "__main__":
    sys.exit(main())
