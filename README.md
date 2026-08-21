# Fillaform — AI Form Filler

An AI form filler for any form — job applications, Google Forms, event registrations —
answering from your own knowledge base, in your own writing voice.

Unlike every existing autofill extension, this isn't limited to job applications and isn't a
fixed profile-field mapper. You feed it resumes, transcripts, LinkedIn/GitHub URLs, and past
answers; it answers arbitrary questions from that corpus and learns your voice from what you
accept.

## Layout

```
apps/
  api/                 Hono on Cloudflare Workers — D1, KV, Browser Rendering
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
   pnpm dev            # leave running: rebuilds and live-reloads on every save
   pnpm ext:path       # prints the exact folder to load
   ```
   Open `chrome://extensions`, enable Developer mode, **Load unpacked** →
   `apps/extension/.output/chrome-mv3-dev`. Copy the extension ID.

   > **Load `chrome-mv3-dev`, not `chrome-mv3`.** They are two separate builds:
   > `pnpm dev` writes the first and keeps it reloading; `pnpm build` writes the second,
   > and only when you run it. Pointing Chrome at the wrong one looks exactly like a fix
   > not working — the extension just stays on whatever was last written to the folder it
   > is watching, and nothing anywhere reports an error. Each detection logs
   > `[aff <version>]` to the console, so you can always confirm which build a tab is on.

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

## Commands

Everything is driven from the repo root. `pnpm run` lists them all.

### Daily

| Command | What it does |
|---|---|
| `pnpm dev` | Migrates the local DB, then runs the Worker on `:8787` **and** the extension watcher together. The extension hot-reloads on save — WXT prints `Reloaded: content` and Chrome picks it up with no manual refresh. |
| `pnpm dev:api` | Worker only |
| `pnpm dev:ext` | Extension only (opens a Chrome profile with it loaded) |
| `pnpm dev:ext:firefox` | Same, for Firefox |
| `pnpm check` | typecheck + test + lint — the gate `ship` runs first |
| `pnpm test:watch` | Adapter tests in watch mode |
| `pnpm format` | Apply Biome formatting and safe fixes |

### First run on a new machine

```sh
pnpm bootstrap      # install, migrate, generate the API client, then report what's missing
pnpm cf:create      # create D1 + KV and write the ids into wrangler.toml
pnpm secrets:list   # every secret, what it's for, and which are still unset
pnpm check:env      # re-check until everything is ✓
```

`cf:create` writes the returned resource ids straight into `wrangler.toml`. Doing that by
hand is the usual way a first deploy fails — the id lands in the wrong environment block and
the Worker deploys with a binding silently missing.

### Ship

| Command | What it does |
|---|---|
| `pnpm ship` | `check` → migrate production D1 → deploy to production |
| `pnpm ship:staging` | Same against the staging environment |
| `pnpm ship:dry` | Bundle and resolve bindings without deploying — verifies config |
| `pnpm secrets:push` | Push `.dev.vars` values to a deployed environment via stdin (never as argv, which would land in shell history) |
| `pnpm tail` | Live production logs |
| `pnpm zip` | Package the extension for the Web Store |

> **Why `ship` and not `deploy`?** `pnpm deploy` and `pnpm doctor` are pnpm builtins and
> silently shadow same-named scripts — `pnpm deploy` would run pnpm's own command instead of
> deploying. Hence `ship` and `check:env`.

### Database

| Command | What it does |
|---|---|
| `pnpm db:generate` | Generate a migration from `schema.ts` (needs a TTY) |
| `pnpm db:migrate` | Apply migrations locally |
| `pnpm db:migrate:prod` | Apply to production |
| `pnpm db:reset` | Wipe local state and re-migrate |
| `pnpm db:query "SELECT …"` | Ad-hoc local query |
| `pnpm db:costs` | **Real cost per form from `fill_log`** — and a warning if the prompt cache has never been hit |

`pnpm db:costs` is how `PLAN_LIMITS.free` gets sized. It is a placeholder until that number
comes from this command rather than an estimate.

### Contract

| Command | What it does |
|---|---|
| `pnpm api:generate` | Emit `openapi.json`, then regenerate the typed client and hooks |
| `pnpm api:spec` | Emit `openapi.json` only |

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
| 3 | Fill core — generic adapter, tier router, caching verified | ✅ built¹ |
| 4 | Magic layer — overlay, positioning, fill animation, feedback loop | ✅ built¹ |
| 5 | Site adapters — Google Forms, Greenhouse/Lever/Ashby | ✅ built¹ (Workday deferred) |
| 6 | Monetization — Dodo Payments, quota UI, privacy policy, Web Store listing | ⬅ in progress |

¹ Built and unit-tested, but **not yet exercised against a live model or a real browser** —
both need credentials only you can create. See "Before this is real" below.

**See [HANDOFF.md](./HANDOFF.md)** for the full engineering brief — architecture, hard
invariants, per-phase checklists with acceptance criteria, and the gotchas worth reading
before touching related code.

## Before this is real

Two things are blocked on credentials, and neither can be faked:

1. **`OPENROUTER_API_KEY`** in `apps/api/.dev.vars` — until this exists, the caching
   assertion (`cacheReadTokens > 0` on a repeat fill) has never run. That assertion is the
   entire cost model; if it fails, every per-form number is off by roughly 10×.
2. **A Google OAuth client ID** (setup §2) — sign-in, and therefore the live browser run,
   cannot be exercised without it.

## Before public listing

Resumes, transcripts, and essays transit our server, so the Chrome Web Store requires a
privacy policy URL and accurate data-use disclosures. Not a build blocker; is a launch blocker.
