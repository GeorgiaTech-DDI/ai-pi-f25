# aws-rag/frontend/scripts/run_cloudflared.ps1
# Requires -Version 5.1
<#
.SYNOPSIS
  Supervises cloudflared: logs output, restarts on failure.
#>

param(
  [string]$CloudflaredPath = "C:\Program Files (x86)\cloudflared\cloudflared.exe",
  [string]$LocalUrl        = "http://localhost:11434",
  [string]$LogDirectory    = "C:\Users\ajariwala3\Documents\AIPI\log",
  [int]   $RestartDelay    = 5,    # seconds
  [int]   $MaxRestarts     = 5
)

# Ensure log dir exists
if (-not (Test-Path $LogDirectory)) {
  New-Item $LogDirectory -ItemType Directory -Force | Out-Null
}
$LogFile = Join-Path $LogDirectory "cloudflared_output.log"

function Write-Log {
  param($Msg)
  $ts   = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
  $line = "$ts - $Msg"
  Write-Host  $line
  $line | Out-File -FilePath $LogFile -Append -Encoding UTF8
}

Write-Log "=== Starting cloudflared supervisor ==="
$attempt = 0

while ($true) {
  $attempt++
  Write-Log "Launching cloudflared (attempt #$attempt)..."

  & $CloudflaredPath tunnel --url $LocalUrl --http-host-header=$LocalUrl --no-autoupdate 2>&1 |
    ForEach-Object {
      # write each line to console & log file, closing the file handle each time
      Write-Host $_
      $_ | Out-File -FilePath $LogFile -Append -Encoding UTF8
    }

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
