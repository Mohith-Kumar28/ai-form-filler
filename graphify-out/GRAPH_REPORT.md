# Graph Report - ai-form-filler  (2026-08-14)

## Corpus Check
- 174 files · ~97,303 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1152 nodes · 2199 edges · 82 communities (74 shown, 8 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 10 edges (avg confidence: 0.68)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `ddc4ac6f`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- services/profile.ts
- scripts
- content.ts
- profile/profile.ts
- structure.ts
- includes
- App.tsx
- fill/fill.ts
- google-forms.ts
- ats.ts
- schemas.ts
- http-client.ts
- scripts
- compilerOptions
- dependencies
- classify.ts
- messages.ts
- shared/src/index.ts
- form-adapters/src/index.ts
- env.ts
- routes/profile.ts
- recall.ts
- devDependencies
- generic.ts
- form-adapters/package.json
- AddSource.tsx
- shared/package.json
- dependencies
- services/account.ts
- write.ts
- model/index.ts
- httpClient
- account/account.ts
- FillPanel.tsx
- IdentityEditor.tsx
- api/src/index.ts
- services/fill.ts
- api/tsconfig.json
- matchOptions
- package.json
- form-adapters/tsconfig.json
- devDependencies
- routes/auth.ts
- compilerOptions
- generate.ts
- improve.ts
- scripts
- orval
- Design system — laboratory notebook
- AI Form Filler — Engineering Handoff
- 7. Gotchas — read before touching related code
- AI Form Filler — Product truth
- create-resources.mjs
- answer-bank.ts
- AI Form Filler
- fill-port.ts
- 6. Remaining work
- shared/tsconfig.json
- 0000_init.sql
- ReviewPanel.tsx
- setup-check.mjs
- Commands
- api/package.json
- extension/package.json
- main.tsx
- devDependencies
- 3. Architecture
- google-forms.fixture.test.ts
- Setup
- secrets.mjs
- costs.mjs
- push-secrets.mjs
- dev-token.mjs
- 2. The two hard invariants
- @types/react-dom
- typescript
- vite
- reveal-extension.mjs

## God Nodes (most connected - your core abstractions)
1. `scripts` - 48 edges
2. `ApiErrorResponse` - 23 edges
3. `scripts` - 21 edges
4. `httpClient()` - 18 edges
5. `compilerOptions` - 18 edges
6. `Db` - 16 edges
7. `FieldSchema` - 16 edges
8. `Env` - 14 edges
9. `resolveLabel()` - 14 edges
10. `PositionScheduler` - 12 edges

## Surprising Connections (you probably didn't know these)
- `openDropdown()` --indirect_call--> `key()`  [INFERRED]
  packages/form-adapters/src/google-forms.ts → apps/api/src/auth/session.ts
- `matchOptions()` --indirect_call--> `key()`  [INFERRED]
  packages/shared/src/options.ts → apps/api/src/auth/session.ts
- `Variables` --references--> `Account`  [EXTRACTED]
  apps/api/src/env.ts → packages/shared/src/account.ts
- `GenerateInput` --references--> `FillTier`  [EXTRACTED]
  apps/api/src/llm/generate.ts → packages/shared/src/fill.ts
- `UserMessageInput` --references--> `FieldSchema`  [EXTRACTED]
  apps/api/src/llm/prompt.ts → packages/shared/src/form.ts

## Import Cycles
- None detected.

## Communities (82 total, 8 thin omitted)

### Community 0 - "services/profile.ts"
Cohesion: 0.08
Nodes (43): CompiledProfile, compileProfileDoc(), estimateTokens(), normalizeText(), renderCustom(), renderIdentity(), renderLearned(), sha256Hex() (+35 more)

### Community 1 - "scripts"
Cohesion: 0.04
Nodes (48): scripts, //1-develop, //2-build, //3-ship, //4-setup, //5-database, //6-contract, //7-quality (+40 more)

### Community 2 - "content.ts"
Cohesion: 0.07
Nodes (36): main(), AnimatedFill, ANIMATION_TIMINGS, AnimationHooks, isTypeable(), runFillAnimation(), sleep(), typeInto() (+28 more)

### Community 3 - "profile/profile.ts"
Cohesion: 0.07
Nodes (36): AddTextSourceMutationBody, AddTextSourceMutationError, AddTextSourceMutationResult, deleteSource(), DeleteSourceMutationError, DeleteSourceMutationResult, getAddTextSourceMutationOptions(), getDeleteSourceMutationOptions() (+28 more)

### Community 4 - "structure.ts"
Cohesion: 0.21
Nodes (11): costMicroUsd(), MODELS, ModelSpec, GatewayMetadata, resolveModel(), mediaTypeFor(), READABLE_MEDIA_TYPES, StructuredProfileSchema (+3 more)

### Community 5 - "includes"
Cohesion: 0.06
Nodes (31): files, includes, formatter, enabled, indentStyle, indentWidth, lineWidth, quoteStyle (+23 more)

### Community 6 - "App.tsx"
Cohesion: 0.18
Nodes (15): App(), SignedIn(), SignedOut(), Tab, useSignedIn(), IdentityEditor(), getGetAccountQueryKey(), hasSession() (+7 more)

### Community 7 - "fill/fill.ts"
Cohesion: 0.10
Nodes (21): FillFormMutationBody, FillFormMutationError, FillFormMutationResult, getFillFormMutationOptions(), getImproveAnswerMutationOptions(), getSubmitFeedbackMutationOptions(), getSubmitFeedbackUrl(), ImproveAnswerMutationBody (+13 more)

### Community 8 - "google-forms.ts"
Cohesion: 0.19
Nodes (22): answerFor(), detectQuestion(), GoogleFormsAdapter, hasLayout(), isChosen(), isOpen(), isOtherOption(), isVisible() (+14 more)

### Community 9 - "ats.ts"
Cohesion: 0.16
Nodes (14): ATS_HOSTS, AtsAdapter, driveReactSelect(), isReactSelect(), reactSelectLabel(), readPreloadedOptions(), readSelectedValue(), waitForOption() (+6 more)

### Community 10 - "schemas.ts"
Cohesion: 0.11
Nodes (22): requireAuth, Account, AddSourceResponse, ApiError, bearerAuth, errorResponses, FeedbackRequest, FillPlan (+14 more)

### Community 11 - "http-client.ts"
Cohesion: 0.22
Nodes (13): formatSize(), KIND_LABEL, openSourceFile(), SourceList(), getGetProfileQueryKey(), getAuthToken(), signIn(), signOut() (+5 more)

### Community 12 - "scripts"
Cohesion: 0.10
Nodes (21): scripts, build, cf:create, db:costs, db:generate, db:migrate:local, db:migrate:remote, db:migrate:staging (+13 more)

### Community 13 - "compilerOptions"
Cohesion: 0.10
Nodes (20): compilerOptions, declaration, esModuleInterop, exactOptionalPropertyTypes, forceConsistentCasingInFileNames, isolatedModules, lib, module (+12 more)

### Community 14 - "dependencies"
Cohesion: 0.11
Nodes (19): ai, @ai-sdk/anthropic, @ai-sdk/google, dependencies, @aff/shared, ai, @ai-sdk/anthropic, @ai-sdk/google (+11 more)

### Community 15 - "classify.ts"
Cohesion: 0.22
Nodes (13): AUTOCOMPLETE_SLOT, classifyField(), classifyForm(), IdentitySlot, identitySlotFor(), LABEL_SLOTS, RoutedForm, tierOf() (+5 more)

### Community 16 - "messages.ts"
Cohesion: 0.20
Nodes (13): toResult(), FillStage, FillState, ApiError, FillPlan, ApplyReport, ContentRequest, ContentResponseFor (+5 more)

### Community 17 - "shared/src/index.ts"
Cohesion: 0.23
Nodes (6): issueSessionToken(), key(), verifySessionToken(), ApiErrorCode, ApiErrorResponse, HTTP_STATUS_FOR_CODE

### Community 18 - "form-adapters/src/index.ts"
Cohesion: 0.15
Nodes (12): document, collectPageContext(), detectPageForm(), genericAdapter, selectAdapter(), siteAdapters, detect(), DetectionResult (+4 more)

### Community 19 - "env.ts"
Cohesion: 0.31
Nodes (6): Variables, Account, Plan, QuotaState, PLAN_LIMITS, minimalForm

### Community 20 - "routes/profile.ts"
Cohesion: 0.16
Nodes (12): BY_EXTENSION, isPreviewableInline(), MAX_UPLOAD_BYTES, mediaTypeFor(), sourceKindFor(), addTextSourceRoute, Defined, deleteSourceRoute (+4 more)

### Community 21 - "recall.ts"
Cohesion: 0.31
Nodes (8): Classification, keyOf(), RecallResult, resolveLearned(), recall(), toOptions(), valueFor(), LearnedAnswer

### Community 22 - "devDependencies"
Cohesion: 0.12
Nodes (17): devDependencies, happy-dom, tailwindcss, @tailwindcss/vite, @types/chrome, @types/react, vitest, wxt (+9 more)

### Community 23 - "generic.ts"
Cohesion: 0.15
Nodes (26): css, parser, tailwindDirectives, baseSchema(), documentHasLayout(), groupControls(), groupLabel(), isFillable() (+18 more)

### Community 24 - "form-adapters/package.json"
Cohesion: 0.12
Nodes (16): dependencies, @aff/shared, devDependencies, happy-dom, vitest, exports, @aff/shared, happy-dom (+8 more)

### Community 25 - "AddSource.tsx"
Cohesion: 0.19
Nodes (12): AddSource(), LinkTab(), Tab, TABS, TextTab(), UploadTab(), useAddSource(), VoiceTab() (+4 more)

### Community 26 - "shared/package.json"
Cohesion: 0.12
Nodes (15): dependencies, zod, devDependencies, vitest, exports, ./constants, vitest, zod (+7 more)

### Community 27 - "dependencies"
Cohesion: 0.13
Nodes (15): @aff/form-adapters, dependencies, @aff/form-adapters, @aff/shared, react, react-dom, @tanstack/react-query, @tanstack/react-query-persist-client (+7 more)

### Community 28 - "services/account.ts"
Cohesion: 0.30
Nodes (9): quotaUsage, users, consumeQuota(), enforceQuota, rateLimit, currentPeriod(), loadAccount(), loadQuota() (+1 more)

### Community 29 - "write.ts"
Cohesion: 0.29
Nodes (11): readIntent(), matchSelectOption(), nativeValueSetter(), notifyChange(), simulateVisit(), ValueElement, writeCheckedValue(), writeContentEditable() (+3 more)

### Community 30 - "model/index.ts"
Cohesion: 0.05
Nodes (39): Account, AccountQuota, AccountQuotaPlan, AddSourceResponse, ApiError, ApiErrorCode, ApiErrorQuota, FeedbackRequest (+31 more)

### Community 31 - "httpClient"
Cohesion: 0.25
Nodes (10): getSignInWithGoogleMutationOptions(), getSignInWithGoogleUrl(), SecondParameter, signInWithGoogle(), SignInWithGoogleMutationBody, SignInWithGoogleMutationError, SignInWithGoogleMutationResult, useSignInWithGoogle() (+2 more)

### Community 32 - "account/account.ts"
Cohesion: 0.29
Nodes (9): getAccount(), GetAccountQueryError, GetAccountQueryResult, getGetAccountQueryOptions(), getGetAccountUrl(), SecondParameter, useGetAccount(), withQueryKey() (+1 more)

### Community 33 - "FillPanel.tsx"
Cohesion: 0.18
Nodes (6): FillPanel(), base, IconInferred(), IconPen(), IconVerified(), STAGE_LABEL

### Community 34 - "IdentityEditor.tsx"
Cohesion: 0.25
Nodes (5): getPatchProfileMutationOptions(), getPatchProfileUrl(), patchProfile(), usePatchProfile(), IDENTITY_FIELDS

### Community 35 - "api/src/index.ts"
Cohesion: 0.21
Nodes (9): here, outPath, AppEnv, app, onError(), authRoutes, fillRoutes, meRoutes (+1 more)

### Community 36 - "services/fill.ts"
Cohesion: 0.36
Nodes (7): fillLog, profileDocs, profileSources, subscriptions, emptyUsage(), runFill(), gatherFillContext()

### Community 37 - "api/tsconfig.json"
Cohesion: 0.17
Nodes (11): compilerOptions, lib, noEmit, types, extends, include, ES2023, src (+3 more)

### Community 38 - "matchOptions"
Cohesion: 0.33
Nodes (6): indexOfWord(), isWordChar(), matchOptions(), normalize(), OptionMatch, FEATURES

### Community 39 - "package.json"
Cohesion: 0.17
Nodes (11): engines, node, name, packageManager, pnpm, onlyBuiltDependencies, private, type (+3 more)

### Community 40 - "form-adapters/tsconfig.json"
Cohesion: 0.17
Nodes (11): compilerOptions, lib, noEmit, types, extends, include, ES2023, src (+3 more)

### Community 41 - "devDependencies"
Cohesion: 0.18
Nodes (11): devDependencies, @cloudflare/workers-types, drizzle-kit, tsx, vitest, wrangler, vitest, @cloudflare/workers-types (+3 more)

### Community 42 - "routes/auth.ts"
Cohesion: 0.27
Nodes (8): GoogleIdentity, TokenInfo, UserInfo, verifyGoogleAccessToken(), SignInRequest, SignInResponse, signInRoute, getOrCreateUser()

### Community 43 - "compilerOptions"
Cohesion: 0.18
Nodes (10): compilerOptions, jsx, noUncheckedIndexedAccess, strict, verbatimModuleSyntax, extends, include, src (+2 more)

### Community 44 - "generate.ts"
Cohesion: 0.15
Nodes (18): generateFills(), GenerateInput, GenerateResult, readCacheCounters(), TokenUsage, buildSystemBlocks(), buildUserMessage(), describeField() (+10 more)

### Community 45 - "improve.ts"
Cohesion: 0.16
Nodes (19): Env, translateProviderError(), IMPROVE_STYLES, improveAnswer(), ImproveInput, ImproveStyle, FillContext, FillContext (+11 more)

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

### Community 53 - "answer-bank.ts"
Cohesion: 0.38
Nodes (9): normalizeQuestion(), applyToIdentity(), CHOICE_KINDS, foldLearned(), isBlank(), isDurableFact(), isPlausible(), recordFeedback() (+1 more)

### Community 55 - "AI Form Filler"
Cohesion: 0.22
Nodes (7): AI Form Filler, Before public listing, Before this is real, Build phases, Layout, Two invariants, Verification

### Community 56 - "fill-port.ts"
Cohesion: 0.39
Nodes (5): LAST_FILL_KEY, fillForm(), getFillFormUrl(), registerFillPort(), runFillFlow()

### Community 58 - "6. Remaining work"
Cohesion: 0.25
Nodes (8): 6. Remaining work, 7.10 The content script bundle is a tax on every page, Deferred / future, Phase 3 — Fill core ⬅ IN PROGRESS, Phase 3 message flow, Phase 4 — The magic layer ✅ built, Phase 5 — Site adapters, Phase 6 — Monetization and launch

### Community 59 - "shared/tsconfig.json"
Cohesion: 0.25
Nodes (7): compilerOptions, noEmit, types, extends, include, src, ../../tsconfig.base.json

### Community 60 - "0000_init.sql"
Cohesion: 0.52
Nodes (6): `fill_log`, `profile_docs`, `profile_sources`, `quota_usage`, `subscriptions`, `users`

### Community 61 - "ReviewPanel.tsx"
Cohesion: 0.28
Nodes (8): AnswerCard(), ReviewPanel(), Row, scoreTone(), STYLES, Verdict, getImproveAnswerUrl(), improveAnswer()

### Community 62 - "setup-check.mjs"
Cohesion: 0.29
Nodes (5): checks, devVars, root, toml, wxtConfig

### Community 65 - "Commands"
Cohesion: 0.33
Nodes (6): Commands, Contract, Daily, Database, First run on a new machine, Ship

### Community 66 - "api/package.json"
Cohesion: 0.40
Nodes (4): name, private, type, version

### Community 68 - "extension/package.json"
Cohesion: 0.40
Nodes (4): name, private, type, version

### Community 69 - "main.tsx"
Cohesion: 0.60
Nodes (3): container, chromeStoragePersister, queryClient

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
- **397 isolated node(s):** `name`, `version`, `private`, `type`, `dev` (+392 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **8 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `css` connect `generic.ts` to `google-forms.ts`, `includes`?**
  _High betweenness centrality (0.045) - this node is a cross-community bridge._
- **Why does `questionHint()` connect `google-forms.ts` to `generic.ts`?**
  _High betweenness centrality (0.022) - this node is a cross-community bridge._
- **What connects `name`, `version`, `private` to the rest of the system?**
  _397 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `services/profile.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.083710407239819 - nodes in this community are weakly interconnected._
- **Should `scripts` be split into smaller, more focused modules?**
  _Cohesion score 0.041666666666666664 - nodes in this community are weakly interconnected._
- **Should `content.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06654567453115548 - nodes in this community are weakly interconnected._
- **Should `profile/profile.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07017543859649122 - nodes in this community are weakly interconnected._