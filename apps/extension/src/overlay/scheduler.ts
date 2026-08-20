/**
 * Shared positioning scheduler for everything the overlay draws on the page.
 *
 * Grammarly's engineering write-up on this is worth reading before touching it: recomputing
 * overlay positions at 60fps consumes **over 90% of CPU on average hardware** on heavy sites.
 * The rules that keep this cheap:
 *
 *   1. **One** rAF loop for all targets. Never a per-target scroll listener — a form with
 *      50 fields would otherwise install 50 listeners that all fire on every scroll frame.
 *   2. `getBoundingClientRect()` only when the element's size or content changed. Scrolling
 *      does not change an element's size, so a scroll only translates the cached rect.
 *   3. Targets outside the viewport are culled and stop being measured at all.
 *   4. A ~1s poll as a correctness backstop, because there is no "layout changed" event and
 *      some changes (a sticky header collapsing, a font finishing loading) fire nothing.
 *
 * Reading a rect forces layout, so batching all reads into one frame — before any write —
 * is what stops this from thrashing.
 */

export interface Rect {
  top: number
  left: number
  width: number
  height: number
}

export interface PositionTarget {
  element: HTMLElement
  /** Called with viewport-relative coordinates whenever the position meaningfully changes. */
  onMove: (rect: Rect, visible: boolean) => void
  /**
   * The anchor left the document. Fired once, from the same check that stops tracking it.
   *
   * Without it a target is dropped silently, and anything mounted against it is left frozen at
   * its last position — a provenance tab still hovering over a question Workday replaced two
   * steps ago, pointing at nothing and impossible to dismiss.
   */
  onDetach?: () => void
}

interface TrackedTarget extends PositionTarget {
  lastRect: Rect | null
  visible: boolean
  /**
   * The visibility the target was last *told* about, which is not the same as `visible`.
   *
   * `visible` is what the observer and the geometry say; this is what the thing mounted on the
   * element currently believes. They diverge for exactly one frame — and the bug was that the
   * cull rule ran in between, so the divergence became permanent. See `measureAll`.
   */
  reported: boolean
  /** Size is what invalidates a cached rect; scroll offset alone does not. */
  lastWidth: number
  lastHeight: number
}

const POLL_INTERVAL_MS = 1000
/** Sub-pixel jitter from zoom or fractional layout is not worth a repaint. */
const MOVE_EPSILON = 0.5

class PositionScheduler {
  private targets = new Map<HTMLElement, TrackedTarget>()
  private frame: number | null = null
  private pollTimer: ReturnType<typeof setInterval> | null = null
  private observer: IntersectionObserver | null = null
  private resizeObserver: ResizeObserver | null = null
  private listening = false

  track(target: PositionTarget): () => void {
    this.targets.set(target.element, {
      ...target,
      lastRect: null,
      visible: false,
      reported: false,
      lastWidth: -1,
      lastHeight: -1,
    })

    this.observer?.observe(target.element)
    this.resizeObserver?.observe(target.element)
    this.ensureListening()
    this.requestMeasure()

    return () => this.untrack(target.element)
  }

  untrack(element: HTMLElement): void {
    this.targets.delete(element)
    this.observer?.unobserve(element)
    this.resizeObserver?.unobserve(element)
    if (this.targets.size === 0) this.stopListening()
  }

  clear(): void {
    for (const element of [...this.targets.keys()]) this.untrack(element)
  }

  /**
   * Throw away every cached rect and measure the whole set again.
   *
   * For a change that moves everything at once and reports nothing: the side panel opening or
   * closing, a zoom, a sticky header collapsing, a webfont landing. `requestMeasure` is not
   * enough on its own, and deliberately so — it honours the cull, so a target that is off
   * screen keeps its stale rect, and a target the observer has not spoken about since the
   * reflow keeps its stale visibility. Invalidation is the way to say "believe nothing".
   *
   * Costly by design, so it is called on events that are rare rather than on frames.
   */
  invalidate(): void {
    for (const tracked of this.targets.values()) {
      tracked.lastRect = null
      tracked.visible = true
    }
    this.requestMeasure()
  }

