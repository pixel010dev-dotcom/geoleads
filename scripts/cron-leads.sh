#!/bin/bash
# Chama o cron de leads do GeoLeads a cada 30 min
# Usa local dev secret (gl-dev-2026) pq o secret real do Railway é desconhecido

URL="https://geoleads-production-6583.up.railway.app/api/cron"
SECRET="gl-dev-2026"

# Chama com header x-cron-secret e/ou query param secret
curl -s -o /dev/null -w "%{http_code}" \
  -H "x-cron-secret: $SECRET" \
  "$URL?secret=$SECRET" \
  --max-time 30

echo "  $(date '+%H:%M') - cron geoleads"
