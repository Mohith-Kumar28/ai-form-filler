import { beforeEach, describe, expect, it, vi } from 'vitest'
import { type LauncherHandle, mountLauncher } from './launcher.js'

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

/** Records what the launcher asked for, so a test can assert the callback and not the wiring. */
const calls = { open: 0, stop: 0, panel: 0 }

function mount() {
  calls.open = 0
  calls.stop = 0
  calls.panel = 0
  const handle = mountLauncher({
    onOpen: () => {
      calls.open += 1
    },
    onStop: () => {
      calls.stop += 1
    },
    onOpenPanel: () => {
      calls.panel += 1
    },
  })
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
 * carries exactly one thing at a time. The rule worth pinning down is the one a screenshot
 * cannot show: it is absent rather than empty when there is nothing to say — and on an idle
 * page there is now nothing to say at all, so the launcher is a bare circle. The shortcut moved
 * to a hover hint; see the block below.
 */
describe('the rail', () => {
  it('says nothing on an idle page, so the launcher is just the circle', async () => {
    const handle = mount()
    await flush()
    expect(handle.element.getAttribute('data-rail')).toBeNull()
    expect(rail(handle)?.textContent).toBe('')
    handle.destroy()
  })

  it('carries the field count in the button label, and the rail stays away', async () => {
    const handle = mount()
    await flush()
    handle.setFieldCount(5)
    const button = handle.element.querySelector('.launcher') as HTMLElement
    expect(button.getAttribute('title')).toBe('Fill 5 fields (Alt+F)')
    expect(handle.element.getAttribute('data-rail')).toBeNull()
    handle.destroy()
  })

  it('appears with progress, and offers a stop, once answers land', async () => {
    const handle = mount()
    await flush()
    handle.setStage('applying', 3, 7)
    expect(rail(handle)?.textContent).toBe('3/7')
    expect(handle.element.getAttribute('data-filling')).toBe('true')
    handle.destroy()
  })

  it('says what it is doing while there is no count yet, and shows no count', async () => {
    const handle = mount()
    await flush()
    handle.setStage('generating', 0, 7)
    expect(rail(handle)?.textContent).toContain('Writing your answers')
    expect(rail(handle)?.textContent).not.toContain('0/7')
    // The bar is width: var(--progress, 0%), so an unset value draws nothing.
    expect(handle.element.style.getPropertyValue('--progress')).toBe('')
    handle.destroy()
  })

  /*
    The stop button is displayed by `[data-filling="true"] .launcher-stop`, and the flag used
    to be set only in the branch that has a count — which is `applying`, the last and shortest
    stage. For the ten to twenty seconds of detecting, reading and generating, a fill started
    by mistake could not be called off from the page.
  */
  it('offers stop from the first stage, long before there is a count', async () => {
    const handle = mount()
    await flush()
    for (const stage of ['detecting', 'reading', 'generating']) {
      handle.setStage(stage, 0, 7)
      expect(handle.element.getAttribute('data-filling')).toBe('true')
    }
    handle.destroy()
  })

  it('stops the fill when the stop button is pressed', async () => {
    const handle = mount()
    await flush()
    handle.setStage('detecting', 0, 7)
    const stop = handle.element.querySelector<HTMLButtonElement>('.launcher-stop')
    expect(stop).not.toBeNull()
    stop?.click()
    expect(calls.stop).toBe(1)
    handle.destroy()
  })

  it('names the page read as its own stage', async () => {
    const handle = mount()
    await flush()
    handle.setStage('reading', 0, 1)
    expect(rail(handle)?.textContent).toContain('Reading the page')
    handle.destroy()
  })

  it('goes away again when the fill is over', async () => {
    const handle = mount()
    await flush()
    handle.setStage('applying', 3, 7)
    handle.reset()
    expect(handle.element.getAttribute('data-filling')).toBeNull()
    expect(handle.element.getAttribute('data-rail')).toBeNull()
    expect(rail(handle)?.textContent).toBe('')
    handle.destroy()
  })

  it('keeps the rail for an exhausted account, which is a state to act on', async () => {
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

/**
 * The hover hint — the shortcut, under the circle.
 *
 * Visibility itself is CSS (`:hover` / `[data-near]`), which a unit test cannot observe. What is
 * testable is the contract CSS gates on: the pill holds the browser's real binding, and
 * `data-hint` is set only when there is one — so a browser that refused to bind the command
 * renders no empty pill.
 */
describe('the shortcut hint', () => {
  it('is unarmed until the browser reports a binding', () => {
    const handle = mount()
    expect(handle.element.getAttribute('data-hint')).toBeNull()
    expect(handle.element.querySelector('.launcher-hint')?.textContent).toBe('')
    handle.destroy()
  })

  it('carries the bound key once it arrives', async () => {
    const handle = mount()
    await flush()
    expect(handle.element.getAttribute('data-hint')).toBe('true')
    expect(handle.element.querySelector('.launcher-hint')?.textContent).toBe('Alt+F')
    handle.destroy()
  })

  it('stays unarmed when the command has been unbound', async () => {
    ;(
      globalThis as unknown as { chrome: { runtime: { sendMessage: () => unknown } } }
    ).chrome.runtime.sendMessage = () => Promise.resolve({ ok: true, value: { label: null } })
    const handle = mount()
    await flush()
    expect(handle.element.getAttribute('data-hint')).toBeNull()
    expect(handle.element.querySelector('.launcher-hint')?.textContent).toBe('')
    handle.destroy()
  })

  it('is not announced twice to a screen reader', async () => {
    const handle = mount()
    await flush()
    // The binding is already in the button's accessible name.
    expect(handle.element.querySelector('.launcher-hint')?.getAttribute('aria-hidden')).toBe('true')
    expect(handle.element.querySelector('.launcher')?.getAttribute('aria-label')).toBe(
      'Fill this form (Alt+F)',
    )
    handle.destroy()
  })
})

/**
 * The side-panel button, in the dock's extras.
 *
 * Visibility is CSS and cannot be observed here. What is worth pinning down is the part that
 * would be a bug on someone else's page: it asks for the panel and nothing else, and a click on
 * it must not also start a fill.
 */
describe('the sidebar pill', () => {
  const pill = (handle: LauncherHandle) =>
    handle.element.querySelector('.launcher-panel') as HTMLElement

  it('asks for the panel, and does not start a fill', async () => {
    const handle = mount()
    await flush()

    pill(handle).dispatchEvent(new MouseEvent('click', { bubbles: true }))

    expect(calls.panel).toBe(1)
    expect(calls.open).toBe(0)
    handle.destroy()
  })

  it('names itself for a screen reader, since the icon carries no text', async () => {
    const handle = mount()
    await flush()
    expect(pill(handle).getAttribute('aria-label')).toBe('Open the Fillaform side panel')
    handle.destroy()
  })

  it('lives in the dock but never inside the tile, so its click cannot reach it', async () => {
    const handle = mount()
    await flush()
    // A descendant of the tile would bubble into its handler however the click was stopped.
    expect(handle.element.contains(pill(handle))).toBe(true)
    expect(handle.element.querySelector('.launcher')?.contains(pill(handle))).toBe(false)
    handle.destroy()
  })
})
