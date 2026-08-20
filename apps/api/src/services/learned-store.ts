import { and, eq, inArray } from 'drizzle-orm'
import { learnedPointers } from '../db/schema.js'
import type { Db } from './account.js'

/**
 * Bookkeeping for learned answers: which document holds each one, and what the user has told
 * us *not* to answer with.
 *
 * **This module cannot answer a question, and that is deliberate.** Nothing it exports returns
 * an answer — `readPointers` returns digests and a document id, `readNegatives` returns values
 * to avoid. The answers themselves live in Supermemory and only there. A local question-to-
 * answer store existed here once and was removed for good reasons (the post-mortem is in
 * `answer-bank.ts`), so the boundary is enforced by what the table *has* rather than by anyone
 * remembering not to reach for it: there is no answer column to read.
 *
 * Import direction is part of the boundary too. `answer-bank.ts` writes here, `services/fill.ts`
 * reads negatives, and the answering paths — `retrieval.ts`, `router/tier0.ts`, `llm/generate.ts`
 * — never import this file. A test asserts that.
 */

/** Newest first. Three is plenty: a fourth rejection means stop guessing, not remember more. */
const MAX_REJECTED = 3
const MAX_REJECTED_CHARS = 120

export interface LearnedPointer {
  questionHash: string
  memoryId: string | null
  answerHash: string | null
  rejected: string[]
}

/**
 * Comparable form of an answer. Mirrors `canonical()` in `overlay/feedback.ts`: case, spacing,
 * and the order of a multi-selection all carry no meaning.
 */
function canonical(value: string): string {
  return value
    .split(',')
    .map((part) => part.trim().toLowerCase().replace(/\s+/g, ' '))
    .filter(Boolean)
    .sort()
    .join(',')
}

async function digest(input: string): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
  return [...new Uint8Array(bytes)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 32)
}

/**
 * One-way fingerprint of a stored answer.
 *
 * Its only job is to make a repeat teach of the same answer cost nothing — no PATCH, no POST,
 * no tokens. A digest rather than the text precisely so this table can never quietly become
 * the thing that answers a form.
 */
export async function answerHashOf(answer: string): Promise<string> {
  return digest(canonical(answer))
}

/**
 * The key an answer is remembered under.
 *
 * `origin` is included for prose and excluded for choices, and that asymmetry is the whole
 * point of the function:
 *
 *   - "Why do you want to work here?" has a different true answer at every company, so two
 *     sites must keep two documents. Replacing one with the other would overwrite a good
 *     answer with the answer to a different question that happens to share a label.
 *   - "Do you require visa sponsorship?" has one true answer whoever is asking, so the second
 *     site's answer must *replace* the first rather than sit beside it contradicting it.
 *
 * `section` is always included: "Phone" under "Emergency contact" is not the same question as
 * "Phone", and the two must never share a row.
 */
export async function questionHashFor(
  question: string,
  scope: { section?: string | undefined; origin?: string | undefined },
): Promise<string> {
  const parts = [canonical(question), canonical(scope.section ?? '')]
  if (scope.origin) parts.push(scope.origin.toLowerCase())
  return digest(parts.join(' '))
}

function splitRejected(stored: string | null): string[] {
  if (!stored) return []
  return stored
    .split(' | ')
    .map((value) => value.trim())
    .filter(Boolean)
}

/** Pointers for a batch of questions, in one indexed lookup. */
export async function readPointers(
  db: Db,
  userId: string,
  hashes: string[],
): Promise<Map<string, LearnedPointer>> {
  const found = new Map<string, LearnedPointer>()
  if (hashes.length === 0) return found

  const rows = await db
    .select({
      questionHash: learnedPointers.questionHash,
      memoryId: learnedPointers.memoryId,
      answerHash: learnedPointers.answerHash,
      rejectedValues: learnedPointers.rejectedValues,
    })
    .from(learnedPointers)
    .where(and(eq(learnedPointers.userId, userId), inArray(learnedPointers.questionHash, hashes)))

  for (const row of rows) {
    found.set(row.questionHash, {
      questionHash: row.questionHash,
      memoryId: row.memoryId,
      answerHash: row.answerHash,
      rejected: splitRejected(row.rejectedValues),
    })
  }
  return found
}

/**
 * Which rejections survive an answer being learned for the same question.
 *
 * **None, once something was actually stored**, and that is a deliberate widening of what this
 * used to do. It only dropped a rejection whose value *equalled* the new answer — the
 * changed-their-mind case: somebody who cleared "Twitter" last month and typed it themselves
 * today, where continuing to avoid it would make the field permanently unanswerable.
 *
 * That missed the commonest shape of a correction by far. A user who edits an answer usually
 * *extends* ours rather than replacing it — appending "and I'm aiming for a thousand users this
 * quarter" to the paragraph we wrote. Clearing the field first, or the settle path reading it
 * empty for a moment, files our original text as a rejection. So the model was then told, in the
 * same prompt: reuse their answer, which contains our paragraph almost verbatim; and never offer
 * our paragraph again. Faced with that, composing something new from scratch is a reasonable
 * reading — and it is exactly the reported symptom, an edit that seemed never to have been
 * learned.
 *
 * The rule that resolves it: a rejection says "not this" *without* saying what is right, which
 * is the only reason it is worth keeping at all. The moment the user tells us what is right, it
 * has been superseded — and a negative that fights the positive is worse than no negative.
 *
 * Nothing is dropped when `learned` is false: a memory outage stored no answer, so the
 * rejections are still all we know.
 */
