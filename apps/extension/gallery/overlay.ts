import { mountMenuCard, mountReviewCard } from '../src/overlay/card.js'
import { mountLauncher } from '../src/overlay/launcher.js'
import { mountFieldMark } from '../src/overlay/markers.js'
import { positionScheduler } from '../src/overlay/scheduler.js'
import './stub-chrome.js'

/**
 * The on-page layer, on a page that is not ours.
 *
 * Every state at once — because the alternative is reviewing an injected overlay through
 * multiple screenshots and comparing them from memory. The states themselves are exactly
 * what the content script mounts.
 */

const field = (id: string) => document.getElementById(id) as HTMLElement
const rectOf = (element: HTMLElement) => {
  const box = element.getBoundingClientRect()
  return { top: box.top, left: box.left, width: box.width, height: box.height }
}

// The launcher pill on a form.
mountLauncher({
  fieldCount: 12,
  onOpen: () => undefined,
  onReview: () => undefined,
})

// Menu card anchored near the last field.
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

// Review card on a concluded answer.
mountReviewCard({
  kind: 'review',
  anchor: rectOf(field('why')),
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

// Field marks with the new states.
for (const [id, state] of [
  ['start', 'filled'],
  ['salary', 'guessed'],
  ['hear', 'guessed'],
] as const) {
  mountFieldMark(field(id), () => undefined).setState(state)
}

// Pump frames so the position scheduler has time to place everything before a screenshot.
for (const delay of [0, 120, 400]) {
  setTimeout(() => positionScheduler.requestMeasure(), delay)
}
