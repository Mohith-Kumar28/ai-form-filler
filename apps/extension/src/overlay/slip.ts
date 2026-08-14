import { GLYPH, getOverlayHost } from './host.js'
import type { Rect } from './scheduler.js'

/**
 * The endorsement slip: the popover the seal opens.
 *
 * Two shapes, one component. Before a fill it offers what can be done; after one, on a field
 * that was concluded rather than read, it carries the same accept/rewrite/clear actions the
 * panel's review row has, so a correction never requires leaving the form.
 *
 * Focus is trapped while it is open and returned to the field when it closes, because the
 * person was mid-answer when they opened it.
 */

const MARGIN = 8

/**
 * How the product signs its work on someone else's page.
 *
 * Deliberately one word and set in the label register rather than the manifest's full
 * "AI Form Filler", which is a description of the category and not a name. Change it here and
 * it changes on every slip; nothing else reads it.
 */
const WORDMARK = 'Autofill'

export interface SlipAction {
  id: string
  label: string
  glyph?: keyof typeof GLYPH
  quiet?: boolean
  disabled?: boolean
  note?: string
}

export interface SlipHandle {
  element: HTMLElement
  close: () => void
  contains: (node: Node) => boolean
  /** Advances a progress slip in place, so it neither re-animates nor moves. */
  setStage: (stage: ProgressStage) => void
}

interface SlipOptions {
  anchor: Rect
  onSelect: (id: string) => void
  onClose: () => void
}

interface MenuSlip extends SlipOptions {
  kind: 'menu'
  label: string
  question?: string
  actions: SlipAction[]
  note?: { text: string; bad?: boolean }
}

interface ReviewSlip extends SlipOptions {
  kind: 'review'
  label: string
  question: string
  value: string
  /** `true` for an inference, `false` for a merely low-confidence answer. */
  concluded: boolean
  confidence: number
  onValueChange: (value: string) => void
  /**
   * Rewrites in a named style, in place.
   *
   * The slip offers the same four styles the panel's review row does, so correcting a
   * concluded answer never requires leaving the form — which is the entire reason the review
   * lives on the page as well as in the panel. Rejecting means the request failed and the
   * original text stands.
   */
  onImprove: (instruction: string) => Promise<string>
}

export const REWRITE_STYLES = [
  { key: 'professional', label: 'More formal' },
  { key: 'simpler', label: 'Simpler' },
  { key: 'shorter', label: 'Shorter' },
  { key: 'detailed', label: 'More detail' },
] as const

/**
 * What is happening, on the field the person pressed.
 *
 * Shown only while the page is still — detection and the model call. Once values start
 * landing, the typing animation and the field marks are a better account of the work than any
 * panel could give, and a fixed popover would only fight the scrolling they cause.
 */
interface ProgressSlip extends SlipOptions {
  kind: 'progress'
  label: string
  stage: ProgressStage
  fieldCount: number
}

/** The one thing the page-initiated flow never had: an ending. */
interface DoneSlip extends SlipOptions {
  kind: 'done'
  label: string
  written: number
  total: number
  worthChecking: number
}

export type ProgressStage = 'detecting' | 'generating' | 'applying'

const STAGES: { key: ProgressStage; label: string }[] = [
  { key: 'detecting', label: 'Reading the page' },
  { key: 'generating', label: 'Writing your answers' },
  { key: 'applying', label: 'Filling the form' },
]

export type SlipSpec = MenuSlip | ReviewSlip | ProgressSlip | DoneSlip

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (char) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] ?? char,
  )
}

/**
 * Placed below the anchor by default, flipped above when there is no room.
 *
 * The shared `clampToViewport` prefers *above*, which is right for a marker tooltip and wrong
 * here: the seal sits at the bottom-right of a field, and opening upward would cover the
 * question the person is answering.
 */
function place(
  anchor: Rect,
  size: { width: number; height: number },
): { top: number; left: number; originX: string; originY: string } {
  const below = anchor.top + anchor.height + 6
  const above = anchor.top - size.height - 6
  const fitsBelow = below + size.height + MARGIN <= window.innerHeight

  const top = fitsBelow ? below : Math.max(MARGIN, above)

  // Right-aligned to the anchor, because the seal is at the field's right edge.
  const left = Math.min(
    Math.max(MARGIN, anchor.left + anchor.width - size.width),
    window.innerWidth - size.width - MARGIN,
  )

  return {
    top,
    left: Math.max(MARGIN, left),
    originX: '100%',
    originY: fitsBelow ? '0%' : '100%',
  }
}

