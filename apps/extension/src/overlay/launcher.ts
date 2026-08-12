import { getOverlayHost } from './host.js'
import { type Rect, clampToViewport, positionScheduler } from './scheduler.js'

/**
 * The floating trigger — the Grammarly-style affordance that appears when a fillable form
 * is detected.
 *
 * Anchored to the form rather than pinned to a viewport corner, so on a long page it stays
 * with the thing it acts on instead of hovering over unrelated content. It follows scroll
 * through the shared scheduler; it never installs its own listeners.
 */

export type LauncherState = 'idle' | 'working' | 'done'

export interface LauncherOptions {
  anchor: HTMLElement
  fieldCount: number
  onActivate: () => void
}

const SPARK_ICON = `<svg class="spark" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
  <path d="M8 1l1.6 4.2L14 7l-4.4 1.8L8 13l-1.6-4.2L2 7l4.4-1.8z"/>
</svg>`

export interface LauncherHandle {
  setState: (state: LauncherState, label?: string) => void
  destroy: () => void
}

export function mountLauncher(options: LauncherOptions): LauncherHandle {
  const { root } = getOverlayHost()

  const layer = document.createElement('div')
  layer.className = 'layer'

  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'launcher'
  button.addEventListener('click', options.onActivate)

  const label = document.createElement('span')

  const setState = (state: LauncherState, text?: string) => {
    button.disabled = state === 'working'
    button.innerHTML = state === 'working' ? '<span class="spinner"></span>' : SPARK_ICON
    label.textContent =
      text ??
      (state === 'working'
        ? 'Filling…'
        : state === 'done'
          ? 'Filled'
          : `Fill ${options.fieldCount} field${options.fieldCount === 1 ? '' : 's'}`)
    button.appendChild(label)
    // The visual state is on an icon and a colour; the accessible name has to carry it too.
    button.setAttribute('aria-label', label.textContent ?? 'Fill this form')
  }

  setState('idle')
  layer.appendChild(button)
  root.appendChild(layer)

  // Measured once after the first paint. Reading it per frame would be exactly the forced
  // reflow the scheduler exists to avoid, and the pill's size does not change.
  let size = { width: 150, height: 32 }
  requestAnimationFrame(() => {
    const box = button.getBoundingClientRect()
    if (box.width > 0) size = { width: box.width, height: box.height }
  })

  const untrack = positionScheduler.track({
    element: options.anchor,
    onMove: (rect: Rect, visible: boolean) => {
      // Hidden rather than unmounted: the form scrolling back into view should not cost a
      // remount, and `visibility` keeps the element measurable.
      layer.style.visibility = visible ? 'visible' : 'hidden'
      if (!visible) return

      const { top, left } = clampToViewport(rect, size, {
        width: window.innerWidth,
        height: window.innerHeight,
      })
      layer.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`
    },
  })

  return {
    setState,
    destroy: () => {
      untrack()
      layer.remove()
    },
  }
}

/**
 * A thin outline drawn over a field to show what is happening to it.
 *
 * Overlaid rather than applied to the field itself: writing to the page's own elements
 * would fight the site's styles, and any leftover style on teardown would be a visible bug
 * on someone else's page.
 */
export interface FieldMarker {
  setState: (state: 'active' | 'filled' | 'review' | 'failed') => void
  destroy: () => void
}

export function mountFieldMarker(element: HTMLElement): FieldMarker {
  const { root } = getOverlayHost()

  const marker = document.createElement('div')
  marker.className = 'marker'
  root.appendChild(marker)

  const untrack = positionScheduler.track({
    element,
    onMove: (rect, visible) => {
      marker.style.visibility = visible ? 'visible' : 'hidden'
      if (!visible) return
      marker.style.transform = `translate(${Math.round(rect.left)}px, ${Math.round(rect.top)}px)`
      marker.style.width = `${Math.round(rect.width)}px`
      marker.style.height = `${Math.round(rect.height)}px`
    },
  })

  return {
    setState: (state) => marker.setAttribute('data-state', state),
    destroy: () => {
      untrack()
      marker.remove()
    },
  }
}
