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

beforeEach(() => {
  vi.useFakeTimers()
  // `chrome.storage.local` is read on mount to restore a remembered position.
  ;(globalThis as unknown as { chrome: unknown }).chrome = {
    storage: { local: { get: () => Promise.resolve({}), set: () => Promise.resolve() } },
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
