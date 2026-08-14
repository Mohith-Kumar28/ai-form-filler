import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  cssName,
  DARK,
  detectPageScheme,
  guillocheDataUri,
  LIGHT,
  overlayVariables,
  TOKEN_NAMES,
} from './tokens.js'

// Resolved from the vitest root (apps/extension) rather than `import.meta.url`: the happy-dom
// environment rewrites that to a non-file URL and `fileURLToPath` throws.
const css = readFileSync(resolve(process.cwd(), 'src/assets/tailwind.css'), 'utf8')

/**
 * Tailwind v4 configures itself in CSS, so the panel's palette cannot import the TS module the
 * overlay uses. That is exactly how the previous build ended up with two palettes that had
 * silently diverged — DESIGN.md documented tokens (`quad`, `graphite`) the stylesheet no
 * longer had. This is the seam that stops it happening again.
 */
describe('token parity', () => {
  /** The first `@theme` block is light; the one nested in the dark media query is dark. */
  const darkIndex = css.indexOf('@media (prefers-color-scheme: dark)')
  const lightBlock = css.slice(0, darkIndex)
  const darkBlock = css.slice(darkIndex)

  it.each(TOKEN_NAMES)('light --color-%s matches tokens.ts', (token) => {
    expect(lightBlock).toContain(`--color-${cssName(token)}: ${LIGHT[token]};`)
  })

  it.each(TOKEN_NAMES)('dark --color-%s matches tokens.ts', (token) => {
    expect(darkBlock).toContain(`--color-${cssName(token)}: ${DARK[token]};`)
  })

  it('declares every token in both schemes', () => {
    for (const token of TOKEN_NAMES) {
      const occurrences = css.split(`--color-${cssName(token)}:`).length - 1
      expect(occurrences, `--color-${cssName(token)}`).toBe(2)
    }
  })
})

describe('overlayVariables', () => {
  const out = overlayVariables()

  it('emits both schemes against the shadow host', () => {
    expect(out).toContain(`--aff-ink: ${LIGHT.ink};`)
    expect(out).toContain(`--aff-ink: ${DARK.ink};`)
  })

  /**
   * The overlay is a guest on a page we do not control, so it follows that page rather than
   * the operating system — a near-black slip on a white job application is a visitor
   * announcing itself. A media query here would take the decision away from the host page.
   */
  it('keys the scheme to the host page, never to prefers-color-scheme', () => {
    expect(out).toContain(':host([data-scheme="dark"])')
    expect(out).not.toContain('prefers-color-scheme')
  })

  it('kebab-cases compound token names', () => {
    expect(out).toContain(`--aff-guilloche-soft: ${LIGHT.guillocheSoft};`)
  })
})

describe('detectPageScheme', () => {
  const fakeWindow = (backgrounds: string[], prefersDark = false) => {
    let index = 0
    return {
      document: { body: {}, documentElement: {} },
      getComputedStyle: () => ({ backgroundColor: backgrounds[index++] ?? 'rgba(0, 0, 0, 0)' }),
      matchMedia: () => ({ matches: prefersDark }),
    } as unknown as Window
  }

  it('reads a white page as light', () => {
    expect(detectPageScheme(fakeWindow(['rgb(255, 255, 255)']))).toBe('light')
  })

  it('reads a near-black page as dark', () => {
    expect(detectPageScheme(fakeWindow(['rgb(13, 17, 23)']))).toBe('dark')
  })

  /** Many sites leave `body` transparent and colour `html`, or the other way round. */
  it('walks past a transparent body to the element that is actually painted', () => {
    expect(detectPageScheme(fakeWindow(['rgba(0, 0, 0, 0)', 'rgb(18, 18, 18)']))).toBe('dark')
  })

  /** Perceptual weighting: a saturated blue is dark even though its average channel is not. */
  it('weights channels perceptually rather than averaging them', () => {
    expect(detectPageScheme(fakeWindow(['rgb(20, 40, 200)']))).toBe('dark')
    expect(detectPageScheme(fakeWindow(['rgb(250, 240, 120)']))).toBe('light')
  })

  it('falls back to the OS only when the page declares nothing', () => {
    expect(detectPageScheme(fakeWindow(['rgba(0, 0, 0, 0)', 'rgba(0, 0, 0, 0)'], true))).toBe('dark')
    expect(detectPageScheme(fakeWindow(['rgba(0, 0, 0, 0)', 'rgba(0, 0, 0, 0)'], false))).toBe(
      'light',
    )
  })
})

describe('guillocheDataUri', () => {
  const svg = decodeURIComponent(guillocheDataUri('#000'))

  it('superimposes three rings, which is what produces the interference beat', () => {
    expect(guillocheDataUri('#000').startsWith('url("data:image/svg+xml,')).toBe(true)
    expect(svg.match(/<polyline/g)).toHaveLength(3)
  })

  /**
   * The regression this exists for.
   *
   * The first version was a seven-lobe rose curve at 0.38 amplitude and rendered as a field of
   * daisies. Engine turning is a *shallow* disturbance of a circle — the eye reads a ring
   * first and the pattern second — and the only thing separating the two is how far each
   * curve's radius swings. Anything above about 15% is a flower.
   */
  it('keeps every ring shallow enough to read as a ring, not a petal', () => {
    const polylines = svg.match(/points="([^"]+)"/g) ?? []
    expect(polylines.length).toBeGreaterThan(0)

    for (const [index, polyline] of polylines.entries()) {
      const radii = (polyline.match(/[\d.]+,[\d.]+/g) ?? []).map((pair) => {
        const [x, y] = pair.split(',').map(Number)
        return Math.hypot((x as number) - 52, (y as number) - 52)
      })

      const swing = Math.max(...radii) / Math.min(...radii)
      expect(swing, `ring ${index}`).toBeLessThan(1.3)
    }
  })

  it('carries the requested stroke through', () => {
    expect(decodeURIComponent(guillocheDataUri('oklch(50% 0 0)'))).toContain('oklch(50% 0 0)')
  })
})
