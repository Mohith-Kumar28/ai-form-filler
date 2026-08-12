import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  writeCheckedValue,
  writeContentEditable,
  writeSelectValue,
  writeTextValue,
} from './write.js'

beforeEach(() => {
  document.body.innerHTML = ''
})

function mount<T extends HTMLElement>(html: string): T {
  document.body.innerHTML = html
  return document.body.firstElementChild as T
}

describe('writeTextValue', () => {
  it('writes a value and reports success', () => {
    const input = mount<HTMLInputElement>('<input type="text" />')
    expect(writeTextValue(input, 'hello')).toBe(true)
    expect(input.value).toBe('hello')
  })

  it('dispatches bubbling input and change events', () => {
    const input = mount<HTMLInputElement>('<input type="text" />')
    const seen: string[] = []
    document.body.addEventListener('input', () => seen.push('input'))
    document.body.addEventListener('change', () => seen.push('change'))

    writeTextValue(input, 'x')

    // Bubbling matters: React attaches a single delegated listener at the root, so a
    // non-bubbling event never reaches it.
    expect(seen).toEqual(['input', 'change'])
  })

  it('fires focus and blur so onBlur-mode validators mark the field touched', () => {
    const input = mount<HTMLInputElement>('<input type="text" />')
    const seen: string[] = []
    input.addEventListener('focus', () => seen.push('focus'))
    input.addEventListener('blur', () => seen.push('blur'))

    writeTextValue(input, 'x')
    expect(seen).toEqual(['focus', 'blur'])
  })

  it('works on a textarea', () => {
    const el = mount<HTMLTextAreaElement>('<textarea></textarea>')
    expect(writeTextValue(el, 'long answer')).toBe(true)
    expect(el.value).toBe('long answer')
  })

  /**
   * The regression this whole module exists to prevent.
   *
   * React overrides the `value` property on the *instance*, shadowing the prototype setter.
   * A naive `el.value = x` hits the override, React sees its tracked value unchanged, and
   * reverts the field on the next render. Calling the native prototype setter bypasses it.
   */
  it('bypasses a framework-installed instance-level value override', () => {
    const input = mount<HTMLInputElement>('<input type="text" />')

    let underlying = ''
    const nativeDescriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!

    // Simulate React shadowing `value` on the instance.
    Object.defineProperty(input, 'value', {
      configurable: true,
      get: () => underlying,
      set: () => {
        /* framework swallows direct assignment — this is the bug */
      },
    })

    // Prove the naive path is broken under this shadow.
    input.value = 'ignored'
    expect(underlying).toBe('')

    // Our writer must reach the real setter instead.
    const spy = vi.fn((v: string) => {
      underlying = v
      nativeDescriptor.set?.call(input, v)
    })
    Object.defineProperty(HTMLInputElement.prototype, 'value', {
      configurable: true,
      // Non-null: the spec guarantees HTMLInputElement.prototype.value has an accessor pair.
      get: nativeDescriptor.get!,
      set: spy,
    })

    writeTextValue(input, 'from-adapter')

    expect(spy).toHaveBeenCalledWith('from-adapter')
    expect(underlying).toBe('from-adapter')

    Object.defineProperty(HTMLInputElement.prototype, 'value', nativeDescriptor)
  })
})

describe('writeSelectValue', () => {
  const select = () =>
    mount<HTMLSelectElement>(`
      <select>
        <option value="">Select one</option>
        <option value="opt_1">United States</option>
        <option value="opt_2">United Kingdom</option>
      </select>`)

  it('matches on the option value', () => {
    const el = select()
    expect(writeSelectValue(el, 'opt_2')).toBe(true)
    expect(el.value).toBe('opt_2')
  })

  it('matches on the visible label when the value is an opaque id', () => {
    // The common real-world case: the model answers with what a human would read.
    const el = select()
    expect(writeSelectValue(el, 'United States')).toBe(true)
    expect(el.value).toBe('opt_1')
  })

  it('matches case-insensitively', () => {
    const el = select()
    expect(writeSelectValue(el, 'united kingdom')).toBe(true)
    expect(el.value).toBe('opt_2')
  })

  it('falls back to a contains match', () => {
    const el = select()
    expect(writeSelectValue(el, 'Kingdom')).toBe(true)
    expect(el.value).toBe('opt_2')
  })

  it('does not contains-match on a very short string', () => {
    // "US" would otherwise substring-match half a country list.
    const el = select()
    expect(writeSelectValue(el, 'Un')).toBe(false)
  })

  it('reports failure rather than guessing when nothing matches', () => {
    const el = select()
    expect(writeSelectValue(el, 'Atlantis')).toBe(false)
    expect(el.value).toBe('')
  })
})

describe('writeCheckedValue', () => {
  it('checks an unchecked box', () => {
    const el = mount<HTMLInputElement>('<input type="checkbox" />')
    expect(writeCheckedValue(el, true)).toBe(true)
    expect(el.checked).toBe(true)
  })

  it('is idempotent — clicking an already-checked box would uncheck it', () => {
    const el = mount<HTMLInputElement>('<input type="checkbox" checked />')
    const clicks = vi.fn()
    el.addEventListener('click', clicks)

    expect(writeCheckedValue(el, true)).toBe(true)
    expect(el.checked).toBe(true)
    expect(clicks).not.toHaveBeenCalled()
  })

  it('unchecks when asked', () => {
    const el = mount<HTMLInputElement>('<input type="checkbox" checked />')
    expect(writeCheckedValue(el, false)).toBe(true)
    expect(el.checked).toBe(false)
  })

  it('deselects the sibling radio, which setting .checked would not do', () => {
    document.body.innerHTML = `
      <input type="radio" name="g" value="a" checked />
      <input type="radio" name="g" value="b" />`
    const [a, b] = [...document.querySelectorAll<HTMLInputElement>('input')]

    writeCheckedValue(b!, true)

    expect(b!.checked).toBe(true)
    expect(a!.checked).toBe(false)
  })
})

describe('writeContentEditable', () => {
  it('writes text content', () => {
    const el = mount<HTMLElement>('<div contenteditable="true"></div>')
    expect(writeContentEditable(el, 'a cover letter')).toBe(true)
    expect(el.textContent).toBe('a cover letter')
  })

  it('does not interpret model output as markup', () => {
    // Assigning to innerHTML here would be a self-inflicted XSS in the page's origin.
    const el = mount<HTMLElement>('<div contenteditable="true"></div>')
    writeContentEditable(el, '<img src=x onerror=alert(1)>')

    expect(el.querySelector('img')).toBeNull()
    expect(el.textContent).toBe('<img src=x onerror=alert(1)>')
  })
})
