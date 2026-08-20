import { GLYPH, getOverlayHost } from './host.js'
import { nearestClipRect, positionScheduler, type Rect } from './scheduler.js'

/**
 * What happened to a field, drawn over it rather than on it.
 *
 * Overlaid because writing to the page's own elements fights the site's styles, and any
 * leftover style on teardown is a visible bug on someone else's page.
 *
 *   active    being written right now — accent ring
 *   stated    came from what the user told us — green, settles, then leaves nothing
 *   judged    the tool concluded this — accent hairline ring plus a provenance tab
 *   failed    the page refused the value — coral briefly, then leaves
 *
 * ### The Unmarked Fact Rule
 *
 * A stated answer ends up with **no mark at all**. The absence is the notation: the whole point
 * of the distinction is that a fact needs nothing from the user, so the interface asks for
 * nothing. Marking stated answers too would flatten the only contrast that matters.
 *
 * ### The tab is a label, not a chore
 *
 * `judged` used to carry a solid pill reading "NEEDS A LOOK" with a tick and a cross in it. Two
 * problems, and the visual one was the smaller: six of them on a form reads as six errors, when
 * in fact nothing is wrong — the tool is disclosing which answers it inferred. And a tick and a
 * cross cannot express *edit this* or *rewrite this*, so every real correction had to be made
 * somewhere else entirely.
 *
 * So the tab says what is true about the answer ("I guessed" / "not sure"), and opens the one
 * place where anything can be done about it. Doing nothing remains a legitimate outcome.
 */

export type MarkState = 'active' | 'stated' | 'judged' | 'failed'

/** Why a field is judged, which is the only thing the tab's wording depends on. */
export type JudgedReason = 'inferred' | 'unsure'

export interface FieldMarkOptions {
  reason?: JudgedReason
  /** The label, and the cross: open the card and do something about the answer. */
  onOpen?: () => void
  /**
   * The tick: this answer is fine, with no card and no reading.
   *
   * The tab used to be open-the-card or nothing, so clearing eight guessed answers meant eight
   * rounds of open, read, Keep, close — for answers most of which are right. Approving one is
   * now one tap on the thing already pointing at it, and rejecting one still opens the card,
   * because "this is wrong" is the case that needs the editor.
   */
  onAccept?: () => void
  /**
   * The page threw the field away, and this mark is now gone with it.
   *
   * The owner needs telling rather than inferring it later: a handle left in the caller's map
   * still answers `setState` and `flash` from a review row or a panel message, and acting on a
   * mark whose element no longer exists is how a ring ends up drawn over an unrelated question.
   */
  onDetach?: () => void
}

export interface FieldMark {
  setState: (state: MarkState) => void
  flash: () => void
  /** Where the tab is, for anchoring a card to it rather than to a 600px textarea. */
  tabRect: () => Rect | null
  destroy: () => void
}

/** Tab geometry. Exported so the placement tests read the same numbers the code does. */
export const TAB_HEIGHT = 24
/** Clearance between the tab's bottom edge and the field's top border. */
export const TAB_GAP = 4
/** Minimum breathing room against the viewport edges. */
export const TAB_MARGIN = 6

export interface TabPlacement {
  top: number
  left: number
  place: 'beside' | 'above' | 'below' | 'pinned'
  visible: boolean
}

/**
 * Where the provenance tab goes.
 *
 * Pure, and exported, because this is the function that had the bug. The old version was one
 * expression inlined into a style write:
 *
 * ```ts
 * pill.style.translate = `calc(${box.left + box.width - 8}px - 100%) ${box.top - 8}px`
 * ```
 *
 * The `- 100%` applies to the **x** axis only. Vertically the pill was placed at `top - 8` and
 * was 24px tall, so sixteen of its pixels sat *inside* the field, over the first line of the
 * user's own text. Nothing about that expression made the mistake visible, and nothing could
 * fail because of it.
 *
 * ### Why "above the border" was not the whole answer
 *
 * Getting the label out of the input was the reported fix, and it took looking at a real form to
 * see that it only moved the collision. A field's own `<label>` sits directly above it, so the
 * strip above the border is not empty — it belongs to the question. Left-aligned, the tab covered
 * "Salary expec▓▓▓▓▓"; right-aligned it covered "How did you hear ▓▓▓ role?", because a narrow
 * input is often *narrower* than its own label. Covering the question is the same defect as
 * covering the answer, one line up.
 *
 * So the first choice is the **gutter beside the field**, level with its top edge: outside the
 * input, and off the label's line entirely. Forms lay a field out in a column, so on a narrow
 * field — exactly the case where the label overhangs — that space is reliably empty. A
 * full-width field has no gutter and falls back to above-the-border, which is safe there for the
 * complementary reason: a field spanning the column is almost always wider than its own label.
 */
