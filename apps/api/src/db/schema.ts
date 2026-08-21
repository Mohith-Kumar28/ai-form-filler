import { index, integer, primaryKey, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

export const users = sqliteTable(
  'users',
  {
    id: text('id').primaryKey(),
    /** Google's stable subject claim. Email can change; this cannot. */
    googleSub: text('google_sub').notNull(),
    email: text('email').notNull(),
    name: text('name'),
    avatarUrl: text('avatar_url'),
    plan: text('plan', { enum: ['free', 'pro', 'ultra'] })
      .notNull()
      .default('free'),
    createdAt: integer('created_at').notNull(),
  },
  (t) => [uniqueIndex('users_google_sub_idx').on(t.googleSub)],
)

export const profileSources = sqliteTable(
  'profile_sources',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull(),
    label: text('label').notNull(),
    status: text('status', { enum: ['pending', 'parsing', 'ready', 'failed'] })
      .notNull()
      .default('pending'),
    error: text('error'),
    /** Supermemory document id, so deleting a source deletes the original it stored. */
    memoryId: text('memory_id'),
    /** R2 key for the original file. Null for link and text sources. */
    r2Key: text('r2_key'),
    mediaType: text('media_type'),
    sizeBytes: integer('size_bytes'),
    /** The address a link source points at. */
    url: text('url'),
    /** The structured summary. The full document lives in Supermemory. */
    extractedText: text('extracted_text'),
    createdAt: integer('created_at').notNull(),
  },
  (t) => [index('profile_sources_user_idx').on(t.userId)],
)

/**
 * The compiled, cache-stable profile document. One row per user.
 *
 * `hash` is the guard rail for the caching invariant: recompiling must produce byte-identical
 * output for unchanged input. If the hash changes without a source changing, serialization
 * has become non-deterministic and every request is silently paying a cache write.
 */
export const profileDocs = sqliteTable('profile_docs', {
  userId: text('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  version: integer('version').notNull().default(0),
  doc: text('doc').notNull(),
  hash: text('hash').notNull(),
  /**
   * The structured Profile as JSON, minus `sources` (those live in their own table).
   * Tier 0 reads `identity` straight out of here without touching a model, and the
   * side-panel editor round-trips the whole object.
   */
  structuredJson: text('structured_json').notNull().default('{}'),
  estimatedTokens: integer('estimated_tokens').notNull().default(0),
  updatedAt: integer('updated_at').notNull(),
})

/**
 * Accepted free-text answers. Retrieved by BM25 (see the FTS5 virtual table in the
 * migration) and injected for tier-3 fields.
 */
/**
 * One row per fill request. This table answers "is the free tier affordable" — query it
 * after phase 3 before sizing PLAN_LIMITS. Instrumented from day one deliberately: the
 * alternative is finding out from a provider invoice.
 */
export const fillLog = sqliteTable(
  'fill_log',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    origin: text('origin').notNull(),
    adapter: text('adapter').notNull(),

    fieldCount: integer('field_count').notNull(),
    tier0Count: integer('tier0_count').notNull().default(0),
    tier1Count: integer('tier1_count').notNull().default(0),
    tier2Count: integer('tier2_count').notNull().default(0),
    tier3Count: integer('tier3_count').notNull().default(0),

    inputTokens: integer('input_tokens').notNull().default(0),
    outputTokens: integer('output_tokens').notNull().default(0),
    cacheReadTokens: integer('cache_read_tokens').notNull().default(0),
    cacheWriteTokens: integer('cache_write_tokens').notNull().default(0),

    costMicroUsd: integer('cost_micro_usd').notNull().default(0),
    latencyMs: integer('latency_ms').notNull().default(0),
    /** Comma-separated model ids actually invoked. */
    models: text('models').notNull().default(''),

    createdAt: integer('created_at').notNull(),
  },
  (t) => [index('fill_log_user_idx').on(t.userId), index('fill_log_created_idx').on(t.createdAt)],
)

/**
 * Monthly quota counters, keyed by `YYYY-MM`. Kept separate from `fill_log` so the quota
 * check is a single indexed point-read rather than an aggregate over a growing table.
 */
export const quotaUsage = sqliteTable(
  'quota_usage',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    period: text('period').notNull(),
    /**
     * AI actions spent: one answered field, one rewrite, or one source ingested or reprocessed.
     * Tier-0 lookups are never counted.
     */
    used: integer('used').notNull().default(0),
    /**
     * Long answers spent, a subset of `used`.
     *
     * Its own column because it is its own ceiling: one long answer costs about a hundred times a
     * short one, so the plan that can afford 600 fields cannot afford 600 essays.
     */
    longUsed: integer('long_used').notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.userId, t.period] })],
)

