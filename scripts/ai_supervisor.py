#!/usr/bin/env python3
"""
AI System Supervisor - GeoLeads
================================
Cerebro autonomo com IA que monitora, diagnostica e conserta
TODOS os componentes do sistema GeoLeads.

Modelos: DeepSeek V4 Flash (primario) -> OpenRouter Free (fallback)
Ciclo: scan -> diagnostico -> cura -> report -> sleep
"""

import os
import sys
import json
import time
import subprocess
import re
import requests
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional, Any

# ============================================================
# CONFIGURACAO GLOBAL
# ============================================================

# Usa GITHUB_WORKSPACE (CI) ou fallback pra Windows (dev local)
WORKSPACE = os.environ.get("GITHUB_WORKSPACE", r"C:\Users\Admin\geoleads")
PROJECT_DIR = Path(WORKSPACE)
SCRIPTS_DIR = PROJECT_DIR / "scripts"
WORKFLOWS_DIR = PROJECT_DIR / ".github" / "workflows"

# Provedores de IA em ordem de prioridade
# OpenCode Zen (primario) -> OpenRouter (fallback)
AI_PROVIDERS = [
    {
        "name": "opencode-zen",
        "base_url": "https://opencode.ai/zen/v1/chat/completions",
        "api_key_env": "OPENCODE_ZEN_KEY",
        "model": "deepseek-v4-flash",
        "headers": {
            "Content-Type": "application/json",
        },
    },
    {
        "name": "openrouter",
        "base_url": "https://openrouter.ai/api/v1/chat/completions",
        "api_key_env": "OPENROUTER_API_KEY",
        "model": "openrouter/free",
        "headers": {
            "Content-Type": "application/json",
            "HTTP-Referer": "https://github.com/pixel010dev-dotcom/geoleads",
        },
    },
]

# Ciclo: ~25min trabalho + 5min sleep = 30min cada, 10 ciclos = 5 horas
CYCLE_WORK_MINUTES = 25
CYCLE_SLEEP_MINUTES = 5
MAX_CYCLES = 10

# Credenciais obrigatorias que o bot precisa pra funcionar
REQUIRED_ENV_VARS = [
    "GH_TOKEN",
    "TELEGRAM_BOT_TOKEN",
    "TELEGRAM_CHANNEL_ID",
]


# ============================================================
# 1. CREDENTIAL VAULT - Cofre seguro (le SOMENTE de ENV)
# ============================================================

class CredentialVault:
    """Acesso seguro a credenciais - le APENAS de environment variables.
    
    NUNCA armazena credenciais em texto plano no codigo.
    Em CI: usa GitHub Secrets injetados como ENV.
    Em dev: usa .env ou ENV configuradas manualmente.
    """
    
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._loaded = False
        return cls._instance
    
    def _load_all(self):
        if self._loaded:
            return
        
        # Mapa de todas as credenciais conhecidas e seus nomes ENV
        self.cred_map = {
            # GitHub
            "GH_TOKEN": "GH_TOKEN",
            # AI Providers
            "OPENCODE_ZEN_KEY": "OPENCODE_ZEN_KEY",
            "OPENROUTER_API_KEY": "OPENROUTER_API_KEY",
            # Telegram
            "TELEGRAM_BOT_TOKEN": "TELEGRAM_BOT_TOKEN",
            "TELEGRAM_CHANNEL_ID": "TELEGRAM_CHANNEL_ID",
            # Supabase
            "SUPABASE_URL": "SUPABASE_URL",
            "SUPABASE_ANON_KEY": "SUPABASE_ANON_KEY",
            "SUPABASE_SERVICE_KEY": "SUPABASE_SERVICE_KEY",
            # Cloudflare
            "CF_API_TOKEN": "CF_API_TOKEN",
            "CF_ACCOUNT_ID": "CF_ACCOUNT_ID",
            "CF_WORKER_URL": "CF_WORKER_URL",
            # Google / YouTube
            "GOOGLE_CLIENT_ID": "GOOGLE_CLIENT_ID",
            "GOOGLE_CLIENT_SECRET": "GOOGLE_CLIENT_SECRET",
            "GOOGLE_REFRESH_TOKEN": "GOOGLE_REFRESH_TOKEN",
            # Gemini AI
            "GEMINI_API_KEY": "GEMINI_API_KEY",
            # HuggingFace
            "HF_API_TOKEN": "HF_API_TOKEN",
            # Railway
            "RAILWAY_TOKEN": "RAILWAY_TOKEN",
            "RAILWAY_URL": "RAILWAY_URL",
            # Pixabay
            "PIXABAY_API_KEY": "PIXABAY_API_KEY",
        }
        
        # Le tudo do ambiente
        self._values = {}
        for key, env_name in self.cred_map.items():
            val = os.environ.get(env_name)
            if val:
                self._values[key] = val
        
        # Railway URL tem fallback fixo
        if "RAILWAY_URL" not in self._values:
            self._values["RAILWAY_URL"] = "https://geoleads-production.up.railway.app"
        
        self._loaded = True
        configured = sum(1 for k in self.cred_map if k in self._values)
        print(f"[Vault] {configured}/{len(self.cred_map)} credenciais carregadas via ENV")
    
    def get(self, key: str, default: Any = None) -> Any:
        self._load_all()
        return self._values.get(key, default)
    
    def has(self, key: str) -> bool:
        self._load_all()
        return key in self._values
    
    def list_missing(self) -> list:
        self._load_all()
        missing = [k for k in REQUIRED_ENV_VARS if k not in self._values]
        return missing


