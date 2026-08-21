/**
 * Runtime constants, deliberately free of any zod import.
 *
 * The content script runs on **every page the user visits**, so its bundle is a tax on
 * someone else's page load. Importing a single value from a module that also defines Zod
 * schemas pulls all of zod in behind it — that alone took the content script from 11 kB to
 * 93 kB. Anything the content script needs at runtime belongs here.
 *
 * Schema modules re-export from this file, so there is still one definition.
 */

/** Below this, a fill is marked for review rather than accepted silently. */
export const REVIEW_CONFIDENCE_THRESHOLD = 0.7

/**
 * The plan names, defined here rather than in the zod schema that used to own them.
 *
 * `account.ts` builds its `Plan` enum from this list, so there is still one definition — but the
 * list lives on the zod-free side because `offerFor` takes a plan now, and the content script
 * calls `offerFor`. See the note at the top of this file for what importing zod costs there.
 */
export const PLANS = ['free', 'pro', 'ultra'] as const
export type PlanName = (typeof PLANS)[number]

/* ── Plans and allowances ──────────────────────────────────────────────────

   `free` is a **one-time grant**, not a monthly tier. Every other plan's
   allowance is per calendar month; free is measured once over the life of the
   account and never refills. `periodFor` in `services/account.ts` is what makes
   that true — a free account meters against a fixed period key, so there is no
   reset date and no schema change.

   One-time rather than monthly because a monthly free allowance lets somebody
   applying to five jobs a month finish their whole job search without paying,
   and the job search *is* the product. A grant sized to about three
   applications cannot finish the job. It can only prove the thing works, on the
   user's own real application, and then run out mid-campaign — which is the
   highest-intent moment this product has.                                    */

/**
 * AI actions per calendar month, per plan. Reported to the user as *form fields*, which is the
 * same unit in a word they can price in work.
 *
 * One action is **one field an AI answered, one rewrite, or one source ingested** — the last of
 * those being a multimodal extraction plus a memory write, and the reason a source add and a
 * reprocess are metered here too. Fields resolved from saved info —
 * tier 0, a lookup with no model call — are free and never counted, because they cost us nothing.
 * In the `fill_log` data behind these numbers that was 32% of all classified fields, so a month's
 * allowance stretches roughly half again as far as the number suggests.
 *
 * This replaced a per-*form* allowance, which priced a three-field Google Form and a thirty-four
 * field Workday application the same and had to exempt single fields and rewrites entirely to stay
 * defensible — see the comment this deleted in `routes/fill.ts`. Rewrites were therefore unmetered
 * on the most expensive model we run.
 *
 * `free` is the one-time grant: 50 auto-fills, roughly one or two real applications. It is the
 * half of the product the competition gives away — Simplify ships unlimited autofill free and
 * charges $39.99/mo for the written answers — so charging for short fields from the first click
 * reads as worse-than-free on the commodity, while granting them costs us almost nothing: 50 short
 * answers is well under a cent.
 *
 * Was 100. Halved because the short-field count is not what the grant is for and not what it costs
 * — see `PLAN_LONGFORM_LIMITS`, where the grant's real money is. What 100 bought was three
 * applications of *mechanical* autofill, which is enough to finish the job without ever meeting
 * the written answers; 50 still proves the boring half works and arrives at the offer while the
 * long-answer allowance is the reason to take it.
 *
 * The panel still shows no plan, price or meter until the first fill is attempted. What changed is
 * that the first fill now *succeeds*.
 */
export const PLAN_LIMITS = {
  free: 50,
  pro: 600,
  ultra: 2500,
} as const

/**
 * Long answers per calendar month, per plan. A cost guardrail, not a feature.
 *
 * Measured from `fill_log`: a tier-3 long answer costs ~$0.013 and every other kind of field costs
 * ~$0.0001 or nothing at all. So one number decides whether a plan is affordable, and a user who
 * spent a whole $5 allowance on essays would cost $7.80 — more than they paid.
 *
 * Set near a quarter of `PLAN_LIMITS`, which bounds that worst case to roughly a third of revenue
 * while never binding in practice: essays were 3–9% of fields in the same data.
 *
 * `UsageBar` reported it only past 60% used, on the grounds that a guardrail which never binds is
 * noise. That was defensible while it was ours alone; it stopped being so once checkout sells the
 * figure by name. It is now always shown.
 *
 * On `free` this is not a guardrail but *the* meter, and the only line item in the grant that costs
 * real money: twenty long answers is ~$0.26, against well under a cent for the fifty short
 * auto-fills beside them. This number is what bounds the cost of an account that never pays, so it
 * is the one to move first if free inference spend ever needs cutting — not the auto-fill count,
 * which is noise by comparison and was halved to 50 without materially changing the total.
 *
 * Raised from ten deliberately, and it doubles that exposure: ~$0.26 of inference per account that
 * never converts, so 1,000 such accounts is ~$260. The reason it is worth it is that essays are
 * the thing nothing else on the market does well, and ten is thin — a single long application form
 * can ask for four or five, so ten was two forms before the one feature worth paying for stopped
 * working. Twenty is four forms, which is enough to form a habit rather than a sample.
 *
 * `PLAN_SOLO_ESSAY_LIMITS.free` is what keeps that affordable and is deliberately *not* raised
 * with it: only the first three get a frontier call to themselves, so answers 4–20 are batched and
 * cost a fraction of the headline figure above.
 */
