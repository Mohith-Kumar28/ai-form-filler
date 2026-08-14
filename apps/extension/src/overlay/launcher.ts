import { getOverlayHost, prefersReducedMotion } from './host.js'
import { positionScheduler } from './scheduler.js'

/**
 * The page dock.
 *
 * **Fixed to the bottom-right corner, not anchored to a field.** The previous version tracked
 * the first detected input, which put it mid-page on any form whose first field sits below
 * the fold — covering the very content it was offering to fill. A corner dock is where users
 * already look for this affordance, never overlaps form content, costs nothing to keep
 * positioned during scroll, and cannot drift onto a field.
 *
 * It owns a real state machine. The old one had no path back from `done` or `error`, so a
 * finished or failed fill left the button reading "Filled" until the page was reloaded.
 */

export type WorkStage = 'detecting' | 'routing' | 'generating' | 'applying'

export type DockState =
  | { kind: 'idle'; fieldCount: number }
  | { kind: 'working'; stage: WorkStage; done: number; total: number }
  | { kind: 'done'; applied: number; total: number; inferred: number }
  /**
   * `needsAuth` splits the two error shapes apart, because the recovery differs. A failed
   * fill can be retried; an ended session cannot — retrying just fails again — so it gets
   * a sign-in action instead of a "Try again" that is guaranteed not to work.
   */
  | { kind: 'error'; message: string; needsAuth?: boolean }
  /**
   * Shown on submit, when corrections were sent to memory.
   *
   * Learning is otherwise completely invisible: the value of correcting an answer is paid
   * back on some future form, so without a moment of acknowledgement the user has no reason
   * to believe editing did anything at all. It is the only feedback that the product is
   * getting better because of them.
   */
  | { kind: 'learned'; count: number }

/**
 * What the dock says while it works.
 *
 * Real stages drive the headline; the rotating line underneath exists because a tier-3 fill
 * can sit in `generating` for fifteen seconds, and a label that never changes for that long
 * reads as a hang. Every line describes something actually happening — no fake progress.
 */
const STAGE_COPY: Record<WorkStage, { title: string; details: string[] }> = {
  detecting: {
    title: 'Reading the page',
    details: ['Finding fields', 'Working out what each one asks'],
  },
  routing: {
    title: 'Sorting the questions',
    details: ['Separating facts from judgement calls', 'Deciding what needs thought'],
  },
  generating: {
    title: 'Writing your answers',
    details: [
      'Checking what you have recorded',
      'Looking through your sources',
      'Matching your voice',
      'Working through the longer answers',
    ],
  },
  applying: {
    title: 'Filling the form',
    details: ['Writing each field', 'Marking what was inferred'],
  },
}

const ICON_PEN = `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11.5 2.5a1.4 1.4 0 0 1 2 2L6 12l-3 1 1-3 7.5-7.5Z"/></svg>`
const ICON_CHECK = `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 8.5 6.5 11.5 12.5 5"/></svg>`
const ICON_ALERT = `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 2.5 13.5 12.5H2.5L8 2.5Z"/><path d="M8 6.5v3M8 11.2v.05"/></svg>`
const ICON_SPARK = `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 2.5l1.4 3.6L13 7.5l-3.6 1.4L8 12.5l-1.4-3.6L3 7.5l3.6-1.4L8 2.5Z"/></svg>`
const ICON_CLOSE = `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8"/></svg>`

export interface DockOptions {
  onActivate: () => void
  /** Hide for this page. It does not return until the form materially changes. */
  onDismiss: () => void
  /** Open the side panel to review judgement calls. */
  onReview: () => void
  /**
   * Open the side panel so the user can sign in again.
   *
   * Sign-in itself cannot happen here: `chrome.identity` is unavailable to content scripts,
   * and the consent popup would be torn down with the page anyway. The panel is where the
   * flow lives, so the dock's job is only to send them there.
   */
  onSignIn: () => void
}

export interface DockHandle {
  setState: (state: DockState) => void
  destroy: () => void
}

