# CareJourney — Next.js + SQLite Backend

This is the **full Next.js replacement** for the original CareJourney project that used Xano as backend.
Everything works exactly the same — all 10 pages, all features, all 6 third-party APIs — just powered by Next.js API routes and SQLite instead of Xano.

---

## What changed vs the Xano version

| Before (Xano)               | After (Next.js)                        |
|-----------------------------|----------------------------------------|
| Xano managed database       | SQLite file (`carejourney.db`)         |
| Xano custom API endpoints   | Next.js API routes (`/api/...`)        |
| `src/services/xanoClient.ts`| `src/services/apiClient.ts`            |
| `VITE_XANO_BASE_URL` env var| `NEXT_PUBLIC_APP_URL` env var          |
| `VITE_USE_MOCKS` feature flag| Not needed — graceful fallbacks built-in |
| Vite build tool             | Next.js (React + API in one project)  |

**Frontend pages and components are 100% unchanged.**

---

## Project structure

```
carejourney-nextjs/
├── src/
│   ├── app/
│   │   ├── layout.tsx              # Next.js root layout
│   │   ├── page.tsx                # Entry point
│   │   ├── globals.css
│   │   ├── ClientApp.tsx           # React Router SPA (all 10 pages)
│   │   └── api/                    # ← ALL BACKEND ROUTES LIVE HERE
│   │       ├── providers/
│   │       │   ├── search/route.ts     → SerpApi + LLM ranking
│   │       │   └── [id]/route.ts       → SQLite cache read
│   │       ├── journeys/
│   │       │   ├── route.ts            → POST create journey
│   │       │   └── [id]/
│   │       │       ├── route.ts        → GET + PATCH journey
│   │       │       ├── documents/
│   │       │       │   ├── classify/route.ts → LLM classification
│   │       │       │   └── confirm/route.ts  → Create doc rows
│   │       │       ├── consultation/
│   │       │       │   ├── generate/route.ts → Doctavian generate
│   │       │       │   └── route.ts          → PATCH save answers
│   │       │       ├── sign/route.ts         → Doctavian eSign
│   │       │       └── request/route.ts      → Submit appointment
│   │       ├── documents/
│   │       │   └── [id]/
│   │       │       ├── upload/route.ts       → File save + Foxit OCR
│   │       │       ├── status/route.ts       → Poll Foxit job
│   │       │       └── redact/
│   │       │           ├── suggest/route.ts  → Nutrient DWS detect
│   │       │           └── seal/route.ts     → Nutrient DWS seal
│   │       ├── requests/
│   │       │   └── [id]/
│   │       │       ├── route.ts              → GET status
│   │       │       └── confirm/route.ts      → POST confirm
│   │       └── visual/
│   │           └── explore/route.ts          → Perfect Corp
│   ├── components/     # Original — unchanged
│   ├── pages/          # Original — unchanged
│   ├── context/        # Original — unchanged
│   ├── types/index.ts  # Original — unchanged
│   ├── lib/
│   │   ├── db.ts           # SQLite setup + migrations
│   │   ├── llm.ts          # Anthropic / OpenAI helper
│   │   └── apiHelpers.ts   # ok() / err() response helpers
│   └── services/
│       ├── apiClient.ts    # Replaces xanoClient.ts
│       └── index.ts        # Same interface, calls /api/* instead of Xano
├── .env.local.example  # Copy this to .env.local and fill in your keys
├── next.config.ts
├── tailwind.config.ts
└── carejourney.db      # Auto-created on first run (SQLite file)
```

---

## Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment variables
```bash
cp .env.local.example .env.local
```

Open `.env.local` and fill in your API keys:

```env
# Required for provider search
SERPAPI_KEY=your_serpapi_key

# Required for document classification + provider ranking
ANTHROPIC_API_KEY=your_anthropic_key
LLM_PROVIDER=anthropic

# Required for visual exploration
PERFECT_CORP_API_KEY=your_perfect_corp_key
PERFECT_CORP_API_URL=https://api.perfectcorp.com/v1

# Required for document OCR/extraction
FOXIT_API_KEY=your_foxit_key
FOXIT_API_URL=https://api.foxit.com/v1

# Required for redaction
NUTRIENT_API_KEY=your_nutrient_key
NUTRIENT_API_URL=https://api.nutrient.io/v1

# Required for consultation + signing
DOCTAVIAN_API_KEY=your_doctavian_key
DOCTAVIAN_API_URL=https://api.doctavian.com/v1
```

### 3. Run development server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

The SQLite database (`carejourney.db`) is created automatically on first API call.

---

## How the database works

No setup needed — it creates itself. Tables are:

- **providers** — cached SerpApi results (re-queried and updated on each search)
- **journeys** — central record tying provider + patient + documents + status
- **documents** — one row per document in a journey, tracks Foxit job status
- **requests** — appointment request with requested → confirmed status
- **agent_classifications** — audit log of every LLM classify call

The SQLite file lives at `./carejourney.db` by default. Change `DATABASE_PATH` in `.env.local` to move it.

---

## Graceful fallbacks

Every third-party API call has a fallback so the app never crashes completely if a key is missing or an API is down:

- **SerpApi unavailable** → returns empty provider list
- **LLM unavailable** → returns providers unranked with a generic match reason
- **Foxit unavailable** → marks document as processed with placeholder text
- **Nutrient DWS unavailable** → generates fallback redaction suggestions from text patterns
- **Doctavian unavailable** → serves a built-in consent form template
- **Perfect Corp unavailable** → returns the original uploaded image as the result

---

## Deploying

For production deployment (Vercel, Railway, Fly.io):

1. Set all env vars in your deployment platform's dashboard
2. For Vercel: SQLite works locally but not on serverless — switch to [Turso](https://turso.tech) (libSQL, SQLite-compatible) or PostgreSQL (Neon/Supabase) and update `src/lib/db.ts`
3. For Railway/Fly.io (persistent server): SQLite works fine, just mount a persistent volume

For a quick persistent-server deploy:
```bash
npm run build
npm start
```