# ============================================================
# 2. AI BRAIN - Cerebro OpenRouter com fallback
# ============================================================

class AIBrain:
    """Cerebro de IA com suporte a multiplos provedores com fallback.
    
    Prioridade:
    1. OpenCode Zen (DeepSeek V4 Flash) - primario
    2. OpenRouter (modelos free) - fallback
    """
    
    def __init__(self):
        self.vault = CredentialVault()
        self.current_provider = 0
        self._log_available_providers()
    
    def _log_available_providers(self):
        """Loga quais provedores estao disponiveis."""
        print("[Brain] Provedores de IA disponiveis:")
        for i, p in enumerate(AI_PROVIDERS):
            key = self.vault.get(p["api_key_env"])
            status = "OK" if key else "SEM CHAVE"
            print(f"  {i+1}. {p['name']} ({p['model']}) - {status}")
    
    def _call_provider(self, provider: dict, messages: list, max_tokens: int) -> Optional[str]:
        """Chama um provedor especifico."""
        api_key = self.vault.get(provider["api_key_env"])
        if not api_key:
            print(f"[Brain] {provider['name']}: chave nao configurada ({provider['api_key_env']})")
            return None
        
        headers = {
            "Authorization": f"Bearer {api_key}",
            **provider["headers"],
        }
        
        print(f"[Brain] Tentando {provider['name']} ({provider['model']})...")
        
        try:
            resp = requests.post(
                provider["base_url"],
                headers=headers,
                json={
                    "model": provider["model"],
                    "messages": messages,
                    "max_tokens": max_tokens,
                    "temperature": 0.3,
                },
                timeout=60
            )
            
            if resp.status_code == 200:
                content = resp.json()["choices"][0]["message"]["content"]
                print(f"[Brain] OK: {provider['name']} respondeu!")
                return content
            else:
                error_msg = resp.text[:150]
                print(f"[Brain] {provider['name']} erro {resp.status_code}: {error_msg}")
                return None
        except requests.exceptions.Timeout:
            print(f"[Brain] {provider['name']}: timeout")
            return None
        except Exception as e:
            print(f"[Brain] {provider['name']}: {e}")
            return None
    
    def think(self, system_prompt: str, user_prompt: str, max_tokens: int = 2000) -> Optional[str]:
        """Chama a IA com fallback entre provedores."""
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ]
        
        # Tenta cada provedor em ordem
        for i, provider in enumerate(AI_PROVIDERS):
            result = self._call_provider(provider, messages, max_tokens)
            if result:
                self.current_provider = i
                return result
        
        print("[Brain] TODOS OS PROVEDORES FALHARAM!")
        return None
    
    def analyze_logs(self, logs: str) -> dict:
        """Analisa logs de erro e retorna diagnostico JSON."""
        result = self.think(
            system_prompt="""Voce e um SRE senior. Analise logs de erro e retorne APENAS um JSON:
{"error_type": "tipo", "root_cause": "causa", "severity": 1-5, 
"fix_suggestion": "como consertar", "auto_fixable": true/false}
Tipos: auth, timeout, rate_limit, api_error, empty_content, ffmpeg, youtube, db, unknown.
Nao explique nada, responda SOMENTE o JSON.""",
            user_prompt=f"Analise estes logs:\n\n{logs[:3000]}"
        )
        
        if result:
            try:
                return json.loads(result)
            except json.JSONDecodeError:
                match = re.search(r'\{.*\}', result, re.DOTALL)
                if match:
                    try:
                        return json.loads(match.group(0))
                    except:
                        pass
        return {"error_type": "unknown", "root_cause": "Falha ao analisar", 
                "severity": 3, "fix_suggestion": "Verificar manualmente", "auto_fixable": False}
    
    def generate_fix(self, error_type: str, context: str) -> Optional[str]:
        """Gera codigo/comando shell pra corrigir um problema."""
        return self.think(
            system_prompt="""Voce e um SRE que executa correcoes. Dado um tipo de erro e contexto,
retorne APENAS o codigo Python OU comando shell para corrigir. 
Use subprocess ou requests no codigo. Responda SOMENTE o codigo.""",
            user_prompt=f"Tipo de erro: {error_type}\nContexto: {context[:1000]}\n\nGere codigo para corrigir."
        )


