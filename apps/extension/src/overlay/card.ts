import {
  MAX_INSTRUCTION_LENGTH,
  REWRITE_LENGTHS,
  REWRITE_TONES,
  type RewritePreset,
} from '@aff/shared/rewrite'
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
  /**
   * Re-place against a fresh anchor rect.
   *
   * The card follows its field. Placing once and leaving it meant a card opened against a stale
   * rect — or one whose field then scrolled — stayed where it was first put, pointing at nothing.
   */
  reposition: (anchor: Rect) => void
}

interface BaseSpec {
  anchor: Rect
  onSelect: (id: string) => void
  /** `returnFocus` matters only to the answer card; menus ignore it. */
  onClose: (returnFocus?: boolean) => void
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

export type CardSpec = MenuCard | AnswerCardSpec

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (char) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] ?? char,
  )
}

/**
 * Below the anchor by default, above when there is no room.
 *
 * `align` decides the horizontal edge. Menus are right-flush, which is where their trigger sits.
 * The answer card is `'start'`, so its left edge lines up with the tab's and the field's — three
 * things in one vertical line read as one object rather than three. A too-narrow anchor is
 * centred either way, because a flush card beside a 40px input does not read as connected to it.
 */
function place(
  anchor: Rect,
  size: { width: number; height: number },
  align: 'start' | 'end' = 'end',
): { top: number; left: number; originX: string; originY: string } {
  const below = anchor.top + anchor.height + 6
  const above = anchor.top - size.height - 6
  const fitsBelow = below + size.height + MARGIN <= window.innerHeight

  /**
   * Clamped into the viewport, not merely preferred within it.
   *
   * An anchor can be off-screen at the moment a card is placed: the panel's stepper opens a card
   * for a field it has just asked the page to scroll to, and a smooth scroll has not landed by
   * the time the rect is read. Without the clamp the card was positioned hundreds of pixels
   * below the fold — mounted, focused, and invisible, which reads as the button doing nothing.
   */
  const preferred = fitsBelow ? below : above
  const top = Math.min(
    Math.max(MARGIN, preferred),
    Math.max(MARGIN, window.innerHeight - size.height - MARGIN),
  )

  const narrow = anchor.width < 100

  const unclamped = narrow
    ? anchor.left + anchor.width / 2 - size.width / 2
    : align === 'start'
      ? anchor.left
      : anchor.left + anchor.width - size.width

  const left = Math.min(Math.max(MARGIN, unclamped), window.innerWidth - size.width - MARGIN)

  return {
    top,
    left: Math.max(MARGIN, left),
    originX: narrow ? '50%' : align === 'start' ? '0%' : '100%',
    originY: fitsBelow ? '0%' : '100%',
  }
}

