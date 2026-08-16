import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { cssName, DARK, detectPageScheme, LIGHT, overlayVariables, TOKEN_NAMES } from './tokens.js'

const css = readFileSync(resolve(process.cwd(), 'src/assets/tailwind.css'), 'utf8')

describe('token parity', () => {
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
    expect(out).toContain(`--aff-surface: ${LIGHT.surface};`)
    expect(out).toContain(`--aff-surface: ${DARK.surface};`)
  })

  it('keys the scheme to the host page, never to prefers-color-scheme', () => {
    expect(out).toContain(':host([data-scheme="dark"])')
    expect(out).not.toContain('prefers-color-scheme')
  })

  it('kebab-cases compound token names', () => {
    expect(out).toContain(`--aff-border-muted: ${LIGHT.borderMuted};`)
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

  it('walks past a transparent body to the element that is actually painted', () => {
    expect(detectPageScheme(fakeWindow(['rgba(0, 0, 0, 0)', 'rgb(18, 18, 18)']))).toBe('dark')
  })

  it('weights channels perceptually rather than averaging them', () => {
    expect(detectPageScheme(fakeWindow(['rgb(20, 40, 200)']))).toBe('dark')
    expect(detectPageScheme(fakeWindow(['rgb(250, 240, 120)']))).toBe('light')
  })

  it('falls back to the OS only when the page declares nothing', () => {
    expect(detectPageScheme(fakeWindow(['rgba(0, 0, 0, 0)', 'rgba(0, 0, 0, 0)'], true))).toBe(
      'dark',
    )
    expect(detectPageScheme(fakeWindow(['rgba(0, 0, 0, 0)', 'rgba(0, 0, 0, 0)'], false))).toBe(
      'light',
    )
  })
})
