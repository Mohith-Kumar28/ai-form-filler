import { describe, expect, it } from 'vitest'
import {
  CATALOG,
  CATALOG_INDEX,
  customFactCount,
  fieldFor,
  maskValue,
  normaliseKey,
  reconcile,
  SECTIONS,
  sectionProgress,
  toPatch,
} from './fact-catalog.js'

describe('normaliseKey', () => {
  it('collapses the four spellings that used to be four separate facts', () => {
    const forms = ['Notice period', 'notice period', 'Notice Period ', 'notice_period']
    expect(new Set(forms.map(normaliseKey)).size).toBe(1)
  })

  it('strips punctuation and casing but keeps digits', () => {
    expect(normaliseKey('Address line 1')).toBe('addressline1')
    expect(normaliseKey('  PAN-Number  ')).toBe('pannumber')
  })
})

describe('the catalogue itself', () => {
  it('has no duplicate canonical keys', () => {
    const keys = CATALOG.map((f) => f.key)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('gives every field a section that exists', () => {
    const known = new Set(SECTIONS.map((s) => s.section))
    for (const field of CATALOG) expect(known.has(field.section)).toBe(true)
  })

  it('never lets two fields claim the same match rank', () => {
    const ranks = CATALOG.filter((f) => f.match).map((f) => f.match?.rank)
    expect(new Set(ranks).size).toBe(ranks.length)
  })

  it('resolves every alias to exactly one field', () => {
    for (const field of CATALOG) {
      for (const alias of field.aliases ?? []) {
        // An alias may be shadowed by another field's canonical key, but must never be lost.
        expect(CATALOG_INDEX.get(normaliseKey(alias))).toBeDefined()
      }
    }
  })

  it('resolves a canonical key to its own field, never to an alias holder', () => {
    for (const field of CATALOG) expect(fieldFor(field.key)).toBe(field)
  })
})

describe('reconcile', () => {
  it('folds a stray LLM-invented link platform into the real one', () => {
    const out = reconcile({
      identity: {
        links: { linkedin: '', LinkedIn: 'https://linkedin.com/in/ife' },
      },
      custom: {},
    })

    expect(out.values.linkedin).toBe('https://linkedin.com/in/ife')
    expect(out.merged).toContain('LinkedIn')
    expect(out.extraLinks).toEqual({})
  })

  it('folds a hand-typed fact that names an identity field', () => {
    const out = reconcile({
      identity: { email: '', links: {} },
      custom: { Email: 'ife@example.com' },
    })

    expect(out.values.email).toBe('ife@example.com')
    expect(out.extras).toEqual({})
    expect(out.merged).toContain('Email')
  })

  it('lets the canonical store win when both values are filled', () => {
    const out = reconcile({
      identity: { email: 'real@example.com', links: {} },
      custom: { 'e-mail': 'stale@example.com' },
    })

    expect(out.values.email).toBe('real@example.com')
    expect(out.merged).toContain('e-mail')
  })

  it('prefers a filled value over an empty one regardless of store', () => {
    const out = reconcile({
      identity: { phone: '', links: {} },
      custom: { 'Contact number': '+91 98765 43210' },
    })

    expect(out.values.phone).toBe('+91 98765 43210')
  })

  it('merges case and whitespace variants of the same custom fact', () => {
    const out = reconcile({
      identity: { links: {} },
      custom: { 'Notice period': '2 months', notice_period: '', 'Notice Period ': '' },
    })

    expect(out.values['Notice period']).toBe('2 months')
    expect(Object.keys(out.extras)).toEqual([])
    expect(out.merged).toEqual(['Notice Period ', 'notice_period'])
  })

  it('does not report a field as merged just for losing to itself', () => {
    const out = reconcile({ identity: { email: 'a@b.com', links: {} }, custom: {} })
    expect(out.merged).toEqual([])
  })

  it('keeps genuinely unknown facts as extras, in the user’s own casing', () => {
    const out = reconcile({
      identity: { links: {} },
      custom: { 'T-shirt size': 'M', 'Dietary needs': 'None' },
    })

    expect(out.extras).toEqual({ 'T-shirt size': 'M', 'Dietary needs': 'None' })
    expect(out.merged).toEqual([])
  })

  it('keeps an unknown link platform editable rather than dropping it', () => {
    const out = reconcile({
      identity: { links: { mastodon: 'https://mas.to/@ife' } },
      custom: {},
    })

    expect(out.extraLinks).toEqual({ mastodon: 'https://mas.to/@ife' })
  })

  it('does not depend on object insertion order', () => {
    const a = reconcile({ identity: { links: { GitHub: 'x', github: 'y' } }, custom: {} })
    const b = reconcile({ identity: { links: { github: 'y', GitHub: 'x' } }, custom: {} })
    expect(a).toEqual(b)
  })

  it('survives a completely empty profile', () => {
    const out = reconcile({ identity: undefined, custom: undefined })
    expect(out.values).toEqual({})
    expect(out.merged).toEqual([])
  })
})

describe('toPatch', () => {
  const base = { values: {}, extras: {}, extraLinks: {} }

  it('round-trips a reconciled profile', () => {
    const input = {
      identity: { fullName: 'Ifeoma Balogun', links: { github: 'https://github.com/ife' } },
      custom: { 'Notice period': '2 months', 'T-shirt size': 'M' },
    }
    const patch = toPatch(reconcile(input))

    expect(patch.identity.fullName).toBe('Ifeoma Balogun')
    expect(patch.identity.links).toEqual({ github: 'https://github.com/ife' })
    expect(patch.custom).toEqual({ 'Notice period': '2 months', 'T-shirt size': 'M' })
  })

  it('omits an empty catalogue fact rather than spending a fact slot on nothing', () => {
    const patch = toPatch({ ...base, values: { 'Notice period': '   ' } })
    expect(patch.custom).toEqual({})
  })

  it('keeps an empty extra, because the user made that row deliberately', () => {
    const patch = toPatch({ ...base, extras: { 'T-shirt size': '' } })
    expect(patch.custom).toEqual({ 'T-shirt size': '' })
  })

  it('writes a cleared identity field as an empty string, which is how it is cleared', () => {
    const patch = toPatch({ ...base, values: { email: '' } })
    expect(patch.identity.email).toBe('')
  })

  it('drops the duplicate spelling on the way out', () => {
    const patch = toPatch(
      reconcile({
        identity: { links: { LinkedIn: 'https://l/in/ife', linkedin: '' } },
        custom: {},
      }),
    )
    expect(patch.identity.links).toEqual({ linkedin: 'https://l/in/ife' })
  })
})

describe('counting', () => {
  it('counts only custom keys against the fact limit, as the server does', () => {
    const reconciled = reconcile({
      identity: {
        fullName: 'Ifeoma Balogun',
        email: 'ife@example.com',
        phone: '+91 90000 00000',
        links: { linkedin: 'https://l/in/ife', github: 'https://g/ife' },
      },
      custom: { 'Notice period': '2 months' },
    })

    // Five filled identity/link values used to count here and pushed a free user to the cap.
    expect(customFactCount(reconciled)).toBe(1)
  })

  it('reports section progress over the section total', () => {
    const reconciled = reconcile({
      identity: { fullName: 'Ifeoma Balogun', email: 'ife@example.com', links: {} },
      custom: {},
    })
    const about = sectionProgress('about', reconciled)

    expect(about.filled).toBe(2)
    expect(about.total).toBeGreaterThan(2)
  })

  it('sizes the extras section to the extras it holds', () => {
    const reconciled = reconcile({ identity: { links: {} }, custom: { Size: 'M', Diet: '' } })
    expect(sectionProgress('extra', reconciled)).toEqual({ filled: 1, total: 2 })
  })
})

describe('maskValue', () => {
  it('leaves the last four readable and hides the rest', () => {
    expect(maskValue('1234 5678 9012')).toBe('••••••••9012')
  })

  it('hides a short value completely', () => {
    expect(maskValue('abcd')).toBe('••••')
  })
})
