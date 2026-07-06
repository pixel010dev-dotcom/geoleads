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
        "model": "deepseek/deepseek-v4-flash:free",
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
            self._values["RAILWAY_URL"] = os.environ.get("RAILWAY_URL") or os.environ.get("APP_URL", "")
        
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
            "youtube-shorts-bot.yml", "auto-blog.yml",
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
            ("Railway", self.vault.get("RAILWAY_URL", os.environ.get("APP_URL", "https://geoleads-production-6583.up.railway.app"))),
            ("Supabase", f"{self.vault.get('SUPABASE_URL', '')}/rest/v1/"),
        ]
        
        cf_url = self.vault.get("CF_WORKER_URL")
        if cf_url:
            endpoints.append(("Cloudflare Worker", f"https://{cf_url}"))
        
        for name, url in endpoints:
            if not url or url in ("https://", "https:///rest/v1/"):
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
        url = self.vault.get("RAILWAY_URL", os.environ.get("APP_URL", "https://geoleads-production-6583.up.railway.app"))
        
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
        
        # 5. Erros de rate_limit ou api_error -> espera e tenta denovo
        if "rate_limit" in error_type or "429" in error_type:
            print("[Healer] Rate limit detectado, aguardando 10s...")
            time.sleep(10)
            return {"type": "rate_limit", "status": "waited", "detail": "Aguardou 10s"}

        # 6. ffmpeg not found -> tenta instalar
        if "ffmpeg" in error_type or error_type == "ffmpeg":
            return self._install_ffmpeg()

        # 7. Qualquer outro erro auto-fixable -> executa sugestao da IA
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
    
    def _fix_workflow_yaml(self, file_name: str, error_type: str) -> Optional[dict]:
        """Auto-corrige workflow YAML (ex: adicionar pip install requests)."""
        token = self.vault.get("GH_TOKEN")
        if not token:
            print("[Healer] GH_TOKEN nao configurado, pulando auto-fix YAML")
            return None

        headers = {"Authorization": f"Bearer {token}", "Accept": "application/vnd.github+json"}
        repo = "pixel010dev-dotcom/geoleads"

        # Ler arquivo
        r = requests.get(
            f"https://api.github.com/repos/{repo}/contents/.github/workflows/{file_name}",
            headers=headers, timeout=15
        )
        if r.status_code != 200:
            print(f"[Healer] Nao conseguiu ler {file_name}: {r.status_code}")
            return None

        import base64
        data = r.json()
        sha = data["sha"]
        content = base64.b64decode(data["content"]).decode("utf-8")

        # Verificar se o fix ja existe
        fix_map = {
            "no_module_requests": ("requests", "pip install requests"),
            "no_module_google": ("google-auth google-auth-httplib2 google-api-python-client", "pip install google-auth google-auth-httplib2 google-api-python-client"),
            "no_module_pillow": ("Pillow", "pip install Pillow"),
            "no_module_ytdlp": ("yt-dlp", "pip install yt-dlp"),
            "no_module_bs4": ("beautifulsoup4", "pip install beautifulsoup4"),
        }
        fix_info = fix_map.get(error_type)
        if not fix_info:
            return None

        module, pip_cmd = fix_info
        if pip_cmd in content:
            return {"type": "yaml_fix", "file": file_name, "status": "already_fixed"}

        lines = content.split("\n")
        insert_at = None
        for i, line in enumerate(lines):
            s = line.strip()
            if s.startswith("run: python ") or s.startswith("run: python3 "):
                insert_at = i
                break

        if insert_at is None:
            return None

        indent = lines[insert_at][:len(lines[insert_at]) - len(lines[insert_at].lstrip())]
        parent_indent = indent[:4] if len(indent) >= 4 else "    "
        new_lines = [
            "",
            f"{parent_indent}- name: Install dependencies",
            f"{parent_indent}  run: pip install {module}",
        ]
        for nl in reversed(new_lines):
            lines.insert(insert_at, nl)

        new_content = base64.b64encode("\n".join(lines).encode("utf-8")).decode("utf-8")
        commit = requests.put(
            f"https://api.github.com/repos/{repo}/contents/.github/workflows/{file_name}",
            headers=headers,
            json={
                "message": f"auto-fix: add {pip_cmd} to {file_name}",
                "content": new_content,
                "sha": sha,
                "branch": "main",
            },
            timeout=15
        )

        if commit.status_code in (200, 201):
            print(f"[Healer] Auto-fix YAML: {file_name} - {pip_cmd}")
            return {"type": "yaml_fix", "file": file_name, "status": "success",
                    "detail": pip_cmd}
        print(f"[Healer] Falha no commit: {commit.status_code}")
        return None

    def _install_ffmpeg(self) -> dict:
        """Tenta instalar ffmpeg no sistema."""
        print("[Healer] Tentando instalar ffmpeg...")
        try:
            import platform
            system = platform.system().lower()
            if system == "linux":
                # Try sudo first, fallback without sudo (Docker/root)
                for prefix in [["sudo"], []]:
                    result = subprocess.run(
                        prefix + ["apt-get", "install", "-y", "-qq", "ffmpeg"],
                        capture_output=True, text=True, timeout=60
                    )
                    if result.returncode == 0:
                        break
                status = "success" if result.returncode == 0 else "failed"
                print(f"[Healer] ffmpeg install: {status}")
                return {"type": "install_ffmpeg", "status": status,
                "detail": result.stderr[:200] if status == "failed" else "ffmpeg instalado"}
            elif system == "darwin":
                result = subprocess.run(["brew", "install", "ffmpeg"],
                capture_output=True, text=True, timeout=120)
                status = "success" if result.returncode == 0 else "failed"
                return {"type": "install_ffmpeg", "status": status}
            else:
                return {"type": "install_ffmpeg", "status": "skipped",
                "detail": "SO nao suportado para instalacao automatica"}
        except Exception as e:
            return {"type": "install_ffmpeg", "status": "error", "detail": str(e)[:100]}

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
        """Envia SEMPRE para o admin PV (privado). Nunca para o canal publico."""
        return self.send_to_admin(text)

    def send_to_admin(self, text: str) -> bool:
        """Envia APENAS pro admin (PV), nunca pro canal."""
        token = self.vault.get("TELEGRAM_BOT_TOKEN")
        admin_id = self.vault.get("TELEGRAM_ADMIN_ID")
        if not token or not admin_id:
            print("[Reporter] Admin Telegram nao configurado")
            print(text[:500])
            return False
        try:
            resp = requests.post(
                f"https://api.telegram.org/bot{token}/sendMessage",
                json={"chat_id": admin_id, "text": text, "parse_mode": "HTML"},
                timeout=15
            )
            return resp.status_code == 200
        except Exception as e:
            print(f"[Reporter] Erro: {e}")
            return False
    
    def get_last_message(self) -> Optional[str]:
        """Busca as ultimas 10 mensagens e retorna a mais recente do admin."""
        token = self.vault.get("TELEGRAM_BOT_TOKEN")
        admin_id = self.vault.get("TELEGRAM_ADMIN_ID")
        if not token or not admin_id:
            return None
        
        try:
            resp = requests.get(
                f"https://api.telegram.org/bot{token}/getUpdates",
                timeout=10
            )
            if resp.status_code != 200:
                return None
            data = resp.json()
            if not data.get("ok") or not data.get("result"):
                return None
            
            # Percorre do fim pro inicio, pega a ultima msg de texto do admin
            for update in reversed(data["result"]):
                msg = update.get("message", {})
                if msg.get("chat", {}).get("id") == int(admin_id):
                    text = msg.get("text", "").strip().lower()
                    if text:
                        return text
        except Exception as e:
            print(f"[Reporter] Poll error: {e}")
        return None
    
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
# 5b. AUTO FIXER - Correcao automatica com reversao via Telegram
# ============================================================