export function placeTab(
  box: Rect,
  tab: { width: number; height: number },
  viewport: { width: number; height: number },
  clip: Rect | null,
): TabPlacement {
  const rightLimit = Math.min(
    viewport.width - TAB_MARGIN,
    clip === null ? Number.POSITIVE_INFINITY : clip.left + clip.width,
  )

  const fitsVertically = (top: number) =>
    top >= TAB_MARGIN &&
    top + tab.height <= viewport.height - TAB_MARGIN &&
    (clip === null || (top >= clip.top && top + tab.height <= clip.top + clip.height))

  /**
   * Beside the field, level with its top edge. The first choice — see the note above.
   *
   * `box.top` rather than a vertical centring, so a tall textarea's tab stays up beside the
   * question it answers instead of drifting to the middle of a 600px box.
   */
  const beside = box.left + box.width + TAB_GAP
  if (beside + tab.width <= rightLimit && fitsVertically(box.top)) {
    return { top: box.top, left: beside, place: 'beside', visible: true }
  }

  /** Right-aligned to the field, because labels start on the left. */
  const left = Math.min(
    Math.max(TAB_MARGIN, box.left + box.width - tab.width),
    Math.max(TAB_MARGIN, viewport.width - tab.width - TAB_MARGIN),
  )

  const above = box.top - tab.height - TAB_GAP
  const below = box.top + box.height + TAB_GAP

  /**
   * Pinned to the top of the viewport, and checked **before** `below`.
   *
   * For a tall field whose top has scrolled away while most of it is still on screen — a 600px
   * cover letter. Ordering matters: `below` also fits in that situation, and would park the
   * label at the very bottom of the textarea, hundreds of pixels from the question it names, at
   * exactly the moment the user is reading the answer.
   *
   * The `bottom > 80` floor is what stops an ordinary field at the top of the page from pinning:
   * there, flipping below is both correct and closer.
   */
  const topIsAway = box.top < TAB_MARGIN || (clip !== null && box.top < clip.top)
  if (topIsAway && box.top + box.height > 80 && fitsVertically(TAB_MARGIN)) {
    return { top: TAB_MARGIN, left, place: 'pinned', visible: true }
  }

  if (fitsVertically(above)) return { top: above, left, place: 'above', visible: true }
  if (fitsVertically(below)) return { top: below, left, place: 'below', visible: true }

  /**
   * Nowhere honest to put it.
   *
   * Drawing it anyway would float the label over unrelated content while still claiming to
   * describe a field that is not on screen.
   */
  return { top: above, left, place: 'above', visible: false }
}

/** The two words a tab shows, and what each one actually means. */
const TAB_LABEL: Record<JudgedReason, string> = {
  // A judgement call: concluded from what the person said elsewhere, not read off it.
  inferred: 'I guessed',
  // A stated fact we are not confident we read correctly.
  unsure: 'not sure',
}

