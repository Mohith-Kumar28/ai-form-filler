import { sendMessage } from '../lib/messaging.js'
import { GLYPH, getOverlayHost } from './host.js'
import type { Rect } from './scheduler.js'

/**
 * The launcher — the extension's one persistent presence on a form page.
 *
 * A circle pinned to the right edge with a rail running from it to the edge of the window. The
 * circle is the button; the rail is the one place the launcher says anything, and it says one
 * thing at a time: the keyboard shortcut when idle, what the AI is doing while it thinks, and
 * `done/total` with a stop button while answers land. A dots grabber appears on hover to drag
 * the whole thing up and down that edge.
 *
 * The rail replaced two floating satellites — a field-count pill hanging below the circle and a
 * red stop circle hanging below that. Both were centred on a 38px button 16px from the right
 * edge of the window, so both were wider than the thing they hung from and both had to be
 * special-cased not to fall off the screen; the stop button also moved the moment the progress
 * text gained a digit. Running the text sideways into the edge instead means there is no
 * direction left for it to overflow in, and the count that used to be there is now the button's
 * tooltip — a number nobody was acting on, in place of the shortcut, which is a number-free
 * instruction people can act on every time.
 */

const POSITION_KEY = 'aff:launcherPos'
const EDGE = 16
const DRAG_THRESHOLD = 4

/**
 * How far outside the launcher still counts as reaching for it, in CSS pixels.
 *
 * The drag handle used to appear only while the 38px circle itself was hovered, so picking the
 * launcher up meant landing on the circle, spotting the handle, and getting to it before the
 * cursor slipped off — the handle vanished from under the hand reaching for it. 44px is roughly
 * a thumb, and it is measured from the wrap's box, so it extends past the handle as well.
 */
const NEAR_PAD = 44

/** How long the launcher stays "near" after the cursor leaves. Long enough to turn around. */
const NEAR_LINGER_MS = 700

/**
 * What the rail says while there is no number worth showing.
 *
 * Per stage, and every line is true of the stage it belongs to — the previous set rotated
 * "Thinking… / Reading the form… / Writing answers…" regardless of what was actually happening.
 * `generating` gets two lines because it is the one that takes ten to twenty seconds, and a
 * label that never changes for that long reads as a hang.
 */
const STAGE_MESSAGES: Record<string, string[]> = {
  detecting: ['Reading the form…'],
  generating: ['Writing your answers…', 'Working through the form…'],
  applying: ['Filling the fields…'],
}

export interface LauncherHandle {
  element: HTMLElement
  anchorRect: () => Rect
  setFieldCount: (count: number) => void
  /** Puts progress text and a stop button in the rail. */
  setStage: (stage: string, done: number, total: number) => void
  /** Pulsing animation while thinking (before progress text appears). */
  setLoading: (loading: boolean) => void
  /** Shows an upgrade indicator in place of the shortcut. */
  setExhausted: () => void
  /** A one-off wiggle on detection, so a form on the page is noticed. Plays at most once. */
  playAttention: () => void
  /** Back to the idle circle + shortcut rail. */
  reset: () => void
  destroy: () => void
}

