#Requires -Version 5.1

<#
.SYNOPSIS
Starts a Cloudflared tunnel, detects the public URL, updates a Vercel environment variable,
and triggers a Vercel deployment. Logs output to a file and the console.

.DESCRIPTION
This script automates the process of exposing a local service (like Ollama on port 11434)
via a Cloudflared tunnel and updating a Vercel application to use this tunnel URL.
It monitors the Cloudflared output in real-time.

.PARAMETER CloudflaredPath
The full path to the cloudflared.exe executable.

.PARAMETER VercelCliPath
The full path to the vercel.cmd or vercel.exe CLI. Often found via `Get-Command vercel`.

.PARAMETER LogDirectory
The directory where the cloudflared_output.log file will be stored.

.PARAMETER VercelEnvVarName
The name of the environment variable to update in Vercel (e.g., "OLLAMA_URL").

.PARAMETER VercelEnvScope
The Vercel environment scope (e.g., "production", "preview", "development"). Defaults to "production".

.PARAMETER LocalUrlToTunnel
The local URL that Cloudflared should tunnel to. Defaults to "http://localhost:11434".

.PARAMETER CloudflaredHostHeader
Optional HTTP Host header for Cloudflared. Defaults to "localhost:11434".

.EXAMPLE
.\run_cloudflared_and_update_vercel.ps1 -CloudflaredPath "C:\path\to\cloudflared.exe" -VercelCliPath "C:\path\to\vercel.cmd" -LogDirectory "C:\Logs"

.NOTES
- Ensure Cloudflared and Vercel CLI are installed and authenticated.
- The script runs indefinitely until Cloudflared exits or the script is manually stopped.
- PowerShell 5.1 or later is required.
#>
param(
    [Parameter(Mandatory=$true)]
    [string]$CloudflaredPath = "C:\Program Files\Cloudflared\cloudflared.exe",

    [Parameter(Mandatory=$true)]
    [string]$VercelCliPath = "$env:APPDATA\npm\vercel.cmd", # Common location, adjust if needed

    [Parameter(Mandatory=$true)]
    [string]$LogDirectory = "$env:USERPROFILE\Logs",

    [string]$VercelEnvVarName = "OLLAMA_URL",
    [ValidateSet("production", "preview", "development")]
    [string]$VercelEnvScope = "production",

    [string]$LocalUrlToTunnel = "http://localhost:11434",
    [string]$CloudflaredHostHeader = "localhost:11434"
)

# --- Script Setup ---
$ErrorActionPreference = 'Stop' # Exit script on terminating errors
$script:VercelUpdatedThisRun = $false # Use script scope to modify within event handlers
$CloudflaredLogFile = Join-Path -Path $LogDirectory -ChildPath "cloudflared_output.log"
$CloudflaredUrlRegex = 'https://[-a-z0-9]+\.trycloudflare\.com'

# --- Logging Function ---
function Write-Log {
    param([string]$Message)
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logLine = "$timestamp - $Message"
    Write-Host $logLine
    try {
        Add-Content -Path $CloudflaredLogFile -Value $logLine -ErrorAction Stop
    } catch {
        Write-Warning "Failed to write to log file '$CloudflaredLogFile': $($_.Exception.Message)"
    }
}

# --- Main Execution ---

# 1. Ensure Log Directory Exists
if (-not (Test-Path -Path $LogDirectory -PathType Container)) {
    Write-Log "Creating log directory: $LogDirectory"
    try {
        New-Item -Path $LogDirectory -ItemType Directory -Force | Out-Null
    } catch {
        Write-Error "Failed to create log directory '$LogDirectory'. Exiting. Error: $($_.Exception.Message)"
        exit 1
    }
} else {
     Write-Log "Log directory exists: $LogDirectory"
}
# Clear old log file if it exists (optional)
# if (Test-Path $CloudflaredLogFile) { Remove-Item $CloudflaredLogFile }

Write-Log "Starting Cloudflared wrapper script."
Write-Log "Cloudflared Path: $CloudflaredPath"
Write-Log "Vercel CLI Path: $VercelCliPath"
Write-Log "Cloudflared output will be logged to: $CloudflaredLogFile"
Write-Log "Vercel Env Var: $VercelEnvVarName ($VercelEnvScope)"
Write-Log "Local URL: $LocalUrlToTunnel"

# 2. Configure Cloudflared Process
$startInfo = New-Object System.Diagnostics.ProcessStartInfo
$startInfo.FileName = $CloudflaredPath
# Important: Escape quotes if paths have spaces, though PowerShell handles it often.
# Construct args carefully.
$arguments = "tunnel --url $LocalUrlToTunnel --no-autoupdate"
if ($CloudflaredHostHeader) {
    $arguments += " --http-host-header=""$CloudflaredHostHeader"""
}
$startInfo.Arguments = $arguments
$startInfo.RedirectStandardOutput = $true
$startInfo.RedirectStandardError = $true
$startInfo.UseShellExecute = $false
$startInfo.CreateNoWindow = $true # Run hidden

