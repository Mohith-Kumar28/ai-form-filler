import { describe, expect, it } from 'vitest'
import { pruneLinks } from './profile.js'

/**
 * The bug: a link the user cleared came back, forever.
 *
 * `Identity.links` documents `''` as "cleared", but `updateStructured` merged links with a
 * spread, which only ever *adds* keys. Clearing one wrote `''` and left the key in place, and
 * the ingest structuring pass takes `platform` as a bare string straight from a model — so one
 * stray `"LinkedIn"` beside the extractor's `"linkedin"` became two permanent rows in the
 * editor, both displaying "LinkedIn", neither removable from the UI.
 */
describe('pruneLinks', () => {
  it('deletes a cleared link rather than storing an empty one', () => {
    expect(pruneLinks({ linkedin: '', github: 'https://github.com/ife' })).toEqual({
      github: 'https://github.com/ife',
    })
  })

  it('treats whitespace as cleared, because a form field full of spaces is empty', () => {
    expect(pruneLinks({ website: '   ' })).toEqual({})
  })

  it('keeps every link that has a value', () => {
    const links = { github: 'https://g/ife', linkedin: 'https://l/in/ife' }
    expect(pruneLinks(links)).toEqual(links)
  })

  it('emits keys in a fixed order, because the compiled document must be byte-stable', () => {
    const a = pruneLinks({ website: 'https://w', github: 'https://g', linkedin: 'https://l' })
    const b = pruneLinks({ linkedin: 'https://l', website: 'https://w', github: 'https://g' })
    expect(Object.keys(a)).toEqual(Object.keys(b))
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })
})
