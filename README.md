# AI PI

Maintainers and recent contributors: Vineel Panyala, Vincent Yang, Ivan Mukhin, and Preyas Joshi

## Overview

AI PI is a web application that combines:

- A public-facing chat interface for asking questions and receiving AI-generated answers
- A retrieval pipeline that can pull from uploaded documents and other context sources
- An admin experience for managing content and reviewing the system
- A deployable frontend and backend that can be launched as a new "instance" with relatively little prior technical knowledge

In this project, an "instance" means a full copy of the product:

- The web app / frontend users interact with
- The backend API routes that power chat, auth, and file operations
- The model and retrieval configuration used by that deployment
- The environment variables and cloud services connected to that deployment

You can think of creating a new instance like setting up a new copy of an app for a different team, lab, or organization.

## What The Current System Uses

- Framework: Next.js 16 with the App Router
- Language: TypeScript
- Framework: React 19
- CSS: Tailwind CSS
- UI Components: Shadcn UI - Base UI
- Authentication: Better Auth with Microsoft / Azure AD
- LLM routing: OpenRouter
- Vector database: Pinecone
- Embeddings: DeepInfra by default, with optional Hugging Face / other configured providers in the codebase
- Analytics: PostHog
- Deployment target: Vercel

## Main Features

- Public AI chat experience
- Retrieval-augmented generation (RAG) for context-aware answers
- Streaming model responses
- Admin login and protected admin pages
- Document upload and file processing
- Analytics and query logging
- Configurable deployment through environment variables

## Repository Layout

The most important folders for new contributors are:

- `app/`: Next.js routes, layouts, pages, and API endpoints
- `components/`: shared UI components
- `lib/`: auth, AI, retrieval, file, and utility logic
- `docs/`: setup guides, troubleshooting notes, and project documentation
- `public/`: static assets

Key entry points:

- `app/layout.tsx`: global app layout
- `app/(public)/page.tsx`: main public chat page
- `app/(admin)/admin/dashboard/page.tsx`: admin dashboard
- `app/api/chutes/route.ts`: AI chat API
- `app/api/files/route.ts`: file/document API
- `lib/auth.ts`: auth configuration

## Quick Start For Local Development

### 1. Install prerequisites

You will need:

- Node.js 22+ recommended
- `pnpm`
- A GitHub account with access to this repository

### 2. Clone and install

```bash
git clone <your-repo-url>
cd ai-pi-f25
pnpm install
```

### 3. Create your local environment file

```bash
cp .env.example .env.local
```

Fill in the values in `.env.local`.

Current environment variables used by the app include:

```bash
AZURE_AD_CLIENT_ID=
AZURE_AD_TENANT_ID=
AZURE_AD_CLIENT_SECRET=

DEEPINFRA_API_KEY=
PINECONE_API_KEY=
PINECONE_INDEX_NAME=

OPENROUTER_API_KEY=
OPENROUTER_MODEL=

NEXT_PUBLIC_POSTHOG_KEY=
NEXT_PUBLIC_POSTHOG_HOST=

BETTER_AUTH_SECRET=

VERCEL_PROJECT_PRODUCTION_URL=
PREVIEW_URL_PATTERN=

BLOB_READ_WRITE_TOKEN=
```

Notes:

- `BETTER_AUTH_SECRET` is required for auth/session signing
- Azure AD values are required for Microsoft login
- `OPENROUTER_API_KEY` and `OPENROUTER_MODEL` are required for model responses
- `PINECONE_*` is required for the retrieval/document system
- `DEEPINFRA_API_KEY` is the main embedding path reflected by the current example config

### 4. Start the local server

```bash
pnpm dev
```

Then open:

```text
http://localhost:3000
```

### 5. Production-style local check

Before pushing, it is a good idea to verify the production build:

```bash
pnpm build
pnpm start
```

## How To Create A New Instance

This section is meant for someone who wants to launch a new copy of AI PI without needing deep knowledge of the codebase.

### What you need

To deploy a new instance, you need access to:

- A GitHub repository containing this code
- A Vercel account
- An Azure account for Microsoft login
- An OpenRouter API key
- A Pinecone project and index
- A DeepInfra API key
- Optional PostHog keys if you want analytics

### High-level deployment flow

1. Copy or fork this repository.
2. Create a new Vercel project from that repository.
3. Set the required environment variables in Vercel.
4. Create or connect your Azure AD app for sign-in.
5. Create or connect your Pinecone index for retrieval.
6. Add model credentials for OpenRouter and embeddings.
7. Deploy.
8. Upload your own documents and test the experience.

### Step-by-step deployment guide

#### 1. Create your code copy

Make a fork or clone of this repository into a new GitHub repository if you want a separate deployment and history.

#### 2. Create a Vercel project

- Log into Vercel
- Click "Add New Project"
- Import your GitHub repository
- Keep the default Next.js framework detection

#### 3. Configure environment variables in Vercel

Add these values in the Vercel project settings:

