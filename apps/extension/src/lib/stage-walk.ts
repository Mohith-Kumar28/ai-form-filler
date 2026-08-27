/**
 * Paces the *display* of fill stages, so each one that happens is actually seen.
 *
 * The pipeline reports four stages and two of them are effectively instant: finding the form is
 * a DOM query and reading the page is a walk of it, both done inside a few milliseconds. The
 * model call that follows takes ten to twenty seconds. So the progress list, which was correct,
 * looked broken — it appeared already sitting on step three, and a user watching it never saw
 * steps one and two happen at all. Two thirds of the work the extension does was invisible.
 *
 * This does not slow the fill down and it does not invent anything. Two rules:
 *
 *   1. **Only reported stages are shown.** It is a queue, not a script. A single-field refill
 *      skips the page read and therefore never reports it, so it is never displayed — the
 *      alternative, walking a fixed list of stage names, would claim a step that did not run.
 *   2. **The floor is on the display, never on the work.** The fill proceeds at full speed; the
 *      only thing held back is how fast the label is allowed to change. The lag it adds is
 *      bounded by one floor per fast stage — under a second — against a call that takes twenty.
 *
 * Shared by the side panel's step list and the page launcher's rail rather than implemented
 * twice, because two copies of the pacing policy would drift and the two surfaces sit side by
 * side on screen while a fill runs. A visible disagreement between them is worse than either
 * pacing alone.
 */

/**
 * The stages, in the order the pipeline reports them.
 *
 * Declared here rather than in each consumer so the panel's list, its index maths, and the
 * launcher's messages cannot disagree about what comes after what. The names match
 * `FillPortEvent['stage']` in `@aff/shared`.
 */
export const FILL_STAGES = ['detecting', 'reading', 'generating', 'applying'] as const

export type FillStage = (typeof FILL_STAGES)[number]

/**
 * How long a stage holds the display before the next one may take it.
 *
 * Long enough to read three words and register a tick landing; short enough that four stages
 * cost well under two seconds even in the worst case, and the worst case never happens because
 * `generating` outlasts its own floor by an order of magnitude. Below about 300ms a step reads
 * as a flicker rather than as a step, which is the failure this exists to fix.
 */
export const STAGE_FLOOR_MS = 460

/** Position in `FILL_STAGES`, or `-1` for anything unrecognised. */
export function stageIndex(stage: string | undefined): number {
  return FILL_STAGES.indexOf(stage as FillStage)
}

export interface StageWalk {
  /** The pipeline reached this stage. Displayed now, or as soon as the floor allows. */
  report: (stage: string) => void
  /** Stop pacing and show the last reported stage immediately. For the end of a fill. */
  drain: () => void
  /** Cancel any pending step. Safe to call twice. */
  stop: () => void
}

/**
 * @param show Called with each stage as it becomes the displayed one. Never called twice in a
 *   row with the same stage, so a consumer may restart an animation on every call.
 */
export function createStageWalk(
  show: (stage: string) => void,
  floorMs: number = STAGE_FLOOR_MS,
): StageWalk {
  const queue: string[] = []
  let shown: string | null = null
  let timer: ReturnType<typeof setTimeout> | null = null

  /**
   * Takes the next stage if the floor has expired, then holds the floor open again.
   *
   * The timer is armed on *display* rather than on arrival, which is what makes the floor a
   * minimum dwell rather than a delay: a stage reported after the floor has already expired is
   * shown on the spot, with no wait at all.
   */
  const pump = () => {
    if (timer !== null) return
    const next = queue.shift()
    if (next === undefined) return

    shown = next
    show(next)
    timer = setTimeout(() => {
      timer = null
      pump()
    }, floorMs)
  }

  return {
    report: (stage) => {
      // Progress events repeat the stage on every field, and `applying` repeats it per answer.
      const last = queue.length > 0 ? queue[queue.length - 1] : shown
      if (stage === last) return
      queue.push(stage)
      pump()
    },

    drain: () => {
      if (timer !== null) {
        clearTimeout(timer)
        timer = null
      }
      const last = queue.pop()
      queue.length = 0
      if (last !== undefined && last !== shown) {
        shown = last
        show(last)
      }
    },

    stop: () => {
      if (timer !== null) {
        clearTimeout(timer)
        timer = null
      }
      queue.length = 0
    },
  }
}
