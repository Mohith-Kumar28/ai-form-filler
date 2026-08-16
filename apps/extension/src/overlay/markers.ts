import { GLYPH, getOverlayHost } from './host.js'
import { positionScheduler } from './scheduler.js'

/**
 * What happened to a field, drawn over it rather than on it.
 *
 * Overlaid because writing to the page's own elements fights the site's styles, and any
 * leftover style on teardown is a visible bug on someone else's page.
 *
 *   filled    came from the user's own info — green briefly, then leaves
 *   aiWrote   the AI wrote it — pink, persists, with a "needs a look" pill that has ✓ and ✕
 *   active    being written right now — pink ring
 *   failed    the page refused the value — coral briefly, then leaves
 */

export type MarkState = 'active' | 'filled' | 'aiWrote' | 'failed'

export interface FieldMark {
  setState: (state: MarkState) => void
  flash: () => void
  destroy: () => void
}

export function mountFieldMark(
  element: HTMLElement,
  onAccept?: () => void,
  onReject?: () => void,
): FieldMark {
  const { root } = getOverlayHost()

  const mark = document.createElement('div')
  mark.className = 'mark'
  root.appendChild(mark)

  /** The "needs a look" pill — a container with ✓ and ✕ so the popup is not needed. */
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
    if (!onAccept && !onReject) return
    if (!pill) {
      const container = document.createElement('div')
      container.className = 'check-pill'

      const label = document.createElement('span')
      label.className = 'check-pill-label'
      label.innerHTML = `${GLYPH.sparkle}<span>needs a look</span>`
      container.appendChild(label)

      if (onAccept) {
        const accept = document.createElement('button')
        accept.type = 'button'
        accept.className = 'check-pill-accept'
        accept.setAttribute('aria-label', 'Keep this answer')
        accept.innerHTML = GLYPH.check
        accept.addEventListener('click', (event) => {
          event.preventDefault()
          event.stopPropagation()
          onAccept()
        })
        container.appendChild(accept)
      }

      if (onReject) {
        const reject = document.createElement('button')
        reject.type = 'button'
        reject.className = 'check-pill-reject'
        reject.setAttribute('aria-label', 'Clear this answer')
        reject.innerHTML = GLYPH.close
        reject.addEventListener('click', (event) => {
          event.preventDefault()
          event.stopPropagation()
          onReject()
        })
        container.appendChild(reject)
      }

      pill = container
      root.appendChild(container)
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
