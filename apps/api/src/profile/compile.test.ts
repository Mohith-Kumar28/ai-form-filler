import type { Profile } from '@aff/shared'
import { describe, expect, it } from 'vitest'
import { compileProfileDoc, estimateTokens, normalizeText } from './compile.js'

/**
 * These tests exist to protect the prompt cache. A regression here does not fail loudly —
 * it just silently turns every 0.1x cache read into a 1.25x cache write. Treat any failure
 * as a cost incident, not a formatting nit.
 *
 * The document is much smaller than it was: history, skills, preferences, writing voice, and
 * full source text now come from memory retrieval instead of being compiled in. What is left
 * is what has to be present before any retrieval happens — identity and the user's own facts
 * — and it is held to the same determinism rules, because it is still the cached prefix.
 */

function profile(overrides: Partial<Profile> = {}): Profile {
  return {
    identity: { links: {} },
    custom: {},
    learned: [],
    sources: [],
    version: 0,
    ...overrides,
  }
}

describe('compileProfileDoc determinism', () => {
  it('produces identical bytes for the same input', async () => {
    const p = profile({ identity: { fullName: 'Ada Lovelace', links: {} } })
    const a = await compileProfileDoc(p)
    const b = await compileProfileDoc(p)

    expect(a.doc).toBe(b.doc)
    expect(a.hash).toBe(b.hash)
  })

  it('is invariant to link key insertion order', async () => {
    // Object key order is insertion order in JS, so two profiles that are semantically
    // identical would otherwise hash differently depending on how they were assembled.
    const forward = await compileProfileDoc(
      profile({
        identity: {
          links: { github: 'https://gh/a', linkedin: 'https://li/a', website: 'https://w/a' },
        },
      }),
    )
    const reverse = await compileProfileDoc(
      profile({
        identity: {
          links: { website: 'https://w/a', linkedin: 'https://li/a', github: 'https://gh/a' },
        },
      }),
    )

    expect(forward.hash).toBe(reverse.hash)
  })

  it('is invariant to custom-fact key insertion order', async () => {
    const a = await compileProfileDoc(profile({ custom: { visa: 'H-1B', shirt: 'M' } }))
    const b = await compileProfileDoc(profile({ custom: { shirt: 'M', visa: 'H-1B' } }))

    expect(a.hash).toBe(b.hash)
  })

  it('leaks no timestamp, date, or uuid into the document', async () => {
    const { doc } = await compileProfileDoc(
      profile({
        identity: { fullName: 'Ada Lovelace', email: 'ada@example.com', links: {} },
        custom: { visa: 'H-1B' },
      }),
    )

    expect(doc).not.toMatch(/\d{4}-\d{2}-\d{2}T/)
    expect(doc).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}/i)
  })
})

describe('compileProfileDoc content', () => {
  it('changes the hash when content actually changes', async () => {
    const before = await compileProfileDoc(profile({ identity: { fullName: 'Ada', links: {} } }))
    const after = await compileProfileDoc(profile({ identity: { fullName: 'Grace', links: {} } }))

    expect(before.hash).not.toBe(after.hash)
  })

  it('omits empty sections rather than emitting bare headings', async () => {
    const { doc } = await compileProfileDoc(profile({ identity: { fullName: 'Ada', links: {} } }))

    expect(doc).toContain('## Identity')
    expect(doc).not.toContain('## Other facts')
  })

  it('returns an empty document for an empty profile', async () => {
    const { doc, estimatedTokens } = await compileProfileDoc(profile())

    expect(doc).toBe('')
    expect(estimatedTokens).toBe(0)
  })

  it('carries the identity fields tier 0 answers without a model call', async () => {
    // If these stop being rendered, every email and phone field silently escalates to a
    // paid tier and starts being answered by inference instead of lookup.
    const { doc } = await compileProfileDoc(
      profile({
        identity: {
          fullName: 'Ada Lovelace',
          email: 'ada@example.com',
          phone: '+1 555 0100',
          links: {},
        },
      }),
    )

    expect(doc).toContain('Ada Lovelace')
    expect(doc).toContain('ada@example.com')
    expect(doc).toContain('+1 555 0100')
  })

  it("keeps the user's own facts, which nothing else records", async () => {
    const { doc } = await compileProfileDoc(profile({ custom: { 'Notice period': '30 days' } }))

    expect(doc).toContain('Notice period: 30 days')
  })

  it('stays small enough to be worth caching on every request', async () => {
    // The whole point of the cut: this used to inline every source document. A profile doc
    // that grows with the corpus is one that costs more the more the user adds.
    const { estimatedTokens } = await compileProfileDoc(
      profile({
        identity: {
          fullName: 'Ada Lovelace',
          email: 'ada@example.com',
          phone: '+1 555 0100',
          location: 'London',
          links: { github: 'https://gh/ada', website: 'https://ada.dev' },
        },
        custom: { 'Notice period': '30 days', Visa: 'H-1B' },
      }),
    )

    expect(estimatedTokens).toBeLessThan(200)
  })
})

describe('normalizeText', () => {
  it('strips zero-width characters that PDF extraction injects', () => {
    expect(normalizeText('a​b‌c')).toBe('abc')
  })

  it('collapses blank-line runs to a single paragraph break', () => {
    expect(normalizeText('a\n\n\n\nb')).toBe('a\n\nb')
  })

  it('normalises CRLF so the same file parsed on Windows matches', () => {
    expect(normalizeText('a\r\nb')).toBe(normalizeText('a\nb'))
  })
})

describe('estimateTokens', () => {
  it('reports zero for empty input', () => {
    expect(estimateTokens('')).toBe(0)
  })

  it('scales roughly linearly with length', () => {
    expect(estimateTokens('x'.repeat(360))).toBe(100)
  })
})
