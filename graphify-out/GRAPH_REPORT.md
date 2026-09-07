# Graph Report - ai-form-filler  (2026-09-07)

## Corpus Check
- 289 files · ~525,354 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2079 nodes · 4289 edges · 123 communities (107 shown, 16 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 31 edges (avg confidence: 0.64)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `4ec10e6c`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- compile.ts
- scripts
- setup/index.tsx
- profile/profile.ts
- overlay.ts
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
- Page.tsx
- icons.tsx
- components.tsx
- form-adapters/src/index.ts
- generate.ts
- use-fill.ts
- devDependencies
- routes/fill.ts
- form-adapters/package.json
- routes/profile.ts
- shared/package.json
- dependencies
- migrate-learned-to-memory.mjs
- write.ts
- delete-account.ts
- Account
- fact-catalog.ts
- routes/index.tsx
- resolveLabel
- services/profile.ts
- compilerOptions
- api/tsconfig.json
- google-forms.fixture.test.ts
- package.json
- form-adapters/tsconfig.json
- devDependencies
- page-markdown.ts
- compilerOptions
- answer-bank.ts
- Knowledge.tsx
- scripts
- fillPlan.ts
- Fillaform — side panel and overlay
- Fillaform — Engineering Handoff
- 7. Gotchas — read before touching related code
- Fillaform — Product truth
- create-resources.mjs
- model/index.ts
- constants.ts
- Fillaform — AI Form Filler
- ui.tsx
- ledger.ts
- 6. Remaining work
- shared/tsconfig.json
- `users`
- profilePatch.ts
- setup-check.mjs
- Steps (ordered)
- feedbackRequestEntriesItem.ts
- Commands
- api/package.json
- billing/billing.ts
- extension/package.json
- site.ts
- devDependencies
- 3. Architecture
- account/account.ts
- Setup
- secrets.mjs
- costs.mjs
- push-secrets.mjs
- dev-token.mjs
- tokens.ts
- card.ts
- auth/auth.ts
- ExtensionDemo.tsx
- reveal-extension.mjs
- wxt
- animate.ts
- contract.test.ts
- PositionScheduler
- main.ts
- markers.ts
- navigation.tsx
- @types/react
- opencode.json
- Footer.tsx
- router.tsx
- generic.ts
- dodo-live.mjs
- content.ts
- @types/react-dom
- build.mjs
- vitest
- Privacy practices tab
- scheduler.ts
- background.ts
- ApiError
- api.ts
- standardwebhooks
- services/fill.ts
- typescript
- `subscriptions`
- learning.ts
- host.ts
- shared/src/index.ts
- stub-chrome.ts
- 0004_abandoned_subscriptions.sql
- Profile
- deployment.ts

## God Nodes (most connected - your core abstractions)
1. `scripts` - 56 edges
2. `ApiErrorResponse` - 27 edges
3. `Db` - 24 edges
4. `httpClient()` - 24 edges
5. `scripts` - 21 edges
6. `recordFeedback()` - 20 edges
7. `PositionScheduler` - 20 edges
8. `cx()` - 19 edges
9. `getOverlayHost()` - 18 edges
10. `compilerOptions` - 18 edges

## Surprising Connections (you probably didn't know these)
- `AddFieldSheet()` --calls--> `fieldFor()`  [EXTRACTED]
  apps/extension/src/entrypoints/sidepanel/screens/Knowledge.tsx → packages/shared/src/facts.ts
- `mountAnswerCard()` --references--> `node`  [EXTRACTED]
  apps/extension/src/overlay/card.ts → package.json
- `selectRoot()` --references--> `document`  [EXTRACTED]
  packages/form-adapters/src/page-markdown.ts → apps/api/scripts/emit-openapi.ts
- `Variables` --references--> `Account`  [EXTRACTED]
  apps/api/src/env.ts → packages/shared/src/account.ts
- `RoutedForm` --references--> `FillTier`  [EXTRACTED]
  apps/api/src/router/classify.ts → packages/shared/src/fill.ts

## Import Cycles
- None detected.

## Communities (123 total, 16 thin omitted)

### Community 0 - "compile.ts"
Cohesion: 0.13
Nodes (22): CompiledProfile, compileProfileDoc(), estimateTokens(), normalizeText(), renderCustom(), renderIdentity(), sha256Hex(), digitCount() (+14 more)

### Community 1 - "scripts"
Cohesion: 0.04
Nodes (56): scripts, //1-develop, //2-build, //2b-assets, //3-ship, //4-setup, //5-database, //6-contract (+48 more)

### Community 2 - "setup/index.tsx"
Cohesion: 0.11
Nodes (16): IconButton, Input, Menu(), Tag(), IconBack(), IconEye(), IconEyeOff(), IconPlus() (+8 more)

### Community 3 - "profile/profile.ts"
Cohesion: 0.06
Nodes (48): AddTextSourceMutationBody, AddTextSourceMutationError, AddTextSourceMutationResult, deleteSource(), DeleteSourceMutationError, DeleteSourceMutationResult, getAddTextSourceMutationOptions(), getDeleteSourceMutationOptions() (+40 more)

### Community 4 - "overlay.ts"
Cohesion: 0.12
Nodes (13): launcher, MARKS, mounted, only, params, sendMessage(), LauncherHandle, mountLauncher() (+5 more)

### Community 5 - "includes"
Cohesion: 0.05
Nodes (37): css, parser, files, includes, formatter, enabled, indentStyle, indentWidth (+29 more)

### Community 6 - "App.tsx"
Cohesion: 0.08
Nodes (38): App(), PageRequestedPaywall(), useSignedIn(), Header(), Screen(), SkeletonRows(), container, useNavigation() (+30 more)

### Community 7 - "fill/fill.ts"
Cohesion: 0.09
Nodes (25): fillForm(), FillFormMutationBody, FillFormMutationError, FillFormMutationResult, getFillFormMutationOptions(), getFillFormUrl(), getImproveAnswerMutationOptions(), getImproveAnswerUrl() (+17 more)

### Community 8 - "google-forms.ts"
Cohesion: 0.19
Nodes (22): answerFor(), detectQuestion(), GoogleFormsAdapter, hasLayout(), isChosen(), isOpen(), isOtherOption(), isVisible() (+14 more)

### Community 9 - "ats.ts"
Cohesion: 0.17
Nodes (13): ATS_HOSTS, AtsAdapter, driveReactSelect(), isReactSelect(), reactSelectLabel(), readPreloadedOptions(), readSelectedValue(), waitForOption() (+5 more)

### Community 10 - "gallery/main.tsx"
Cohesion: 0.10
Nodes (25): ACCOUNT, ACCOUNT_FREE_GRANT, ACCOUNT_FREE_SPENT, ACCOUNT_LOW_QUOTA, ACCOUNT_NO_LONGFORM, ACCOUNT_ON_HOLD, ACCOUNT_ONBOARDING, EMPTY_PROFILE (+17 more)

### Community 11 - "devDependencies"
Cohesion: 0.05
Nodes (42): dependencies, @aff/shared, motion, react, react-dom, @tanstack/react-router, @tanstack/react-start, devDependencies (+34 more)

### Community 12 - "scripts"
Cohesion: 0.10
Nodes (21): scripts, build, cf:create, db:costs, db:generate, db:migrate:local, db:migrate:remote, db:migrate:staging (+13 more)

### Community 13 - "compilerOptions"
Cohesion: 0.10
Nodes (20): compilerOptions, declaration, esModuleInterop, exactOptionalPropertyTypes, forceConsistentCasingInFileNames, isolatedModules, lib, module (+12 more)

### Community 14 - "dependencies"
Cohesion: 0.11
Nodes (19): ai, @ai-sdk/anthropic, @ai-sdk/google, dependencies, @aff/shared, ai, @ai-sdk/anthropic, @ai-sdk/google (+11 more)

### Community 15 - "Page.tsx"
Cohesion: 0.12
Nodes (24): Empty(), Group(), Kbd(), Row(), FALLBACK, OnThisPage(), useOnPageSettings(), CheckRow() (+16 more)

### Community 16 - "icons.tsx"
Cohesion: 0.05
Nodes (31): Segment, Segmented(), IconAlert(), IconAudio(), IconCheck(), IconClose(), IconDocument(), IconExternal() (+23 more)

### Community 17 - "components.tsx"
Cohesion: 0.08
Nodes (46): Body, BUTTON_SIZE, BUTTON_VARIANT, ButtonSize, ButtonVariant, Card(), cx(), DeleteAccountSheet() (+38 more)

### Community 18 - "form-adapters/src/index.ts"
Cohesion: 0.14
Nodes (14): document, collectPageContext(), detectPageForm(), genericAdapter, selectAdapter(), siteAdapters, PageMarkdownOptions, detect() (+6 more)

### Community 20 - "generate.ts"
Cohesion: 0.06
Nodes (55): generateFills(), GenerateInput, GenerateResult, readCacheCounters(), translateProviderError(), improveAnswer(), ImproveInput, ImproveResult (+47 more)

### Community 21 - "use-fill.ts"
Cohesion: 0.17
Nodes (19): applyVerdict(), clearDraft(), drafts, emit(), EMPTY, getDraft(), hydrate(), listeners (+11 more)

### Community 22 - "devDependencies"
Cohesion: 0.12
Nodes (17): devDependencies, happy-dom, orval, tailwindcss, @tailwindcss/vite, @types/chrome, vite, @vitejs/plugin-react (+9 more)

### Community 23 - "routes/fill.ts"
Cohesion: 0.10
Nodes (30): Variables, consumeQuota(), enforceLongformQuota, enforceQuota, feedbackRateLimit, rateLimit, readUsage(), FeedbackRequest (+22 more)

### Community 24 - "form-adapters/package.json"
Cohesion: 0.12
Nodes (16): dependencies, @aff/shared, devDependencies, happy-dom, vitest, exports, @aff/shared, happy-dom (+8 more)

### Community 25 - "routes/profile.ts"
Cohesion: 0.06
Nodes (39): requireAuth, Account, AddSourceResponse, ApiError, bearerAuth, DeleteAccountRequest, DeleteAccountResponse, errorResponses (+31 more)

### Community 26 - "shared/package.json"
Cohesion: 0.10
Nodes (19): dependencies, zod, devDependencies, vitest, exports, ./constants, ./deployment, ./facts (+11 more)

### Community 27 - "dependencies"
Cohesion: 0.15
Nodes (13): @aff/form-adapters, dependencies, @aff/form-adapters, @aff/shared, react, react-dom, @tanstack/react-query, @tanstack/react-query-persist-client (+5 more)

### Community 28 - "migrate-learned-to-memory.mjs"
Cohesion: 0.33
Nodes (3): key, remote, rows

### Community 29 - "write.ts"
Cohesion: 0.32
Nodes (10): matchSelectOption(), nativeValueSetter(), notifyChange(), simulateVisit(), ValueElement, writeCheckedValue(), writeContentEditable(), writeMultiSelectValue() (+2 more)

### Community 30 - "delete-account.ts"
Cohesion: 0.13
Nodes (26): abandonedSubscriptions, fillLog, learnedPointers, profileDocs, profileSources, quotaUsage, subscriptions, users (+18 more)

### Community 31 - "Account"
Cohesion: 0.24
Nodes (7): Account, AccountQuota, AccountQuotaPlan, AccountSubscription, AccountSubscriptionPlan, AccountSubscriptionStatus, SignInResponse

### Community 32 - "fact-catalog.ts"
Cohesion: 0.11
Nodes (31): Stack(), Knowledge(), Shortcuts(), BASICS, usePatchProfile(), customFactCount(), factCount(), reconcile() (+23 more)

### Community 33 - "routes/index.tsx"
Cohesion: 0.17
Nodes (15): ChromeCTA(), FAQ(), FAQS, Hero(), HowItWorks(), STEPS, ReadVsGuessed(), Reveal() (+7 more)

### Community 34 - "resolveLabel"
Cohesion: 0.30
Nodes (13): baseSchema(), groupLabel(), adapter, detect(), labelsOf(), clean(), fromAriaLabelledBy(), fromLabelElement() (+5 more)

### Community 35 - "services/profile.ts"
Cohesion: 0.18
Nodes (24): mergeIdentity(), StructuredSource, Db, addSource(), definedOnly(), deleteSource(), fillIfEmpty(), getProfile() (+16 more)

### Community 36 - "compilerOptions"
Cohesion: 0.08
Nodes (24): compilerOptions, baseUrl, esModuleInterop, forceConsistentCasingInFileNames, isolatedModules, jsx, lib, module (+16 more)

### Community 37 - "api/tsconfig.json"
Cohesion: 0.17
Nodes (11): compilerOptions, lib, noEmit, types, extends, include, ES2023, src (+3 more)

### Community 39 - "package.json"
Cohesion: 0.17
Nodes (11): engines, node, name, packageManager, pnpm, onlyBuiltDependencies, private, type (+3 more)

### Community 40 - "form-adapters/tsconfig.json"
Cohesion: 0.17
Nodes (11): compilerOptions, lib, noEmit, types, extends, include, DOM, DOM.Iterable (+3 more)

### Community 41 - "devDependencies"
Cohesion: 0.18
Nodes (11): devDependencies, @cloudflare/workers-types, drizzle-kit, tsx, vitest, wrangler, vitest, wrangler (+3 more)

### Community 42 - "page-markdown.ts"
Cohesion: 0.35
Nodes (10): BOILERPLATE, collapse(), collectPageMarkdown(), inlineMarkdown(), isHidden(), isSkippable(), selectRoot(), SKIP_ROLES (+2 more)

### Community 43 - "compilerOptions"
Cohesion: 0.18
Nodes (10): compilerOptions, jsx, noUncheckedIndexedAccess, strict, verbatimModuleSyntax, extends, include, src (+2 more)

### Community 44 - "answer-bank.ts"
Cohesion: 0.11
Nodes (39): learningBudget(), applyToIdentity(), Destination, destinationFor(), Entry, isBlank(), isPlausible(), looksSecret() (+31 more)

### Community 45 - "Knowledge.tsx"
Cohesion: 0.11
Nodes (32): Button(), ConfirmSheet(), SaveState(), Sheet(), SheetTitle(), IconChevronRight(), IconGoogle(), Document() (+24 more)

### Community 46 - "scripts"
Cohesion: 0.18
Nodes (11): scripts, api:generate, build, build:firefox, dev, dev:firefox, gallery, postinstall (+3 more)

### Community 47 - "fillPlan.ts"
Cohesion: 0.24
Nodes (7): FillPlan, FillPlanFillsItem, FillPlanFillsItemKind, FillPlanFillsItemTier, FillPlanSkippedItem, FillPlanSkippedItemReason, FillPlanUsage

### Community 48 - "Fillaform — side panel and overlay"
Cohesion: 0.18
Nodes (10): Fillaform — side panel and overlay, Knowledge base, Not in step yet, On the page (overlay), Page — the ledger, Review, Rules that do not move, Setup (+2 more)

### Community 49 - "Fillaform — Engineering Handoff"
Cohesion: 0.15
Nodes (13): 10. Open decisions, 11. References, 1. What this product is, 2.1 The LLM output schema is fixed and global, 2.2 Quota is enforced server-side, before any provider call, 2. The two hard invariants, 4. What exists today, 5. Database schema (D1) (+5 more)

### Community 50 - "7. Gotchas — read before touching related code"
Cohesion: 0.18
Nodes (11): 7.1 Google token introspection: the `aud` check is load-bearing, 7.1a `getAuthToken` does not work outside Google Chrome, 7.2 React controlled inputs revert a naive `.value` assignment, 7.3 Fill requests need a port, not `sendMessage`, 7.4 Overlay positioning is a genuine performance hazard, 7.5 `PROFILE_DOC` must stay byte-stable, 7.6 Identity is merged field-by-field; everything else replaces, 7.7 Deleting a source must delete the stored original (+3 more)

### Community 51 - "Fillaform — Product truth"
Cohesion: 0.18
Nodes (10): Audience and scene, Brand commitments, Constraints, Fillaform — Product truth, How it is paid for, The one thing the UI must make legible, The surface, The unique mechanism (+2 more)

### Community 52 - "create-resources.mjs"
Cohesion: 0.22
Nodes (5): d1Id, d1Out, kvOut, PLACEHOLDER, TOML

### Community 53 - "model/index.ts"
Cohesion: 0.11
Nodes (14): DeleteAccountRequest, DeleteAccountResponse, DeleteAccountResponseSubscription, FillRequest, FillRequestForm, FillRequestFormFieldsItem, FillRequestFormFieldsItemKind, FillRequestFormFieldsItemOptionsItem (+6 more)

### Community 54 - "constants.ts"
Cohesion: 0.10
Nodes (27): canonical(), clampAnswer(), createFeedbackCapture(), displayValueOf(), Entry, FeedbackCapture, feedbackEntryFor(), FeedbackSend (+19 more)

### Community 55 - "Fillaform — AI Form Filler"
Cohesion: 0.22
Nodes (7): Before public listing, Before this is real, Build phases, Fillaform — AI Form Filler, Layout, Two invariants, Verification

### Community 56 - "ui.tsx"
Cohesion: 0.12
Nodes (17): FEATURES, Expression, EXPRESSIONS, GuessedBadge(), IconBuilding(), IconGift(), IconGlobe(), IconLock() (+9 more)

### Community 57 - "ledger.ts"
Cohesion: 0.14
Nodes (19): field(), BLANK_REASON, BlankRow, buildPreview(), buildResult(), expectedFact(), Fill, hasAnswer() (+11 more)

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
Nodes (5): checks, deployment, devVars, root, toml

### Community 63 - "Steps (ordered)"
Cohesion: 0.15
Nodes (12): A. `packages/shared`, B. `packages/form-adapters`, C. `packages/shared` (protocol), D. `apps/extension`, Design decisions, E. `apps/api`, F. Codegen, Plan: Page-context markdown in the fill pipeline ("pageMarkdown") (+4 more)

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
Nodes (20): createCheckout(), CreateCheckoutMutationBody, CreateCheckoutMutationError, CreateCheckoutMutationResult, getCreateCheckoutMutationOptions(), getCreateCheckoutUrl(), getGetPortalQueryKey(), getGetPortalQueryOptions() (+12 more)

### Community 68 - "extension/package.json"
Cohesion: 0.40
Nodes (4): name, private, type, version

### Community 69 - "site.ts"
Cohesion: 0.09
Nodes (20): FeaturesGrid(), PricingCards(), buildMeta(), canonicalLink(), jsonLd(), MetaTag, softwareAppSchema(), pricing (+12 more)

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

### Community 78 - "tokens.ts"
Cohesion: 0.16
Nodes (14): cssName(), DARK, EASE, LIGHT, overlayVariables(), RADIUS_FULL, RADIUS_LG, RADIUS_MD (+6 more)

### Community 79 - "card.ts"
Cohesion: 0.16
Nodes (22): AnswerCardSpec, BaseSpec, CardAction, CardSpec, escapeHtml(), MenuCard, mountAnswerCard(), mountCard() (+14 more)

### Community 80 - "auth/auth.ts"
Cohesion: 0.19
Nodes (11): getSignInWithGoogleMutationOptions(), getSignInWithGoogleUrl(), SecondParameter, signInWithGoogle(), SignInWithGoogleMutationBody, SignInWithGoogleMutationError, SignInWithGoogleMutationResult, useSignInWithGoogle() (+3 more)

### Community 82 - "ExtensionDemo.tsx"
Cohesion: 0.09
Nodes (24): AnswerCard(), ChoiceControl(), DemoField, ExtensionDemo(), FieldKind, FieldRow(), FIELDS, isJudged() (+16 more)

### Community 83 - "reveal-extension.mjs"
Cohesion: 0.50
Nodes (3): candidates, dir, found

### Community 89 - "animate.ts"
Cohesion: 0.26
Nodes (10): AnimatedFill, ANIMATION_TIMINGS, AnimationHooks, isTypeable(), runFillAnimation(), sleep(), typeInto(), PILL (+2 more)

### Community 90 - "contract.test.ts"
Cohesion: 0.15
Nodes (16): ActivePage, INITIAL, originOf(), useActivePage(), ProposedValue, DetectionResult, LEARN_MAX_OPTIONS, offerFor() (+8 more)

### Community 92 - "main.ts"
Cohesion: 0.47
Nodes (5): dismiss(), render(), request(), root, State

### Community 93 - "markers.ts"
Cohesion: 0.15
Nodes (13): FieldMarkOptions, JudgedReason, MarkState, mountFieldMark(), placeTab(), TAB_GAP, TAB_HEIGHT, TAB_LABEL (+5 more)

### Community 94 - "navigation.tsx"
Cohesion: 0.25
Nodes (8): DocumentMode, NavigationContext, NavigationProvider(), NavigationValue, ROOT, runTransition(), Screen, ScreenName

### Community 96 - "opencode.json"
Cohesion: 0.29
Nodes (6): plugin, $schema, skills, paths, @dodopayments/opencode-plugin, node_modules/@dodopayments/opencode-plugin/skills

### Community 97 - "Footer.tsx"
Cohesion: 0.28
Nodes (5): Footer(), footerColumns, Logo(), Navbar(), navLinks

### Community 99 - "generic.ts"
Cohesion: 0.26
Nodes (11): documentHasLayout(), GenericAdapter, groupControls(), isFillable(), isVisible(), nextId(), optionsOf(), resetIdCounter() (+3 more)

### Community 100 - "dodo-live.mjs"
Cohesion: 0.13
Nodes (16): args, CATALOGUE, checkBrand(), collectionIds, COLLECTIONS, dodo(), DRY, ensureCollections() (+8 more)

### Community 101 - "content.ts"
Cohesion: 0.26
Nodes (10): main(), CardHandle, isOverlayHost(), clearLearningNotes(), FieldMark, Rect, suggestForField(), Suggestion (+2 more)

### Community 103 - "build.mjs"
Cohesion: 0.10
Nodes (18): spec(), browserWindow(), FACE_PATTERN, heading(), HERE, mascot(), MIME, others (+10 more)

### Community 106 - "Privacy practices tab"
Cohesion: 0.07
Nodes (28): `activeTab`, Before pasting, Building the upload artifact, Category, Data types to declare, Data usage certification, Detailed description, `favicon` (+20 more)

### Community 108 - "background.ts"
Cohesion: 0.12
Nodes (18): DEFAULT_SETTINGS, FORWARDED_TO_CONTENT, MAC_KEYS, LAST_FILL_KEY, registerFillPort(), runFillFlow(), FakePort, fill() (+10 more)

### Community 109 - "ApiError"
Cohesion: 0.60
Nodes (3): ApiError, ApiErrorCode, ApiErrorQuota

### Community 112 - "services/fill.ts"
Cohesion: 0.23
Nodes (12): Env, budgetFills(), emptyUsage(), FillContext, pageMarkdownForBatch(), runFill(), emptyProfile(), FillContext (+4 more)

### Community 121 - "learning.ts"
Cohesion: 0.24
Nodes (6): COPY, LearningNote, LearningState, live, mountLearningNote(), noteLearning()

### Community 122 - "host.ts"
Cohesion: 0.17
Nodes (11): detectPageScheme(), press(), RECT, type(), burstConfetti(), COLORS, getOverlayHost(), isOverlayEvent() (+3 more)

### Community 123 - "shared/src/index.ts"
Cohesion: 0.12
Nodes (20): here, outPath, GoogleIdentity, TokenInfo, UserInfo, verifyGoogleAccessToken(), issueSessionToken(), key() (+12 more)

### Community 132 - "Profile"
Cohesion: 0.30
Nodes (6): AddSourceResponse, Profile, ProfileCustom, ProfileIdentity, ProfileIdentityLinks, ProfileResponse

### Community 134 - "deployment.ts"
Cohesion: 0.29
Nodes (6): CHROME_WEB_STORE_URL, EXTENSION_ID, EXTENSION_PUBLIC_KEY, GOOGLE_ACCEPTED_CLIENT_IDS, GOOGLE_CLIENT_ID_LEGACY_CHROME_EXTENSION, !**/.wxt

## Knowledge Gaps
- **688 isolated node(s):** ``abandoned_subscriptions``, `name`, `version`, `private`, `type` (+683 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **16 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `mountAnswerCard()` connect `card.ts` to `host.ts`, `overlay.ts`, `content.ts`, `package.json`?**
  _High betweenness centrality (0.074) - this node is a cross-community bridge._
- **Why does `node` connect `package.json` to `card.ts`?**
  _High betweenness centrality (0.071) - this node is a cross-community bridge._
- **What connects ``abandoned_subscriptions``, `name`, `version` to the rest of the system?**
  _688 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `compile.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.13054187192118227 - nodes in this community are weakly interconnected._
- **Should `scripts` be split into smaller, more focused modules?**
  _Cohesion score 0.03571428571428571 - nodes in this community are weakly interconnected._
- **Should `setup/index.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.11428571428571428 - nodes in this community are weakly interconnected._
- **Should `profile/profile.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05697278911564626 - nodes in this community are weakly interconnected._