export function mountFieldMark(element: HTMLElement, options: FieldMarkOptions = {}): FieldMark {
  const { root } = getOverlayHost()

  const mark = document.createElement('div')
  mark.className = 'mark'
  root.appendChild(mark)

  let tab: HTMLElement | null = null
  let box: Rect | null = null
  let placed: TabPlacement | null = null
  let clip = nearestClipRect(element)
  /**
   * Set once the anchor is gone, and checked by everything that could draw.
   *
   * Not merely tidiness. `destroy` used to be the only way a mark ended, so a detached mark
   * kept its ring — frozen at the last coordinates its field ever had — and, worse, was still
   * willing to grow a *new* tab: the fill animation calls `setState('judged')` when a field
   * finishes, and if the page had replaced that field in the meantime, `ensureTab` placed a
   * fresh label against the stale `box`. That is the pink ring and "I guessed" tab seen
   * floating between two questions, attached to nothing and impossible to dismiss.
   */
  let dead = false

  const placeTheTab = () => {
    if (!tab || !box) return
    const next = placeTab(
      box,
      { width: tab.offsetWidth, height: TAB_HEIGHT },
      { width: window.innerWidth, height: window.innerHeight },
      clip,
    )
    placed = next
    tab.style.translate = `${Math.round(next.left)}px ${Math.round(next.top)}px`
    tab.dataset.place = next.place
    tab.style.visibility = next.visible ? 'visible' : 'hidden'
  }

  const untrack = positionScheduler.track({
    element,
    onMove: (rect, visible) => {
      if (dead) return
      box = rect
      mark.style.visibility = visible ? 'visible' : 'hidden'
      if (tab) tab.style.visibility = visible ? 'visible' : 'hidden'
      if (!visible) return
      mark.style.translate = `${Math.round(rect.left)}px ${Math.round(rect.top)}px`
      mark.style.width = `${Math.round(rect.width)}px`
      mark.style.height = `${Math.round(rect.height)}px`
      // Re-read on move: a container can be scrolled into or out of clipping the anchor.
      clip = nearestClipRect(element)
      placeTheTab()
    },
    /**
     * The page replaced the question. The whole mark goes, not just its label.
     *
     * Removing only the tab left the ring behind, still painted where the field used to be —
     * the same defect one element down, and the more visible of the two.
     */
    onDetach: () => {
      dead = true
      removeTab()
      mark.remove()
      options.onDetach?.()
    },
  })

  const ensureTab = () => {
    if (dead || !options.onOpen) return
    if (!tab) {
      const reason = options.reason ?? 'unsure'

      /*
        A group, not a button, because it now holds three of them — and `.answer-tab` stays the
        outer class so placement, the `data-place` geometry and everything that counts tabs are
        untouched.
      */
      const group = document.createElement('div')
      group.className = 'answer-tab'
      group.dataset.reason = reason
      group.setAttribute('role', 'group')
      group.setAttribute('aria-label', `${TAB_LABEL[reason]} — check this answer`)

      const open = document.createElement('button')
      open.type = 'button'
      open.className = 'answer-tab-open'
      open.innerHTML = `${GLYPH.sparkle}<span>${TAB_LABEL[reason]}</span>`
      open.setAttribute('aria-label', 'Read this answer')
      open.addEventListener('click', (event) => {
        event.preventDefault()
        event.stopPropagation()
        options.onOpen?.()
      })
      group.appendChild(open)

      if (options.onAccept) {
        const yes = document.createElement('button')
        yes.type = 'button'
        yes.className = 'answer-tab-act answer-tab-yes'
        yes.innerHTML = GLYPH.check
        yes.setAttribute('aria-label', 'This is right — keep it')
        yes.setAttribute('title', 'Looks right')
        yes.addEventListener('click', (event) => {
          event.preventDefault()
          event.stopPropagation()
          options.onAccept?.()
        })
        group.appendChild(yes)
      }

      const no = document.createElement('button')
      no.type = 'button'
      no.className = 'answer-tab-act answer-tab-no'
      no.innerHTML = GLYPH.close
      no.setAttribute('aria-label', 'This is wrong — change it')
      no.setAttribute('title', 'Change it')
      // Rejecting opens the editor: saying an answer is wrong is not the same as being done
      // with it, and the person still needs somewhere to put the right one.
      no.addEventListener('click', (event) => {
        event.preventDefault()
        event.stopPropagation()
        options.onOpen?.()
      })
      group.appendChild(no)

      tab = group
      root.appendChild(group)
    }
    placeTheTab()
  }

  const removeTab = () => {
    tab?.remove()
    tab = null
    placed = null
  }

  return {
    setState: (state) => {
      if (dead) return
      mark.setAttribute('data-state', state)
      if (state === 'judged') ensureTab()
      else removeTab()
    },
    flash: () => {
      if (dead) return
      const rect = element.getBoundingClientRect()
      const offscreen = rect.bottom < 8 || rect.top > window.innerHeight - 8
      if (offscreen) element.scrollIntoView({ block: 'center', behavior: 'smooth' })

      mark.removeAttribute('data-flash')
      void mark.offsetWidth
      mark.setAttribute('data-flash', 'true')
    },
    tabRect: () =>
      !dead && tab && placed
        ? { top: placed.top, left: placed.left, width: tab.offsetWidth, height: TAB_HEIGHT }
        : null,
    destroy: () => {
      dead = true
      untrack()
      removeTab()
      mark.remove()
    },
  }
}
