# Copilot Instructions for AI PI

## Project Overview

**AI PI** is a RAG-powered chatbot for the Georgia Tech Invention Studio, built by the MATRIX Lab team. It answers questions about studio equipment, policies, procedures, and hours using a Retrieval-Augmented Generation pipeline.

There are two user-facing surfaces:
- **Public chat UI** (`/`) — the main chatbot interface, accessible to anyone who accepts the ToS.
- **Admin panel** (`/admin`) — authenticated admin dashboard for managing RAG knowledge-base files, protected by Microsoft Azure AD login (only `@gatech.edu` accounts allowed).

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, `"type": "module"`) |
| Language | TypeScript 5.9 (strict) |
| Styling | Tailwind CSS v4 + `tw-animate-css` |
| Component library | shadcn/ui (`base-nova` style, stone base color) built on Base UI React |
| Icons | `lucide-react` |
| Forms | `react-hook-form` + `zod` v4 |
| Auth | `better-auth` (Microsoft Azure AD OAuth, JWT plugin) |
| LLM routing | OpenRouter via `@openrouter/ai-sdk-provider` + Vercel AI SDK v6 |
| Embeddings | DeepInfra (`intfloat/multilingual-e5-large`) with Ollama and HuggingFace fallbacks |
| Vector DB | Pinecone (`@pinecone-database/pinecone`) |
| Analytics | PostHog (client + server, with AI tracing via `@posthog/ai`) |
| Package manager | **pnpm** (always use `pnpm`, never `npm` or `yarn`) |

---

## Commands

```bash
pnpm dev          # Start dev server on localhost:3000
pnpm build        # Production build
pnpm lint         # ESLint
pnpm typecheck    # tsc --noEmit
pnpm format:check # Prettier check
pnpm format:fix   # Prettier autofix
```

CI runs `format:check`, `lint`, and `typecheck` in parallel on every push/PR to `main`. **All three must pass before merging.**

---

## Directory Structure

```
/
├── app/
│   ├── (public)/          # Public chatbot UI — no auth required
│   │   ├── page.tsx       # Main chat page with useChat, RAG, session logic
│   │   ├── components/    # chatbox/, conversation/, references/, tos/, header-buttons/
│   │   ├── hooks/         # Page-level hooks (useLocalStorage, useSessionTimeout)
│   │   └── upload/        # File upload UI
│   ├── (admin)/           # Admin panel — requires @gatech.edu auth
│   │   └── admin/dashboard/page.tsx
│   ├── api/
│   │   ├── chutes/route.ts  # Main chat API: classifies query, runs RAG or general path
│   │   ├── files/route.ts   # Admin CRUD for knowledge-base files in Pinecone
│   │   ├── auth/            # better-auth handler
│   │   └── analytics/       # PostHog analytics proxy
│   ├── layout.tsx           # Root layout with Providers + Toaster
│   └── providers/           # TanStack Query, PostHog, next-themes, session timeout
├── components/
│   └── ui/                  # shadcn/ui components (button, dialog, sheet, etc.)
├── hooks/                   # Global hooks (useLocalStorage, useSessionTimeout)
├── lib/
│   ├── auth.ts              # better-auth config (Azure AD, gatech.edu restriction)
│   ├── auth-client.ts       # Client-side auth helpers
│   ├── openrouter.ts        # OpenRouter singleton class (stream, complete, generateObject)
│   ├── types.ts             # Shared types: Message, Context
│   ├── utils.ts             # cn() utility (clsx + tailwind-merge)
│   ├── fonts.ts             # Inter font
│   ├── posthog-server.ts    # Server-side PostHog client
│   └── chutes/              # Core RAG pipeline
│       ├── types.ts         # System prompts, config constants, ConversationMessage
│       ├── rag.ts           # classifyQuery, ragQuery, generateGeneralResponse
│       ├── embeddings.ts    # embedDocs (Ollama → DeepInfra → HuggingFace waterfall)
│       ├── history.ts       # processHistory, extractEmbeddingContext
│       └── web-search.ts    # DuckDuckGo web search
├── styles/                  # Global CSS
├── docs/                    # All project documentation (UPPERCASE .md files)
├── scripts/                 # Infrastructure helper scripts (cloudflared, Vercel tunnel)
├── public/                  # Static assets
├── instrumentation-client.ts  # PostHog client-side init (Next.js 15.3+ pattern — do NOT add separate posthog init elsewhere)
└── proxy.ts                 # Local dev cloudflared tunneling helper
```

