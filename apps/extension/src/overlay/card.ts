import { GLYPH, getOverlayHost } from './host.js'
import type { Rect } from './scheduler.js'

/**
 * The popovers the overlay draws: the launcher's menu, an inline suggestion, and the review
 * card for a guessed answer.
 *
 * One component, three shapes. Focus is trapped while open and returned to the field when it
 * closes, because the person was mid-answer when they opened it.
 */

const MARGIN = 8

export interface CardAction {
  id: string
  label: string
  glyph?: keyof typeof GLYPH
  quiet?: boolean
  disabled?: boolean
  note?: string
}

export interface CardHandle {
  element: HTMLElement
  close: () => void
  contains: (node: Node) => boolean
}

interface BaseSpec {
  anchor: Rect
  onSelect: (id: string) => void
  onClose: () => void
}

interface MenuCard extends BaseSpec {
  kind: 'menu'
  question?: string
  actions: CardAction[]
  note?: { text: string; bad?: boolean }
  /** Focus the first item on open. `false` for suggestions, which must not steal the field's focus. */
  autofocus?: boolean
  /** Show a cross in the header that dismisses the card. */
  closeable?: boolean
}

interface ReviewCard extends BaseSpec {
  kind: 'review'
  question: string
  value: string
  onValueChange: (value: string) => void
  /** Rewrites in a named style, in place. */
  onImprove: (instruction: string) => Promise<string>
}

export type CardSpec = MenuCard | ReviewCard

export const REWRITE_STYLES = [
  { key: 'professional', label: 'More formal' },
  { key: 'simpler', label: 'Simpler' },
  { key: 'shorter', label: 'Shorter' },
  { key: 'detailed', label: 'More detail' },
] as const

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (char) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] ?? char,
  )
}

/** Below the anchor by default, above when there is no room. */
function place(
  anchor: Rect,
  size: { width: number; height: number },
): { top: number; left: number; originX: string; originY: string } {
  const below = anchor.top + anchor.height + 6
  const above = anchor.top - size.height - 6
  const fitsBelow = below + size.height + MARGIN <= window.innerHeight

  const top = fitsBelow ? below : Math.max(MARGIN, above)
  const left = Math.min(
    Math.max(MARGIN, anchor.left + anchor.width - size.width),
    window.innerWidth - size.width - MARGIN,
  )

  return { top, left: Math.max(MARGIN, left), originX: '100%', originY: fitsBelow ? '0%' : '100%' }
}

