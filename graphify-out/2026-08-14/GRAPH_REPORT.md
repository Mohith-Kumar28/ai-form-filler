# Graph Report - ai-form-filler  (2026-08-14)

## Corpus Check
- 171 files · ~95,064 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1141 nodes · 2150 edges · 79 communities (71 shown, 8 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 6 edges (avg confidence: 0.6)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `d0aef250`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- compile.ts
- scripts
- launcher.ts
- profile/profile.ts
- shared/src/index.ts
- includes
- App.tsx
- fill/fill.ts
- google-forms.ts
- ats.ts
- routes/profile.ts
- http-client.ts
- scripts
- compilerOptions
- dependencies
- services/profile.ts
- messages.ts
- AddSource.tsx
- form-adapters/src/index.ts
- Account
- feedback.ts
- IdentityEditor.tsx
- devDependencies
- resolveLabel
- form-adapters/package.json
- fillPlan.ts
- shared/package.json
- dependencies
- migrate-learned-to-memory.mjs
- write.ts
- model/profile.ts
- httpClient
- feedbackRequestEntriesItem.ts
- FillPanel.tsx
- generic.ts
- src/fill.ts
- api/tsconfig.json
- package.json
- form-adapters/tsconfig.json
- devDependencies
- model/index.ts
- compilerOptions
- generate.ts
- scripts
- orval
- Design system — laboratory notebook
- AI Form Filler — Engineering Handoff
- 7. Gotchas — read before touching related code
- AI Form Filler — Product truth
- create-resources.mjs
- profilePatch.ts
- AI Form Filler
- main.tsx
- 6. Remaining work
- shared/tsconfig.json
- 0000_init.sql
- content.ts
- setup-check.mjs
- ApiError
- Commands
- api/package.json
- @types/react
- extension/package.json
- devDependencies
- 3. Architecture
- google-forms.fixture.test.ts
- Setup
- secrets.mjs
- costs.mjs
- push-secrets.mjs
- dev-token.mjs
- 2. The two hard invariants
- typescript
- vite
- reveal-extension.mjs

## God Nodes (most connected - your core abstractions)
1. `scripts` - 49 edges
2. `ApiErrorResponse` - 23 edges
3. `scripts` - 21 edges
4. `httpClient()` - 18 edges
5. `compilerOptions` - 18 edges
6. `Db` - 16 edges
7. `Env` - 14 edges
8. `resolveLabel()` - 14 edges
9. `FieldSchema` - 14 edges
10. `PositionScheduler` - 12 edges

## Surprising Connections (you probably didn't know these)
- `RoutedForm` --references--> `FillTier`  [EXTRACTED]
  apps/api/src/router/classify.ts → packages/shared/src/fill.ts
- `Variables` --references--> `Account`  [EXTRACTED]
  apps/api/src/env.ts → packages/shared/src/account.ts
- `UserMessageInput` --references--> `FieldSchema`  [EXTRACTED]
  apps/api/src/llm/prompt.ts → packages/shared/src/form.ts
- `SignedIn()` --calls--> `isAuthError()`  [EXTRACTED]
  apps/extension/src/entrypoints/sidepanel/App.tsx → packages/shared/src/constants.ts
- `httpClient()` --calls--> `isAuthError()`  [EXTRACTED]
  apps/extension/src/lib/http-client.ts → packages/shared/src/constants.ts

## Import Cycles
- None detected.

## Communities (79 total, 8 thin omitted)

### Community 0 - "compile.ts"
Cohesion: 0.13
Nodes (22): CompiledProfile, compileProfileDoc(), estimateTokens(), normalizeText(), renderCustom(), renderIdentity(), sha256Hex(), digitCount() (+14 more)

### Community 1 - "scripts"
Cohesion: 0.04
Nodes (49): scripts, //1-develop, //2-build, //3-ship, //4-setup, //5-database, //6-contract, //7-quality (+41 more)

### Community 2 - "launcher.ts"
Cohesion: 0.08
Nodes (25): AnimatedFill, ANIMATION_TIMINGS, AnimationHooks, isTypeable(), runFillAnimation(), sleep(), typeInto(), getOverlayHost() (+17 more)

### Community 3 - "profile/profile.ts"
Cohesion: 0.08
Nodes (36): AddTextSourceMutationBody, AddTextSourceMutationError, AddTextSourceMutationResult, deleteSource(), DeleteSourceMutationError, DeleteSourceMutationResult, getAddTextSourceMutationOptions(), getDeleteSourceMutationOptions() (+28 more)

### Community 4 - "shared/src/index.ts"
Cohesion: 0.25
Nodes (7): LAST_FILL_KEY, fillForm(), getFillFormUrl(), registerFillPort(), runFillFlow(), toResult(), Request

### Community 5 - "includes"
Cohesion: 0.06
Nodes (31): files, includes, formatter, enabled, indentStyle, indentWidth, lineWidth, quoteStyle (+23 more)

### Community 6 - "App.tsx"
Cohesion: 0.15
Nodes (20): App(), SignedIn(), SignedOut(), Tab, useSignedIn(), getAccount(), GetAccountQueryError, GetAccountQueryResult (+12 more)

### Community 7 - "fill/fill.ts"
Cohesion: 0.09
Nodes (23): FillFormMutationBody, FillFormMutationError, FillFormMutationResult, getFillFormMutationOptions(), getImproveAnswerMutationOptions(), getImproveAnswerUrl(), getSubmitFeedbackMutationOptions(), getSubmitFeedbackUrl() (+15 more)

### Community 8 - "google-forms.ts"
Cohesion: 0.19
Nodes (22): answerFor(), detectQuestion(), GoogleFormsAdapter, hasLayout(), isChosen(), isOpen(), isOtherOption(), isVisible() (+14 more)

### Community 9 - "ats.ts"
Cohesion: 0.16
Nodes (14): ATS_HOSTS, AtsAdapter, driveReactSelect(), isReactSelect(), reactSelectLabel(), readPreloadedOptions(), readSelectedValue(), waitForOption() (+6 more)

### Community 10 - "routes/profile.ts"
Cohesion: 0.05
Nodes (54): here, outPath, GoogleIdentity, TokenInfo, UserInfo, verifyGoogleAccessToken(), issueSessionToken(), key() (+46 more)

### Community 11 - "http-client.ts"
Cohesion: 0.21
Nodes (13): formatSize(), KIND_LABEL, openSourceFile(), SourceList(), getAuthToken(), signIn(), signOut(), API_URL (+5 more)

### Community 12 - "scripts"
Cohesion: 0.10
Nodes (21): scripts, build, cf:create, db:costs, db:generate, db:migrate:local, db:migrate:remote, db:migrate:staging (+13 more)

### Community 13 - "compilerOptions"
Cohesion: 0.10
Nodes (20): compilerOptions, declaration, esModuleInterop, exactOptionalPropertyTypes, forceConsistentCasingInFileNames, isolatedModules, lib, module (+12 more)

### Community 14 - "dependencies"
Cohesion: 0.11
Nodes (19): ai, @ai-sdk/anthropic, @ai-sdk/google, dependencies, @aff/shared, ai, @ai-sdk/anthropic, @ai-sdk/google (+11 more)

### Community 15 - "services/profile.ts"
Cohesion: 0.08
Nodes (52): fillLog, profileDocs, profileSources, quotaUsage, subscriptions, users, consumeQuota(), StructuredSource (+44 more)

### Community 16 - "messages.ts"
Cohesion: 0.21
Nodes (12): FillStage, FillState, ApiError, ApiErrorCode, HTTP_STATUS_FOR_CODE, FillPlan, ApplyReport, ContentResponseFor (+4 more)

### Community 17 - "AddSource.tsx"
Cohesion: 0.19
Nodes (12): AddSource(), LinkTab(), Tab, TABS, TextTab(), UploadTab(), useAddSource(), VoiceTab() (+4 more)

### Community 18 - "form-adapters/src/index.ts"
Cohesion: 0.18
Nodes (10): document, collectPageContext(), detectPageForm(), genericAdapter, selectAdapter(), siteAdapters, detect(), DetectionResult (+2 more)

### Community 19 - "Account"
Cohesion: 0.43
Nodes (4): Account, AccountQuota, AccountQuotaPlan, SignInResponse

### Community 20 - "feedback.ts"
Cohesion: 0.33
Nodes (7): canonical(), createFeedbackCapture(), displayValueOf(), FeedbackCapture, PageReader, capture(), FeedbackRequest

### Community 21 - "IdentityEditor.tsx"
Cohesion: 0.36
Nodes (4): IdentityEditor(), getGetProfileQueryKey(), usePatchProfile(), IDENTITY_FIELDS

### Community 22 - "devDependencies"
Cohesion: 0.12
Nodes (17): devDependencies, happy-dom, tailwindcss, @tailwindcss/vite, @types/chrome, @types/react-dom, vitest, wxt (+9 more)

### Community 23 - "resolveLabel"
Cohesion: 0.25
Nodes (15): css, parser, tailwindDirectives, baseSchema(), adapter, detect(), labelsOf(), clean() (+7 more)

### Community 24 - "form-adapters/package.json"
Cohesion: 0.12
Nodes (16): dependencies, @aff/shared, devDependencies, happy-dom, vitest, exports, @aff/shared, happy-dom (+8 more)

### Community 25 - "fillPlan.ts"
Cohesion: 0.22
Nodes (8): Row, FillPlan, FillPlanFillsItem, FillPlanFillsItemKind, FillPlanFillsItemTier, FillPlanSkippedItem, FillPlanSkippedItemReason, FillPlanUsage

### Community 26 - "shared/package.json"
Cohesion: 0.12
Nodes (15): dependencies, zod, devDependencies, vitest, exports, ./constants, vitest, zod (+7 more)

### Community 27 - "dependencies"
Cohesion: 0.13
Nodes (15): @aff/form-adapters, dependencies, @aff/form-adapters, @aff/shared, react, react-dom, @tanstack/react-query, @tanstack/react-query-persist-client (+7 more)

### Community 28 - "migrate-learned-to-memory.mjs"
Cohesion: 0.33
Nodes (3): key, remote, rows

### Community 29 - "write.ts"
Cohesion: 0.29
Nodes (11): readIntent(), matchSelectOption(), nativeValueSetter(), notifyChange(), simulateVisit(), ValueElement, writeCheckedValue(), writeContentEditable() (+3 more)

### Community 30 - "model/profile.ts"
Cohesion: 0.20
Nodes (9): AddSourceResponse, Profile, ProfileCustom, ProfileIdentity, ProfileIdentityLinks, ProfileResponse, ProfileSourcesItem, ProfileSourcesItemKind (+1 more)

### Community 31 - "httpClient"
Cohesion: 0.25
Nodes (10): getSignInWithGoogleMutationOptions(), getSignInWithGoogleUrl(), SecondParameter, signInWithGoogle(), SignInWithGoogleMutationBody, SignInWithGoogleMutationError, SignInWithGoogleMutationResult, useSignInWithGoogle() (+2 more)

### Community 32 - "feedbackRequestEntriesItem.ts"
Cohesion: 0.53
Nodes (3): FeedbackRequest, FeedbackRequestEntriesItem, FeedbackRequestEntriesItemKind

### Community 33 - "FillPanel.tsx"
Cohesion: 0.18
Nodes (6): FillPanel(), base, IconInferred(), IconPen(), IconVerified(), STAGE_LABEL

### Community 34 - "generic.ts"
Cohesion: 0.26
Nodes (12): documentHasLayout(), groupControls(), groupLabel(), isFillable(), isVisible(), nextId(), optionsOf(), resetIdCounter() (+4 more)

### Community 36 - "src/fill.ts"
Cohesion: 0.15
Nodes (13): Variables, ProposedValue, Account, Plan, QuotaState, PLAN_LIMITS, minimalForm, FillRequest (+5 more)

### Community 37 - "api/tsconfig.json"
Cohesion: 0.17
Nodes (11): compilerOptions, lib, noEmit, types, extends, include, ES2023, src (+3 more)

### Community 39 - "package.json"
Cohesion: 0.17
Nodes (11): engines, node, name, packageManager, pnpm, onlyBuiltDependencies, private, type (+3 more)

### Community 40 - "form-adapters/tsconfig.json"
Cohesion: 0.17
Nodes (11): compilerOptions, lib, noEmit, types, extends, include, ES2023, src (+3 more)

### Community 41 - "devDependencies"
Cohesion: 0.18
Nodes (11): devDependencies, @cloudflare/workers-types, drizzle-kit, tsx, vitest, wrangler, vitest, @cloudflare/workers-types (+3 more)

### Community 42 - "model/index.ts"
Cohesion: 0.18
Nodes (9): FillRequest, FillRequestForm, FillRequestFormFieldsItem, FillRequestFormFieldsItemKind, FillRequestFormFieldsItemOptionsItem, FillRequestQuality, SignInRequest, TextSourceRequest (+1 more)

### Community 43 - "compilerOptions"
Cohesion: 0.18
Nodes (10): compilerOptions, jsx, noUncheckedIndexedAccess, strict, verbatimModuleSyntax, extends, include, src (+2 more)

### Community 44 - "generate.ts"
Cohesion: 0.06
Nodes (54): Env, generateFills(), GenerateInput, GenerateResult, readCacheCounters(), translateProviderError(), IMPROVE_STYLES, improveAnswer() (+46 more)

### Community 46 - "scripts"
Cohesion: 0.20
Nodes (10): scripts, api:generate, build, build:firefox, dev, dev:firefox, postinstall, test (+2 more)

### Community 48 - "Design system — laboratory notebook"
Cohesion: 0.20
Nodes (9): Design system — laboratory notebook, Ground and light, Iconography, Motion, Open, Structure, The page overlay, The world (+1 more)

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

### Community 54 - "profilePatch.ts"
Cohesion: 0.46
Nodes (4): Identity, IdentityLinks, ProfilePatch, ProfilePatchCustom

### Community 55 - "AI Form Filler"
Cohesion: 0.22
Nodes (7): AI Form Filler, Before public listing, Before this is real, Build phases, Layout, Two invariants, Verification

### Community 57 - "main.tsx"
Cohesion: 0.60
Nodes (3): container, chromeStoragePersister, queryClient

### Community 58 - "6. Remaining work"
Cohesion: 0.25
Nodes (8): 6. Remaining work, 7.10 The content script bundle is a tax on every page, Deferred / future, Phase 3 — Fill core ⬅ IN PROGRESS, Phase 3 message flow, Phase 4 — The magic layer ✅ built, Phase 5 — Site adapters, Phase 6 — Monetization and launch

### Community 59 - "shared/tsconfig.json"
Cohesion: 0.25
Nodes (7): compilerOptions, noEmit, types, extends, include, src, ../../tsconfig.base.json

### Community 60 - "0000_init.sql"
Cohesion: 0.52
Nodes (6): `fill_log`, `profile_docs`, `profile_sources`, `quota_usage`, `subscriptions`, `users`

### Community 61 - "content.ts"
Cohesion: 0.20
Nodes (12): main(), AnswerCard(), ReviewPanel(), scoreTone(), STYLES, Verdict, mountFieldMarker(), AUTH_ERROR_CODES (+4 more)

### Community 62 - "setup-check.mjs"
Cohesion: 0.29
Nodes (5): checks, devVars, root, toml, wxtConfig

### Community 63 - "ApiError"
Cohesion: 0.60
Nodes (3): ApiError, ApiErrorCode, ApiErrorQuota

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
- **401 isolated node(s):** `name`, `version`, `private`, `type`, `dev` (+396 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **8 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `css` connect `resolveLabel` to `google-forms.ts`, `includes`?**
  _High betweenness centrality (0.030) - this node is a cross-community bridge._
- **Why does `ApiErrorResponse` connect `routes/profile.ts` to `compile.ts`, `shared/src/index.ts`, `src/fill.ts`, `http-client.ts`, `generate.ts`, `services/profile.ts`, `messages.ts`?**
  _High betweenness centrality (0.019) - this node is a cross-community bridge._
- **Why does `questionHint()` connect `google-forms.ts` to `resolveLabel`?**
  _High betweenness centrality (0.015) - this node is a cross-community bridge._
- **What connects `name`, `version`, `private` to the rest of the system?**
  _401 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `compile.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.13054187192118227 - nodes in this community are weakly interconnected._
- **Should `scripts` be split into smaller, more focused modules?**
  _Cohesion score 0.04081632653061224 - nodes in this community are weakly interconnected._
- **Should `launcher.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.08362369337979095 - nodes in this community are weakly interconnected._