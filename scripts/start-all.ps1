# Démarre toute la plateforme RescueNet : Docker (bases + RabbitMQ), Eureka, Gateway, puis les modules.
# Usage :  powershell -ExecutionPolicy Bypass -File scripts\start-all.ps1
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$logs = Join-Path $root 'logs'
New-Item -ItemType Directory -Force $logs | Out-Null

$env:JAVA_HOME = (Get-ChildItem 'C:\Program Files\Eclipse Adoptium' -Directory | Where-Object Name -like 'jdk-21*' | Select-Object -First 1).FullName
$java = Join-Path $env:JAVA_HOME 'bin\java.exe'
$env:Path = "C:\Program Files\Go\bin;$env:Path"

function Wait-Until($label, [scriptblock]$test, $timeoutSec = 180) {
    $t = [Diagnostics.Stopwatch]::StartNew()
    while ($t.Elapsed.TotalSeconds -lt $timeoutSec) {
        try { if (& $test) { Write-Host "  OK  $label" -ForegroundColor Green; return } } catch {}
        Start-Sleep 2
    }
    throw "Timeout : $label"
}

function Start-Svc($name, $file, $argList, $workDir) {
    $params = @{
        FilePath = $file; WorkingDirectory = $workDir; WindowStyle = 'Hidden'; PassThru = $true
        RedirectStandardOutput = (Join-Path $logs "$name.log"); RedirectStandardError = (Join-Path $logs "$name.err")
    }
    if ($argList.Count -gt 0) { $params.ArgumentList = $argList }   # PowerShell refuse une liste vide
    $p = Start-Process @params
    Add-Content (Join-Path $logs 'pids.txt') "$name=$($p.Id)"
    Write-Host "  >>  $name (PID $($p.Id))"
}

Remove-Item (Join-Path $logs 'pids.txt') -ErrorAction SilentlyContinue

Write-Host '1/4 Docker Desktop'
& docker info *> $null
if ($LASTEXITCODE -ne 0) {
    Start-Process 'C:\Program Files\Docker\Docker\Docker Desktop.exe'
    Wait-Until 'moteur Docker' { docker info *> $null; $LASTEXITCODE -eq 0 } 240
}

Write-Host '2/4 Infrastructure (PostgreSQL, MongoDB, MySQL, SQL Server, Redis, RabbitMQ)'
docker compose -f (Join-Path $root 'docker-compose.infra.yml') up -d
Wait-Until 'conteneurs healthy' {
    $s = docker ps --filter 'name=rescuenet' --format '{{.Status}}'
    ($s.Count -ge 6) -and -not ($s | Where-Object { $_ -notmatch 'healthy' })
} 300

Write-Host '3/4 Eureka + Gateway'
Start-Svc 'discovery' $java @('-Xmx256m', '-jar', "$root\discovery-server\target\discovery-server-0.0.1-SNAPSHOT.jar") $root
Wait-Until 'Eureka :8761' { (Invoke-WebRequest http://localhost:8761/actuator/health -UseBasicParsing).StatusCode -eq 200 } 90
Start-Svc 'gateway' $java @('-Xmx256m', '-jar', "$root\api-gateway\target\api-gateway-0.0.1-SNAPSHOT.jar") $root

Write-Host '4/4 Modules métier'
Start-Svc 'triage' "$root\triage-ai-service\.venv\Scripts\python.exe" @('-m', 'uvicorn', 'app.main:app', '--port', '8083') "$root\triage-ai-service"
Start-Svc 'patient' 'node' @('src/server.js') "$root\patient-record-service"
Start-Svc 'hospital' 'dotnet' @("$root\hospital-service\bin\Release\net10.0\HospitalService.dll") "$root\hospital-service"
Start-Svc 'dispatch' "$root\dispatch-service\dispatch-service.exe" @() "$root\dispatch-service"
$emergencyJar = "$root\emergency-service\target\emergency-service-0.0.1-SNAPSHOT.jar"
if (Test-Path $emergencyJar) { Start-Svc 'emergency' $java @('-Xmx300m', '-jar', $emergencyJar) $root }

Write-Host "`nTout est lancé. Eureka : http://localhost:8761  |  Gateway : http://localhost:8080  |  RabbitMQ : http://localhost:15672 (rescue/rescue123)"
Write-Host 'Les services apparaissent dans Eureka sous 30-60 s. Arrêt : scripts\stop-all.ps1'
