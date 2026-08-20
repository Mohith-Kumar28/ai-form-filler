import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { isOverlayEvent } from './host.js'

const source = readFileSync(resolve(process.cwd(), 'src/overlay/host.ts'), 'utf8')

/**
 * The regression this file exists for.
 *
 * `seal-in` and `tab-stamp` used to animate `transform`, with `animation-fill-mode: both`. A
 * filled animation holds its final value indefinitely and outranks an inline style, so every
 * seal and every endorsement stamp had its `transform: translate(x, y)` placement overwritten
 * by the keyframe's `transform: none` the moment the entrance finished — and the whole overlay
 * stacked silently in the top-left corner of the page. Nothing threw, and every position the
 * code computed was correct.
 *
 * Placement now uses the standalone `translate` property and the animations use `scale` and
 * `rotate`, which compose into the same matrix without overwriting one another.
 */
describe('overlay keyframes', () => {
  const keyframeBlocks = source.match(/@keyframes[^{]+\{[\s\S]*?\n\}/g) ?? []

  it('declares keyframes at all, so this test cannot pass vacuously', () => {
    expect(keyframeBlocks.length).toBeGreaterThanOrEqual(4)
  })

  it.each(keyframeBlocks.map((block) => [block.match(/@keyframes\s+([\w-]+)/)?.[1], block]))(
    '%s never animates the transform shorthand',
    (_name, block) => {
      expect(block).not.toMatch(/\btransform\s*:/)
    },
  )
})

/**
 * The regression this describe block exists for.
 *
 * A **closed** shadow root is opaque to `composedPath()` for any listener outside it: the
 * deepest node such a listener can see is the host element. The outside-click dismissal used
 * to ask `slipElement.contains(node)` of that path, which answered `false` for clicks on our
 * own menu — so `pointerdown` tore the slip down before its `click` handler could run, and
 * every item in the popover did nothing, on every site, without throwing.
 */
describe('isOverlayEvent', () => {
  const pathEvent = (path: unknown[]) => ({ composedPath: () => path }) as unknown as Event

  it('recognises an event that passed through the overlay host', () => {
    const host = document.createElement('div')
    host.id = 'aff-overlay-host'
    expect(isOverlayEvent(pathEvent([host, document.body]))).toBe(true)
  })

  /** The realistic shape: the closed root collapses to the host, and nothing deeper is visible. */
  it('recognises it even when the closed root hides everything inside', () => {
    const host = document.createElement('div')
    host.id = 'aff-overlay-host'
    expect(isOverlayEvent(pathEvent([host, document.documentElement, window]))).toBe(true)
  })

  it('does not claim an ordinary page click', () => {
    const input = document.createElement('input')
    expect(isOverlayEvent(pathEvent([input, document.body, document.documentElement]))).toBe(false)
  })

  it('is not fooled by a page element that merely looks like ours', () => {
    const decoy = document.createElement('div')
    decoy.className = 'aff-overlay-host'
    expect(isOverlayEvent(pathEvent([decoy, document.body]))).toBe(false)
  })
})

describe('anchored elements', () => {
  /**
   * Anything positioned by the scheduler is placed with `translate`. `transform` is reserved
   * for nothing here, precisely so a future animation cannot quietly reclaim it.
   *
   * Matched as an **assignment**, not a substring. The substring form passed vacuously the
   * moment a docstring quoted the old buggy placement line — a test that goes green off a
   * comment is worse than no test, because it reports that it checked something.
   */
  it.each([
    ['launcher.ts', 'wrap'],
    ['markers.ts', 'mark'],
    ['markers.ts', 'tab'],
  ])('%s places %s with the standalone translate property', (file, variable) => {
    const contents = readFileSync(resolve(process.cwd(), 'src/overlay', file), 'utf8')
    expect(contents).toMatch(new RegExp(`\\b${variable}\\.style\\.translate\\s*=`))
    expect(contents).not.toMatch(/\.style\.transform\s*=/)
  })
})

/**
 * The other half of the same trap, one property over.
 *
 * `translate` is now *placement* for everything the scheduler anchors, so a keyframe animating
 * it with `fill-mode: both` would hold its final value forever and outrank the inline position
 * — reproducing the exact top-left-corner failure the transform rule was written for.
 *
 * Scoped to the animations those elements actually use, rather than every keyframe in the file.
 * Confetti is the reason: it is positioned once and thrown away, animates `translate` on
 * purpose, and is anchored to nothing. A flat rule would have to either fail on it or be
 * deleted, and both lose the guard.
 */
describe('keyframes never fight placement', () => {
  /** Everything placed by `positionScheduler`, i.e. everything whose `translate` is a position. */
  const ANCHORED = ['.mark', '.answer-tab', '.card', '.launcher-wrap', '.field-trigger']

  /** Animation names referenced by any rule whose selector list mentions an anchored class. */
  const animations = new Set<string>()
  // Destructured past index 0: that is the whole match, and reading it as the selector made
  // `body` the selector text — which contains no declarations, so the set came out empty.
  for (const [, selector, body] of source.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (!selector || !body) continue
    if (!ANCHORED.some((cls) => selector.includes(cls))) continue
    const declared = body.match(/animation\s*:\s*([^;]+)/)
    if (!declared) continue
    const name = declared[1]?.trim().split(/\s+/)[0]
    if (name && name !== 'none') animations.add(name)
  }

  it('found the animations the anchored elements use, so this cannot pass vacuously', () => {
    expect(animations.size).toBeGreaterThanOrEqual(3)
  })

  it.each([...animations])('%s does not animate translate', (name) => {
    const block = source.match(new RegExp(`@keyframes\\s+${name}\\s*\\{[\\s\\S]*?\\n\\}`))
    expect(block).not.toBeNull()
    expect(block?.[0]).not.toMatch(/\btranslate\s*:/)
  })
})