# ============================================================
# 3. SCANNER - Varredura de componentes
# ============================================================

class Scanner:
    """Escaneia todos os componentes do sistema."""
    
    def __init__(self):
        self.vault = CredentialVault()
    
    def scan_all(self) -> dict:
        print("[Scanner] Iniciando varredura completa...")
        results = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "bots": self.scan_bots(),
            "apis": self.scan_apis(),
            "scripts": self.scan_scripts(),
            "credentials": self.scan_credentials(),
            "frontend": self.scan_frontend(),
        }
        print("[Scanner] Varredura completa!")
        return results
    
    def _github_api(self, endpoint: str) -> Optional[dict]:
        """Helper para chamadas a API do GitHub."""
        token = self.vault.get("GH_TOKEN")
        if not token:
            return None
        
        headers = {
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.github.v3+json",
        }
        
        try:
            resp = requests.get(
                f"https://api.github.com/repos/pixel010dev-dotcom/geoleads/{endpoint}",
                headers=headers, timeout=15
            )
            if resp.status_code == 200:
                return resp.json()
        except Exception as e:
            print(f"[Scanner] GitHub API error: {e}")
        
        return None
    
    def scan_bots(self) -> list:
        print("[Scanner] Escaneando bots...")
        results = []
        
        workflows = [
            "twitter-bot.yml", "pinterest-bot.yml", "telegram-bot.yml",
            "youtube-shorts-bot.yml", "auto-blog.yml", "supervisor.yml",
        ]
        
        for wf in workflows:
            runs = self._github_api(f"actions/workflows/{wf}/runs?per_page=1")
            if runs and runs.get("workflow_runs"):
                run = runs["workflow_runs"][0]
                status = "success" if run["conclusion"] == "success" else "failed"
                entry = {
                    "name": wf.replace(".yml", ""),
                    "status": status,
                    "conclusion": run["conclusion"],
                    "updated_at": run["updated_at"],
                    "url": run["html_url"],
                }
                
                if run["conclusion"] == "failure":
                    jobs = self._github_api(f"actions/runs/{run['id']}/jobs")
                    if jobs and jobs.get("jobs"):
                        for job in jobs["jobs"]:
                            if job["conclusion"] == "failure":
                                logs_url = job.get("logs_url", "")
                                if logs_url:
                                    try:
                                        h = {"Authorization": f"Bearer {self.vault.get('GH_TOKEN')}"}
                                        logs_resp = requests.get(logs_url, headers=h, timeout=15)
                                        if logs_resp.status_code == 200:
                                            entry["logs"] = logs_resp.text[:2000]
                                    except:
                                        pass
                                break
                
                results.append(entry)
            else:
                results.append({"name": wf.replace(".yml", ""), "status": "no_runs"})
        
        return results
    
    def scan_apis(self) -> list:
        print("[Scanner] Escaneando APIs...")
        results = []
        
        endpoints = [
            ("Railway", self.vault.get("RAILWAY_URL", "https://geoleads-production.up.railway.app")),
            ("Supabase", f"{self.vault.get('SUPABASE_URL', '')}/rest/v1/"),
        ]
        
        cf_url = self.vault.get("CF_WORKER_URL")
        if cf_url:
            endpoints.append(("Cloudflare Worker", f"https://{cf_url}"))
        
        for name, url in endpoints:
            if not url or url in ("https://", f"https:///rest/v1/"):
                results.append({"name": name, "status": "skipped", "detail": "URL nao configurada"})
                continue
            
            try:
                resp = requests.get(url, timeout=10, headers={"User-Agent": "AISupervisor/1.0"})
                if resp.status_code < 500:
                    results.append({"name": name, "status": "ok", "http": resp.status_code})
                else:
                    results.append({"name": name, "status": "error", "http": resp.status_code})
            except requests.exceptions.ConnectionError:
                results.append({"name": name, "status": "error", "detail": "Conexao recusada"})
            except requests.exceptions.Timeout:
                results.append({"name": name, "status": "error", "detail": "Timeout"})
            except Exception as e:
                results.append({"name": name, "status": "error", "detail": str(e)[:100]})
        
        return results
    
    def scan_scripts(self) -> list:
        print("[Scanner] Escaneando scripts...")
        results = []
        
        if not SCRIPTS_DIR.exists():
            return [{"name": "scripts", "status": "error", "detail": "Diretorio nao encontrado"}]
        
        for py_file in sorted(SCRIPTS_DIR.glob("*.py")):
            if py_file.name == "ai_supervisor.py":
                continue  # nao se auto-examina
            try:
                result = subprocess.run(
                    [sys.executable, "-m", "py_compile", str(py_file)],
                    capture_output=True, text=True, timeout=15
                )
                if result.returncode == 0:
                    results.append({"name": py_file.name, "status": "ok"})
                else:
                    results.append({"name": py_file.name, "status": "syntax_error",
                                   "detail": result.stderr[:300]})
            except Exception as e:
                results.append({"name": py_file.name, "status": "error", "detail": str(e)[:100]})
        
        return results
    
    def scan_credentials(self) -> list:
        print("[Scanner] Escaneando credenciais...")
        critical = [
            ("GH_TOKEN", "GitHub API"),
            ("OPENROUTER_API_KEY", "OpenRouter AI"),
            ("TELEGRAM_BOT_TOKEN", "Telegram"),
            ("GOOGLE_CLIENT_ID", "Google OAuth"),
        ]
        
        results = []
        for cred, label in critical:
            if self.vault.has(cred):
                results.append({"name": cred, "label": label, "status": "ok"})
            else:
                results.append({"name": cred, "label": label, "status": "missing"})
        
        return results
    
    def scan_frontend(self) -> dict:
        print("[Scanner] Escaneando frontend...")
        url = self.vault.get("RAILWAY_URL", "https://geoleads-production.up.railway.app")
        
        try:
            resp = requests.get(url, timeout=15, headers={"User-Agent": "AISupervisor/1.0"})
            return {
                "status": "ok" if resp.status_code < 500 else "error",
                "http": resp.status_code,
                "response_time_ms": round(resp.elapsed.total_seconds() * 1000),
            }
        except requests.exceptions.ConnectionError:
            return {"status": "error", "detail": "Conexao recusada"}
        except Exception as e:
            return {"status": "error", "detail": str(e)[:100]}


