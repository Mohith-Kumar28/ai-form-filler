import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

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

describe('anchored elements', () => {
  /**
   * Anything positioned by the scheduler is placed with `translate`. `transform` is reserved
   * for nothing here, precisely so a future animation cannot quietly reclaim it.
   */
  it.each([
    ['field-seal.ts', 'seal.style.translate'],
    ['markers.ts', 'mark.style.translate'],
    ['markers.ts', 'tab.style.translate'],
  ])('%s places with %s', (file, expression) => {
    const contents = readFileSync(resolve(process.cwd(), 'src/overlay', file), 'utf8')
    expect(contents).toContain(expression)
    expect(contents).not.toMatch(/\.style\.transform\s*=/)
  })
})
