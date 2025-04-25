#!/bin/sh
# Exit script if any command in a pipe fails
set -o pipefail

# --- Configuration ---
export PATH="/Users/oupadhyay/.nvm/versions/node/v22.14.0/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"
cd "/Users/oupadhyay/Downloads/university/ecs.uni/vip-smart3/spring2025/aws-rag/frontend" || { echo "Failed to change directory"; exit 1; }
# Paths to executables
CLOUDFLARED_BIN="/opt/homebrew/bin/cloudflared"
VERCEL_BIN="/Users/oupadhyay/.nvm/versions/node/v22.14.0/bin/vercel"
GREP_BIN="/usr/bin/grep"
TEE_BIN="/usr/bin/tee"
RM_BIN="/bin/rm"

# Vercel Configuration
VERCEL_ENV_VAR_NAME="OLLAMA_URL"

# Log file for cloudflared output
CLOUDFLARED_LOG_FILE="/Users/oupadhyay/Library/Logs/cloudflared.log"

# --- State ---
VERCEL_UPDATED_THIS_RUN=0
FAILURE_COUNT=0
# Exit after this many consecutive relevant errors without a success indicator
# Adjust this value based on how tolerant you want to be of temporary glitches
MAX_FAILURES=10

# --- Logging function ---
log_message() {
    # Using 'echo' directly as it's likely a shell built-in
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $$ - $1"
}

# --- Main Execution ---
log_message "Starting cloudflared wrapper script."
log_message "Cloudflared log file: ${CLOUDFLARED_LOG_FILE}"
log_message "Vercel env var: ${VERCEL_ENV_VAR_NAME}"
log_message "Failure threshold: ${MAX_FAILURES} consecutive 'context canceled' errors."

# Run cloudflared, pipe output to tee (for logging) and then process line by line
# The '2>&1' redirects stderr to stdout so the pipe catches errors
"${CLOUDFLARED_BIN}" tunnel --url http://localhost:11434 --http-host-header="localhost:11434" 2>&1 | \
"${TEE_BIN}" -a "${CLOUDFLARED_LOG_FILE}" | \
while IFS= read -r line; do
    # Print the line to the launchd log for this script (stdout)
    # This is useful for debugging the script itself via cloudflared_wrapper.log
    echo "${line}"

    # --- Reset failure counter on success indicators ---
    # Look for lines indicating a healthy connection or successful (re)start
    if echo "${line}" | "${GREP_BIN}" -qE 'INF Registered tunnel connection|INF.* Your quick Tunnel has been created|INF Requesting new quick Tunnel'; then
        if [ "${FAILURE_COUNT}" -gt 0 ]; then
             log_message "Success/Restart indicator detected, resetting failure count."
             FAILURE_COUNT=0
        fi
    fi

    # --- Detect tunnel URL and update Vercel (only once per script run) ---
    # Check VERCEL_UPDATED_THIS_RUN *before* trying to extract URL
    if [ "${VERCEL_UPDATED_THIS_RUN}" -eq 0 ]; then
        # Extract the tunnel URL using grep
        TUNNEL_URL=$(echo "${line}" | "${GREP_BIN}" -oE 'https://[[:alnum:]-]+-[[:alnum:]-]+-[[:alnum:]-]+-[[:alnum:]-]+\.trycloudflare\.com')

        if [ -n "${TUNNEL_URL}" ]; then
            log_message "Detected tunnel URL: ${TUNNEL_URL}"
            VERCEL_UPDATED_THIS_RUN=1 # Set flag immediately

            # --- Vercel Update Logic ---
            log_message "Removing old Vercel env var: ${VERCEL_ENV_VAR_NAME}"
            if "${VERCEL_BIN}" env rm "${VERCEL_ENV_VAR_NAME}" production --yes; then
                log_message "Successfully removed old env var (or it didn't exist)."
            else
                # Log non-zero exit code but continue, as the var might not exist
                log_message "Failed to remove old env var (or it didn't exist - exit code $?). Continuing..."
            fi

            log_message "Adding new Vercel env var: ${VERCEL_ENV_VAR_NAME}=${TUNNEL_URL}"
            # Pipe the URL to the command's stdin, required by 'vercel env add'
            if echo "${TUNNEL_URL}" | "${VERCEL_BIN}" env add "${VERCEL_ENV_VAR_NAME}" production; then
                log_message "Successfully added new env var."
                FAILURE_COUNT=0 # Reset failures after successful Vercel update

                log_message "Triggering new Vercel production deployment..."
                if "${VERCEL_BIN}" deploy --prod --yes; then
                    log_message "Vercel deployment triggered successfully."
                else
                    # Log error but don't exit the script, let cloudflared continue
                    log_message "ERROR: Vercel deployment command failed (exit code $?). Continuing tunnel."
                    # Consider if you *want* to exit here or retry Vercel later
                fi
            else
                log_message "ERROR: Failed to add new Vercel env var (exit code $?). Deployment skipped."
                # If adding the var fails, maybe we should exit? For now, log and continue.
                # Consider exiting here: exit 1
            fi
            # --- End Vercel Update Logic ---
        fi
    fi

    # --- Check for the specific failure pattern ---
    # Look for the "context canceled" errors that indicate the persistent retry loop
    if echo "${line}" | "${GREP_BIN}" -qE 'ERR.*(Failed to serve tunnel connection|Connection terminated).*error=\"context canceled\"'; then
        FAILURE_COUNT=$((FAILURE_COUNT + 1))
        log_message "Detected 'context canceled' failure pattern. Count: ${FAILURE_COUNT}/${MAX_FAILURES}"

        if [ "${FAILURE_COUNT}" -ge "${MAX_FAILURES}" ]; then
            log_message "Maximum failure count (${MAX_FAILURES}) reached. Exiting script to force restart via launchd."
            # Kill the cloudflared process group explicitly before exiting to ensure cleanup
            # This assumes cloudflared is the immediate child of the script in the pipe
            pkill -P $$ "${CLOUDFLARED_BIN}" 2>/dev/null || true
            sleep 1 # Give a moment for cleanup
            exit 1 # Exit the script; launchd KeepAlive will restart it.
        fi
    # Add checks for other potentially fatal errors that should trigger an immediate restart
    # elif echo "${line}" | "${GREP_BIN}" -qE 'ERR.*(Unable to establish connection|authentication error|Tunnel credentials file.*not found)'; then
    #    log_message "Detected potentially fatal error: ${line}. Exiting script."
    #    pkill -P $$ "${CLOUDFLARED_BIN}" 2>/dev/null || true
    #    sleep 1
    #    exit 1
    fi

done

# --- Script Exit ---
# If the 'while read' loop finishes, it means the pipe from cloudflared/tee broke.
# Thanks to 'set -o pipefail', $? will reflect the exit status of the failed command (likely cloudflared).
EXIT_CODE=$?
log_message "Pipe exited. Final exit code: ${EXIT_CODE}. Exiting wrapper script."
# If cloudflared exited with 0 (e.g., manual stop), this script exits with 0.
# If cloudflared (or tee) exited non-zero, this script exits non-zero.
# launchd's KeepAlive=true should restart the script if EXIT_CODE is non-zero.
exit ${EXIT_CODE}