# ============================================================
# 4. HEALER - Correcoes automaticas
# ============================================================

class Healer:
    """Analisa diagnosticos e executa correcoes."""
    
    def __init__(self):
        self.vault = CredentialVault()
        self.fixes = []
    
    def heal(self, diagnostics: list) -> list:
        print(f"[Healer] Analisando {len(diagnostics)} diagnosticos...")
        self.fixes = []
        
        for diag in diagnostics:
            if not diag.get("auto_fixable"):
                print(f"[Healer] Pulando (nao auto-fixable): {diag.get('error_type')}")
                continue
            
            fix = self._try_fix(diag)
            if fix:
                self.fixes.append(fix)
        
        return self.fixes
    
    def _try_fix(self, diag: dict) -> Optional[dict]:
        """Tenta corrigir um diagnostico."""
        error_type = diag.get("error_type", "")
        source = diag.get("source", "unknown")
        
        print(f"[Healer] Tentando corrigir {error_type} em {source}")
        
        # 1. Erros de conteudo vazio -> limpa tmp
        if "empty" in error_type:
            return self._cleanup_tmp()
        
        # 2. Erros de autenticacao -> tenta renovar token
        if "auth" in error_type or "401" in error_type or "403" in error_type:
            return self._refresh_tokens()
        
        # 3. Erros de timeout -> verifica conectividade
        if "timeout" in error_type:
            return self._check_connectivity()
        
        # 4. Erros de sintaxe -> relata (correcao manual por enquanto)
        if "syntax" in error_type:
            return {"type": "syntax", "status": "reported", 
                    "detail": diag.get("fix_suggestion", "Correcao manual necessaria")[:200]}
        
        # 5. Qualquer outro erro auto-fixable -> executa sugestao da IA
        fix_suggestion = diag.get("fix_suggestion", "")
        if fix_suggestion:
            return self._execute_ai_suggestion(error_type, fix_suggestion)
        
        return None
    
    def _cleanup_tmp(self) -> dict:
        try:
            tmp_dir = PROJECT_DIR / "tmp"
            if tmp_dir.exists():
                count = 0
                for f in tmp_dir.iterdir():
                    if f.is_file():
                        f.unlink()
                        count += 1
                print(f"[Healer] tmp limpo: {count} arquivos removidos")
                return {"type": "cleanup", "target": "tmp", "status": "success", "files_removed": count}
            return {"type": "cleanup", "target": "tmp", "status": "not_needed"}
        except Exception as e:
            return {"type": "cleanup", "target": "tmp", "status": "failed", "error": str(e)}
    
    def _refresh_tokens(self) -> dict:
        print("[Healer] Tentando renovar tokens...")
        refresh = self.vault.get("GOOGLE_REFRESH_TOKEN")
        cid = self.vault.get("GOOGLE_CLIENT_ID")
        secret = self.vault.get("GOOGLE_CLIENT_SECRET")
        
        if refresh and cid and secret:
            try:
                resp = requests.post("https://oauth2.googleapis.com/token", data={
                    "client_id": cid,
                    "client_secret": secret,
                    "refresh_token": refresh,
                    "grant_type": "refresh_token",
                }, timeout=15)
                
                if resp.status_code == 200:
                    print("[Healer] Token YouTube renovado!")
                    return {"type": "token_refresh", "target": "youtube", "status": "success"}
                else:
                    print(f"[Healer] Falha renovando token: {resp.status_code}")
                    return {"type": "token_refresh", "target": "youtube", "status": "failed"}
            except Exception as e:
                print(f"[Healer] Erro renovando token: {e}")
                return {"type": "token_refresh", "target": "youtube", "status": "error", "error": str(e)}
        
        return {"type": "token_refresh", "status": "skipped", "detail": "Credenciais Google nao configuradas"}
    
    def _check_connectivity(self) -> dict:
        print("[Healer] Verificando conectividade...")
        try:
            resp = requests.get("https://google.com", timeout=10)
            if resp.status_code == 200:
                return {"type": "connectivity", "status": "ok"}
            return {"type": "connectivity", "status": "degraded", "http": resp.status_code}
        except Exception as e:
            return {"type": "connectivity", "status": "offline", "error": str(e)[:100]}
    
    def _execute_ai_suggestion(self, error_type: str, suggestion: str) -> dict:
        """Tenta executar a sugestao de correcao da IA."""
        print(f"[Healer] Executando sugestao da IA para {error_type}...")
        
        # Tenta interpretar a sugestao como comando shell ou codigo Python
        lines = suggestion.strip().split("\n")
        
        # Se comecar com comando shell comum
        first_line = lines[0].strip() if lines else ""
        shell_cmds = ["pip ", "npm ", "git ", "ffmpeg", "curl ", "wget ", "mkdir", "rm ", "cp ", "mv "]
        
        is_shell = any(first_line.startswith(cmd) for cmd in shell_cmds)
        
        if is_shell:
            try:
                cmd_str = "\n".join(lines)
                result = subprocess.run(cmd_str, shell=True, capture_output=True, text=True, timeout=30)
                print(f"[Healer] Comando executado. Exit: {result.returncode}")
                return {
                    "type": "ai_command",
                    "error_type": error_type,
                    "status": "success" if result.returncode == 0 else "failed",
                    "command": first_line[:80],
                    "output": result.stdout[:200] if result.returncode == 0 else result.stderr[:200],
                }
            except subprocess.TimeoutExpired:
                return {"type": "ai_command", "error_type": error_type, "status": "timeout"}
            except Exception as e:
                return {"type": "ai_command", "error_type": error_type, "status": "error", "detail": str(e)[:100]}
        
        # Se for codigo Python, tenta executar
        if "import " in suggestion or "requests." in suggestion or "subprocess" in suggestion:
            try:
                exec_globals = {"requests": requests, "subprocess": subprocess, "os": os}
                exec(suggestion, exec_globals)
                print("[Healer] Codigo Python executado com sucesso!")
                return {"type": "ai_python", "error_type": error_type, "status": "success"}
            except Exception as e:
                print(f"[Healer] Erro executando codigo: {e}")
                return {"type": "ai_python", "error_type": error_type, "status": "failed", "error": str(e)[:100]}
        
        # Se nao conseguiu interpretar, registra como sugestao
        return {"type": "ai_suggestion", "error_type": error_type, "status": "logged",
                "detail": suggestion[:200]}


