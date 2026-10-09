<#
One-command control for the whole local stack (db + api + web).

  .\seatbooker.ps1 up        build if needed, start everything, wait, print URLs
  .\seatbooker.ps1 down      stop everything (data kept)
  .\seatbooker.ps1 reset     stop and DELETE the database volume, then start fresh
  .\seatbooker.ps1 logs      follow logs from all three services
  .\seatbooker.ps1 status    show what is running
  .\seatbooker.ps1 rebuild   force a no-cache image rebuild, then start
#>
[CmdletBinding()]
param(
  [Parameter(Position = 0)]
  [ValidateSet('up', 'down', 'reset', 'logs', 'status', 'rebuild', 'help')]
  [string]$Command = 'up'
)

$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot

function Invoke-Compose {
  param([string[]]$ComposeArgs)
  & docker compose @ComposeArgs
  if ($LASTEXITCODE -ne 0) {
    throw "docker compose $($ComposeArgs -join ' ') failed with exit code $LASTEXITCODE."
  }
}

function Wait-ForApi {
  Write-Host ''
  Write-Host 'Waiting for the API to answer ...'
  # The API container runs migrations and the seed before it listens, so any HTTP
  # response means the stack is ready. There is no /health route, so this probes
  # the public login endpoint and accepts ANY status: a 400 for the empty body
  # still proves the server is up and routing.
  for ($i = 0; $i -lt 60; $i++) {
    try {
      Invoke-WebRequest -Uri 'http://localhost:3000/api/auth/login' -Method Post `
        -ContentType 'application/json' -Body '{}' -UseBasicParsing `
        -TimeoutSec 3 | Out-Null
      return $true
    } catch [System.Net.WebException], [Microsoft.PowerShell.Commands.HttpResponseException] {
      # A non-2xx status is still a live server — that is success here.
      if ($null -ne $_.Exception.Response) { return $true }
    } catch {
      # Connection refused: not up yet.
    }
    Start-Sleep -Seconds 2
  }
  return $false
}

function Show-Urls {
  Write-Host ''
  Write-Host '  Frontend   http://localhost:5173'
  Write-Host '  API        http://localhost:3000/api'
  Write-Host '  Postgres   localhost:5433  (user/password/db: seatbooker)'
  Write-Host ''
  Write-Host '  Logins     admin@centre.dev / Admin123!   (see README for all roles)'
  Write-Host ''
  Write-Host '  Logs       .\seatbooker.ps1 logs'
  Write-Host '  Stop       .\seatbooker.ps1 down'
}

switch ($Command) {
  'up' {
    Invoke-Compose @('up', '-d', '--build')
    if (-not (Wait-ForApi)) {
      Write-Warning 'The API did not answer in time. Check: .\seatbooker.ps1 logs'
    }
    Show-Urls
  }
  'down' { Invoke-Compose @('down') }
  'reset' {
    # -v drops the named volume, so the next up re-migrates and re-seeds empty.
    Invoke-Compose @('down', '-v')
    Invoke-Compose @('up', '-d', '--build')
    if (-not (Wait-ForApi)) {
      Write-Warning 'The API did not answer in time. Check: .\seatbooker.ps1 logs'
    }
    Show-Urls
  }
  'logs'    { Invoke-Compose @('logs', '-f') }
  'status'  { Invoke-Compose @('ps') }
  'rebuild' {
    Invoke-Compose @('build', '--no-cache')
    Invoke-Compose @('up', '-d')
    Show-Urls
  }
  'help'    { Get-Help -Full $PSCommandPath }
}
