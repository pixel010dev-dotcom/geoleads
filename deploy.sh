#!/bin/bash
# =============================================================================
# GeoLeads - Deploy Automation Script
# =============================================================================
# Uso: bash deploy.sh [--skip-build] [--skip-cf]
#
# Flags:
#   --skip-build   Pula o build local antes do deploy
#   --skip-cf      Pula o deploy do Cloudflare Worker
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║           🚀 GeoLeads - Deploy Automático           ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""

SKIP_BUILD=false
SKIP_CF=false

for arg in "$@"; do
  case $arg in
    --skip-build) SKIP_BUILD=true ;;
    --skip-cf) SKIP_CF=true ;;
  esac
done

# ── 1. Build local ────────────────────────────────────────────────────────
if [ "$SKIP_BUILD" = false ]; then
  echo "🔨 Buildando o dashboard..."
  cd dashboard
  npm run build
  cd ..
  echo "✅ Build concluído!"
else
  echo "⏩ Build pulado (--skip-build)"
fi
echo ""

# ── 2. Git commit + push ─────────────────────────────────────────────────
echo "📦 Commitando e subindo para o GitHub..."
git add -A

# Gera mensagem de commit com data e escopo
BRANCH=$(git rev-parse --abbrev-ref HEAD)
COMMIT_MSG="deploy: $(date +'%Y-%m-%d %H:%M') - $(git diff --cached --stat --name-only | head -5 | tr '\n' ' ')"

if git diff --cached --quiet; then
  echo "⚠️  Nada a commitar (working tree limpo). Pulando..."
else
  git commit -m "$COMMIT_MSG"
  git push origin "$BRANCH"
  echo "✅ Código enviado para GitHub!"
fi
echo ""

# ── 3. Railway Deploy ────────────────────────────────────────────────────
echo "🚂 Fazendo deploy no Railway..."
railway up --detach
echo "✅ Deploy Railway enviado! Acompanhe em:"
echo "   https://railway.com/project/daa0713e-b687-49a8-a4f3-104fa143192b"
echo ""

# ── 4. Cloudflare Worker ─────────────────────────────────────────────────
if [ "$SKIP_CF" = false ]; then
  if command -v npx &> /dev/null && npx wrangler --version &> /dev/null; then
    echo "☁️  Deployando Cloudflare Worker..."
    cd "$SCRIPT_DIR"
    npx wrangler deploy cloudflare-worker.js --name geoleads-proxy 2>&1 || echo "⚠️  Wrangler deploy falhou - faça manualmente pela dashboard"
    echo "✅ Cloudflare Worker atualizado!"
  else
    echo "⏩ Wrangler não encontrado, pulando Cloudflare..."
  fi
else
  echo "⏩ Cloudflare pulado (--skip-cf)"
fi

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║           ✅ Deploy concluído com sucesso!          ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""
echo "📋 Acompanhe:"
echo "   Dashboard: https://geoleads-production.up.railway.app"
echo "   Railway:   https://railway.com/project/daa0713e-b687-49a8-a4f3-104fa143192b"
echo "   GitHub:    https://github.com/pixel010dev-dotcom/geoleads"
echo ""
