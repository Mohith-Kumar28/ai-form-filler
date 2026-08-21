import { ApiErrorResponse, type DeletionReport } from '@aff/shared'
import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/d1'
import {
  abandonedSubscriptions,
  fillLog,
  learnedPointers,
  profileDocs,
  profileSources,
  quotaUsage,
  subscriptions,
  users,
} from '../db/schema.js'
import type { AppEnv } from '../env.js'
import { cancelSubscriptionForDeletion } from './billing.js'
import { purgeDocument } from './supermemory.js'

/**
 * Deleting an account, for real.
 *
 * The user's data lives in four places, and only one of them is the database:
 *
 *   - **D1** — the rows: identity, sources, compiled profile, learned pointers, quota, fill
 *     history, subscription.
 *   - **Supermemory** — the actual documents. A résumé, a voice note, every answer the product
 *     has been taught. The rows only hold *ids* pointing at them.
 *   - **R2** — the original uploaded bytes.
 *   - **Dodo** — the subscription, which is the one that keeps costing money if it is missed.
 *
 * The ordering below is the whole design, and it follows from one fact: **the pointers are the
 * only way to reach the documents.** Delete the rows first and every document and file becomes
 * unreachable garbage that no future request can ever find, let alone remove — the user is told
 * they were forgotten while the résumé stays indexed forever. That is the precise failure
 * `routes/profile.ts` already guards against for a single source; account deletion is the same
 * hazard multiplied by everything the user ever added.
 *
 * So: read the pointers, stop the money, delete the far side, and only then drop the rows. Every
 * step before the last is idempotent, which is what makes "try again" a real answer rather than a
 * suggestion — a run that dies halfway leaves the account intact and retryable, never half-erased.
 */

/**
 * Whether what the user typed matches the account they are deleting.
 *
 * Checked on the server as well as in the panel, because a confirmation that only the client
 * enforces is decoration: the request is one `fetch` away from being sent without it. This is
 * the step that makes the typed email a lock rather than a speed bump.
 *
 * Case and surrounding whitespace are forgiven — the address is the proof of intent, and
 * failing somebody's third confirmation over a capital letter or a trailing space teaches them
 * to distrust the dialog, not to be careful. Nothing else is.
 */
export function confirmationMatches(typed: string, email: string): boolean {
  return typed.trim().toLowerCase() === email.trim().toLowerCase()
}

/**
 * Every memory document this user owns, deduplicated.
 *
 * Two tables point into memory — `profile_sources` for things the user added, `learned_pointers`
 * for answers the product worked out — and a document is dropped from neither. Nulls are the
 * ordinary case rather than an error: a source whose ingest failed, or a pointer whose write
 * did, has no document to delete.
 *
 * Deduplicated because a repeated id would be purged twice, and the second purge would be
 * counted as a second document in the report the user reads.
 */
export function documentIdsFor(
  rows: { memoryId: string | null }[],
  more: { memoryId: string | null }[] = [],
): string[] {
  const ids = new Set<string>()
  for (const row of [...rows, ...more]) {
    if (row.memoryId) ids.add(row.memoryId)
  }
  return [...ids]
}

/**
 * Four billing outcomes down to the three things a departing user could care about.
 *
 * `already` and `cancelled` are one answer — "nothing more will be charged" — because the
 * difference between a subscription the user cancelled last week and one we cancelled a second ago
 * is ours to care about, not theirs. `failed` becomes `pending`, which is a promise rather than a
 * description of a fault: they do not need to know that a PATCH to our payment provider was
 * refused, and they must never be asked to go and fix it.
 *
 * Its own function because it is a product decision rather than a mapping, and the version of this
 * that returned Dodo's vocabulary straight to the panel is what put "your subscription could not be
 * cancelled, so nothing has been deleted" in front of somebody trying to leave.
 */
export function billingStatusFor(
  outcome: 'none' | 'already' | 'cancelled' | 'failed',
): DeletionReport['subscription'] {
  switch (outcome) {
    case 'none':
      return 'none'
    case 'failed':
      return 'pending'
    default:
      return 'cancelled'
  }
}

/**
 * Deletes the user's uploads, by prefix rather than by the keys we have on file.
 *
 * Every key is written as `${userId}/…`, so the prefix is the user's whole shelf — and it
 * catches what the row list cannot: a file that reached R2 in the moment before its row insert
 * failed. Those orphans have no id anywhere in the database, which means a key-driven delete
 * would leave a résumé in storage permanently, with nothing left that knows it is there.
 *
 * Listing is paginated and `delete` takes up to 1000 keys, so both are looped. The trailing
 * slash matters: without it the prefix of one user id could match a longer one.
 */
async function deleteUploads(bucket: R2Bucket, userId: string): Promise<number> {
  const prefix = `${userId}/`
  let cursor: string | undefined
  let deleted = 0

  do {
    const listing = await bucket.list({ prefix, limit: 1000, ...(cursor ? { cursor } : {}) })
    const keys = listing.objects.map((object) => object.key)

    if (keys.length > 0) {
      await bucket.delete(keys)
      deleted += keys.length
    }

    cursor = listing.truncated ? listing.cursor : undefined
  } while (cursor)

  return deleted
}

/**
 * Erases the account and everything attached to it.
 *
 * Throws rather than reporting partial success. The account survives every throw here, which is
 * the point: "we could not finish, nothing was lost, try again" is a state the user can act on,
 * where a deleted login over a half-cleared profile is not.
 */