# ============================================================
# 5. REPORTER - Notificacoes Telegram
# ============================================================

class Reporter:
    """Envia relatorios via Telegram."""
    
    def __init__(self):
        self.vault = CredentialVault()
    
    def send(self, text: str) -> bool:
        token = self.vault.get("TELEGRAM_BOT_TOKEN")
        admin_id = self.vault.get("TELEGRAM_ADMIN_ID")
        channel_id = self.vault.get("TELEGRAM_CHANNEL_ID")
        chat_id = admin_id if admin_id else channel_id
        
        if not token or not chat_id:
            print("[Reporter] Telegram nao configurado")
            print(text[:500])
            return False
        
        try:
            resp = requests.post(
                f"https://api.telegram.org/bot{token}/sendMessage",
                json={"chat_id": chat_id, "text": text, "parse_mode": "HTML"},
                timeout=15
            )
            return resp.status_code == 200
        except Exception as e:
            print(f"[Reporter] Erro: {e}")
            return False
    
    def cycle_report(self, cycle: int, scan: dict, diagnostics: list, fixes: list) -> str:
        """Gera relatorio do ciclo."""
        lines = [
            f"<b>AI Supervisor - Ciclo {cycle}/{MAX_CYCLES}</b>",
            f"<code>{datetime.now().strftime('%d/%m/%Y %H:%M')}</code>",
            "",
        ]
        
        # Resumo dos bots
        bots = scan.get("bots", [])
        ok = sum(1 for b in bots if b.get("status") == "success")
        fail = sum(1 for b in bots if b.get("status") == "failed")
        lines.append(f"<b>Bots:</b> {ok} ok, {fail} falha(s)")
        
        # APIs
        apis = scan.get("apis", [])
        api_ok = sum(1 for a in apis if a.get("status") == "ok")
        api_err = sum(1 for a in apis if a.get("status") == "error")
        lines.append(f"<b>APIs:</b> {api_ok} ok, {api_err} erro(s)")
        
        # Scripts
        scripts = scan.get("scripts", [])
        s_ok = sum(1 for s in scripts if s.get("status") == "ok")
        s_err = sum(1 for s in scripts if s.get("status") != "ok")
        lines.append(f"<b>Scripts:</b> {s_ok} ok, {s_err} problema(s)")
        
        # Frontend
        fe = scan.get("frontend", {})
        lines.append(f"<b>Frontend:</b> {fe.get('status', '?')}")
        
        # Correcoes
        if fixes:
            lines.append(f"\n<b>Correcoes:</b> {len(fixes)}")
            for f in fixes:
                lines.append(f"  [{f.get('status','?')}] {f.get('type','?')}")
        
        # Diagnosticos criticos
        critical = [d for d in diagnostics if d.get("severity", 0) >= 4]
        if critical:
            lines.append(f"\n<b>Criticos:</b> {len(critical)}")
            for c in critical[:3]:
                lines.append(f"  {c.get('root_cause', '?')[:80]}")
        
        msg = "\n".join(lines)
        self.send(msg)
        return msg