$process = New-Object System.Diagnostics.Process
$process.StartInfo = $startInfo

# 3. Register Event Handlers for Real-time Output Processing
$outputAction = {
    param($sender, $e)
    if (-not [string]::IsNullOrEmpty($e.Data)) {
        Write-Log "[CF_OUT] $($e.Data)" # Log raw cloudflared output

        # Check for the Tunnel URL
        if (($e.Data -match $CloudflaredUrlRegex) -and (-not $script:VercelUpdatedThisRun)) {
            $tunnelUrl = $Matches[0]
            Write-Log "Detected Cloudflare tunnel URL: $tunnelUrl"
            $script:VercelUpdatedThisRun = $true # Set flag immediately

            # Update Vercel Environment Variable
            Write-Log "Attempting to remove old Vercel env var: $VercelEnvVarName ($VercelEnvScope)"
            try {
                # Use Invoke-Expression or Start-Process to handle .cmd properly
                # Using '&' might be sufficient if vercel.cmd is in PATH or full path is correct
                 & $VercelCliPath env rm $VercelEnvVarName $VercelEnvScope --yes 2>&1 | Write-Log # Log output/errors
                 Write-Log "Successfully removed old env var (or it didn't exist)."
            } catch {
                 # Vercel CLI might return non-zero exit code if var doesn't exist, which PS interprets as error
                 Write-Log "WARN: Command to remove env var finished (might have failed if var didn't exist). Output above. Continuing..."
            }

            Write-Log "Adding new Vercel env var: ${VercelEnvVarName}=${tunnelUrl} ($VercelEnvScope)"
            $addSuccess = $false
            try {
                 & $VercelCliPath env add $VercelEnvVarName $tunnelUrl $VercelEnvScope 2>&1 | Write-Log
                 # Check $LASTEXITCODE specifically for Vercel CLI success
                 if ($LASTEXITCODE -eq 0) {
                    Write-Log "Successfully added new env var."
                    $addSuccess = $true
                 } else {
                    Write-Log "ERROR: Vercel 'env add' command failed with exit code $LASTEXITCODE. Check output above."
                 }
            } catch {
                Write-Log "ERROR: Failed to execute Vercel 'env add' command. Error: $($_.Exception.Message)"
            }

            # Trigger Vercel Deployment only if adding env var succeeded
            if ($addSuccess) {
                 Write-Log "Triggering new Vercel production deployment..."
                 try {
                    & $VercelCliPath deploy --prod --yes 2>&1 | Write-Log
                    if ($LASTEXITCODE -eq 0) {
                        Write-Log "Vercel deployment triggered successfully."
                    } else {
                        Write-Log "ERROR: Vercel 'deploy --prod' command failed with exit code $LASTEXITCODE. Check output above."
                        # Optional: Reset flag if deployment fails?
                        # $script:VercelUpdatedThisRun = $false
                    }
                 } catch {
                     Write-Log "ERROR: Failed to execute Vercel 'deploy --prod' command. Error: $($_.Exception.Message)"
                     # Optional: Reset flag if deployment fails?
                     # $script:VercelUpdatedThisRun = $false
                 }
            } else {
                 Write-Log "Skipping Vercel deployment because adding env var failed."
                 # Optional: Reset flag if adding var failed?
                 # $script:VercelUpdatedThisRun = $false
            }
        }
    }
}

$errorAction = {
    param($sender, $e)
    if (-not [string]::IsNullOrEmpty($e.Data)) {
        Write-Log "[CF_ERR] $($e.Data)" # Log raw cloudflared stderr
        # Can add specific error handling here if needed
    }
}

Register-ObjectEvent -InputObject $process -EventName OutputDataReceived -Action $outputAction -SourceIdentifier CloudflaredOutput
Register-ObjectEvent -InputObject $process -EventName ErrorDataReceived -Action $errorAction -SourceIdentifier CloudflaredError

# 4. Start Cloudflared Process and Monitoring
Write-Log "Launching Cloudflared tunnel process..."
try {
    $process.Start() | Out-Null
    $process.BeginOutputReadLine()
    $process.BeginErrorReadLine()
    Write-Log "Cloudflared process started (PID: $($process.Id)). Monitoring output..."

    # Keep the script running while the process is active
    while (-not $process.HasExited) {
        Start-Sleep -Seconds 5 # Check periodically
    }

    # Process exited
    $exitCode = $process.ExitCode
    Write-Log "Cloudflared process has exited with code $exitCode."

} catch {
    Write-Error "Failed to start Cloudflared process. Path: '$CloudflaredPath'. Arguments: '$arguments'. Error: $($_.Exception.Message)"
    $exitCode = -1 # Indicate failure
} finally {
    # Clean up event registrations
    Unregister-Event -SourceIdentifier CloudflaredOutput -ErrorAction SilentlyContinue
    Unregister-Event -SourceIdentifier CloudflaredError -ErrorAction SilentlyContinue
    if ($process -ne $null) {
        $process.Dispose()
    }
    Write-Log "Wrapper script finished."
    exit $exitCode
}

