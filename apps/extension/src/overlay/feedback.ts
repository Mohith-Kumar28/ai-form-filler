import type { FeedbackRequest, FieldKind, FieldSchema } from '@aff/shared'
import {
  LEARN_MAX_ANSWER_CHARS,
  LEARN_MAX_PER_PAGE,
  LEARN_MAX_PER_REPORT,
  LEARN_MIN_REPORT_INTERVAL_MS,
  LEARN_SETTLE_DELAY_MS,
  LEARN_SETTLE_MAX_WAIT_MS,
  NEVER_LEARN,
} from '@aff/shared/constants'

/**
 * Captures what the user actually decided, and teaches it.
 *
 * This is what makes the product compound: an answer they wrote or corrected is the
 * highest-signal data the system ever gets, because they cared enough to type it. Those
 * corrections go back into the profile and into memory, and answer the same question on the
 * next form.
 *
 * ### Why this no longer waits for submit
 *
 * It used to read only on submit, and the reasoning was sound as far as it went: mid-typing
 * text is not an answer, and submit is the one moment the user has declared the values final.
 * But it armed once and reported once, so everything else was lost — an answer edited and not
 * submitted, a form abandoned on page three, a tab closed on a job application somebody
 * decided against. The product forgot precisely the sessions where the user had done the most
 * work.
 *
 * So the definition of *commit* widens from "the form was submitted" to "this field settled",
 * and submit becomes the final sweep rather than the only one. The mid-typing rule is
 * unchanged and is still enforced two ways: nothing is ever read on `input`, and a field the
 * caret is still inside is put back in the queue rather than read.
 *
 * **Only differences are reported.** An answer kept exactly as proposed teaches nothing the
 * profile does not already contain, and sending one per field per form would fill a user's
 * memory with restatements of itself and make retrieval worse over time.
 *
 * Reading the page is **not** this module's job — see `FormAdapter.readValue`. It used to be,
 * via a helper that understood native controls only, and every ARIA widget on Google Forms
 * read as unanswered.
 */

/**
 * Ceiling on what one *submission* may teach.
 *
 * A long form with many corrections is still one event in the user's life, and letting a
 * single submit write dozens of memories would let one unusual form dominate everything
 * retrieved afterwards. Longest answers win the cap: a corrected essay carries far more
 * reusable voice than a corrected postcode. `LEARN_MAX_PER_PAGE` is the same idea across the
 * whole page rather than one report.
 */
const MAX_LEARNED_PER_SUBMIT = 12

/**
 * Sentinel for "this field's answer was rejected", stored in the same map as taught answers.
 *
 * A leading space, which `canonical()` strips from every real answer, so a rejection and an
 * answer can share the dedup map without ever colliding.
 */
const REJECTED = ' rejected'

/** How often the "did anything change" sweep may walk every field. See `takeSnapshot`. */
const SNAPSHOT_THROTTLE_MS = 750

type Entry = FeedbackRequest['entries'][number]

export interface ProposedValue {
  fieldId: string
  label: string
  /** What we wrote. Empty for a field we left blank but are still watching. */
  proposed: string
  /**
   * The widget kind, forwarded so the server can tell a constrained choice from prose.
   *
   * A dropdown answer is a durable fact about this person ("iOS", "Bengaluru") and is stored
   * with the option set it came from. An essay is voice and is stored as prose. A lone
   * checkbox is a yes/no question, and it is the one kind whose *empty* reading is an answer.
   */
  kind?: FieldKind
  /**
   * Carried so the server can tell whose details these are.
   *
   * "Phone" under "Emergency contact" is not the user's phone, and the classifier can only
   * see that if the section travels with the answer.
   */
  section?: string
  hint?: string
  /**
   * The option labels this field offered, when it offered a usable number of them.
   *
   * A short answer is close to meaningless without them: "10" recalled on its own tells the
   * next form nothing, while "10, chosen from 1-10" is a fact about the person. Labels rather
   * than values, because a value is a page-local token that means nothing on another site.
   */
  options?: string[]
}

/**
 * How this module reaches the page. All three are the caller's, because each needs the adapter
 * and the live element map, and none belongs in an event listener.
 */
