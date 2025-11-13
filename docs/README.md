# AI PI

By: Ojasw Upadhyay  
**Azure AD Authentication Migration**: Implemented by chenastn

## Overview

[AI PI](https://matrix-labs-rag.vercel.app/) is a web-based chat application designed to act as an AI Prototyping Instructor for the Invention Studio at Georgia Tech. It leverages Retrieval-Augmented Generation (RAG) to answer user questions based on a provided knowledge base (stored in Pinecone). The application features a **secure Firebase-authenticated admin portal** for administrative functions and uses a combination of local and cloud services, including Ollama for local embedding generation (exposed via Cloudflare Tunnel) and OpenRouter with Google's Gemma 3 model for response generation.

## Features

### 🤖 **AI Chat System**
*   **RAG Chat Interface:** Ask questions about the Invention Studio and receive answers generated based on relevant documents.
*   **Streaming Responses:** Answers are streamed token-by-token for a more interactive experience.
*   **Local Embedding Option:** Utilizes a local Ollama instance with a specific embedding model (`jeffh/intfloat-multilingual-e5-large:f16`) exposed via Cloudflare Tunnel for efficient and potentially private embedding generation.
*   **Context References:** View the source document chunks used by the AI to generate its answer.
*   **Feedback Mechanism:** Rate the AI's responses (👍/👎) and provide textual feedback.
*   **Terms of Service:** Users must agree to ToS before using the application.
*   **Chat Management:** Restart the chat session (automatically saves the previous session as text).

### 🔐 **Admin Portal & Authentication**
*   **Azure AD (Microsoft Entra ID):** Secure Microsoft sign-in for admin access
*   **Protected Admin Dashboard:** Real-time authentication state with automatic redirects
*   **Global Auth Context:** React Context API for seamless authentication state management
*   **Secure Route Protection:** Admin-only pages with Firebase auth state validation
*   **Environment Variable Security:** All credentials stored in gitignored `.env` files
*   **Production-Ready Security:** No hardcoded secrets, comprehensive security audit passed

### 🚀 **Deployment & Infrastructure**
*   **Vercel Deployment:** Optimized for deployment on the Vercel platform.
*   **Firebase Integration:** Enterprise-grade authentication with Google's security infrastructure
*   **Modern React Architecture:** Next.js 15 with TypeScript and React 19

## Architecture

The application follows a modern web architecture with two main systems:

### 🤖 **AI Chat System**
1.  **Frontend:** A Next.js application using React for the UI components, providing the chat interface. Hosted on Vercel.
2.  **Backend API:** A Next.js API route (`/api/chutes.ts`) running as a Vercel Serverless Function handles the core logic.
3.  **Embedding:**
    *   **Primary:** A local Ollama instance serves the `jeffh/intfloat-multilingual-e5-large:f16` model on `http://localhost:11434`.
    *   **Tunneling:** A `cloudflared` tunnel exposes the local Ollama instance to the internet via a temporary `.trycloudflare.com` URL.
    *   **Dynamic Update:** A script running locally (via `launchd` on macOS) monitors the tunnel, updates the `OLLAMA_URL` environment variable in the *production* Vercel deployment, and triggers a redeploy.
4.  **Vector Database:** Pinecone stores and retrieves document embeddings based on the query embedding similarity.
5.  **Language Model:** OpenRouter routes the request (prompt + context + history) to Google's Gemma 3 model (`google/gemma-3-27b-it:free`) via their "Chutes" provider for final answer generation.
6.  **Response:** The generated answer is streamed back through the API route to the frontend.

### 🔐 **Admin Authentication System**
1.  **Azure AD (MSAL):** Microsoft Entra ID handles user authentication via MSAL
2.  **Auth Context Provider:** React Context API provides global authentication state across the application
3.  **Protected Routes:** Higher-order component (`ProtectedRoute`) secures admin pages with automatic redirects
4.  **Real-time Auth State:** Firebase `onAuthStateChanged` listener provides instant authentication updates
5.  **Secure Configuration:** Environment variables in `.env` files (gitignored) store Firebase credentials
6.  **Admin Dashboard:** Protected administrative interface accessible only to authenticated users

## Project Structure

```
.
├── api/                       # Backend API routes (Vercel Serverless Functions)
│   └── chutes.ts             # Handles chat requests, RAG, and LLM interaction
├── components/               # Reusable React components
│   ├── Chat/                 # Components for the chat interface
│   ├── Dialogs/              # Modal dialog components (ToS, Feedback, References)
│   ├── Layout.tsx            # Main page layout structure
│   ├── ProtectedRoute.js     # 🔐 Higher-order component for route protection
│   └── types.ts              # TypeScript type definitions
├── context/                  # React Context providers
│   └── AuthContext.js        # 🔐 MSAL authentication state management
├── lib/                      # Core library functions
│   └── msal.ts               # 🔐 MSAL configuration and initialization
├── pages/                    # Next.js page routes
│   ├── admin/                # 🔐 Protected admin section
│   │   ├── dashboard.tsx     # Admin dashboard (Firebase protected)
│   │   └── login.tsx         # Firebase authentication login page
│   ├── _app.js               # Global App component with AuthProvider
│   └── index.tsx             # Main chat page component
├── public/                   # Static assets (images, favicons)
│   ├── images/
│   │   └── logo.svg
│   └── favicon.ico
├── scripts/                  # Utility scripts and configuration
│   ├── env-template.txt      # Environment variables template
│   ├── launchd/              # macOS service configurations
│   └── [cloudflare scripts]  # Cloudflare tunnel automation
├── styles/                   # CSS Modules for styling
│   ├── Chat.module.css
│   ├── Dashboard.module.css  # 🔐 Admin dashboard styles
│   ├── Dialogs.module.css
│   ├── Layout.module.css
│   ├── Login.module.css      # 🔐 Firebase login page styles
│   └── globals.css
├── utils/                    # Utility functions
│   ├── chatUtils.ts          # Functions for saving chat history
│   └── fonts.js              # Font configuration
├── .env                      # 🔐 Environment variables (Gitignored)
├── .gitignore                # Git ignore rules
├── AUTHENTICATION_ROADMAP.md # 🔐 Firebase migration documentation
├── package.json              # Project dependencies and scripts
├── pnpm-lock.yaml            # PNPM lock file
├── tsconfig.json             # TypeScript configuration
└── README.md                 # This file
```

### 🔐 **Authentication System Components**

- **`lib/msal.ts`**: MSAL configuration and initialization
- **`context/AuthContext.js`**: Global authentication state provider
- **`components/ProtectedRoute.js`**: Route protection wrapper component
- **`pages/admin/login.tsx`**: Microsoft sign-in login interface
- **`pages/admin/dashboard.tsx`**: Protected admin dashboard

## Setup and Running Locally

### Prerequisites

#### **Core Requirements**
*   **Node.js:** v22.x or later recommended (check `.nvmrc` if present, or `package.json` engines).
*   **pnpm:** (Recommended) `npm install -g pnpm`. Alternatively, use `npm` or `yarn`.
*   **Git:** For cloning the repository.

#### **🔐 Azure AD Authentication Setup**
*   **Azure Account:** Access to Azure portal and Microsoft Entra ID
*   **App Registration:** Register a SPA app and configure authentication

#### **🤖 AI Chat System (Optional)**
*   **Ollama:** Install from [ollama.com](https://ollama.com/).
*   **Cloudflare Tunnel (`cloudflared`):** Install from [Cloudflare Docs](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/).
*   **Vercel CLI:** `pnpm install -g vercel` (or `npm`).
*   **Operating System:** macOS is required for the provided `launchd` scripts for the local embedding setup. Linux/Windows users would need alternative methods (e.g., `systemd`, background processes) to run Ollama and the wrapper script persistently.

### Installation

1.  Clone the repository:
    ```bash
    git clone https://github.com/chenastn/matrix-labs-rag.git
    cd matrix-labs-rag
    ```
2.  Install dependencies:
    ```bash
    pnpm install
    ```

### 🔐 Azure AD Authentication Setup

Before running the application, you need to set up Azure AD Authentication:

#### **Step 1: Register App in Azure**

1. Go to `https://portal.azure.com` → Microsoft Entra ID → App registrations
2. Click "New registration"
3. Name: "AI PI Admin"
4. Supported account types: Select your tenant or multi-tenant as needed
5. Redirect URI: Single-page application (SPA) → `http://localhost:3000`
6. Register and note the Application (client) ID and Directory (tenant) ID

#### **Step 2: Configure Authentication**

1. In your app registration → "Authentication"
2. Add platform: Single-page application
3. Add redirect URIs for local and production
4. Enable "Access tokens" and "ID tokens"
5. Save

### Environment Variables

Create a `.env` file in the project root directory and add the following variables:

```bash
# 🔐 Azure AD (MSAL) Configuration (Required for Admin Authentication)
NEXT_PUBLIC_AZURE_AD_TENANT_ID=your_tenant_id
NEXT_PUBLIC_AZURE_AD_CLIENT_ID=your_app_client_id
NEXT_PUBLIC_AZURE_AD_REDIRECT_URI=http://localhost:3000
NEXT_PUBLIC_AZURE_AD_POST_LOGOUT_REDIRECT_URI=http://localhost:3000

# 🤖 AI Chat System Configuration (Optional)
# Pinecone Configuration
PINECONE_API_KEY="your_pinecone_api_key"
PINECONE_INDEX_NAME="your_pinecone_index_name" # e.g., rag-embeddings-v2

# Ollama URL (For local dev OR managed by script for production)
OLLAMA_URL="http://localhost:11434"

# OpenRouter Configuration
OPENROUTER_API_KEY="your_openrouter_api_key" # Starts with sk-or-...
PUBLIC_SITE_URL="https://your-deployment-url.vercel.app"

# Environment
NODE_ENV=development
```

#### **🔐 Important Security Notes:**
- Replace ALL placeholder values with your actual Firebase configuration
- The `.env` file is automatically gitignored for security
- NEVER commit Firebase credentials to version control
- Use the exact variable names shown above (case-sensitive)

### Running in Development Mode

1.  **Start the development server:**
    ```bash
    pnpm dev
    ```

2.  **Test the main application:**
    - Open [http://localhost:3000](http://localhost:3000) in your browser
    - This loads the AI chat interface

3.  **🔐 Test Firebase Authentication:**
    - Visit [http://localhost:3000/admin/login](http://localhost:3000/admin/login)
    - Log in with your Firebase admin user credentials
    - Should redirect to [http://localhost:3000/admin/dashboard](http://localhost:3000/admin/dashboard)
    - Verify the admin dashboard loads without errors

4.  **🤖 Test AI Chat (Optional):**
    - Ensure Ollama is serving the required model (see next section)
    - In development mode, the application uses the `OLLAMA_URL` defined in `.env`
    - If that URL is unreachable, it will attempt the Hugging Face fallback if configured

#### **Verification Checklist:**
- ✅ Main chat page loads at `http://localhost:3000`
- ✅ Admin login page loads at `http://localhost:3000/admin/login`
- ✅ Azure AD authentication works (login → dashboard redirect)
- ✅ Admin dashboard displays user email
- ✅ Logout functionality works
- ✅ Protected routes redirect unauthorized users

### 🛠️ Troubleshooting Azure AD Authentication

#### **Common Issues and Solutions:**

**🚫 Login redirect issues or blank screen after redirect:**
- Ensure redirect URIs exactly match environment variables
- Clear site data and retry

**❌ Missing Azure env vars:**
- Verify all `NEXT_PUBLIC_AZURE_AD_*` variables are in your `.env` file
- Restart the development server after adding environment variables
- Check for typos in variable names (they are case-sensitive)

**🚫 "Access denied" when visiting `/admin/dashboard` directly:**
- This is expected behavior! The route is protected
- You must log in first at `/admin/login`
- Check browser console for authentication state logs

**🔄 Infinite redirect loops:**
- Clear browser cache and cookies
- Verify app registration redirect URIs match your site URLs

#### **Development Tips:**
- Open browser dev tools (F12) to see Firebase initialization logs
- Check the Network tab for failed Firebase API calls
- Look for authentication state changes in the Console tab

## 🤖 Local Embedding Model Setup (Ollama + Cloudflared + Vercel Integration - macOS)

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

## 🚀 Deployment

This project is designed for deployment on [Vercel](https://vercel.com/) with Firebase Authentication.

### **Prerequisites for Production**
- Firebase project with Authentication enabled
- Vercel account
- Your code pushed to a Git repository (GitHub, GitLab, Bitbucket)

### **Deployment Steps**

1.  **Push to Git:** Ensure your code is pushed to a Git repository.

2.  **Import Project to Vercel:**
    - Import your Git repository into Vercel
    - Select the root directory of your project

3.  **🔐 Configure Azure AD Environment Variables:**
    
    In the Vercel project settings, add these **REQUIRED** environment variables for the **Production** environment:
    
    ```bash
    # Azure AD (MSAL) Authentication (Required)
    NEXT_PUBLIC_AZURE_AD_TENANT_ID=your_tenant_id
    NEXT_PUBLIC_AZURE_AD_CLIENT_ID=your_app_client_id
    NEXT_PUBLIC_AZURE_AD_REDIRECT_URI=https://your-deployment-url.vercel.app
    NEXT_PUBLIC_AZURE_AD_POST_LOGOUT_REDIRECT_URI=https://your-deployment-url.vercel.app
    NODE_ENV=production
    ```

4.  **🤖 Configure AI Chat Variables (Optional):**
    ```bash
    # AI Chat System
    PINECONE_API_KEY=your_pinecone_api_key
    PINECONE_INDEX_NAME=your_pinecone_index_name
    OPENROUTER_API_KEY=your_openrouter_api_key
    PUBLIC_SITE_URL=https://your-deployment-url.vercel.app
    ```
    
    **Note:** The `OLLAMA_URL` variable for the *Production* environment will be managed by the local `run_cloudflared_and_update_vercel.sh` script if using local embeddings.

5.  **Firebase Security Configuration:**
    - In Firebase Console → Authentication → Settings → Authorized domains
    - Add your Vercel deployment URL (e.g., `your-app.vercel.app`)
    - This ensures Firebase auth works from your production domain

6.  **Deploy:** 
    - Vercel will build and deploy automatically upon pushes to the main branch
    - Visit your deployment URL and test the admin authentication
    - Admin login will be available at `https://your-app.vercel.app/admin/login`

### **Production Verification:**
- ✅ Main application loads at your Vercel URL
- ✅ Admin login works at `/admin/login`
- ✅ Protected dashboard requires authentication
- ✅ Firebase authentication works across page refreshes
- ✅ Environment variables are properly configured

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

### **🔐 Authentication & Security**
*   **Firebase Authentication:** Google's enterprise-grade authentication service
*   **Firebase Client SDK:** v9+ for modern authentication state management
*   **React Context API:** Global authentication state management
*   **Protected Routes:** Higher-order component route protection
*   **Environment Variables:** Secure credential management

### **🚀 Frontend & Framework**
*   **Framework:** Next.js 15
*   **Language:** TypeScript
*   **UI Library:** React 19
*   **Styling:** CSS Modules
*   **State Management:** React Context API + Firebase Auth State
*   **Deployment:** Vercel

### **🤖 AI & Backend Systems**
*   **Vector Database:** Pinecone
*   **Embedding Models:** Ollama (`jeffh/intfloat-multilingual-e5-large:f16`) - Local/Primary
*   **Tunneling:** Cloudflare Tunnel (`cloudflared`)
*   **LLM Provider:** OpenRouter
*   **LLM:** Google Gemma 3 (`google/gemma-3-27b-it:free`)
*   **API Routes:** Next.js Serverless Functions

### **🛠️ Development & Operations**
*   **Package Manager:** pnpm (adapt commands for npm/yarn if needed)
*   **Process Management (macOS):** `launchd`
*   **Version Control:** Git with secure environment practices
*   **CI/CD:** Vercel automatic deployments

## 📊 Project Status & Recent Updates

### **🔐 Firebase Authentication Migration (2024)**

This fork includes a complete migration from JWT/bcrypt to Firebase Authentication, providing enterprise-grade security for the admin portal.

#### **✅ What's Implemented:**
- **Secure Firebase Authentication** with email/password
- **Protected Admin Dashboard** with real-time auth state
- **Global Authentication Context** using React Context API
- **Automatic Route Protection** with redirects for unauthorized access
- **Environment Variable Security** with comprehensive .gitignore protection
- **Production-Ready Deployment** configuration for Vercel + Firebase

#### **🛡️ Security Features:**
- No hardcoded credentials anywhere in the codebase
- All sensitive data stored in environment variables
- Firebase's enterprise-grade authentication infrastructure
- Comprehensive security audit passed
- Protected routes with automatic redirects
- Real-time authentication state management

#### **🚀 Ready for Production:**
- Complete development and deployment documentation
- Comprehensive troubleshooting guides
- Environment variable templates provided
- Step-by-step Firebase setup instructions
- Vercel deployment configuration included

### **🤖 AI Chat System Status:**

The original AI chat functionality remains fully intact with:
- RAG (Retrieval-Augmented Generation) chat interface
- Pinecone vector database integration  
- Ollama local embedding support
- OpenRouter LLM integration
- Cloudflare tunnel automation for local embedding deployment

### **📈 For Contributors:**

If you fork this repository, you get:
1. **Modern Authentication System** - No need to implement auth from scratch
2. **Security Best Practices** - Comprehensive security implementation
3. **Production Documentation** - Complete setup and deployment guides
4. **Extensible Architecture** - Easy to add new admin features
5. **Clean Codebase** - Well-documented, TypeScript-based React application

## Legal Notices

*   **Gemma 3 Model:** This application utilizes the `google/gemma-3-27b-it` model accessed via OpenRouter. Use of Gemma models is subject to Google's official terms. Please review the [Gemma Terms of Use](https://ai.google.dev/gemma/terms). Key aspects include:
    *   Restrictions on prohibited uses (illegal activities, harassment, misinformation, etc.).
    *   Limitations on commercial use with the `:free` tag on OpenRouter implies adherence to Google's standard non-commercial or limited commercial terms.
    *   Requirement to follow safety guidelines and potential need to display notices about AI-generated content.
*   **AI Disclaimer:** AI-generated responses may contain inaccuracies or errors. The AI has limited knowledge and may not be aware of very recent events or specific nuances not present in its training data or the provided context documents. Always verify critical information from official sources.
*   **Data Privacy:** As outlined in the Terms of Service dialog, user interactions may be logged for improvement purposes. Avoid sharing sensitive personal information.