export const PLAN_LONGFORM_LIMITS = {
  free: 20,
  pro: 150,
  ultra: 500,
} as const

/**
 * Long answers that get a model call to themselves, per plan.
 *
 * Above this the remainder is batched into one call, which is cheaper and measurably worse — see
 * `MAX_SOLO_ESSAYS`' former home in `services/fill.ts` for why sharing a call flattens five essays
 * into the same paragraph shape. That makes this the one gate where paying buys a better answer
 * rather than more of the same, and it costs us exactly what it is worth.
 */
export const PLAN_SOLO_ESSAY_LIMITS = {
  // Three, out of the grant's twenty. Only the first three long answers get a frontier call to
  // themselves; the rest are batched, which is measurably flatter writing. That is the honest shape
  // of the upgrade — the grant proves the ceiling of the writing, then stops delivering it — and it
  // is the gate that costs us the most per unit, so it stays tight even as the grant grows.
  free: 3,
  pro: 6,
  ultra: 12,
} as const

/**
 * New answers the product may learn per day, per plan.
 *
 * Was a single plan-blind ceiling. Learning is what makes the writing voice compound, so how fast
 * it happens is a real difference between tiers rather than an invented one. Being over budget is
 * still never an error — the entry is dropped and logged, see `learningBudget`.
 */
export const PLAN_LEARNING_BUDGETS = {
  // Non-zero, because learning is the reason a second account is worse than the first one. The
  // grant is only 50 auto-fills, so this can never write much; what it buys is that somebody who
  // burns a grant and signs up again with a fresh address loses the voice they taught, which is
  // the only defence against multi-accounting that does not involve fraud tooling.
  free: 30,
  pro: 300,
  ultra: 800,
} as const

/**
 * Maximum sources (documents, links, notes) a user can store, per plan.
 *
 * `free` is **not** 0. Onboarding has to finish before the paywall is worth showing, so an account
 * with no subscription can add its resume, a few links and some notes. Five is enough for anyone
 * onboarding honestly and low enough to bound the cost of someone who is not: one source is a
 * Supermemory write plus one tier-2 structuring call, about half a cent.
 */
export const PLAN_SOURCE_LIMITS = {
  free: 5,
  pro: 30,
  ultra: 100,
} as const

/** Maximum custom facts a user can store, per plan. `free` covers onboarding, as above. */
export const PLAN_FACT_LIMITS = {
  free: 25,
  pro: 100,
  ultra: 400,
} as const

/**
 * Maximum upload file size in bytes, per plan.
 *
 * Ultra stops at 50 MB because that is Supermemory's own documented per-file ceiling, and memory
 * owns ingestion of every format. Raising it here would only move the failure downstream.
 */
export const PLAN_UPLOAD_LIMITS = {
  free: 15 * 1024 * 1024,
  pro: 30 * 1024 * 1024,
  ultra: 50 * 1024 * 1024,
} as const

/** Longest pasted note we accept. Supermemory caps text at 1 MB; nothing enforced this before. */
export const MAX_TEXT_BYTES = 1024 * 1024

/** Length of the Pro trial, in days. Passed to Dodo per checkout session, not set on the product. */
export const TRIAL_DAYS = 14

/**
 * Which offer a refused action should make: the trial, or a plan comparison.
 *
 * One rule, in one place, because three surfaces ask the question and they must not disagree — the
 * side panel when Fill is pressed, the page when the launcher is pressed, and the account screen.
 * Decided from the **plan**, not from the limit. It used to read `limit <= 0`, which worked only
 * while `PLAN_LIMITS.free` was 0 and silently inverted the moment free got a real allowance: an
 * exhausted grant would have been offered a plan comparison, as though the user were already
 * paying. The plan is the fact being asked about, so it is the argument now.
 *
 * `free` has never subscribed, so there is nothing to compare and everything to explain. Any other
 * plan belongs to somebody already paying who has run out of one they chose, and what they need is
 * the next one up.
 *
 * Zod-free and in `constants` so the content script can import it: the page decides this from the
 * quota it already holds, without a round trip, because opening the side panel needs a live user
 * gesture and a round trip spends it.
 */
