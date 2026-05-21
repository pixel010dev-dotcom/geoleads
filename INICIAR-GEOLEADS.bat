@echo off
title GeoLeads - Iniciar
cd /d "%~dp0dashboard"

echo.
echo  GeoLeads - parando servidores antigos...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000" ^| findstr LISTENING') do taskkill /F /PID %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3001" ^| findstr LISTENING') do taskkill /F /PID %%a >nul 2>&1

echo  GeoLeads - iniciando em http://localhost:3000
echo  Nao feche esta janela enquanto usar o site.
echo.

start "" cmd /c "timeout /t 4 /nobreak >nul & start http://localhost:3000"
npm run dev

pause
