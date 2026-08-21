import { mountAnswerCard, mountMenuCard, mountSuggestCard } from '../src/overlay/card.js'
import { mountLauncher } from '../src/overlay/launcher.js'
import { mountFieldMark } from '../src/overlay/markers.js'
import { positionScheduler } from '../src/overlay/scheduler.js'
import './stub-chrome.js'

/**
 * The on-page layer, on a page that is not ours.
 *
 * Every state at once — because the alternative is reviewing an injected overlay through
 * multiple screenshots and comparing them from memory. The states themselves are exactly what
 * the content script mounts.
 *
 * ### Query parameters
 *
 *   `?dark`     repaints the fake site dark — handled by the inline script in overlay.html,
 *               which has to run before this module so the scheme is settled when the host
 *               mounts. `detectPageScheme()` reads the *page's* background luminance, because
 *               that is the only signal available on a site we do not control.
 *   `?state=…`  which answer-card state to mount: idle, dirty, rewriting, error, choose, many.
 *               Defaults to idle.
 *   `?only=suggest` mounts only the inline suggestion, which is otherwise underneath the
 *               launcher's menu.
 *   `?only=marks` mounts the field marks and nothing else. The cards are anchored to the very
 *               fields the judged marks sit on, so with everything up at once the provenance
 *               tabs are underneath a popover and cannot be reviewed at all.
 */

const params = new URLSearchParams(location.search)

const field = (id: string) => document.getElementById(id) as HTMLElement
const rectOf = (element: HTMLElement) => {
  const box = element.getBoundingClientRect()
  return { top: box.top, left: box.left, width: box.width, height: box.height }
}

const only = params.get('only')
const marksOnly = only === 'marks'
const suggestOnly = only === 'suggest'

/**
 * The inline suggestion, on the one empty field.
 *
 * Its own `only` mode because it anchors under `phone`, where the launcher's menu also lands, and
 * the whole point of this card is how little space it takes — impossible to judge with a four-item
 * menu drawn over it.
 */
if (suggestOnly) {
  mountSuggestCard({
    kind: 'suggest',
    anchor: rectOf(field('auth')),
    value: 'No, I have the right to work in the UK',
    onSelect: () => undefined,
    onClose: () => undefined,
  })
  mountSuggestCard({
    kind: 'suggest',
    anchor: rectOf(field('phone')),
    value: 'Mohith',
    onSelect: () => undefined,
    onClose: () => undefined,
  })
}

const launcher = mountLauncher({
  onOpen: () => undefined,
  onStop: () => undefined,
})
launcher.setFieldCount(12)

// The launcher's menu, anchored near a field.
if (!marksOnly && !suggestOnly)
  mountMenuCard({
    kind: 'menu',
    anchor: rectOf(field('auth')),
    question: 'Do you require visa sponsorship?',
    actions: [
      { id: 'field', label: 'Fill this field', glyph: 'sparkle' },
      { id: 'form', label: 'Fill all 12 fields', glyph: 'form' },
      { id: 'panel', label: 'Open the panel', glyph: 'panel' },
      { id: 'mute', label: 'Not on this site', glyph: 'mute' },
    ],
    onSelect: () => undefined,
    onClose: () => undefined,
  })

/**
 * Field marks, one per state.
 *
 * `stated` is here to be looked at and found *absent* after a second and a half — the Unmarked
 * Fact Rule is a claim about what is not drawn, so it needs a case in the harness as much as
 * anything visible does.
 */
const MARKS = [
  ['start', 'stated', undefined],
  ['salary', 'judged', 'inferred'],
  ['hear', 'judged', 'unsure'],
] as const

for (const [id, state, reason] of MARKS) {
  const mark = mountFieldMark(field(id), {
    ...(reason ? { reason } : {}),
    onOpen: () => undefined,
    // Passed so the tick renders: the real caller only supplies it for a judged answer.
    onAccept: () => undefined,
  })
  mark.setState(state)
}

/**
 * The answer card, in whichever state was asked for.
 *
 * `rewriting` resolves after four seconds rather than instantly, because the real call takes
 * seconds and a pending state that flickers past is not a pending state anybody has reviewed.
 */
const state = params.get('state') ?? 'idle'

const LONG_ANSWER =
  'I spent four years at Kestrel Health rebuilding a claims pipeline that nobody wanted to touch, and the part I liked was the archaeology.'

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

if (marksOnly || suggestOnly) {
  // Nothing else. The marks, or the suggestion, are the subject.
} else if (state === 'choose' || state === 'many') {
  const options =
    state === 'many'
      ? Array.from({ length: 40 }, (_, index) => `Option ${index + 1}`)
      : ['iOS', 'Android', 'Web']

  mountAnswerCard({
    kind: 'answer',
    anchor: rectOf(field('hear')),
    anchorElement: field('hear'),
    question: 'Which platform do you primarily build for?',
    value: state === 'many' ? 'Option 7' : 'iOS',
    reason: 'inferred',
    mode: 'choose',
    options,
    multiple: false,
    onWrite: () => Promise.resolve(true),
    onRewrite: () => Promise.resolve(''),
    onKeep: () => undefined,
    onClear: () => undefined,
    onClose: () => undefined,
  })
} else {
  const card = mountAnswerCard({
    kind: 'answer',
    anchor: rectOf(field('why')),
    anchorElement: field('why'),
    question: 'Why do you want to work at Alderman & Roe?',
    value: LONG_ANSWER,
    reason: 'inferred',
    mode: 'prose',
    ...(state === 'rewriting' ? { lastInstruction: 'Make it warmer and more human.' } : {}),
    onWrite: () => Promise.resolve(state !== 'error'),
    onRewrite: async () => {
      await wait(4000)
      if (state === 'error') throw new Error('failed')
      return 'A rewritten answer, in the same voice but half the length.'
    },
    onKeep: () => undefined,
    onClear: () => undefined,
    onClose: () => undefined,
  })

  // Drive the card into the requested state, the same way a person would.
  const press = (selector: string) =>
    card.element
      .querySelector<HTMLElement>(selector)
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))

  if (state === 'dirty' || state === 'rewriting' || state === 'error') {
    const textarea = card.element.querySelector<HTMLTextAreaElement>('.answer-text')
    if (textarea) {
      textarea.value = `${LONG_ANSWER} And I have been reading the changelog since 2019.`
      textarea.dispatchEvent(new Event('input', { bubbles: true }))
    }
  }

  if (state === 'rewriting' || state === 'error') {
    setTimeout(() => press('.answer-chip'), 60)
  }
}

// Pump frames so the position scheduler has time to place everything before a screenshot.
for (const delay of [0, 120, 400]) {
  setTimeout(() => positionScheduler.requestMeasure(), delay)
}
