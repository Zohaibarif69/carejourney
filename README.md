# CareJourney

CareJourney is a Next.js application that guides a patient from "I need to find a doctor" all the way through booking an appointment: searching for a provider, uploading and processing medical documents, completing a pre-visit consultation, e-signing a consent form, and submitting/confirming an appointment request.

It's a single Next.js project — a React SPA shell for the UI and a set of Next.js API routes for the backend — backed by SQLite (via Turso/libSQL) and several third-party services for search, AI, document processing, e-signature, and visual exploration.

## How it works: the patient journey

The app is built around one core object, a **Journey**, which represents a single patient's path through the product from provider selection to confirmed appointment.

1. **Search** (`/search`) — the patient enters a country, city, and care category (plus an optional free-text concern). The backend queries SerpApi for real providers in that area, then asks an LLM to rank and annotate each result with match reasons and a match strength (`Strong` / `Good` / `Possible`). Results are cached in the `providers` table so repeat searches are cheap.
2. **Provider detail** (`/providers/:id`) — view a provider's specialties, services, and rating.
3. **Visual exploration** (`/visual`) — optional step where a patient can upload a photo and preview a "visual experience" (e.g. a treatment/cosmetic preview) via Perfect Corp, before committing to a journey.
4. **Start a journey** (`/journey/new`) — creates a `Journey` row tying together the chosen provider, the service, and the patient's basic info.
5. **Documents** (`/journey/:id/documents`) — the patient describes what documents they have in plain language; an LLM classifies that into a structured list of document types (report, prescription, photo, lab result, referral, general). Each document is then uploaded, sent to Foxit for OCR/processing, and can optionally go through an AI-assisted redaction pass (see below) before being sealed.
6. **Consultation** (`/journey/:id/consultation`) — a dynamic form (schema generated per-journey) collects pre-visit answers, saved back to the journey.
7. **Consent / e-signature** — a consent document is generated (via Doctavian's document-generation pipeline) and sent for e-signature (via Foxit eSign), which is a deliberately separate, human-triggered action (see [Two Foxit integrations](#two-separate-foxit-integrations) below).
8. **Request** (`/journey/:id/request`) — the patient submits an appointment request; the provider/staff side confirms it, moving the request from `requested` to `confirmed`.
9. **Foxit agent** (`/journey/:id/agent`) — a free-form agentic assistant, backed by a live tool-use loop over Foxit's MCP document tools, for ad-hoc document operations.

A journey moves through the statuses `draft → documents → consultation → signing → requested → confirmed` as the patient progresses.

## Architecture

This is one Next.js app with two halves that live in the same codebase:

- **Frontend:** a client-side single-page app. `src/app/ClientApp.tsx` mounts a React Router tree with all the pages listed above; the actual page components live in `src/spa-views/`, with shared UI in `src/components/` and app-wide state in `src/context/AppContext.tsx`.
- **Backend:** Next.js Route Handlers under `src/app/api/`. Each route is a thin layer that validates input, talks to SQLite via `src/lib/db.ts`, and calls out to whichever third-party API the step needs.
- **Data access layer:** `src/services/apiClient.ts` is the single place the frontend calls into `/api/*` — components never call `fetch` directly.

### Two separate Foxit integrations

Foxit shows up twice in this codebase, deliberately kept apart:

- **`src/lib/foxitAgent.ts`** — an agentic tool-use loop (Gemini as the reasoning model) that talks to a live Foxit MCP server over HTTP streaming. It has real, reversible document tools (extract, convert, watermark, etc.) but **signing is intentionally excluded** from its tool catalog.
- **`src/lib/foxitEsign.ts`** — a separate, directly-called integration (its own OAuth2 client-credentials flow, its own API base) used only for the human-triggered "send this for signature" action. The agent above can never reach this on its own.

This split means an AI agent can help a patient manipulate their documents, but only a person clicking "Sign & Send" can actually put a document in front of someone for a legal signature.

### AI / LLM usage

- `src/lib/llm.ts` is a single `callLLM(system, user)` function that can be backed by **Anthropic (Claude)**, **OpenAI (GPT-4o)**, or **Gemini**, selected via `LLM_PROVIDER`. It's used for:
  - Ranking and annotating provider search results
  - Classifying a patient's free-text description of their documents into structured labels
- `src/lib/foxitAgent.ts` uses Gemini specifically (function-calling / tool-use), independent of the `LLM_PROVIDER` setting above, to drive the document agent.

### File storage

`src/lib/storage.ts` abstracts file storage behind one `saveFile()` call:
- If `BLOB_READ_WRITE_TOKEN` is set (and `USE_LOCAL_STORAGE` isn't `true`), files go to **Vercel Blob** and get a persistent CDN URL.
- Otherwise, files are written to `./public/uploads` and served locally via `src/app/api/files/[...path]/route.ts`.

## Data model

Database access goes through `src/lib/db.ts`, using `@libsql/client` (Turso-compatible libSQL) so the same code works against a local SQLite file (`file:./carejourney.db`) or a hosted Turso database — which matters because plain local SQLite files don't survive on serverless platforms like Vercel. The schema is created automatically the first time the API runs (`ensureSchema()`), so there's no manual migration step.

| Table | Purpose |
|---|---|
| `providers` | Cached, ranked SerpApi results, keyed by SerpApi place ID so repeat searches update rather than duplicate |
| `journeys` | The core record: provider, patient info, visual session, consultation answers/schema, signed status, overall journey status |
| `documents` | One row per document in a journey: label, uploaded file, Foxit job status, extracted text, redaction suggestions, seal status |
| `requests` | Appointment request lifecycle: `requested` → `confirmed`, with timestamps |
| `agent_classifications` | Audit log of every LLM call that classified a patient's described documents |

## API surface

All routes live under `src/app/api/`:

| Route | Purpose |
|---|---|
| `GET /api/providers/search` | Search + LLM-rank providers (SerpApi + LLM) |
| `GET /api/providers/[id]` | Read a cached provider |
| `POST /api/journeys` | Create a journey |
| `GET /PATCH /api/journeys/[id]` | Read / update a journey |
| `POST /api/journeys/[id]/documents/classify` | LLM-classify a patient's document description |
| `POST /api/journeys/[id]/documents/confirm` | Create document rows from the confirmed classification |
| `POST /api/journeys/[id]/consultation/generate` | Generate the consultation form schema |
| `PATCH /api/journeys/[id]/consultation` | Save consultation answers |
| `POST /api/journeys/[id]/sign` | Trigger e-signature (Doctavian/Foxit eSign) |
| `POST /api/journeys/[id]/request` | Submit the appointment request |
| `POST /api/documents/[id]/upload` | Upload a file, kick off Foxit processing |
| `GET /api/documents/[id]/status` | Poll a document's Foxit processing status |
| `POST /api/documents/[id]/redact/suggest` | Get AI-suggested redactions (Nutrient DWS) |
| `POST /api/documents/[id]/redact/seal` | Seal a document after redaction review |
| `POST /api/documents/agent-process` | Drive the Foxit MCP agent loop |
| `POST /api/documents/foxit-esign` | Low-level Foxit eSign call |
| `GET /api/requests/[id]` / `POST /api/requests/[id]/confirm` | Appointment request status / confirmation |
| `POST /api/visual/explore` | Perfect Corp visual exploration |
| `GET /api/files/[...path]` | Serve locally-stored uploads |

## Third-party integrations

| Service | Used for | Env vars |
|---|---|---|
| **SerpApi** | Provider search results | `SERPAPI_KEY` |
| **Anthropic / OpenAI / Gemini** | Provider ranking, document classification | `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` or `GEMINI_API_KEY`, `LLM_PROVIDER` |
| **Foxit PDF Services (MCP)** | Document OCR/processing, agentic document tools | started via `npm run foxit-mcp`, reached at `FOXIT_MCP_URL` |
| **Foxit eSign** | Human-triggered e-signature | `FOXIT_ESIGN_CLIENT_ID`, `FOXIT_ESIGN_CLIENT_SECRET`, `FOXIT_ESIGN_TOKEN_URL` |
| **Doctavian** | Consent document generation from a template | `DOCTAVIAN_API_KEY`, `DOCTAVIAN_API_URL` |
| **Nutrient DWS** | Redaction suggestion + sealing | `NUTRIENT_API_KEY`, `NUTRIENT_API_URL` |
| **Perfect Corp** | Visual exploration | `PERFECT_CORP_API_KEY`, `PERFECT_CORP_API_URL` |
| **Vercel Blob** | Persistent file storage | `BLOB_READ_WRITE_TOKEN` (or `USE_LOCAL_STORAGE=true` for local dev) |
| **Turso (libSQL)** | Database | `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` |

Every integration degrades instead of failing outright when its key is missing or the service is down:

| Service | Fallback behavior |
|---|---|
| SerpApi | Returns an empty provider list |
| LLM | Returns providers unranked with a generic match reason |
| Foxit (processing) | Marks the document processed with placeholder text |
| Nutrient DWS | Falls back to text-pattern-based redaction suggestions |
| Doctavian | Serves the built-in consent template (`doctavian-assets/consent-template.docx`) |
| Perfect Corp | Returns the original uploaded image unmodified |


## Prerequisites

- Node.js 18+
- At minimum, no keys are required to run the app (every integration has a fallback) — but you'll want real keys for the parts you're testing

## Setup

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Configure environment variables**
   ```bash
   cp .env.local.example .env.local
   ```
   Fill in whichever keys you need from the table above.

3. **Run the development server**
   ```bash
   npm run dev
   ```
   This runs the Next.js dev server and the Foxit PDF MCP sidecar together (needed for the document agent). Use `npm run dev:next-only` to skip the MCP server if you don't need the agent page.

   Open [http://localhost:3000](http://localhost:3000). The database schema is created automatically on first API call.

