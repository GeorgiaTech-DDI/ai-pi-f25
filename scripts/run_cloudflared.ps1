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
  [int]   $MaxRestarts     = 5,
  [int]   $MaxTimeouts     = 5     # consecutive timeouts before restart
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
  $timeoutCount = 0
  Write-Log "Launching cloudflared (attempt #$attempt)..."

  & $CloudflaredPath tunnel --url $LocalUrl --http-host-header=$LocalUrl --no-autoupdate 2>&1 |
    ForEach-Object {
      # write each line to console & log file, closing the file handle each time
      Write-Host $_
      $_ | Out-File -FilePath $LogFile -Append -Encoding UTF8

      # Restart if we see too many consecutive connection errors
      if ($_ -match "Failed to serve tunnel connection|Connection terminated|timeout: no recent network activity") {
        $timeoutCount++
        Write-Log "Connection error detected (count: $timeoutCount of $MaxTimeouts)."
        if ($timeoutCount -ge $MaxTimeouts) {
          Write-Log "Max timeouts reached. Breaking pipe to restart cloudflared."
          break
        }
      }

      # Reset counter on success
      if ($_ -match "Registered tunnel connection") {
        if ($timeoutCount -gt 0) {
          Write-Log "Connection re-established. Resetting timeout counter."
          $timeoutCount = 0
        }
      }
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
