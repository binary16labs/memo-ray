# Memo-Ray dev launcher (PowerShell)
#
# Boots the server (Express on :3030) and client (Vite + React on :5175) in parallel.

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot

$serverDir = Join-Path $root "agent-os-dashboard\server"
$clientDir = Join-Path $root "agent-os-dashboard\client"

# Check and install dependencies
foreach ($dir in @($serverDir, $clientDir)) {
    if (-not (Test-Path (Join-Path $dir "node_modules"))) {
        Write-Host "▸ npm install in $dir"
        Push-Location $dir
        npm install
        Pop-Location
    }
}

Write-Host "▸ Memo-Ray dev launcher"
Write-Host "  server → http://localhost:3030"
Write-Host "  client → http://localhost:5175"

# Server - Express on :3030
$env:PORT = "3030"
$server = Start-Process `
    -FilePath "node" `
    -ArgumentList "index.js" `
    -WorkingDirectory $serverDir `
    -PassThru `
    -NoNewWindow

# Client - Vite + React
$npmExec = if ($IsWindows -or $env:OS -match "Windows") { "npm.cmd" } else { "npm" }
$client = Start-Process `
    -FilePath $npmExec `
    -ArgumentList "run","dev" `
    -WorkingDirectory $clientDir `
    -PassThru `
    -NoNewWindow

Write-Host "  server PID = $($server.Id)"
Write-Host "  client PID = $($client.Id)"

$procs = @($server, $client)

try {
    Wait-Process -Id ($procs | ForEach-Object { $_.Id })
} finally {
    foreach ($p in $procs) {
        if ($p -and -not $p.HasExited) {
            Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue
        }
    }
}
