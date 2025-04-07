#!/bin/sh

# --- Configuration ---
export PATH="PATH/TO/node/VERSION/bin:/PATH/TO/homebrew/bin:/usr/local/bin:/usr/bin:/bin"
cd "/PATH/TO/aws-rag/frontend" || { echo "Failed to change directory"; exit 1; }
# Paths to executables (replace if necessary, but use provided ones)
CLOUDFLARED_BIN="/PATH/TO/homebrew/bin/cloudflared"
VERCEL_BIN="PATH/TO/node/VERSION/bin/vercel"
GREP_BIN="/usr/bin/grep"
TEE_BIN="/usr/bin/tee"
RM_BIN="/bin/rm"
# 'echo' is typically a shell built-in, so no path needed unless specific version required

# Vercel Configuration
VERCEL_ENV_VAR_NAME="OLLAMA_URL"

# Log file for cloudflared output
CLOUDFLARED_LOG_FILE="PATH/TO/Library/Logs/cloudflared.log"

# --- State ---
# Flag to ensure Vercel update happens only once per tunnel restart
VERCEL_UPDATED_THIS_RUN=0

# --- Logging function ---
log_message() {
    # Using 'echo' directly as it's likely a shell built-in
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $$ - $1"
}

# --- Main Execution ---
log_message "Starting cloudflared wrapper script."
log_message "Cloudflared log file: ${CLOUDFLARED_LOG_FILE}"
log_message "Vercel env var: ${VERCEL_ENV_VAR_NAME}"

# Run cloudflared, pipe output to tee (for logging) and then process line by line
"${CLOUDFLARED_BIN}" tunnel --url http://localhost:11434 --http-host-header="localhost:11434" 2>&1 | \
"${TEE_BIN}" -a "${CLOUDFLARED_LOG_FILE}" | \
while IFS= read -r line; do
    # Print the line to the launchd log for this script
    echo "${line}"

    # Check for the Cloudflare tunnel URL and if we haven't updated Vercel yet in this run
    # Regex: Look for 'https://' followed by anything not a space, ending in '.trycloudflare.com'
    if echo "${line}" | "${GREP_BIN}" -qE 'https://[[:alnum:]-]+-[[:alnum:]-]+-[[:alnum:]-]+-[[:alnum:]-]+\.trycloudflare\.com' && [ "${VERCEL_UPDATED_THIS_RUN}" -eq 0 ]; then
        TUNNEL_URL=$(echo "${line}" | "${GREP_BIN}" -oE 'https://[[:alnum:]-]+-[[:alnum:]-]+-[[:alnum:]-]+-[[:alnum:]-]+\.trycloudflare\.com')

        if [ -n "${TUNNEL_URL}" ]; then
            log_message "Detected tunnel URL: ${TUNNEL_URL}"
            VERCEL_UPDATED_THIS_RUN=1 # Set flag to prevent re-running Vercel commands for this instance

            # Update Vercel environment variable
            log_message "Removing old Vercel env var: ${VERCEL_ENV_VAR_NAME}"
            if "${VERCEL_BIN}" env rm "${VERCEL_ENV_VAR_NAME}" production --yes; then
                log_message "Successfully removed old env var (or it didn't exist)."
            else
                log_message "Failed to remove old env var (or it didn't exist - exit code $?). Continuing..."
            fi

            log_message "Adding new Vercel env var: ${VERCEL_ENV_VAR_NAME}=${TUNNEL_URL}"
            if echo "${TUNNEL_URL}" | "${VERCEL_BIN}" env add "${VERCEL_ENV_VAR_NAME}" production; then
                log_message "Successfully added new env var."

                # Trigger a new Vercel deployment
                log_message "Triggering new Vercel production deployment..."
                if "${VERCEL_BIN}" deploy --prod --yes; then
                    log_message "Vercel deployment triggered successfully."
                else
                    log_message "ERROR: Vercel deployment command failed (exit code $?)."
                    # Reset flag maybe? Or decide how to handle failure. For now, just log.
                fi
            else
                log_message "ERROR: Failed to add new Vercel env var (exit code $?). Deployment skipped."
                # Reset flag?
            fi
        else
             log_message "Failed to extract URL from line: ${line}"
        fi
    fi
done

# If the loop exits, it means cloudflared stopped. Log this.
# launchd KeepAlive will restart the script if cloudflared exits non-zero
EXIT_CODE=$?
log_message "cloudflared process has exited with code ${EXIT_CODE}. Exiting wrapper script."
exit ${EXIT_CODE}
