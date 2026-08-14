import { mountSeal } from '../src/overlay/field-seal.js'
import { mountFieldMark } from '../src/overlay/markers.js'
import { positionScheduler } from '../src/overlay/scheduler.js'
import { mountSlip } from '../src/overlay/slip.js'
import './stub-chrome.js'

/**
 * The on-page layer, on a page that is not ours.
 *
 * Every state at once — which is not the real experience, where at most one seal and one slip
 * exist — because the alternative is reviewing an injected overlay through six screenshots and
 * comparing them from memory. The states themselves are exactly what the content script mounts.
 */

const field = (id: string) => document.getElementById(id) as HTMLElement
const rectOf = (element: HTMLElement) => {
  const box = element.getBoundingClientRect()
  return { top: box.top, left: box.left, width: box.width, height: box.height }
}

// Two seals: one inside a wide field, one pushed outside a narrow one.
mountSeal(field('last'), () => undefined)
mountSeal(field('phone'), () => undefined)

mountSlip({
  kind: 'menu',
  anchor: rectOf(field('auth')),
  label: 'Fill',
  question: 'Do you require visa sponsorship?',
  actions: [
    { id: 'field', label: 'Fill this field', glyph: 'pen' },
    { id: 'form', label: 'Fill all 12 fields', glyph: 'form' },
    { id: 'panel', label: 'Open the panel', glyph: 'panel', quiet: true },
    { id: 'mute', label: 'Not on this site', glyph: 'mute', quiet: true },
  ],
  onSelect: () => undefined,
  onClose: () => undefined,
})

// The wait: what the page shows while the model is thinking and nothing else moves.
mountSlip({
  kind: 'progress',
  anchor: rectOf(field('auth')),
  label: 'Autofill',
  stage: 'generating',
  fieldCount: 12,
  onSelect: () => undefined,
  onClose: () => undefined,
})

mountSlip({
  kind: 'review',
  anchor: rectOf(field('why')),
  label: 'Review this answer',
  question: 'Why do you want to work at Alderman & Roe?',
  value:
    'I spent four years at Kestrel Health rebuilding a claims pipeline that nobody wanted to touch, and the part I liked was the archaeology.',
  concluded: true,
  confidence: 0.58,
  onValueChange: () => undefined,
  onImprove: () => Promise.resolve('Rewritten answer.'),
  onSelect: () => undefined,
  onClose: () => undefined,
})

for (const [id, state] of [
  ['start', 'printed'],
  ['salary', 'endorsed'],
  ['hear', 'unsure'],
] as const) {
  mountFieldMark(field(id), () => undefined).setState(state)
}

/**
 * Pump a few frames before anyone screenshots this.
 *
 * The position scheduler places everything on its first animation frame, which a real browser
 * delivers within 16ms and then keeps delivering forever. Headless Chrome under
 * `--virtual-time-budget` only advances time while work is pending, so a static page can be
 * captured before the first frame has run and the overlay appears stacked at the page origin.
 * This is harness scaffolding for a deterministic capture, not a workaround for a real defect —
 * see `scheduler.test.ts` for the seeding rule that makes that first frame sufficient.
 */
for (const delay of [0, 120, 400]) {
  setTimeout(() => positionScheduler.requestMeasure(), delay)
}

/**
 * Pump a few frames before anyone screenshots this.
 *
 * The position scheduler places everything on its first animation frame, which a real browser
 * delivers within 16ms and then keeps delivering forever. Headless Chrome under
 * `--virtual-time-budget` only advances time while work is pending, so a static page can be
 * captured before the first frame has run and the overlay appears stacked at the page origin.
 * This is harness scaffolding for a deterministic capture, not a workaround for a real defect —
 * see `scheduler.test.ts` for the seeding rule that makes that first frame sufficient.
 */
for (const delay of [0, 120, 400]) {
  setTimeout(() => positionScheduler.requestMeasure(), delay)
}

if (new URLSearchParams(location.search).has('probe')) {
  const log: string[] = []
  const snap = (t: number) => log.push(`${t}: ${sealWide.element.style.transform || '(none)'}`)
  requestAnimationFrame(() => snap(-1))
  for (const t of [0, 50, 200, 500, 1100, 2000]) setTimeout(() => snap(t), t)
  setTimeout(() => {
    const out = document.createElement('pre')
    out.id = 'probe'
    out.textContent = log.join(' | ')
    document.body.appendChild(out)
  }, 2500)
}
