# Graph Report - ai-form-filler  (2026-08-20)

## Corpus Check
- 257 files · ~363,493 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1790 nodes · 3506 edges · 112 communities (99 shown, 13 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 35 edges (avg confidence: 0.64)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `3292aa40`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- fetch-url.ts
- scripts
- content.ts
- profile/profile.ts
- classify.ts
- includes
- App.tsx
- fill/fill.ts
- google-forms.ts
- ats.ts
- gallery/main.tsx
- devDependencies
- scripts
- compilerOptions
- dependencies
- High-Agency Frontend Skill
- routes/profile.ts
- components.tsx
- form-adapters/src/index.ts
- services/fill.ts
- shared/src/index.ts
- account/account.ts
- devDependencies
- constants.ts
- form-adapters/package.json
- messages.ts
- shared/package.json
- dependencies
- migrate-learned-to-memory.mjs
- write.ts
- learned-store.ts
- model/index.ts
- answer-bank.ts
- routes/index.tsx
- generic.ts
- services/profile.ts
- compilerOptions
- api/tsconfig.json
- env.ts
- package.json
- form-adapters/tsconfig.json
- devDependencies
- ApiErrorResponse
- compilerOptions
- Design Audit
- Sources.tsx
- scripts
- fillPlan.ts
- Components
- Fillaform — Engineering Handoff
- 7. Gotchas — read before touching related code
- Fillaform — Product truth
- create-resources.mjs
- fillRequestFormFieldsItem.ts
- use-fill.ts
- Fillaform
- ui.tsx
- background.ts
- 6. Remaining work
- shared/tsconfig.json
- `users`
- profilePatch.ts
- setup-check.mjs
- ApiError
- feedbackRequestEntriesItem.ts
- Commands
- api/package.json
- billing/billing.ts
- extension/package.json
- seo.ts
- devDependencies
- 3. Architecture
- google-forms.fixture.test.ts
- Setup
- secrets.mjs
- costs.mjs
- push-secrets.mjs
- dev-token.mjs
- 2. The two hard invariants
- card.ts
- site.ts
- $slug.tsx
- reveal-extension.mjs
- Receipt.tsx
- animate.ts
- suggest.ts
- PositionScheduler
- compile.ts
- markers.ts
- Profile
- scheduler.ts
- opencode.json
- PricingCards.tsx
- router.tsx
- http-client.ts
- matchOptions
- @types/react
- @types/react-dom
- typescript
- vitest
- overlay.ts
- addTextSource
- standardwebhooks
- httpClient
- Profile.tsx
- happy-dom

## God Nodes (most connected - your core abstractions)
1. `scripts` - 53 edges
2. `ApiErrorResponse` - 24 edges
3. `httpClient()` - 22 edges
4. `scripts` - 21 edges
5. `Db` - 21 edges
6. `recordFeedback()` - 20 edges
7. `PositionScheduler` - 19 edges
8. `Reveal()` - 18 edges
9. `compilerOptions` - 18 edges
10. `site` - 17 edges

## Surprising Connections (you probably didn't know these)
- `mountAnswerCard()` --references--> `node`  [EXTRACTED]
  apps/extension/src/overlay/card.ts → package.json
- `Variables` --references--> `Account`  [EXTRACTED]
  apps/api/src/env.ts → packages/shared/src/account.ts
- `generateFills()` --calls--> `matchOptions()`  [EXTRACTED]
  apps/api/src/llm/generate.ts → packages/shared/src/options.ts
- `UserMessageInput` --references--> `FieldSchema`  [EXTRACTED]
  apps/api/src/llm/prompt.ts → packages/shared/src/form.ts
- `RoutedForm` --references--> `FillTier`  [EXTRACTED]
  apps/api/src/router/classify.ts → packages/shared/src/fill.ts

## Import Cycles
- None detected.

## Communities (112 total, 13 thin omitted)

### Community 0 - "fetch-url.ts"
Cohesion: 0.18
Nodes (16): normalizeText(), digitCount(), extractIdentity(), LINK_PATTERNS, mergeIdentity(), trimUrl(), BrowserBinding, fetchAndStrip() (+8 more)

### Community 1 - "scripts"
Cohesion: 0.04
Nodes (53): scripts, //1-develop, //2-build, //3-ship, //4-setup, //5-database, //6-contract, //7-quality (+45 more)

### Community 2 - "content.ts"
Cohesion: 0.12
Nodes (23): main(), detectPageScheme(), CardAction, burstConfetti(), COLORS, getOverlayHost(), GLYPH, isOverlayEvent() (+15 more)

### Community 3 - "profile/profile.ts"
Cohesion: 0.06
Nodes (46): VoiceMode(), AddTextSourceMutationBody, AddTextSourceMutationError, AddTextSourceMutationResult, deleteSource(), DeleteSourceMutationError, DeleteSourceMutationResult, getDeleteSourceMutationOptions() (+38 more)

### Community 4 - "classify.ts"
Cohesion: 0.12
Nodes (23): GenerateInput, GenerateResult, TokenUsage, UserMessageInput, AUTOCOMPLETE_SLOT, Classification, classifyField(), classifyForm() (+15 more)

### Community 5 - "includes"
Cohesion: 0.05
Nodes (37): css, parser, files, includes, formatter, enabled, indentStyle, indentWidth (+29 more)

### Community 6 - "App.tsx"
Cohesion: 0.16
Nodes (20): App(), Stack(), useFillNavigation(), useSignedIn(), ScreenBody(), SkeletonRow(), TabBar(), useNavigation() (+12 more)

### Community 7 - "fill/fill.ts"
Cohesion: 0.09
Nodes (23): FillFormMutationBody, FillFormMutationError, FillFormMutationResult, getFillFormMutationOptions(), getImproveAnswerMutationOptions(), getImproveAnswerUrl(), getSubmitFeedbackMutationOptions(), getSubmitFeedbackUrl() (+15 more)

### Community 8 - "google-forms.ts"
Cohesion: 0.18
Nodes (23): answerFor(), detectQuestion(), GoogleFormsAdapter, hasLayout(), isChosen(), isOpen(), isOtherOption(), isVisible() (+15 more)

### Community 9 - "ats.ts"
Cohesion: 0.17
Nodes (15): ATS_HOSTS, AtsAdapter, driveReactSelect(), isReactSelect(), reactSelectLabel(), readPreloadedOptions(), readSelectedValue(), waitForOption() (+7 more)

### Community 10 - "gallery/main.tsx"
Cohesion: 0.06
Nodes (37): ACCOUNT, ACCOUNT_LOW_QUOTA, EMPTY_PROFILE, PLAN, PROFILE, REPORT, PAGE_WITH_FORM, PAGE_WITHOUT_FORM (+29 more)

### Community 11 - "devDependencies"
Cohesion: 0.05
Nodes (40): dependencies, motion, react, react-dom, @tanstack/react-router, @tanstack/react-start, devDependencies, @cloudflare/vite-plugin (+32 more)

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

### Community 16 - "routes/profile.ts"
Cohesion: 0.09
Nodes (23): AddSourceResponse, ApiError, Identity, Profile, ProfilePatch, ProfileResponse, ProfileSource, SourceKind (+15 more)

### Community 17 - "components.tsx"
Cohesion: 0.06
Nodes (31): AutoTextarea(), ConfirmSheet(), Field(), Input(), MenuItem, Segment, SegmentedControl(), SUNSET_GRADIENT_180 (+23 more)

### Community 18 - "form-adapters/src/index.ts"
Cohesion: 0.17
Nodes (9): document, collectPageContext(), detectPageForm(), genericAdapter, selectAdapter(), siteAdapters, detect(), DetectionResult (+1 more)

### Community 19 - "services/fill.ts"
Cohesion: 0.12
Nodes (23): fillLog, learnedPointers, profileDocs, profileSources, quotaUsage, subscriptions, users, consumeQuota() (+15 more)

### Community 20 - "shared/src/index.ts"
Cohesion: 0.10
Nodes (31): Env, generateFills(), readCacheCounters(), translateProviderError(), improveAnswer(), ImproveInput, costMicroUsd(), MODELS (+23 more)

### Community 21 - "account/account.ts"
Cohesion: 0.32
Nodes (7): getAccount(), GetAccountQueryError, GetAccountQueryResult, getGetAccountQueryOptions(), getGetAccountUrl(), SecondParameter, ErrorType

### Community 22 - "devDependencies"
Cohesion: 0.12
Nodes (17): devDependencies, orval, tailwindcss, @tailwindcss/vite, @types/chrome, vite, @vitejs/plugin-react, wxt (+9 more)

### Community 23 - "constants.ts"
Cohesion: 0.11
Nodes (24): canonical(), clampAnswer(), createFeedbackCapture(), displayValueOf(), Entry, FeedbackCapture, feedbackEntryFor(), FeedbackSend (+16 more)

### Community 24 - "form-adapters/package.json"
Cohesion: 0.12
Nodes (16): dependencies, @aff/shared, devDependencies, happy-dom, vitest, exports, @aff/shared, happy-dom (+8 more)

### Community 25 - "messages.ts"
Cohesion: 0.08
Nodes (30): Variables, fillForm(), getFillFormUrl(), registerFillPort(), runFillFlow(), FakePort, fill(), fillForm (+22 more)

### Community 26 - "shared/package.json"
Cohesion: 0.11
Nodes (17): dependencies, zod, devDependencies, vitest, exports, ./constants, ./options, ./rewrite (+9 more)

### Community 27 - "dependencies"
Cohesion: 0.15
Nodes (13): @aff/form-adapters, dependencies, @aff/form-adapters, @aff/shared, react, react-dom, @tanstack/react-query, @tanstack/react-query-persist-client (+5 more)

### Community 28 - "migrate-learned-to-memory.mjs"
Cohesion: 0.33
Nodes (3): key, remote, rows

### Community 29 - "write.ts"
Cohesion: 0.32
Nodes (10): matchSelectOption(), nativeValueSetter(), notifyChange(), simulateVisit(), ValueElement, writeCheckedValue(), writeContentEditable(), writeMultiSelectValue() (+2 more)

### Community 30 - "learned-store.ts"
Cohesion: 0.25
Nodes (13): addRejection(), answerHashOf(), canonical(), digest(), keptRejections(), LearnedPointer, questionHashFor(), readNegatives() (+5 more)

### Community 31 - "model/index.ts"
Cohesion: 0.15
Nodes (11): Account, AccountQuota, AccountQuotaPlan, AccountSubscription, AccountSubscriptionPlan, AccountSubscriptionStatus, RenameSourceRequest, SignInRequest (+3 more)

### Community 32 - "answer-bank.ts"
Cohesion: 0.14
Nodes (26): learningBudget(), applyToIdentity(), Destination, destinationFor(), Entry, isBlank(), isPlausible(), looksSecret() (+18 more)

### Community 33 - "routes/index.tsx"
Cohesion: 0.19
Nodes (12): ChromeCTA(), FAQ(), FAQS, HowItWorks(), STEPS, ReadVsGuessed(), Reveal(), MascotPattern() (+4 more)

### Community 34 - "generic.ts"
Cohesion: 0.17
Nodes (23): baseSchema(), documentHasLayout(), GenericAdapter, groupControls(), groupLabel(), isFillable(), isVisible(), nextId() (+15 more)

### Community 35 - "services/profile.ts"
Cohesion: 0.22
Nodes (20): StructuredSource, Db, emptyUsage(), runFill(), addSource(), definedOnly(), deleteSource(), emptyProfile() (+12 more)

### Community 36 - "compilerOptions"
Cohesion: 0.08
Nodes (24): compilerOptions, baseUrl, esModuleInterop, forceConsistentCasingInFileNames, isolatedModules, jsx, lib, module (+16 more)

### Community 37 - "api/tsconfig.json"
Cohesion: 0.17
Nodes (11): compilerOptions, lib, noEmit, types, extends, include, ES2023, src (+3 more)

### Community 38 - "env.ts"
Cohesion: 0.10
Nodes (27): here, outPath, AppEnv, app, requireAuth, onError(), Account, bearerAuth (+19 more)

### Community 39 - "package.json"
Cohesion: 0.17
Nodes (11): engines, node, name, packageManager, pnpm, onlyBuiltDependencies, private, type (+3 more)

### Community 40 - "form-adapters/tsconfig.json"
Cohesion: 0.17
Nodes (11): compilerOptions, lib, noEmit, types, extends, include, DOM, DOM.Iterable (+3 more)

### Community 41 - "devDependencies"
Cohesion: 0.18
Nodes (11): devDependencies, @cloudflare/workers-types, drizzle-kit, tsx, vitest, wrangler, vitest, wrangler (+3 more)

### Community 42 - "ApiErrorResponse"
Cohesion: 0.15
Nodes (13): GoogleIdentity, TokenInfo, UserInfo, verifyGoogleAccessToken(), issueSessionToken(), key(), verifySessionToken(), SignInRequest (+5 more)

### Community 43 - "compilerOptions"
Cohesion: 0.18
Nodes (10): compilerOptions, jsx, noUncheckedIndexedAccess, strict, verbatimModuleSyntax, extends, include, src (+2 more)

### Community 44 - "Design Audit"
Cohesion: 0.10
Nodes (19): Code Quality, Color and Surfaces, Component Patterns, Content, Design Audit, Fix Priority, How This Works, Iconography (+11 more)

### Community 45 - "Sources.tsx"
Cohesion: 0.15
Nodes (21): EmptyState(), OverflowMenu(), KIND_NOUN, Preview(), SourceDetail(), FACT_LIMITS, HINTS, KIND_ICON (+13 more)

### Community 46 - "scripts"
Cohesion: 0.18
Nodes (11): scripts, api:generate, build, build:firefox, dev, dev:firefox, gallery, postinstall (+3 more)

### Community 47 - "fillPlan.ts"
Cohesion: 0.24
Nodes (7): FillPlan, FillPlanFillsItem, FillPlanFillsItemKind, FillPlanFillsItemTier, FillPlanSkippedItem, FillPlanSkippedItemReason, FillPlanUsage

### Community 48 - "Components"
Cohesion: 0.06
Nodes (33): Buttons, Cards / Containers, Colors, Components, Design System: Fillaform, Do:, Do's and Don'ts, Don't: (+25 more)

### Community 49 - "Fillaform — Engineering Handoff"
Cohesion: 0.20
Nodes (10): 10. Open decisions, 11. References, 1. What this product is, 4. What exists today, 5. Database schema (D1), 8. Commands, 9. Setup blockers for a new machine, Fillaform — Engineering Handoff (+2 more)

### Community 50 - "7. Gotchas — read before touching related code"
Cohesion: 0.20
Nodes (10): 7.1 Google token introspection: the `aud` check is load-bearing, 7.2 React controlled inputs revert a naive `.value` assignment, 7.3 Fill requests need a port, not `sendMessage`, 7.4 Overlay positioning is a genuine performance hazard, 7.5 `PROFILE_DOC` must stay byte-stable, 7.6 Identity is merged field-by-field; everything else replaces, 7.7 Deleting a source must delete the stored original, 7.8 orval's `useQuery` / `useMutation` flags force themselves onto every operation (+2 more)

### Community 51 - "Fillaform — Product truth"
Cohesion: 0.20
Nodes (9): Audience and scene, Brand commitments, Constraints, Fillaform — Product truth, The one thing the UI must make legible, The surface, The unique mechanism, What it is (+1 more)

### Community 52 - "create-resources.mjs"
Cohesion: 0.22
Nodes (5): d1Id, d1Out, kvOut, PLACEHOLDER, TOML

### Community 53 - "fillRequestFormFieldsItem.ts"
Cohesion: 0.27
Nodes (6): FillRequest, FillRequestForm, FillRequestFormFieldsItem, FillRequestFormFieldsItemKind, FillRequestFormFieldsItemOptionsItem, FillRequestScope

### Community 54 - "use-fill.ts"
Cohesion: 0.16
Nodes (20): applyVerdict(), clearDraft(), drafts, emit(), EMPTY, getDraft(), hydrate(), listeners (+12 more)

### Community 55 - "Fillaform"
Cohesion: 0.22
Nodes (7): Before public listing, Before this is real, Build phases, Fillaform, Layout, Two invariants, Verification

### Community 56 - "ui.tsx"
Cohesion: 0.09
Nodes (26): ANSWERS, DemoState, ExtensionDemo(), FORM_FIELDS, MarkState, ReviewPanel(), STAGES, FEATURES (+18 more)

### Community 57 - "background.ts"
Cohesion: 0.27
Nodes (9): DEFAULT_SETTINGS, FORWARDED_TO_CONTENT, getAuthToken(), signIn(), signOut(), LAST_FILL_KEY, readLocal(), removeLocal() (+1 more)

### Community 58 - "6. Remaining work"
Cohesion: 0.25
Nodes (8): 6. Remaining work, 7.10 The content script bundle is a tax on every page, Deferred / future, Phase 3 — Fill core ⬅ IN PROGRESS, Phase 3 message flow, Phase 4 — The magic layer ✅ built, Phase 5 — Site adapters, Phase 6 — Monetization and launch

### Community 59 - "shared/tsconfig.json"
Cohesion: 0.25
Nodes (7): compilerOptions, noEmit, types, extends, include, src, ../../tsconfig.base.json

### Community 60 - "`users`"
Cohesion: 0.27
Nodes (8): `fill_log`, `profile_docs`, `profile_sources`, `quota_usage`, `subscriptions`, `users`, `subscriptions`, `learned_pointers`

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
Cohesion: 0.39
Nodes (4): FeedbackRequest, FeedbackRequestEntriesItem, FeedbackRequestEntriesItemKind, FeedbackRequestEntriesItemTrigger

### Community 65 - "Commands"
Cohesion: 0.33
Nodes (6): Commands, Contract, Daily, Database, First run on a new machine, Ship

### Community 66 - "api/package.json"
Cohesion: 0.40
Nodes (4): name, private, type, version

### Community 67 - "billing/billing.ts"
Cohesion: 0.12
Nodes (18): createCheckout(), CreateCheckoutMutationBody, CreateCheckoutMutationError, CreateCheckoutMutationResult, getCreateCheckoutMutationOptions(), getCreateCheckoutUrl(), getGetPortalQueryKey(), getGetPortalQueryOptions() (+10 more)

### Community 68 - "extension/package.json"
Cohesion: 0.40
Nodes (4): name, private, type, version

### Community 69 - "seo.ts"
Cohesion: 0.10
Nodes (14): FeaturesGrid(), buildMeta(), canonicalLink(), jsonLd(), MetaTag, softwareAppSchema(), ComparisonRow, Route (+6 more)

### Community 70 - "devDependencies"
Cohesion: 0.29
Nodes (7): @biomejs/biome, @dodopayments/opencode-plugin, devDependencies, @biomejs/biome, @dodopayments/opencode-plugin, typescript, typescript

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

### Community 79 - "card.ts"
Cohesion: 0.19
Nodes (18): AnswerCardSpec, BaseSpec, CardHandle, CardSpec, escapeHtml(), MenuCard, mountAnswerCard(), mountCard() (+10 more)

### Community 80 - "site.ts"
Cohesion: 0.23
Nodes (9): Footer(), footerColumns, Hero(), Navbar(), IconSparkle(), useMascotGaze(), navLinks, site (+1 more)

### Community 82 - "$slug.tsx"
Cohesion: 0.22
Nodes (10): posts, BlogBlock, BlogPost, formatDate(), getPost(), getPosts(), BlogIndex(), Route (+2 more)

### Community 88 - "Receipt.tsx"
Cohesion: 0.13
Nodes (22): Button(), Chip(), Expression, Mascot(), Row(), RowGroup(), Screen(), ScreenFooter() (+14 more)

### Community 89 - "animate.ts"
Cohesion: 0.26
Nodes (10): AnimatedFill, ANIMATION_TIMINGS, AnimationHooks, isTypeable(), runFillAnimation(), sleep(), typeInto(), PILL (+2 more)

### Community 90 - "suggest.ts"
Cohesion: 0.24
Nodes (7): KnownFacts, Rule, RULES, SUGGESTABLE_KINDS, suggestForField(), Suggestion, FACTS

### Community 92 - "compile.ts"
Cohesion: 0.36
Nodes (7): CompiledProfile, compileProfileDoc(), estimateTokens(), renderCustom(), renderIdentity(), sha256Hex(), Profile

### Community 93 - "markers.ts"
Cohesion: 0.15
Nodes (13): FieldMarkOptions, JudgedReason, MarkState, mountFieldMark(), placeTab(), TAB_GAP, TAB_HEIGHT, TAB_LABEL (+5 more)

### Community 94 - "Profile"
Cohesion: 0.20
Nodes (9): AddSourceResponse, Profile, ProfileCustom, ProfileIdentity, ProfileIdentityLinks, ProfileResponse, ProfileSourcesItem, ProfileSourcesItemKind (+1 more)

### Community 96 - "opencode.json"
Cohesion: 0.29
Nodes (6): plugin, $schema, skills, paths, @dodopayments/opencode-plugin, node_modules/@dodopayments/opencode-plugin/skills

### Community 97 - "PricingCards.tsx"
Cohesion: 0.33
Nodes (4): PricingCards(), IconCheck(), pricing, Route

### Community 99 - "http-client.ts"
Cohesion: 0.29
Nodes (6): container, API_URL, STORAGE_KEYS, chromeStoragePersister, queryClient, SESSION_EXPIRED_MESSAGE

### Community 100 - "matchOptions"
Cohesion: 0.33
Nodes (6): indexOfWord(), isWordChar(), matchOptions(), normalize(), OptionMatch, FEATURES

### Community 106 - "overlay.ts"
Cohesion: 0.29
Nodes (3): launcher, MARKS, params

### Community 107 - "addTextSource"
Cohesion: 0.33
Nodes (6): LinkMode(), TextMode(), addTextSource(), getAddTextSourceMutationOptions(), getAddTextSourceUrl(), useAddTextSource()

### Community 109 - "httpClient"
Cohesion: 0.29
Nodes (9): getSignInWithGoogleMutationOptions(), getSignInWithGoogleUrl(), SecondParameter, signInWithGoogle(), SignInWithGoogleMutationBody, SignInWithGoogleMutationError, SignInWithGoogleMutationResult, useSignInWithGoogle() (+1 more)

### Community 110 - "Profile.tsx"
Cohesion: 0.12
Nodes (24): Card(), ProBadge(), ScreenHeader(), SkeletonText(), SUNSET_GRADIENT, Toggle(), UpgradeSheet(), UsageBar() (+16 more)

## Knowledge Gaps
- **628 isolated node(s):** `name`, `version`, `private`, `type`, `dev` (+623 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **13 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `mountAnswerCard()` connect `card.ts` to `overlay.ts`, `content.ts`, `package.json`?**
  _High betweenness centrality (0.061) - this node is a cross-community bridge._
- **Why does `node` connect `package.json` to `card.ts`?**
  _High betweenness centrality (0.053) - this node is a cross-community bridge._
- **What connects `name`, `version`, `private` to the rest of the system?**
  _628 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `scripts` be split into smaller, more focused modules?**
  _Cohesion score 0.03773584905660377 - nodes in this community are weakly interconnected._
- **Should `content.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.12310606060606061 - nodes in this community are weakly interconnected._
- **Should `profile/profile.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.061979648473635525 - nodes in this community are weakly interconnected._
- **Should `classify.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.11693548387096774 - nodes in this community are weakly interconnected._