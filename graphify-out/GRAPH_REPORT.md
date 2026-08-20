# Graph Report - ai-form-filler  (2026-08-20)

## Corpus Check
- 257 files · ~359,160 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1774 nodes · 3470 edges · 109 communities (97 shown, 12 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 29 edges (avg confidence: 0.6)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `515fc270`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- compile.ts
- scripts
- content.ts
- profile/profile.ts
- services/fill.ts
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
- Account
- AddSource.tsx
- form-adapters/src/index.ts
- ApiErrorResponse
- generate.ts
- account/account.ts
- devDependencies
- constants.ts
- form-adapters/package.json
- shared/src/index.ts
- shared/package.json
- dependencies
- migrate-learned-to-memory.mjs
- write.ts
- background.ts
- model/index.ts
- answer-bank.ts
- routes/index.tsx
- generic.ts
- services/profile.ts
- compilerOptions
- api/tsconfig.json
- services/account.ts
- package.json
- form-adapters/tsconfig.json
- devDependencies
- routes/profile.ts
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
- http-client.ts
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
- site
- $slug.tsx
- reveal-extension.mjs
- components.tsx
- animate.ts
- suggest.ts
- PositionScheduler
- Receipt.tsx
- markers.ts
- Profile
- scheduler.ts
- opencode.json
- site.ts
- router.tsx
- sidepanel/main.tsx
- matchOptions
- @types/react
- @types/react-dom
- typescript
- vitest
- overlay.ts
- wxt
- standardwebhooks

## God Nodes (most connected - your core abstractions)
1. `scripts` - 53 edges
2. `ApiErrorResponse` - 24 edges
3. `httpClient()` - 22 edges
4. `scripts` - 21 edges
5. `Db` - 21 edges
6. `recordFeedback()` - 19 edges
7. `PositionScheduler` - 19 edges
8. `Reveal()` - 18 edges
9. `compilerOptions` - 18 edges
10. `site` - 17 edges

## Surprising Connections (you probably didn't know these)
- `Variables` --references--> `Account`  [EXTRACTED]
  apps/api/src/env.ts → packages/shared/src/account.ts
- `mountAnswerCard()` --references--> `node`  [EXTRACTED]
  apps/extension/src/overlay/card.ts → package.json
- `generateFills()` --calls--> `matchOptions()`  [EXTRACTED]
  apps/api/src/llm/generate.ts → packages/shared/src/options.ts
- `Classification` --references--> `FillTier`  [EXTRACTED]
  apps/api/src/router/classify.ts → packages/shared/src/fill.ts
- `RoutedForm` --references--> `FillTier`  [EXTRACTED]
  apps/api/src/router/classify.ts → packages/shared/src/fill.ts

## Import Cycles
- None detected.

## Communities (109 total, 12 thin omitted)

### Community 0 - "compile.ts"
Cohesion: 0.13
Nodes (23): CompiledProfile, compileProfileDoc(), estimateTokens(), normalizeText(), renderCustom(), renderIdentity(), sha256Hex(), digitCount() (+15 more)

### Community 1 - "scripts"
Cohesion: 0.04
Nodes (53): scripts, //1-develop, //2-build, //3-ship, //4-setup, //5-database, //6-contract, //7-quality (+45 more)

### Community 2 - "content.ts"
Cohesion: 0.19
Nodes (16): main(), CardAction, burstConfetti(), COLORS, getOverlayHost(), GLYPH, isOverlayEvent(), isOverlayHost() (+8 more)

### Community 3 - "profile/profile.ts"
Cohesion: 0.06
Nodes (52): LinkMode(), TextMode(), VoiceMode(), addTextSource(), AddTextSourceMutationBody, AddTextSourceMutationError, AddTextSourceMutationResult, deleteSource() (+44 more)

### Community 4 - "services/fill.ts"
Cohesion: 0.12
Nodes (25): fillLog, GenerateResult, TokenUsage, AUTOCOMPLETE_SLOT, Classification, classifyField(), classifyForm(), IdentitySlot (+17 more)

### Community 5 - "includes"
Cohesion: 0.05
Nodes (37): css, parser, files, includes, formatter, enabled, indentStyle, indentWidth (+29 more)

### Community 6 - "App.tsx"
Cohesion: 0.17
Nodes (19): App(), Stack(), useFillNavigation(), useSignedIn(), TabBar(), useNavigation(), AddSource(), Home() (+11 more)

### Community 7 - "fill/fill.ts"
Cohesion: 0.09
Nodes (26): fillForm(), FillFormMutationBody, FillFormMutationError, FillFormMutationResult, getFillFormMutationOptions(), getFillFormUrl(), getImproveAnswerMutationOptions(), getImproveAnswerUrl() (+18 more)

### Community 8 - "google-forms.ts"
Cohesion: 0.18
Nodes (23): answerFor(), detectQuestion(), GoogleFormsAdapter, hasLayout(), isChosen(), isOpen(), isOtherOption(), isVisible() (+15 more)

### Community 9 - "ats.ts"
Cohesion: 0.19
Nodes (12): ATS_HOSTS, AtsAdapter, driveReactSelect(), isReactSelect(), readPreloadedOptions(), readSelectedValue(), waitForOption(), detect() (+4 more)

### Community 10 - "gallery/main.tsx"
Cohesion: 0.06
Nodes (38): ACCOUNT, ACCOUNT_LOW_QUOTA, EMPTY_PROFILE, PLAN, PROFILE, REPORT, PAGE_WITH_FORM, PAGE_WITHOUT_FORM (+30 more)

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

### Community 16 - "Account"
Cohesion: 0.24
Nodes (7): Account, AccountQuota, AccountQuotaPlan, AccountSubscription, AccountSubscriptionPlan, AccountSubscriptionStatus, SignInResponse

### Community 17 - "AddSource.tsx"
Cohesion: 0.07
Nodes (25): AutoTextarea(), Field(), Input(), Segment, SegmentedControl(), IconAudio(), IconBack(), IconChevronRight() (+17 more)

### Community 18 - "form-adapters/src/index.ts"
Cohesion: 0.17
Nodes (9): document, collectPageContext(), detectPageForm(), genericAdapter, selectAdapter(), siteAdapters, detect(), DetectionResult (+1 more)

### Community 19 - "ApiErrorResponse"
Cohesion: 0.15
Nodes (13): GoogleIdentity, TokenInfo, UserInfo, verifyGoogleAccessToken(), issueSessionToken(), key(), verifySessionToken(), SignInRequest (+5 more)

### Community 20 - "generate.ts"
Cohesion: 0.10
Nodes (34): Env, generateFills(), GenerateInput, readCacheCounters(), translateProviderError(), improveAnswer(), ImproveInput, costMicroUsd() (+26 more)

### Community 21 - "account/account.ts"
Cohesion: 0.33
Nodes (8): getAccount(), GetAccountQueryError, GetAccountQueryResult, getGetAccountQueryOptions(), getGetAccountUrl(), SecondParameter, useGetAccount(), withQueryKey()

### Community 22 - "devDependencies"
Cohesion: 0.12
Nodes (17): devDependencies, happy-dom, orval, tailwindcss, @tailwindcss/vite, @types/chrome, vite, @vitejs/plugin-react (+9 more)

### Community 23 - "constants.ts"
Cohesion: 0.13
Nodes (21): canonical(), clampAnswer(), createFeedbackCapture(), displayValueOf(), Entry, FeedbackCapture, feedbackEntryFor(), FeedbackSend (+13 more)

### Community 24 - "form-adapters/package.json"
Cohesion: 0.12
Nodes (16): dependencies, @aff/shared, devDependencies, happy-dom, vitest, exports, @aff/shared, happy-dom (+8 more)

### Community 25 - "shared/src/index.ts"
Cohesion: 0.11
Nodes (25): LAST_FILL_KEY, registerFillPort(), runFillFlow(), FakePort, fill(), fillForm, FillState, Account (+17 more)

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

### Community 30 - "background.ts"
Cohesion: 0.28
Nodes (6): DEFAULT_SETTINGS, FORWARDED_TO_CONTENT, toResult(), Request, ResponseFor, Result

### Community 31 - "model/index.ts"
Cohesion: 0.20
Nodes (5): FillPlanSkippedItemReason, RenameSourceRequest, SignInRequest, TextSourceRequest, UploadSourceBody

### Community 32 - "answer-bank.ts"
Cohesion: 0.12
Nodes (35): learningBudget(), applyToIdentity(), Destination, destinationFor(), Entry, isBlank(), isPlausible(), looksSecret() (+27 more)

### Community 33 - "routes/index.tsx"
Cohesion: 0.14
Nodes (13): FAQ(), FAQS, FEATURES, FeaturesGrid(), HowItWorks(), STEPS, ReadVsGuessed(), Reveal() (+5 more)

### Community 34 - "generic.ts"
Cohesion: 0.15
Nodes (25): reactSelectLabel(), baseSchema(), documentHasLayout(), GenericAdapter, groupControls(), groupLabel(), isFillable(), isVisible() (+17 more)

### Community 35 - "services/profile.ts"
Cohesion: 0.25
Nodes (18): StructuredSource, Db, addSource(), definedOnly(), deleteSource(), fillIfEmpty(), getProfile(), getSourceFile() (+10 more)

### Community 36 - "compilerOptions"
Cohesion: 0.08
Nodes (24): compilerOptions, baseUrl, esModuleInterop, forceConsistentCasingInFileNames, isolatedModules, jsx, lib, module (+16 more)

### Community 37 - "api/tsconfig.json"
Cohesion: 0.17
Nodes (11): compilerOptions, lib, noEmit, types, extends, include, ES2023, src (+3 more)

### Community 38 - "services/account.ts"
Cohesion: 0.13
Nodes (21): learnedPointers, profileDocs, profileSources, quotaUsage, subscriptions, users, webhookRoutes, currentPeriod() (+13 more)

### Community 39 - "package.json"
Cohesion: 0.17
Nodes (11): engines, node, name, packageManager, pnpm, onlyBuiltDependencies, private, type (+3 more)

### Community 40 - "form-adapters/tsconfig.json"
Cohesion: 0.17
Nodes (11): compilerOptions, lib, noEmit, types, extends, include, DOM, DOM.Iterable (+3 more)

### Community 41 - "devDependencies"
Cohesion: 0.18
Nodes (11): devDependencies, @cloudflare/workers-types, drizzle-kit, tsx, vitest, wrangler, vitest, wrangler (+3 more)

### Community 42 - "routes/profile.ts"
Cohesion: 0.05
Nodes (57): here, outPath, AppEnv, Variables, app, requireAuth, onError(), consumeQuota() (+49 more)

### Community 43 - "compilerOptions"
Cohesion: 0.18
Nodes (10): compilerOptions, jsx, noUncheckedIndexedAccess, strict, verbatimModuleSyntax, extends, include, src (+2 more)

### Community 44 - "Design Audit"
Cohesion: 0.10
Nodes (19): Code Quality, Color and Surfaces, Component Patterns, Content, Design Audit, Fix Priority, How This Works, Iconography (+11 more)

### Community 45 - "Sources.tsx"
Cohesion: 0.13
Nodes (20): ConfirmSheet(), EmptyState(), IconExternal(), IconTrash(), KIND_NOUN, Preview(), FACT_LIMITS, HINTS (+12 more)

### Community 46 - "scripts"
Cohesion: 0.18
Nodes (11): scripts, api:generate, build, build:firefox, dev, dev:firefox, gallery, postinstall (+3 more)

### Community 47 - "fillPlan.ts"
Cohesion: 0.31
Nodes (6): FillPlan, FillPlanFillsItem, FillPlanFillsItemKind, FillPlanFillsItemTier, FillPlanSkippedItem, FillPlanUsage

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
Cohesion: 0.20
Nodes (16): applyVerdict(), clearDraft(), drafts, emit(), EMPTY, getDraft(), hydrate(), listeners (+8 more)

### Community 55 - "Fillaform"
Cohesion: 0.22
Nodes (7): Before public listing, Before this is real, Build phases, Fillaform, Layout, Two invariants, Verification

### Community 56 - "ui.tsx"
Cohesion: 0.16
Nodes (16): ANSWERS, DemoState, ExtensionDemo(), FORM_FIELDS, MarkState, ReviewPanel(), STAGES, Button() (+8 more)

### Community 57 - "http-client.ts"
Cohesion: 0.17
Nodes (18): getSignInWithGoogleMutationOptions(), getSignInWithGoogleUrl(), SecondParameter, signInWithGoogle(), SignInWithGoogleMutationBody, SignInWithGoogleMutationError, SignInWithGoogleMutationResult, useSignInWithGoogle() (+10 more)

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
Cohesion: 0.10
Nodes (23): createCheckout(), CreateCheckoutMutationBody, CreateCheckoutMutationError, CreateCheckoutMutationResult, getCreateCheckoutMutationOptions(), getCreateCheckoutUrl(), getGetPortalQueryKey(), getGetPortalQueryOptions() (+15 more)

### Community 68 - "extension/package.json"
Cohesion: 0.40
Nodes (4): name, private, type, version

### Community 69 - "seo.ts"
Cohesion: 0.14
Nodes (11): buildMeta(), canonicalLink(), jsonLd(), MetaTag, softwareAppSchema(), ComparisonRow, Route, ROWS (+3 more)

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
Cohesion: 0.17
Nodes (20): AnswerCardSpec, BaseSpec, CardHandle, CardSpec, escapeHtml(), MenuCard, mountAnswerCard(), mountCard() (+12 more)

### Community 80 - "site"
Cohesion: 0.18
Nodes (11): ChromeCTA(), Footer(), footerNav, Hero(), Logo(), Navbar(), IconSparkle(), Mascot() (+3 more)

### Community 82 - "$slug.tsx"
Cohesion: 0.22
Nodes (10): posts, BlogBlock, BlogPost, formatDate(), getPost(), getPosts(), BlogIndex(), Route (+2 more)

### Community 88 - "components.tsx"
Cohesion: 0.09
Nodes (27): Card(), MenuItem, OverflowMenu(), ProBadge(), ScreenBody(), ScreenHeader(), SkeletonRow(), SkeletonText() (+19 more)

### Community 89 - "animate.ts"
Cohesion: 0.26
Nodes (10): AnimatedFill, ANIMATION_TIMINGS, AnimationHooks, isTypeable(), runFillAnimation(), sleep(), typeInto(), PILL (+2 more)

### Community 90 - "suggest.ts"
Cohesion: 0.24
Nodes (7): KnownFacts, Rule, RULES, SUGGESTABLE_KINDS, suggestForField(), Suggestion, FACTS

### Community 92 - "Receipt.tsx"
Cohesion: 0.13
Nodes (20): Button(), Chip(), Expression, Mascot(), Row(), RowGroup(), Screen(), ScreenFooter() (+12 more)

### Community 93 - "markers.ts"
Cohesion: 0.15
Nodes (13): FieldMarkOptions, JudgedReason, MarkState, mountFieldMark(), placeTab(), TAB_GAP, TAB_HEIGHT, TAB_LABEL (+5 more)

### Community 94 - "Profile"
Cohesion: 0.20
Nodes (9): AddSourceResponse, Profile, ProfileCustom, ProfileIdentity, ProfileIdentityLinks, ProfileResponse, ProfileSourcesItem, ProfileSourcesItemKind (+1 more)

### Community 95 - "scheduler.ts"
Cohesion: 0.20
Nodes (8): COPY, LearningNote, LearningState, live, mountLearningNote(), noteLearning(), PositionTarget, TrackedTarget

### Community 96 - "opencode.json"
Cohesion: 0.29
Nodes (6): plugin, $schema, skills, paths, @dodopayments/opencode-plugin, node_modules/@dodopayments/opencode-plugin/skills

### Community 97 - "site.ts"
Cohesion: 0.43
Nodes (3): PricingCards(), pricing, Route

### Community 99 - "sidepanel/main.tsx"
Cohesion: 0.60
Nodes (3): container, chromeStoragePersister, queryClient

### Community 100 - "matchOptions"
Cohesion: 0.33
Nodes (6): indexOfWord(), isWordChar(), matchOptions(), normalize(), OptionMatch, FEATURES

### Community 106 - "overlay.ts"
Cohesion: 0.29
Nodes (3): launcher, MARKS, params

## Knowledge Gaps
- **626 isolated node(s):** `name`, `version`, `private`, `type`, `dev` (+621 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **12 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `mountAnswerCard()` connect `card.ts` to `overlay.ts`, `content.ts`, `package.json`?**
  _High betweenness centrality (0.067) - this node is a cross-community bridge._
- **Why does `node` connect `package.json` to `card.ts`?**
  _High betweenness centrality (0.065) - this node is a cross-community bridge._
- **What connects `name`, `version`, `private` to the rest of the system?**
  _626 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `compile.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.12643678160919541 - nodes in this community are weakly interconnected._
- **Should `scripts` be split into smaller, more focused modules?**
  _Cohesion score 0.03773584905660377 - nodes in this community are weakly interconnected._
- **Should `profile/profile.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.055152394775036286 - nodes in this community are weakly interconnected._
- **Should `services/fill.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.11596638655462185 - nodes in this community are weakly interconnected._