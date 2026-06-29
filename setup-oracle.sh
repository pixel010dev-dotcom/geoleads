#!/bin/bash
# =============================================================================
# 🚀 GeoLeads - Setup Oracle Cloud (FAZ-TUDO)
# =============================================================================
# Uso: ssh ubuntu@<IP> "bash -s" < setup-oracle.sh
# Ou: curl -sL https://raw.githubusercontent.com/pixel010dev-dotcom/geoleads/main/setup-oracle.sh | bash
# =============================================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log() { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
err() { echo -e "${RED}[✗]${NC} $1"; }
info() { echo -e "${CYAN}[i]${NC} $1"; }
sep() { echo "────────────────────────────────────────"; }

clear
echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║     🚀 GEQLEADS - SETUP ORACLE CLOUD FAZ-TUDO      ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""

# ─── 1. INSTALAR DEPENDÊNCIAS ────────────────────────────────────────────
sep
info "Passo 1/8 — Instalando dependências do sistema..."
sep

sudo apt update -qq && sudo apt upgrade -y -qq
sudo apt install -y -qq curl git nginx certbot python3-certbot-nginx
log "Dependências instaladas (Git, Nginx, Certbot)"

# ─── 2. INSTALAR DOCKER ──────────────────────────────────────────────────
sep
info "Passo 2/8 — Instalando Docker..."
sep

if command -v docker &> /dev/null; then
    log "Docker já instalado: $(docker --version)"
else
    curl -fsSL https://get.docker.com | sudo bash
    log "Docker instalado"
fi

sudo usermod -aG docker $USER
log "Usuário adicionado ao grupo docker"

# ─── 3. CLONAR REPO ──────────────────────────────────────────────────────
sep
info "Passo 3/8 — Clonando repositório..."
sep

if [ -d "/home/ubuntu/geoleads/.git" ]; then
    log "Repositório já existe, fazendo pull"
    cd /home/ubuntu/geoleads && git pull
else
    sudo mkdir -p /home/ubuntu/geoleads
    sudo chown ubuntu:ubuntu /home/ubuntu/geoleads
    git clone https://github.com/pixel010dev-dotcom/geoleads.git /home/ubuntu/geoleads
    log "Repositório clonado"
fi
cd /home/ubuntu/geoleads

# ─── 4. CONFIGURAR ENV ───────────────────────────────────────────────────
sep
info "Passo 4/8 — Configurando variáveis de ambiente..."
sep

# Detectar IP público
IP_PUBLICO=$(curl -s ifconfig.me || curl -s icanhazip.com || echo "")
if [ -z "$IP_PUBLICO" ]; then
    warn "Não consegui detectar o IP automaticamente"
    read -p "Digite o IP público da VM: " IP_PUBLICO
fi

echo ""
info "IP detectado: $IP_PUBLICO"
read -p "Tem domínio próprio? (ex: geoleads.com.br) [Enter = só IP]: " DOMAIN

if [ -n "$DOMAIN" ]; then
    APP_URL="https://$DOMAIN"
    log "Usando domínio: $APP_URL"
else
    APP_URL="http://$IP_PUBLICO:3000"
    warn "Usando IP direto (sem SSL): $APP_URL"
fi