```bash
AZURE_AD_CLIENT_ID=
AZURE_AD_TENANT_ID=
AZURE_AD_CLIENT_SECRET=
DEEPINFRA_API_KEY=
PINECONE_API_KEY=
PINECONE_INDEX_NAME=
OPENROUTER_API_KEY=
OPENROUTER_MODEL=
NEXT_PUBLIC_POSTHOG_KEY=
NEXT_PUBLIC_POSTHOG_HOST=
BETTER_AUTH_SECRET=
VERCEL_PROJECT_PRODUCTION_URL=
PREVIEW_URL_PATTERN=
BLOB_READ_WRITE_TOKEN=
```

Recommended values:

- `VERCEL_PROJECT_PRODUCTION_URL`: your production hostname, without `https://`
- `PREVIEW_URL_PATTERN`: the preview URL pattern you want Better Auth to trust
- `OPENROUTER_MODEL`: the model slug you want this instance to use

#### 4. Set up Microsoft / Azure login

The app currently uses Better Auth with Microsoft as the social provider.

In Azure:
1. Sign into your Azure account with your Georgia Tech account
2. In the search bar, search for "App registrations" and click on it
3. Click "+ New Registration"
4. Enter a name for this registration so that you know what this is for
5. Ensure "Supported account types" is "Single Tenant Only"
6. For redirect URI, select "Web" and enter the following URL: `https://ai-pi-f25-flax.vercel.app/api/auth/callback/microsoft`
7. Click "Register"
8. In the "Overview" page, copy the "Application (client) ID" and "Directory (tenant) ID"
9. Click on "Certificates & secrets" in the left sidebar
10. Click on "New client secret"
11. Select an expiration time
12. Click "Add"
13. Copy the "Value" of the client secret and put it in `AZURE_AD_CLIENT_SECRET`
14. Optionally repeat steps 9-13 to create another client secret for local development

The auth callback route in this project is:

```text
/api/auth/callback/microsoft
```

So if your site is deployed at `https://example.vercel.app`, your callback URL should be:

```text
https://example.vercel.app/api/auth/callback/microsoft
```

Important behavior:

- The current sign-in callback in `lib/auth.ts` only allows `@gatech.edu` accounts
- If you want a different organization or wider access, that rule must be changed before deployment

#### 5. Set up Pinecone

Create a Pinecone index for your document embeddings and add:

- `PINECONE_API_KEY`
- `PINECONE_INDEX_NAME`

This is what powers retrieval for uploaded and indexed documents.

#### 6. Set up model and embedding providers

For generation:

- Add `OPENROUTER_API_KEY`
- Set `OPENROUTER_MODEL`

For embeddings:

- Add `DEEPINFRA_API_KEY`

#### 7. Deploy and verify

Once the environment variables are in place, trigger a Vercel deployment.

After deploy, verify:

- The homepage loads
- Chat requests complete successfully
- Microsoft sign-in works
- Admin pages load for authorized users
- Document upload and retrieval work

## How Another Team Can Reuse This Easily

If another lab, class, or organization wants its own version, the easiest path is:

1. Fork the repository.
2. Replace branding and text content.
3. Create new Azure, Pinecone, OpenRouter, and Vercel credentials.
4. Deploy as a separate Vercel project.
5. Upload that team’s own documents.

This makes the project reusable as a template-like application rather than a one-off deployment.

The main things a new team would usually customize are:

- The documents in the knowledge base
- The chosen model in `OPENROUTER_MODEL`
- The allowed email domain in `lib/auth.ts`
- Branding, text, and visuals in the frontend
- Analytics settings

## Recommended Non-Technical Deployment Checklist

For someone who is comfortable with web dashboards but not deep in code:

1. Get access to the GitHub repo.
2. Import the repo into Vercel.
3. Copy the environment variable names from this file.
4. Ask a technical teammate for the Azure, Pinecone, OpenRouter, and DeepInfra credentials.
5. Paste those values into Vercel project settings.
6. Deploy.
7. Open the app and test login, chat, and uploads.

This should be enough to launch a fresh instance without needing to understand every source file in the project.

## Useful Developer Commands

```bash
pnpm dev
pnpm build
pnpm start
pnpm lint
pnpm typecheck
pnpm format:check
```

## Additional Documentation

More detailed technical notes live in `docs/`, including setup and troubleshooting guides such as:

- `docs/AZURE_OAUTH_SETUP.md`
- `docs/PINECONE_SETUP_GUIDE.md`
- `docs/AI_PI_V2_REPORT.md`
- `docs/REPO_ORGANIZATION.md`

## Past Work Preserved

The following prior work and authorship should remain credited from the earlier project documentation.

### Earlier top-level credits

- By: Ojasw Upadhyay
- Azure AD Authentication Migration: implemented by chenastn

### Previously documented project direction

Earlier documentation described AI PI as a web-based chat application for the Invention Studio at Georgia Tech, built around a RAG workflow, an admin portal, and production deployment on Vercel.

Earlier documentation also recorded major work in areas including:

- The original AI chat system and RAG flow
- Admin authentication and protected dashboard work
- Deployment and infrastructure documentation
- Setup guides, troubleshooting notes, and implementation summaries in `docs/`
