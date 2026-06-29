#!/bin/bash
set -e

cd "$(dirname "$0")"

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║    ☁️  GeoLeads - Deploy Oracle Cloud               ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""

# ── 1. Git pull ────────────────────────────────────────────────────────
echo "=== Pull do Git ==="
git pull origin main
echo ""

# ── 2. Build Docker ────────────────────────────────────────────────────
echo "=== Build Docker ==="
docker build -t geoleads:latest -f dashboard/Dockerfile dashboard/
echo ""

# ── 3. Parar container antigo ──────────────────────────────────────────
echo "=== Parar container antigo ==="
docker stop geoleads 2>/dev/null || true
docker rm geoleads 2>/dev/null || true
echo ""

# ── 4. Rodar novo container ────────────────────────────────────────────
echo "=== Rodar container ==="
docker run -d \
  --name geoleads \
  --restart always \
  -p 3000:3000 \
  --env-file .env.production \
  --shm-size=2gb \
  geoleads:latest
echo ""

# ── 5. Verificar ───────────────────────────────────────────────────────
echo "=== Container rodando ==="
docker ps --filter name=geoleads --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
echo ""

# ── 6. Health check ────────────────────────────────────────────────────
echo "=== Health Check ==="
sleep 3
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/ || echo "000")
if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "301" ] || [ "$HTTP_CODE" = "302" ]; then
  echo "✅ App respondendo com HTTP $HTTP_CODE"
else
  echo "⚠️  Health check retornou HTTP $HTTP_CODE - verificar logs: docker logs geoleads"
fi
echo ""

echo "╔══════════════════════════════════════════════════════╗"
echo "║         ✅ Deploy Oracle concluído!                 ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""
echo "📋 Acompanhe:"
echo "   Logs:    docker logs -f geoleads"
echo "   App:     http://localhost:3000"
echo "   IP ext:  curl -s http://$(curl -s ifconfig.me):3000"