cat > /home/ubuntu/geoleads/.env.production << EOF
NODE_ENV=production
HOSTNAME=0.0.0.0
PORT=3000
NEXT_TELEMETRY_DISABLED=1
NEXT_PUBLIC_SUPABASE_URL=https://mwnpwrzwgwrqqlomqhux.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im13bnB3cnp3Z3dycXFsb21xaHV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyMzg4MjQsImV4cCI6MjA5NDgxNDgyNH0.2gQPLPtkHXCItXSO3HEx_SfGckYZZNCC2Xv6vY93vmQ
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im13bnB3cnp3Z3dycXFsb21xaHV4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTIzODgyNCwiZXhwIjoyMDk0ODE0ODI0fQ.YVZQ3cPMJaPjBnggkEV4SxNeh4Y-PVisP2ST5YF0rl8
NEXT_PUBLIC_APP_URL=$APP_URL
CRON_SECRET=xyPinHgjVIzrBhbHktRlZZjGb07e858WAzlq5cNpHfk=
GEMINI_API_KEY=AIzaSyAV5qEALNBQwk-kxvdHwzjpgSaBdNeUOrY
GEMINI_MODEL=gemini-1.5-flash
GROQ_API_KEY=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
OPENROUTER_API_KEY=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
OPENROUTER_MODEL=openrouter/free
CF_WORKER_URL=https://geoleads-proxy.pixel010dev.workers.dev
MERCADO_PAGO_ACCESS_TOKEN=APP_USR-8143486344050111-051921-871e59c3c38b0995f166650ee1635168-1176662512
MERCADO_PAGO_WEBHOOK_SECRET=TAR7kVWz8wde2hlCaKYfgUO3N6JySGom
AUTOVENDAS_WEBHOOK_SECRET=s20E7RAk0YyQollS76vKGew8c5eJGaYllgb-IQbSaaY
AUTOVENDAS_PRICE_PER_LEAD=0.5
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=pixel010dev@gmail.com
SMTP_PASS=04092008we
ADMIN_EMAIL=pixel010dev@gmail.com
NOTIFICATION_EMAIL=pixel010dev@gmail.com
TELEGRAM_BOT_TOKEN=8755188266:AAE0U4gaMc7dKByW_wFeoOEvpm00_E-va-w
TELEGRAM_CHANNEL_ID=-1003870508744
TELEGRAM_ADMIN_ID=8955181160
TWITTER_CONSUMER_KEY=eIIi6k49yYpQcbWqF13MgawNu
TWITTER_CONSUMER_SECRET=pUytfl8qadCkpAJePeu9EyjkDNziF5020raQW2pErsDvu3qTaF
TWITTER_ACCESS_TOKEN=2070705954203504640-LBSYSGqbx0ini7jfR9gtpyNdftKOtF
TWITTER_ACCESS_SECRET=yNqeZRPBIXMshYu2wkY8ZQ6MY5v1EuRDPLU1X8p7Xx2Db
NOCACHE=30523
TOR_ENABLED=true
EOF
log "Arquivo .env.production criado"

# ─── 5. BUILD + DEPLOY DOCKER ────────────────────────────────────────────
sep
info "Passo 5/8 — Buildando e subindo Docker..."
sep

docker build -t geoleads:latest -f dashboard/Dockerfile dashboard/
docker stop geoleads 2>/dev/null || true
docker rm geoleads 2>/dev/null || true
docker run -d \
    --name geoleads \
    --restart always \
    -p 3000:3000 \
    --env-file .env.production \
    --shm-size=2gb \
    geoleads:latest
log "Container rodando!"

# Health check
sleep 5
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/ || echo "000")
if [ "$HTTP_CODE" != "000" ]; then
    log "App respondendo na porta 3000 (HTTP $HTTP_CODE)"
else
    warn "Health check falhou, verificar: docker logs geoleads"
fi

# ─── 6. CONFIGURAR NGINX (se tiver domínio) ──────────────────────────────
sep
info "Passo 6/8 — Configurando Nginx..."
sep

if [ -n "$DOMAIN" ]; then
    sudo tee /etc/nginx/sites-available/geoleads << NGINX
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 300;
        proxy_connect_timeout 300;
    }
}
NGINX

    sudo ln -sf /etc/nginx/sites-available/geoleads /etc/nginx/sites-enabled/
    sudo rm -f /etc/nginx/sites-enabled/default
    sudo nginx -t && sudo systemctl restart nginx
    log "Nginx configurado pra $DOMAIN"
else
    # Só proxy reverso básico pro IP
    sudo tee /etc/nginx/sites-available/geoleads << NGINX
