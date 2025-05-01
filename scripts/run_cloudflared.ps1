#Requires -Version 5.1
<#
.SYNOPSIS
  Runs cloudflared in a loop, restarts on failure, and logs output.
#>

param(
  [string]$CloudflaredPath   = "C:\Program Files (x86)\cloudflared\cloudflared.exe",
  [string]$LocalUrl          = "http://localhost:11434",
  [string]$LogDirectory      = "C:\Users\ajariwala3\Documents\AIPI\log",
  [int]   $RestartDelay      = 5,    # seconds between restarts
  [int]   $MaxRestarts       = 10    # give up after this many failures
)

# Logging helper
function Write-Log {
  param([string]$Message)
  $ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
  $line = "$ts - $Message"
  Write-Host $line
  Add-Content -Path (Join-Path $LogDirectory "cloudflared_output.log") -Value $line
}

# Ensure log directory exists
if (-not (Test-Path $LogDirectory)) {
  New-Item -Path $LogDirectory -ItemType Directory -Force | Out-Null
}
$LogFile = Join-Path $LogDirectory "cloudflared_output.log"

Write-Log "Starting cloudflared supervisor. Log: $LogFile"

$restartCount = 0
while ($true) {
  $attempt = $restartCount + 1
  Write-Log "Launching cloudflared (attempt #$attempt)..."
  & $CloudflaredPath tunnel --url $LocalUrl --no-autoupdate 2>&1 |
    Tee-Object -FilePath $LogFile -Append

  $exitCode = $LASTEXITCODE
  Write-Log "cloudflared exited with code $exitCode"

  if ($exitCode -eq 0) {
    Write-Log "Normal exit detected; stopping supervisor."
    break
  }

  $restartCount++
  if ($restartCount -ge $MaxRestarts) {
    Write-Log "Reached max restart attempts ($MaxRestarts). Exiting supervisor."
    exit 1
  }

  Write-Log "Restarting in $RestartDelay seconds..."
  Start-Sleep -Seconds $RestartDelay
}