export function offerFor(plan: PlanName | string): 'trial' | 'compare' {
  /*
    Written as "is this a paid plan" rather than "is this free", which is not the same test on a
    value that arrived over the wire. `plan !== 'free'` would send anything unrecognised — a
    truncated field, an empty string, a plan name added by a newer server than this build knows —
    down the comparison path, and a comparison of plans somebody has never had is the one wrong
    answer that cannot be recovered from. Trial is the safe default, so it is the default.
  */
  return plan === 'pro' || plan === 'ultra' ? 'compare' : 'trial'
}

export const FILL_PORT = 'aff:fill' as const

/**
 * Error codes that mean "this session is over", as opposed to "this request failed".
 *
 * The distinction matters because the response is different in kind: a failed request is
 * worth retrying or reporting, whereas a dead session can only be fixed by signing in
 * again, and every retry against it is wasted.
 */
const AUTH_ERROR_CODES = new Set(['UNAUTHENTICATED', 'INVALID_TOKEN'])

export function isAuthError(code: string | undefined): boolean {
  return code !== undefined && AUTH_ERROR_CODES.has(code)
}

/**
 * What the user is told when their session ends.
 *
 * The server's own wording — "Missing bearer token", "Account no longer exists" — describes
 * an HTTP condition to whoever wrote the client. To the person using the extension it reads
 * as a bug in the product, and it names an internal mechanism they cannot act on. This says
 * what happened and what to do about it, and it is the only auth message any surface shows.
 */
export const SESSION_EXPIRED_MESSAGE = 'Your session ended. Sign in again to continue.'

/* ── Learning caps ─────────────────────────────────────────────────────────
   The product learns from every answer the user settles, not only from the
   ones they submit. That is a large increase in write volume, so the ceilings
   are here rather than scattered across the two sides that enforce them.   */

/**
 * How long a field must sit still before its value counts as an answer.
 *
 * Matched to `waitForOption`'s 1500 ms deadline in the ATS adapter, because react-select is
 * the slowest committer we know of: it drives its own value over roughly that long, and
 * reading before it settles records an empty field as a rejection of the answer we just wrote.
 */
export const LEARN_SETTLE_DELAY_MS = 1500

/**
 * The longest a pending answer may wait, however much the user keeps typing.
 *
 * A pure debounce never fires on a form somebody is working through continuously — every
 * keystroke pushes the deadline out, and the whole page is taught only at submit, which is
 * the behaviour this replaces. This is the guarantee that something lands.
 */
export const LEARN_SETTLE_MAX_WAIT_MS = 6000

/** Floor between two reports, so a fast typist is batched rather than streamed. */
export const LEARN_MIN_REPORT_INTERVAL_MS = 3000

/**
 * Answers one page may teach, across every fill and every settle on it.
 *
 * A long form is still one event in the user's life. Without a ceiling, one unusual page
 * could write more memories than a month of ordinary use and dominate everything retrieved
 * afterwards.
 */
export const LEARN_MAX_PER_PAGE = 24

/** Entries in one report. Small because reports are now frequent rather than final. */
export const LEARN_MAX_PER_REPORT = 8

/**
 * Longest answer we send.
 *
 * Enforced on the client because the wire schema caps `accepted` at the same length and zod
 * rejects the **whole batch** on one over-length entry — so a single long essay would
 * silently discard the seven other answers travelling with it.
 */
export const LEARN_MAX_ANSWER_CHARS = 4000

/**
 * Most options we will carry alongside a choice.
 *
 * An option set is what makes a short answer meaningful later — "10" is nothing, "10, out of
 * 1-10" is a fact. But a 200-country dropdown's option set is payload, not information, and
 * it would reach a prompt.
 */
export const LEARN_MAX_OPTIONS = 24

/**
 * Questions whose answers are never learned, whatever else says otherwise.
 *
 * Detection already refuses to fill most of these, so in practice this is the durable
 * backstop rather than the first line of defence — and it is checked on **both** sides of the
 * wire, because the client can be an old build and the server is the side that persists.
 * A one-time code stored in a memory index is a secret that outlives its own validity.
 */
export const NEVER_LEARN =
  /pass(word|code)|\botp\b|\bpin\b|\bcvv\b|\bcvc\b|card.?number|security.?code|\bssn\b|social.?security|verification.?code|one-?time|\b2fa\b|\bcaptcha\b/i
