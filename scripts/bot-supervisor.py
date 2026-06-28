# -*- coding: utf-8 -*-
"""
bot-supervisor.py - Auto-Recuperacao Inteligente

Monitora todos os bots do GeoLeads 24/7:
- Verifica logs do GitHub Actions
- Detecta erros (timeout, auth, conteudo vazio, ffmpeg, API)
- Tenta corrigir automaticamente
- Reporta falhas no Telegram se nao conseguir resolver
"""

import os, sys, json, re, time, random, subprocess
from datetime import datetime

try:
    import requests
except ImportError:
    print("[supervisor] requests not installed")
    sys.exit(1)

REPO = os.environ.get("GITHUB_REPOSITORY", "pixel010dev-dotcom/geoleads")
TOKEN = os.environ.get("GH_TOKEN") or os.environ.get("GITHUB_TOKEN") or ""
TG_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "")
TG_CHAT = os.environ.get("TELEGRAM_ADMIN_ID") or os.environ.get("TELEGRAM_CHANNEL_ID", "")
DRY_RUN = os.environ.get("SUPERVISOR_DRY_RUN", "false").lower() == "true"

API = "https://api.github.com"
HEADERS = {"Authorization": f"Bearer {TOKEN}", "Accept": "application/vnd.github+json"}

WORKFLOWS = [
    {"name": "Twitter Bot",       "file": "twitter-bot.yml",       "cron": "5x/dia"},
    {"name": "Pinterest Bot",     "file": "pinterest-bot.yml",     "cron": "3x/dia"},
    {"name": "Telegram Bot",      "file": "telegram-bot.yml",      "cron": "4x/dia"},
    {"name": "YouTube Shorts Bot","file": "youtube-shorts-bot.yml","cron": "3x/sem"},
    {"name": "Auto Blog Post",    "file": "auto-blog.yml",         "cron": "1x/sem"},
]

ERROR_PATTERNS = {
    "auth": [r"401", r"403", r"unauthorized", r"invalid.token", r"credentials missing"],
    "timeout": [r"timeout", r"timed.?out", r"ConnectionError"],
    "rate": [r"rate limit", r"429", r"quota exceeded"],
    "empty": [r"no content", r"No content", r"no image", r"failed to create"],
    "ffmpeg": [r"ffmpeg error", r"codec not found"],
    "api": [r"500", r"502", r"503", r"Internal Server"],
    "youtube": [r"quotaExceeded", r"dailyLimitExceeded", r"invalid_grant"],
}

def log(msg, level="INFO"):
    print(f"[{datetime.now().strftime('%H:%M:%S')}] [{level}] {msg}")

def tg(msg):
    if TG_TOKEN and TG_CHAT:
        try:
            requests.post(f"https://api.telegram.org/bot{TG_TOKEN}/sendMessage",
                json={"chat_id": TG_CHAT, "text": msg, "parse_mode": "HTML"}, timeout=10)
        except: pass

def gh(url):
    if not TOKEN: return None
    try:
        r = requests.get(f"{API}{url}", headers=HEADERS, timeout=15)
        return r.json() if r.ok else None
    except: return None

def gh_put(url, data):
    if not TOKEN: return None
    try:
        r = requests.put(f"{API}{url}", headers=HEADERS, json=data, timeout=15)
        return r.json() if r.ok else None
    except: return None

def gh_post(url, data):
    if not TOKEN: return None
    try:
        r = requests.post(f"{API}{url}", headers=HEADERS, json=data, timeout=15)
        return r.json() if r.ok else None
    except: return None

def check_workflows():
    log("Verificando workflows...")
    results = []
    for wf in WORKFLOWS:
        data = gh(f"/repos/{REPO}/actions/workflows/{wf['file']}/runs?per_page=3")
        runs = []
        if data and "workflow_runs" in data:
            for r in data["workflow_runs"][:3]:
                runs.append({
                    "id": r["id"],
                    "status": r.get("status","?"),
                    "conclusion": r.get("conclusion","?"),
                    "created_at": r.get("created_at","?")[:19],
                    "url": r.get("html_url",""),
                })
        results.append({**wf, "runs": runs})
    return results

def analyze_logs(run_id):
    jobs = gh(f"/repos/{REPO}/actions/runs/{run_id}/jobs")
    if not jobs or "jobs" not in jobs: return []
    errors = []
    for job in jobs["jobs"]:
        if job["conclusion"] != "failure": continue
        try:
            r = requests.get(f"{API}/repos/{REPO}/actions/jobs/{job['id']}/logs",
                headers=HEADERS, timeout=30, allow_redirects=True)
            text = r.text if r.ok else ""
        except: text = ""
        found = set()
        for etype, pats in ERROR_PATTERNS.items():
            for p in pats:
                if re.search(p, text, re.IGNORECASE): found.add(etype)
        samples = []
        for line in text.split("\n")[-30:]:
            for plist in ERROR_PATTERNS.values():
                for p in plist:
                    if re.search(p, line, re.IGNORECASE):
                        samples.append(line.strip()[:120])
                        break
        if found:
            errors.append({"job": job["name"], "types": list(found), "samples": samples[:3]})
    return errors

def self_heal(error_types):
    actions = []
    for et in error_types:
        if et == "empty":
            tmp = os.path.join(os.path.dirname(__file__), "tmp")
            if os.path.exists(tmp):
                for f in os.listdir(tmp):
                    try:
                        os.remove(os.path.join(tmp, f))
                        actions.append("Cache limpo")
                    except: pass
        if et == "auth":
            actions.append("Token pode ter expirado")
        if et == "ffmpeg":
            actions.append("FFmpeg precisa ser reinstalado")
        if et == "youtube":
            actions.append("Verificar cota do YouTube")
    return actions if actions else ["Nenhuma correcao automatica disponivel"]