function mountCard(spec: CardSpec, content: HTMLElement): CardHandle {
  const { root } = getOverlayHost()

  const card = document.createElement('div')
  card.className = 'card'
  card.setAttribute('role', spec.kind === 'menu' ? 'menu' : 'dialog')
  if (spec.kind === 'menu') card.setAttribute('aria-label', 'Fill')

  card.appendChild(content)
  root.appendChild(card)

  // Measured off-screen first: placement needs the real height.
  card.style.visibility = 'hidden'
  card.style.top = '0px'
  card.style.left = '0px'
  const size = { width: card.offsetWidth, height: card.offsetHeight }
  const placed = place(spec.anchor, size, spec.kind === 'answer' ? 'start' : 'end')
  card.style.top = `${placed.top}px`
  card.style.left = `${placed.left}px`
  card.style.setProperty('--origin-x', placed.originX)
  card.style.setProperty('--origin-y', placed.originY)
  card.style.visibility = 'visible'

  const onKey = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      // Focus goes back to the field: the person was mid-answer when they opened this.
      spec.onClose(true)
      return
    }

    const focusables = () => [
      ...card.querySelectorAll<HTMLElement>(
        [
          '.card-item:not([disabled])',
          '.card-close',
          '.answer-text',
          '.answer-filter',
          '.answer-option[tabindex="0"]',
          '.answer-chip:not([disabled])',
          '.answer-ask-input',
          '.answer-ask-go:not([disabled])',
          '.answer-keep',
          '.answer-undo:not([disabled])',
          '.answer-clear',
        ].join(', '),
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

  const reposition = (anchor: Rect) => {
    const size = { width: card.offsetWidth, height: card.offsetHeight }
    const next = place(anchor, size, spec.kind === 'answer' ? 'start' : 'end')
    card.style.top = `${next.top}px`
    card.style.left = `${next.left}px`
  }

  return {
    element: card,
    close: () => card.remove(),
    contains: (node) => card.contains(node),
    reposition,
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

/**
 * The answer card: one place where everything about one answer can be done.
 *
 * Replaces a pill carrying a tick and a cross. Those two buttons could express "keep" and
 * "clear" and nothing else — not *edit*, not *rewrite*, not *what were the other options* —
 * so every real correction had to happen in the side panel, on a copy of the answer, with the
 * page's own field as a third place the same text lived.
 *
 * ### There is no "save to the page" button
 *
 * That is the central simplification. Typing writes through on a debounce, so the card and the
 * field cannot hold different text. The old pairing of *Save to the page* and *Keep* asked the
 * user to distinguish two things that sound identical, in an interface they had opened because
 * something was already unclear. `Keep` now means one thing: and remember it.
 */
export interface AnswerCardSpec {
  kind: 'answer'
  anchor: Rect
  /** Re-anchored against this on scroll; the tab's rect when the field is very tall. */
  anchorElement: HTMLElement
  question: string
  value: string
  /**
   * Why the card is open, which is the only thing its header wording depends on.
   *
   * `stated` is the one that is not a disclosure. An answer we read straight off the profile
   * needs no checking — the Unmarked Fact Rule in `markers.ts` is that a fact asks nothing of
   * the user — but *changing* it is still something they may want, and the card is the only
   * place a rewrite lives. So the same card opens for a stated answer, and says so rather than
   * claiming we guessed at something we did not.
   */
  reason: 'inferred' | 'unsure' | 'stated'
  /** Prose gets a textarea and the rewrite controls; a choice gets its options. */
  mode: 'prose' | 'choose'
  options?: string[]
  multiple?: boolean
  /** Remembered from the last rewrite on this field, so a second nudge is one keystroke. */
  lastInstruction?: string
  /** Debounced write-through. Resolves false if the page refused the value. */
  onWrite: (value: string) => Promise<boolean>
  onRewrite: (instruction: string) => Promise<string>
  onKeep: (value: string, meta: { edited: boolean; rewritten: boolean }) => void
  onClear: () => void
  onClose: (returnFocus?: boolean) => void
}

/** How long after the last keystroke the answer is written to the page. */
const WRITE_THROUGH_MS = 500
/** When a rewrite passes this, the wait is acknowledged rather than left silent. */
const SLOW_REWRITE_MS = 8000

const REASON_LABEL: Record<AnswerCardSpec['reason'], string> = {
  inferred: 'I guessed',
  unsure: 'not sure',
  // Not a hedge, and deliberately not phrased as one: this answer came from what they told us,
  // and the card is open because they want to change it, not because we are unsure of it.
  stated: 'your answer',
}

/** Above this many options, the list gets a filter. An ATS country select has ~195. */
const FILTER_THRESHOLD = 8

export function mountAnswerCard(spec: AnswerCardSpec): CardHandle {
  const body = document.createElement('div')
  body.className = 'card-answer-body'

  // ── head ────────────────────────────────────────────────────────────────
  const head = document.createElement('div')
  head.className = 'answer-head'

  const why = document.createElement('span')
  why.className = 'answer-why'
  why.innerHTML = `${GLYPH.sparkle}<span>${escapeHtml(REASON_LABEL[spec.reason])}</span>`
  head.appendChild(why)

  const question = document.createElement('p')
  question.className = 'answer-question'
  question.id = 'aff-answer-question'
  question.textContent = spec.question
  head.appendChild(question)

  const close = document.createElement('button')
  close.type = 'button'
  close.className = 'card-close'
  close.setAttribute('aria-label', 'Close')
  close.innerHTML = GLYPH.close
  close.addEventListener('click', (event) => {
    event.preventDefault()
    event.stopPropagation()
    spec.onClose(true)
  })
  head.appendChild(close)
  body.appendChild(head)

  // ── the answer ──────────────────────────────────────────────────────────
  const answerBody = document.createElement('div')
  answerBody.className = 'answer-body'
  body.appendChild(answerBody)

  let current = spec.value
  const history: string[] = []

  const textarea = document.createElement('textarea')
  const optionsWrap = document.createElement('div')

  if (spec.mode === 'prose') {
    textarea.className = 'answer-text'
    textarea.setAttribute('aria-label', 'Answer')
    textarea.value = spec.value
    answerBody.appendChild(textarea)
  } else {
    const offered = spec.options ?? []

    if (offered.length > FILTER_THRESHOLD) {
      const filter = document.createElement('input')
      filter.type = 'text'
      filter.className = 'answer-filter'
      filter.placeholder = 'filter options'
      filter.setAttribute('aria-label', 'Filter options')
      filter.addEventListener('input', () => {
        const wanted = filter.value.trim().toLowerCase()
        for (const node of optionsWrap.children) {
          const option = node as HTMLElement
          const match = (option.textContent ?? '').toLowerCase().includes(wanted)
          option.style.display = match ? '' : 'none'
        }
      })
      answerBody.appendChild(filter)
    }

    optionsWrap.className = 'answer-options'
    // A single-choice group is a radiogroup; a multi-select is a plain group of checkboxes.
    optionsWrap.setAttribute('role', spec.multiple ? 'group' : 'radiogroup')
    optionsWrap.setAttribute('aria-label', spec.question)

    const selected = new Set(
      spec.value
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean),
    )

    for (const [index, label] of offered.entries()) {
      const option = document.createElement('button')
      option.type = 'button'
      option.className = 'answer-option'
      option.setAttribute('role', spec.multiple ? 'checkbox' : 'radio')
      option.setAttribute('aria-checked', String(selected.has(label)))
      // Roving tabindex: the group is one stop, arrows move within it.
      option.tabIndex = index === 0 ? 0 : -1
      option.textContent = label
      optionsWrap.appendChild(option)
    }

    answerBody.appendChild(optionsWrap)
  }

  // ── rewrite controls (prose only) ───────────────────────────────────────
  const nudge = document.createElement('div')
  nudge.className = 'answer-nudge'
  const ask = document.createElement('form')

  if (spec.mode === 'prose') {
    const rows: [string, readonly RewritePreset[]][] = [
      ['Tone', REWRITE_TONES],
      ['Length', REWRITE_LENGTHS],
    ]

    for (const [label, presets] of rows) {
      const row = document.createElement('div')
      row.className = 'answer-chips'
      row.setAttribute('role', 'group')
      row.setAttribute('aria-label', label)
      row.innerHTML = presets
        .map(
          (preset) =>
            `<button type="button" class="answer-chip" data-instruction="${escapeHtml(preset.instruction)}"${
              spec.lastInstruction === preset.instruction ? ' data-last="true"' : ''
            }>${escapeHtml(preset.label)}</button>`,
        )
        .join('')
      nudge.appendChild(row)
    }

    /**
     * A real form element, so Enter submits with no keydown handling of our own — and
     * `preventDefault` on its submit is what stops that Enter reaching the page's own form.
     */
    ask.className = 'answer-ask'
    const input = document.createElement('input')
    input.type = 'text'
    input.className = 'answer-ask-input'
    input.placeholder = 'tell it what to change'
    input.maxLength = MAX_INSTRUCTION_LENGTH
    input.setAttribute('aria-label', 'Tell it what to change')
    const go = document.createElement('button')
    go.type = 'submit'
    go.className = 'answer-ask-go'
    go.setAttribute('aria-label', 'Rewrite it')
    go.innerHTML = GLYPH.sparkle
    ask.appendChild(input)
    ask.appendChild(go)
    nudge.appendChild(ask)
    body.appendChild(nudge)
  }

  // ── note and actions ────────────────────────────────────────────────────
  const note = document.createElement('div')
  note.className = 'answer-note'
  note.id = 'aff-answer-note'
  // Polite, because a rewrite takes seconds and the wait has to be audible as well as visible.
  note.setAttribute('aria-live', 'polite')
  body.appendChild(note)

  const actions = document.createElement('div')
  actions.className = 'answer-actions'
  const keep = document.createElement('button')
  keep.type = 'button'
  keep.className = 'answer-keep'
  keep.textContent = 'Keep'
  const undo = document.createElement('button')
  undo.type = 'button'
  undo.className = 'answer-undo'
  undo.textContent = 'Undo'
  undo.disabled = true
  const clear = document.createElement('button')
  clear.type = 'button'
  clear.className = 'answer-clear'
  clear.textContent = 'Clear'
  actions.append(keep, undo, clear)
  body.appendChild(actions)

  const handle = mountCard(spec, body)
  handle.element.classList.add('card-answer')
  handle.element.setAttribute('aria-labelledby', question.id)
  handle.element.setAttribute('aria-describedby', note.id)
  /**
   * Deliberately not `aria-modal`. We do not own this page, and claiming to trap the whole
   * assistive-technology tree over somebody else's form would be a lie with consequences.
   */

  let edited = false
  let rewritten = false
  let writeTimer: ReturnType<typeof setTimeout> | null = null
  /** Bumped on every rewrite, so a reply that arrives after Stop is discarded. */
  let generation = 0
  let slowTimer: ReturnType<typeof setTimeout> | null = null

  const setNote = (text: string, tone?: 'bad' | 'good') => {
    note.textContent = text
    if (tone === 'bad') note.dataset.bad = 'true'
    else delete note.dataset.bad
    if (tone === 'good') note.dataset.good = 'true'
    else delete note.dataset.good
  }

  const setState = (state: 'idle' | 'dirty' | 'rewriting' | 'error' | 'settled') => {
    handle.element.dataset.state = state
    const busy = state === 'rewriting'
    for (const chip of handle.element.querySelectorAll<HTMLButtonElement>('.answer-chip')) {
      chip.disabled = busy
    }
    if (spec.mode === 'prose') {
      textarea.setAttribute('aria-busy', String(busy))
      const go = ask.querySelector<HTMLButtonElement>('.answer-ask-go')
      if (go) {
        go.dataset.stop = String(busy)
        go.setAttribute('aria-label', busy ? 'Stop rewriting' : 'Rewrite it')
      }
    }
    undo.disabled = history.length === 0
  }

  const commit = (next: string, options: { immediate?: boolean } = {}) => {
    current = next
    edited = true
    setState('dirty')

    const write = () => {
      void spec.onWrite(next).then((ok) => {
        if (!ok) {
          setNote("The page wouldn't take that.", 'bad')
          return
        }
        setNote('saved to the page', 'good')
        setTimeout(() => {
          if (note.textContent === 'saved to the page') setNote('')
        }, 1200)
      })
    }

    if (options.immediate) {
      write()
      return
    }
    if (writeTimer !== null) clearTimeout(writeTimer)
    writeTimer = setTimeout(write, WRITE_THROUGH_MS)
  }

  if (spec.mode === 'prose') {
    textarea.addEventListener('input', () => commit(textarea.value))
    textarea.addEventListener('keydown', (event) => {
      // Enter is a newline in an essay. Cmd/Ctrl+Enter is "done".
      if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        keep.click()
      }
    })
  } else {
    optionsWrap.addEventListener('click', (event) => {
      const option = (event.target as HTMLElement).closest<HTMLElement>('.answer-option')
      if (!option) return
      event.preventDefault()
      event.stopPropagation()

      const label = option.textContent ?? ''
      if (spec.multiple) {
        const on = option.getAttribute('aria-checked') === 'true'
        option.setAttribute('aria-checked', String(!on))
        const chosen = [...optionsWrap.children]
          .filter((node) => node.getAttribute('aria-checked') === 'true')
          .map((node) => node.textContent ?? '')
        history.push(current)
        commit(chosen.join(', '), { immediate: true })
      } else {
        for (const node of optionsWrap.children) node.setAttribute('aria-checked', 'false')
        option.setAttribute('aria-checked', 'true')
        history.push(current)
        commit(label, { immediate: true })
      }
    })

    // Roving tabindex, so the whole group is one tab stop.
    optionsWrap.addEventListener('keydown', (event) => {
      if (!['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'].includes(event.key)) return
      const items = [...optionsWrap.querySelectorAll<HTMLElement>('.answer-option')].filter(
        (node) => node.style.display !== 'none',
      )
      const index = items.findIndex((node) => node.tabIndex === 0)
      const step = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : -1
      const next = items[(index + step + items.length) % items.length]
      if (!next) return
      event.preventDefault()
      for (const item of items) item.tabIndex = -1
      next.tabIndex = 0
      next.focus()
    })
  }

  const runRewrite = (instruction: string) => {
    if (instruction.trim() === '') return
    const mine = ++generation

    setState('rewriting')
    setNote('Rewriting… this takes a few seconds.')
    if (slowTimer !== null) clearTimeout(slowTimer)
    slowTimer = setTimeout(() => {
      if (generation === mine) setNote("Still going — it's reading your notes.")
    }, SLOW_REWRITE_MS)

    void spec
      .onRewrite(instruction)
      .then((next) => {
        // Stopped, or superseded by a later rewrite. Dropping it is the point of `generation`.
        if (generation !== mine) return
        history.push(current)
        textarea.value = next
        rewritten = true
        setNote('')
        commit(next, { immediate: true })
      })
      .catch(() => {
        if (generation !== mine) return
        setState('error')
        setNote("That rewrite didn't come back. Your answer is unchanged.", 'bad')
      })
      .finally(() => {
        if (slowTimer !== null) clearTimeout(slowTimer)
        if (generation === mine && handle.element.dataset.state === 'rewriting') setState('dirty')
      })
  }

  if (spec.mode === 'prose') {
    ask.addEventListener('submit', (event) => {
      // Without this the Enter would reach the host page's own form and submit it.
      event.preventDefault()
      event.stopPropagation()
      const input = ask.querySelector<HTMLInputElement>('.answer-ask-input')
      if (!input) return

      if (handle.element.dataset.state === 'rewriting') {
        // Stop: bump the generation so the in-flight reply is discarded, and say so.
        generation += 1
        setState('dirty')
        setNote('Stopped. Your answer is unchanged.')
        return
      }

      runRewrite(input.value)
    })

    nudge.addEventListener('click', (event) => {
      const chip = (event.target as HTMLElement).closest<HTMLElement>('.answer-chip')
      if (!chip || chip.hasAttribute('disabled')) return
      event.preventDefault()
      event.stopPropagation()
      for (const other of nudge.querySelectorAll('.answer-chip')) {
        other.removeAttribute('data-last')
      }
      chip.dataset.last = 'true'
      runRewrite(chip.dataset.instruction ?? '')
    })
  }

  undo.addEventListener('click', (event) => {
    event.preventDefault()
    event.stopPropagation()
    const previous = history.pop()
    if (previous === undefined) return
    if (spec.mode === 'prose') textarea.value = previous
    rewritten = false
    commit(previous, { immediate: true })
    setNote('')
  })

  keep.addEventListener('click', (event) => {
    event.preventDefault()
    event.stopPropagation()
    if (writeTimer !== null) {
      // Never keep a value the page has not been given yet.
      clearTimeout(writeTimer)
      writeTimer = null
      void spec.onWrite(current)
    }
    setState('settled')
    spec.onKeep(current, { edited, rewritten })
  })

  clear.addEventListener('click', (event) => {
    event.preventDefault()
    event.stopPropagation()
    setState('settled')
    spec.onClear()
  })

  setState('idle')

  if (spec.mode === 'prose') {
    textarea.focus()
    textarea.setSelectionRange(textarea.value.length, textarea.value.length)
  } else {
    const checked = optionsWrap.querySelector<HTMLElement>('[aria-checked="true"]')
    const first = checked ?? optionsWrap.querySelector<HTMLElement>('.answer-option')
    if (first) {
      for (const node of optionsWrap.querySelectorAll<HTMLElement>('.answer-option')) {
        node.tabIndex = -1
      }
      first.tabIndex = 0
      first.focus()
    }
  }

  return {
    ...handle,
    close: () => {
      if (writeTimer !== null) clearTimeout(writeTimer)
      if (slowTimer !== null) clearTimeout(slowTimer)
      handle.close()
    },
  }
}
