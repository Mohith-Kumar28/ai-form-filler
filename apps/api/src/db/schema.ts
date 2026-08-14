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
    plan: text('plan', { enum: ['free', 'pro'] })
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
    used: integer('used').notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.userId, t.period] })],
)

export const subscriptions = sqliteTable(
  'subscriptions',
  {
    userId: text('user_id')
      .primaryKey()
      .references(() => users.id, { onDelete: 'cascade' }),
    stripeCustomerId: text('stripe_customer_id').notNull(),
    stripeSubscriptionId: text('stripe_subscription_id'),
    status: text('status').notNull(),
    currentPeriodEnd: integer('current_period_end'),
  },
  (t) => [index('subscriptions_customer_idx').on(t.stripeCustomerId)],
)
