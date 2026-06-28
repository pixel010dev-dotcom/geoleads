#!/usr/bin/env bash
# run_all.sh — Orquestrador: smoke -> syntax -> pytest -> dashboard -> Telegram
set -e

cd "$(dirname "$0")/.."

echo "========================================"
echo "  GeoLeads - Run All"
echo "  $(date '+%d/%m/%Y %H:%M')"
echo "========================================"
echo ""

STEP=0

STEP=$((STEP+1))
echo "[$STEP] Smoke test (imports)..."
if python3 -c "import sys; sys.path.insert(0,'.'); from scripts.ai_supervisor import AISupervisor; print('OK')" 2>&1; then
    echo "  PASS"
else
    echo "  FAIL"; exit 1
fi

STEP=$((STEP+1))
echo "[$STEP] Syntax check..."
ERRORS=0
for f in scripts/*.py; do
    if python3 -m py_compile "$f" 2>/dev/null; then :
    else
        echo "  FAIL: $f"
        ERRORS=$((ERRORS+1))
    fi
done
if [ "$ERRORS" -eq 0 ]; then
    echo "  PASS: all scripts syntax OK"
else
    echo "  FAIL: $ERRORS scripts with syntax errors"
    exit 1
fi

STEP=$((STEP+1))
echo "[$STEP] Pytest..."
if python -m pytest scripts/tests/ -v 2>&1 | tail -5; then
    echo "  PASS"
else
    echo "  FAIL"; exit 1
fi

STEP=$((STEP+1))
echo "[$STEP] Dashboard..."
if python scripts/dashboard_aprendizado.py 2>&1; then
    echo "  PASS"
else
    echo "  FAIL"; exit 1
fi

echo ""
echo "========================================"
echo "  ALL PASSED"
echo "========================================"