function mountCard(spec: CardSpec, content: HTMLElement): CardHandle {
  const { root } = getOverlayHost()

  const card = document.createElement('div')
  card.className = 'card'
  card.setAttribute('role', spec.kind === 'menu' ? 'menu' : 'dialog')
  card.setAttribute('aria-label', spec.kind === 'review' ? 'Review this answer' : 'Fill')

  card.appendChild(content)
  root.appendChild(card)

  // Measured off-screen first: placement needs the real height.
  card.style.visibility = 'hidden'
  card.style.top = '0px'
  card.style.left = '0px'
  const size = { width: card.offsetWidth, height: card.offsetHeight }
  const placed = place(spec.anchor, size)
  card.style.top = `${placed.top}px`
  card.style.left = `${placed.left}px`
  card.style.setProperty('--origin-x', placed.originX)
  card.style.setProperty('--origin-y', placed.originY)
  card.style.visibility = 'visible'

  const onKey = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      spec.onClose()
      return
    }

    const focusables = () => [
      ...card.querySelectorAll<HTMLElement>(
        '.card-value, .card-item:not([disabled]), .card-btn:not([disabled]), .card-chip:not([disabled])',
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

  card.addEventListener('keydown', onKey)

  return {
    element: card,
    close: () => card.remove(),
    contains: (node) => card.contains(node),
  }
}

export function mountMenuCard(spec: MenuCard): CardHandle {
  const body = document.createElement('div')

  if (spec.question || spec.closeable) {
    const question = document.createElement('div')
    question.className = 'card-question'
    question.style.display = 'flex'
    question.style.alignItems = 'center'
    question.style.justifyContent = 'space-between'
    question.style.gap = '8px'
    const label = document.createElement('span')
    label.style.minWidth = '0'
    label.textContent = spec.question ?? ''
    question.appendChild(label)
    if (spec.closeable) {
      const close = document.createElement('button')
      close.type = 'button'
      close.className = 'card-close'
      close.setAttribute('aria-label', 'Close')
      close.innerHTML = GLYPH.close
      close.addEventListener('click', (event) => {
        event.preventDefault()
        event.stopPropagation()
        spec.onClose()
      })
      question.appendChild(close)
    }
    body.appendChild(question)
  }

  for (const action of spec.actions) {
    const item = document.createElement('button')
    item.type = 'button'
    item.className = `card-item${action.quiet ? ' card-item-quiet' : ''}`
    item.dataset.id = action.id
    if (action.disabled) item.disabled = true
    item.innerHTML = `${action.glyph ? GLYPH[action.glyph] : ''}<span>${escapeHtml(action.label)}</span>`
    body.appendChild(item)
  }

  if (spec.note) {
    const note = document.createElement('div')
    note.className = `card-note${spec.note.bad ? ' card-note-bad' : ''}`
    note.textContent = spec.note.text
    body.appendChild(note)
  }

  const handle = mountCard(spec, body)

  handle.element.addEventListener('click', (event) => {
    const target = (event.target as HTMLElement).closest<HTMLElement>('[data-id]')
    if (!target || target.hasAttribute('disabled')) return
    event.preventDefault()
    event.stopPropagation()
    spec.onSelect(target.dataset.id ?? '')
  })

  if (spec.autofocus !== false) {
    handle.element.querySelector<HTMLElement>('.card-item:not(:disabled)')?.focus()
  }
  return handle
}

export function mountReviewCard(spec: ReviewCard): CardHandle {
  const body = document.createElement('div')

  const head = document.createElement('div')
  head.className = 'card-question'
  head.style.display = 'flex'
  head.style.alignItems = 'center'
  head.style.gap = '8px'
  const stamp = document.createElement('span')
  stamp.className = 'card-stamp'
  stamp.innerHTML = `${GLYPH.sparkle}<span>AI wrote it</span>`
  head.appendChild(stamp)
  const label = document.createElement('span')
  label.style.minWidth = '0'
  label.textContent = spec.question
  head.appendChild(label)
  body.appendChild(head)

  const valueWrap = document.createElement('div')
  valueWrap.className = 'card-body'
  const textarea = document.createElement('textarea')
  textarea.className = 'card-value'
  textarea.setAttribute('aria-label', 'Answer')
  textarea.value = spec.value
  valueWrap.appendChild(textarea)
  body.appendChild(valueWrap)

  const actions = document.createElement('div')
  actions.className = 'card-actions'
  actions.dataset.actions = ''
  body.appendChild(actions)

  const handle = mountCard(spec, body)

  let mode: 'idle' | 'rewriting' | 'busy' = 'idle'
  let error: string | null = null

  const renderActions = () => {
    const dirty = textarea.value !== spec.value

    if (mode === 'busy') {
      actions.className = 'card-note'
      actions.textContent = 'Rewriting…'
      return
    }

    if (mode === 'rewriting') {
      actions.className = 'card-chips'
      actions.innerHTML = `${REWRITE_STYLES.map(
        (style) =>
          `<button type="button" class="card-chip" data-id="style:${style.key}">${escapeHtml(style.label)}</button>`,
      ).join('')}<button type="button" class="card-chip" data-id="cancel-rewrite">Back</button>`
      return
    }

    actions.className = 'card-actions'
    actions.innerHTML = dirty
      ? `<button type="button" class="card-btn card-btn-primary" data-id="save">Save to the page</button>
         <button type="button" class="card-btn" data-id="undo">Undo</button>`
      : `<button type="button" class="card-btn card-btn-primary" data-id="keep">Keep</button>
         <button type="button" class="card-btn" data-id="rewrite">${GLYPH.pen}Rewrite</button>
         <button type="button" class="card-btn card-btn-bad" data-id="clear">Clear</button>`

    if (error) {
      const note = document.createElement('div')
      note.className = 'card-note card-note-bad'
      note.textContent = error
      actions.after(note)
    }
  }

  textarea.addEventListener('input', () => {
    spec.onValueChange(textarea.value)
    renderActions()
  })
  renderActions()
  textarea.focus()
  textarea.setSelectionRange(textarea.value.length, textarea.value.length)

  handle.element.addEventListener('click', (event) => {
    const target = (event.target as HTMLElement).closest<HTMLElement>('[data-id]')
    if (!target || target.hasAttribute('disabled')) return
    event.preventDefault()
    event.stopPropagation()

    const id = target.dataset.id ?? ''

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

    spec.onSelect(id)
  })

  return handle
}
