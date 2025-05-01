# aws-rag/frontend/scripts/run_cloudflared.ps1
# Requires -Version 5.1
<#
.SYNOPSIS
  Supervises cloudflared: logs output, restarts on failure.
.DESCRIPTION
  Runs a “quick” tunnel to $LocalUrl.
  Appends all output to cloudflared_output.log.
  If cloudflared exits non‑zero, waits $RestartDelay and retries (up to $MaxRestarts).
#>

param(
  [string]$CloudflaredPath = "C:\Program Files (x86)\cloudflared\cloudflared.exe",
  [string]$LocalUrl        = "http://localhost:11434",
  [string]$LogDirectory    = "C:\Users\ajariwala3\Documents\AIPI\log",
  [int]   $RestartDelay    = 5,    # seconds
  [int]   $MaxRestarts     = 10
)

# Ensure log dir exists
if (-not (Test-Path $LogDirectory)) {
  New-Item $LogDirectory -ItemType Directory -Force | Out-Null
}
$LogFile = Join-Path $LogDirectory "cloudflared_output.log"

function Write-Log {
  param($Msg)
  $ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
  $line = "$ts - $Msg"
  Write-Host $line
  Add-Content -Path $LogFile -Value $line
}

Write-Log "=== Starting cloudflared supervisor ==="
$attempt = 0

while ($true) {
  $attempt++
  Write-Log "Launching cloudflared (attempt #$attempt)..."

  & $CloudflaredPath tunnel --url $LocalUrl --no-autoupdate 2>&1 |
    Tee-Object -FilePath $LogFile -Append

  $code = $LASTEXITCODE
  Write-Log "cloudflared exited with code $code"

  if ($code -eq 0) {
    Write-Log "Normal exit → stopping supervisor."
    break
  }

  if ($attempt -ge $MaxRestarts) {
    Write-Log "Max restarts ($MaxRestarts) reached → aborting."
    exit 1
  }

  Write-Log "Restarting in $RestartDelay seconds..."
  Start-Sleep -Seconds $RestartDelay
}
