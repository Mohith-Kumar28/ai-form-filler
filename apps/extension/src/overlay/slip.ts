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
}

export type SlipSpec = MenuSlip | ReviewSlip

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

  if (spec.kind === 'menu') {
    slip.innerHTML = `
      <div class="slip-head">
        <div class="slip-label">${escapeHtml(spec.label)}</div>
        ${spec.question ? `<div class="slip-question">${escapeHtml(spec.question)}</div>` : ''}
      </div>
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
  } else {
    const stampClass = spec.concluded ? 'slip-stamp' : 'slip-stamp slip-stamp-unsure'
    const stampText = spec.concluded
      ? 'Concluded'
      : `Unsure · ${Math.round(spec.confidence * 100)}%`

    slip.innerHTML = `
      <div class="slip-head">
        <span class="${stampClass}">${GLYPH.stamp}<span>${escapeHtml(stampText)}</span></span>
        <div class="slip-question">${escapeHtml(spec.question)}</div>
      </div>
      <div class="slip-body">
        <textarea class="slip-value" aria-label="Answer">${escapeHtml(spec.value)}</textarea>
      </div>
      <div class="slip-actions">
        <button type="button" class="slip-btn slip-btn-plate" data-id="keep">Keep</button>
        <button type="button" class="slip-btn" data-id="save">Save</button>
        <button type="button" class="slip-btn slip-btn-bad" data-id="clear">Clear</button>
      </div>
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

  const items = [...slip.querySelectorAll<HTMLElement>('.slip-item:not(:disabled), .slip-btn')]
  const textarea = slip.querySelector<HTMLTextAreaElement>('.slip-value')

  if (spec.kind === 'review' && textarea) {
    textarea.addEventListener('input', () => spec.onValueChange(textarea.value))
    textarea.focus()
    textarea.setSelectionRange(textarea.value.length, textarea.value.length)
  } else {
    items[0]?.focus()
  }

  slip.addEventListener('click', (event) => {
    const target = (event.target as HTMLElement).closest<HTMLElement>('[data-id]')
    if (!target || target.hasAttribute('disabled')) return
    event.preventDefault()
    event.stopPropagation()
    spec.onSelect(target.dataset.id ?? '')
  })

  const onKey = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      spec.onClose()
      return
    }

    if (event.key === 'Tab') {
      const focusable = textarea ? [textarea, ...items] : items
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
    const index = items.indexOf(root.activeElement as HTMLElement)
    const next = event.key === 'ArrowDown' ? index + 1 : index - 1
    items[(next + items.length) % items.length]?.focus()
  }

  slip.addEventListener('keydown', onKey)

  return {
    element: slip,
    close: () => slip.remove(),
    contains: (node) => slip.contains(node),
  }
}
