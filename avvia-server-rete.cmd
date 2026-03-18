@echo off
setlocal EnableDelayedExpansion
cd /d "%~dp0"

netstat -ano | findstr /R /C:":3000 .*LISTENING" >nul
if not errorlevel 1 (
    echo.
    echo La porta 3000 e gia occupata.
    echo Probabilmente il server e gia attivo in un altra finestra.
    echo.
    echo Se sei sulla stessa rete Wi-Fi del PC, prova ad aprire:
    for /f "tokens=2 delims=:" %%A in ('ipconfig ^| findstr /C:"Indirizzo IPv4"') do (
        set IP=%%A
        set IP=!IP: =!
        if "!IP!" neq "" echo - http://!IP!:3000/
    )
    echo.
    echo Usa l indirizzo del Wi-Fi del PC.
    echo Ignora eventuali IP di VPN o adattatori virtuali.
    echo.
    echo Se la pagina non si apre dal telefono, controlla firewall o VPN.
    echo.
    pause
    exit /b 1
)

node server.js
pause