export interface PageReader {
  /** The field's current answer, via the adapter that wrote it. */
  read: (fieldId: string) => string | null
  /**
   * Whether the field is still in the document.
   *
   * Separates the two reasons a field reads as empty, which mean opposite things. A field the
   * user *cleared* is a rejection. A field the page *replaced* — every question on page one of
   * a multi-page Google Form, once "Next" is clicked — was answered and then taken away, and
   * treating those as cleared loses most of a long form's answers.
   */
  isAlive: (fieldId: string) => boolean
  /**
   * Which field an event happened in, if any.
   *
   * Two things need it that a document-level listener cannot do alone: settling only the field
   * that was actually touched, rather than reading all fifty on every click, and refusing to
   * settle a field the caret is still inside.
   */
  fieldIdAt: (node: Node | null) => string | null
}

export interface FeedbackCapture {
  /** Call when the fill completes, to record what we proposed and where. */
  arm: (proposals: ProposedValue[], page: PageReader) => void
  disarm: () => void
}

/**
 * How a report leaves this module.
 *
 * `fieldIds` travels beside the payload rather than inside it, because the wire schema is
 * deliberately field-id-free — an id is a page-local token that means nothing to the server —
 * while the page needs exactly that to say "kept" under the right field. Same data, two
 * audiences, and only one of them should be sent anywhere.
 */
export type FeedbackSend = (payload: FeedbackRequest, fieldIds: string[]) => void

/**
 * What we proposed, in the words the page displays.
 *
 * The model answers a choice field with an option's `value`, while a widget reads back the
 * `label` a human sees — so on any form where the two differ ("US" vs "United States", or
 * Google's generated data-values), an untouched answer looked like an edit. That reported a
 * correction the user never made, and taught the answer to itself on every submit.
 */
export function displayValueOf(field: Pick<FieldSchema, 'options'>, value: string): string {
  if (!field.options || field.options.length === 0 || value === '') return value

  const labelFor = (token: string): string => {
    const wanted = token.trim().toLowerCase()
    const match = field.options?.find(
      (option) =>
        option.value.trim().toLowerCase() === wanted ||
        option.label.trim().toLowerCase() === wanted,
    )
    return match ? match.label : token.trim()
  }

  // The whole answer first: option labels contain commas ("Yes, I agree"), and splitting
  // before trying it turns one option into fragments that match nothing.
  const whole = labelFor(value)
  if (whole !== value.trim()) return whole

  return value.split(',').map(labelFor).filter(Boolean).join(', ')
}

/** Comparable form of an answer: case, spacing, and selection order all carry no meaning. */
function canonical(value: string): string {
  return value
    .split(',')
    .map((part) => part.trim().toLowerCase().replace(/\s+/g, ' '))
    .filter(Boolean)
    .sort()
    .join(',')
}

/**
 * Trims an over-long answer at a word boundary.
 *
 * Not cosmetic. The wire schema caps `accepted`, and zod rejects the **whole batch** on one
 * over-length entry — so a single long essay would silently discard the seven other answers
 * travelling with it, and the failure would look like "learning just doesn't work sometimes".
 */
function clampAnswer(value: string): string {
  if (value.length <= LEARN_MAX_ANSWER_CHARS) return value
  const cut = value.slice(0, LEARN_MAX_ANSWER_CHARS)
  const lastSpace = cut.lastIndexOf(' ')
  return (lastSpace > LEARN_MAX_ANSWER_CHARS * 0.8 ? cut.slice(0, lastSpace) : cut).trimEnd()
}

/**
 * One feedback entry, for a verdict the user reached deliberately.
 *
 * Every surface that can settle an answer — the card on the page, the panel's stepper, the
 * submit sweep — builds its entry here. Four callers assembling this object by hand is how
 * they drift, and the last time they did, one of them silently sent nothing at all for a
 * cleared field.
 */
