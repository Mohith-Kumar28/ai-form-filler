import { GLYPH, getOverlayHost } from './host.js'
import { positionScheduler, type Rect } from './scheduler.js'

/**
 * "I'm keeping that" — said under the field, at the moment it happens.
 *
 * The learning loop is the whole product thesis: an answer the user typed themselves is the
 * highest-signal thing the system ever receives, and it goes back into what answers the next
 * form. It was also completely invisible. The correction was captured, sent, stored, and
 * retrieved with nothing anywhere saying so — so from the outside, working and broken looked
 * identical, and the only way to tell them apart was to fill another form days later and see
 * whether the answer came back. When it genuinely failed (a dead session, a batch rejected for
 * one over-length entry) the product simply looked like it had chosen not to learn.
 *
 * So this is not decoration. It is the receipt for the one interaction the product is built
 * around, and it distinguishes the three outcomes that actually differ:
 *
 *   - **learning** — in flight. Nothing is claimed yet.
 *   - **learned** — stored. Something new is now known.
 *   - **known** — reported, and already held. Not a failure, and not nothing: it is the system
 *     saying the answer is already the one it would give.
 *   - **failed** — it did not land. Said plainly, because a silent failure here is what the
 *     complaint was.
 *
 * Deliberately transient and non-interactive: it has no buttons, takes no focus, and leaves on
 * its own. A permanent badge on every corrected field would turn a form the user is working
 * through into a wall of receipts.
 */

export type LearningState = 'learning' | 'learned' | 'known' | 'failed'

/** How long a settled chip stays before it fades out. */
const HOLD_MS = 2400
/** Matches the fade in `host.ts`, so the node is removed after it has visually gone. */
const FADE_MS = 260
const GAP = 6

const COPY: Record<LearningState, { text: string; glyph: keyof typeof GLYPH }> = {
  learning: { text: 'Learning this…', glyph: 'sparkle' },
  learned: { text: "Got it — I'll remember", glyph: 'check' },
  // Not "nothing to learn": what it means to the user is that the tool already agrees with them.
  known: { text: 'Already knew that', glyph: 'check' },
  failed: { text: "Couldn't save that", glyph: 'close' },
}

export interface LearningNote {
  set: (state: LearningState) => void
  destroy: () => void
}

/**
 * One chip per field, replaced rather than stacked.
 *
 * A field can settle twice in quick succession — a typed edit, then Keep on the card — and two
 * chips at the same coordinates render as one smeared chip.
 */
const live = new Map<HTMLElement, LearningNote>()

/**
 * Mounts the chip under a field.
 *
 * Anchored below rather than above: above a field is its own label, which is the collision
 * `placeTab` exists to avoid, and the answer being confirmed is the thing directly above.
 */
export function mountLearningNote(element: HTMLElement, initial: LearningState): LearningNote {
  live.get(element)?.destroy()

  const { root } = getOverlayHost()
  const chip = document.createElement('div')
  chip.className = 'learn-chip'
  chip.setAttribute('role', 'status')
  // Polite: this is a background acknowledgement, never worth interrupting a screen reader.
  chip.setAttribute('aria-live', 'polite')
  root.appendChild(chip)

  let holdTimer: ReturnType<typeof setTimeout> | null = null
  let fadeTimer: ReturnType<typeof setTimeout> | null = null
  let destroyed = false

  const place = (rect: Rect, visible: boolean) => {
    chip.style.visibility = visible ? 'visible' : 'hidden'
    if (!visible) return

    /**
     * Below the field, aligned to its leading edge, and kept on screen.
     *
     * Written out rather than handed to `clampToViewport`, which prefers *above* its anchor and
     * would have to be tricked into the opposite by passing it the field's bottom edge as if it
     * were the whole field. Two lines of arithmetic beat one misused helper.
     */
    const top = Math.min(rect.top + rect.height + GAP, window.innerHeight - chip.offsetHeight - GAP)
    const left = Math.min(rect.left, window.innerWidth - chip.offsetWidth - GAP)

    chip.style.translate = `${Math.round(Math.max(0, left))}px ${Math.round(Math.max(0, top))}px`
  }

  const untrack = positionScheduler.track({
    element,
    onMove: place,
    // The page took the field away. There is nothing left to say it about.
    onDetach: () => note.destroy(),
  })

  const note: LearningNote = {
    set: (state) => {
      if (destroyed) return
      const { text, glyph } = COPY[state]
      chip.dataset.state = state
      chip.innerHTML = `${GLYPH[glyph]}<span>${text}</span>`

      if (holdTimer !== null) clearTimeout(holdTimer)
      if (fadeTimer !== null) clearTimeout(fadeTimer)

      // `learning` has no deadline of its own: the request it describes is what ends it.
      if (state === 'learning') return

      holdTimer = setTimeout(() => {
        chip.dataset.leaving = 'true'
        fadeTimer = setTimeout(() => note.destroy(), FADE_MS)
      }, HOLD_MS)
    },
    destroy: () => {
      if (destroyed) return
      destroyed = true
      if (holdTimer !== null) clearTimeout(holdTimer)
      if (fadeTimer !== null) clearTimeout(fadeTimer)
      untrack()
      chip.remove()
      if (live.get(element) === note) live.delete(element)
    },
  }

  live.set(element, note)
  note.set(initial)
  return note
}

/**
 * The whole gesture: show it, then resolve it from what the server actually recorded.
 *
 * Takes the promise rather than a finished outcome so the pending state is real — the chip
 * appears the moment the answer is sent, not after the round trip, which on a slow connection
 * is the difference between an acknowledgement and an epilogue.
 */
export function noteLearning(
  element: HTMLElement,
  work: Promise<{ ok: true; value: { recorded: number } } | { ok: false }>,
): void {
  const note = mountLearningNote(element, 'learning')
  void work.then(
    (result) => {
      if (!result.ok) return note.set('failed')
      return note.set(result.value.recorded > 0 ? 'learned' : 'known')
    },
    () => note.set('failed'),
  )
}

/** Test seam, and the teardown path for a page going away. */
export function clearLearningNotes(): void {
  for (const note of [...live.values()]) note.destroy()
}
