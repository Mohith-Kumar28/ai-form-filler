import type { Profile } from '@aff/shared'
import { describe, expect, it } from 'vitest'
import { compileProfileDoc, estimateTokens, normalizeText } from './compile.js'

/**
 * These tests exist to protect the prompt cache. A regression here does not fail loudly —
 * it just silently turns every 0.1x cache read into a 1.25x cache write. Treat any failure
 * as a cost incident, not a formatting nit.
 */

function profile(overrides: Partial<Profile> = {}): Profile {
  return {
    identity: { links: {} },
    education: [],
    experience: [],
    skills: [],
    custom: {},
    style: { exemplars: [], avoid: [] },
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
    expect(a.hash).toBe(b.hash)
    expect(a.doc).toBe(b.doc)
  })

  it('is invariant to education array ordering', async () => {
    const entries = [
      { institution: 'MIT', degree: 'MS', endDate: '2024-06' },
      { institution: 'IIT', degree: 'BTech', endDate: '2021-05' },
      { institution: 'Cambridge', degree: 'PhD', endDate: '2027-01' },
    ]
    const forward = await compileProfileDoc(profile({ education: entries }))
    const reversed = await compileProfileDoc(profile({ education: [...entries].reverse() }))
    expect(forward.hash).toBe(reversed.hash)
  })

  it('breaks ties on equal dates so ordering is a total order, not a stable-sort accident', async () => {
    // Same endDate on both: without the label tiebreak, output would depend on input order.
    const a = { institution: 'Alpha University', degree: 'BSc', endDate: '2024-06' }
    const b = { institution: 'Beta College', degree: 'BSc', endDate: '2024-06' }
    const one = await compileProfileDoc(profile({ education: [a, b] }))
    const two = await compileProfileDoc(profile({ education: [b, a] }))
    expect(one.hash).toBe(two.hash)
  })

  it('is invariant to experience array ordering', async () => {
    const entries = [
      { company: 'Acme', title: 'Engineer', endDate: '2025-01', highlights: [] },
      { company: 'Globex', title: 'Senior Engineer', endDate: '2026-03', highlights: [] },
    ]
    const forward = await compileProfileDoc(profile({ experience: entries }))
    const reversed = await compileProfileDoc(profile({ experience: [...entries].reverse() }))
    expect(forward.hash).toBe(reversed.hash)
  })

  it('is invariant to link key insertion order', async () => {
    const one = await compileProfileDoc(
      profile({
        identity: {
          links: { github: 'https://github.com/a', linkedin: 'https://linkedin.com/in/a' },
        },
      }),
    )
    const two = await compileProfileDoc(
      profile({
        identity: {
          links: { linkedin: 'https://linkedin.com/in/a', github: 'https://github.com/a' },
        },
      }),
    )
    expect(one.hash).toBe(two.hash)
  })

  it('is invariant to custom-fact key insertion order', async () => {
    const one = await compileProfileDoc(profile({ custom: { visa: 'H1B', shirt: 'M' } }))
    const two = await compileProfileDoc(profile({ custom: { shirt: 'M', visa: 'H1B' } }))
    expect(one.hash).toBe(two.hash)
  })

  it('is invariant to source array ordering', async () => {
    const sources = [
      { label: 'resume.pdf', kind: 'resume', text: 'alpha' },
      { label: 'transcript.pdf', kind: 'transcript', text: 'beta' },
    ]
    const forward = await compileProfileDoc(profile(), sources)
    const reversed = await compileProfileDoc(profile(), [...sources].reverse())
    expect(forward.hash).toBe(reversed.hash)
  })

  it('is invariant to line-ending and trailing-space noise', async () => {
    // The invariant is that re-extracting the *same* document is byte-stable — a PDF parsed
    // on Windows, or with trailing spaces, must not shift the cache. Paragraph structure
    // (\n\n) is meaningful content and is deliberately preserved, not collapsed.
    const clean = await compileProfileDoc(profile(), [
      { label: 'r.pdf', kind: 'resume', text: 'Line one\nLine two' },
    ])
    const noisy = await compileProfileDoc(profile(), [
      { label: 'r.pdf', kind: 'resume', text: '  Line one  \r\n   Line two   \n' },
    ])
    expect(noisy.hash).toBe(clean.hash)
  })

  it('preserves paragraph breaks as meaningful structure', async () => {
    const singleBreak = await compileProfileDoc(profile(), [
      { label: 'r.pdf', kind: 'resume', text: 'Para one\nPara two' },
    ])
    const doubleBreak = await compileProfileDoc(profile(), [
      { label: 'r.pdf', kind: 'resume', text: 'Para one\n\nPara two' },
    ])
    expect(singleBreak.hash).not.toBe(doubleBreak.hash)
  })

  it('deduplicates skills case-insensitively regardless of input order', async () => {
    const one = await compileProfileDoc(profile({ skills: ['TypeScript', 'rust', 'typescript'] }))
    const two = await compileProfileDoc(profile({ skills: ['rust', 'typescript', 'TypeScript'] }))
    const three = await compileProfileDoc(profile({ skills: ['typescript', 'TypeScript', 'rust'] }))
    expect(one.hash).toBe(two.hash)
    expect(two.hash).toBe(three.hash)
    // One survivor per skill, sorted case-insensitively so rust precedes typescript.
    // Which casing survives is decided by the localeCompare tiebreak — arbitrary, but
    // identical for every input ordering, which is the only property that matters here.
    expect(one.doc).toContain('## Skills\nrust, typescript')
  })

  it('leaks no timestamp, date, or uuid into the document', async () => {
    const { doc } = await compileProfileDoc(profile({ identity: { fullName: 'Ada', links: {} } }), [
      { label: 'r.pdf', kind: 'resume', text: 'hello' },
    ])
    // ISO timestamps and UUIDs are the two things most likely to sneak in via a helper.
    expect(doc).not.toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/)
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
    expect(doc).not.toContain('## Education')
    expect(doc).not.toContain('## Skills')
  })

  it('returns an empty document for an empty profile', async () => {
    const { doc, estimatedTokens } = await compileProfileDoc(profile())
    expect(doc).toBe('')
    // profileReady gates on tokens > 0, so an empty profile must not look ready.
    expect(estimatedTokens).toBe(0)
  })

  it('renders education most-recent-first', async () => {
    const { doc } = await compileProfileDoc(
      profile({
        education: [
          { institution: 'Older School', endDate: '2019-05' },
          { institution: 'Newer School', endDate: '2025-05' },
        ],
      }),
    )
    expect(doc.indexOf('Newer School')).toBeLessThan(doc.indexOf('Older School'))
  })

  it('treats a missing end date as current and sorts it first', async () => {
    const { doc } = await compileProfileDoc(
      profile({
        experience: [
          { company: 'Past Co', title: 'Dev', endDate: '2024-01', highlights: [] },
          { company: 'Current Co', title: 'Dev', highlights: [] },
        ],
      }),
    )
    expect(doc.indexOf('Current Co')).toBeLessThan(doc.indexOf('Past Co'))
    expect(doc).toContain('present')
  })
})

describe('normalizeText', () => {
  it('strips zero-width characters that PDF extraction injects', () => {
    expect(normalizeText('he​llo﻿')).toBe('hello')
  })

  it('collapses blank-line runs to a single paragraph break', () => {
    expect(normalizeText('a\n\n\n\n\nb')).toBe('a\n\nb')
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
    expect(estimateTokens('x'.repeat(3600))).toBe(1000)
  })
})
