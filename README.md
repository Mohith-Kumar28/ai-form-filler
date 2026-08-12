# AI Form Filler

Fills any form — job applications, Google Forms, event registrations — from your own
knowledge base, in your own writing voice.

Unlike every existing autofill extension, this isn't limited to job applications and isn't a
fixed profile-field mapper. You feed it resumes, transcripts, LinkedIn/GitHub URLs, and past
answers; it answers arbitrary questions from that corpus and learns your voice from what you
accept.

## Layout

```
apps/
  api/                 Hono on Cloudflare Workers — D1, KV, R2
  extension/           WXT + React 19 + Tailwind v4 (MV3)
packages/
  shared/              Zod contract shared by both sides
  form-adapters/       Pure DOM logic, unit-testable without a browser
```

`packages/shared` is the contract. A schema change there breaks the build on both sides
rather than breaking production.

## Two invariants

**1. The LLM output schema is fixed and global.** `generateObject` synthesises a new tool per
schema, and prompt caching hashes `tools → system → messages` in that order — so a per-form
schema silently invalidates the cached profile on every request. Form structure travels in
the **user message**, never in the tool definition. Guard: `cache_read_input_tokens > 0` on a
repeat call.

**2. Quota is enforced server-side.** We hold the provider keys, so every free-tier call is a
real liability. The extension never decides whether a request is allowed.

## Setup

Prerequisites: Node 22+, pnpm 10+, a Cloudflare account, a Google Cloud project.

```sh
pnpm install
```

The API client is **generated** from the backend's OpenAPI document — never hand-written:

```sh
pnpm --filter @aff/extension api:generate   # emits openapi.json, then runs orval
```

Adding a route in `apps/api/src/routes/` is the only step needed to get a typed TanStack
Query hook in the extension. `apps/extension/src/generated/` is a build artifact: it is
wiped on every run, excluded from lint, and must never be hand-edited.

### 1. Cloudflare resources

```sh
cd apps/api
pnpm exec wrangler d1 create aff-db          # → copy database_id into wrangler.toml
pnpm exec wrangler kv namespace create RATE_LIMIT   # → copy id into wrangler.toml
pnpm exec wrangler r2 bucket create aff-uploads
pnpm db:migrate:local
```

### 2. Google OAuth client

The extension authenticates with `chrome.identity`, which requires an OAuth client bound to
a **specific extension ID** — so the extension has to exist before the client can be created.

1. Build and load the extension once to get its ID:
   ```sh
   pnpm --filter @aff/extension build
   ```
   Open `chrome://extensions`, enable Developer mode, **Load unpacked** →
   `apps/extension/.output/chrome-mv3`. Copy the extension ID.

2. In Google Cloud Console → APIs & Services → Credentials → **Create credentials** →
   **OAuth client ID** → application type **Chrome Extension**. Paste the extension ID.

3. Put the resulting client ID in **both** places — they must match, or `getAuthToken`
   returns a token our server then rejects with `INVALID_TOKEN`:
   - `apps/extension/wxt.config.ts` → `manifest.oauth2.client_id`
   - `apps/api/.dev.vars` → `GOOGLE_CLIENT_ID`

4. Also set `EXTENSION_ORIGIN=chrome-extension://<your-extension-id>` in `.dev.vars`, or CORS
   will reject the extension in production.

### 3. Local secrets

```sh
cd apps/api
cp .dev.vars.example .dev.vars
openssl rand -base64 48        # → JWT_SECRET
```

`.dev.vars` is gitignored. In production use `wrangler secret put <NAME>`.

### 4. Run

```sh
pnpm dev     # Worker on :8787 and the extension watcher, in parallel
```

Reload the unpacked extension after the first build so it picks up the OAuth client ID.

## Verification

```sh
pnpm typecheck && pnpm test && pnpm lint
```

Smoke-test the Worker without the extension:

```sh
curl -s localhost:8787/health
curl -s localhost:8787/v1/me                                  # → 401 UNAUTHENTICATED
curl -s -X POST localhost:8787/v1/auth/google \
  -H 'Content-Type: application/json' -d '{"accessToken":"bogus"}'   # → 401 INVALID_TOKEN
```

## Build phases

| # | Phase | Status |
|---|---|---|
| 1 | Skeleton — monorepo, contract, Worker, extension shell, Google auth | ✅ done |
| 2 | Profile ingestion — sources, parsing, `PROFILE_DOC` compilation | ✅ done |
| 3 | Fill core — generic adapter, tier router, caching verified | ⬅ in progress |
| 4 | Magic layer — overlay, positioning, fill animation, feedback loop | |
| 5 | Site adapters — Google Forms, Greenhouse/Lever/Ashby, Workday (stretch) | |
| 6 | Monetization — Stripe, quota UI, privacy policy, Web Store listing | |

Phase 3 is the proof point: it verifies caching works and produces real cost-per-form numbers
from `fill_log` before any of the presentation layer gets built.

**See [HANDOFF.md](./HANDOFF.md)** for the full engineering brief — architecture, hard
invariants, per-phase checklists with acceptance criteria, and the gotchas worth reading
before touching related code.

## Before public listing

Resumes, transcripts, and essays transit our server, so the Chrome Web Store requires a
privacy policy URL and accurate data-use disclosures. Not a build blocker; is a launch blocker.
