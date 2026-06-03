@echo off
setlocal
cd /d "%~dp0"

rem --- Controllo licenza: utilizzabile solo prima del 15 Luglio 2026 ---
for /f %%D in ('powershell -NoProfile -Command "if ((Get-Date) -ge (Get-Date '2026-07-15')) { 'SCADUTO' } else { 'OK' }"') do set "LICENZA=%%D"

if /i "%LICENZA%"=="SCADUTO" (
    echo.
    echo ============================================================
    echo  La proprieta' intellettuale di questo software e' del
    echo  logopedista Carlo Santoro ed e' soggetto a restrizioni d'uso.
    echo.
    echo  Per qualsiasi informazione si prega di contattarlo:
    echo    Telefono: 3382948987
    echo    Email:    vespaxp74@gmail.com
    echo ============================================================
    echo.
    pause
    exit /b 0
)

where node >nul 2>nul
if errorlevel 1 (
    echo.
    echo Node.js non e installato o non e disponibile nel PATH.
    echo Esegui prima installa-ric-facc.cmd
    echo.
    pause
    exit /b 1
)

if not defined PORT set "PORT=3000"

echo.
echo Avvio Ric_Facc...
echo La pagina studente si aprira' a schermo intero (modalita' kiosk).
echo Per chiudere la pagina studente: Alt+F4.
echo.

rem --- Apre la pagina studente a tutto schermo (kiosk) appena il server e' pronto ---
rem Avviato in modo separato: attende qualche secondo, poi lancia Edge in kiosk.
rem Se Edge non e' disponibile, ripiega sul browser predefinito.
start "" powershell -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Seconds 3; try { Start-Process 'msedge' -ArgumentList '--kiosk','http://localhost:%PORT%/','--edge-kiosk-type=fullscreen','--no-first-run','--no-default-browser-check' -ErrorAction Stop } catch { Start-Process 'http://localhost:%PORT%/' }"

node server.js

echo.
echo Server terminato.
pause
