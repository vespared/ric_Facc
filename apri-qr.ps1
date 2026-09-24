[CmdletBinding()]
param(
    [int]$Port = 3000,
    [int]$TimeoutSeconds = 12
)

$ErrorActionPreference = 'SilentlyContinue'

$targetUrl = "http://localhost:$Port/connetti.html"

# Attendi che il server sia attivo sulla porta indicata
$stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
$serverReady = $false

while ($stopwatch.Elapsed.TotalSeconds -lt $TimeoutSeconds) {
    try {
        $tcp = New-Object System.Net.Sockets.TcpClient
        $asyncResult = $tcp.BeginConnect("127.0.0.1", $Port, $null, $null)
        if ($asyncResult.AsyncWaitHandle.WaitOne(300, $false)) {
            $tcp.EndConnect($asyncResult)
            $tcp.Close()
            $serverReady = $true
            break
        }
        $tcp.Close()
    } catch {
        # Continua ad attendere
    }
    Start-Sleep -Milliseconds 250
}

# Se il server non risponde entro il timeout, prova comunque ad aprire la pagina
$edgeExe = $null

# Ricerca Microsoft Edge
$edgeReg = (Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\msedge.exe' -ErrorAction SilentlyContinue).'(default)'
if ($edgeReg -and (Test-Path $edgeReg)) {
    $edgeExe = $edgeReg
} elseif (Test-Path "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe") {
    $edgeExe = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
} elseif (Test-Path "C:\Program Files\Microsoft\Edge\Application\msedge.exe") {
    $edgeExe = "C:\Program Files\Microsoft\Edge\Application\msedge.exe"
}

if ($edgeExe) {
    # Avvia Edge in modalita' applicazione (finestra dedicata senza barre o schede)
    Start-Process -FilePath $edgeExe -ArgumentList "--app=$targetUrl", "--window-size=440,650"
    exit 0
}

# Ricerca Google Chrome come alternativa per la modalita' app
$chromeReg = (Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\chrome.exe' -ErrorAction SilentlyContinue).'(default)'
if ($chromeReg -and (Test-Path $chromeReg)) {
    Start-Process -FilePath $chromeReg -ArgumentList "--app=$targetUrl", "--window-size=440,650"
    exit 0
}

# Ripiego: browser predefinito di sistema
Start-Process $targetUrl
exit 0
