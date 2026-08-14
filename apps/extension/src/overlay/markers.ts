import { GLYPH, getOverlayHost } from './host.js'
import { positionScheduler } from './scheduler.js'

/**
 * What happened to a field, drawn over it rather than on it.
 *
 * Overlaid because writing to the page's own elements fights the site's styles, and any
 * leftover style on teardown is a visible bug on someone else's page.
 *
 * The states are the document's, not a traffic light:
 *
 *   printed   read straight off what you told it — confirms briefly, then leaves
 *   endorsed  concluded rather than read — **persists**, and carries a clickable tab
 *   unsure    answered below the confidence threshold — persists, in the second ink
 *   failed    the page refused the value — confirms briefly, then leaves
 *
 * The persistence is the point. Auto-filled text that becomes indistinguishable from typed
 * text is how a confident wrong answer reaches a submit button, and the previous markers faded
 * after 1.6 seconds whatever they were marking.
 */

export type MarkState = 'active' | 'printed' | 'endorsed' | 'unsure' | 'failed'

export interface FieldMark {
  setState: (state: MarkState) => void
  /** Pulses the outline and scrolls the field into view, from a hovered review row. */
  flash: () => void
  destroy: () => void
}

const PERSISTENT: MarkState[] = ['endorsed', 'unsure']

export function mountFieldMark(element: HTMLElement, onReview?: () => void): FieldMark {
  const { root } = getOverlayHost()

  const mark = document.createElement('div')
  mark.className = 'mark'
  root.appendChild(mark)

  /**
   * The tab is the only part that takes a pointer.
   *
   * The outline itself stays `pointer-events: none`, so clicking where the field is still
   * lands on the field. A clickable box over someone's input would make the form unusable in
   * exactly the place we claim to be helping.
   */
  let tab: HTMLElement | null = null
  let box: { top: number; left: number; width: number; height: number } | null = null

  const placeTab = () => {
    if (!tab || !box) return
    // `translate`, not `transform`: the stamp keyframes own `rotate` and `scale`, and a
    // keyframe animating `transform` with fill-mode `both` would overwrite this placement.
    // The `-100%` is self-relative, which the standalone property resolves the same way.
    tab.style.translate = `calc(${Math.round(box.left + box.width - 8)}px - 100%) ${Math.round(
      box.top - 8,
    )}px`
  }

  const untrack = positionScheduler.track({
    element,
    onMove: (rect, visible) => {
      box = rect
      mark.style.visibility = visible ? 'visible' : 'hidden'
      if (tab) tab.style.visibility = visible ? 'visible' : 'hidden'
      if (!visible) return
      mark.style.translate = `${Math.round(rect.left)}px ${Math.round(rect.top)}px`
      mark.style.width = `${Math.round(rect.width)}px`
      mark.style.height = `${Math.round(rect.height)}px`
      placeTab()
    },
  })

  const ensureTab = (kind: 'endorsed' | 'unsure') => {
    if (!onReview) return
    if (!tab) {
      const button = document.createElement('button')
      button.type = 'button'
      tab = button
      tab.className = 'tab'
      tab.addEventListener('click', (event) => {
        event.preventDefault()
        event.stopPropagation()
        onReview()
      })
      root.appendChild(tab)
    }
    tab.dataset.kind = kind === 'unsure' ? 'unsure' : 'endorsed'
    tab.innerHTML = `${GLYPH.stamp}<span>${kind === 'unsure' ? 'Check' : 'Guessed'}</span>`
    tab.setAttribute(
      'aria-label',
      kind === 'unsure' ? 'Check this answer' : 'Review a concluded answer',
    )
    placeTab()
  }

  const removeTab = () => {
    tab?.remove()
    tab = null
  }

  return {
    setState: (state) => {
      mark.setAttribute('data-state', state)
      if (PERSISTENT.includes(state)) ensureTab(state as 'endorsed' | 'unsure')
      else removeTab()
    },
    /**
     * Pulse the outline, and scroll only if the field is genuinely out of sight.
     *
     * This used to scroll unconditionally, on every highlight message. With two marked fields
     * — one near the top of a long form, one near the bottom — the page walked between them
     * indefinitely: each smooth scroll moved the pointer over a different row in the panel,
     * which highlighted the other field, which scrolled back. Scrolling a page that is already
     * showing the thing you are pointing at is never the right answer anyway.
     */
    flash: () => {
      const box = element.getBoundingClientRect()
      const offscreen = box.bottom < 8 || box.top > window.innerHeight - 8
      if (offscreen) element.scrollIntoView({ block: 'center', behavior: 'smooth' })

      mark.removeAttribute('data-flash')
      // Reading offsetWidth restarts the animation; without it a second hover on the same row
      // does nothing at all.
      void mark.offsetWidth
      mark.setAttribute('data-flash', 'true')
    },
    destroy: () => {
      untrack()
      removeTab()
      mark.remove()
    },
  }
}