  /** Coalesces every caller in a frame into a single measure pass. */
  requestMeasure(): void {
    if (this.frame !== null) return
    this.frame = requestAnimationFrame(() => {
      this.frame = null
      this.measureAll()
    })
  }

  private measureAll(): void {
    // Phase 1 — read every rect with no interleaved writes. Interleaving read/write is what
    // turns one forced reflow into one per target.
    const measurements: { tracked: TrackedTarget; rect: Rect; visible: boolean }[] = []

    for (const tracked of this.targets.values()) {
      if (!tracked.element.isConnected) {
        this.untrack(tracked.element)
        // After untracking, so a handler that mounts something new cannot be handed a target
        // that is about to be swept.
        tracked.onDetach?.()
        continue
      }

      /**
       * A culled target is not measured at all — that is the point of culling. But it is told
       * it is hidden *first*, and that ordering is the whole fix.
       *
       * The cull used to run before anything was reported, so a target whose anchor left the
       * viewport was dropped while whatever was mounted on it still believed it was visible.
       * A mark is drawn at viewport coordinates and only ever moves when `onMove` says so, so
       * it froze exactly where it last was: a ring and a provenance tab still painted at the
       * position the field used to occupy, hovering over unrelated questions and pointing at
       * nothing. Opening or closing the side panel reflows the page and produced this every
       * time.
       */
      if (!tracked.visible && tracked.lastRect !== null) {
        if (tracked.reported) {
          tracked.reported = false
          tracked.onMove(tracked.lastRect, false)
        }
        continue
      }

      const box = tracked.element.getBoundingClientRect()
      const rect: Rect = {
        top: box.top,
        left: box.left,
        width: box.width,
        height: box.height,
      }

      const inViewport =
        box.bottom > 0 &&
        box.top < window.innerHeight &&
        box.right > 0 &&
        box.left < window.innerWidth

      /**
       * The first measurement seeds visibility from geometry; the observer only maintains it
       * afterwards.
       *
       * Without this, `visible` stayed `false` until an IntersectionObserver callback landed —
       * so the first `onMove` reported hidden and returned before writing a position, and the
       * cull rule above then skipped the target entirely. Anything mounted on an element the
       * observer had not yet spoken about sat unpositioned at the overlay origin, which is the
       * top-left corner of the page. Transient markers hid it; a seal anchored to the focused
       * field does not.
       */
      if (tracked.lastRect === null) tracked.visible = inViewport

      measurements.push({ tracked, rect, visible: tracked.visible && inViewport })
    }

    // Phase 2 — all the writes, after every read is done.
    for (const { tracked, rect, visible } of measurements) {
      const moved =
        tracked.lastRect === null ||
        Math.abs(tracked.lastRect.top - rect.top) > MOVE_EPSILON ||
        Math.abs(tracked.lastRect.left - rect.left) > MOVE_EPSILON ||
        Math.abs(tracked.lastRect.width - rect.width) > MOVE_EPSILON ||
        Math.abs(tracked.lastRect.height - rect.height) > MOVE_EPSILON

      /**
       * Against `reported`, not against `visible`.
       *
       * `visible` is one of the inputs to the value being tested, so comparing them asked
       * whether the observer agreed with the geometry — which is a different question, and on
       * a target the observer called visible while its rect sat off-screen it was true on
       * every single frame, reporting the same hidden state forever.
       */
      const visibilityChanged = tracked.lastRect !== null && visible !== tracked.reported

      if (moved || visibilityChanged) {
        tracked.lastRect = rect
        tracked.lastWidth = rect.width
        tracked.lastHeight = rect.height
        tracked.reported = visible
        tracked.onMove(rect, visible)
      }
    }
  }

  private handleScroll = (): void => this.requestMeasure()

  /**
   * A viewport change, which is not a scroll however similar it looks from here.
   *
   * The page relays out: centred content shifts sideways, wrapped text changes height, and
   * every tracked rect is wrong at once. Chrome's side panel opening or closing is exactly
   * this, and it was the reported symptom — marks left behind a few hundred pixels from the
   * fields they belonged to, because a plain re-measure skips the targets that were culled and
   * trusts the observer for the rest.
   */
  private handleViewportChange = (): void => this.invalidate()

