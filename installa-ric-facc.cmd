@echo off
setlocal
cd /d "%~dp0"

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0installa-ric-facc.ps1" %*
set EXIT_CODE=%ERRORLEVEL%

if not "%EXIT_CODE%"=="0" (
    echo.
    echo Installazione non completata. Codice uscita: %EXIT_CODE%
    echo.
    pause
)

exit /b %EXIT_CODE%
