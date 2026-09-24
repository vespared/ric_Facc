@echo off
setlocal EnableDelayedExpansion
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
    echo.
    echo Node.js non e installato o non e disponibile nel PATH.
    echo Avvia prima installa-ric-facc.cmd per preparare questo PC.
    echo.
    pause
    exit /b 1
)

if not defined PORT set "PORT=3000"
set "AUTO_OPEN_STUDENT=1"

netstat -ano | findstr /R /C:":%PORT% .*LISTENING" >nul
if not errorlevel 1 (
    echo.
    echo Il server e' gia' attivo sulla porta %PORT% in un'altra finestra.
    echo Apertura del riquadro grafico con il QR code per il docente...
    echo.
    start "" powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "%~dp0apri-qr.ps1" -Port %PORT%
    timeout /t 2 >nul
    exit /b 0
)

echo.
echo ============================================================
echo   Ric_Facc - Server Locale per Docente e Studente
echo   Porta: %PORT%
echo   Appena il docente inquadra il QR code con smartphone/tablet,
echo   la pagina studente verra' aperta direttamente su questo PC.
echo ============================================================
echo.

rem --- Avvia in background il riquadro grafico con il QR code docente appena il server e' pronto ---
start "" powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "%~dp0apri-qr.ps1" -Port %PORT%

node server.js
pause