export async function deleteAccount(
  env: AppEnv['Bindings'],
  userId: string,
): Promise<DeletionReport> {
  const db = drizzle(env.DB)

  /**
   * Read the pointers first, while they still exist. Everything after this depends on them.
   */
  const [sourceRows, pointerRows] = await Promise.all([
    db
      .select({ memoryId: profileSources.memoryId })
      .from(profileSources)
      .where(eq(profileSources.userId, userId)),
    db
      .select({ memoryId: learnedPointers.memoryId })
      .from(learnedPointers)
      .where(eq(learnedPointers.userId, userId)),
  ])

  const documentIds = documentIdsFor(sourceRows, pointerRows)

  /**
   * The subscription goes first, because it is the only part of this that costs money — but a
   * failure here **does not stop the deletion**.
   *
   * It used to. The user was shown "your subscription could not be cancelled, so nothing has been
   * deleted — cancel it in the billing portal, then try again", which is the product refusing to do
   * the one thing it was asked to do and handing its own integration problem to somebody on their
   * way out. Whether Dodo answered a PATCH is not something a user should ever have to care about.
   *
   * What the block was protecting against is real, though: a live subscription whose owner can no
   * longer sign in to stop it. That is now a row in `abandoned_subscriptions` and a logged error,
   * which is a problem we can see and fix, rather than a wall in front of the user.
   */
  const cancellation = await cancelSubscriptionForDeletion(env, userId)

  if (cancellation.outcome === 'failed') {
    /**
     * Recorded before the rows are dropped, and awaited.
     *
     * After the next few statements the subscription id exists nowhere else — not on the account,
     * not in `subscriptions` — so if this insert has not happened by then, the charge becomes
     * untraceable from our side and the user finds out from a bank statement. `onConflictDoNothing`
     * because a retried deletion would otherwise fail on the primary key and take the whole
     * deletion down with it, which is the failure this branch exists to avoid.
     */
    await db
      .insert(abandonedSubscriptions)
      .values({
        dodoSubscriptionId: cancellation.dodoSubscriptionId,
        dodoCustomerId: cancellation.dodoCustomerId,
        lastError: cancellation.reason,
        attempts: 2,
        createdAt: Date.now(),
      })
      .onConflictDoNothing()

    console.error('[aff] account deleted with a subscription still live at Dodo', {
      userId,
      dodoSubscriptionId: cancellation.dodoSubscriptionId,
      reason: cancellation.reason,
    })
  }

  /**
   * Purged in parallel but reported as a set: if a single document survives, the account stays,
   * because the row holding that id is the last thing that knows the document exists.
   *
   * **This blocks where the subscription does not, and the difference is not inconsistency.**
   *
   * A failed cancellation asked the user to go and do work in a billing portal to solve a problem
   * with our payment integration — their errand, our fault, and nothing to do with what they
   * asked for. This is one button, in this dialog, and it is protecting the very thing they asked
   * for: dropping the rows now would strand these documents in Supermemory permanently, with the
   * only ids that could ever reach them deleted in the same statement. "Try again" keeps the
   * deletion possible. Proceeding would quietly make it impossible while reporting success.
   */
  const purged = await Promise.all(documentIds.map((id) => purgeDocument(env, id)))
  const stranded = purged.filter((gone) => !gone).length

  if (stranded > 0) {
    throw new ApiErrorResponse(
      'UPSTREAM_ERROR',
      `${stranded} of your stored ${stranded === 1 ? 'file' : 'files'} could not be reached just now, so nothing has been deleted yet. Try again.`,
    )
  }

  let files: number
  try {
    files = await deleteUploads(env.UPLOADS, userId)
  } catch (cause) {
    console.error('[aff] upload deletion failed', { userId, cause })
    throw new ApiErrorResponse(
      'UPSTREAM_ERROR',
      'Your uploaded files could not be reached just now, so nothing has been deleted yet. Try again.',
    )
  }

  /**
   * One batch, so the rows go together or not at all — a `users` row deleted while its sources
   * survived would leave rows keyed to an account that no longer exists.
   *
   * Every table is named explicitly even though all seven declare `ON DELETE cascade`. Cascade
   * depends on `PRAGMA foreign_keys` being on at the connection, which is not something this
   * code sets or can see, and the failure mode if it is off is silent: the `users` row goes, the
   * delete reports success, and the profile stays in the database. A list that has to be edited
   * when a table is added is the cheaper problem.
   *
   * `users` is last for the same reason it would be under cascade — it is what everything else
   * points at.
   */
  await db.batch([
    db.delete(profileSources).where(eq(profileSources.userId, userId)),
    db.delete(profileDocs).where(eq(profileDocs.userId, userId)),
    db.delete(learnedPointers).where(eq(learnedPointers.userId, userId)),
    db.delete(quotaUsage).where(eq(quotaUsage.userId, userId)),
    db.delete(fillLog).where(eq(fillLog.userId, userId)),
    db.delete(subscriptions).where(eq(subscriptions.userId, userId)),
    db.delete(users).where(eq(users.id, userId)),
  ])

  /**
   * No session to revoke: the token is a stateless JWT, so there is no server-side record of a
   * login to delete. Deleting the row *is* the revocation — `requireAuth` loads the account on
   * every request and already answers `UNAUTHENTICATED` when a validly-signed token names a user
   * who no longer exists. Every device holding a token is signed out by this line, including the
   * ones we never knew about.
   */
  return {
    documents: documentIds.length,
    files,
    subscription: billingStatusFor(cancellation.outcome),
  }
}