/** Model output and error text are untrusted; never inserted as markup. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function mountDock(options: DockOptions): DockHandle {
  const { root } = getOverlayHost()

  const layer = document.createElement('div')
  layer.className = 'dock'
  layer.setAttribute('role', 'status')
  // A fill takes long enough that without this a screen-reader user gets no signal at all
  // between clicking and completion.
  layer.setAttribute('aria-live', 'polite')

  let rotation: ReturnType<typeof setInterval> | null = null
  const stopRotation = () => {
    if (rotation !== null) {
      clearInterval(rotation)
      rotation = null
    }
  }

  const render = (state: DockState) => {
    stopRotation()

    if (state.kind === 'idle') {
      layer.innerHTML = `
        <div class="dock-bar">
          <button class="dock-main" type="button" data-action="fill">
            <span class="dock-icon">${ICON_PEN}</span>
            <span>Fill ${state.fieldCount} field${state.fieldCount === 1 ? '' : 's'}</span>
          </button>
          <button class="dock-x" type="button" data-action="dismiss" aria-label="Hide">${ICON_CLOSE}</button>
        </div>`
      return
    }

    if (state.kind === 'working') {
      const copy = STAGE_COPY[state.stage]
      layer.innerHTML = `
        <div class="dock-panel">
          <div class="dock-row">
            <span class="dock-spinner" aria-hidden></span>
            <span class="dock-title">${copy.title}</span>
            ${state.total > 0 ? `<span class="dock-num">${state.done}/${state.total}</span>` : ''}
          </div>
          <p class="dock-detail" data-detail>${copy.details[0] ?? ''}</p>
        </div>`

      if (copy.details.length > 1 && !prefersReducedMotion()) {
        let index = 0
        rotation = setInterval(() => {
          index = (index + 1) % copy.details.length
          const node = layer.querySelector('[data-detail]')
          if (node) node.textContent = copy.details[index] ?? ''
        }, 2400)
      }
      return
    }

    if (state.kind === 'done') {
      const blank = state.total - state.applied
      layer.innerHTML = `
        <div class="dock-panel">
          <div class="dock-row">
            <span class="dock-icon dock-ok">${ICON_CHECK}</span>
            <span class="dock-title"><b class="dock-num">${state.applied}</b> of <span class="dock-num">${state.total}</span> filled</span>
          </div>
          <p class="dock-detail${state.inferred > 0 ? ' dock-annot' : ''}">${
            state.inferred > 0
              ? `${state.inferred} judgement call${state.inferred === 1 ? '' : 's'} to check`
              : blank > 0
                ? `${blank} left blank`
                : 'Everything answered'
          }</p>
          <div class="dock-actions">
            ${state.inferred > 0 ? '<button class="dock-btn" type="button" data-action="review">Review</button>' : ''}
            <button class="dock-btn dock-btn-quiet" type="button" data-action="dismiss">Done</button>
          </div>
        </div>`
      return
    }

    if (state.kind === 'learned') {
      layer.innerHTML = `
        <div class="dock-panel dock-learned">
          <div class="dock-row">
            <span class="dock-icon dock-ok">${ICON_SPARK}</span>
            <span class="dock-title">Learned <b class="dock-num">${state.count}</b> ${
              state.count === 1 ? 'correction' : 'corrections'
            }</span>
          </div>
          <p class="dock-detail">Next time this is answered in your words.</p>
        </div>`
      return
    }

    layer.innerHTML = `
      <div class="dock-panel">
        <div class="dock-row">
          <span class="dock-icon dock-bad">${ICON_ALERT}</span>
          <span class="dock-title">${state.needsAuth ? 'Signed out' : 'Could not fill'}</span>
        </div>
        <p class="dock-detail dock-annot">${escapeHtml(state.message)}</p>
        <div class="dock-actions">
          ${
            state.needsAuth
              ? '<button class="dock-btn" type="button" data-action="signin">Sign in</button>'
              : '<button class="dock-btn" type="button" data-action="fill">Try again</button>'
          }
          <button class="dock-btn dock-btn-quiet" type="button" data-action="dismiss">Dismiss</button>
        </div>
      </div>`
  }

  // One delegated listener: the markup is replaced wholesale on every render, so
  // per-element listeners would leak with each state change.
  layer.addEventListener('click', (event) => {
    const action = (event.target as HTMLElement)
      ?.closest('[data-action]')
      ?.getAttribute('data-action')
    if (action === 'fill') options.onActivate()
    else if (action === 'dismiss') options.onDismiss()
    else if (action === 'review') options.onReview()
    else if (action === 'signin') options.onSignIn()
  })

  root.appendChild(layer)
  render({ kind: 'idle', fieldCount: 0 })

  return {
    setState: render,
    destroy: () => {
      stopRotation()
      layer.remove()
    },
  }
}

/**
 * A thin outline drawn over a field to show what happened to it.
 *
 * Overlaid rather than applied to the field itself: writing to the page's own elements
 * fights the site's styles, and leftover style on teardown is a visible bug on someone
 * else's page. These do track their field, so they keep the shared scheduler.
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
