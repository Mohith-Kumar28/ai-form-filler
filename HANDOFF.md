# Fillaform — Engineering Handoff

**Purpose of this document.** Everything needed to continue building this project cold —
architecture, hard invariants, what exists today, what's left, and the traps. Written so
another engineer or assistant can pick it up without prior context.

**Status:** Phases 1–2 complete and verified. Phase 3 is next and is the project's proof point.

**Last verified:** all 3 packages typecheck, 54 tests pass, extension builds to a valid MV3
bundle, Worker boots and serves every implemented route.

---

## 1. What this product is

Fills any web form — job applications, Google Forms, event registrations, ATS portals — from
a personal knowledge base, in the user's own writing voice, surfaced by a Grammarly-style
inline affordance.

**The competitive gap.** Every existing tool (Simplify Copilot, JobFill, CareerBoom,
JobWizard, LazyApply, Teal) is job-application-only and works by mapping a *fixed profile
schema* onto known ATS field names. None builds a general knowledge base, and none learns
writing style. This product answers arbitrary questions from an arbitrary corpus.

**Business model.** Hosted SaaS. We hold the provider API keys. Free tier of 50 forms/month,
Pro upgrade via Stripe. Explicitly **not** bring-your-own-key — BYOK makes the extension
undistributable to the actual audience.

---

## 2. The two hard invariants

Break either and the product silently becomes uneconomic or unsafe. Neither fails loudly.

### 2.1 The LLM output schema is fixed and global

```
system: [ STATIC_INSTRUCTIONS ]
        [ PROFILE_DOC  ← cache_control breakpoint, 1h TTL ]
tools:  [ SUBMIT_FILLS ]   ← byte-identical for every request, forever
user:   [ form schema JSON, retrieved answers, page context ]  ← everything variable
```

