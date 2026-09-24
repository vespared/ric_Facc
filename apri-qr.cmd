@echo off
setlocal
cd /d "%~dp0"

if not defined PORT set "PORT=3000"
set "AUTO_OPEN_STUDENT=1"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0apri-qr.ps1" -Port %PORT%
