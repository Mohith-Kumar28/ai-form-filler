import { beforeEach, describe, expect, it } from 'vitest'
import { detectPageForm } from './index.js'

/**
 * What counts as a form, tested through `detectPageForm` rather than against `isActualForm`
 * directly — the predicate reads the DOM around a field, so a test that hands it a
 * hand-built field list would be testing a different function than the one that ships.
 */

function pageWith(html: string) {
  document.body.innerHTML = html
  return detectPageForm(document, new URL('https://example.com/page'))
}

beforeEach(() => {
  document.body.innerHTML = ''
})

describe('a lone control is not a form', () => {
  /*
    The bug this exists for. An Instagram profile has nothing to fill; the launcher sat on it
    anyway, because the page footer carries a language switcher and one detected control was
    enough to count as a form.
  */
  it('rejects the language switcher in a page footer', () => {
    const result = pageWith(`
      <main><h1>ch.mohith_kumar</h1><p>4 posts</p></main>
      <footer>
        <select aria-label="Switch Display Language">
          <option value="en">English</option>
          <option value="hi">हिन्दी</option>
        </select>
      </footer>
    `)

    // Still detected — a fill the user explicitly asks for may write to it.
    expect(result?.form.fields).toHaveLength(1)
    // But nothing may offer to, unasked.
    expect(result?.actualForm).toBe(false)
  })

  it('rejects a bare text input with no form around it', () => {
    const result = pageWith('<input type="text" placeholder="Filter results" />')
    expect(result?.actualForm).toBe(false)
  })

  it('rejects two pickers sitting together in a footer', () => {
    const result = pageWith(`
      <footer>
        <select aria-label="Language"><option value="en">English</option></select>
        <select aria-label="Currency"><option value="usd">USD</option></select>
      </footer>
    `)
    expect(result?.form.fields).toHaveLength(2)
    expect(result?.actualForm).toBe(false)
  })
})

describe('a lone control that carries its own evidence is a form', () => {
  /*
    The false negative a plain field count would have caused. A standalone essay box is one
    field and is the most valuable thing this product fills.
  */
  it('accepts a standalone long-answer textarea', () => {
    const result = pageWith(`
      <h2>Tell us about yourself</h2>
      <textarea rows="10"></textarea>
    `)
    expect(result?.actualForm).toBe(true)
  })

  it('accepts a lone email input', () => {
    const result = pageWith('<input type="email" placeholder="you@example.com" />')
    expect(result?.actualForm).toBe(true)
  })

  it('accepts a bare text input that declares what it collects', () => {
    const result = pageWith('<input type="text" autocomplete="given-name" />')
    expect(result?.actualForm).toBe(true)
  })

  it('accepts one field inside a real form with a submit control', () => {
    const result = pageWith(`
      <form>
        <label for="n">Your name</label>
        <input id="n" type="text" />
        <button type="submit">Apply</button>
      </form>
    `)
    expect(result?.actualForm).toBe(true)
  })

  /*
    A `<form>` wrapper alone proves nothing: it is also how a great many sites wrap their
    search box and their filter dropdowns.
  */
  it('rejects a form that has nothing to submit with', () => {
    const result = pageWith(`
      <form>
        <select aria-label="Sort by"><option value="new">Newest</option></select>
      </form>
    `)
    expect(result?.actualForm).toBe(false)
  })

  it('rejects a search form even though it submits', () => {
    const result = pageWith(`
      <form role="search">
        <input type="text" name="q" />
        <button type="submit">Search</button>
      </form>
    `)
    expect(result?.actualForm).toBe(false)
  })
})

describe('a crowd is a form even when no single field proves it', () => {
  it('accepts three unremarkable controls sitting together', () => {
    const result = pageWith(`
      <div>
        <label for="a">City</label><input id="a" type="text" />
        <label for="b">State</label><input id="b" type="text" />
        <select id="c" aria-label="Size"><option value="m">Medium</option></select>
      </div>
    `)
    expect(result?.actualForm).toBe(true)
  })
})

describe('an empty page', () => {
  it('detects nothing at all, rather than an empty form', () => {
    expect(pageWith('<main><h1>Just words</h1></main>')).toBeNull()
  })
})
