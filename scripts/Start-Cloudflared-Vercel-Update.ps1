#Requires -Version 5.1
<#
.SYNOPSIS
  Monitors Cloudflared output, extracts the public URL once,
  updates a Vercel env var, and triggers a production deployment.
#>
param(
  [Parameter(Mandatory=$true)]
  [string]$CloudflaredPath     = "C:\Program Files (x86)\cloudflared\cloudflared.exe",
  [Parameter(Mandatory=$true)]
  [string]$VercelCliPath       = "C:\Users\ajariwala3\AppData\Local\pnpm\global\5\node_modules\vercel\node_modules\.bin\vercel.cmd",
  [Parameter(Mandatory=$true)]
  [string]$LogDirectory        = "C:\Users\ajariwala3\Documents\AIPI\log",
  [string]$VercelEnvVarName    = "OLLAMA_URL",
  [ValidateSet("production","preview","development")]
  [string]$VercelEnvScope      = "production",
  [string]$LocalUrl            = "http://localhost:11434",
  [string]$HostHeader          = "localhost:11434"
)

# Exit on unhandled errors
$ErrorActionPreference = "Stop"
$script:Updated = $false
$LogFile = Join-Path $LogDirectory "cloudflared_output.log"
$UrlRegex = 'https://[-a-z0-9]+\.trycloudflare\.com'

# Logging helper
function Write-Log {
  param([string]$Msg)
  $t = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
  $line = "$t - $Msg"
  Write-Host $line
  Add-Content -Path $LogFile -Value $line
}

# Ensure log directory exists
if (-not (Test-Path $LogDirectory)) {
  New-Item -Path $LogDirectory -ItemType Directory -Force | Out-Null
}

Write-Log "Starting URL watcher."
Write-Log "Cloudflared: $CloudflaredPath"
Write-Log "Vercel CLI: $VercelCliPath"
Write-Log "Monitoring log: $LogFile"

# Start Cloudflared & hook events
$si = New-Object System.Diagnostics.ProcessStartInfo
$si.FileName        = $CloudflaredPath
$si.Arguments       = "tunnel --url $LocalUrl --no-autoupdate --http-host-header=`"$HostHeader`""
$si.RedirectStandardOutput = $true
$si.RedirectStandardError  = $true
$si.UseShellExecute        = $false
$si.CreateNoWindow         = $true

$proc = [Diagnostics.Process]::Start($si)
$proc.BeginOutputReadLine()
$proc.BeginErrorReadLine()

# Handler for both stdout and stderr
$handler = {
  param($s, $e)
  if (-not [string]::IsNullOrEmpty($e.Data)) {
    Write-Log "[CF] $($e.Data)"
    if (-not $script:Updated -and $e.Data -match $UrlRegex) {
      $url = $Matches[0]
      Write-Log "Detected tunnel URL: $url"
      $script:Updated = $true

      # Remove old var
      Write-Log "Removing old Vercel env var $VercelEnvVarName ($VercelEnvScope)"
      & $VercelCliPath env rm $VercelEnvVarName $VercelEnvScope --yes | ForEach-Object { Write-Log $_ }

      # Add new var
      Write-Log "Adding new Vercel env var $VercelEnvVarName=$url"
      & $VercelCliPath env add $VercelEnvVarName $url $VercelEnvScope --yes | ForEach-Object { Write-Log $_ }

      # Deploy
      Write-Log "Triggering Vercel production deployment"
      & $VercelCliPath deploy --prod --yes | ForEach-Object { Write-Log $_ }
      Write-Log "Deployment command finished (exit $LASTEXITCODE)"
    }
  }
}

Register-ObjectEvent -InputObject $proc -EventName OutputDataReceived -Action $handler -SourceIdentifier CFOut
Register-ObjectEvent -InputObject $proc -EventName ErrorDataReceived  -Action $handler -SourceIdentifier CFErr

# Wait for the tunnel to exit (if ever)
$proc.WaitForExit()
$code = $proc.ExitCode
Write-Log "Cloudflared process exited with code $code"

# Cleanup
Unregister-Event -SourceIdentifier CFOut -ErrorAction SilentlyContinue
Unregister-Event -SourceIdentifier CFErr -ErrorAction SilentlyContinue
$proc.Dispose()
exit $code
