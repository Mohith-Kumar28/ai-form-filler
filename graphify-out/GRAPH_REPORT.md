# Graph Report - ai-form-filler  (2026-08-21)

## Corpus Check
- 272 files · ~415,288 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1964 nodes · 4039 edges · 124 communities (110 shown, 14 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 31 edges (avg confidence: 0.64)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `c99ff8c8`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- compile.ts
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
- onboarding/index.tsx
- generate.ts
- overlay.ts
- devDependencies
- feedback.ts
- form-adapters/package.json
- background.ts
- shared/package.json
- dependencies
- migrate-learned-to-memory.mjs
- write.ts
- Facts.tsx
- Account
- answer-bank.ts
- routes/index.tsx
- resolveLabel
- services/profile.ts
- compilerOptions
- api/tsconfig.json
- shared/src/index.ts
- package.json
- form-adapters/tsconfig.json
- devDependencies
- services/account.ts
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
- model/index.ts
- use-fill.ts
- Fillaform
- ui.tsx
- constants.ts
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
- httpClient
- ExtensionDemo.tsx
- reveal-extension.mjs
- Receipt.tsx
- animate.ts
- config.ts
- PositionScheduler
- main.ts
- markers.ts
- Profile
- card.test.ts
- opencode.json
- site.ts
- router.tsx
- ApiErrorResponse
- addTextSource
- @types/react
- @types/react-dom
- account/account.ts
- vitest
- messages.ts
- onboarding.ts
- standardwebhooks
- lib/auth.ts
- Profile.tsx
- supermemory.ts
- routes/billing.ts
- FieldSchema
- AddSource.tsx
- matchOptions
- generic.ts
- typescript
- `subscriptions`
- services/fill.ts
- Home.tsx
- structure.ts
- wxt

## God Nodes (most connected - your core abstractions)
1. `scripts` - 53 edges
2. `ApiErrorResponse` - 25 edges
3. `Db` - 24 edges
4. `httpClient()` - 23 edges
5. `scripts` - 21 edges
6. `recordFeedback()` - 20 edges
7. `PositionScheduler` - 20 edges
8. `useNavigation()` - 18 edges
9. `Facts()` - 18 edges
10. `getOverlayHost()` - 18 edges

## Surprising Connections (you probably didn't know these)
- `mountAnswerCard()` --references--> `node`  [EXTRACTED]
  apps/extension/src/overlay/card.ts → package.json
- `Variables` --references--> `Account`  [EXTRACTED]
  apps/api/src/env.ts → packages/shared/src/account.ts
- `generateFills()` --calls--> `matchOptions()`  [EXTRACTED]
  apps/api/src/llm/generate.ts → packages/shared/src/options.ts
- `RoutedForm` --references--> `FillTier`  [EXTRACTED]
  apps/api/src/router/classify.ts → packages/shared/src/fill.ts
- `resolveTier0()` --calls--> `matchFact()`  [EXTRACTED]
  apps/api/src/router/tier0.ts → packages/shared/src/facts.ts

## Import Cycles
- None detected.

## Communities (124 total, 14 thin omitted)

### Community 0 - "compile.ts"
Cohesion: 0.16
Nodes (18): CompiledProfile, compileProfileDoc(), estimateTokens(), normalizeText(), renderCustom(), renderIdentity(), sha256Hex(), BrowserBinding (+10 more)

### Community 1 - "scripts"
Cohesion: 0.04
Nodes (53): scripts, //1-develop, //2-build, //3-ship, //4-setup, //5-database, //6-contract, //7-quality (+45 more)

### Community 2 - "content.ts"
Cohesion: 0.14
Nodes (20): main(), detectPageScheme(), CardAction, type(), burstConfetti(), COLORS, getOverlayHost(), GLYPH (+12 more)

### Community 3 - "profile/profile.ts"
Cohesion: 0.05
Nodes (49): AddTextSourceMutationBody, AddTextSourceMutationError, AddTextSourceMutationResult, deleteSource(), DeleteSourceMutationError, DeleteSourceMutationResult, getDeleteSourceMutationOptions(), getDeleteSourceUrl() (+41 more)

### Community 4 - "classify.ts"
Cohesion: 0.25
Nodes (12): AUTOCOMPLETE_SLOT, classifyField(), classifyForm(), IdentitySlot, identitySlotFor(), isAboutApplicant(), LABEL_SLOTS, tierOf() (+4 more)

### Community 5 - "includes"
Cohesion: 0.05
Nodes (37): css, parser, files, includes, formatter, enabled, indentStyle, indentWidth (+29 more)

### Community 6 - "App.tsx"
Cohesion: 0.19
Nodes (18): Stack(), useFillNavigation(), ScreenHeader(), TabBar(), useNavigation(), Sources(), AddSource(), Home() (+10 more)

### Community 7 - "fill/fill.ts"
Cohesion: 0.09
Nodes (25): fillForm(), FillFormMutationBody, FillFormMutationError, FillFormMutationResult, getFillFormMutationOptions(), getFillFormUrl(), getImproveAnswerMutationOptions(), getImproveAnswerUrl() (+17 more)

### Community 8 - "google-forms.ts"
Cohesion: 0.21
Nodes (21): answerFor(), detectQuestion(), hasLayout(), isChosen(), isOpen(), isOtherOption(), isVisible(), matchOption() (+13 more)

### Community 9 - "ats.ts"
Cohesion: 0.18
Nodes (13): ATS_HOSTS, AtsAdapter, driveReactSelect(), isReactSelect(), reactSelectLabel(), readPreloadedOptions(), readSelectedValue(), waitForOption() (+5 more)

### Community 10 - "gallery/main.tsx"
Cohesion: 0.06
Nodes (41): ACCOUNT, ACCOUNT_LOW_QUOTA, ACCOUNT_NO_LONGFORM, ACCOUNT_ON_HOLD, ACCOUNT_ONBOARDING, EMPTY_PROFILE, MESSY_PROFILE, PLAN (+33 more)

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
Cohesion: 0.08
Nodes (27): AddSourceResponse, ApiError, FeedbackRequest, FillPlan, FillRequest, Identity, Profile, ProfilePatch (+19 more)

### Community 17 - "components.tsx"
Cohesion: 0.06
Nodes (28): AddFactForm(), ErrorNote(), EXPRESSIONS, MenuItem, MenuPosition, OverflowMenu(), SearchInput(), Section() (+20 more)

### Community 18 - "form-adapters/src/index.ts"
Cohesion: 0.16
Nodes (11): document, GoogleFormsAdapter, collectPageContext(), detectPageForm(), genericAdapter, selectAdapter(), siteAdapters, detect() (+3 more)

### Community 19 - "onboarding/index.tsx"
Cohesion: 0.10
Nodes (18): Expression, MascotFace(), MascotGradient(), IconBack(), BASICS_REQUIRED, BLOB_STILL, BlobBackdrop(), BlobMascot() (+10 more)

### Community 20 - "generate.ts"
Cohesion: 0.22
Nodes (17): generateFills(), GenerateResult, readCacheCounters(), translateProviderError(), improveAnswer(), ImproveResult, costMicroUsd(), MODELS (+9 more)

### Community 21 - "overlay.ts"
Cohesion: 0.13
Nodes (11): launcher, MARKS, only, params, sendMessage(), LauncherHandle, mountLauncher(), STAGE_MESSAGES (+3 more)

### Community 22 - "devDependencies"
Cohesion: 0.12
Nodes (17): devDependencies, happy-dom, orval, tailwindcss, @tailwindcss/vite, @types/chrome, vite, @vitejs/plugin-react (+9 more)

### Community 23 - "feedback.ts"
Cohesion: 0.13
Nodes (18): canonical(), clampAnswer(), createFeedbackCapture(), displayValueOf(), Entry, FeedbackCapture, feedbackEntryFor(), FeedbackSend (+10 more)

### Community 24 - "form-adapters/package.json"
Cohesion: 0.12
Nodes (16): dependencies, @aff/shared, devDependencies, happy-dom, vitest, exports, @aff/shared, happy-dom (+8 more)

### Community 25 - "background.ts"
Cohesion: 0.14
Nodes (14): DEFAULT_SETTINGS, FORWARDED_TO_CONTENT, MAC_KEYS, LAST_FILL_KEY, registerFillPort(), runFillFlow(), FakePort, fill() (+6 more)

### Community 26 - "shared/package.json"
Cohesion: 0.11
Nodes (18): dependencies, zod, devDependencies, vitest, exports, ./constants, ./facts, ./options (+10 more)

### Community 27 - "dependencies"
Cohesion: 0.15
Nodes (13): @aff/form-adapters, dependencies, @aff/form-adapters, @aff/shared, react, react-dom, @tanstack/react-query, @tanstack/react-query-persist-client (+5 more)

### Community 28 - "migrate-learned-to-memory.mjs"
Cohesion: 0.33
Nodes (3): key, remote, rows

### Community 29 - "write.ts"
Cohesion: 0.32
Nodes (10): matchSelectOption(), nativeValueSetter(), notifyChange(), simulateVisit(), ValueElement, writeCheckedValue(), writeContentEditable(), writeMultiSelectValue() (+2 more)

### Community 30 - "Facts.tsx"
Cohesion: 0.10
Nodes (39): FieldRow(), Basics(), countBasics(), FIELDS, KEYS, Done(), EMPTY, Facts() (+31 more)

### Community 31 - "Account"
Cohesion: 0.24
Nodes (7): Account, AccountQuota, AccountQuotaPlan, AccountSubscription, AccountSubscriptionPlan, AccountSubscriptionStatus, SignInResponse

### Community 32 - "answer-bank.ts"
Cohesion: 0.13
Nodes (32): learnedPointers, learningBudget(), applyToIdentity(), Destination, destinationFor(), Entry, isBlank(), isPlausible() (+24 more)

### Community 33 - "routes/index.tsx"
Cohesion: 0.20
Nodes (11): ChromeCTA(), FAQ(), FAQS, HowItWorks(), STEPS, Reveal(), MascotPattern(), MascotShape (+3 more)

### Community 34 - "resolveLabel"
Cohesion: 0.30
Nodes (13): baseSchema(), groupLabel(), adapter, detect(), labelsOf(), clean(), fromAriaLabelledBy(), fromLabelElement() (+5 more)

### Community 35 - "services/profile.ts"
Cohesion: 0.15
Nodes (28): digitCount(), extractIdentity(), LINK_PATTERNS, mergeIdentity(), trimUrl(), StructuredSource, Db, addSource() (+20 more)

### Community 36 - "compilerOptions"
Cohesion: 0.08
Nodes (24): compilerOptions, baseUrl, esModuleInterop, forceConsistentCasingInFileNames, isolatedModules, jsx, lib, module (+16 more)

### Community 37 - "api/tsconfig.json"
Cohesion: 0.17
Nodes (11): compilerOptions, lib, noEmit, types, extends, include, ES2023, src (+3 more)

### Community 38 - "shared/src/index.ts"
Cohesion: 0.12
Nodes (23): here, outPath, AppEnv, app, requireAuth, onError(), enforceLongformQuota, enforceQuota (+15 more)

### Community 39 - "package.json"
Cohesion: 0.17
Nodes (11): engines, node, name, packageManager, pnpm, onlyBuiltDependencies, private, type (+3 more)

### Community 40 - "form-adapters/tsconfig.json"
Cohesion: 0.17
Nodes (11): compilerOptions, lib, noEmit, types, extends, include, DOM, DOM.Iterable (+3 more)

### Community 41 - "devDependencies"
Cohesion: 0.18
Nodes (11): devDependencies, @cloudflare/workers-types, drizzle-kit, tsx, vitest, wrangler, vitest, wrangler (+3 more)

### Community 42 - "services/account.ts"
Cohesion: 0.21
Nodes (14): profileDocs, profileSources, quotaUsage, subscriptions, users, consumeQuota(), readUsage(), chargeIngest() (+6 more)

### Community 43 - "compilerOptions"
Cohesion: 0.18
Nodes (10): compilerOptions, jsx, noUncheckedIndexedAccess, strict, verbatimModuleSyntax, extends, include, src (+2 more)

### Community 44 - "Design Audit"
Cohesion: 0.10
Nodes (19): Code Quality, Color and Surfaces, Component Patterns, Content, Design Audit, Fix Priority, How This Works, Iconography (+11 more)

### Community 45 - "Sources.tsx"
Cohesion: 0.23
Nodes (15): ConfirmSheet(), EmptyState(), KIND_NOUN, Preview(), SourceDetail(), formatLabel(), SourceCard(), SourceTile() (+7 more)

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
Cohesion: 0.18
Nodes (10): Audience and scene, Brand commitments, Constraints, Fillaform — Product truth, How it is paid for, The one thing the UI must make legible, The surface, The unique mechanism (+2 more)

### Community 52 - "create-resources.mjs"
Cohesion: 0.22
Nodes (5): d1Id, d1Out, kvOut, PLACEHOLDER, TOML

### Community 53 - "model/index.ts"
Cohesion: 0.25
Nodes (7): FillRequest, FillRequestForm, FillRequestFormFieldsItem, FillRequestFormFieldsItemKind, FillRequestFormFieldsItemOptionsItem, FillRequestScope, SignInRequest

### Community 54 - "use-fill.ts"
Cohesion: 0.19
Nodes (17): applyVerdict(), clearDraft(), drafts, emit(), EMPTY, getDraft(), hydrate(), listeners (+9 more)

### Community 55 - "Fillaform"
Cohesion: 0.22
Nodes (7): Before public listing, Before this is real, Build phases, Fillaform, Layout, Two invariants, Verification

### Community 56 - "ui.tsx"
Cohesion: 0.10
Nodes (22): FEATURES, Hero(), ReadVsGuessed(), Expression, EXPRESSIONS, GuessedBadge(), IconBuilding(), IconCheck() (+14 more)

### Community 57 - "constants.ts"
Cohesion: 0.17
Nodes (15): Variables, Account, QuotaState, LEARN_MAX_OPTIONS, offerFor(), PLAN_LIMITS, PLAN_LONGFORM_LIMITS, PLAN_SOLO_ESSAY_LIMITS (+7 more)

### Community 58 - "6. Remaining work"
Cohesion: 0.20
Nodes (10): 6. Remaining work, 7.10 The content script bundle is a tax on every page, Deferred / future, First run — the panel's own eight screens, Phase 3 — Fill core ⬅ IN PROGRESS, Phase 3 message flow, Phase 4 — The magic layer ✅ built, Phase 5 — Site adapters (+2 more)

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
Nodes (18): CreateCheckoutMutationBody, CreateCheckoutMutationError, CreateCheckoutMutationResult, getCreateCheckoutMutationOptions(), getCreateCheckoutUrl(), getGetPortalQueryKey(), getGetPortalQueryOptions(), getGetPortalUrl() (+10 more)

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
Cohesion: 0.18
Nodes (19): AnswerCardSpec, BaseSpec, CardSpec, escapeHtml(), MenuCard, mountAnswerCard(), mountCard(), mountMenuCard() (+11 more)

### Community 80 - "httpClient"
Cohesion: 0.22
Nodes (12): getSignInWithGoogleMutationOptions(), getSignInWithGoogleUrl(), SecondParameter, signInWithGoogle(), SignInWithGoogleMutationBody, SignInWithGoogleMutationError, SignInWithGoogleMutationResult, useSignInWithGoogle() (+4 more)

### Community 82 - "ExtensionDemo.tsx"
Cohesion: 0.10
Nodes (23): AnswerCard(), ChoiceControl(), DemoField, ExtensionDemo(), FieldKind, FieldRow(), FIELDS, isJudged() (+15 more)

### Community 88 - "Receipt.tsx"
Cohesion: 0.14
Nodes (17): Chip(), Row(), RowGroup(), Screen(), ScreenFooter(), IconAlert(), IconCheck(), IconSparkle() (+9 more)

### Community 89 - "animate.ts"
Cohesion: 0.26
Nodes (10): AnimatedFill, ANIMATION_TIMINGS, AnimationHooks, isTypeable(), runFillAnimation(), sleep(), typeInto(), PILL (+2 more)

### Community 90 - "config.ts"
Cohesion: 0.22
Nodes (9): App(), useSignedIn(), container, hasSession(), API_URL, STORAGE_KEYS, chromeStoragePersister, queryClient (+1 more)

### Community 92 - "main.ts"
Cohesion: 0.50
Nodes (4): render(), request(), root, State

### Community 93 - "markers.ts"
Cohesion: 0.13
Nodes (18): CardHandle, FieldMark, FieldMarkOptions, JudgedReason, MarkState, mountFieldMark(), placeTab(), TAB_GAP (+10 more)

### Community 94 - "Profile"
Cohesion: 0.20
Nodes (9): AddSourceResponse, Profile, ProfileCustom, ProfileIdentity, ProfileIdentityLinks, ProfileResponse, ProfileSourcesItem, ProfileSourcesItemKind (+1 more)

### Community 96 - "opencode.json"
Cohesion: 0.29
Nodes (6): plugin, $schema, skills, paths, @dodopayments/opencode-plugin, node_modules/@dodopayments/opencode-plugin/skills

### Community 97 - "site.ts"
Cohesion: 0.18
Nodes (10): Footer(), footerColumns, Logo(), Navbar(), PricingCards(), navLinks, pricing, site (+2 more)

### Community 99 - "ApiErrorResponse"
Cohesion: 0.16
Nodes (12): GoogleIdentity, TokenInfo, UserInfo, verifyGoogleAccessToken(), issueSessionToken(), key(), verifySessionToken(), SignInRequest (+4 more)

### Community 100 - "addTextSource"
Cohesion: 0.33
Nodes (6): LinkMode(), TextMode(), addTextSource(), getAddTextSourceMutationOptions(), getAddTextSourceUrl(), useAddTextSource()

### Community 103 - "account/account.ts"
Cohesion: 0.22
Nodes (11): Button(), Mascot(), Welcome(), getAccount(), GetAccountQueryError, GetAccountQueryResult, getGetAccountQueryKey(), getGetAccountQueryOptions() (+3 more)

### Community 106 - "messages.ts"
Cohesion: 0.24
Nodes (9): FillState, ApiError, ApiErrorCode, HTTP_STATUS_FOR_CODE, FillPlan, ApplyReport, Request, ResponseFor (+1 more)

### Community 107 - "onboarding.ts"
Cohesion: 0.29
Nodes (6): Onboarding, ONBOARDING_KEY, OnboardingRecord, OnboardingStatus, Resolved, resolveOnboarding()

### Community 109 - "lib/auth.ts"
Cohesion: 0.26
Nodes (12): PageRequestedPaywall(), getAuthToken(), signIn(), signOut(), PendingPaywall, usePaywallSeen(), usePendingPaywall(), PAYWALL_KEY (+4 more)

### Community 110 - "Profile.tsx"
Cohesion: 0.15
Nodes (22): planRows(), SaveState(), SaveStatus, SUNSET_GRADIENT, Toggle(), UpgradeSheet(), UsageBar(), IconCrown() (+14 more)

### Community 111 - "supermemory.ts"
Cohesion: 0.18
Nodes (15): Env, ImproveInput, FillContext, FillContextInput, RetrievalRequest, addFile(), addUrl(), containerFor() (+7 more)

### Community 112 - "routes/billing.ts"
Cohesion: 0.18
Nodes (15): billingRoutes, CheckoutRequest, CheckoutResponse, checkoutRoute, PortalResponse, portalRoute, applyWebhook(), createCheckout() (+7 more)

### Community 113 - "FieldSchema"
Cohesion: 0.21
Nodes (12): GenerateInput, buildUserMessage(), describeField(), SubmitFillsInput, SubmitFillsSchema, SYSTEM_INSTRUCTIONS, UserMessageInput, Classification (+4 more)

### Community 114 - "AddSource.tsx"
Cohesion: 0.07
Nodes (36): AiBadge(), AutoTextarea(), Field(), Input(), Segment, SegmentedControl(), StatusPill(), IconAudio() (+28 more)

### Community 115 - "matchOptions"
Cohesion: 0.33
Nodes (6): indexOfWord(), isWordChar(), matchOptions(), normalize(), OptionMatch, FEATURES

### Community 116 - "generic.ts"
Cohesion: 0.25
Nodes (11): documentHasLayout(), GenericAdapter, groupControls(), isFillable(), isVisible(), nextId(), optionsOf(), resetIdCounter() (+3 more)

### Community 120 - "services/fill.ts"
Cohesion: 0.23
Nodes (10): fillLog, budgetFills(), emptyUsage(), FillContext, runFill(), writeFillLog(), writeRewriteLog(), emptyProfile() (+2 more)

### Community 121 - "Home.tsx"
Cohesion: 0.20
Nodes (10): Card(), ProBadge(), ScreenBody(), SkeletonText(), IconMascot(), PageEntry(), ActivePage, INITIAL (+2 more)

### Community 122 - "structure.ts"
Cohesion: 0.33
Nodes (6): mediaTypeFor(), READABLE_MEDIA_TYPES, StructuredProfileSchema, StructureResult, structureSource(), StructureSourceInput

## Knowledge Gaps
- **664 isolated node(s):** `name`, `version`, `private`, `type`, `dev` (+659 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **14 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `mountAnswerCard()` connect `card.ts` to `content.ts`, `overlay.ts`, `card.test.ts`, `package.json`?**
  _High betweenness centrality (0.058) - this node is a cross-community bridge._
- **Why does `node` connect `package.json` to `card.ts`?**
  _High betweenness centrality (0.052) - this node is a cross-community bridge._
- **What connects `name`, `version`, `private` to the rest of the system?**
  _664 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `scripts` be split into smaller, more focused modules?**
  _Cohesion score 0.03773584905660377 - nodes in this community are weakly interconnected._
- **Should `content.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.1354679802955665 - nodes in this community are weakly interconnected._
- **Should `profile/profile.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05079825834542816 - nodes in this community are weakly interconnected._
- **Should `includes` be split into smaller, more focused modules?**
  _Cohesion score 0.05128205128205128 - nodes in this community are weakly interconnected._