export function feedbackEntryFor(
  fill: { label: string; kind?: FieldKind; value: string; options?: string[] },
  context: { section?: string; hint?: string },
  verdict: 'accepted' | 'edited' | 'cleared',
  accepted: string,
  meta: { rewritten?: boolean; trigger?: 'settle' | 'submit' | 'review' } = {},
): Entry {
  const base = {
    label: fill.label,
    ...(fill.kind ? { kind: fill.kind } : {}),
    ...(context.section ? { section: context.section } : {}),
    ...(context.hint ? { hint: context.hint } : {}),
    ...(fill.options && fill.options.length > 0 ? { options: fill.options } : {}),
    proposed: fill.value,
    ...(meta.trigger ? { trigger: meta.trigger } : {}),
  }

  if (verdict === 'cleared') {
    // No value, and never stored as one. `rejected` is what tells the server this is a
    // negative signal rather than an empty answer it should drop on arrival.
    return { ...base, accepted: '', edited: false, rejected: true }
  }

  if (verdict === 'accepted') {
    return { ...base, accepted: clampAnswer(accepted), edited: false, confirmed: true }
  }

  return {
    ...base,
    accepted: clampAnswer(accepted),
    edited: true,
    // A rewrite the user then kept is both things at once: we wrote the words, they chose
    // them. Recording only the edit would lose the fact that they signed off on it.
    ...(meta.rewritten ? { confirmed: true } : {}),
  }
}

/**
 * Watches for answers settling, and for the form being submitted, then reports them.
 *
 * Listens in the **capture** phase so values are read before any handler can reset the form,
 * and passively so submission is never delayed or blocked by this.
 */
