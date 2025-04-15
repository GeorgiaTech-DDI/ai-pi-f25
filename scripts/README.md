# Windows Script Setup

## **1. Installation Instructions**

You'll need to install Ollama, Cloudflared, and Node.js/Vercel on your Windows machine.

*   **Ollama:**
    1.  Go to [https://ollama.com/](https://ollama.com/)
    2.  Download the Windows installer.
    3.  Run the installer. It typically installs to `C:\Users\YourUser\AppData\Local\Programs\Ollama\ollama.exe`. Note this path. It might ask if you want it to run on startup - you can let it, or use the Task Scheduler method below for more control.
*   **Cloudflared:**
    1.  Go to the Cloudflare Zero Trust downloads page or [https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/).
    2.  Download the 64-bit Windows `.msi` installer or `.exe`.
    3.  Run the installer. It often installs to `C:\Program Files\Cloudflared\cloudflared.exe`. Note this path.
*   **Node.js and Vercel CLI:**
    1.  Go to [https://nodejs.org/](https://nodejs.org/).
    2.  Download the LTS (Long Term Support) version installer for Windows.
    3.  Run the installer (this includes `npm`, the Node Package Manager). Accept defaults unless you have specific needs.
    4.  Open a Command Prompt (`cmd.exe`) or PowerShell **as Administrator**.
    5.  Install the Vercel CLI globally by running: `npm install -g vercel`
    6.  Find the Vercel installation path. Usually, global npm packages on Windows are installed in `%APPDATA%\npm`. So the Vercel command might be `C:\Users\YourUser\AppData\Roaming\npm\vercel.cmd`. You can check by running `where vercel` in the command prompt. Note this path.

## **2. Create the Windows Batch Script**

This script replicates the logic of your `run_cloudflared_and_update_vercel.sh`.

*   **Create the file:** `aws-rag\frontend\scripts\run_cloudflared_and_update_vercel.bat`
*   **Contents:** Copy and paste the following code into the file. **Crucially, you MUST update the placeholder paths** in the `--- Configuration ---` section with the actual paths where you installed the tools and where your project/logs reside on Windows.

## **3. Setup Windows Scheduled Tasks**

You'll create two tasks using the Windows Task Scheduler to replicate the `launchd` services. You will likely need Administrator privileges.

*   **Open Task Scheduler:** Search for "Task Scheduler" in the Start Menu and open it.
*   **Click "Create Task..."** (in the right-hand Actions pane). Do *not* use "Create Basic Task" as you need more options.

### **Task 1: Ollama Serve**

1.  **General Tab:**
    *   Name: `Ollama Serve Background`
    *   Description: `Runs the ollama serve command.`
    *   Select `Run whether user is logged on or not`.
    *   Check `Run with highest privileges`.
2.  **Triggers Tab:**
    *   Click `New...`.
    *   Begin the task: `At startup`.
    *   Click `OK`.
3.  **Actions Tab:**
    *   Click `New...`.
    *   Action: `Start a program`.
    *   Program/script: Enter the **full path** to `cmd.exe` (usually `C:\Windows\System32\cmd.exe`).
    *   Add arguments (optional):
        ```
        /c ""C:\Users\YourUser\AppData\Local\Programs\Ollama\ollama.exe" serve > "C:\Users\YourUser\Logs\ollama_task.log" 2>&1"
        ```
        *   **Replace** the paths to `ollama.exe` and your desired log file path.
        *   The `/c` tells `cmd.exe` to run the command and then terminate. The quotes handle spaces in paths. This redirects Ollama's output to a log file, similar to the plist.
4.  **Conditions Tab:**
    *   Review the default settings. You might want to uncheck "Stop if the computer switches to battery power" if running on a laptop.
5.  **Settings Tab:**
    *   Check `Allow task to be run on demand`.
    *   Check `Run task as soon as possible after a scheduled start is missed`.
    *   Check `If the task fails, restart every:` and set it to `1 minute` (this mimics `KeepAlive`). Set `Attempt to restart up to:` to a high number (e.g., `999`).
    *   Uncheck `Stop the task if it runs longer than:`.
    *   If the task is already running: `Do not start a new instance`.
6.  **Click `OK`.** It may ask for your user password to grant the necessary permissions.

### **Task 2: Cloudflared Tunnel and Vercel Update Wrapper**

1.  **General Tab:**
    *   Name: `Cloudflared Tunnel Vercel Wrapper`
    *   Description: `Runs the cloudflared tunnel via a wrapper script that updates Vercel.`
    *   Select `Run whether user is logged on or not`.
    *   Check `Run with highest privileges`.
2.  **Triggers Tab:**
    *   Click `New...`.
    *   Begin the task: `At startup`.
    *   **Optional but recommended:** Check `Delay task for:` and set it to `1 minute`. This gives the system and network time to initialize before starting the tunnel.
    *   Click `OK`.
3.  **Actions Tab:**
    *   Click `New...`.
    *   Action: `Start a program`.
    *   Program/script: Enter the **full path** to `cmd.exe` (usually `C:\Windows\System32\cmd.exe`).
    *   Add arguments (optional):
        ```
        /c ""C:\path\to\your\aws-rag\frontend\scripts\run_cloudflared_and_update_vercel.bat" > "C:\Users\YourUser\Logs\cloudflared_wrapper_task.log" 2>&1"
        ```
        *   **Replace** the path to your `.bat` script and your desired log file path.
        *   This runs your batch script and redirects *its* primary output (including the `echo %%L` lines and your `log_message` calls) to a log file. The batch script itself handles logging the raw `cloudflared` output separately if configured.
4.  **Conditions Tab:**
    *   Review defaults, consider unchecking battery power option if applicable.
5.  **Settings Tab:**
    *   Check `Allow task to be run on demand`.
    *   Check `Run task as soon as possible after a scheduled start is missed`.
    *   Check `If the task fails, restart every:` and set it to `1 minute`. Set `Attempt to restart up to:` to `999`.
    *   Uncheck `Stop the task if it runs longer than:`.
    *   If the task is already running: `Do not start a new instance`.
6.  **Click `OK`.** Enter password if prompted.

Now, after restarting your computer (or manually starting the tasks from Task Scheduler), Ollama and the Cloudflared tunnel wrapper should run automatically in the background. Remember to check the log files you specified (`ollama_task.log`, `cloudflared_wrapper_task.log`, and `cloudflared_output.log` inside the batch script's configured log dir) for errors or status updates.
