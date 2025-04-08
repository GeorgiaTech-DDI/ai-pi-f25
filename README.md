# AI PI

By: Ojasw Upadhyay

## Overview

[AI PI](https://matrix-labs-rag.vercel.app/) is a web-based chat application designed to act as an AI Prototyping Instructor for the Invention Studio at Georgia Tech. It leverages Retrieval-Augmented Generation (RAG) to answer user questions based on a provided knowledge base (stored in Pinecone). The application uses a combination of local and cloud services, including Ollama for local embedding generation (exposed via Cloudflare Tunnel) and OpenRouter with Google's Gemma 3 model for response generation.

## Features

*   **RAG Chat Interface:** Ask questions about the Invention Studio and receive answers generated based on relevant documents.
*   **Streaming Responses:** Answers are streamed token-by-token for a more interactive experience.
*   **Local Embedding Option:** Utilizes a local Ollama instance with a specific embedding model (`jeffh/intfloat-multilingual-e5-large:f16`) exposed via Cloudflare Tunnel for efficient and potentially private embedding generation.
*   **Context References:** View the source document chunks used by the AI to generate its answer.
*   **Feedback Mechanism:** Rate the AI's responses (👍/👎) and provide textual feedback.
*   **Terms of Service:** Users must agree to ToS before using the application.
*   **Chat Management:** Restart the chat session (automatically saves the previous session as text).
*   **Vercel Deployment:** Optimized for deployment on the Vercel platform.

## Architecture

The application follows a modern web architecture:

1.  **Frontend:** A Next.js application using React for the UI components, providing the chat interface. Hosted on Vercel.
2.  **Backend API:** A Next.js API route (`/api/chutes.ts`) running as a Vercel Serverless Function handles the core logic.
3.  **Embedding:**
    *   **Primary:** A local Ollama instance serves the `jeffh/intfloat-multilingual-e5-large:f16` model on `http://localhost:11434`.
    *   **Tunneling:** A `cloudflared` tunnel exposes the local Ollama instance to the internet via a temporary `.trycloudflare.com` URL.
    *   **Dynamic Update:** A script running locally (via `launchd` on macOS) monitors the tunnel, updates the `OLLAMA_URL` environment variable in the *production* Vercel deployment, and triggers a redeploy.
4.  **Vector Database:** Pinecone stores and retrieves document embeddings based on the query embedding similarity.
5.  **Language Model:** OpenRouter routes the request (prompt + context + history) to Google's Gemma 3 model (`google/gemma-3-27b-it:free`) via their "Chutes" provider for final answer generation.
6.  **Response:** The generated answer is streamed back through the API route to the frontend.

## Project Structure

```
.
├── api/                  # Backend API routes (Vercel Serverless Functions)
│   └── chutes.ts         # Handles chat requests, RAG, and LLM interaction
├── components/           # Reusable React components
│   ├── Chat/             # Components for the chat interface
│   ├── Dialogs/          # Modal dialog components (ToS, Feedback, References)
│   ├── Layout.tsx        # Main page layout structure
│   └── types.ts          # TypeScript type definitions
├── pages/                # Next.js page routes
│   ├── _app.js           # Global App component
│   └── index.tsx         # Main chat page component
├── public/               # Static assets (images, favicons)
│   └── images/
│       └── logo.png
├── styles/               # CSS Modules for styling
│   ├── Chat.module.css
│   ├── Dialogs.module.css
│   ├── Layout.module.css
│   └── globals.css
├── utils/                # Utility functions
│   ├── chatUtils.ts      # Functions for saving chat history
│   └── fonts.js          # Font configuration
├── .env.local            # Local environment variables (Gitignored)
├── .gitignore            # Git ignore rules
├── next.config.mjs       # Next.js configuration
├── package.json          # Project dependencies and scripts
├── pnpm-lock.yaml        # PNPM lock file
├── tsconfig.json         # TypeScript configuration
└── README.md             # This file
```

## Setup and Running Locally

### Prerequisites

*   **Node.js:** v22.x or later recommended (check `.nvmrc` if present, or `package.json` engines).
*   **pnpm:** (Recommended) `npm install -g pnpm`. Alternatively, use `npm` or `yarn`.
*   **Ollama:** Install from [ollama.com](https://ollama.com/).
*   **Cloudflare Tunnel (`cloudflared`):** Install from [Cloudflare Docs](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/).
*   **Vercel CLI:** `pnpm install -g vercel` (or `npm`).
*   **Operating System:** macOS is required for the provided `launchd` scripts for the local embedding setup. Linux/Windows users would need alternative methods (e.g., `systemd`, background processes) to run Ollama and the wrapper script persistently.
*   **Git:** For cloning the repository.

### Installation

1.  Clone the repository:
    ```bash
    git clone <repository-url>
    cd aws-rag/frontend
    ```
2.  Install dependencies:
    ```bash
    pnpm install
    ```

### Environment Variables

Create a `.env.local` file in the `aws-rag/frontend` directory and add the following variables:

```toml
# Pinecone Configuration
PINECONE_API_KEY="your_pinecone_api_key"
PINECONE_INDEX_NAME="your_pinecone_index_name" # e.g., rag-embeddings-v2

# Ollama URL (For local dev OR managed by script for production)
# For local development without the tunnel script, point directly:
OLLAMA_URL="http://localhost:11434"
# If using the tunnel script, this will be dynamically updated in Vercel production.

# OpenRouter Configuration
OPENROUTER_API_KEY="your_openrouter_api_key" # Starts with sk-or-...
PUBLIC_SITE_URL="https://your-deployment-url.vercel.app"
# Used for HTTP-Referer header in OpenRouter requests
```

*   Replace placeholder values with your actual keys and URLs.
*   `OLLAMA_URL` is crucial. For simple local testing (`pnpm dev`), setting it to `http://localhost:11434` is sufficient (assuming `ollama serve` is running). The tunnel script specifically updates the *production* environment variable on Vercel.
*   For Vercel production, you can copy all of the environment variables from `.env.local` into the settings page and use the tunnel script to update the `OLLAMA_URL` environment variable on Vercel.

### Running in Development Mode

1.  Ensure Ollama is serving the required model (see next section).
2.  Run the Next.js development server:
    ```bash
    pnpm dev
    ```
3.  Open [http://localhost:3000](http://localhost:3000) in your browser.

In development mode, the application uses the `OLLAMA_URL` defined in `.env.local`. If that URL is unreachable, it will attempt the Hugging Face fallback if configured. The chat component also includes mock streaming for faster UI testing when running locally.

## Local Embedding Model Setup (Ollama + Cloudflared + Vercel Integration - macOS)

This setup allows the *deployed* Vercel application to use your local machine's GPU for generating embeddings via Ollama, exposed securely through a Cloudflare Tunnel.

**Goal:** Run Ollama locally -> Expose Ollama via `cloudflared` -> Automatically update Vercel production environment with the tunnel URL -> Trigger redeploy.

### 1. Ollama Setup

*   **Install Ollama:** If not already done, download and install from [ollama.com](https://ollama.com/).
*   **Run Ollama Service:** The application expects Ollama to be running. The provided `launchd` script handles this persistence on macOS.
    *   Customize the path to the `ollama` binary in `com.user.ollama.serve.plist` if needed.
    *   Place the file: `cp com.user.ollama.serve.plist ~/Library/LaunchAgents/`
    *   Load the service: `launchctl load ~/Library/LaunchAgents/com.user.ollama.serve.plist`
    *   You can check its status: `launchctl list | grep com.user.ollama.serve`
    *   Logs are specified in the plist (`~/Library/Logs/ollama.log`).
*   **Pull Embedding Model:**
    ```bash
    ollama pull jeffh/intfloat-multilingual-e5-large:f16
    ```
    Wait for the download to complete. You can verify Ollama is serving on port 11434 by visiting `http://localhost:11434` in your browser or using `curl http://localhost:11434`.

### 2. Cloudflared Setup

*   **Install `cloudflared`:** Follow instructions [here](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/).
*   **Login (Optional but recommended):** `cloudflared login`. This isn't strictly necessary for ephemeral tunnels used by the script but is good practice.

### 3. Vercel CLI Setup

*   **Install Vercel CLI:** `pnpm install -g vercel` (or `npm i -g vercel`).
*   **Login:** `vercel login` and follow the prompts.
*   **Link Project:** Navigate to the `aws-rag/frontend` directory in your terminal and run:
    ```bash
    vercel link
    ```
    Follow the prompts to link the local directory to your Vercel project. This allows the script to modify environment variables and trigger deployments for the correct project.

### 4. Launchd Wrapper Script Setup (macOS)

This uses the `run_cloudflared_and_update_vercel.sh` script managed by `com.user.cloudflare.tunnel.plist`.

*   **Customize Scripts:**
    *   **`run_cloudflared_and_update_vercel.sh`:**
        *   Verify/update the `PATH` variable if your Node.js/Vercel/Cloudflared installations are in non-standard locations. The provided paths (`~/.nvm`, `/opt/homebrew/bin`) are common for macOS with NVM and Homebrew.
        *   Verify the `cd` command points to your project's `frontend` directory.
        *   Ensure `CLOUDFLARED_BIN` and `VERCEL_BIN` point to the correct executables.
        *   The `VERCEL_ENV_VAR_NAME` (`OLLAMA_URL`) must match the variable used in `api/chutes.ts`.
    *   **`com.user.cloudflare.tunnel.plist`:**
        *   Ensure the path to `run_cloudflared_and_update_vercel.sh` in `<string>/Users/oupadhyay/bin/run_cloudflared_and_update_vercel.sh</string>` is correct for your system.
        *   Customize log file paths (`StandardOutPath`, `StandardErrorPath`) if desired.
*   **Place Files:**
    *   Ensure `run_cloudflared_and_update_vercel.sh` is executable (`chmod +x /path/to/run_cloudflared_and_update_vercel.sh`) and located where the `.plist` file expects it.
    *   Copy the `.plist` file: `cp com.user.cloudflare.tunnel.plist ~/Library/LaunchAgents/`
*   **Load the Service:**
    ```bash
    launchctl load ~/Library/LaunchAgents/com.user.cloudflare.tunnel.plist
    ```
*   **How it Works:**
    1.  `launchd` starts the `.sh` script.
    2.  The script starts `cloudflared tunnel --url http://localhost:11434 ...`.
    3.  The script reads `cloudflared`'s output line-by-line.
    4.  When it detects a line containing the `.trycloudflare.com` URL, it extracts the URL.
    5.  It uses `vercel env rm OLLAMA_URL production --yes` to remove the old variable from Vercel (handles cases where it doesn't exist).
    6.  It uses `echo "$TUNNEL_URL" | vercel env add OLLAMA_URL production` to add the new tunnel URL to Vercel's production environment.
    7.  It runs `vercel deploy --prod --yes` to trigger a new production deployment using the updated environment variable.
    8.  `launchd`'s `KeepAlive` setting ensures the script (and thus the tunnel) restarts if it crashes.
*   **Monitoring:** Check the log files specified in the `.plist` (`~/Library/Logs/cloudflared_wrapper.log` and `.err`) for output and errors from the script and `cloudflared`.

With this setup, whenever the wrapper script starts (on load, or if it restarts), it establishes a tunnel to your local Ollama and updates your live Vercel deployment to use it.

## Deployment

This project is designed for deployment on [Vercel](https://vercel.com/).

1.  **Push to Git:** Ensure your code is pushed to a Git repository (GitHub, GitLab, Bitbucket).
2.  **Import Project:** Import the Git repository into Vercel.
3.  **Configure Environment Variables:** In the Vercel project settings, add the necessary environment variables (from the `.env.local` section) for the **Production** environment.
    *   `PINECONE_API_KEY`, `PINECONE_INDEX_NAME`, `OPENROUTER_API_KEY`, `PUBLIC_SITE_URL`.
    *   Add `HF_API_URL` and `HF_API_KEY` if you want the Hugging Face fallback.
    *   **Important:** The `OLLAMA_URL` variable for the *Production* environment will be managed by the local `run_cloudflared_and_update_vercel.sh` script described above. You can initially leave it unset or set it to a placeholder; the script will overwrite it when it runs successfully.
4.  **Deploy:** Vercel will typically build and deploy automatically upon pushes to the main branch (or as configured). The local script will then trigger subsequent deployments when the tunnel URL is updated.

## API Endpoint (`/api/chutes`)

The core backend logic resides in `pages/api/chutes.ts`. It performs the following steps:

1.  Receives the user's question and chat history.
2.  Checks if the `OLLAMA_URL` (likely pointing to the Cloudflare tunnel) is available.
3.  **Embedding:**
    *   If Ollama is available, sends the question to the local Ollama instance for embedding using the `jeffh/intfloat-multilingual-e5-large:f16` model.
    *   If Ollama is unavailable, sends the question to the configured Hugging Face API endpoint (`HF_API_URL`) using the `HF_API_KEY`.
4.  **Vector Search:** Queries the Pinecone index (`PINECONE_INDEX_NAME`) with the generated embedding to find the `topK` relevant document chunks.
5.  **Context Construction:** Formats the retrieved document chunks into a context string.
6.  **LLM Call:** Creates a prompt including the system message, context, chat history, and current question. Sends this prompt to OpenRouter (`https://openrouter.ai/api/v1/chat/completions`) targeting the `google/gemma-3-27b-it:free` model via the "Chutes" provider, requesting a streaming response.
7.  **Streaming Response:** Pipes the streaming response from OpenRouter back to the frontend client. Handles different event types (context data, tokens, errors, done signal).

## Technologies Used

*   **Framework:** Next.js 15
*   **Language:** TypeScript
*   **UI Library:** React 19
*   **Styling:** CSS Modules
*   **Vector Database:** Pinecone
*   **Embedding Models:**
    *   Ollama (`jeffh/intfloat-multilingual-e5-large:f16`) - Local/Primary
*   **Tunneling:** Cloudflare Tunnel (`cloudflared`)
*   **LLM Provider:** OpenRouter
*   **LLM:** Google Gemma 3 (`google/gemma-3-27b-it:free`)
*   **Deployment:** Vercel
*   **Package Manager:** pnpm (adapt commands for npm/yarn if needed)
*   **Process Management (macOS):** `launchd`

## Legal Notices

*   **Gemma 3 Model:** This application utilizes the `google/gemma-3-27b-it` model accessed via OpenRouter. Use of Gemma models is subject to Google's official terms. Please review the [Gemma Terms of Use](https://ai.google.dev/gemma/terms). Key aspects include:
    *   Restrictions on prohibited uses (illegal activities, harassment, misinformation, etc.).
    *   Limitations on commercial use with the `:free` tag on OpenRouter implies adherence to Google's standard non-commercial or limited commercial terms.
    *   Requirement to follow safety guidelines and potential need to display notices about AI-generated content.
*   **AI Disclaimer:** AI-generated responses may contain inaccuracies or errors. The AI has limited knowledge and may not be aware of very recent events or specific nuances not present in its training data or the provided context documents. Always verify critical information from official sources.
*   **Data Privacy:** As outlined in the Terms of Service dialog, user interactions may be logged for improvement purposes. Avoid sharing sensitive personal information.