def fix_scripts():
    log("Verificando scripts...")
    scripts = os.path.dirname(os.path.abspath(__file__))
    ok = True
    for fn in ["bot_utils.py","twitter-bot.py","pinterest-bot.py","telegram-bot.py","youtube-shorts-bot.py","generate-blog-post.py"]:
        fp = os.path.join(scripts, fn)
        if os.path.exists(fp):
            r = subprocess.run(["python", "-m", "py_compile", fp], capture_output=True)
            if r.returncode != 0:
                log(f"  Sintaxe ERROR: {fn}", "WARN")
                ok = False
    if ok: log("  Todos OK!")

# ──────────── AUTO-FIX: WORKFLOW YAML ────────────

def detect_missing_pip(log_text):
    m = re.search(r"ModuleNotFoundError: No module named ['\"](.+?)['\"]", log_text)
    return m.group(1) if m else None

def fetch_workflow_file(file_name):
    url = f"/repos/{REPO}/contents/.github/workflows/{file_name}"
    data = gh(url)
    if data and "content" in data:
        import base64
        return base64.b64decode(data["content"]).decode("utf-8"), data["sha"]
    return None, None

def commit_workflow(file_name, new_content, sha, message):
    import base64
    encoded = base64.b64encode(new_content.encode("utf-8")).decode("utf-8")
    data = {
        "message": message,
        "content": encoded,
        "sha": sha,
        "branch": "main",
    }
    result = gh_put(f"/repos/{REPO}/contents/.github/workflows/{file_name}", data)
    if result and "content" in result:
        log(f"  Commit realizado: {message}")
        return "fixed"
    log(f"  Falha ao commitar: {result}", "ERROR")
    return None

def fix_workflow_missing_pip(file_name, module_name):
    content, sha = fetch_workflow_file(file_name)
    if not content:
        log(f"  Nao conseguiu ler {file_name}", "ERROR")
        return None

    pip_step = f"run: pip install {module_name}"
    if pip_step in content:
        log(f"  {file_name} ja tem pip install {module_name}")
        return "already_fixed"

    lines = content.split("\n")
    insert_at = None
    for i, line in enumerate(lines):
        s = line.strip()
        if s.startswith("run: python ") or s.startswith("run: python3 "):
            insert_at = i
            break

    if insert_at is None:
        log(f"  Nao encontrou step python em {file_name}", "ERROR")
        return None

    indent = line[:len(line) - len(line.lstrip())] if insert_at else "          "
    parent_indent = indent[:4] if len(indent) >= 4 else "    "
    new_lines = [
        "",
        f"{parent_indent}- name: Install dependencies",
        f"{parent_indent}  run: pip install {module_name}",
    ]
    for nl in reversed(new_lines):
        lines.insert(insert_at, nl)

    return commit_workflow(file_name, "\n".join(lines), sha,
        f"auto-fix: add pip install {module_name} to {file_name}")

def auto_fix_workflows(results):
    fixes = []
    for wf in results:
        if not wf["runs"]:
            continue
        last = wf["runs"][0]
        if last.get("conclusion") != "failure":
            continue

        log(f"  Analisando {wf['name']} para auto-fix...")
        errs = analyze_logs(last["id"])
        for e in errs:
            for sample in e.get("samples", []):
                module = detect_missing_pip(sample)
                if module:
                    log(f"  Detectado: ModuleNotFoundError: {module}")
                    result = fix_workflow_missing_pip(wf["file"], module)
                    if result == "fixed":
                        fixes.append(f"{wf['name']}: pip install {module} adicionado")
                        tg(f"🔧 <b>Auto-fix: {wf['name']}</b>\n"
                           f"Adicionado 'pip install {module}' ao workflow\n"
                           f"Commit automatico enviado.")
                    elif result is None:
                        fixes.append(f"{wf['name']}: tentou corrigir {module} mas falhou")
    return fixes

def run():
    log("=" * 45)
    log("GeoLeads Supervisor v1.0")
    log(f"{datetime.now().strftime('%d/%m/%Y %H:%M')}")
    log("=" * 45)

    if not TOKEN:
        log("GITHUB_TOKEN nao configurado!", "ERROR")
        return

    fix_scripts()
    results = check_workflows()

    msg = ["<b>GeoLeads Supervisor</b>\n"]
    failed = 0
    for wf in results:
        if not wf["runs"]:
            msg.append(f'⚪ {wf["name"]}: Sem dados')
            continue
        last = wf["runs"][0]
        c = last.get("conclusion","?")
        icon = "✅" if c == "success" else "❌" if c == "failure" else "🔄"
        time_str = last.get("created_at","?")[11:16] if len(last.get("created_at","")) > 16 else "?"
        msg.append(f'{icon} {wf["name"]}: {c} ({time_str})')

        if c == "failure":
            failed += 1
            errs = analyze_logs(last["id"])
            for e in errs:
                log(f'  ERRO: {wf["name"]} -> {", ".join(e["types"])}')
                actions = self_heal(e["types"])
                log(f'  CORRECAO: {actions[0]}')

    # Auto-fix: tenta corrigir workflows quebrados
    auto_fixes = auto_fix_workflows(results) if not DRY_RUN else []

    msg.append(f'\n{len(results)-failed}/{len(results)} bots OK')
    if auto_fixes:
        msg.append(f'\n🔧 Auto-fixes aplicados:')
        for f in auto_fixes:
            msg.append(f'  ✅ {f}')
    elif failed:
        msg.append(f'\n❌ {failed} bots com falha - sem auto-fix disponivel')

    if not DRY_RUN:
        tg("\n".join(msg))
        if failed:
            log("Relatorio enviado ao Telegram!")

    log("Finalizado!")

if __name__ == "__main__":
    run()
