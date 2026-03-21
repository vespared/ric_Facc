@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
    echo.
    echo Node.js non e installato o non e disponibile nel PATH.
    echo Esegui prima installa-ric-facc.cmd
    echo.
    pause
    exit /b 1
)

echo.
echo Avvio Ric_Facc...
echo.
node server.js

echo.
echo Server terminato.
pause
