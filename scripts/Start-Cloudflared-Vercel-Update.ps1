# aws-rag/frontend/scripts/Start-Cloudflared-Vercel-Update.ps1
# Requires -Version 5.1
<#
.SYNOPSIS
  Runs cloudflared, watches its output for the public URL,
  then updates Vercel env var and triggers deploy.
#>

param(
  [string]$CloudflaredPath  = "C:\Program Files (x86)\cloudflared\cloudflared.exe",
  [string]$VercelCliPath    = "C:\Users\ajariwala3\AppData\Local\pnpm\global\5\node_modules\vercel\node_modules\.bin\vercel.cmd",
  [string]$LocalUrl         = "http://localhost:11434",
  [string]$HostHeader       = "localhost:11434",
  [string]$VercelEnvVarName = "OLLAMA_URL",
  [ValidateSet("production","preview","development")]
  [string]$VercelEnvScope   = "production"
)

$ErrorActionPreference = "Stop"
$script:Updated = $false
$UrlRegex = 'https://[-a-z0-9]+\.trycloudflare\.com'

function Write-Log {
  param($Msg)
  $ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
  Write-Host "$ts - $Msg"
}

Write-Log "=== Start-Cloudflared-Vercel-Update ==="
Write-Log "Using cloudflared: $CloudflaredPath"
Write-Log "Using Vercel CLI:  $VercelCliPath"

# Prepare & launch cloudflared
$si = New-Object System.Diagnostics.ProcessStartInfo
$si.FileName            = $CloudflaredPath
$si.Arguments           = "tunnel --url $LocalUrl --no-autoupdate --http-host-header=`"$HostHeader`""
$si.RedirectStandardOutput = $true
$si.RedirectStandardError  = $true
$si.UseShellExecute        = $false
$si.CreateNoWindow         = $true

$proc = New-Object System.Diagnostics.Process
$proc.StartInfo = $si
$proc.Start()    | Out-Null
$proc.BeginOutputReadLine()
$proc.BeginErrorReadLine()

# Shared handler for stdout & stderr
$handler = {
  param($sender, $e)
  if ([string]::IsNullOrEmpty($e.Data)) { return }

  Write-Log "[CF] $($e.Data)"

  if (-not $script:Updated -and $e.Data -match $UrlRegex) {
    $url = $Matches[0]
    Write-Log "Detected tunnel URL: $url"
    $script:Updated = $true

    # Remove old var
    Write-Log "Removing old Vercel env var $VercelEnvVarName ($VercelEnvScope)"
    & $VercelCliPath env rm $VercelEnvVarName $VercelEnvScope --yes |
      ForEach-Object { Write-Log $_ }

    # Add new var
    Write-Log "Adding new Vercel env var $VercelEnvVarName=$url"
    & $VercelCliPath env add $VercelEnvVarName $url $VercelEnvScope --yes |
      ForEach-Object { Write-Log $_ }

    # Deploy
    Write-Log "Triggering Vercel production deployment..."
    & $VercelCliPath deploy --prod --yes |
      ForEach-Object { Write-Log $_ }
    Write-Log "Deployment finished (exit code $LASTEXITCODE)."
  }
}

Register-ObjectEvent -InputObject $proc -EventName OutputDataReceived -Action $handler -SourceIdentifier CFOut
Register-ObjectEvent -InputObject $proc -EventName ErrorDataReceived  -Action $handler -SourceIdentifier CFErr

# Block until tunnel process exits
$proc.WaitForExit()
Write-Log "cloudflared process exited with code $($proc.ExitCode)"

# Cleanup
Unregister-Event -SourceIdentifier CFOut -ErrorAction SilentlyContinue
Unregister-Event -SourceIdentifier CFErr -ErrorAction SilentlyContinue
$proc.Dispose()

exit $proc.ExitCode