---

## RAG Pipeline (POST /api/chutes)

1. Extract the last user message as the question; all prior messages become `history`.
2. **Classify** the query via `classifyQuery()` — returns `{ needsRAG: boolean }`.
3. **RAG path**: emit `data-web_search_loading`, then call `ragQuery()`:
   - Embed question with `embedDocs()` (Ollama → DeepInfra → HuggingFace)
   - Run `extractKeywordForDuckDuckGo()` + `fetchDuckDuckGoContext()` in parallel
   - Query Pinecone with the question vector (and optionally a history-enriched vector)
   - Filter matches with `score >= 0.25`; if `bestScore < CONFIDENCE_THRESHOLD (0.6)`, fall back to general
   - Build context string via `constructContext()` and stream with OpenRouter
4. **General path**: call `generateGeneralResponse()` directly.
5. Emit `data-contexts`, `data-metrics`, then pipe the LLM stream.

All streaming uses `createUIMessageStream` / `createUIMessageStreamResponse` from the Vercel AI SDK. Custom data events use the `data-<name>` convention.

---

## Key Conventions

### TypeScript & Imports
- Path aliases: `@/components`, `@/lib`, `@/hooks` (configured in `tsconfig.json`)
- Use `import type` for type-only imports
- Avoid `any` where possible; mark unavoidable cases with `// TODO: fix any typing`

### Styling
- Use `cn()` from `@/lib/utils` for all conditional className composition
- Tailwind CSS v4 with CSS variables for theming (`globals.css`)
- `data-slot` attributes are used on shadcn/ui components for targeting
- Dark mode uses `next-themes`

### Forms
- Use `react-hook-form` with `zodResolver` and a `z.object` schema
- See `app/(public)/components/chatbox/chatbox.tsx` for a canonical example

### UI Components
- All UI primitives live in `components/ui/` and are built on Base UI React (`@base-ui/react`)
- The `Dialog` wrapper supports `closable?: boolean` and `onCloseAttempt?: () => void` to prevent backdrop/escape closes (uses `eventDetails.cancel()`)
- `Button` accepts a `tooltip` prop for accessible hover tooltips

### Server-Side Auth
- Call `auth.api.getSession({ headers: req.headers })` in API routes to get the session
- Only `@gatech.edu` emails are allowed (enforced in `lib/auth.ts` `signIn` callback)
- Admin routes check session and return 401 if not authenticated

### OpenRouter (LLM)
- Use the singleton: `const openrouter = getOpenRouter()` from `@/lib/openrouter`
- `openrouter.stream()` for streaming text, `openrouter.generateObject<T>()` for structured output, `openrouter.complete()` for non-streaming
- Always pass `posthogDistinctId` and `posthogTraceId` for analytics tracing
- For Chutes routing: `{ provider: { order: ["Chutes"] } }`

### Environment Variables
Copy `.env.example` to `.env.local`. Required variables:

```
AZURE_AD_CLIENT_ID, AZURE_AD_TENANT_ID, AZURE_AD_CLIENT_SECRET
DEEPINFRA_API_KEY
PINECONE_API_KEY, PINECONE_INDEX_NAME
OPENROUTER_API_KEY, OPENROUTER_MODEL
NEXT_PUBLIC_POSTHOG_KEY, NEXT_PUBLIC_POSTHOG_HOST
BETTER_AUTH_SECRET
VERCEL_PROJECT_PRODUCTION_URL
```

Optional: `OLLAMA_URL` (for local embeddings), `HF_API_KEY` + `HF_API_URL` (HuggingFace fallback).

### Pinecone Patterns
- Embedding dimension: **1024** (`EMBEDDING_DIM` in `lib/chutes/types.ts`)
- "Dummy" vectors for metadata queries: `new Array(1024).fill(0)` with `dv[0] = 0.0001`
- File chunks use id format: `${filename}_chunk_${idx}`; metadata records: `file_metadata_${filename}`
- Query log records use id: `query-log-${Date.now()}-${randomSuffix}`

