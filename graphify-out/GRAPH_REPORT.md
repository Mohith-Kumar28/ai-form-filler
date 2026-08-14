# Graph Report - ai-form-filler  (2026-08-14)

## Corpus Check
- 197 files · ~125,279 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1382 nodes · 2663 edges · 88 communities (79 shown, 9 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 19 edges (avg confidence: 0.69)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `ef9a40ec`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- fetch-url.ts
- scripts
- content.ts
- profile/profile.ts
- generate.ts
- includes
- account/account.ts
- fill/fill.ts
- google-forms.ts
- ats.ts
- gallery/main.tsx
- lib/auth.ts
- scripts
- compilerOptions
- dependencies
- High-Agency Frontend Skill
- messages.ts
- AddSource.tsx
- form-adapters/src/index.ts
- routes/profile.ts
- shared/src/index.ts
- App.tsx
- devDependencies
- Review.tsx
- form-adapters/package.json
- services/fill.ts
- shared/package.json
- dependencies
- migrate-learned-to-memory.mjs
- write.ts
- model/index.ts
- httpClient
- supermemory.ts
- Sources.tsx
- generic.ts
- services/profile.ts
- constants.ts
- api/tsconfig.json
- ApiErrorResponse
- package.json
- form-adapters/tsconfig.json
- devDependencies
- routes/fill.ts
- compilerOptions
- Design Audit
- SourceDetail.tsx
- scripts
- fillPlan.ts
- Components
- AI Form Filler — Engineering Handoff
- 7. Gotchas — read before touching related code
- AI Form Filler — Product truth
- create-resources.mjs
- fillRequestFormFieldsItem.ts
- src/fill.ts
- AI Form Filler
- compile.ts
- http-client.ts
- 6. Remaining work
- shared/tsconfig.json
- 0000_init.sql
- profilePatch.ts
- setup-check.mjs
- ApiError
- feedbackRequestEntriesItem.ts
- Commands
- api/package.json
- @tailwindcss/vite
- extension/package.json
- @vitejs/plugin-react
- devDependencies
- 3. Architecture
- GoogleFormsAdapter
- Setup
- secrets.mjs
- costs.mjs
- push-secrets.mjs
- dev-token.mjs
- 2. The two hard invariants
- wxt
- @wxt-dev/module-react
- vite
- reveal-extension.mjs

## God Nodes (most connected - your core abstractions)
1. `scripts` - 49 edges
2. `ApiErrorResponse` - 23 edges
3. `scripts` - 21 edges
4. `httpClient()` - 19 edges
5. `compilerOptions` - 18 edges
6. `Db` - 17 edges
7. `useNavigation()` - 17 edges
8. `PositionScheduler` - 15 edges
9. `Env` - 14 edges
10. `resolveLabel()` - 14 edges

## Surprising Connections (you probably didn't know these)
- `main()` --indirect_call--> `isFillable()`  [INFERRED]
  apps/extension/src/entrypoints/content.ts → packages/form-adapters/src/generic.ts
- `collectPageContext()` --references--> `document`  [EXTRACTED]
  packages/form-adapters/src/index.ts → apps/api/scripts/emit-openapi.ts
- `Variables` --references--> `Account`  [EXTRACTED]
  apps/api/src/env.ts → packages/shared/src/account.ts
- `UserMessageInput` --references--> `FieldSchema`  [EXTRACTED]
  apps/api/src/llm/prompt.ts → packages/shared/src/form.ts
- `RoutedForm` --references--> `FillTier`  [EXTRACTED]
  apps/api/src/router/classify.ts → packages/shared/src/fill.ts

## Import Cycles
- None detected.

## Communities (88 total, 9 thin omitted)

### Community 0 - "fetch-url.ts"
Cohesion: 0.18
Nodes (16): normalizeText(), digitCount(), extractIdentity(), LINK_PATTERNS, mergeIdentity(), trimUrl(), BrowserBinding, fetchAndStrip() (+8 more)

### Community 1 - "scripts"
Cohesion: 0.04
Nodes (49): scripts, //1-develop, //2-build, //3-ship, //4-setup, //5-database, //6-contract, //7-quality (+41 more)

### Community 2 - "content.ts"
Cohesion: 0.06
Nodes (44): main(), detectPageScheme(), AnimatedFill, ANIMATION_TIMINGS, AnimationHooks, isTypeable(), runFillAnimation(), sleep() (+36 more)

### Community 3 - "profile/profile.ts"
Cohesion: 0.07
Nodes (41): AddTextSourceMutationBody, AddTextSourceMutationError, AddTextSourceMutationResult, deleteSource(), DeleteSourceMutationError, DeleteSourceMutationResult, getAddTextSourceMutationOptions(), getDeleteSourceMutationOptions() (+33 more)

### Community 4 - "generate.ts"
Cohesion: 0.06
Nodes (55): Env, generateFills(), GenerateInput, GenerateResult, readCacheCounters(), translateProviderError(), IMPROVE_STYLES, improveAnswer() (+47 more)

### Community 5 - "includes"
Cohesion: 0.05
Nodes (36): css, parser, files, includes, formatter, enabled, indentStyle, indentWidth (+28 more)

### Community 6 - "account/account.ts"
Cohesion: 0.29
Nodes (9): getAccount(), GetAccountQueryError, GetAccountQueryResult, getGetAccountQueryOptions(), getGetAccountUrl(), SecondParameter, useGetAccount(), withQueryKey() (+1 more)

### Community 7 - "fill/fill.ts"
Cohesion: 0.09
Nodes (24): fillForm(), FillFormMutationBody, FillFormMutationError, FillFormMutationResult, getFillFormMutationOptions(), getFillFormUrl(), getImproveAnswerMutationOptions(), getImproveAnswerUrl() (+16 more)

### Community 8 - "google-forms.ts"
Cohesion: 0.21
Nodes (22): answerFor(), detectQuestion(), hasLayout(), isChosen(), isOpen(), isOtherOption(), isVisible(), matchOption() (+14 more)

### Community 9 - "ats.ts"
Cohesion: 0.15
Nodes (15): ATS_HOSTS, AtsAdapter, driveReactSelect(), isReactSelect(), reactSelectLabel(), readPreloadedOptions(), readSelectedValue(), waitForOption() (+7 more)

### Community 10 - "gallery/main.tsx"
Cohesion: 0.08
Nodes (28): ACCOUNT, ACCOUNT_LOW_QUOTA, EMPTY_PROFILE, PLAN, PROFILE, REPORT, PAGE_WITH_FORM, PAGE_WITHOUT_FORM (+20 more)

### Community 11 - "lib/auth.ts"
Cohesion: 0.32
Nodes (9): LAST_FILL_KEY, getAuthToken(), signIn(), signOut(), registerFillPort(), runFillFlow(), readLocal(), removeLocal() (+1 more)

### Community 12 - "scripts"
Cohesion: 0.10
Nodes (21): scripts, build, cf:create, db:costs, db:generate, db:migrate:local, db:migrate:remote, db:migrate:staging (+13 more)

### Community 13 - "compilerOptions"
Cohesion: 0.10
Nodes (20): compilerOptions, declaration, esModuleInterop, exactOptionalPropertyTypes, forceConsistentCasingInFileNames, isolatedModules, lib, module (+12 more)

### Community 14 - "dependencies"
Cohesion: 0.11
Nodes (19): ai, @ai-sdk/anthropic, @ai-sdk/google, dependencies, @aff/shared, ai, @ai-sdk/anthropic, @ai-sdk/google (+11 more)

### Community 15 - "High-Agency Frontend Skill"
Cohesion: 0.06
Nodes (30): 10. FINAL PRE-FLIGHT CHECK, 1. ACTIVE BASELINE CONFIGURATION, 2. DEFAULT ARCHITECTURE & CONVENTIONS, 3. DESIGN ENGINEERING DIRECTIVES (Bias Correction), 4. CREATIVE PROACTIVITY (Anti-Slop Implementation), 5. PERFORMANCE GUARDRAILS, 6. TECHNICAL REFERENCE (Dial Definitions), 7. AI TELLS (Forbidden Patterns) (+22 more)

### Community 16 - "messages.ts"
Cohesion: 0.16
Nodes (15): toResult(), FillStage, FillState, ApiError, ApiErrorCode, HTTP_STATUS_FOR_CODE, FILL_PORT, ApplyReport (+7 more)

### Community 17 - "AddSource.tsx"
Cohesion: 0.16
Nodes (14): AutoTextarea(), IconAudio(), IconMic(), IconText(), LinkMode(), Mode, MODES, TextMode() (+6 more)

### Community 18 - "form-adapters/src/index.ts"
Cohesion: 0.16
Nodes (10): adapter, detect(), labelsOf(), collectPageContext(), detectPageForm(), genericAdapter, selectAdapter(), siteAdapters (+2 more)

### Community 19 - "routes/profile.ts"
Cohesion: 0.09
Nodes (25): AddSourceResponse, ApiError, FeedbackRequest, FillPlan, FillRequest, Identity, Profile, ProfilePatch (+17 more)

### Community 20 - "shared/src/index.ts"
Cohesion: 0.24
Nodes (9): canonical(), createFeedbackCapture(), displayValueOf(), FeedbackCapture, PageReader, ProposedValue, capture(), FeedbackRequest (+1 more)

### Community 21 - "App.tsx"
Cohesion: 0.14
Nodes (26): Stack(), useFillNavigation(), Row(), RowGroup(), Screen(), ScreenBody(), IconSignOut(), useNavigation() (+18 more)

### Community 22 - "devDependencies"
Cohesion: 0.12
Nodes (17): devDependencies, happy-dom, orval, tailwindcss, @types/chrome, @types/react, @types/react-dom, typescript (+9 more)

### Community 23 - "Review.tsx"
Cohesion: 0.13
Nodes (25): AnswerEntry(), Fill, highlight(), needsCheck(), Review(), SKIP_REASON, STYLES, useImproveAnswer() (+17 more)

### Community 24 - "form-adapters/package.json"
Cohesion: 0.12
Nodes (16): dependencies, @aff/shared, devDependencies, happy-dom, vitest, exports, @aff/shared, happy-dom (+8 more)

### Community 25 - "services/fill.ts"
Cohesion: 0.22
Nodes (13): fillLog, profileDocs, profileSources, quotaUsage, subscriptions, users, currentPeriod(), loadAccount() (+5 more)

### Community 26 - "shared/package.json"
Cohesion: 0.12
Nodes (15): dependencies, zod, devDependencies, vitest, exports, ./constants, vitest, zod (+7 more)

### Community 27 - "dependencies"
Cohesion: 0.15
Nodes (13): @aff/form-adapters, dependencies, @aff/form-adapters, @aff/shared, react, react-dom, @tanstack/react-query, @tanstack/react-query-persist-client (+5 more)

### Community 28 - "migrate-learned-to-memory.mjs"
Cohesion: 0.33
Nodes (3): key, remote, rows

### Community 29 - "write.ts"
Cohesion: 0.29
Nodes (11): readIntent(), matchSelectOption(), nativeValueSetter(), notifyChange(), simulateVisit(), ValueElement, writeCheckedValue(), writeContentEditable() (+3 more)

### Community 30 - "model/index.ts"
Cohesion: 0.12
Nodes (16): Account, AccountQuota, AccountQuotaPlan, AddSourceResponse, Profile, ProfileCustom, ProfileIdentity, ProfileIdentityLinks (+8 more)

### Community 31 - "httpClient"
Cohesion: 0.23
Nodes (10): getSignInWithGoogleMutationOptions(), getSignInWithGoogleUrl(), SecondParameter, signInWithGoogle(), SignInWithGoogleMutationBody, SignInWithGoogleMutationError, SignInWithGoogleMutationResult, useSignInWithGoogle() (+2 more)

### Community 32 - "supermemory.ts"
Cohesion: 0.21
Nodes (14): FillContext, FillContextInput, gatherFillContext(), RetrievalRequest, addContent(), addFile(), addUrl(), call() (+6 more)

### Community 33 - "Sources.tsx"
Cohesion: 0.06
Nodes (39): Button(), ConfirmSheet(), EmptyState(), Field(), Input(), MenuItem, OverflowMenu(), ScreenFooter() (+31 more)

### Community 34 - "generic.ts"
Cohesion: 0.21
Nodes (20): baseSchema(), documentHasLayout(), groupControls(), groupLabel(), isFillable(), isVisible(), nextId(), optionsOf() (+12 more)

### Community 35 - "services/profile.ts"
Cohesion: 0.19
Nodes (23): StructuredSource, Db, applyToIdentity(), isBlank(), isPlausible(), recordFeedback(), addSource(), definedOnly() (+15 more)

### Community 36 - "constants.ts"
Cohesion: 0.24
Nodes (8): Variables, Account, Plan, QuotaState, AUTH_ERROR_CODES, isAuthError(), PLAN_LIMITS, SESSION_EXPIRED_MESSAGE

### Community 37 - "api/tsconfig.json"
Cohesion: 0.17
Nodes (11): compilerOptions, lib, noEmit, types, extends, include, ES2023, src (+3 more)

### Community 38 - "ApiErrorResponse"
Cohesion: 0.16
Nodes (12): GoogleIdentity, TokenInfo, UserInfo, verifyGoogleAccessToken(), issueSessionToken(), key(), verifySessionToken(), SignInRequest (+4 more)

### Community 39 - "package.json"
Cohesion: 0.17
Nodes (11): engines, node, name, packageManager, pnpm, onlyBuiltDependencies, private, type (+3 more)

### Community 40 - "form-adapters/tsconfig.json"
Cohesion: 0.17
Nodes (11): compilerOptions, lib, noEmit, types, extends, include, ES2023, src (+3 more)

### Community 41 - "devDependencies"
Cohesion: 0.18
Nodes (11): devDependencies, @cloudflare/workers-types, drizzle-kit, tsx, vitest, wrangler, vitest, @cloudflare/workers-types (+3 more)

### Community 42 - "routes/fill.ts"
Cohesion: 0.13
Nodes (21): document, here, outPath, AppEnv, app, requireAuth, onError(), consumeQuota() (+13 more)

### Community 43 - "compilerOptions"
Cohesion: 0.18
Nodes (10): compilerOptions, jsx, noUncheckedIndexedAccess, strict, verbatimModuleSyntax, extends, include, src (+2 more)

### Community 44 - "Design Audit"
Cohesion: 0.10
Nodes (19): Code Quality, Color and Surfaces, Component Patterns, Content, Design Audit, Fix Priority, How This Works, Iconography (+11 more)

### Community 45 - "SourceDetail.tsx"
Cohesion: 0.23
Nodes (10): KIND_NOUN, Preview(), sourceDetail(), SourceRow(), formatAddedOn(), formatCount(), formatBytes(), hostnameOf() (+2 more)

### Community 46 - "scripts"
Cohesion: 0.18
Nodes (11): scripts, api:generate, build, build:firefox, dev, dev:firefox, gallery, postinstall (+3 more)

### Community 47 - "fillPlan.ts"
Cohesion: 0.24
Nodes (7): FillPlan, FillPlanFillsItem, FillPlanFillsItemKind, FillPlanFillsItemTier, FillPlanSkippedItem, FillPlanSkippedItemReason, FillPlanUsage

### Community 48 - "Components"
Cohesion: 0.06
Nodes (33): Buttons, Cards / Containers, Colors, Components, Design System: AI Form Filler, Do:, Do's and Don'ts, Don't: (+25 more)

### Community 49 - "AI Form Filler — Engineering Handoff"
Cohesion: 0.20
Nodes (10): 10. Open decisions, 11. References, 1. What this product is, 4. What exists today, 5. Database schema (D1), 8. Commands, 9. Setup blockers for a new machine, AI Form Filler — Engineering Handoff (+2 more)

### Community 50 - "7. Gotchas — read before touching related code"
Cohesion: 0.20
Nodes (10): 7.1 Google token introspection: the `aud` check is load-bearing, 7.2 React controlled inputs revert a naive `.value` assignment, 7.3 Fill requests need a port, not `sendMessage`, 7.4 Overlay positioning is a genuine performance hazard, 7.5 `PROFILE_DOC` must stay byte-stable, 7.6 Identity is merged field-by-field; everything else replaces, 7.7 Deleting a source must delete the stored original, 7.8 orval's `useQuery` / `useMutation` flags force themselves onto every operation (+2 more)

### Community 51 - "AI Form Filler — Product truth"
Cohesion: 0.20
Nodes (9): AI Form Filler — Product truth, Audience and scene, Brand commitments, Constraints, The one thing the UI must make legible, The surface, The unique mechanism, What it is (+1 more)

### Community 52 - "create-resources.mjs"
Cohesion: 0.22
Nodes (5): d1Id, d1Out, kvOut, PLACEHOLDER, TOML

### Community 53 - "fillRequestFormFieldsItem.ts"
Cohesion: 0.27
Nodes (6): FillRequest, FillRequestForm, FillRequestFormFieldsItem, FillRequestFormFieldsItemKind, FillRequestFormFieldsItemOptionsItem, FillRequestScope

### Community 54 - "src/fill.ts"
Cohesion: 0.21
Nodes (11): ActivePage, INITIAL, originOf(), useActivePage(), DetectionResult, REVIEW_CONFIDENCE_THRESHOLD, minimalForm, FillPlan (+3 more)

### Community 55 - "AI Form Filler"
Cohesion: 0.22
Nodes (7): AI Form Filler, Before public listing, Before this is real, Build phases, Layout, Two invariants, Verification

### Community 56 - "compile.ts"
Cohesion: 0.24
Nodes (9): CompiledProfile, compileProfileDoc(), estimateTokens(), renderCustom(), renderIdentity(), sha256Hex(), Profile, ProfileSource (+1 more)

### Community 57 - "http-client.ts"
Cohesion: 0.20
Nodes (10): App(), useSignedIn(), container, hasSession(), API_URL, STORAGE_KEYS, BodyType, chromeStoragePersister (+2 more)

### Community 58 - "6. Remaining work"
Cohesion: 0.25
Nodes (8): 6. Remaining work, 7.10 The content script bundle is a tax on every page, Deferred / future, Phase 3 — Fill core ⬅ IN PROGRESS, Phase 3 message flow, Phase 4 — The magic layer ✅ built, Phase 5 — Site adapters, Phase 6 — Monetization and launch

### Community 59 - "shared/tsconfig.json"
Cohesion: 0.25
Nodes (7): compilerOptions, noEmit, types, extends, include, src, ../../tsconfig.base.json

### Community 60 - "0000_init.sql"
Cohesion: 0.52
Nodes (6): `fill_log`, `profile_docs`, `profile_sources`, `quota_usage`, `subscriptions`, `users`

### Community 61 - "profilePatch.ts"
Cohesion: 0.46
Nodes (4): Identity, IdentityLinks, ProfilePatch, ProfilePatchCustom

### Community 62 - "setup-check.mjs"
Cohesion: 0.29
Nodes (5): checks, devVars, root, toml, wxtConfig

### Community 63 - "ApiError"
Cohesion: 0.60
Nodes (3): ApiError, ApiErrorCode, ApiErrorQuota

### Community 64 - "feedbackRequestEntriesItem.ts"
Cohesion: 0.53
Nodes (3): FeedbackRequest, FeedbackRequestEntriesItem, FeedbackRequestEntriesItemKind

### Community 65 - "Commands"
Cohesion: 0.33
Nodes (6): Commands, Contract, Daily, Database, First run on a new machine, Ship

### Community 66 - "api/package.json"
Cohesion: 0.40
Nodes (4): name, private, type, version

### Community 68 - "extension/package.json"
Cohesion: 0.40
Nodes (4): name, private, type, version

### Community 70 - "devDependencies"
Cohesion: 0.40
Nodes (5): @biomejs/biome, devDependencies, @biomejs/biome, typescript, typescript

### Community 71 - "3. Architecture"
Cohesion: 0.40
Nodes (5): 3. Architecture, Stack decisions and why, The API client is generated, never hand-written, The fill pipeline (phase 3 — not yet built), The tier router — the core cost lever

### Community 73 - "Setup"
Cohesion: 0.40
Nodes (5): 1. Cloudflare resources, 2. Google OAuth client, 3. Local secrets, 4. Run, Setup

### Community 74 - "secrets.mjs"
Cohesion: 0.40
Nodes (3): DEV_VARS, local, SECRETS

### Community 76 - "push-secrets.mjs"
Cohesion: 0.50
Nodes (3): DEV_VARS, entries, OPTIONAL

### Community 78 - "2. The two hard invariants"
Cohesion: 0.67
Nodes (3): 2.1 The LLM output schema is fixed and global, 2.2 Quota is enforced server-side, before any provider call, 2. The two hard invariants

## Knowledge Gaps
- **496 isolated node(s):** `name`, `version`, `private`, `type`, `dev` (+491 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **9 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `ApiErrorResponse` connect `ApiErrorResponse` to `fetch-url.ts`, `services/profile.ts`, `generate.ts`, `routes/fill.ts`, `messages.ts`, `routes/profile.ts`, `src/fill.ts`, `services/fill.ts`, `http-client.ts`?**
  _High betweenness centrality (0.012) - this node is a cross-community bridge._
- **Why does `FillPlan` connect `src/fill.ts` to `content.ts`, `gallery/main.tsx`, `messages.ts`, `routes/profile.ts`, `Review.tsx`, `services/fill.ts`?**
  _High betweenness centrality (0.009) - this node is a cross-community bridge._
- **What connects `name`, `version`, `private` to the rest of the system?**
  _496 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `scripts` be split into smaller, more focused modules?**
  _Cohesion score 0.04081632653061224 - nodes in this community are weakly interconnected._
- **Should `content.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06237424547283702 - nodes in this community are weakly interconnected._
- **Should `profile/profile.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06504065040650407 - nodes in this community are weakly interconnected._
- **Should `generate.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.055135135135135134 - nodes in this community are weakly interconnected._