# ============================================================
# 6. SUPERVISOR - Orquestrador principal
# ============================================================

class AISupervisor:
    """Orquestrador: scan -> diagnostico -> cura -> report em loop."""
    
    def __init__(self):
        self.vault = CredentialVault()
        self.brain = AIBrain()
        self.scanner = Scanner()
        self.healer = Healer()
        self.reporter = Reporter()
        self.cycle_count = 0
        self.all_fixes = []
        
        print(f"\n{'#'*60}")
        print(f"#  AI SYSTEM SUPERVISOR")
        print(f"#  {datetime.now().strftime('%d/%m/%Y %H:%M')}")
        print(f"#  Workspace: {PROJECT_DIR}")
        print(f"#  Ciclos: {MAX_CYCLES}")
        print(f"{'#'*60}\n")
    
    def run_cycle(self) -> dict:
        """Um ciclo: scan -> diagnostico -> cura -> report."""
        self.cycle_count += 1
        print(f"\n{'='*50}")
        print(f"  CICLO {self.cycle_count}/{MAX_CYCLES}")
        print(f"{'='*50}\n")
        
        # 1. SCAN
        scan = self.scanner.scan_all()
        
        # 2. DIAGNOSTICO (IA) - apenas para bots com falha
        diagnostics = []
        for bot in scan.get("bots", []):
            if bot.get("status") == "failed" and bot.get("logs"):
                print(f"[Supervisor] Diagnosticando falha em {bot['name']}...")
                diag = self.brain.analyze_logs(bot["logs"])
                diag["source"] = f"bot:{bot['name']}"
                diagnostics.append(diag)
        
        # Scripts com erro
        for script in scan.get("scripts", []):
            if script.get("status") == "syntax_error":
                diagnostics.append({
                    "error_type": "syntax",
                    "root_cause": f"Erro de sintaxe em {script['name']}",
                    "severity": 4,
                    "fix_suggestion": script.get("detail", ""),
                    "auto_fixable": False,
                    "source": f"script:{script['name']}",
                })
        
        # Frontend offline
        fe = scan.get("frontend", {})
        if fe.get("status") == "error":
            diagnostics.append({
                "error_type": "frontend_down",
                "root_cause": f"Frontend offline: {fe.get('detail', '')}",
                "severity": 5,
                "fix_suggestion": "Verificar Railway",
                "auto_fixable": False,
                "source": "frontend",
            })
        
        # 3. CURA
        fixes = self.healer.heal(diagnostics)
        self.all_fixes.extend(fixes)
        
        # 4. REPORT
        self.reporter.cycle_report(self.cycle_count, scan, diagnostics, fixes)
        
        print(f"[Supervisor] Ciclo {self.cycle_count} completo!")
        return {"scan": scan, "diagnostics": diagnostics, "fixes": fixes}
    
    def run(self):
        """Loop principal."""
        # Reporta inicio
        missing = self.vault.list_missing()
        if missing:
            msg = f"<b>AI Supervisor iniciado</b>\n<code>{datetime.now().strftime('%d/%m/%Y %H:%M')}</code>\n\n<b>Credenciais faltando:</b>\n" + "\n".join(f"  - {m}" for m in missing)
        else:
            msg = f"<b>AI Supervisor iniciado</b>\n<code>{datetime.now().strftime('%d/%m/%Y %H:%M')}</code>\n\nCiclos: {MAX_CYCLES}\nMonitorando: bots, APIs, scripts, frontend, credenciais"
        self.reporter.send(msg)
        
        # Loop de ciclos
        for _ in range(MAX_CYCLES):
            try:
                self.run_cycle()
                
                # Sleep entre ciclos (em incrementos de 30s)
                if self.cycle_count < MAX_CYCLES:
                    print(f"[Supervisor] Dormindo {CYCLE_SLEEP_MINUTES}min...")
                    for _ in range(CYCLE_SLEEP_MINUTES * 2):
                        time.sleep(30)
            except Exception as e:
                print(f"[Supervisor] Erro no ciclo: {e}")
                self.reporter.send(f"<b>Erro no ciclo {self.cycle_count}:</b> {str(e)[:200]}")
                time.sleep(60)
        
        # Reporta fim
        summary = (
            f"<b>AI Supervisor finalizado</b>\n"
            f"<code>{datetime.now().strftime('%d/%m/%Y %H:%M')}</code>\n\n"
            f"Ciclos: {self.cycle_count}\n"
            f"Correcoes: {len(self.all_fixes)}\n"
            f"Proximo: amanha as 08:00 UTC"
        )
        self.reporter.send(summary)
        
        print(f"\nResumo: {self.cycle_count} ciclos, {len(self.all_fixes)} correcoes")


# ============================================================
# MAIN
# ============================================================

if __name__ == "__main__":
    supervisor = AISupervisor()
    supervisor.run()
