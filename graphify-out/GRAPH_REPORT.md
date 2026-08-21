# Graph Report - ai-form-filler  (2026-08-21)

## Corpus Check
- 283 files · ~527,845 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2071 nodes · 4237 edges · 118 communities (104 shown, 14 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 33 edges (avg confidence: 0.64)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `e1d7f169`
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
- Profile.tsx
- components.tsx
- form-adapters/src/index.ts
- onboarding/index.tsx
- generate.ts
- messages.ts
- devDependencies
- services/billing.ts
- form-adapters/package.json
- matchOptions
- shared/package.json
- dependencies
- migrate-learned-to-memory.mjs
- write.ts
- Facts.tsx
- Account
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
- shared/src/index.ts
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
- hono
- Fillaform
- ui.tsx
- services/fill.ts
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
- account/account.ts
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
- routes/profile.ts
- animate.ts
- source-file.ts
- PositionScheduler
- main.ts
- markers.ts
- Profile
- getOverlayHost
- opencode.json
- site.ts
- router.tsx
- onboarding.ts
- dodo-live.mjs
- happy-dom
- @types/react-dom
- build.mjs
- vitest
- Store artwork
- background.ts
- Receipt.tsx
- overlay.ts
- google-forms.fixture.test.ts
- model/index.ts
- AddSource.tsx
- typescript
- `subscriptions`
- 0004_abandoned_subscriptions.sql
- wxt

## God Nodes (most connected - your core abstractions)
1. `scripts` - 56 edges
2. `ApiErrorResponse` - 27 edges
3. `Db` - 24 edges
4. `httpClient()` - 24 edges
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
- `GenerateInput` --references--> `FillTier`  [EXTRACTED]
  apps/api/src/llm/generate.ts → packages/shared/src/fill.ts
- `generateFills()` --calls--> `matchOptions()`  [EXTRACTED]
  apps/api/src/llm/generate.ts → packages/shared/src/options.ts
- `RoutedForm` --references--> `FillTier`  [EXTRACTED]
  apps/api/src/router/classify.ts → packages/shared/src/fill.ts

## Import Cycles
- None detected.

## Communities (118 total, 14 thin omitted)

### Community 0 - "compile.ts"
Cohesion: 0.13
Nodes (22): CompiledProfile, compileProfileDoc(), estimateTokens(), normalizeText(), renderCustom(), renderIdentity(), sha256Hex(), digitCount() (+14 more)

### Community 1 - "scripts"
Cohesion: 0.04
Nodes (56): scripts, //1-develop, //2-build, //2b-assets, //3-ship, //4-setup, //5-database, //6-contract (+48 more)

### Community 2 - "content.ts"
Cohesion: 0.14
Nodes (17): main(), CardAction, burstConfetti(), COLORS, GLYPH, isOverlayEvent(), isOverlayHost(), OverlayHost (+9 more)

### Community 3 - "profile/profile.ts"
Cohesion: 0.06
Nodes (45): AddTextSourceMutationBody, AddTextSourceMutationError, AddTextSourceMutationResult, DeleteSourceMutationError, DeleteSourceMutationResult, getAddTextSourceMutationOptions(), getGetProfileQueryOptions(), getGetProfileUrl() (+37 more)

### Community 4 - "classify.ts"
Cohesion: 0.14
Nodes (23): buildUserMessage(), describeField(), SubmitFillsInput, SubmitFillsSchema, SYSTEM_INSTRUCTIONS, UserMessageInput, AUTOCOMPLETE_SLOT, Classification (+15 more)

### Community 5 - "includes"
Cohesion: 0.05
Nodes (37): css, parser, files, includes, formatter, enabled, indentStyle, indentWidth (+29 more)

### Community 6 - "App.tsx"
Cohesion: 0.18
Nodes (17): App(), PageRequestedPaywall(), Stack(), useFillNavigation(), useSignedIn(), Onboarding(), Home(), useGetProfile() (+9 more)

### Community 7 - "fill/fill.ts"
Cohesion: 0.12
Nodes (22): fillForm(), FillFormMutationBody, FillFormMutationError, FillFormMutationResult, getFillFormMutationOptions(), getFillFormUrl(), getImproveAnswerMutationOptions(), getImproveAnswerUrl() (+14 more)

### Community 8 - "google-forms.ts"
Cohesion: 0.18
Nodes (23): answerFor(), detectQuestion(), GoogleFormsAdapter, hasLayout(), isChosen(), isOpen(), isOtherOption(), isVisible() (+15 more)

### Community 9 - "ats.ts"
Cohesion: 0.16
Nodes (14): ATS_HOSTS, AtsAdapter, driveReactSelect(), isReactSelect(), reactSelectLabel(), readPreloadedOptions(), readSelectedValue(), waitForOption() (+6 more)

### Community 10 - "gallery/main.tsx"
Cohesion: 0.05
Nodes (43): ACCOUNT, ACCOUNT_LOW_QUOTA, ACCOUNT_NO_LONGFORM, ACCOUNT_ON_HOLD, ACCOUNT_ONBOARDING, EMPTY_PROFILE, MESSY_PROFILE, PLAN (+35 more)

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

### Community 16 - "Profile.tsx"
Cohesion: 0.14
Nodes (24): DeleteAccountSheet(), DeletedFarewell(), planRows(), SaveState(), SaveStatus, Toggle(), UpgradeSheet(), UsageBar() (+16 more)

### Community 17 - "components.tsx"
Cohesion: 0.06
Nodes (32): AddFactForm(), Card(), DeleteStep, ErrorNote(), EXPRESSIONS, MenuItem, MenuPosition, OverflowMenu() (+24 more)

### Community 18 - "form-adapters/src/index.ts"
Cohesion: 0.14
Nodes (15): document, collectPageContext(), detectPageForm(), genericAdapter, selectAdapter(), siteAdapters, detect(), inSubmittableForm() (+7 more)

### Community 19 - "onboarding/index.tsx"
Cohesion: 0.10
Nodes (17): Expression, MascotFace(), MascotGradient(), IconBack(), BLOB_STILL, BlobBackdrop(), BlobMascot(), MORPH (+9 more)

### Community 20 - "generate.ts"
Cohesion: 0.17
Nodes (22): Env, generateFills(), GenerateInput, readCacheCounters(), translateProviderError(), improveAnswer(), ImproveInput, ImproveResult (+14 more)

### Community 21 - "messages.ts"
Cohesion: 0.08
Nodes (38): LAST_FILL_KEY, registerFillPort(), runFillFlow(), FakePort, fill(), fillForm, toResult(), applyVerdict() (+30 more)

### Community 22 - "devDependencies"
Cohesion: 0.12
Nodes (17): devDependencies, orval, tailwindcss, @tailwindcss/vite, @types/chrome, @types/react, vite, @vitejs/plugin-react (+9 more)

### Community 23 - "services/billing.ts"
Cohesion: 0.13
Nodes (21): bearerAuth, billingRoutes, CheckoutRequest, CheckoutResponse, checkoutRoute, PortalResponse, portalRoute, applyWebhook() (+13 more)

### Community 24 - "form-adapters/package.json"
Cohesion: 0.12
Nodes (16): dependencies, @aff/shared, devDependencies, happy-dom, vitest, exports, @aff/shared, happy-dom (+8 more)

### Community 25 - "matchOptions"
Cohesion: 0.33
Nodes (6): indexOfWord(), isWordChar(), matchOptions(), normalize(), OptionMatch, FEATURES

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
Nodes (42): FieldRow(), Section(), IconCheck(), Basics(), BASICS_REQUIRED, countBasics(), FIELDS, SHOWN (+34 more)

### Community 31 - "Account"
Cohesion: 0.31
Nodes (6): Account, AccountQuota, AccountSubscription, AccountSubscriptionPlan, AccountSubscriptionStatus, SignInResponse

### Community 32 - "answer-bank.ts"
Cohesion: 0.06
Nodes (65): learningBudget(), applyToIdentity(), Destination, destinationFor(), Entry, isBlank(), isPlausible(), looksSecret() (+57 more)

### Community 33 - "routes/index.tsx"
Cohesion: 0.20
Nodes (11): ChromeCTA(), FAQ(), FAQS, HowItWorks(), STEPS, Reveal(), MascotPattern(), MascotShape (+3 more)

### Community 34 - "generic.ts"
Cohesion: 0.18
Nodes (23): baseSchema(), documentHasLayout(), groupControls(), groupLabel(), isFillable(), isVisible(), nextId(), optionsOf() (+15 more)

### Community 35 - "services/profile.ts"
Cohesion: 0.17
Nodes (25): mergeIdentity(), StructuredSource, Db, addSource(), definedOnly(), deleteSource(), emptyProfile(), fillIfEmpty() (+17 more)

### Community 36 - "compilerOptions"
Cohesion: 0.08
Nodes (24): compilerOptions, baseUrl, esModuleInterop, forceConsistentCasingInFileNames, isolatedModules, jsx, lib, module (+16 more)

### Community 37 - "api/tsconfig.json"
Cohesion: 0.17
Nodes (11): compilerOptions, lib, noEmit, types, extends, include, ES2023, src (+3 more)

### Community 38 - "services/account.ts"
Cohesion: 0.17
Nodes (20): abandonedSubscriptions, fillLog, learnedPointers, profileDocs, profileSources, quotaUsage, subscriptions, users (+12 more)

### Community 39 - "package.json"
Cohesion: 0.17
Nodes (11): engines, node, name, packageManager, pnpm, onlyBuiltDependencies, private, type (+3 more)

### Community 40 - "form-adapters/tsconfig.json"
Cohesion: 0.17
Nodes (11): compilerOptions, lib, noEmit, types, extends, include, DOM, DOM.Iterable (+3 more)

### Community 41 - "devDependencies"
Cohesion: 0.18
Nodes (11): devDependencies, @cloudflare/workers-types, drizzle-kit, tsx, vitest, wrangler, vitest, wrangler (+3 more)

### Community 42 - "shared/src/index.ts"
Cohesion: 0.07
Nodes (39): here, outPath, GoogleIdentity, TokenInfo, UserInfo, verifyGoogleAccessToken(), issueSessionToken(), key() (+31 more)

### Community 43 - "compilerOptions"
Cohesion: 0.18
Nodes (10): compilerOptions, jsx, noUncheckedIndexedAccess, strict, verbatimModuleSyntax, extends, include, src (+2 more)

### Community 44 - "Design Audit"
Cohesion: 0.10
Nodes (19): Code Quality, Color and Surfaces, Component Patterns, Content, Design Audit, Fix Priority, How This Works, Iconography (+11 more)

### Community 45 - "Sources.tsx"
Cohesion: 0.14
Nodes (27): ConfirmSheet(), EmptyState(), ScreenHeader(), useNavigation(), AddSource(), InfoTabs(), TABS, KIND_NOUN (+19 more)

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

### Community 53 - "fillRequestFormFieldsItem.ts"
Cohesion: 0.27
Nodes (6): FillRequest, FillRequestForm, FillRequestFormFieldsItem, FillRequestFormFieldsItemKind, FillRequestFormFieldsItemOptionsItem, FillRequestScope

### Community 55 - "Fillaform"
Cohesion: 0.22
Nodes (7): Before public listing, Before this is real, Build phases, Fillaform, Layout, Two invariants, Verification

### Community 56 - "ui.tsx"
Cohesion: 0.10
Nodes (22): FEATURES, Hero(), ReadVsGuessed(), Expression, EXPRESSIONS, GuessedBadge(), IconBuilding(), IconCheck() (+14 more)

### Community 57 - "services/fill.ts"
Cohesion: 0.09
Nodes (28): Variables, GenerateResult, Tier0Result, budgetFills(), emptyUsage(), FillContext, runFill(), writeFillLog() (+20 more)

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
Cohesion: 0.22
Nodes (9): @biomejs/biome, @dodopayments/opencode-plugin, devDependencies, @biomejs/biome, @dodopayments/opencode-plugin, playwright, typescript, typescript (+1 more)

### Community 71 - "3. Architecture"
Cohesion: 0.40
Nodes (5): 3. Architecture, Stack decisions and why, The API client is generated, never hand-written, The fill pipeline (phase 3 — not yet built), The tier router — the core cost lever

### Community 72 - "account/account.ts"
Cohesion: 0.18
Nodes (15): deleteAccount(), DeleteAccountMutationBody, DeleteAccountMutationError, DeleteAccountMutationResult, getAccount(), GetAccountQueryError, GetAccountQueryResult, getDeleteAccountMutationOptions() (+7 more)

### Community 73 - "Setup"
Cohesion: 0.40
Nodes (5): 1. Cloudflare resources, 2. Google OAuth client, 3. Local secrets, 4. Run, Setup

### Community 74 - "secrets.mjs"
Cohesion: 0.40
Nodes (3): DEV_VARS, local, SECRETS

### Community 76 - "push-secrets.mjs"
Cohesion: 0.29
Nodes (7): base, DEV_VARS, entries, merged, OPTIONAL, OVERRIDES, read()

### Community 78 - "2. The two hard invariants"
Cohesion: 0.67
Nodes (3): 2.1 The LLM output schema is fixed and global, 2.2 Quota is enforced server-side, before any provider call, 2. The two hard invariants

### Community 79 - "card.ts"
Cohesion: 0.18
Nodes (19): AnswerCardSpec, BaseSpec, CardSpec, escapeHtml(), MenuCard, mountAnswerCard(), mountCard(), mountMenuCard() (+11 more)

### Community 80 - "httpClient"
Cohesion: 0.23
Nodes (12): getSignInWithGoogleMutationOptions(), getSignInWithGoogleUrl(), SecondParameter, signInWithGoogle(), SignInWithGoogleMutationBody, SignInWithGoogleMutationError, SignInWithGoogleMutationResult, useSignInWithGoogle() (+4 more)

### Community 82 - "ExtensionDemo.tsx"
Cohesion: 0.10
Nodes (23): AnswerCard(), ChoiceControl(), DemoField, ExtensionDemo(), FieldKind, FieldRow(), FIELDS, isJudged() (+15 more)

### Community 88 - "routes/profile.ts"
Cohesion: 0.08
Nodes (26): AddSourceResponse, ApiError, FeedbackRequest, FillPlan, FillRequest, Identity, Profile, ProfilePatch (+18 more)

### Community 89 - "animate.ts"
Cohesion: 0.26
Nodes (10): AnimatedFill, ANIMATION_TIMINGS, AnimationHooks, isTypeable(), runFillAnimation(), sleep(), typeInto(), PILL (+2 more)

### Community 90 - "source-file.ts"
Cohesion: 0.33
Nodes (5): container, API_URL, STORAGE_KEYS, chromeStoragePersister, queryClient

### Community 92 - "main.ts"
Cohesion: 0.47
Nodes (5): dismiss(), render(), request(), root, State

### Community 93 - "markers.ts"
Cohesion: 0.13
Nodes (18): CardHandle, FieldMark, FieldMarkOptions, JudgedReason, MarkState, mountFieldMark(), placeTab(), TAB_GAP (+10 more)

### Community 94 - "Profile"
Cohesion: 0.20
Nodes (9): AddSourceResponse, Profile, ProfileCustom, ProfileIdentity, ProfileIdentityLinks, ProfileResponse, ProfileSourcesItem, ProfileSourcesItemKind (+1 more)

### Community 95 - "getOverlayHost"
Cohesion: 0.32
Nodes (4): press(), RECT, type(), getOverlayHost()

### Community 96 - "opencode.json"
Cohesion: 0.29
Nodes (6): plugin, $schema, skills, paths, @dodopayments/opencode-plugin, node_modules/@dodopayments/opencode-plugin/skills

### Community 97 - "site.ts"
Cohesion: 0.18
Nodes (10): Footer(), footerColumns, Logo(), Navbar(), PricingCards(), navLinks, pricing, site (+2 more)

### Community 99 - "onboarding.ts"
Cohesion: 0.28
Nodes (7): Onboarding, ONBOARDING_KEY, OnboardingRecord, OnboardingStatus, Resolved, resolveOnboarding(), useOnboarding()

### Community 100 - "dodo-live.mjs"
Cohesion: 0.13
Nodes (16): args, CATALOGUE, checkBrand(), collectionIds, COLLECTIONS, dodo(), DRY, ensureCollections() (+8 more)

### Community 103 - "build.mjs"
Cohesion: 0.10
Nodes (18): spec(), browserWindow(), FACE_PATTERN, heading(), HERE, mascot(), MIME, others (+10 more)

### Community 106 - "Store artwork"
Cohesion: 0.29
Nodes (6): Editing, How the artwork is made, Store artwork, The order, and why it is that order, What is here, What the images do not say

### Community 107 - "background.ts"
Cohesion: 0.20
Nodes (14): DEFAULT_SETTINGS, FORWARDED_TO_CONTENT, MAC_KEYS, deleteAccount(), getAuthToken(), revokeGoogleGrant(), signIn(), signOut() (+6 more)

### Community 108 - "Receipt.tsx"
Cohesion: 0.12
Nodes (20): Button(), Chip(), Mascot(), Row(), RowGroup(), Screen(), ScreenBody(), ScreenFooter() (+12 more)

### Community 109 - "overlay.ts"
Cohesion: 0.12
Nodes (12): launcher, MARKS, mounted, only, params, sendMessage(), LauncherHandle, mountLauncher() (+4 more)

### Community 113 - "model/index.ts"
Cohesion: 0.10
Nodes (11): AccountQuotaPlan, DeleteAccountRequest, DeleteAccountResponse, DeleteAccountResponseSubscription, ImproveAnswer200, ImproveAnswerBody, RenameSourceRequest, SignInRequest (+3 more)

### Community 114 - "AddSource.tsx"
Cohesion: 0.07
Nodes (40): AiBadge(), AutoTextarea(), Field(), Input(), Segment, SegmentedControl(), StatusPill(), IconAudio() (+32 more)

## Knowledge Gaps
- **708 isolated node(s):** ``abandoned_subscriptions``, `name`, `version`, `private`, `type` (+703 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **14 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `mountAnswerCard()` connect `card.ts` to `content.ts`, `overlay.ts`, `getOverlayHost`, `package.json`?**
  _High betweenness centrality (0.062) - this node is a cross-community bridge._
- **Why does `node` connect `package.json` to `card.ts`?**
  _High betweenness centrality (0.058) - this node is a cross-community bridge._
- **What connects ``abandoned_subscriptions``, `name`, `version` to the rest of the system?**
  _708 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `compile.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.13054187192118227 - nodes in this community are weakly interconnected._
- **Should `scripts` be split into smaller, more focused modules?**
  _Cohesion score 0.03571428571428571 - nodes in this community are weakly interconnected._
- **Should `content.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.13846153846153847 - nodes in this community are weakly interconnected._
- **Should `profile/profile.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05990338164251208 - nodes in this community are weakly interconnected._