export function mountSlip(spec: SlipSpec): SlipHandle {
  const { root } = getOverlayHost()

  const slip = document.createElement('div')
  slip.className = 'slip'
  slip.setAttribute('role', spec.kind === 'menu' ? 'menu' : 'dialog')
  slip.setAttribute('aria-label', spec.label)

  /**
   * The masthead.
   *
   * A credential names its issuer, and this popover is the only place the product signs its
   * own work on a page it does not own — so the seal and the wordmark sit at the top of every
   * slip, and the question being answered gets its own band beneath rather than sharing one.
   */
  const masthead = `<div class="slip-head">${GLYPH.seal}<span class="slip-wordmark">${escapeHtml(
    WORDMARK,
  )}</span></div>`

  if (spec.kind === 'menu') {
    slip.innerHTML = `
      ${masthead}
      ${spec.question ? `<div class="slip-question">${escapeHtml(spec.question)}</div>` : ''}
      ${spec.actions
        .map(
          (action) => `
        <button type="button" class="slip-item${action.quiet ? ' slip-item-quiet' : ''}"
                role="menuitem" data-id="${escapeHtml(action.id)}"${
                  action.disabled ? ' disabled' : ''
                }>
          ${action.glyph ? GLYPH[action.glyph] : ''}
          <span>${escapeHtml(action.label)}</span>
        </button>`,
        )
        .join('')}
      ${
        spec.note
          ? `<div class="slip-note${spec.note.bad ? ' slip-note-bad' : ''}">${escapeHtml(
              spec.note.text,
            )}</div>`
          : ''
      }
    `
  } else if (spec.kind === 'progress') {
    slip.innerHTML = `
      ${masthead}
      <div class="slip-question">${
        spec.fieldCount > 0
          ? `${spec.fieldCount} field${spec.fieldCount === 1 ? '' : 's'} on this page`
          : 'Working through the form'
      }</div>
      <div class="slip-stages">
        ${STAGES.map(
          (stage) =>
            `<div class="slip-stage" data-stage="${stage.key}"><span class="slip-stage-dot"></span><span>${stage.label}</span></div>`,
        ).join('')}
      </div>
      <button type="button" class="slip-item slip-item-quiet" data-id="cancel">
        <span>Stop</span>
      </button>
    `
  } else if (spec.kind === 'done') {
    slip.innerHTML = `
      ${masthead}
      <div class="slip-question">${spec.written} of ${spec.total} filled${
        spec.worthChecking > 0
          ? ` · ${spec.worthChecking} worth checking`
          : ' · nothing needs a second look'
      }</div>
      <div class="slip-actions">
        ${
          spec.worthChecking > 0
            ? '<button type="button" class="slip-btn slip-btn-plate" data-id="review">Review</button>'
            : ''
        }
        <button type="button" class="slip-btn" data-id="dismiss">Done</button>
      </div>
    `
  } else {
    const stampClass = spec.concluded ? 'slip-stamp' : 'slip-stamp slip-stamp-unsure'
    const stampText = spec.concluded
      ? 'Concluded'
      : `Unsure · ${Math.round(spec.confidence * 100)}%`

    /*
      Keep / Rewrite / Clear — the same three words the panel's review row uses.

      This used to offer Keep / Save / Clear, so one decision had two vocabularies depending on
      which surface you happened to be looking at, and the middle option meant something
      different on each. Save is not a peer of the other two: it only exists once the text has
      actually been changed, and it appears in its place then.
    */
    slip.innerHTML = `
      <div class="slip-head">
        ${GLYPH.seal}<span class="slip-wordmark">${escapeHtml(WORDMARK)}</span>
        <span class="${stampClass}">${GLYPH.stamp}<span>${escapeHtml(stampText)}</span></span>
      </div>
      <div class="slip-question">${escapeHtml(spec.question)}</div>
      <div class="slip-body">
        <textarea class="slip-value" aria-label="Answer">${escapeHtml(spec.value)}</textarea>
      </div>
      <div class="slip-actions" data-actions></div>
    `
  }

  root.appendChild(slip)

  // Measured off-screen first: placement needs the real height, and a slip with two lines of
  // question text is a different height from one with none.
  slip.style.visibility = 'hidden'
  slip.style.top = '0px'
  slip.style.left = '0px'
  const size = { width: slip.offsetWidth, height: slip.offsetHeight }
  const placed = place(spec.anchor, size)
  slip.style.top = `${placed.top}px`
  slip.style.left = `${placed.left}px`
  slip.style.setProperty('--origin-x', placed.originX)
  slip.style.setProperty('--origin-y', placed.originY)
  slip.style.visibility = 'visible'

  const textarea = slip.querySelector<HTMLTextAreaElement>('.slip-value')
  const actions = slip.querySelector<HTMLElement>('[data-actions]')

  /**
   * The review slip's action row, which is a small state machine rather than three fixed
   * buttons: the offer changes once the text has been touched, and again while a rewrite is in
   * flight. Rendering only this row keeps the slip's position and the caret where they were.
   */
  let mode: 'idle' | 'rewriting' | 'busy' = 'idle'
  let error: string | null = null

  const renderActions = () => {
    if (spec.kind !== 'review' || !actions || !textarea) return
    const dirty = textarea.value !== spec.value

    if (mode === 'busy') {
      actions.className = 'slip-busy'
      actions.textContent = 'Rewriting…'
      return
    }

    if (mode === 'rewriting') {
      actions.className = 'slip-chips'
      actions.innerHTML = `${REWRITE_STYLES.map(
        (style) =>
          `<button type="button" class="slip-chip" data-id="style:${style.key}">${escapeHtml(
            style.label,
          )}</button>`,
      ).join('')}<button type="button" class="slip-chip" data-id="cancel-rewrite">Back</button>`
      return
    }

    actions.className = 'slip-actions'
    actions.innerHTML = dirty
      ? `<button type="button" class="slip-btn slip-btn-plate" data-id="save">Save to the page</button>
         <button type="button" class="slip-btn" data-id="undo">Undo</button>`
      : `<button type="button" class="slip-btn slip-btn-plate" data-id="keep">Keep</button>
         <button type="button" class="slip-btn" data-id="rewrite">${GLYPH.pen}Rewrite</button>
         <button type="button" class="slip-btn slip-btn-bad" data-id="clear">Clear</button>`

    if (error) {
      const note = document.createElement('div')
      note.className = 'slip-note slip-note-bad'
      note.textContent = error
      actions.after(note)
    }
  }

  if (spec.kind === 'review' && textarea) {
    textarea.addEventListener('input', () => {
      spec.onValueChange(textarea.value)
      renderActions()
    })
    renderActions()
    textarea.focus()
    textarea.setSelectionRange(textarea.value.length, textarea.value.length)
  } else {
    slip.querySelector<HTMLElement>('.slip-item:not(:disabled)')?.focus()
  }

  slip.addEventListener('click', (event) => {
    const target = (event.target as HTMLElement).closest<HTMLElement>('[data-id]')
    if (!target || target.hasAttribute('disabled')) return
    event.preventDefault()
    event.stopPropagation()

    const id = target.dataset.id ?? ''

    // Rewriting is handled inside the slip: it changes the text in place and hands control
    // back, rather than resolving the field and closing.
    if (spec.kind === 'review' && textarea) {
      if (id === 'rewrite') {
        mode = 'rewriting'
        error = null
        renderActions()
        return
      }
      if (id === 'cancel-rewrite') {
        mode = 'idle'
        renderActions()
        return
      }
      if (id === 'undo') {
        textarea.value = spec.value
        spec.onValueChange(spec.value)
        renderActions()
        return
      }
      if (id.startsWith('style:')) {
        mode = 'busy'
        error = null
        renderActions()
        void spec
          .onImprove(id.slice('style:'.length))
          .then((next) => {
            textarea.value = next
            spec.onValueChange(next)
          })
          .catch((cause: Error) => {
            error = cause.message || 'Could not rewrite that. The original is unchanged.'
          })
          .finally(() => {
            mode = 'idle'
            renderActions()
          })
        return
      }
    }

    spec.onSelect(id)
  })

  const onKey = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      spec.onClose()
      return
    }

    // Re-queried on every keypress rather than captured once: the review slip rewrites its
    // own action row, so a list built at mount goes stale the moment anyone presses Rewrite.
    const focusables = () => [
      ...slip.querySelectorAll<HTMLElement>(
        '.slip-value, .slip-item:not([disabled]), .slip-btn:not([disabled]), .slip-chip:not([disabled])',
      ),
    ]

    if (event.key === 'Tab') {
      const focusable = focusables()
      if (focusable.length === 0) return
      const index = focusable.indexOf(root.activeElement as HTMLElement)
      const next = event.shiftKey ? index - 1 : index + 1
      if (next < 0 || next >= focusable.length) {
        event.preventDefault()
        focusable[event.shiftKey ? focusable.length - 1 : 0]?.focus()
      }
      return
    }

    if (spec.kind !== 'menu') return
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return

    event.preventDefault()
    const items = focusables()
    if (items.length === 0) return
    const index = items.indexOf(root.activeElement as HTMLElement)
    const next = event.key === 'ArrowDown' ? index + 1 : index - 1
    items[(next + items.length) % items.length]?.focus()
  }

  slip.addEventListener('keydown', onKey)

  const setStage = (stage: ProgressStage) => {
    const reached = STAGES.findIndex((candidate) => candidate.key === stage)
    for (const [index, candidate] of STAGES.entries()) {
      const node = slip.querySelector<HTMLElement>(`[data-stage="${candidate.key}"]`)
      if (!node) continue
      node.dataset.state = index < reached ? 'done' : index === reached ? 'active' : 'ahead'
    }
  }

  if (spec.kind === 'progress') setStage(spec.stage)

  return {
    element: slip,
    close: () => slip.remove(),
    contains: (node) => slip.contains(node),
    setStage,
  }
}
