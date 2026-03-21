[CmdletBinding()]
param(
    [int]$Port = 3000,
    [switch]$SkipFirewall,
    [switch]$SkipLaunch
)

$ErrorActionPreference = 'Stop'
$script:ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path

if ([enum]::GetNames([Net.SecurityProtocolType]) -contains 'Tls12') {
    [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
}

function Write-Step {
    param([string]$Message)
    Write-Host ""
    Write-Host "==> $Message" -ForegroundColor Cyan
}

function Test-Administrator {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($identity)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Start-ElevatedSelf {
    $arguments = @(
        '-NoProfile',
        '-ExecutionPolicy', 'Bypass',
        '-File', $PSCommandPath,
        '-Port', $Port
    )

    if ($SkipFirewall) {
        $arguments += '-SkipFirewall'
    }

    if ($SkipLaunch) {
        $arguments += '-SkipLaunch'
    }

    Start-Process -FilePath 'powershell.exe' -Verb RunAs -ArgumentList $arguments | Out-Null
}

function Test-Command {
    param([string]$Name)
    return [bool](Get-Command $Name -ErrorAction SilentlyContinue)
}

function Get-NodeVersion {
    if (-not (Test-Command 'node.exe')) {
        return $null
    }

    $versionText = (& node -v).Trim()
    if (-not $versionText) {
        return $null
    }

    return [version]($versionText.TrimStart('v'))
}

function Refresh-ProcessPath {
    $machinePath = [Environment]::GetEnvironmentVariable('Path', 'Machine')
    $userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
    $env:Path = @($machinePath, $userPath) -join ';'
}

function Get-NodeInstallerArchitecture {
    switch ([System.Runtime.InteropServices.RuntimeInformation]::OSArchitecture.ToString()) {
        'X64' { return 'x64' }
        'Arm64' { return 'arm64' }
        'X86' { return 'x86' }
        default { return 'x64' }
    }
}

function Install-NodeWithWinget {
    if (-not (Test-Command 'winget.exe')) {
        return $false
    }

    Write-Step 'Installazione Node.js LTS tramite winget'

    & winget install --id OpenJS.NodeJS.LTS --exact --accept-package-agreements --accept-source-agreements --silent
    if ($LASTEXITCODE -ne 0) {
        Write-Warning "winget ha restituito codice $LASTEXITCODE. Provo il fallback MSI."
        return $false
    }

    return $true
}

function Install-NodeWithMsi {
    $arch = Get-NodeInstallerArchitecture
    $requiredFileName = "win-$arch-msi"

    Write-Step "Ricerca ultima release Node.js LTS per architettura $arch"
    $releases = Invoke-RestMethod -Uri 'https://nodejs.org/dist/index.json'
    $release = $releases |
        Where-Object { $_.lts -and $_.files -contains $requiredFileName } |
        Select-Object -First 1

    if (-not $release) {
        throw "Impossibile trovare una release Node.js LTS compatibile per $arch."
    }

    $msiName = "node-$($release.version)-$arch.msi"
    $msiUrl = "https://nodejs.org/dist/$($release.version)/$msiName"
    $msiPath = Join-Path $env:TEMP $msiName

    Write-Step "Download di $msiName"
    Invoke-WebRequest -Uri $msiUrl -OutFile $msiPath

    Write-Step 'Installazione Node.js LTS tramite MSI'
    $process = Start-Process -FilePath 'msiexec.exe' -ArgumentList @('/i', $msiPath, '/qn', '/norestart') -PassThru -Wait
    if ($process.ExitCode -ne 0) {
        throw "Installazione MSI di Node.js fallita con codice $($process.ExitCode)."
    }
}

function Ensure-Node {
    $minimumVersion = [version]'18.0.0'
    $nodeVersion = Get-NodeVersion

    if ($nodeVersion -and $nodeVersion -ge $minimumVersion) {
        Write-Step "Node.js gia disponibile: v$nodeVersion"
        return
    }

    Write-Step 'Node.js non trovato o versione non compatibile. Avvio installazione automatica.'

    $installed = Install-NodeWithWinget
    if (-not $installed) {
        Install-NodeWithMsi
    }

    Refresh-ProcessPath

    $nodeVersion = Get-NodeVersion
    if (-not $nodeVersion -or $nodeVersion -lt $minimumVersion) {
        throw 'Node.js risulta ancora non disponibile dopo l installazione.'
    }

    Write-Step "Node.js pronto: v$nodeVersion"
}

function Ensure-FirewallRule {
    param([int]$LocalPort)

    if ($SkipFirewall) {
        Write-Step 'Configurazione firewall saltata su richiesta'
        return
    }

    $ruleName = "Ric_Facc Porta $LocalPort"
    $existingRule = Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue

    if ($existingRule) {
        Write-Step "Regola firewall gia presente: $ruleName"
        return
    }

    Write-Step "Apertura porta $LocalPort sul firewall Windows (reti private)"
    New-NetFirewallRule `
        -DisplayName $ruleName `
        -Direction Inbound `
        -Action Allow `
        -Enabled True `
        -Profile Private `
        -Protocol TCP `
        -LocalPort $LocalPort | Out-Null
}

function Ensure-DesktopShortcut {
    $shortcutPath = Join-Path ([Environment]::GetFolderPath('Desktop')) 'Ric_Facc.lnk'
    $targetPath = Join-Path $script:ProjectRoot 'avvia-ric-facc.cmd'

    Write-Step 'Creazione collegamento sul Desktop'
    $shell = New-Object -ComObject WScript.Shell
    $shortcut = $shell.CreateShortcut($shortcutPath)
    $shortcut.TargetPath = $targetPath
    $shortcut.WorkingDirectory = $script:ProjectRoot
    $shortcut.IconLocation = "$env:SystemRoot\System32\shell32.dll,220"
    $shortcut.Description = 'Avvia il server locale Ric_Facc'
    $shortcut.Save()
}

function Start-Project {
    if ($SkipLaunch) {
        Write-Step 'Avvio automatico saltato su richiesta'
        return
    }

    $launcherPath = Join-Path $script:ProjectRoot 'avvia-ric-facc.cmd'

    Write-Step 'Avvio del server Ric_Facc in una nuova finestra'
    Start-Process -FilePath 'cmd.exe' -ArgumentList @('/k', ('"{0}"' -f $launcherPath)) -WorkingDirectory $script:ProjectRoot | Out-Null
}

if ([Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT) {
    throw 'Questo installatore e pensato solo per Windows.'
}

if (-not (Test-Administrator)) {
    Write-Step 'Richiesta permessi amministratore'
    Start-ElevatedSelf
    exit 0
}

Write-Host ""
Write-Host 'Ric_Facc - installazione Windows' -ForegroundColor Green
Write-Host "Cartella progetto: $script:ProjectRoot"

Ensure-Node
Ensure-FirewallRule -LocalPort $Port
Ensure-DesktopShortcut
Start-Project

Write-Host ""
Write-Host 'Installazione completata.' -ForegroundColor Green
Write-Host "Per i prossimi avvii usa: $(Join-Path $script:ProjectRoot 'avvia-ric-facc.cmd')"
Write-Host "Se il browser non si apre da solo, visita http://localhost:$Port/"
Write-Host ""
