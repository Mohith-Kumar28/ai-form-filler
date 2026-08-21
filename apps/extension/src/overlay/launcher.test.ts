import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mountLauncher } from './launcher.js'

/**
 * The launcher's reach, which is the thing that cannot be checked by looking at it.
 *
 * The drag handle used to appear only while the 38px circle itself was hovered, so picking the
 * launcher up meant landing on the circle, spotting the handle, and reaching it before the
 * cursor slipped off — it vanished from under the hand going for it. The fix is proximity
 * measured in JS rather than a bigger hover target, because :host is `pointer-events: none` and
 * an enlarged hittable box would be a collar around the launcher that eats the page's clicks.
 *
 * Geometry is stubbed: happy-dom performs no layout, so every rect is zero and the launcher
 * would otherwise read as a point at the origin.
 */

const RECT = { top: 100, left: 900, right: 962, bottom: 138, width: 62, height: 38 }

function stubRect(element: HTMLElement) {
  element.getBoundingClientRect = () => ({ ...RECT, x: RECT.left, y: RECT.top, toJSON: () => RECT })
}

function movePointer(clientX: number, clientY: number) {
  document.dispatchEvent(new PointerEvent('pointermove', { clientX, clientY, bubbles: true }))
}

function mount() {
  const handle = mountLauncher({ onOpen: () => {}, onStop: () => {} })
  stubRect(handle.element)
  return handle
}

/**
 * Lets the shortcut lookup land.
 *
 * `sendMessage` awaits a stubbed promise and then the launcher awaits its result, so the label
 * is three microtasks behind mount — and fake timers do not advance microtasks.
 */
async function flush() {
  for (let i = 0; i < 5; i += 1) await Promise.resolve()
}

const rail = (handle: { element: HTMLElement }) =>
  handle.element.querySelector('.launcher-rail-text')

beforeEach(() => {
  vi.useFakeTimers()
  // `chrome.storage.local` is read on mount to restore a remembered position.
  ;(globalThis as unknown as { chrome: unknown }).chrome = {
    storage: { local: { get: () => Promise.resolve({}), set: () => Promise.resolve() } },
    // The launcher asks the worker what key is bound; the rail is empty until it answers.
    runtime: {
      sendMessage: () => Promise.resolve({ ok: true, value: { label: 'Alt+F' } }),
    },
  }
  document.body.innerHTML = ''
  document.getElementById('aff-overlay-host')?.remove()
})

describe('the launcher’s proximity zone', () => {
  it('is not near before the pointer has moved at all', () => {
    const handle = mount()
    expect(handle.element.getAttribute('data-near')).toBeNull()
    handle.destroy()
  })

  it('goes near for a pointer well outside the launcher itself', () => {
    const handle = mount()
    // 30px to the left of the wrap: outside every box in it, inside the reach.
    movePointer(RECT.left - 30, RECT.top + 10)
    expect(handle.element.getAttribute('data-near')).toBe('true')
    handle.destroy()
  })

  it('stays clear of a pointer that is merely crossing the page', () => {
    const handle = mount()
    movePointer(100, 400)
    expect(handle.element.getAttribute('data-near')).toBeNull()
    handle.destroy()
  })

  it('lingers after the pointer leaves, so a cursor can turn back', () => {
    const handle = mount()
    movePointer(RECT.left - 30, RECT.top + 10)
    movePointer(100, 400)

    // The whole point: it is still there immediately after leaving.
    expect(handle.element.getAttribute('data-near')).toBe('true')

    vi.advanceTimersByTime(300)
    expect(handle.element.getAttribute('data-near')).toBe('true')

    vi.advanceTimersByTime(500)
    expect(handle.element.getAttribute('data-near')).toBeNull()
    handle.destroy()
  })

  it('cancels the linger when the pointer comes back', () => {
    const handle = mount()
    movePointer(RECT.left - 30, RECT.top + 10)
    movePointer(100, 400)
    vi.advanceTimersByTime(300)
    movePointer(RECT.left - 30, RECT.top + 10)

    vi.advanceTimersByTime(2000)
    expect(handle.element.getAttribute('data-near')).toBe('true')
    handle.destroy()
  })

  it('stops listening once destroyed', () => {
    const handle = mount()
    const element = handle.element
    handle.destroy()
    movePointer(RECT.left - 30, RECT.top + 10)
    expect(element.getAttribute('data-near')).toBeNull()
  })
})

