# aws-rag/frontend/scripts/Start-Cloudflared-Vercel-Update.ps1
# Requires -Version 5.1
<#
.SYNOPSIS
  Tails the cloudflared log, extracts the public URL once,
  updates a Vercel env var and triggers a production deploy.
#>

param(
  [string]$LogDirectory     = "C:\Users\ajariwala3\Documents\AIPI\log",
  [string]$VercelCliPath    = "C:\Users\ajariwala3\AppData\Local\pnpm\global\5\node_modules\vercel\node_modules\.bin\vercel.cmd",
  [string]$VercelEnvVarName = "OLLAMA_URL",
  [ValidateSet("production","preview","development")]
  [string]$VercelEnvScope   = "production"
)

$ErrorActionPreference = "Stop"
$script:Updated = $false
$UrlRegex       = 'https://[-a-z0-9]+\.trycloudflare\.com'

function Write-Log {
  param($Msg)
  $ts   = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
  Write-Host "$ts - $Msg"
}

# Prepare log file path
if (-not (Test-Path $LogDirectory)) {
  New-Item $LogDirectory -ItemType Directory -Force | Out-Null
}
$LogFile = Join-Path $LogDirectory "cloudflared_output.log"
if (-not (Test-Path $LogFile)) {
  '' | Out-File -FilePath $LogFile -Encoding UTF8
}

Write-Log "=== Start-Cloudflared-Vercel-Update ==="
Write-Log "Tailing log: $LogFile"
Write-Log "Vercel CLI path: $VercelCliPath"
Write-Log "Env var to update: $VercelEnvVarName ($VercelEnvScope)"

# Tail the file in real-time
Get-Content -Path $LogFile -Tail 0 -Wait |
  ForEach-Object {
    $line = $_
    Write-Log "[CF] $line"

    if (-not $script:Updated -and $line -match $UrlRegex) {
      $url = $Matches[0]
      Write-Log "Detected tunnel URL: $url"
      $script:Updated = $true

      # Remove old env var
      Write-Log "Removing old Vercel env var $VercelEnvVarName"
      & $VercelCliPath env rm $VercelEnvVarName $VercelEnvScope --yes |
        ForEach-Object { Write-Log "$_" }

      # Add new env var
      Write-Log "Adding new Vercel env var $VercelEnvVarName=$url"
      & echo $url | & $VercelCliPath env add $VercelEnvVarName $VercelEnvScope |
        ForEach-Object { Write-Log "$_" }

      # Trigger deploy
      Write-Log "Triggering Vercel production deployment..."
      & $VercelCliPath deploy --prod --yes |
        ForEach-Object { Write-Log "$_" }
      Write-Log "Deployment finished (exit code $LASTEXITCODE)."

      # Exit after first successful update
      exit 0
    }
  }

# If Get-Content ever breaks (error/EOF), we exit non-zero to surface failure
Write-Log "Log tailing ended unexpectedly."
exit 1
