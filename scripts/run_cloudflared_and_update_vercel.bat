@echo off
setlocal enabledelayedexpansion

REM --- Configuration (IMPORTANT: UPDATE THESE PATHS!) ---
set "PROJECT_DIR=C:\path\to\your\aws-rag\frontend"REM Set the full path to the frontend directory
set "CLOUDFLARED_BIN=C:\Program Files\Cloudflared\cloudflared.exe"REM Set the full path to cloudflared.exe
set "VERCEL_BIN=C:\Users\YourUser\AppData\Roaming\npm\vercel.cmd"REM Set the full path to vercel.cmd (check with 'where vercel')
set "LOG_DIR=C:\Users\YourUser\Logs"REM Set the desired directory for logs
set "CLOUDFLARED_OUTPUT_LOG=%LOG_DIR%\cloudflared_output.log"REM Log for raw cloudflared stdout/stderr

REM Vercel Configuration
set "VERCEL_ENV_VAR_NAME=OLLAMA_URL"
set "VERCEL_ENV_SCOPE=production"

REM --- State ---
set VERCEL_UPDATED_THIS_RUN=0

goto Main

REM --- Logging function ---
:log_message
echo %DATE% %TIME% - %~1
goto :eof

REM --- Main Execution ---
:Main
call :log_message "Starting cloudflared wrapper script."

REM Create Logs directory if it doesn't exist
if not exist "%LOG_DIR%" (
    mkdir "%LOG_DIR%"
    call :log_message "Created log directory: %LOG_DIR%"
)

call :log_message "Starting cloudflared wrapper script."
call :log_message "Cloudflared output will be logged to: %CLOUDFLARED_OUTPUT_LOG%"
call :log_message "Vercel env var: %VERCEL_ENV_VAR_NAME% (%VERCEL_ENV_SCOPE%)"

REM Change to the project directory
cd /D "%PROJECT_DIR%" || (
    call :log_message "ERROR: Failed to change directory to %PROJECT_DIR%. Exiting."
    exit /b 1
)
call :log_message "Working directory set to: %PROJECT_DIR%"

REM Run cloudflared, capture its output line by line
call :log_message "Launching cloudflared tunnel..."
FOR /F "usebackq delims=" %%L IN (`""%CLOUDFLARED_BIN%" tunnel --url http://localhost:11434 --http-host-header="localhost:11434" --no-autoupdate 2>&1"`) DO (
    REM Echo cloudflared's output to our main log file and also process it
    echo %%L>> "%CLOUDFLARED_OUTPUT_LOG%"
    echo %%L

    REM Check for the Cloudflare tunnel URL using findstr (basic regex)
    echo %%L | findstr /R /C:"https://[-a-z0-9]*\.trycloudflare\.com" > nul
    if !ERRORLEVEL! == 0 (
        if %VERCEL_UPDATED_THIS_RUN% == 0 (
            call :log_message "Detected line possibly containing tunnel URL: %%L"

            REM Basic extraction: assumes URL is the first 'word' on the line matching the pattern
            set "TUNNEL_URL="
            for /f "tokens=1 delims= " %%U in ('echo %%L ^| findstr /R /C:"https://[-a-z0-9]*\.trycloudflare\.com"') do (
                 set "POTENTIAL_URL=%%U"
                 REM Further check if the extracted part looks like the URL
                 echo !POTENTIAL_URL! | findstr /R /B /E /C:"https://[-a-z0-9]*\.trycloudflare\.com" > nul
                 if !ERRORLEVEL! == 0 (
                     set "TUNNEL_URL=!POTENTIAL_URL!"
                 )
            )

            if defined TUNNEL_URL (
                call :log_message "Successfully extracted tunnel URL: %TUNNEL_URL%"
                set VERCEL_UPDATED_THIS_RUN=1 REM Set flag

                REM Update Vercel environment variable
                call :log_message "Removing old Vercel env var: %VERCEL_ENV_VAR_NAME% (%VERCEL_ENV_SCOPE%)"
                "%VERCEL_BIN%" env rm %VERCEL_ENV_VAR_NAME% %VERCEL_ENV_SCOPE% --yes
                if !ERRORLEVEL! == 0 (
                    call :log_message "Successfully removed old env var (or it didn't exist)."
                ) else (
                    call :log_message "WARN: Failed to remove old env var (or it didn't exist - exit code !ERRORLEVEL!). Continuing..."
                )

                call :log_message "Adding new Vercel env var: %VERCEL_ENV_VAR_NAME%=%TUNNEL_URL% (%VERCEL_ENV_SCOPE%)"
                "%VERCEL_BIN%" env add %VERCEL_ENV_VAR_NAME% %TUNNEL_URL% %VERCEL_ENV_SCOPE%
                if !ERRORLEVEL! == 0 (
                    call :log_message "Successfully added new env var."

                    REM Trigger a new Vercel deployment
                    call :log_message "Triggering new Vercel production deployment..."
                    "%VERCEL_BIN%" deploy --prod --yes
                    if !ERRORLEVEL! == 0 (
                        call :log_message "Vercel deployment triggered successfully."
                    ) else (
                        call :log_message "ERROR: Vercel deployment command failed (exit code !ERRORLEVEL!)."
                        REM Consider resetting VERCEL_UPDATED_THIS_RUN=0 here if you want it to retry on next URL detection
                    )
                ) else (
                    call :log_message "ERROR: Failed to add new Vercel env var (exit code !ERRORLEVEL!). Deployment skipped."
                    REM Consider resetting VERCEL_UPDATED_THIS_RUN=0 here
                )
            ) else (
                 call :log_message "WARN: Failed to extract a valid URL from the detected line. Vercel update skipped for this line."
            )
        )
    )
)

REM If the FOR loop finishes, cloudflared has stopped.
set CLOUDFLARED_EXIT_CODE=%ERRORLEVEL%
call :log_message "cloudflared process has exited. Wrapper script finishing with code %CLOUDFLARED_EXIT_CODE%."
exit /b %CLOUDFLARED_EXIT_CODE%

endlocal