FIX_HISTORY_FILE = PROJECT_DIR / "fix_history.json"

CONTEXTO_PATH = PROJECT_DIR / "scripts" / "CONTEXTO.md"

class AutoFixer:
    """IA com poder total: gera script Python de correcao, executa, commita.
    Le CONTEXTO.md pra ter contexto do projeto.
    Se mandar "reverte" no PV do Telegram, reverte o ultimo fix.
    """
    
    def __init__(self, vault, brain, reporter):
        self.vault = vault
        self.brain = brain
        self.reporter = reporter
        self.fix_history = []  # historico de fix para aprendizado
    
    def _load_context(self) -> str:
        """Le o CONTEXTO.md do repo."""
        try:
            if CONTEXTO_PATH.exists():
                with open(CONTEXTO_PATH, "r", encoding="utf-8") as f:
                    return f.read()
        except:
            pass
        return "Contexto nao disponivel."
    
    def _syntax_check(self) -> Optional[str]:
        """Roda python -m py_compile em scripts alterados.
        Retorna erro se houver, None se ok."""
        try:
            diff = subprocess.run(
                ["git", "dif", "--name-only"], cwd=PROJECT_DIR,
                capture_output=True, text=True, timeout=10
            )
            for f in diff.stdout.strip().split("\n"):
                f = f.strip()
                if f.endswith(".py"):
                    full = PROJECT_DIR / f
                    if full.exists():
                        r = subprocess.run(
                            ["python", "-m", "py_compile", str(full)],
                            capture_output=True, text=True, timeout=15
                        )
                        if r.returncode != 0:
                            return f"Syntax error em {f}: {r.stderr[:200]}"
        except:
            pass
        return None
    
    def auto_fix(self, source_key: str, error_log: str) -> bool:
        """Gera script de correcao via IA, executa, valida, commita.
        Se syntax check falhar, tenta de novo 1x."""
        source_type, source_name = source_key.split(":", 1) if ":" in source_key else ("unknown", source_key)
        
        for attempt in range(2):  # max 1 retry
            print(f"[AutoFix] IA gerando correcao para {source_name} (tentativa {attempt+1})...")
            script = self._generate_fix_script(source_name, error_log)
            if not script:
                return False
            
            script_path = str(PROJECT_DIR / "scripts" / ".fix_runner.py")
            try:
                with open(script_path, "w", encoding="utf-8") as f:
                    f.write(script)
            except Exception as e:
                print(f"[AutoFix] Erro salvando: {e}")
                return False
            
            print("[AutoFix] Executando script...")
            try:
                result = subprocess.run(
                    ["python", script_path],
                    cwd=PROJECT_DIR, capture_output=True, text=True, timeout=300
                )
                print(result.stdout[-500:] if result.stdout else "")
                if result.stderr:
                    print(f"[AutoFix] stderr: {result.stderr[-300:]}")
            except subprocess.TimeoutExpired:
                print("[AutoFix] Script excedeu 300s timeout")
                return False
            except Exception as e:
                print(f"[AutoFix] Erro exec: {e}")
                return False
            finally:
                if os.path.exists(script_path):
                    os.remove(script_path)
            
            if result.returncode != 0:
                print(f"[AutoFix] Script falhou (exit {result.returncode})")
                if attempt == 0:
                    error_log += f"\n\n[Fix attempt 1 failed: {result.stderr[:500]}]"
                    continue
                return False
            
            # Syntax check
            syntax_err = self._syntax_check()
            if syntax_err:
                print(f"[AutoFix] Syntax check falhou: {syntax_err}")
                if attempt == 0:
                    error_log += f"\n\n[Fix attempt 1 syntax error: {syntax_err}]"
                    # Reverte mudancas do script
                    subprocess.run(["git", "checkout", "--", "."],
                        cwd=PROJECT_DIR, capture_output=True, timeout=15)
                    continue
                return False
            
            # Smoke test apos syntax check
            smoke_err = self._smoke_test()
            if smoke_err:
                print(f"[AutoFix] Smoke test: {smoke_err}")
                if attempt == 0:
                    subprocess.run(["git", "checkout", "--", "."],
                        cwd=PROJECT_DIR, capture_output=True, timeout=15)
                    continue
                return False
            
            break  # sucesso, sai do loop
        
        # Verifica alteracoes
        diff = subprocess.run(
            ["git", "dif", "--stat"], cwd=PROJECT_DIR, capture_output=True, text=True, timeout=10
        )
        if not diff.stdout.strip():
            print("[AutoFix] Nenhuma alteracao detectada")
            return False
        
        commit_hash = self._git_commit(source_name)
        if not commit_hash:
            return False
        
        changes = diff.stdout.strip()
        
        # Verifica se CONTEXTO.md precisa ser atualizado
        struct = self._check_structural_changes()
        contexto_warn = ""
        if struct:
            contexto_warn = "\n\n⚠️ <b>CONTEXTO.md desatualizado!</b>\n" + "\n".join(struct)
            self.reporter.send_to_admin(
                "⚠️ <b>CONTEXTO.md precisa de update</b>\n"
                f"Fix em {source_name} fez mudancas estruturais:\n"
                + "\n".join(f"• {r}" for r in struct)
            )
        
        self._save_history({
            "timestamp": datetime.now().isoformat(),
            "bot": source_name,
            "commit": commit_hash,
            "changes": changes,
        })
        
        self.reporter.send_to_admin(
            f"🔧 <b>Auto-fix: {source_name}</b>\n"
            f"<code>{commit_hash[:12]}</code>\n"
            f"{changes}{contexto_warn}\n\n"
            "<i>Mande \"reverte\" no PV pra desfazer</i>"
        )
        return True
    
    def check_revert_command(self, current_errors: list = None) -> bool:
        """Verifica se admin pediu revert OU se erro persistiu. Reverte automaticamente."""
        # Auto-revert if same bot still failing
        if current_errors:
            history = self._load_history()
            if history:
                last_bot = history[-1].get("bot", "").replace("bot:", "").replace("script:", "")
                for err in current_errors:
                    source = err.get("source", "")
                    if last_bot and last_bot in source:
                        print(f"[AutoFix] {last_bot} ainda falhando! Auto-revertendo...")
                        commit = history[-1].get("commit", "")
                        if commit:
                            ok = self._git_revert(commit)
                            if ok:
                                history.pop()
                                self._save_history(history, overwrite=True)
                                self.reporter.send_to_admin(
                                    f"\U0001f519 <b>Auto-revert: {last_bot}</b>\n"
                                    f"Commit {commit[:12]} desfeito.\n"
                                    "Motivo: erro persistiu apos fix."
                                )
                                return True
        # Manual revert by admin
        msg = self.reporter.get_last_message()
        if not msg:
            return False
        
        keywords = ["reverte", "reverter", "desfazer", "volta", "revert"]
        if not any(k in msg for k in keywords):
            return False
        
        history = self._load_history()
        if not history:
            self.reporter.send_to_admin("⚠️ Nenhum fix anterior para reverter.")
            return False
        
        last = history[-1]
        commit = last.get("commit", "")
        if not commit:
            return False
        
        print(f"[AutoFix] Revertendo commit {commit[:12]}...")
        success = self._git_revert(commit)
        
        if success:
            history.pop()
            self._save_history(history, overwrite=True)
            self.reporter.send_to_admin(
                "↩️ <b>Revertido!</b>\n"
                f"Commit <code>{commit[:12]}</code> desfeito.\n"
                f"Bot: {last.get('bot', '?')}"
            )
        else:
            self.reporter.send_to_admin(
                f"❌ Falha ao reverter commit <code>{commit[:12]}</code>"
            )
        
        return success
    
    def _check_structural_changes(self) -> list:
        """Detecta mudancas estruturais que exigem update do CONTEXTO.md."""
        reasons = []
        try:
            diff = subprocess.run(
                ["git", "dif", "--name-status"], cwd=PROJECT_DIR,
                capture_output=True, text=True, timeout=10
            )
            for line in diff.stdout.strip().split("\n"):
                line = line.strip()
                if not line:
                    continue
                status, path = line.split(maxsplit=1)
                if status == "A":
                    if path.endswith(".yml"):
                        reasons.append(f"Novo workflow: {path}")
                    elif path.endswith(".py"):
                        reasons.append(f"Novo script: {path}")
                elif path == "scripts/CONTEXTO.md":
                    return []
        except:
            pass
        return reasons
    
    def _generate_fix_script(self, bot_name: str, error_log: str) -> Optional[str]:
        """IA gera script Python arbitratrio pra corrigir o erro."""
        contexto = self._load_context()
        patterns = "Nenhum fix anterior registrado."
        try:
            patterns_file = PROJECT_DIR / "scripts" / ".fix_patterns.json"
            if patterns_file.exists():
                with open(patterns_file, encoding="utf-8") as pf:
                    data = json.load(pf)
                if data:
                    patterns = "\n".join(f"- {p.get("module", "?")}: {p.get("fix", "")[:200]}" for p in data[-5:])
        except Exception:
            pass

        result = self.brain.think(
            system_prompt=f"""You are an AI with FULL filesystem access to the GeoLeads project.
Given an error log, generate a Python script that fixes the bug.

The script runs in the project root (CWD = /geoleads).
You can:
- Read/edit/create/delete ANY file (os, shutil, pathlib)
- Run shell commands (subprocess)
- Use requests, json, re, sys, etc.
- Print every action for logging
- Install packages with subprocess.run(["pip", "install", "pacote"])
- Do web searches with requests.get() if you need external info

Rules:
- MINIMAL changes. Fix ONLY what's broken.
- Print every file you modify.
- Handle errors with try/except.
- Use relative paths (scripts/..., .github/workflows/...)
- NEVER exfiltrate secrets, tokens, or keys.
- NEVER delete files unless it's the root cause.
- If no fix is possible, print "NO_FIX_NEEDED" and exit(0).

## ERROR TYPES & HOW TO FIX:

1. ModuleNotFoundError:
   -> Add pip install to the .github/workflows/<bot>.yml

2. Timeout / API Error:
   -> Add try/except with retry + time.sleep(random.uniform(1,3))

3. Empty content / No data:
   -> Check API response validity, add fallback template

4. ffmpeg not found:
   -> Install via subprocess: sudo apt-get install -y ffmpeg

5. Token expired / Auth error:
   -> Check env vars, add fallback to refresh token flow

6. SyntaxError:
   -> Fix the Python syntax directly in the file

## FIX PATTERNS FROM HISTORY:
{patterns}

## CONTEXTO DO PROJETO:
{contexto[:3000]}

Return ONLY the Python code in a ```python block. No explanation.""",
            user_prompt=f"## BOT: {bot_name}\n\n## ERROR LOG:\n{error_log[:3000]}"
        )
        
        if not result:
            return None
        
        code = re.search(r'```python\n(.*?)```', result, re.DOTALL)
        if code:
            return code.group(1).strip()
        
        # Fallback: se nao achou bloco, tenta extrair codigo
        code = re.search(r'```\n(.*?)```', result, re.DOTALL)
        if code:
            return code.group(1).strip()
        
        return None
    
    def _git_commit(self, bot_name: str) -> Optional[str]:
        try:
            subprocess.run(
                ["git", "config", "user.name", "AI Supervisor"],
                cwd=PROJECT_DIR, capture_output=True, timeout=15
            )
            subprocess.run(
                ["git", "config", "user.email", "ai-supervisor@geoleads"],
                cwd=PROJECT_DIR, capture_output=True, timeout=15
            )
            
            # Adiciona tudo que foi alterado
            subprocess.run(
                ["git", "add", "-A"],
                cwd=PROJECT_DIR, capture_output=True, timeout=15
            )
            
            result = subprocess.run(
                ["git", "commit", "-m", f"fix: {bot_name} - correcao automatica via IA"],
                cwd=PROJECT_DIR, capture_output=True, text=True, timeout=30
            )
            if result.returncode != 0:
                print(f"[AutoFix] Commit: {result.stderr[:200]}")
                return None
            
            push = subprocess.run(
                ["git", "push"], cwd=PROJECT_DIR, capture_output=True, text=True, timeout=60
            )
            if push.returncode != 0:
                print(f"[AutoFix] Push: {push.stderr[:200]}")
            
            log = subprocess.run(
                ["git", "log", "--oneline", "-1"], cwd=PROJECT_DIR,
                capture_output=True, text=True, timeout=10
            )
            return log.stdout.strip().split()[0] if log.returncode == 0 else "unknown"
        except Exception as e:
            print(f"[AutoFix] Git error: {e}")
            return None
    
    def _git_revert(self, commit: str) -> bool:
        try:
            r = subprocess.run(
                ["git", "revert", "--no-edit", commit],
                cwd=PROJECT_DIR, capture_output=True, text=True, timeout=30
            )
            if r.returncode != 0:
                print(f"[AutoFix] Revert: {r.stderr[:200]}")
                return False
            r = subprocess.run(
                ["git", "push"], cwd=PROJECT_DIR, capture_output=True, text=True, timeout=60
            )
            return r.returncode == 0
        except Exception as e:
            print(f"[AutoFix] Revert error: {e}")
            return False
    
    def _smoke_test(self) -> str:
        """Smoke test: verifica se imports locais existem apos alteracoes."""
        try:
            diff = subprocess.run(
                ["git", "diff", "--name-only"], cwd=PROJECT_DIR,
                capture_output=True, text=True, timeout=10
            )
            for fname in diff.stdout.strip().split("\n"):
                fname = fname.strip()
                if fname.endswith(".py") and os.path.exists(os.path.join(PROJECT_DIR, fname)):
                    with open(os.path.join(PROJECT_DIR, fname), "r", encoding="utf-8") as sf:
                        source = sf.read()
                    local_imports = re.findall(r"from scripts\.(\w+) import", source)
                    for imp in local_imports:
                        imp_path = os.path.join(PROJECT_DIR, "scripts", f"{imp}.py")
                        if not os.path.exists(imp_path):
                            return f"Import {imp} not found (in {fname})"
            # Syntax check em todos os scripts/ para prevenir regressoes
            regression_err = self._syntax_check_all()
            if regression_err:
                return regression_err
        except Exception as e:
            return f"Smoke test error: {e}"
        return ""
    
    def _syntax_check_all(self) -> Optional[str]:
        """Syntax check em TODOS os scripts/. Previne regressoes."""
        scripts_dir = PROJECT_DIR / "scripts"
        if not scripts_dir.exists():
            return None
        for fname in sorted(scripts_dir.glob("*.py")):
            r = subprocess.run(
                ["python", "-m", "py_compile", str(fname)],
                capture_output=True, text=True, timeout=15
            )
            if r.returncode != 0:
                err = r.stderr[:300]
                return f"Regression syntax error em {fname.name}: {err}"
        return None
    
    def _learn_from_fix(self, error_log: str, fix_script: str, success: bool):
        """Salva padrao de erro + solucao pra aprendizado futuro."""
        if not success:
            return
        try:
            patterns_file = PROJECT_DIR / "scripts" / ".fix_patterns.json"
            patterns = []
            if patterns_file.exists():
                with open(patterns_file) as f:
                    patterns = json.load(f)
            mod_match = re.search(r"ModuleNotFoundError: No module named '([^']+)'", error_log)
            if mod_match:
                module = mod_match.group(1)
                existing = [p for p in patterns if p.get("module") == module]
                if not existing:
                    patterns.append({
                        "module": module,
                        "fix": fix_script[:500],
                        "times_fixed": 1,
                        "last_fixed": datetime.now().isoformat(),
                    })
                    with open(patterns_file, "w") as f:
                        json.dump(patterns, f, indent=2)
        except Exception:
            pass
    
    def _save_history(self, entry_or_list, overwrite=False):
        data = entry_or_list if overwrite else (self._load_history() + [entry_or_list])
        try:
            with open(FIX_HISTORY_FILE, "w") as f:
                json.dump(data, f, indent=2)
        except Exception:
            pass
    
    def _load_history(self) -> list:
        try:
            if FIX_HISTORY_FILE.exists():
                with open(FIX_HISTORY_FILE) as f:
                    return json.load(f)
        except:
            pass
        return []


