# TruthLens

AI fact-checker. Paste text or a URL. TruthLens pulls out each checkable factual claim, researches it on the live web (Claude + web search, or Groq's free `gpt-oss-120b` + browser search), and returns a verdict, a confidence score, an explanation and the sources it used. Results stream in claim by claim and are saved with a shareable link.

> AI fact-checks can be wrong. Read the sources before relying on a verdict.

## Setup

Requires Node.js 20.9+.

```bash
npm install
npm run vault set GROQ_API_KEY      # or ANTHROPIC_API_KEY; hidden prompt, stored in macOS Keychain
npm run dev                         # http://localhost:3000, keys loaded from the Keychain
```

Alternatively, put the key in `.env.local` (see `.env.example`) and run `npm run dev`.

### Key vault (macOS Keychain)

`scripts/vault.sh` keeps API keys in your login Keychain instead of in files:

| Command | What it does |
|---|---|
| `npm run vault set [NAME]` | Store or replace a key (hidden input). `NAME` defaults to `GROQ_API_KEY`. |
| `npm run vault check [NAME]` | Say whether a key is stored, without showing it. |
| `npm run vault remove [NAME]` | Delete a stored key. |
| `npm run dev` | Runs the dev server with `GROQ_API_KEY`, `ANTHROPIC_API_KEY` and `DATABASE_AUTH_TOKEN` loaded from the Keychain. |

### Providers

| | Anthropic (default when its key is set) | Groq (free tier) |
|---|---|---|
| Model | `claude-opus-5-5` | `openai/gpt-oss-120b` |
| Web research | `web_search_20260209` server tool | built-in `browser_search` |
| Claims per check | up to 12 | up to 5 |
| Claims in parallel | 3 | 1 |
| Claim extraction | structured outputs | JSON mode + Zod validation |

Groq's free tier allows about 8,000 tokens per minute, and one browser-search call can use more than that. The Groq SDK waits and retries on 429s, so larger checks take a few minutes rather than failing. Groq's older `groq/compound` models were retired on 2026-09-21.

The SQLite database (`data/truthlens.db`) and its table are created automatically on the first request.

### Environment variables

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | one of these | | Anthropic API key. Server-only. |
| `GROQ_API_KEY` | one of these | | Groq API key. Server-only. |
| `LLM_PROVIDER` | no | auto | `anthropic` or `groq`. Auto picks Anthropic if its key is set, else Groq. |
| `ANTHROPIC_MODEL` | no | `claude-opus-5-5` | Claude model. |
| `GROQ_MODEL` | no | `openai/gpt-oss-120b` | Groq model (must support `browser_search`). |
| `DATABASE_URL` | no | `file:./data/truthlens.db` | libSQL/SQLite URL. Use a `libsql://…` Turso URL in production. |
| `DATABASE_AUTH_TOKEN` | no | | Auth token for a remote libSQL/Turso database. |
| `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` | no | | Used when `DATABASE_URL` / `DATABASE_AUTH_TOKEN` aren't set. Vercel's Turso integration sets these. |
| `RATE_LIMIT_PER_HOUR` | no | `10` | Checks allowed per IP per hour. |

Web search must be enabled for your organization in the Claude Console (an admin setting). Web search is billed per search on top of tokens. Each claim uses at most 5 searches, and each check covers at most 12 claims.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build / server |
| `npm run lint` | ESLint |
| `npm test` | Vitest (schemas, JSON retry with a mocked API, rate limiting, URL extraction) |
| `npm run typecheck` | `tsc --noEmit` |

## How the pipeline works

```
POST /api/check {text} | {url}
  │ Zod validation (non-empty, ≤ 8,000 chars, http(s) URL)
  │ per-IP rate limit (10/hour)
  │ URL? → SSRF-checked fetch → Readability + jsdom → article text
  ▼
Step 1  Extract claims       1 Claude call, structured JSON output (Zod schema)
  │                          → checkable claims (max 12) + "not checkable" items with reasons
  ▼  SSE: meta, claims
Step 2  Verify each claim    Claude + web_search (3 parallel) | Groq + browser_search (1 at a time)
  │                          → JSON {verdict, confidence, explanation, sources}
  │                          → Zod-validated; on malformed output, one repair retry
  │                            in the same conversation; then the claim is marked errored
  │                          → sources filtered to URLs the search actually returned
  ▼  SSE: claim (one per claim, as each finishes)
Step 3  Summary              short Claude call over the verdicts (template fallback)
  ▼  SSE: summary
Save to SQLite (10-character ID) → SSE: done {id}
```

- **Prompts** are all in `lib/prompts.ts`.
- **Schemas** for API input, model output, stored records and stream events are in `lib/schemas.ts`.
- **Verdicts:** True, Mostly True, Misleading, Mostly False, False, Unverifiable. The model is told to prefer primary and reputable sources, cite only pages it retrieved, and answer "Unverifiable" rather than guess.
- **Source check:** the model's source list is compared with the pages the search tool actually returned (`web_search_tool_result` blocks for Claude, `executed_tools` search and open results for Groq). URLs that weren't retrieved are dropped. If none remain, the inline citations the search tool attached are used instead.
- **Resilience:** paused server-tool turns (`pause_turn`) are resumed; a refusal, API error or twice-malformed answer marks only that claim as errored. Requests use the API's server-side refusal fallback (`fallbacks: "default"`).
- **Long articles** are cut to 8,000 characters, and the results show a notice saying so.

### API

- `POST /api/check` with `{ "text": "..." }` or `{ "url": "https://..." }` returns a `text/event-stream`. Validation, rate-limit and URL errors return JSON `{ error: { code, message } }` with status 400/413/422/429/500.
- `GET /api/check/:id` returns the saved check as JSON (404 if unknown).

### Pages

`/` check form and live results · `/check/[id]` permalink · `/history` last 20 checks · `/how-it-works` method and disclaimer.

## Project layout

```
app/                 pages + API routes (App Router)
components/          UI (form, streaming hook, result cards, summary)
lib/prompts.ts       all prompts
lib/schemas.ts       Zod schemas and types
lib/pipeline.ts      extract → verify (concurrency 3) → summarise
lib/llm.ts           JSON parse/retry helpers, search-result helpers
lib/providers.ts     server-only provider selection (Anthropic or Groq)
lib/groq.ts          Groq implementation (browser_search)
scripts/vault.sh     macOS Keychain key vault
lib/extract-url.ts   URL fetch (SSRF guard, redirects, size/time limits) + Readability
lib/rate-limit.ts    sliding-window per-IP limiter
lib/db/              Drizzle schema + libSQL/SQLite access
tests/               Vitest suites
```

## Deploying to Vercel

1. **Use a hosted database.** Vercel's filesystem is ephemeral, so a local SQLite file won't persist. Create a free [Turso](https://turso.tech) database (libSQL, SQLite-compatible):
   ```bash
   turso db create truthlens
   turso db show truthlens --url      # → DATABASE_URL
   turso db tokens create truthlens   # → DATABASE_AUTH_TOKEN
   ```
   The table is created automatically on first use. To manage it with Drizzle instead, run `npx drizzle-kit push`.
   Alternatively, add Turso from the Vercel project's **Storage** tab. It sets `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`, which the app reads when `DATABASE_URL` isn't set. Leave per-deployment database branching off so every deploy shares one database.
2. Push the repo to GitHub and import it in Vercel. The framework preset is detected automatically.
3. Add the environment variables `GROQ_API_KEY` or `ANTHROPIC_API_KEY`, plus `DATABASE_URL` and `DATABASE_AUTH_TOKEN`. On Vercel these live in the project's encrypted environment settings; the Keychain vault is for your own machine.
4. Deploy. `/api/check` sets `maxDuration = 300` because researching a dozen claims can take a few minutes. Hobby plans cap function duration lower, so lower `MAX_CLAIMS` in `lib/schemas.ts` or use a Pro plan.

**Keep jsdom on 26.x.** jsdom 27 and later load ES-only dependencies with `require()`, which fails on Vercel's runtime with `ERR_REQUIRE_ESM` and breaks every `/api/check` request.

`vercel deploy` from your machine skips the files in `.vercelignore` (the local database, `.env*` files).

**Rate limiting on Vercel:** the limiter is in memory, so each serverless instance keeps its own count. For a strict global limit, back `RateLimiter` with Redis (for example Upstash) or the database.

## Security notes

- API keys are only read in `lib/providers.ts`, which imports `server-only`. Locally they can live in the macOS Keychain instead of a file.
- URL fetching allows only http(s), blocks private, loopback and link-local addresses (including on each redirect), and enforces a 10-second timeout and a 3 MB size limit.
- User text is wrapped in tags and treated as data in the prompts.
- Saved checks are public to anyone with the link and appear on `/history`.