export function createFeedbackCapture(origin: string, send: FeedbackSend): FeedbackCapture {
  let proposals: ProposedValue[] = []
  let page: PageReader | null = null
  let armed = false

  /**
   * The last committed answer seen for each field, kept against the page destroying it.
   *
   * A multi-page form is one submission from the user's point of view and several DOMs from
   * ours: clicking "Next" on a Google Form replaces every question, so by the time anything
   * submits, page one reads as empty and would teach nothing. Snapshotting on commit keeps
   * those answers, and they are used *only* when the field is gone — a field still on the page
   * and now empty was deliberately cleared, which is a rejection.
   */
  const snapshot = new Map<string, string>()

  /**
   * What has already been taught, and what it was.
   *
   * Survives re-arming on purpose. A second fill on the same page must not re-teach the same
   * answers, and the counter is the page's ceiling.
   */
  const taught = new Map<string, string>()
  /** `question|answer`, so two fields asking the same thing teach once between them. */
  const taughtKeys = new Set<string>()
  let taughtCount = 0

  /** Fields the user has actually interacted with since arming. See the checkbox rule below. */
  const touched = new Set<string>()
  /** Fields waiting to be read. */
  const pending = new Set<string>()
  /**
   * Fields that read empty once.
   *
   * A widget which writes asynchronously — react-select drives its own value over roughly a
   * second and a half — reads empty for a moment after being touched. Recording that as a
   * rejection would teach "the user rejected this" every single time they picked something.
   * One empty read is a maybe; two is a decision.
   */
  const emptyOnce = new Set<string>()

  let settleTimer: ReturnType<typeof setTimeout> | null = null
  let firstPendingAt = 0
  let lastReportAt = 0
  let lastSweepAt = 0

  /**
   * The field's answer, or null if there isn't one.
   *
   * A lone checkbox reads null when unchecked, and unchecked is an **answer** — "No" — not an
   * absence. That single line is why declining a consent box could never be learned: it read
   * as empty, empty read as cleared, and cleared was dropped.
   *
   * Only the boolean kind gets that reading. A radio group with nothing selected is genuinely
   * unanswered, and calling that "no" would invent an answer the user never gave.
   *
   * The adapters are deliberately not changed for this. `readValue` is also how the inline
   * sparkle decides whether a field is still empty, and "unchecked" means opposite things to
   * the two callers — so the boolean reading belongs to the caller that wants it, here.
   */
  const resolveAccepted = (proposal: ProposedValue): string | null => {
    if (!page) return null
    const live = page.read(proposal.fieldId)
    const alive = page.isAlive(proposal.fieldId)

    if (live === null && !alive) return snapshot.get(proposal.fieldId) ?? null
    if (live === null && alive && proposal.kind === 'checkbox') return 'no'
    return live
  }

  /** An answer worth teaching, or null if any of the guards says no. */
  const answerEntry = (proposal: ProposedValue, accepted: string): Entry | null => {
    if (taughtCount >= LEARN_MAX_PER_PAGE) return null

    // The durable backstop. Detection refuses to fill these, but a page can relabel a field
    // after the fact, and a one-time code in a memory index outlives its own validity.
    if (NEVER_LEARN.test(`${proposal.label} ${proposal.hint ?? ''}`)) return null

    // Unchanged from what we proposed: teaches nothing, and would teach the answer to itself.
    if (canonical(accepted) === canonical(proposal.proposed)) return null

    if (taught.get(proposal.fieldId) === canonical(accepted)) return null

    const key = `${canonical(proposal.label)}|${canonical(accepted)}`
    if (taughtKeys.has(key)) return null

    /**
     * A boolean is only learned from a box the user actually touched.
     *
     * With "unchecked = No" now readable, an untouched page of consent checkboxes would
     * otherwise teach "No" to a dozen questions nobody ever looked at — and a page that
     * arrives with a marketing box pre-ticked would teach "Yes" the same way. Neither is
     * something the user told us.
     */
    if (
      proposal.kind === 'checkbox' &&
      proposal.proposed === '' &&
      !touched.has(proposal.fieldId)
    ) {
      return null
    }

    taught.set(proposal.fieldId, canonical(accepted))
    taughtKeys.add(key)
    taughtCount += 1

    return {
      label: proposal.label,
      ...(proposal.kind ? { kind: proposal.kind } : {}),
      ...(proposal.section ? { section: proposal.section } : {}),
      ...(proposal.hint ? { hint: proposal.hint } : {}),
      ...(proposal.options && proposal.options.length > 0 ? { options: proposal.options } : {}),
      proposed: proposal.proposed,
      accepted: clampAnswer(accepted),
      edited: true,
    }
  }

  /** A cleared answer, reported as a negative signal. Null when there is nothing to reject. */
  const rejectionEntry = (proposal: ProposedValue): Entry | null => {
    // Only a value *we* proposed can be rejected. An empty field nobody filled is not a
    // signal about anything — it is just an empty field.
    if (proposal.proposed.trim() === '') return null

    const already = taught.get(proposal.fieldId)
    if (already === REJECTED) return null

    /**
     * Already answered this field themselves, so a later clear is not a verdict on ours.
     *
     * The sequence that made this matter: the user extends our paragraph with a sentence they
     * care about — it is taught — and then clears the form to watch it fill again. The clear
     * files our original text as a rejection, and since their edit *contains* that text almost
     * verbatim, the next prompt says both "reuse their answer" and "never offer that again".
     * Composing something new is a fair reading of that, and it looks precisely like the edit
     * was never learned.
     *
     * Same principle the store applies in `keptRejections`, at the other end of the wire: a
     * rejection is worth keeping only because it says "not this" *without* saying what is
     * right. Once they have said what is right, it has nothing left to add — and a negative
     * that fights the positive is worse than no negative.
     */
    if (already !== undefined) return null

    taught.set(proposal.fieldId, REJECTED)
    return {
      label: proposal.label,
      ...(proposal.kind ? { kind: proposal.kind } : {}),
      ...(proposal.section ? { section: proposal.section } : {}),
      ...(proposal.hint ? { hint: proposal.hint } : {}),
      proposed: proposal.proposed,
      accepted: '',
      edited: false,
      rejected: true,
    }
  }

  const report = (reported: { entry: Entry; fieldId: string }[], trigger: 'settle' | 'submit') => {
    if (reported.length === 0) return
    lastReportAt = Date.now()
    send(
      { origin, entries: reported.map(({ entry }) => ({ ...entry, trigger })) },
      reported.map(({ fieldId }) => fieldId),
    )
  }

  const schedule = () => {
    if (settleTimer !== null) clearTimeout(settleTimer)
    if (firstPendingAt === 0) firstPendingAt = Date.now()

    /**
     * Debounced, but with a hard ceiling on the wait.
     *
     * A pure debounce never fires on a form somebody is working through continuously: every
     * keystroke pushes the deadline out, and the page is taught only at submit — the exact
     * behaviour this replaces.
     */
    const waited = Date.now() - firstPendingAt
    const delay = Math.min(LEARN_SETTLE_DELAY_MS, Math.max(0, LEARN_SETTLE_MAX_WAIT_MS - waited))
    settleTimer = setTimeout(flushSettled, delay)
  }

  function flushSettled(): void {
    settleTimer = null
    if (!armed || !page) return

    // Batch a fast typist rather than streaming one request per field.
    if (Date.now() - lastReportAt < LEARN_MIN_REPORT_INTERVAL_MS) {
      schedule()
      return
    }

    const entries: { entry: Entry; fieldId: string }[] = []

    for (const fieldId of [...pending]) {
      const proposal = proposals.find((candidate) => candidate.fieldId === fieldId)
      if (!proposal) {
        pending.delete(fieldId)
        continue
      }

      // Still being typed into. Stays pending — this is the guard `focusout` cannot provide,
      // for someone who ticks a checkbox in the same fieldset without leaving the textarea.
      if (page.fieldIdAt(document.activeElement) === fieldId) continue

      const accepted = resolveAccepted(proposal)

      if ((accepted === null || accepted.trim() === '') && page.isAlive(fieldId)) {
        if (!emptyOnce.has(fieldId)) {
          emptyOnce.add(fieldId)
          schedule()
          continue
        }
        const rejection = rejectionEntry(proposal)
        if (rejection) entries.push({ entry: rejection, fieldId })
        pending.delete(fieldId)
        continue
      }

      emptyOnce.delete(fieldId)
      pending.delete(fieldId)
      if (accepted === null) continue

      const entry = answerEntry(proposal, accepted)
      if (entry) entries.push({ entry, fieldId })
    }

    if (pending.size === 0) firstPendingAt = 0
    report(entries.slice(0, LEARN_MAX_PER_REPORT), 'settle')
  }

  /**
   * The final sweep, on submit or on the page going away.
   *
   * Everything a settle already taught is skipped by the same guards, so nothing is reported
   * twice — and a field still on the page, still empty, that we had filled is a rejection the
   * settle path may not have seen yet.
   */
  const collect = () => {
    if (!armed || !page) return

    /**
     * Read everything first, then decide — in that order, and the order is load-bearing.
     *
     * `answerEntry` has side effects: it spends `LEARN_MAX_PER_PAGE`. Building entries in
     * proposal order and sorting afterwards means the page ceiling is spent on whichever
     * fields happen to come first in the DOM, and on a long application the essays are at the
     * *end* — so the longest-answer-wins rule was quietly defeated by the very cap that was
     * supposed to sit above it. Sorting the candidates before spending anything is what keeps
     * the two caps agreeing.
     */
    const answers: { proposal: ProposedValue; accepted: string }[] = []
    const rejections: { entry: Entry; fieldId: string }[] = []

    for (const proposal of proposals) {
      const accepted = resolveAccepted(proposal)

      if (accepted === null || accepted.trim() === '') {
        if (page.isAlive(proposal.fieldId)) {
          const rejection = rejectionEntry(proposal)
          if (rejection) rejections.push({ entry: rejection, fieldId: proposal.fieldId })
        }
        continue
      }

      answers.push({ proposal, accepted })
    }

    answers.sort((a, b) => b.accepted.length - a.accepted.length)

    const entries: { entry: Entry; fieldId: string }[] = []
    for (const { proposal, accepted } of answers) {
      if (entries.length >= MAX_LEARNED_PER_SUBMIT) break
      const entry = answerEntry(proposal, accepted)
      if (entry) entries.push({ entry, fieldId: proposal.fieldId })
    }

    // Rejections are cheap and few — a form cannot have more of them than it had fills — so
    // they are not made to compete with answers for the submit cap.
    report([...entries, ...rejections], 'submit')

    // One final report per fill. Re-submitting the same form should not double-count answers.
    armed = false
  }

  /**
   * One message, not two.
   *
   * `collect` sweeps every proposal, so anything a pending settle was about to report is
   * already inside it — and on a page being torn down, a second `sendMessage` is the one that
   * dies. Clearing the timer first is what stops it firing into a dead context.
   */
  const finish = () => {
    if (settleTimer !== null) {
      clearTimeout(settleTimer)
      settleTimer = null
    }
    collect()
  }

  const onSubmit = () => finish()

  /**
   * Many real forms submit via a click handler and `fetch` rather than a native submit
   * event, so a submit listener alone misses them. `pagehide` covers navigation away,
   * including the case where submission succeeded and redirected.
   */
  const onPageHide = () => finish()

  /**
   * The last reliable moment on a navigating page.
   *
   * Google Forms submits with a `role="button"` div, so no native `submit` event fires at
   * all, and `pagehide` on a page already tearing down is a poor place to start a
   * `sendMessage`. `visibilitychange → hidden` is the one callback the platform guarantees to
   * run before that, which is why beacons are sent from it. Whichever fires first wins;
   * `collect` disarms itself, so the others become no-ops.
   */
  const onVisibilityChange = () => {
    if (document.visibilityState === 'hidden') finish()
  }

  /**
   * A field was touched. Queue it, and note that a human was involved.
   *
   * `touched` is not the same as `pending`: pending empties as fields are read, while touched
   * is the record that the user themselves acted on this control — which is the only thing
   * that makes an unticked checkbox mean "No" rather than "nobody looked".
   */
  const noteActivity = (event: Event) => {
    if (!armed || !page) return
    const fieldId = page.fieldIdAt(event.target as Node | null)
    if (fieldId === null) return
    touched.add(fieldId)
    pending.add(fieldId)
    schedule()
  }

  /**
   * Snapshot every watched field, throttled.
   *
   * Kept as a full sweep rather than narrowed to the touched field, because the case it exists
   * for is a click **outside** any field — "Next" on a Google Form — which must capture
   * everything before the page replaces it. The throttle is what keeps that affordable now
   * that fifty-field forms fire this far more often.
   */
  const takeSnapshot = () => {
    if (!armed || !page) return
    if (Date.now() - lastSweepAt < SNAPSHOT_THROTTLE_MS) return
    lastSweepAt = Date.now()

    for (const proposal of proposals) {
      const value = page.read(proposal.fieldId)
      if (value !== null && value.trim() !== '') snapshot.set(proposal.fieldId, value)
    }
  }

  const onChange = (event: Event) => {
    takeSnapshot()
    noteActivity(event)
  }

  const onClick = (event: Event) => {
    takeSnapshot()
    noteActivity(event)
  }

  /**
   * The only commit signal a contenteditable or an ARIA text widget gives.
   *
   * `blur` does not bubble, but a capture-phase listener on the document still sees it.
   */
  const onFocusOut = (event: Event) => noteActivity(event)

  return {
    arm: (nextProposals, pageReader) => {
      proposals = nextProposals
      page = pageReader
      armed = true

      // Per-fill state. `taught` and `taughtCount` deliberately survive: a second fill on the
      // same page must not re-teach what the first one already did.
      snapshot.clear()
      pending.clear()
      touched.clear()
      emptyOnce.clear()
      firstPendingAt = 0

      document.addEventListener('submit', onSubmit, { capture: true, passive: true })
      document.addEventListener('visibilitychange', onVisibilityChange)
      window.addEventListener('pagehide', onPageHide)

      /**
       * Three commit signals, because one widget layer per event.
       *
       * `change` is what native controls fire when a value settles — on blur for text, on
       * selection for checkboxes and selects. Google's ARIA widgets are divs and fire it
       * *never*, so a click is the only evidence they were touched. `focusout` catches the
       * contenteditable case, which fires neither. All in the capture phase, which is what
       * makes the "Next" case work: the snapshot runs before the page's own handler tears the
       * questions down.
       *
       * There is deliberately **no `input` listener**. Mid-typing text is not an answer, and
       * reading on every keystroke is both noisy and invasive on someone else's form.
       */
      document.addEventListener('change', onChange, { capture: true, passive: true })
      document.addEventListener('click', onClick, { capture: true, passive: true })
      document.addEventListener('focusout', onFocusOut, { capture: true, passive: true })
    },
    disarm: () => {
      armed = false
      if (settleTimer !== null) {
        clearTimeout(settleTimer)
        settleTimer = null
      }
      snapshot.clear()
      pending.clear()
      touched.clear()
      emptyOnce.clear()
      document.removeEventListener('submit', onSubmit, { capture: true })
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('pagehide', onPageHide)
      document.removeEventListener('change', onChange, { capture: true })
      document.removeEventListener('click', onClick, { capture: true })
      document.removeEventListener('focusout', onFocusOut, { capture: true })
    },
  }
}