server {
    listen 80;
    server_name $IP_PUBLICO;
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 300;
        proxy_connect_timeout 300;
    }
}
NGINX

    sudo ln -sf /etc/nginx/sites-available/geoleads /etc/nginx/sites-enabled/
    sudo rm -f /etc/nginx/sites-enabled/default
    sudo nginx -t && sudo systemctl restart nginx
    log "Nginx configurado pra IP direto"
fi

# ─── 7. SSL (Let's Encrypt) ──────────────────────────────────────────────
sep
info "Passo 7/8 — SSL (opcional)..."
sep

if [ -n "$DOMAIN" ]; then
    echo ""
    warn "Antes do SSL, seu domínio precisa apontar pra este IP: $IP_PUBLICO"
    warn "Vá no Registro.br e crie um A record: @ -> $IP_PUBLICO e www -> $IP_PUBLICO"
    echo ""
    read -p "Já apontou o DNS? (s/N): " DNS_OK
    if [ "$DNS_OK" = "s" ] || [ "$DNS_OK" = "S" ]; then
        sudo certbot --nginx -d "$DOMAIN" -d "www.$DOMAIN" --non-interactive --agree-tos --email pixel010dev@gmail.com || \
        warn "SSL falhou, roda manual: sudo certbot --nginx -d $DOMAIN -d www.$DOMAIN"
        log "SSL ativado!"
        
        # Atualizar APP_URL pro HTTPS
        sed -i "s|NEXT_PUBLIC_APP_URL=http://.*|NEXT_PUBLIC_APP_URL=https://$DOMAIN|" /home/ubuntu/geoleads/.env.production
        docker restart geoleads
        log "APP_URL atualizada pra HTTPS"
    else
        warn "Pula SSL por enquanto. Roda depois: sudo certbot --nginx -d $DOMAIN -d www.$DOMAIN"
    fi
fi

# ─── 8. CRON JOBS ────────────────────────────────────────────────────────
sep
info "Passo 8/8 — Configurando cron jobs..."
sep

sudo crontab -l 2>/dev/null | grep -v geoleads > /tmp/cron.tmp || true
echo "# GeoLeads - Drip email a cada hora" >> /tmp/cron.tmp
echo "0 * * * * curl -s http://localhost:3000/api/drip/process?secret=xyPinHgjVIzrBhbHktRlZZjGb07e858WAzlq5cNpHfk= >> /var/log/geoleads-drip.log 2>&1" >> /tmp/cron.tmp
sudo crontab /tmp/cron.tmp
rm /tmp/cron.tmp
log "Cron jobs configurados!"

# ─── LIMPAR E TERMINAL ───────────────────────────────────────────────────
sep
echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║     ✅ TUDO PRONTO!                                 ║"
echo "║                                                     ║"
echo -e "║     ${CYAN}Acesse:${NC}                                     ║"
echo -e "║     ${GREEN}$APP_URL${NC}              ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""
echo "📋 Próximos passos MANUAIS:"
echo ""
if [ -n "$DOMAIN" ]; then
    echo "  1. DNS: $DOMAIN -> $IP_PUBLICO (se não fez ainda)"
    echo "  2. GitHub Secrets: mudar APP_URL pra https://$DOMAIN"
    echo "  3. Mercado Pago webhook: https://developers.mercadopago.com"
    echo "     URL: https://$DOMAIN/api/mercado-pago/webhook"
else
    echo "  1. GitHub Secrets: mudar APP_URL pra $APP_URL"
    echo "  2. Mercado Pago webhook: https://developers.mercadopago.com"
    echo "     URL: $APP_URL/api/mercado-pago/webhook"
fi
echo ""
echo "📋 Comandos úteis:"
echo "  Logs:   docker logs -f geoleads"
echo "  Debug:  docker logs --tail 100 geoleads"
echo "  Update: cd /home/ubuntu/geoleads && bash deploy-oracle.sh"
echo ""