export function mountLauncher(options: { onOpen: () => void; onStop: () => void }): LauncherHandle {
  const { root } = getOverlayHost()

  // ── DOM ─────────────────────────────────────────────────────────────────
  const wrap = document.createElement('div')
  wrap.className = 'launcher-wrap'

  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'launcher'

  const icon = document.createElement('span')
  icon.className = 'launcher-icon'
  icon.innerHTML = GLYPH.mascot
  button.appendChild(icon)

  const rail = document.createElement('div')
  rail.className = 'launcher-rail'

  const railText = document.createElement('span')
  railText.className = 'launcher-rail-text'
  rail.appendChild(railText)

  const stopBtn = document.createElement('button')
  stopBtn.type = 'button'
  stopBtn.className = 'launcher-stop'
  stopBtn.setAttribute('aria-label', 'Stop filling')
  stopBtn.innerHTML = GLYPH.close
  stopBtn.addEventListener('click', (event) => {
    event.stopPropagation()
    options.onStop()
  })
  rail.appendChild(stopBtn)

  const grabber = document.createElement('button')
  grabber.type = 'button'
  grabber.className = 'launcher-grab'
  grabber.setAttribute('aria-label', 'Drag to move')
  grabber.setAttribute('title', 'Drag to move')
  // Six, in two columns of three — the grabber glyph. Three in a line is a kebab menu.
  grabber.innerHTML = '<span></span>'.repeat(6)

  wrap.appendChild(grabber)
  wrap.appendChild(button)
  wrap.appendChild(rail)
  root.appendChild(wrap)

  // ── The rail's one line of text ──────────────────────────────────────────

  let fieldCount = 0
  /** The bound shortcut, as the user's own browser reports it. `null` until the worker answers. */
  let shortcut: string | null = null
  let exhausted = false
  let loadingTimer: ReturnType<typeof setInterval> | null = null
  let loadingIndex = 0

  /**
   * Puts nodes in the rail, and takes the rail away when there is nothing to put in it.
   *
   * An empty rectangle running to the edge of the window is worse than no rectangle: it is the
   * same amount of chrome carrying no information. So the rail is present exactly when it has
   * something to say — which, before the shortcut lookup comes back and on a browser where the
   * command has been unbound, is never.
   */
  const setRail = (...nodes: Node[]) => {
    railText.textContent = ''
    for (const node of nodes) railText.appendChild(node)
    if (nodes.length > 0) wrap.setAttribute('data-rail', 'true')
    else wrap.removeAttribute('data-rail')
  }

  /** The breathing dot that carries the "still working" signal. */
  const thinkingDot = () => {
    const dot = document.createElement('span')
    dot.className = 'launcher-rail-dot'
    return dot
  }

  const shortcutChip = () => {
    const kbd = document.createElement('kbd')
    kbd.className = 'launcher-key'
    kbd.textContent = shortcut ?? ''
    return kbd
  }

  /**
   * The button's label, which is where the field count went.
   *
   * The count used to be the rail's whole job and it was never something anyone did anything
   * with — "5 fields" does not change whether you press the button. The shortcut does, so the
   * shortcut gets the pixels and the count gets the tooltip, where it still answers "did it
   * actually see my form?" for anyone who wonders.
   */
  const describeButton = () => {
    const keys = shortcut ? ` (${shortcut})` : ''
    button.setAttribute('aria-label', `Fill this form${keys}`)
    // Zero is the single frame between mount and the count arriving; it is never a real state.
    const what =
      fieldCount === 0 ? 'this form' : fieldCount === 1 ? '1 field' : `${fieldCount} fields`
    button.setAttribute('title', `Fill ${what}${keys}`)
  }

  /** Idle: the shortcut, or the upgrade nudge if the account cannot afford a fill. */
  const showIdle = () => {
    if (exhausted) {
      rail.setAttribute('data-exhausted', 'true')
      setRail(document.createTextNode('Upgrade'))
      return
    }
    rail.removeAttribute('data-exhausted')
    if (!shortcut) {
      setRail()
      return
    }
    setRail(shortcutChip())
  }

  let loadingStage = 'generating'

  const messagesFor = (stage: string): string[] =>
    STAGE_MESSAGES[stage] ?? STAGE_MESSAGES.generating ?? ['Working…']

  const startLoadingText = (stage: string) => {
    const messages = messagesFor(stage)
    // Restarting the same stage would reset the rotation on every progress event.
    if (loadingTimer !== null && stage === loadingStage) return
    stopLoadingText()
    loadingStage = stage
    loadingIndex = 0
    rail.removeAttribute('data-exhausted')
    setRail(thinkingDot(), document.createTextNode(messages[0] ?? 'Working…'))
    if (messages.length < 2) return
    loadingTimer = setInterval(() => {
      loadingIndex = (loadingIndex + 1) % messages.length
      setRail(thinkingDot(), document.createTextNode(messages[loadingIndex] ?? 'Working…'))
    }, 2600)
  }

  const stopLoadingText = () => {
    if (loadingTimer !== null) {
      clearInterval(loadingTimer)
      loadingTimer = null
    }
  }

  let attentionPlayed = false

  // Safety net: if no fill event ever arrives, the icon must not spin forever.
  let loadingSafety: ReturnType<typeof setTimeout> | null = null

  const settleLoading = () => {
    if (loadingSafety !== null) {
      clearTimeout(loadingSafety)
      loadingSafety = null
    }
    button.classList.remove('launcher--loading')
    stopLoadingText()
    loadingStage = ''
  }

  /**
   * What key fires a fill, read back out of the browser rather than assumed.
   *
   * Asked for once per launcher, and the rail stays bare until the answer lands — showing the
   * suggested binding to somebody who rebound it, or unbound it, would make the launcher itself
   * the source of the "I pressed it and nothing happened". Failures are silent by design: a
   * missing label costs a hint, and there is nothing here worth an error card over.
   */
  void sendMessage({ type: 'overlay/shortcut' })
    .then((result) => {
      if (!result.ok || !result.value) return
      shortcut = result.value.label
      describeButton()
      // Only if nothing more urgent has taken the rail in the meantime.
      if (loadingTimer === null && !wrap.hasAttribute('data-filling')) showIdle()
    })
    .catch(() => undefined)

  describeButton()
  showIdle()

  // ── Position ─────────────────────────────────────────────────────────────
  /*
    Pinned to the right edge in CSS — `right: 0` — and moved only vertically from here.

    It used to be `left`, computed as `viewportWidth - wrap.offsetWidth - EDGE` and recomputed
    by hand at every point the launcher changed shape, because that arithmetic is only correct
    for the width the launcher happened to have when it ran. Every missed call site left the
    thing pinned at the old width's left edge with the new content hanging off the side of the
    window — which is what clipped the progress count mid-digit as it went from "0/7" to "10/70".
    Anchoring the right edge deletes the arithmetic and the failure with it: content now grows
    leftward into the page, where there is always room.
  */
  const viewportHeight = () => document.documentElement.clientHeight || window.innerHeight

  let pos = { y: Math.round(viewportHeight() * 0.25) }

  // Declared up here rather than beside the pointermove handler that uses them: `applyPosition`
  // calls `invalidateNear` and runs during mount, which a `const` declared further down would
  // meet in its temporal dead zone.
  let nearRect: DOMRect | null = null
  let nearTimer: ReturnType<typeof setTimeout> | null = null
  let isNear = false

  const invalidateNear = () => {
    nearRect = null
  }

  const clampY = (y: number) =>
    Math.min(Math.max(EDGE, y), viewportHeight() - button.offsetHeight - EDGE)

  const applyPosition = (y: number) => {
    pos = { y }
    wrap.style.translate = `0 ${Math.round(y)}px`
    // The cached proximity rect is now stale — see `onPointerMove`.
    invalidateNear()
  }

  applyPosition(pos.y)

  // ── Drag (grabber) + click (icon) ────────────────────────────────────────
  let dragState: { startY: number; origY: number; dragging: boolean } | null = null

  grabber.addEventListener('pointerdown', (event) => {
    grabber.setPointerCapture(event.pointerId)
    dragState = { startY: event.clientY, origY: pos.y, dragging: false }
    /*
      The CSS has wanted this attribute since it was written; nothing ever set it.

      Both rules that keep the handle alive mid-drag were therefore resting on `:active` alone,
      and `:active` is lost as soon as the pointer leaves the button's box — which, when the
      thing you are doing is dragging that button somewhere else, is instantly. The handle
      faded out from under a pointer that still had it captured, and the cursor reverted from
      `grabbing` to the page's own.
    */
    wrap.setAttribute('data-dragging', 'true')
  })

  grabber.addEventListener('pointermove', (event) => {
    if (!dragState) return
    const dy = event.clientY - dragState.startY
    if (!dragState.dragging && Math.abs(dy) < DRAG_THRESHOLD) return
    dragState.dragging = true
    applyPosition(clampY(dragState.origY + dy))
  })

  const endDrag = () => {
    wrap.removeAttribute('data-dragging')
    if (!dragState) return
    if (dragState.dragging) void chrome.storage.local.set({ [POSITION_KEY]: pos })
    dragState = null
  }

  grabber.addEventListener('pointerup', endDrag)
  // A cancelled pointer (a gesture the browser took over, a lost capture) never fires `pointerup`,
  // and without this the wrap keeps `data-dragging` and the handle never hides again.
  grabber.addEventListener('pointercancel', endDrag)

  button.addEventListener('click', () => options.onOpen())

  // Restore remembered position.
  void chrome.storage.local.get(POSITION_KEY).then((stored) => {
    const saved = (stored as Record<string, { y: number } | undefined>)[POSITION_KEY]
    if (saved) applyPosition(clampY(saved.y))
  })

  /*
    Proximity, measured on pointermove, in place of a bigger hover target.

    The rect is cached and invalidated on the two things that move the launcher — a drag and a
    resize — because reading `getBoundingClientRect` on every pointermove of every page the
    extension is injected into is a layout flush we have no business asking for. `data-near`
    only ever changes when it actually flips, so a cursor crossing the page does no DOM work.
  */
  const setNear = (near: boolean) => {
    if (near === isNear) return
    isNear = near
    if (near) wrap.setAttribute('data-near', 'true')
    else wrap.removeAttribute('data-near')
  }

  const onPointerMove = (event: PointerEvent) => {
    // Mid-drag the pointer is wherever the user has taken it; "near" is not the question.
    if (dragState) return
    if (!nearRect) nearRect = wrap.getBoundingClientRect()
    const r = nearRect
    const near =
      event.clientX >= r.left - NEAR_PAD &&
      event.clientX <= r.right + NEAR_PAD &&
      event.clientY >= r.top - NEAR_PAD &&
      event.clientY <= r.bottom + NEAR_PAD

    if (near) {
      if (nearTimer !== null) {
        clearTimeout(nearTimer)
        nearTimer = null
      }
      setNear(true)
      return
    }

    if (!isNear || nearTimer !== null) return
    nearTimer = setTimeout(() => {
      nearTimer = null
      setNear(false)
    }, NEAR_LINGER_MS)
  }

  document.addEventListener('pointermove', onPointerMove, { passive: true })

  const onResize = () => {
    invalidateNear()
    applyPosition(clampY(pos.y))
  }
  window.addEventListener('resize', onResize)

  const anchorRect = (): Rect => {
    const rect = button.getBoundingClientRect()
    return { top: rect.top, left: rect.left, width: rect.width, height: rect.height }
  }

  return {
    element: wrap,
    anchorRect,
    setFieldCount: (count) => {
      fieldCount = count
      describeButton()
    },
    /**
     * Where the fill has got to.
     *
     * `done === 0` shows the thinking state, not the number. This is the whole fix for a
     * launcher that read as hung: the pipeline emits `{done: 0}` for both `detecting` and
     * `generating`, the old `setBusy` called `settleLoading()` unconditionally — killing the
     * pulse and the text it had just started — and then displayed a frozen "0/5" for the ten
     * to twenty seconds the model actually takes. A zero is not progress; say what is
     * happening instead, and show a count only once there is one.
     */
    setStage: (stage, done, total) => {
      if (done > 0) {
        settleLoading()
        wrap.setAttribute('data-filling', 'true')
        rail.removeAttribute('data-exhausted')
        setRail(document.createTextNode(`${done}/${total}`))
        return
      }

      wrap.removeAttribute('data-filling')
      button.classList.add('launcher--loading')
      startLoadingText(stage)
    },
    setExhausted: () => {
      settleLoading()
      exhausted = true
      showIdle()
    },
    /**
     * "There is a form here."
     *
     * The launcher is a static circle in the corner of a page somebody is reading, which is
     * precisely the shape peripheral vision discards. Three beats on arrival is the smallest
     * thing that says the tool has something to offer on *this* page rather than merely
     * existing on every page.
     *
     * Once per launcher, and the launcher is destroyed and rebuilt only when the field count
     * goes to zero and back — so a single-page app that swaps forms wiggles again, and a page
     * that merely re-detects the same form does not. The class is removed on `animationend`
     * so it cannot fight the hover scale afterwards; reduced motion drops the animation, and
     * the listener never fires, which is why the guard is a flag rather than the class itself.
     */
    playAttention: () => {
      if (attentionPlayed) return
      attentionPlayed = true
      button.classList.add('launcher--attention')
      button.addEventListener(
        'animationend',
        () => button.classList.remove('launcher--attention'),
        { once: true },
      )
    },
    setLoading: (loading) => {
      if (loading) {
        button.classList.add('launcher--loading')
        startLoadingText('detecting')
        if (loadingSafety !== null) clearTimeout(loadingSafety)
        loadingSafety = setTimeout(() => {
          loadingSafety = null
          settleLoading()
          showIdle()
        }, 30000)
      } else {
        settleLoading()
        showIdle()
      }
    },
    reset: () => {
      settleLoading()
      wrap.removeAttribute('data-filling')
      showIdle()
    },
    destroy: () => {
      settleLoading()
      if (nearTimer !== null) clearTimeout(nearTimer)
      document.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('resize', onResize)
      wrap.remove()
    },
  }
}