---

## Agent Skills

Three specialized skills are available in `.agents/skills/`. **Always invoke the relevant skill before starting the associated type of work** — skills carry detailed rules and enforce correct patterns that are easy to get wrong without them.

### `shadcn`
**Trigger:** Any task involving UI components — adding, editing, styling, or composing shadcn/ui primitives; anything touching `components/ui/`; tasks that mention specific component names (Button, Dialog, Sheet, etc.).

What it does:
- Injects live project context (installed components, aliases, Tailwind version, base library, icon library) via `pnpm dlx shadcn@latest info`
- Enforces critical rules: semantic color tokens only, `gap-*` not `space-y-*`, `size-*` for equal dimensions, `cn()` for conditional classes, no inline `dark:` overrides, correct `asChild`/`render` usage for Base UI vs Radix, required accessibility titles on overlays
- Manages adding components via `pnpm dlx shadcn@latest add <component>` — never hand-write shadcn primitives
- Provides component documentation URLs via `pnpm dlx shadcn@latest docs <component>`

### `vercel-react-best-practices`
**Trigger:** Writing or refactoring React components, Next.js pages, data-fetching logic, bundle optimization, or any performance-related work.

What it does:
- Applies 64 prioritized rules across 8 categories (waterfall elimination, bundle size, server performance, re-render optimization, etc.)
- Highest-impact rules: use `Promise.all()` for independent async calls, avoid barrel imports, use `next/dynamic` for heavy components, derive state during render not effects, use primitive effect dependencies, prefer functional `setState`

### `documentation-writer`
**Trigger:** Creating or significantly rewriting any file in `/docs/`, README content, or other user-facing documentation.

What it does:
- Applies the Diátaxis framework: Tutorials (learning), How-to Guides (problem-solving), Reference (technical spec), Explanation (conceptual)
- Enforces docs conventions for this repo: files go in `/docs/` as `UPPERCASE_SNAKE_CASE.md`, update `/docs/README.md` index when adding new docs

---

## Documentation Conventions

- **All** markdown documentation files go in `/docs/` with `UPPERCASE_SNAKE_CASE.md` names
- Naming suffixes: `_FIX.md`, `_FEATURE.md`, `_GUIDE.md`, `_IMPLEMENTATION.md`, `_ROADMAP.md`
- Update `/docs/README.md` index when adding new docs
- Do **not** place `.md` files in the repository root (except root `README.md` if needed)

---

## Known Patterns & Gotchas

- **`pdf-parse` is CommonJS**: always import with `const pdfParse = (await import("pdf-parse")).default` and suppress type errors with `// @ts-ignore`
- **Pinecone upsert API**: use `index.upsert({ records: [...] })` shape (not the older array form) for query logs; use `index.upsert([...])` for document chunks
- **AI SDK message format**: the API receives `parts`-based messages (Vercel AI SDK v6 format); extract text with `.parts.filter(p => p.type === "text").map(p => p.text).join("")`
- **Session timeout**: implemented via `react-idle-timer`; session state is tracked in `useSessionTimeout` hook and resets ToS acceptance on expiry
- **PostHog reverse proxy**: `/ingest/*` routes in `next.config.js` proxy to PostHog; do not break these rewrites
- **PostHog client init**: PostHog is initialized in `instrumentation-client.ts` (Next.js 15.3+ pattern). Never add a separate `posthog.init()` call elsewhere on the client.
- The `proxy.ts` file at root is for local development tunneling with cloudflared (see `scripts/`)
- **Embedding prefix convention**: documents use `passage: <text>` prefix; queries use `query: <text>` prefix (required by `intfloat/multilingual-e5-large`)
- **`data-web_search_complete`** carries `{ found, keyword, source, error }` and is always emitted from the RAG path (even on DDG failure). Only `data-web_search_loading` is transient before the search.
- **shadcn/ui components**: add new components via `pnpm dlx shadcn@latest add <component>` — do not hand-write shadcn primitives from scratch
- **Loader components**: `components/loaders/spinner.tsx` and `loading-dots.tsx` are available for async/streaming states