export function keptRejections(existing: string[], answer: string, learned: boolean): string[] {
  if (learned) return []
  return existing.filter((value) => canonical(value) !== canonical(answer))
}

/**
 * Records where an answer now lives.
 *
 * `answer` is taken in plain text purely so it can be weighed against the rejected list — see
 * `keptRejections`. The text is used for that comparison and never stored.
 */
export async function writePointer(
  db: Db,
  userId: string,
  entry: {
    questionHash: string
    question: string
    memoryId: string | null
    answerHash: string | null
    answer: string
    now: number
  },
): Promise<void> {
  const existing = (await readPointers(db, userId, [entry.questionHash])).get(entry.questionHash)
  const kept = keptRejections(existing?.rejected ?? [], entry.answer, entry.memoryId !== null)
  const rejectedValues = kept.length > 0 ? kept.join(' | ') : null

  await db
    .insert(learnedPointers)
    .values({
      userId,
      questionHash: entry.questionHash,
      question: entry.question,
      memoryId: entry.memoryId,
      answerHash: entry.answerHash,
      rejectedValues,
      updatedAt: entry.now,
    })
    .onConflictDoUpdate({
      target: [learnedPointers.userId, learnedPointers.questionHash],
      set: {
        question: entry.question,
        memoryId: entry.memoryId,
        answerHash: entry.answerHash,
        rejectedValues,
        updatedAt: entry.now,
      },
    })
}

/**
 * Records that the user rejected a value for this question.
 *
 * No Supermemory document is ever written for a rejection. A passage saying "this answer was
 * wrong" is retrieved by the same question later and drags the next answer toward the very
 * thing it was warning about — which is why there was no negative signal at all for so long.
 * Kept here, it can be stated to the model as an instruction instead of retrieved as material.
 */
export async function addRejection(
  db: Db,
  userId: string,
  entry: { questionHash: string; question: string; value: string; now: number },
): Promise<void> {
  const value = entry.value.trim().slice(0, MAX_REJECTED_CHARS)
  if (value === '') return

  const existing = (await readPointers(db, userId, [entry.questionHash])).get(entry.questionHash)
  const kept = [
    value,
    ...(existing?.rejected ?? []).filter((old) => canonical(old) !== canonical(value)),
  ].slice(0, MAX_REJECTED)

  await db
    .insert(learnedPointers)
    .values({
      userId,
      questionHash: entry.questionHash,
      question: entry.question,
      memoryId: existing?.memoryId ?? null,
      answerHash: existing?.answerHash ?? null,
      rejectedValues: kept.join(' | '),
      updatedAt: entry.now,
    })
    .onConflictDoUpdate({
      target: [learnedPointers.userId, learnedPointers.questionHash],
      set: {
        question: entry.question,
        rejectedValues: kept.join(' | '),
        updatedAt: entry.now,
      },
    })
}

/**
 * Values the user has already rejected, for the questions this form asks.
 *
 * Bounded by the form rather than by history: at most three values per question, and only for
 * questions actually on the page. It cannot grow with use, which is what makes it safe to put
 * in a prompt at all.
 *
 * Both key shapes are looked up for every question, because the field's kind may have been read
 * differently on the two sites — a rejection recorded against an origin-scoped prose key and one
 * recorded against a choice key should both be found.
 */
export async function readNegatives(
  db: Db,
  userId: string,
  questions: { fieldId: string; question: string; section?: string | undefined; origin: string }[],
): Promise<Map<string, string[]>> {
  const byField = new Map<string, string[]>()
  const wanted = questions.filter((entry) => entry.question.trim() !== '')
  if (wanted.length === 0) return byField

  const keys = await Promise.all(
    wanted.map(async (entry) => ({
      fieldId: entry.fieldId,
      hashes: [
        await questionHashFor(entry.question, { section: entry.section }),
        await questionHashFor(entry.question, { section: entry.section, origin: entry.origin }),
      ],
    })),
  )

  const pointers = await readPointers(db, userId, [...new Set(keys.flatMap((key) => key.hashes))])
  if (pointers.size === 0) return byField

  for (const { fieldId, hashes } of keys) {
    const values = [...new Set(hashes.flatMap((hash) => pointers.get(hash)?.rejected ?? []))].slice(
      0,
      MAX_REJECTED,
    )
    if (values.length > 0) byField.set(fieldId, values)
  }
  return byField
}