**Why.** Vercel AI SDK's `generateObject` runs in tool-calling mode and synthesises a *new
tool per schema*. Prompt caching hashes `tools → system → messages` in that order, so a
per-form schema invalidates the cached ~10k-token profile on **every single request**. There
is no error — just `cache_read_input_tokens: 0` and a bill 10× larger than modelled.
(Reference: `vercel/ai` issue #5227.)

**The fixed schema:** `{ fills: [{ fieldId, value, confidence, reasoning }] }` — identical for
every form on earth. Form structure goes in the user message.

**Guard:** integration test asserting `cache_read_input_tokens > 0` on a second identical call.

**Currently inert, and load-bearing anyway.** All three tiers in `MODELS` are Gemini with
`supportsCaching: false`, so nothing is cached today and *every* prompt token is billed at full
input price. That makes prompt size a direct cost, which is why `PROFILE_DOC` holds only what
does not grow with use. The invariant above still governs: the moment a
tier moves to an Anthropic model, a per-form schema would silently cost 10×.

### 2.2 Quota is enforced server-side, before any provider call

Every free-tier call spends our money. The extension never decides whether a request is
allowed. Order on `/v1/fill` is `auth → rateLimit (KV) → quota (D1) → handler`, and estimated
cost is checked against remaining quota *before* the provider call, with actual usage written
to `fill_log` after.

---

## 3. Architecture

```
apps/
  api/                Hono on Cloudflare Workers — D1, KV, Browser Rendering
  extension/          WXT + React 19 + Tailwind v4 (MV3)
packages/
  shared/             Zod contract imported by both sides
  form-adapters/       Pure DOM logic, unit-testable without a browser  [NOT YET BUILT]
```

`packages/shared` is the contract. A schema change breaks the build on both sides rather
than breaking production. It is deliberately **runtime-agnostic** — no `chrome.*`, no
Workers globals — so the Worker can import it. The `chrome`-dependent message helper lives
in `apps/extension/src/lib/messaging.ts` for exactly this reason.

### The API client is generated, never hand-written

```
packages/shared         Zod schemas — single source of truth
      ↓
apps/api/src/openapi/schemas.ts    names them as OpenAPI components
      ↓
apps/api/src/routes/*.ts           createRoute() + OpenAPIHono
      ↓  pnpm --filter @aff/api openapi:emit
apps/api/openapi.json              committed, so contract drift shows up in review
      ↓  orval
apps/extension/src/generated/      typed client + TanStack Query hooks
```

Adding a server route is the *only* step needed to get a typed hook in the extension.
Regenerate with `pnpm --filter @aff/extension api:generate`.

**Never hand-edit `src/generated/`** — it is a build artifact, excluded from biome, and
wiped by `clean: true` on every run. The three things a spec cannot express live in
`src/lib/http-client.ts`: base URL, bearer auth from `chrome.storage`, and turning the
`ApiError` envelope into a typed throw.

### Stack decisions and why

| Layer | Choice | Rationale |
|---|---|---|
| Extension framework | **WXT 0.20** | 2026 market leader; Vite-based, actively maintained, cross-browser. Plasmo has maintenance concerns; CRXJS development has slowed. |
| Server state | **TanStack Query + chrome.storage persister** | MV3 service workers are torn down aggressively and the side panel unmounts on close — an in-memory cache is empty on every open. |
| Backend | **Hono on Workers** | Edge latency, generous free tier, trivial Stripe webhooks. |
| Database | **D1 + Drizzle** | SQLite at the edge. Holds accounts, the compiled profile, quota, and the cost log — not documents. |
| Memory | **Supermemory** | Owns ingestion of every format (PDF, image, audio, video, and URLs it scrapes itself), storage of originals, and semantic retrieval. Replaced an R2 bucket, a Cloudflare AI Search index, a PDF parser, and a BM25 answer bank — four hand-built parts doing one job worse. |
| LLM access | **Vercel AI SDK + Cloudflare AI Gateway (Unified Billing)** | One interface, per-tier model swap without touching call sites, and no provider accounts — credits sit with Cloudflare. |
| Auth | **chrome.identity Google OAuth → server JWT** | One click, no password UI. |

### The fill pipeline (phase 3 — not yet built)

```
[content script] detect form → build FormSchema (fields, labels, kinds, options, context)
      ↓ chrome.runtime port (NOT sendMessage — see §7.3)
[service worker] attach JWT → POST /v1/fill
      ↓
[Worker] auth → rate limit → quota → tier router → batched LLM calls → FillPlan
      ↓
[content script] apply with staggered animation → user reviews/edits → confirm
      ↓
[content script] on submit, adapter.readValue() every field → only what differs
      ↓
[Worker] POST /v1/feedback → routed to one of three stores (below)
```

The feedback loop is what makes the product compound, and **where an answer is stored decides
whether it ever comes back.** Two destinations, and the split is deliberately narrow:

| Answer | Store | Read back by |
|---|---|---|
| Identity — phone, email, name, location, links | `Profile.identity` typed slots | Tier 0 lookup. No model call, no retrieval. |
| Everything else — choices, short answers, essays | Supermemory | One semantic search **per question**, at fill time. |

Identity is the one thing a memory layer structurally cannot do for us: retrieval returns
passages, and a passage is not a value you can type into an email field. It is also a fixed
nine-slot schema the user edits by hand, so it does not grow with use.

**The trap this replaced, recorded because it cost two rewrites.** Short answers were not coming
back — a dropdown answer like "iOS" was learned and then never retrieved, however many times the
user picked it. The diagnosis was "search cannot rank a six-character answer against a résumé",
and the fix was a third store: `profile.learned`, question→answer, with an exact-match lookup and
a block compiled into `PROFILE_DOC`.

Both the diagnosis and the fix were wrong.

- **The real cause was the query.** Retrieval ran *once per form*, with every field label
  concatenated into a single string. That is meaningless to an embedding index: it returns
  passages near the average of the form and specific to nothing. One search per question — which
  is what the index is built for — makes a short answer findable immediately.
- **The third store then cost more than it bought.** 80 answers is ~2,000 tokens (~13,000 with
  long multi-selects), and no model in `MODELS` supports explicit caching, so it was billed at
  full input price on every call of every fill and grew with every submission: $0.015–$0.10 per
  form against a whole-form budget of ~$0.008. Its exact-match lookup fired only when a later
  form asked a question in byte-identical words, which across different sites is rare.

What survived from that work, and matters: **reading the page is the adapter's job**
(`FormAdapter.readValue`, symmetrical with `applyValue`). A helper that understood native
controls only returned `null` for every ARIA widget on Google Forms and read just the first
control of a native radio group, so no choice field on any site could be learned at all. And
`matchOptions` in `@aff/shared` resolves an answer against an option list without splitting on
commas — option labels contain them, and splitting silently dropped selections while reporting
success, in three separate places.

`scripts/migrate-learned-to-memory.mjs` moves any remaining `learned` rows into Supermemory and
drops the field. Run once per environment: `pnpm db:migrate:learned [--remote]`.

### The tier router — the core cost lever

Most fields on a real form are deterministic and must never reach a model.

| Tier | Trigger | Handler | ~Cost/form |
|---|---|---|---|
| **0** | Label/autocomplete matches identity pattern (name, email, phone, URL, DOB, address) | Pure lookup from `Identity`. **No LLM.** | **$0** |
| **1** | Enumerable choice — select/radio with fixed options | Gemini 2.5 Flash Lite ($0.10/$0.40 per MTok) | ~$0.0016 |
| **2** | Short free text, `maxLength < 300` or single-line | Gemini 2.5 Flash ($0.30/$2.50) | ~$0.006 |
| **3** | Textarea, or label matches essay heuristics (`why`, `describe`, `tell us`, `cover letter`) | Gemini 2.5 Pro, with memory retrieval | ~$0.01 |

A 50-form free tier costs roughly **$0.30/user** if most fields land in tiers 0–1. **The
router matters more than the model choice** — that's the difference between $0.008 and $0.05
per form.

**No quality slider.** There was a `quality: 'auto' | 'high'` toggle ("take more care with
written answers") that escalated every generative field to tier 3. Removed: tier 3 is $1.25/$10
per MTok against tier 2's $0.30/$2.50, so one checkbox quadrupled the cost of a form on our own
key — and it asked the user to make a judgement they have no basis for. Essays route to tier 3 on
their own, which is the only case it was ever really for.

**Caching economics caveat:** a 5-minute cache write bills at 1.25×, so a user who fills
exactly one form and leaves is marginally *more* expensive than no caching. Break-even is two
requests. The 1h TTL plus job-hunting burst behaviour puts real usage well past that.

---

## 4. What exists today

### Phase 1 — Skeleton ✅

**`packages/shared`** — the contract.

| File | Contents |
|---|---|
| `form.ts` | `FieldKind` (12 behaviours, not tags), `FieldSchema`, `FormSchema`. Origin only, never full URLs — query strings leak PII. |
| `fill.ts` | `FillTier`, `Fill`, `Skip`, `FillUsage`, `FillPlan`, `FillRequest`, `FeedbackRequest`. `REVIEW_CONFIDENCE_THRESHOLD = 0.7`. |
| `profile.ts` | `Identity`, `EducationEntry`, `ExperienceEntry`, `StyleProfile`, `ProfileSource`, `Profile`. |
| `account.ts` | `Plan`, `PLAN_LIMITS` (free: 50, pro: 2000), `QuotaState`, `Account`. |
| `api.ts` | `ApiErrorCode`, `ApiError`, `ApiErrorResponse` class, `HTTP_STATUS_FOR_CODE`. |
| `messages.ts` | Extension message union, `FillPortRequest`/`FillPortEvent`, `FILL_PORT`. |

**`apps/api`** — Worker.

- `src/auth/google.ts` — access-token introspection. **See §7.1 for the security-critical part.**
- `src/auth/session.ts` — HS256 JWTs via `jose`, 30-day TTL, issuer/audience pinned.
- `src/db/schema.ts` — 7 tables (see §5).
- `src/middleware/error.ts` — single error exit point; unknown throws flattened to `INTERNAL` so stack traces never reach clients.
- `src/middleware/auth.ts` — populates `userId` + `account`.
- `src/routes/auth.ts`, `me.ts` — sign-in and account.
- `src/services/account.ts` — user upsert, UTC quota period math.

**`apps/extension`** — MV3 shell.

- `entrypoints/background.ts` — message router. Every branch returns `true` to keep the async channel open.
- `lib/api.ts` — single path to the Worker; clears the token on 401 so a dead session can't be retried forever.
- `lib/auth.ts` — sign-in/out. **Revokes with Google on sign-out** or `getAuthToken` returns the same cached token and the user can never switch accounts.
- `lib/query.ts` — QueryClient + `chrome.storage` persister. Does not retry 401/402/400.
- `lib/storage.ts` — typed `chrome.storage.local` wrapper (the API is typed as returning `{}`).

**Verified live:** `/health` 200; `/v1/me` unauthenticated 401; bad token 401; malformed body
400 with Zod field paths; bogus Google token 401 via real round-trip to Google; valid JWT
returns a correct `Account` with `limit: 50` and next-month `resetsAt`.

### Phase 2 — Profile ingestion ✅

- `src/profile/compile.ts` — **the deterministic `PROFILE_DOC` compiler.** SHA-256 hash, token estimate. 21 tests specifically protecting the cache invariant.
- `src/profile/extract.ts` — heuristic identity extraction (email, phone, links) via regex. Deliberately not an LLM: those fields are *structural*, so a model adds latency, cost, and non-determinism to a solved problem.
- `src/profile/parse.ts` — HTML-to-text for URLs and freeform passthrough, 200k char cap. No PDF parser: files go to the multimodal structuring pass and to Supermemory as-is.
- `src/profile/structure.ts` — the ingest structuring pass. Takes text *or* a raw file; Gemini reads PDFs, scans, and photos natively, so one call replaces a PDF parser, a separate transcription call, and the "paste the text instead" dead end.
- `src/services/supermemory.ts` — ingestion, retrieval, deletion. Every call returns `null`/`[]` on failure: memory degrades answer quality, it never fails a fill.
- `src/services/profile.ts` — recompile-on-mutation, version bump **only when the hash changes**.
- `src/routes/profile.ts` — GET/PATCH profile, POST/DELETE sources.
- Side panel — Sources tab (upload/link/paste + list) and Details tab (identity editor).

**Verified live:** identity auto-extraction from raw text; PDF upload through the Worker;
version stability across no-op and reordered edits; identity merge preserving extracted
fields; the stored original actually deleted on source deletion; all error paths returning
actionable messages.

---

## 5. Database schema (D1)

| Table | Purpose | Notes |
|---|---|---|
| `users` | Accounts | Unique index on `google_sub` — email changes, subject doesn't. |
| `profile_sources` | Uploaded/pasted sources | `extracted_text` holds the structured summary that feeds `PROFILE_DOC`; `memory_id` points at the Supermemory document holding the full original. |
| `profile_docs` | Compiled prompt prefix, one row per user | `hash` guards the caching invariant. `structured_json` holds the whole structured Profile. |
| `fill_log` | One row per fill request | Per-tier counts, token breakdown, `cost_micro_usd`, latency. **This is how you find out whether the free tier is affordable.** |
| `quota_usage` | Monthly counters keyed `YYYY-MM` | Separate from `fill_log` so the quota check is an indexed point-read. |
| `subscriptions` | Stripe state | Phase 6. |

Costs are stored in **micro-dollars as integers** — no float rounding anywhere near money.

---

## 6. Remaining work

### Phase 3 — Fill core ⬅ IN PROGRESS

**No overlay in this phase** — trigger from the side panel button. The goal is to prove the
concept and get real cost numbers before building any presentation layer.

- [x] `packages/form-adapters` scaffold + `FormAdapter` interface
- [x] `generic.ts` adapter: native inputs, textareas, selects, radio/checkbox groups, `contenteditable`
- [x] Label resolution chain, with the ancestor-text fallback stopping before `<body>`
- [x] **React controlled-input write technique** (§7.2), with a regression test that shadows the instance-level `value`
- [x] `router/classify.ts` — tier classification, specific-before-catch-all label ordering
- [x] `router/tier0.ts` — deterministic identity resolution, no model call
- [x] `llm/prompt.ts` — fixed global tool schema + cache breakpoint
- [x] `llm/generate.ts` — `generateText` (not `generateObject`) over AI SDK + OpenRouter
- [x] `llm/models.ts` — per-tier model + pricing, cost in integer micro-dollars
- [x] Supermemory retrieval for tier 3
- [x] `POST /v1/fill` with `rateLimit` (KV) + `enforceQuota` (D1) middleware
- [x] `POST /v1/fill/feedback` → memory
- [x] `fill_log` written on every request, including zero-cost ones
- [x] Content script: detect forms, build `FormSchema`, hold the `fieldId → Element` map
- [x] Fill port protocol in the background script (progress events, disconnect handling)
- [x] Side-panel fill button applying the `FillPlan`, with review and skip summaries
- [x] Round-trip test: detect a realistic ATS-shaped form → apply a plan → assert the DOM
- [ ] **Caching integration test — assert `cacheReadTokens > 0` on a repeat call** ⚠️ blocked
- [ ] Run 20 representative forms, query `fill_log`, **size the free tier from real data** ⚠️ blocked

⚠️ **Both remaining items need a real `OPENROUTER_API_KEY` in `apps/api/.dev.vars`.**
Everything up to the model call is verified; the caching assertion is the one thing that
cannot be faked, and it is the assertion the entire cost model rests on. Run it before
trusting any per-form cost number.

**Verified live:** tier-0-only form fills 3/5 fields at $0 and 1 ms, skipping the two it has
no data for rather than inventing them; `PROFILE_NOT_READY` 409 before any source exists;
rate limiter cuts to 429 at 12/min with a `retryAfter`; quota exhaustion returns 402 carrying
`{used, limit, resetsAt}`; feedback stores 1 of 2 entries (a bare "Yes" filtered as carrying
no reusable signal); the
round-trip test writes text, select-by-visible-label, radio, checkbox, and textarea into a
realistic form and asserts the resulting DOM.

**Acceptance:** a real form fills correctly from the side panel; a second identical request
shows a nonzero cache read; `fill_log` yields a mean cost per form.

### Phase 3 message flow

```
side panel ──port(FILL_PORT)──> service worker
                                      │ 1. tabs.sendMessage content/detect
                                      ▼
                                content script ──> FormSchema  (element map stays here)
                                      │ 2. POST /v1/fill  (generated client)
                                      ▼
                                   Worker ──> FillPlan
                                      │ 3. tabs.sendMessage content/apply
                                      ▼
                                content script ──> ApplyReport {applied, failed}
side panel <──progress/complete──────┘
```

A port rather than `sendMessage`: a tier-3 fill can take 10s+, and an MV3 worker can be
killed mid-flight — the port's disconnect is the only reliable signal that happened. The
side panel sends a `tabId`, never a `FormSchema`; it has no access to the page.

### Phase 4 — The magic layer ✅ built

- [x] Closed Shadow DOM host with inlined styles (`overlay/host.ts`)
- [x] Floating launcher pill, anchored to the form, appearing on detection (3+ fields)
- [x] **Single rAF-batched positioning scheduler** (§7.4) — never a per-field listener
- [x] `IntersectionObserver` + `ResizeObserver` + capture-phase scroll + ~1s polling backstop
- [x] Two-phase measure: all reads, then all writes, so one forced reflow instead of N
- [x] Staggered fill animation in DOM order, ~25ms/char typing capped at 400ms/field
- [x] Per-field markers: active / filled / review / failed
- [x] `prefers-reduced-motion: reduce` → immediate writes, no stagger, no typing
- [x] Feedback capture on submit → `/v1/fill/feedback`
- [ ] Perf check: <2ms/frame main-thread with 50+ fields ⚠️ needs a real browser

**One-click path.** The launcher sends `overlay/requestFill`; the background opens the side
panel and runs the same `runFillFlow` the panel's port uses. `sidePanel.open` must be called
synchronously inside the message handler — Chrome only permits it during a user gesture, and
awaiting anything first loses it.

**Feedback capture** listens for `submit` in the capture phase *and* `pagehide`, because many
real forms post via `fetch` and redirect without ever firing a submit event. It reports once
per fill, drops cleared fields (a rejection is not an answer), and reads a select's visible
label rather than its opaque option value — "United States" carries meaning into the answer
bank, "opt_1" does not.

### First run — the panel's own eight screens

`sidepanel/onboarding/` is the flow a signed-in account with nothing in it gets instead of Home.
Five screens explain the product (each with a small live demo rather than a screenshot of a 400px
panel inside a 400px panel), then two ask for work — ten catalogue fields, five of them required,
and at least one source — and the last shows what was built: facts, sources, characters read.

Three things about it are load-bearing:

- **The asking comes last, and money comes after that.** Nothing in the flow mentions plans or
  prices; the paywall still lands at the first Fill (§ `usePaywallSeen`, and the note in
  `paywall.ts`). Somebody who has typed their own notice period and watched their own résumé being
  read is a different prospect from somebody who has seen a price tag and no product.
- **Whether to run it at all is `resolveOnboarding` in `lib/onboarding.ts`,** a pure function with
  its own tests. The flow shipped after the extension did, so an account with facts or sources and
  no stored record has already onboarded; that decision is written down rather than re-derived, or
  a user who skipped the tour would meet it again on every open. `step` is persisted too — the
  panel gets closed constantly, because the form the user came for is behind it.
- **It is not a screen on the navigation stack.** It owns the whole panel including the tab bar, so
  it cannot be half-escaped, and both gated steps carry a plain "Later" — a gate with no bypass is
  a trap.

The hero mark is `onboarding/blob.tsx`: the brand face on a body that morphs between four
silhouettes. The morph is an SVG `<animate>` on `d` (CSS cannot interpolate a path), which means
every value must share one command structure — hence `blobPath`, which generates all of them from
radii. It is also the one animation in the project that `prefers-reduced-motion` cannot switch off
from the stylesheet, because it is markup: `useReducedMotion` drops the element instead.

### The paywall the *page* asks for

Pressing the launcher with nothing left to spend used to draw a small offer card over the user's
form. It now opens the side panel and shows the real sheet there (`overlay/paywall` →
`usePendingPaywall`). Two constraints shaped it:

- `chrome.sidePanel.open` needs a live user gesture, and asking the API for the quota first spends
  it. So the content script **caches** the quota (`refreshQuota`, on launcher mount, after every
  fill, and on `visibilitychange` — the last one because checkout happens in another tab) and the
  click acts on the cached value with nothing awaited.
- Chrome may refuse anyway. The message answers `{ opened }`, and a `false` falls back to the
  in-page card, so a refused fill never ends in silence.

Which offer to make is `offerFor(limit)` in `@aff/shared/constants`, shared by the panel and the
page: a limit of zero has never subscribed and is offered the trial, anything else has run out of a
plan it pays for and is offered the comparison.

### 7.10 The content script bundle is a tax on every page

It loads on **every page the user visits**, so its size is not an internal concern.

Importing a single runtime value from `@aff/shared` pulls all of zod in behind it — that
alone took the content script from 11 kB to **93 kB**. Runtime constants therefore live in
`packages/shared/src/constants.ts`, which imports nothing, and are re-exported from the
schema modules so there is still one definition. The content script imports them via
`@aff/shared/constants`.

Check after touching content-script imports:

```sh
pnpm --filter @aff/extension build   # content.js should stay ~20 kB
grep -c ZodError apps/extension/.output/chrome-mv3/content-scripts/content.js   # must be 0
```

### Phase 5 — Site adapters

- [x] `google-forms.ts` — ARIA-role based: `[role=listitem]` questions, `[role=radio]`/`[role=checkbox]` divs, `[role=listbox]` dropdowns needing click-open → click-option
- [x] `ats.ts` — Greenhouse, Lever, Ashby. Extends the generic adapter; adds react-select
- [x] Adapter registry wired in `index.ts`, most-specific-first with generic as terminal fallback
- [ ] `workday.ts` — **stretch, 3–4 days on its own.** Nested shadow DOM, `wd-*` custom elements, multi-step wizards, aggressive re-rendering that discards early writes. Needs recursive `shadowRoot` traversal, `MutationObserver` settle-wait, per-step re-detection. If it slips, everything else still ships.
- [ ] Verify both against live pages ⚠️ needs a real browser

**Google Forms** has no `<form>` and almost no native inputs, so the generic adapter finds a
few stray text fields and misses every radio, checkbox, and dropdown. Everything is driven
off ARIA roles instead — semantically correct *and* far more stable than Google's generated
class names. Two things worth knowing: the required-question asterisk must be stripped from
the label (the model otherwise echoes it into answers), and dropdown options only exist once
the listbox has been clicked open, so selection is asynchronous.

**react-select** is the one control the generic path genuinely cannot handle: the visible
combobox is a div, and the backing input has no writable value. It must be driven the way a
person does — focus, *type* (the menu filters on input, and on a long list the right option
may not be rendered until it does), wait, then dispatch **mousedown**, which is the event
react-select actually listens for. `.click()` alone does not reliably select.

Both adapters were extended from a subclassing constraint worth noting: `GenericAdapter`'s
members are declared as `name: string`, `matches(_url: URL)`, and
`applyValue(): boolean | Promise<boolean>` rather than their inferred narrow types —
otherwise every override is a type error.

### Phase 6 — Monetization and launch

- [ ] Stripe Checkout + webhook → plan update
- [ ] Quota-exhausted UI (402 already carries real numbers)
- [ ] Upgrade flow in side panel
- [ ] **Privacy policy** — resumes/transcripts/essays transit our server; Chrome Web Store requires a policy URL and accurate data-use disclosures. Launch blocker.
- [ ] Web Store listing, screenshots, demo video
- [ ] Cost dashboard over `fill_log`

### Deferred / future

- [ ] LLM enrichment of education & experience at ingest (heuristics only do identity today)
- [ ] Style learning from accepted answers → `StyleProfile.exemplars`
- [ ] Vision model for image sources at ingest
- [ ] Multi-step wizard state across page navigations
- [ ] Firefox build (WXT supports it; `chrome.identity` needs swapping)

---

## 7. Gotchas — read before touching related code

### 7.1 Google token introspection: the `aud` check is load-bearing

`chrome.identity.getAuthToken` returns an OAuth **access token**, not an ID token — there is
no signature to verify locally. `auth/google.ts` introspects it with Google and **checks
`aud` against our client ID**.

Without that check, an access token minted for *any* Google OAuth app would authenticate
here — meaning any extension or website the user has ever granted a Google scope to could
impersonate them against our API. Do not remove it. The code also cross-checks that
`tokeninfo.sub === userinfo.sub` so the two responses can't describe different people.

Also: `getAuthToken`'s callback receives a `GetAuthTokenResult` object, not a bare string.

### 7.2 React controlled inputs revert a naive `.value` assignment

React tracks the previous value on the DOM node, so assigning `.value` is undone on the next
render. The working technique:

```ts
const setter = Object.getOwnPropertyDescriptor(
  window.HTMLInputElement.prototype, 'value'
)!.set!
setter.call(el, value)
el.dispatchEvent(new Event('input', { bubbles: true }))
```

`HTMLTextAreaElement` and `HTMLSelectElement` need their own prototype setters. This needs a
regression test against a real controlled component — it is easy to reintroduce.

### 7.3 Fill requests need a port, not `sendMessage`

An MV3 service worker can be killed mid-request. A one-shot `sendMessage` gives you no way to
notice; a `chrome.runtime.connect` port's disconnect event is the retry signal. Progress
events also need a port.

**This was documented and then violated, and the violation shipped.** The side panel used a
port; the page's launcher used a one-shot `overlay/requestFill` whose reply came ten seconds
later. The content script sets `filling = true` before asking and clears it only on a terminal
event, so one torn-down worker left the flag stuck and the "already filling" guard then
swallowed every later click in silence. Filling from the sidebar worked and pressing the button
on the page did nothing, for the rest of that tab's life — which read as though the page could
not touch the form unless the panel was open. It never needed the panel for that.

Both callers now open the same port (`registerFillPort`), which settles two things that follow
from it:

- **The tab comes from `port.sender.tab.id` when there is one.** A page able to *name* the tab
  to fill is a page able to ask us to fill somebody else's; the panel, which has no sender tab,
  still names one.
- **Each surface is told once.** Events go to the port's owner, plus the *other* surface — the
  panel for a page-initiated fill, the page for a panel-initiated one. Sending to the owner
  twice is not harmless: `tabs.sendMessage` is asynchronous, so a duplicate `complete` can
  arrive after the port has disconnected, which the page reports as an interrupted fill.

### 7.4 Overlay positioning is a genuine performance hazard

Grammarly's engineering write-up documents this: recomputing position at 60fps consumes
**>90% CPU on average hardware** on heavy sites. Rules:

- One shared rAF-batched scheduler. **Never a per-field scroll listener.**
- `getBoundingClientRect()` only when content or field size changes; scroll events translate
  the existing container instead.
- `IntersectionObserver` for visibility; ~1s polling as a backstop for layout changes no
  event reports.
- Cull fields outside the viewport.
- Render into a **closed Shadow DOM** so page CSS can't reach us and ours can't reach the page.

Three rules the culling makes necessary, each of which was a reported bug:

- **Report hidden, then cull.** Anything the overlay draws is placed at viewport coordinates
  and moves only when `onMove` says so, so a culled target freezes wherever it last was rather
  than disappearing. Skipping a target before telling it that it is hidden leaves a ring and a
  provenance tab painted over whatever the page now shows there.
- **A viewport change is not a scroll.** The side panel opening or closing relays out the page:
  centred content shifts sideways and every cached rect is wrong at once. `requestMeasure`
  honours the cull and trusts the observer, so it cannot repair this — `invalidate()` drops
  every cached rect and re-seeds visibility from geometry. Wired to `resize` and
  `visualViewport.resize`, and called once per field written during a fill, because writing an
  answer moves every field below it while changing no field's own size.
- **A detached anchor kills the whole mark.** Removing the label and keeping the ring is the
  same defect one element down. The handle must also go dead, or the fill animation's closing
  `setState('judged')` mounts a fresh tab against the stale rect — a label appearing *after*
  the question it describes has gone.

### 7.5 `PROFILE_DOC` must stay byte-stable

Sorted keys, explicit total orderings with tiebreaks, no timestamps, no IDs, no `Set`
iteration order. `compile.test.ts` has 21 tests enforcing this. **A failure there is a cost
incident, not a formatting nit.**

Two bugs already caught by these tests: skills dedup retaining first-seen casing (order
dependent), and a missing tiebreak on equal education dates.

### 7.6 Identity is merged field-by-field; everything else replaces

`PATCH /v1/profile` merges `identity` per-field but replaces arrays wholesale. Without this,
saving the name field wipes the auto-extracted email — silent data loss the user only
discovers when a form fills wrong. Clear an identity field by sending `""`.

### 7.7 Deleting a source must delete the stored original

Otherwise a user who deleted their resume still has it stored with us. That's a privacy
failure, not just wasted storage. `profile_sources.memory_id` exists for exactly this:
`deleteSource` returns it and the route awaits `deleteDocument` so a failure surfaces as a
retryable 5xx rather than silently leaving the document behind.

### 7.8 orval's `useQuery` / `useMutation` flags force themselves onto every operation

In `orval.config.ts`, `override.query.useQuery: true` generates a **query** hook for every
operation including POST/PATCH/DELETE — which then have no `.mutate`. Setting
`useMutation: true` does the inverse and turns GETs into mutations. Leave **both unset**;
orval then picks by HTTP method, which is what you want. Both were hit during the
conversion, and neither fails at generation time — only later, at the call site.

Also set `override.fetch.includeHttpResponseReturnType: false`, or every response type
becomes a `{ data, status }` union whose error arms are unreachable (the mutator throws)
but which every call site must still narrow.

### 7.9 Dependency landmines

- `@vitejs/plugin-react@6` requires **Vite ^8**. Pinned in `apps/extension`. Vite 7 fails with `Package subpath './internal' is not defined`.
- `@cloudflare/vitest-pool-workers` pins an older wrangler that conflicts with `@cloudflare/workers-types@5`. Removed; add back in phase 3 for Worker integration tests, resolving versions then.
- `pdf-parse` **cannot** run in a Worker (needs `fs`). We now parse no PDFs at all — the model reads them.
- `@supermemory/tools`' AI SDK wrapper targets `@ai-sdk/provider@4` (LanguageModelV2) while `ai@7` emits V4. It does not typecheck, and casting past it breaks at runtime. Use the REST API.
- `drizzle-kit generate` needs a TTY for rename-vs-recreate prompts. In CI, or when non-interactive, regenerate the init migration instead (safe while pre-release).
- `exactOptionalPropertyTypes: true` is on. `{ key: undefined }` and `{}` are different types, deliberately — an absent key means "don't change".

---

## 8. Commands

```sh
pnpm install
pnpm dev                       # Worker :8787 + extension watcher
pnpm typecheck                 # all 3 packages
pnpm test                      # 54 tests
pnpm lint                      # biome
pnpm --filter @aff/extension build

cd apps/api
pnpm db:generate               # after schema.ts changes (needs a TTY)
pnpm db:migrate:local
pnpm exec wrangler dev --port 8787 --local
```

**Smoke test without the extension:**

```sh
curl -s localhost:8787/health
curl -s localhost:8787/v1/me                       # 401 UNAUTHENTICATED
curl -s -X POST localhost:8787/v1/auth/google \
  -H 'Content-Type: application/json' -d '{"accessToken":"bogus"}'   # 401 INVALID_TOKEN
```

**Mint a test JWT** (matches `JWT_SECRET` in `.dev.vars`):

```sh
node --input-type=module -e '
import { SignJWT } from "./node_modules/jose/dist/webapi/index.js";
const key = new TextEncoder().encode("local-dev-only-not-a-real-secret");
console.log(await new SignJWT({}).setProtectedHeader({alg:"HS256"})
  .setSubject("u_test").setIssuer("aff-api").setAudience("aff-extension")
  .setIssuedAt().setExpirationTime("1h").sign(key));
'
```

---

## 9. Setup blockers for a new machine

1. **Cloudflare resources** — `wrangler d1 create aff-db`, `wrangler kv namespace create RATE_LIMIT`, `wrangler r2 bucket create aff-uploads`; paste the returned IDs into `wrangler.toml`.
2. **Google OAuth client** — chicken-and-egg: the client must be bound to a *specific extension ID*, which doesn't exist until the extension is built and loaded unpacked. Build → load at `chrome://extensions` → copy the ID → create a **Chrome Extension** OAuth client in Google Cloud Console → put the client ID in **both** `wxt.config.ts` (`manifest.oauth2.client_id`) and `.dev.vars` (`GOOGLE_CLIENT_ID`). Mismatch surfaces as `INVALID_TOKEN`.
3. **Secrets** — `cp .dev.vars.example .dev.vars`, `openssl rand -base64 48` for `JWT_SECRET`. Production uses `wrangler secret put`.
4. **`EXTENSION_ORIGIN`** — `chrome-extension://<id>`, or CORS rejects the extension in production.

---

## 10. Open decisions

| Question | Status |
|---|---|
| Free tier size (50/month) | **Placeholder.** Size from `fill_log` after phase 3. |
| Pro price | Undecided. Model from real cost/form first. |
| Workday in v1 | Scoped as a phase-5 stretch. Defer if it slips. |
| Education/experience extraction | Heuristics do identity only. LLM enrichment deferred to phase 3+ when the model layer exists. |
| Style learning | Schema exists (`StyleProfile`); populated from accepted answers later. |
| Firefox | WXT supports it; `chrome.identity` needs a swap. Not scoped. |

---

## 11. References

- [Grammarly — Making Grammarly Feel Native On Every Website](https://www.grammarly.com/blog/engineering/making-grammarly-feel-native-on-every-website/)
- [AI SDK: Anthropic caching breaks with generateObject](https://github.com/vercel/ai/issues/5227)
- [OpenRouter prompt caching](https://openrouter.ai/docs/guides/best-practices/prompt-caching)
- [Gemini 2.5 Flash pricing](https://openrouter.ai/google/gemini-2.5-flash/pricing)
- [Vercel AI Gateway downgrades Anthropic's 1h cache](https://www.danielternyak.com/articles/vercel-ai-gateway-downgrades-anthropic-prompt-cache)
- [Trigger Input Updates with React Controlled Inputs](https://coryrylan.com/blog/trigger-input-updates-with-react-controlled-inputs)
- [WXT vs Plasmo vs CRXJS 2026](https://dev.to/extensionbooster/plasmo-vs-crxjs-vs-wxt-which-chrome-extension-framework-should-you-use-in-2026-37o4)
- [Simplify vs LazyApply vs Teal](https://sprad.io/blog/top-5-simplify-alternatives-for-auto-applying-to-jobs-safely-with-ai)