export const subscriptions = sqliteTable(
  'subscriptions',
  {
    userId: text('user_id')
      .primaryKey()
      .references(() => users.id, { onDelete: 'cascade' }),
    dodoCustomerId: text('dodo_customer_id').notNull(),
    dodoSubscriptionId: text('dodo_subscription_id'),
    plan: text('plan', { enum: ['pro', 'ultra'] }).notNull(),
    /**
     * Dodo's lifecycle, plus our own `trial`.
     *
     * `pending` and `failed` are Dodo states that were missing here, so a mandate that never
     * completed was indistinguishable from a working subscription. `trial` is ours alone: Dodo
     * reports a trialing subscription as plain `active` and documents no field that says otherwise.
     */
    status: text('status', {
      enum: ['pending', 'trial', 'active', 'on_hold', 'cancelled', 'failed', 'expired'],
    }).notNull(),
    onHoldAt: integer('on_hold_at'),
    currentPeriodEnd: integer('current_period_end'),
    /** When the trial converts to a charge. Written when the trial checkout is created. */
    trialEndsAt: integer('trial_ends_at'),
  },
  (t) => [uniqueIndex('subscriptions_dodo_customer_idx').on(t.dodoCustomerId)],
)

/**
 * Write-side bookkeeping for learned answers. **Not an answering path.**
 *
 * A `learned` table of question→answer pairs existed here once and was deliberately removed;
 * the post-mortem is in `services/answer-bank.ts` and it is worth reading before touching
 * this. The short version: it was a second store to keep in sync, a prompt block that grew
 * with every submission, and a lookup that only fired when a later form asked a question in
 * byte-identical words.
 *
 * This is not that table, and the *schema* is what makes the difference rather than anyone's
 * discipline:
 *
 *   - **There is no answer column.** The answer lives in Supermemory and only there.
 *     `answerHash` is a one-way digest — enough to notice "the same answer again" and skip the
 *     write, and structurally incapable of being read back or injected into a prompt. Adding a
 *     lookup is therefore not a small edit; it is a schema change, under this comment.
 *   - **`memoryId` is a pointer**, so a superseded answer can be *replaced* rather than
 *     appended beside the answer it contradicts. Exact precedent: `profile_sources.memoryId`.
 *   - **`rejectedValues` is the only free text here**, and it is only ever rendered as "do not
 *     answer with this". It cannot become an answer because it is the negative set.
 *
 * Read once per fill, as one indexed lookup over the questions the form actually asks. The
 * composite primary key *is* that index.
 */
export const learnedPointers = sqliteTable(
  'learned_pointers',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /**
     * Digest of the question, plus the origin for prose only. See `questionHashFor` for why
     * that asymmetry is the whole point of the key.
     */
    questionHash: text('question_hash').notNull(),
    /** The question as last seen. For debugging, and for wording the avoid hint. */
    question: text('question').notNull(),
    /** Supermemory document holding the current answer. Null if that write failed. */
    memoryId: text('memory_id'),
    /** One-way fingerprint of the stored answer, so an identical re-teach costs nothing. */
    answerHash: text('answer_hash'),
    /** Values the user rejected, newest first, ' | '-joined. Never retrieved, only avoided. */
    rejectedValues: text('rejected_values'),
    updatedAt: integer('updated_at').notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.questionHash] })],
)

/**
 * Subscriptions left running at Dodo after the account behind them was deleted.
 *
 * A deletion is never blocked by a failed cancellation — see the migration, and
 * `cancelSubscriptionForDeletion`. That decision is only defensible because of this table: the
 * user is told they will not be charged again, and this is what makes that true rather than
 * hopeful. A row here is money still leaving somebody's card, so it is worth checking:
 *
 *   pnpm db:query "SELECT * FROM abandoned_subscriptions"
 *
 * No `userId`, and no foreign key. The user row is already gone when this is written, so a key
 * would make the insert fail — and holding Dodo's identifiers rather than anything about the
 * person is what lets the row outlive the deletion without being a copy of it.
 */
export const abandonedSubscriptions = sqliteTable(
  'abandoned_subscriptions',
  {
    dodoSubscriptionId: text('dodo_subscription_id').primaryKey(),
    dodoCustomerId: text('dodo_customer_id').notNull(),
    /** Dodo's refusal, verbatim, so the failure can be diagnosed rather than guessed at. */
    lastError: text('last_error').notNull(),
    attempts: integer('attempts').notNull().default(1),
    createdAt: integer('created_at').notNull(),
  },
  (t) => [index('abandoned_subscriptions_created_idx').on(t.createdAt)],
)
