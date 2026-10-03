# Arrête les services RescueNet (processus) ; ajouter -WithInfra pour arrêter aussi les conteneurs Docker.
param([switch]$WithInfra)
$root = Split-Path -Parent $PSScriptRoot
$pids = Join-Path $root 'logs\pids.txt'
if (Test-Path $pids) {
    Get-Content $pids | ForEach-Object {
        $name, $id = $_ -split '='
        $p = Get-Process -Id $id -ErrorAction SilentlyContinue
        if ($p) { Stop-Process -Id $id -Force; Write-Host "arrêté : $name" }
    }
    Remove-Item $pids
}
if ($WithInfra) { docker compose -f (Join-Path $root 'docker-compose.infra.yml') stop }
