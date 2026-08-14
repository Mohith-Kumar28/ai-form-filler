import { prefersReducedMotion } from './host.js'

/**
 * The fill animation.
 *
 * Fields fill on a stagger rather than all at once. That sequencing is the entire difference
 * between something that reads as "the form is being filled in for me" and something that
 * reads as a page glitch — a form whose every field changes in the same frame looks like a
 * bug, however correct the values are.
 *
 * Web Animations API, no library: this runs inside a content script on someone else's page,
 * where every kilobyte is a tax on their load.
 */

/** Per character. Fast enough not to feel slow, slow enough to read as typing. */
const TYPE_MS_PER_CHAR = 25
/** A 2,000-character cover letter must not take 50 seconds to appear. */
const MAX_TYPE_MS = 400
/** Gap between fields. Long enough to follow, short enough that 20 fields stay brisk. */
const STAGGER_MS = 70
const REDUCED_MOTION_MS = 150

export interface AnimatedFill {
  fieldId: string
  element: HTMLElement
  value: string
  /** Below the review threshold the field settles amber instead of green. */
  needsReview: boolean
  /**
   * Writes the value into the page; false if the element rejected it.
   *
   * Allowed to be async because some adapters must wait on the page — a `react-select`
   * needs its menu to open before an option can be clicked, and Workday re-renders between
   * steps. The generic adapter is synchronous; awaiting a non-promise is free.
   */
  apply: () => boolean | Promise<boolean>
}

export interface AnimationHooks {
  onFieldStart?: (fieldId: string) => void
  onFieldEnd?: (fieldId: string, applied: boolean) => void
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Whether a field can show text arriving progressively. Selects and checkboxes cannot. */
function isTypeable(element: HTMLElement): element is HTMLInputElement | HTMLTextAreaElement {
  if (element instanceof HTMLTextAreaElement) return true
  if (!(element instanceof HTMLInputElement)) return false
  return !['checkbox', 'radio', 'file', 'date', 'number'].includes(element.type)
}

/**
 * Types a value in progressively using the same native-setter technique as a direct write,
 * so React-controlled inputs accept each intermediate value rather than reverting.
 *
 * Chunked by characters-per-frame rather than one character per timer: at 25ms a long value
 * would otherwise queue hundreds of timers, and the cap means most of them would be
 * cancelled anyway.
 */
async function typeInto(value: string, write: (partial: string) => void): Promise<void> {
  const duration = Math.min(value.length * TYPE_MS_PER_CHAR, MAX_TYPE_MS)
  const frames = Math.max(1, Math.round(duration / 16))
  const charsPerFrame = Math.ceil(value.length / frames)

  for (let index = charsPerFrame; index < value.length; index += charsPerFrame) {
    write(value.slice(0, index))
    await sleep(16)
  }

  write(value)
}

/**
 * Runs the fill sequence.
 *
 * Under `prefers-reduced-motion` every value is written immediately with no stagger and no
 * typing — the OS-level request is honoured completely, not merely shortened.
 */
export async function runFillAnimation(
  fills: AnimatedFill[],
  hooks: AnimationHooks = {},
): Promise<{ applied: string[]; failed: string[] }> {
  const applied: string[] = []
  const failed: string[] = []
  const reduced = prefersReducedMotion()

  // DOM order, not plan order: the eye follows down the page, and a model that answered the
  // last field first would otherwise make the sequence jump around.
  const ordered = [...fills].sort((a, b) => {
    const relation = a.element.compareDocumentPosition(b.element)
    return relation & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1
  })

  for (const fill of ordered) {
    if (!fill.element.isConnected) {
      failed.push(fill.fieldId)
      continue
    }

    hooks.onFieldStart?.(fill.fieldId)

    // Scroll the field into view only when it is off-screen, and only in reduced steps —
    // yanking the viewport on every field would be unusable on a long form.
    const box = fill.element.getBoundingClientRect()
    if (box.top < 0 || box.bottom > window.innerHeight) {
      fill.element.scrollIntoView({
        block: 'center',
        behavior: reduced ? 'auto' : 'smooth',
      })
      if (!reduced) await sleep(120)
    }

    let ok = false
    try {
      if (!reduced && isTypeable(fill.element) && fill.value.length > 0) {
        // Typing writes the value repeatedly; the final `apply()` is what fires the
        // change/blur events the page's validation listens for.
        await typeInto(fill.value, (partial) => {
          const setter = Object.getOwnPropertyDescriptor(
            Object.getPrototypeOf(fill.element),
            'value',
          )?.set
          setter?.call(fill.element, partial)
          fill.element.dispatchEvent(new Event('input', { bubbles: true }))
        })
      }
      ok = await fill.apply()
    } catch {
      // A page listener throwing on one field must not abort the rest of the form.
      ok = false
    }

    if (ok) applied.push(fill.fieldId)
    else failed.push(fill.fieldId)

    hooks.onFieldEnd?.(fill.fieldId, ok)

    if (!reduced) await sleep(STAGGER_MS)
  }

  if (reduced) await sleep(REDUCED_MOTION_MS)
  return { applied, failed }
}

export const ANIMATION_TIMINGS = {
  TYPE_MS_PER_CHAR,
  MAX_TYPE_MS,
  STAGGER_MS,
  REDUCED_MOTION_MS,
} as const