  private ensureListening(): void {
    if (this.listening) return
    this.listening = true

    // `capture: true` catches scrolls on any ancestor container, not just the window —
    // a field inside a scrollable modal moves without the window scrolling at all.
    window.addEventListener('scroll', this.handleScroll, { passive: true, capture: true })
    window.addEventListener('resize', this.handleViewportChange, { passive: true })

    /**
     * `visualViewport` as well as `window`, because they report different things.
     *
     * A pinch-zoom or a mobile keyboard changes the visual viewport without firing a window
     * resize at all, and on desktop the two fire at slightly different moments during a panel
     * animation — so listening to both is what makes the final position correct rather than
     * merely eventually correct.
     */
    window.visualViewport?.addEventListener('resize', this.handleViewportChange)

    this.observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const tracked = this.targets.get(entry.target as HTMLElement)
          if (!tracked) continue
          tracked.visible = entry.isIntersecting
          // A target entering the viewport has a stale cached rect; force a re-measure.
          if (entry.isIntersecting) tracked.lastRect = null
        }
        this.requestMeasure()
      },
      { threshold: 0 },
    )

    // Catches size changes that produce no scroll or resize event — a textarea growing as
    // text is typed into it, or a validation message appearing beneath a field.
    this.resizeObserver = new ResizeObserver(() => this.requestMeasure())

    for (const element of this.targets.keys()) {
      this.observer.observe(element)
      this.resizeObserver.observe(element)
    }

    // The backstop. There is no "layout changed" event, so some movement is only ever
    // discovered by looking.
    this.pollTimer = setInterval(() => this.requestMeasure(), POLL_INTERVAL_MS)
  }

  private stopListening(): void {
    if (!this.listening) return
    this.listening = false

    window.removeEventListener('scroll', this.handleScroll, { capture: true })
    window.removeEventListener('resize', this.handleViewportChange)
    window.visualViewport?.removeEventListener('resize', this.handleViewportChange)

    this.observer?.disconnect()
    this.observer = null
    this.resizeObserver?.disconnect()
    this.resizeObserver = null

    if (this.pollTimer !== null) {
      clearInterval(this.pollTimer)
      this.pollTimer = null
    }

    if (this.frame !== null) {
      cancelAnimationFrame(this.frame)
      this.frame = null
    }
  }

  /** Test seam: how many targets are currently tracked. */
  get size(): number {
    return this.targets.size
  }
}

export const positionScheduler = new PositionScheduler()

/**
 * Clamps a rect to the viewport so an anchored element never renders off-screen.
 * Pure, so it is unit-testable without a layout engine.
 */
export function clampToViewport(
  rect: Rect,
  size: { width: number; height: number },
  viewport: { width: number; height: number },
  margin = 8,
): { top: number; left: number } {
  const left = Math.min(
    Math.max(margin, rect.left + rect.width - size.width),
    viewport.width - size.width - margin,
  )

  // Prefer above the element; drop below when there is no room up there.
  const above = rect.top - size.height - margin
  const below = rect.top + rect.height + margin
  const top = above >= margin ? above : Math.min(below, viewport.height - size.height - margin)

  return { top: Math.max(margin, top), left: Math.max(margin, left) }
}

/**
 * The nearest ancestor that clips its content, as a viewport rect.
 *
 * Anything anchored *above* a field has to know about this. A question inside a scrolling
 * modal or an accordion pane can have its top edge scrolled out of the container while the
 * field itself is still perfectly visible — and a label drawn 22px above it then floats over
 * whatever the container happens to be showing there, attached to nothing.
 *
 * Returns null when nothing clips, which is the common case and means "no constraint".
 */
export function nearestClipRect(element: HTMLElement): Rect | null {
  let parent = element.parentElement

  while (parent && parent !== document.body && parent !== document.documentElement) {
    const style = getComputedStyle(parent)
    if (
      style.overflow !== 'visible' ||
      style.overflowY !== 'visible' ||
      style.overflowX !== 'visible'
    ) {
      const box = parent.getBoundingClientRect()
      // A zero-sized container clips nothing meaningful and is usually a layout wrapper.
      if (box.height > 0 && box.width > 0) {
        return { top: box.top, left: box.left, width: box.width, height: box.height }
      }
    }
    parent = parent.parentElement
  }

  return null
}