describe('the drag handle', () => {
  it('is six dots, not three', () => {
    const handle = mount()
    const grab = handle.element.querySelector('.launcher-grab')
    expect(grab?.children).toHaveLength(6)
    handle.destroy()
  })

  it('marks the wrap while a drag is in flight, and clears it on pointerup', () => {
    const handle = mount()
    const grab = handle.element.querySelector('.launcher-grab') as HTMLElement
    // happy-dom has no pointer capture.
    grab.setPointerCapture = () => {}

    grab.dispatchEvent(new PointerEvent('pointerdown', { clientY: 200, bubbles: true }))
    expect(handle.element.getAttribute('data-dragging')).toBe('true')

    grab.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }))
    expect(handle.element.getAttribute('data-dragging')).toBeNull()
    handle.destroy()
  })

  it('clears the drag mark on a cancelled pointer, which fires no pointerup', () => {
    const handle = mount()
    const grab = handle.element.querySelector('.launcher-grab') as HTMLElement
    grab.setPointerCapture = () => {}

    grab.dispatchEvent(new PointerEvent('pointerdown', { clientY: 200, bubbles: true }))
    grab.dispatchEvent(new PointerEvent('pointercancel', { bubbles: true }))
    expect(handle.element.getAttribute('data-dragging')).toBeNull()
    handle.destroy()
  })
})

describe('the attention wiggle', () => {
  it('plays once, and not again for the same launcher', () => {
    const handle = mount()
    const button = handle.element.querySelector('.launcher') as HTMLElement

    handle.playAttention()
    expect(button.classList.contains('launcher--attention')).toBe(true)

    button.dispatchEvent(new Event('animationend'))
    expect(button.classList.contains('launcher--attention')).toBe(false)

    // A re-detection of the same form must not set the launcher off again.
    handle.playAttention()
    expect(button.classList.contains('launcher--attention')).toBe(false)
    handle.destroy()
  })
})

/**
 * The rail — the strip running from the circle to the edge of the window.
 *
 * It replaced a field-count pill and a stop button that both hung below the circle, and it
 * carries exactly one thing at a time. The rules worth pinning down are the ones a screenshot
 * cannot show: that it is absent rather than empty when there is nothing to say, and that a
 * fill's progress evicts the shortcut rather than appearing beside it.
 */
describe('the rail', () => {
  it('says nothing until the browser has reported a binding', () => {
    const handle = mount()
    expect(handle.element.getAttribute('data-rail')).toBeNull()
    expect(rail(handle)?.textContent).toBe('')
    handle.destroy()
  })

  it('shows the bound shortcut as a key cap once it arrives', async () => {
    const handle = mount()
    await flush()
    expect(handle.element.getAttribute('data-rail')).toBe('true')
    expect(handle.element.querySelector('.launcher-key')?.textContent).toBe('Alt+F')
    handle.destroy()
  })

  it('stays away when the command has been unbound', async () => {
    ;(
      globalThis as unknown as { chrome: { runtime: { sendMessage: () => unknown } } }
    ).chrome.runtime.sendMessage = () => Promise.resolve({ ok: true, value: { label: null } })
    const handle = mount()
    await flush()
    expect(handle.element.getAttribute('data-rail')).toBeNull()
    handle.destroy()
  })

  it('carries the field count in the button label, not in the rail', async () => {
    const handle = mount()
    await flush()
    handle.setFieldCount(5)
    const button = handle.element.querySelector('.launcher') as HTMLElement
    expect(button.getAttribute('title')).toBe('Fill 5 fields (Alt+F)')
    expect(rail(handle)?.textContent).toBe('Alt+F')
    handle.destroy()
  })

  it('replaces the shortcut with progress, and offers a stop, once answers land', async () => {
    const handle = mount()
    await flush()
    handle.setStage('applying', 3, 7)
    expect(rail(handle)?.textContent).toBe('3/7')
    expect(handle.element.getAttribute('data-filling')).toBe('true')
    handle.destroy()
  })

  it('says what it is doing while there is no count yet', async () => {
    const handle = mount()
    await flush()
    handle.setStage('generating', 0, 7)
    expect(rail(handle)?.textContent).toContain('Writing your answers')
    expect(handle.element.getAttribute('data-filling')).toBeNull()
    handle.destroy()
  })

  it('gives the shortcut back when the fill is over', async () => {
    const handle = mount()
    await flush()
    handle.setStage('applying', 3, 7)
    handle.reset()
    expect(handle.element.getAttribute('data-filling')).toBeNull()
    expect(rail(handle)?.textContent).toBe('Alt+F')
    handle.destroy()
  })

  it('shows the upgrade nudge in place of the shortcut, and keeps it', async () => {
    const handle = mount()
    await flush()
    handle.setExhausted()
    expect(rail(handle)?.textContent).toBe('Upgrade')

    // An exhausted account is still exhausted after a fill attempt settles.
    handle.reset()
    expect(rail(handle)?.textContent).toBe('Upgrade')
    handle.destroy()
  })
})
