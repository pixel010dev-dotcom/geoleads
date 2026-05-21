# GeoLeads - assistente de configuracao local (Windows)
# Rode: powershell -ExecutionPolicy Bypass -File scripts\setup-geoleads.ps1

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$dashboard = Join-Path $root "dashboard"

Write-Host "`n=== GeoLeads Setup ===" -ForegroundColor Cyan

if (-not (Test-Path (Join-Path $dashboard "package.json"))) {
  Write-Host "Pasta dashboard nao encontrada." -ForegroundColor Red
  exit 1
}

$envFile = Join-Path $dashboard ".env.local"
$example = Join-Path $dashboard ".env.example"

if (-not (Test-Path $envFile)) {
  if (Test-Path $example) {
    Copy-Item $example $envFile
    Write-Host "Criei .env.local a partir de .env.example" -ForegroundColor Yellow
    Write-Host "Edite $envFile com suas chaves e rode este script de novo." -ForegroundColor Yellow
    exit 0
  }
}

Write-Host "Instalando dependencias..." -ForegroundColor Green
Set-Location $dashboard
npm install

Write-Host "Rodando build de producao..." -ForegroundColor Green
npm run build
if ($LASTEXITCODE -ne 0) {
  Write-Host "Build falhou. Corrija os erros acima." -ForegroundColor Red
  exit $LASTEXITCODE
}

Write-Host "`nBuild OK." -ForegroundColor Green
Write-Host "Para subir local: npm run dev" -ForegroundColor Cyan
Write-Host "Abra: http://localhost:3000`n" -ForegroundColor Cyan

Write-Host "Railway (deploy):" -ForegroundColor Yellow
Write-Host "  1) railway login" -ForegroundColor Gray
Write-Host "  2) railway link   (escolha o projeto)" -ForegroundColor Gray
Write-Host "  3) railway up     (ou push no GitHub se CI conectado)" -ForegroundColor Gray
Write-Host "`nDoc completa: docs\DEPLOY-RAILWAY-GEOLEADS.md`n" -ForegroundColor Gray