# ============================================================
# 6. SUPERVISOR - Orquestrador principal
# ============================================================

def _detect_mode() -> str:
    """Auto-detecta modo baseado no horario UTC.
    Deep: 11h e 23h UTC (8h e 20h BRT).
    Fast: qualquer outro horario.
    Pode ser sobreposto pela env var SUPERVISOR_MODE.
    """
    env_mode = os.environ.get("SUPERVISOR_MODE", "").lower()
    if env_mode in ("fast", "deep"):
        return env_mode
    hour = datetime.now(timezone.utc).hour
    return "deep" if hour in (11, 23) else "fast"

SUPERVISOR_MODE = _detect_mode()

class AISupervisor:
    """Orquestrador: scan -> diagnostico -> cura -> report.
    
    Dois modos:
      - fast: sem IA, roda scan + auto-fix basico (YAML), reporta.
      - deep (padrao): com IA, diagnostico completo em loop.
    """
    
    def __init__(self):
        self.vault = CredentialVault()
        self.brain = AIBrain()
        self.scanner = Scanner()
        self.healer = Healer()
        self.reporter = Reporter()
        self.fixer = AutoFixer(self.vault, self.brain, self.reporter)
        self.cycle_count = 0
        self.all_fixes = []
        self.mode = SUPERVISOR_MODE
        
        print(f"\n{'#'*60}")
        print("#  AI SYSTEM SUPERVISOR")
        print(f"#  {datetime.now().strftime('%d/%m/%Y %H:%M')}")
        print(f"#  Workspace: {PROJECT_DIR}")
        print(f"#  Modo: {self.mode.upper()}")
        if self.mode == "deep":
            print(f"#  Ciclos: {MAX_CYCLES}")
        print(f"{'#'*60}\n")
    
    def run_cycle(self, use_ai=True) -> dict:
        """Um ciclo: scan -> diagnostico -> cura -> report."""
        self.cycle_count += 1
        mode_label = "DEEP" if use_ai else "FAST"
        print(f"\n{'='*50}")
        print(f"  CICLO {self.cycle_count} [{mode_label}]")
        print(f"{'='*50}\n")
        
        # 1. SCAN
        scan = self.scanner.scan_all()
        
        # 2. DIAGNOSTICO
        diagnostics = []
        for bot in scan.get("bots", []):
            if bot.get("status") != "failed":
                continue

            logs = bot.get("logs", "")
            
            # Auto-fix SEM IA: ModuleNotFoundError + erros comuns
            auto_fix_patterns = [
                ("ModuleNotFoundError: No module named 'requests'", "no_module_requests"),
                ("ModuleNotFoundError: No module named 'google'", "no_module_google"),
                ("ModuleNotFoundError: No module named 'PIL'", "no_module_pillow"),
                ("ModuleNotFoundError: No module named 'yt_dlp'", "no_module_ytdlp"),
                ("ModuleNotFoundError: No module named 'beautifulsoup4'", "no_module_bs4"),
                ("ModuleNotFoundError: No module named 'bs4'", "no_module_bs4"),
                ("ModuleNotFoundError: No module named 'requests'", "no_module_requests"),
            ]
            for error_pattern, fix_key in auto_fix_patterns:
                if error_pattern in logs:
                    wf_file = bot["name"] + (".yml" if ".yml" not in bot["name"] else "")
                    fix = self.healer._fix_workflow_yaml(wf_file, fix_key)
                    if fix:
                        print(f"[Supervisor] Auto-fix aplicado em {wf_file}!")
                        self.reporter.send(
                            f"🔧 <b>Auto-fix: {bot['name']}</b>\n",
                            f"Corrigido: {error_pattern}\n",
                            "Commit automatico enviado."
                        )
            # Diagnostico COM IA (apenas modo deep)
            if use_ai and logs:
                print(f"[Supervisor] Diagnosticando falha em {bot['name']}...")
                diag = self.brain.analyze_logs(logs)
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
        
        # 3. AUTO-FIX VIA IA (apenas modo deep)
        auto_fixes = []
        if use_ai:
            for diag in diagnostics:
                # Auto-fix mais agressivo: severidade >= 2
                # Se IA disse que nao e auto-fixavel, tenta patterns conhecidos
                is_auto_fixable = diag.get("auto_fixable", False)
                if not is_auto_fixable:
                    err_type = diag.get("error_type", "")
                    source = diag.get("source", "")
                    # Erros conhecidos que podem ser auto-corrigidos
                    if err_type in ("timeout", "rate_limit", "empty_content", "api_error"):
                        print(f"[Supervisor] Auto-fix forcado para {err_type} em {source}")
                        is_auto_fixable = True
                if is_auto_fixable and diag.get("severity", 0) >= 2:
                    source = diag.get("source", "")
                    logs = ""
                    # Busca logs do bot correspondente
                    for bot in scan.get("bots", []):
                        if f"bot:{bot['name']}" == source:
                            logs = bot.get("logs", "")
                            break
                    if logs:
                        ok = self.fixer.auto_fix(source, logs)
                        auto_fixes.append({"bot": source, "applied": ok})
        
        # 4. VERIFICA COMANDO DE REVERT + AUTO-REVERT (sempre, em ambos modos)
        # Se algum bot ainda falhar apos fix, reverte automaticamente
        self.fixer.check_revert_command(diagnostics)
        
        # 4b. APRENDE COM FIX BEM SUCEDIDO (so depois de confirmar que nao foi revertido)
        for fix in auto_fixes:
            if fix.get("applied"):
                self.fixer.fix_history.append(fix)
                # Registra padrao de aprendizado se disponivel
                if "logs" in fix and "script" in fix:
                    self.fixer._learn_from_fix(fix.get("logs", ""), fix.get("script", ""), True)
        
        # 5. CURA (Healer)
        fixes = self.healer.heal(diagnostics)
        self.all_fixes.extend(fixes)
        self.all_fixes.extend(auto_fixes)
        
        # 6. REPORT
        report = self._build_report(scan, diagnostics, fixes, use_ai)
        self.reporter.send(report)
        print(f"[Supervisor] Ciclo {self.cycle_count} completo!")
        return {"scan": scan, "diagnostics": diagnostics, "fixes": fixes}
    
    def _build_report(self, scan, diagnostics, fixes, use_ai):
        bots = scan.get("bots", [])
        ok = sum(1 for b in bots if b.get("status") == "success")
        fail = sum(1 for b in bots if b.get("status") == "failed")
        apis = scan.get("apis", [])
        api_ok = sum(1 for a in apis if a.get("status") == "ok")
        api_err = sum(1 for a in apis if a.get("status") == "error")
        scripts = scan.get("scripts", [])
        s_ok = sum(1 for s in scripts if s.get("status") == "ok")
        s_err = sum(1 for s in scripts if s.get("status") != "ok")
        fe = scan.get("frontend", {})
        
        lines = [
            f"<b>{'🤖 AI' if use_ai else '⚡'} Supervisor - {self.mode.upper()}</b>",
            f"<code>{datetime.now().strftime('%d/%m/%Y %H:%M')}</code>",
            "",
            f"<b>Bots:</b> {ok} ok, {fail} falha(s)",
            f"<b>APIs:</b> {api_ok} ok, {api_err} erro(s)",
            f"<b>Scripts:</b> {s_ok} ok, {s_err} problema(s)",
            f"<b>Frontend:</b> {fe.get('status', '?')}",
        ]
        if fixes:
            lines.append(f"\n<b>Correcoes:</b> {len(fixes)}")
            for f in fixes:
                lines.append(f"  [{f.get('status','?')}] {f.get('type','?')}")
        critical = [d for d in diagnostics if d.get("severity", 0) >= 4]
        if critical:
            lines.append(f"\n<b>Criticos:</b> {len(critical)}")
            for c in critical[:3]:
                lines.append(f"  {c.get('root_cause', '?')[:80]}")
        if fail and not diagnostics and not fixes:
            lines.append(f"\n❌ {fail} bots com falha - sem auto-fix disponivel")
        lines.append(f"\n{ok}/{len(bots)} bots OK")
        return "\n".join(lines)
    
    def run_fast(self):
        """Modo rapido: 1 ciclo sem IA, usado a cada 15min pelo cron."""
        print("[Supervisor] MODO RAPIDO - scan + auto-fix basico")
        self.run_cycle(use_ai=False)
        print("[Supervisor] Modo rapido concluido!")
    
    def run_deep(self):
        """Modo profundo: loop com IA, usado 2x/dia."""
        print("[Supervisor] MODO PROFUNDO - diagnostico com IA")
        
        missing = self.vault.list_missing()
        if missing:
            msg = f"<b>AI Supervisor iniciado</b>\n<code>{datetime.now().strftime('%d/%m/%Y %H:%M')}</code>\n\n<b>Credenciais faltando:</b>\n" + "\n".join(f"  - {m}" for m in missing)
        else:
            msg = f"<b>AI Supervisor iniciado</b>\n<code>{datetime.now().strftime('%d/%m/%Y %H:%M')}</code>\n\nModo: DEEP\nCiclos: {MAX_CYCLES}\nMonitorando: bots, APIs, scripts, frontend, credenciais"
        self.reporter.send(msg)
        
        for _ in range(MAX_CYCLES):
            try:
                self.run_cycle(use_ai=True)
                if self.cycle_count < MAX_CYCLES:
                    print(f"[Supervisor] Dormindo {CYCLE_SLEEP_MINUTES}min...")
                    for _ in range(CYCLE_SLEEP_MINUTES * 2):
                        time.sleep(30)
            except Exception as e:
                print(f"[Supervisor] Erro no ciclo: {e}")
                self.reporter.send(f"<b>Erro no ciclo {self.cycle_count}:</b> {str(e)[:200]}")
                time.sleep(60)
        
        summary = (
            "<b>AI Supervisor finalizado</b>\n"
            f"<code>{datetime.now().strftime('%d/%m/%Y %H:%M')}</code>\n\n"
            f"Ciclos: {self.cycle_count}\n"
            f"Correcoes: {len(self.all_fixes)}\n"
            "Proximo: amanha as 08h/20h BRT"
        )
        self.reporter.send(summary)
        print(f"\nResumo: {self.cycle_count} ciclos, {len(self.all_fixes)} correcoes")
    
    def run(self):
        """Roteia pro modo certo baseado na env var SUPERVISOR_MODE."""
        if self.mode == "fast":
            self.run_fast()
        else:
            self.run_deep()


