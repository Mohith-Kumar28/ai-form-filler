import { GLYPH, getOverlayHost } from './host.js'
import { positionScheduler } from './scheduler.js'

/**
 * What happened to a field, drawn over it rather than on it.
 *
 * Overlaid because writing to the page's own elements fights the site's styles, and any
 * leftover style on teardown is a visible bug on someone else's page.
 *
 *   filled    came from the user's own info — green briefly, then leaves
 *   aiWrote   the AI wrote it — pink, persists, with a "check" pill
 *   active    being written right now — pink ring
 *   failed    the page refused the value — coral briefly, then leaves
 */

export type MarkState = 'active' | 'filled' | 'aiWrote' | 'failed'

export interface FieldMark {
  setState: (state: MarkState) => void
  flash: () => void
  destroy: () => void
}

export function mountFieldMark(element: HTMLElement, onReview?: () => void): FieldMark {
  const { root } = getOverlayHost()

  const mark = document.createElement('div')
  mark.className = 'mark'
  root.appendChild(mark)

  /** The "check" pill on AI-written fields — the only clickable part of the mark. */
  let pill: HTMLElement | null = null
  let box: { top: number; left: number; width: number; height: number } | null = null

  const placePill = () => {
    if (!pill || !box) return
    pill.style.translate = `calc(${Math.round(box.left + box.width - 8)}px - 100%) ${Math.round(box.top - 8)}px`
  }

  const untrack = positionScheduler.track({
    element,
    onMove: (rect, visible) => {
      box = rect
      mark.style.visibility = visible ? 'visible' : 'hidden'
      if (pill) pill.style.visibility = visible ? 'visible' : 'hidden'
      if (!visible) return
      mark.style.translate = `${Math.round(rect.left)}px ${Math.round(rect.top)}px`
      mark.style.width = `${Math.round(rect.width)}px`
      mark.style.height = `${Math.round(rect.height)}px`
      placePill()
    },
  })

  const ensurePill = () => {
    if (!onReview) return
    if (!pill) {
      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'check-pill'
      button.innerHTML = `${GLYPH.sparkle}<span>needs a look</span>`
      button.addEventListener('click', (event) => {
        event.preventDefault()
        event.stopPropagation()
        onReview()
      })
      pill = button
      root.appendChild(button)
    }
    placePill()
  }

  const removePill = () => {
    pill?.remove()
    pill = null
  }

  return {
    setState: (state) => {
      mark.setAttribute('data-state', state)
      if (state === 'aiWrote') ensurePill()
      else removePill()
    },
    flash: () => {
      const rect = element.getBoundingClientRect()
      const offscreen = rect.bottom < 8 || rect.top > window.innerHeight - 8
      if (offscreen) element.scrollIntoView({ block: 'center', behavior: 'smooth' })

      mark.removeAttribute('data-flash')
      void mark.offsetWidth
      mark.setAttribute('data-flash', 'true')
    },
    destroy: () => {
      untrack()
      removePill()
      mark.remove()
    },
  }
}