# ============================================================
# MAIN
# ============================================================

    def self_improve(self):
        """Ciclo de auto-aprimoramento: escaneia, diagnostica, corrige e evolui.
        Roda 12:00 BRT (15:00 UTC) todos os dias via workflow.
        Inclui auto_lead_pipeline.py e scraping_worker.py no scan.
        Verifica workflows YAML, secrets faltando, usa IA para melhorias."""
        print("[Supervisor] === AUTO-APRIMORAMENTO 12:00 BRT ===")
        results = {"scripts_checked": 0, "issues_found": 0, "fixes_applied": 0, "learnings": [],
                    "workflows_checked": 0, "secrets_missing": []}
        
        scripts_dir = PROJECT_DIR / "scripts"
        if not scripts_dir.exists():
            print("[Supervisor] Nenhum script encontrado")
            return results
        
        # 1. Escaneia TODOS os scripts .py (incluindo auto_lead_pipeline + scraping_worker)
        py_files = sorted(scripts_dir.glob("*.py"))
        results["scripts_checked"] = len(py_files)
        print(f"[Supervisor] Escaneando {len(py_files)} scripts...")
        
        for py_file in py_files:
            fname = py_file.name
            
            # 2. Syntax check
            r = subprocess.run(
                ["python", "-m", "py_compile", str(py_file)],
                capture_output=True, text=True, timeout=15
            )
            if r.returncode != 0:
                err = r.stderr[:300]
                print(f"[Supervisor] Syntax error em {fname}: {err[:100]}")
                results["issues_found"] += 1
                result = self.fixer.auto_fix(f"script:{fname}", err)
                if result:
                    results["fixes_applied"] += 1
                    results["learnings"].append(f"Syntax fixed: {fname}")
                continue
            
            # 3. Lint check + code quality
            try:
                with open(py_file, "r", encoding="utf-8") as f:
                    source = f.read()
                
                # 3a. Corrige bare except:
                bare_excepts = source.count("\n    except:\n") + source.count("\n        except:\n")
                if bare_excepts > 0:
                    print(f"[Supervisor] {fname}: {bare_excepts}x bare except")
                    results["issues_found"] += 1
                    fixed = source.replace("\n        except:\n", "\n        except Exception:\n")
                    fixed = fixed.replace("\n    except:\n", "\n    except Exception:\n")
                    if fixed != source:
                        with open(py_file, "w", encoding="utf-8") as f:
                            f.write(fixed)
                        results["fixes_applied"] += 1
                        results["learnings"].append(f"Fixed bare except in {fname}")
                
                # 3b. Verifica imports quebrados
                local_imports = re.findall(r"from scripts\.(\w+) import", source)
                for imp in local_imports:
                    imp_path = scripts_dir / f"{imp}.py"
                    if not imp_path.exists():
                        results["issues_found"] += 1
                        results["learnings"].append(f"Broken import: {imp} in {fname}")
                
            except Exception:
                pass
        
        # 4. Verifica YAML dos workflows
        workflows_dir = PROJECT_DIR / ".github" / "workflows"
        if workflows_dir.exists():
            yml_files = sorted(workflows_dir.glob("*.yml"))
            results["workflows_checked"] = len(yml_files)
            for yml_file in yml_files:
                with open(yml_file, "r", encoding="utf-8") as f:
                    yml_content = f.read()
                issues = []
                if "name:" not in yml_content:
                    issues.append("sem name")
                if "jobs:" not in yml_content:
                    issues.append("sem jobs")
                if "on:" not in yml_content:
                    issues.append("sem trigger")
                if "runs-on:" not in yml_content:
                    issues.append("sem runs-on")
                if issues:
                    results["issues_found"] += 1
                    results["learnings"].append(f"Workflow {yml_file.name}: {', '.join(issues)}")
                    print(f"[Supervisor] Workflow {yml_file.name} issues: {issues}")
        
        # 5. Verifica secrets faltando (vs .env.example)
        env_example = PROJECT_DIR / ".env.example"
        if env_example.exists():
            with open(env_example, "r", encoding="utf-8") as f:
                env_content = f.read()
            # Extrai nomes das variaveis
            env_vars = re.findall(r"^([A-Z_]+)=", env_content, re.MULTILINE)
            missing = []
            for var in env_vars:
                if var in ("", "SEU_", "seu_"):
                    continue
                # Checa se existe no ambiente OU no Vault
                if not os.environ.get(var) and not self.vault.has(var):
                    missing.append(var)
            if missing:
                results["secrets_missing"] = missing
                results["learnings"].append(f"Secrets faltando: {len(missing)}")
                print(f"[Supervisor] {len(missing)} secrets faltando: {missing[:5]}...")
        
        # 6. IA suggestions para melhoria de codigo (a cada 7 dias)
        lessons_file = PROJECT_DIR / "scripts" / ".self_improve_log.json"
        should_use_ai = True
        if lessons_file.exists():
            try:
                with open(lessons_file) as f:
                    lessons = json.load(f)
                if lessons:
                    last_ai = lessons[-1].get("results", {}).get("ai_suggestions", False)
                    should_use_ai = not last_ai
            except:
                pass
        
        if should_use_ai and self.brain:
            try:
                ai_prompt = f"""Analise estes scripts Python e sugira MELHORIAS de codigo.
Scripts encontrados: {len(py_files)}
Issues encontradas: {results['issues_found']}
Fixes aplicados: {results['fixes_applied']}

Sugira apenas melhorias especificas com:
1. Arquivo
2. Linha aproximada
3. O que mudar
4. Por que

Mantenha simples e pratico. No maximo 3 sugestoes."""
                suggestion = self.brain.think(
                    system_prompt="Voce e um code reviewer senior. Sugira melhorias especificas e acionaveis.",
                    user_prompt=ai_prompt,
                    max_tokens=1000
                )
                if suggestion and len(suggestion) > 50:
                    results["learnings"].append(f"IA suggestion: {suggestion[:200]}...")
                    results["ai_suggestions"] = True
                    print(f"[Supervisor] IA suggestion received ({len(suggestion)} chars)")
            except Exception:
                results["ai_suggestions"] = False
        
        # 7. Salva aprendizado
        try:
            lessons = []
            if lessons_file.exists():
                with open(lessons_file) as f:
                    lessons = json.load(f)
            lessons.append({
                "date": datetime.now().isoformat(),
                "results": results,
            })
            if len(lessons) > 30:
                lessons = lessons[-30:]
            with open(lessons_file, "w") as f:
                json.dump(lessons, f, indent=2)
        except Exception:
            pass
        
        # 8. Report via Telegram
        msg = (
            f"\\U0001f9e0 <b>Auto-Aprimoramento 12:00 BRT</b>\\n"
            f"Scripts: {results['scripts_checked']}\\n"
            f"Workflows: {results['workflows_checked']}\\n"
            f"Issues: {results['issues_found']}\\n"
            f"Fixes: {results['fixes_applied']}\\n"
        )
        if results.get("secrets_missing"):
            msg += f"Secrets faltando: {len(results['secrets_missing'])}\\n"
        if results["learnings"]:
            msg += "\\n<b>Correcoes:</b>\\n" + "\\n".join(f"\\u2022 {l}" for l in results["learnings"][-5:])
        try:
            self.reporter.send_to_admin(msg)
        except Exception:
            pass
        
        print(f"[Supervisor] Auto-aprimoramento concluido: {results}")
        return results

if __name__ == "__main__":
    supervisor = AISupervisor()
    if len(sys.argv) > 1 and sys.argv[1] == "--self-improve":
        print("[Supervisor] === INICIANDO AUTO-APRIMORAMENTO 12:00 ===")
        result = supervisor.self_improve()
        print(f"[Supervisor] Resultado: {result}")
        sys.exit(0)
    supervisor.run()
