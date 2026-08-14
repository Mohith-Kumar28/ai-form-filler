import { detectPageScheme, overlayVariables } from '../lib/tokens.js'

/**
 * The overlay's isolated rendering surface.
 *
 * A **closed** shadow root, not open: page scripts cannot reach `.shadowRoot` to read or
 * mutate our UI, and page CSS cannot select into it. Equally important in the other direction —
 * our styles cannot leak out and restyle the page, which is how an injected overlay breaks the
 * site it is trying to help.
 *
 * Styles are inlined rather than linked because a `chrome-extension://` stylesheet is blocked
 * by the CSP of a meaningful number of sites. The variables come from `lib/tokens.ts`, the same
 * module the side panel's palette is checked against — this file used to carry a hand-copied
 * duplicate that had already drifted from it.
 *
 * The panel's bundled typeface is deliberately absent. Serving it here needs `FontFace` plus an
 * ArrayBuffer to survive a strict `font-src` policy, which is not worth 90KB for four short
 * labels; identity on the page is carried by the seal, the stamp and the motion instead.
 */

const HOST_ID = 'aff-overlay-host'

/**
 * `2147483647` is the maximum 32-bit signed integer, and the value sites use for their own
 * "always on top" layers. Matching it rather than exceeding it (which is impossible) means we
 * lose ties to elements declared later — acceptable, and better than an arms race.
 */
const OVERLAY_STYLES = `
${overlayVariables(':host')}

:host {
  all: initial;
  position: fixed;
  top: 0;
  left: 0;
  width: 0;
  height: 0;
  z-index: 2147483647;
  /* The host is a coordinate origin, not a surface. Without this it would swallow clicks
     across the whole viewport; children opt back in individually. */
  pointer-events: none;
  color-scheme: light dark;
  font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
}

* { box-sizing: border-box; margin: 0; padding: 0; }

/* ── The seal ──────────────────────────────────────────────────────────────
   Anchored inside the focused field, and mounted only while a field is
   focused. There is no dock, no pill and no persistent launcher: the previous
   build put a box in the bottom-right corner of every page with three or more
   inputs, whether or not anyone had asked it to be there.                   */
.seal {
  position: fixed;
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--aff-guilloche);
  border-radius: 50%;
  background: var(--aff-leaf);
  color: var(--aff-ink2);
  cursor: pointer;
  pointer-events: auto;
  padding: 0;
  transition: color 140ms var(--aff-ease), border-color 140ms var(--aff-ease),
    background-color 140ms var(--aff-ease);
  animation: seal-in 140ms var(--aff-ease) both;
  box-shadow: 0 1px 3px oklch(0% 0 0 / 0.12);
}

/* Hover only darkens. It never expands: a widget that grows under an unintended
   cursor is the documented failure of every field-anchored assistant, and it
   lands on the field the person is typing into. */
.seal:hover,
.seal[aria-expanded="true"] {
  border-color: var(--aff-ink);
  background: var(--aff-ink);
  color: var(--aff-leaf);
}

.seal:focus-visible {
  outline: 2px solid var(--aff-query);
  outline-offset: 1px;
}

.seal svg { width: 12px; height: 12px; display: block; }

/*
  Position and animation must not share a property.

  Everything the overlay anchors to a field is placed with the standalone translate property
  and animated with the standalone scale and rotate ones. They compose into the same matrix
  without touching each other's declarations, which the transform shorthand cannot do: a
  keyframe animating transform with animation-fill-mode both holds its final value forever and
  outranks an inline style, so the entrance animation silently reset every seal and every stamp
  to transform none and parked them all at the top-left corner of the page.
*/
@keyframes seal-in {
  from { opacity: 0; scale: 0.7; }
  to   { opacity: 1; scale: 1; }
}

/* Progress while a fill runs: the seal fills clockwise as fields land. */
.seal[data-progress] {
  background:
    conic-gradient(var(--aff-ink) calc(var(--progress, 0) * 1turn), transparent 0),
    var(--aff-leaf);
  border-color: var(--aff-ink);
}

/* ── The slip ─────────────────────────────────────────────────────────────
   An endorsement slip: what can be done to this field, and to the form.     */
.slip {
  position: fixed;
  min-width: 190px;
  max-width: min(280px, calc(100vw - 24px));
  border: 1px solid var(--aff-guilloche);
  border-radius: var(--aff-radius);
  background: var(--aff-leaf);
  color: var(--aff-ink);
  font-size: 13px;
  line-height: 1.45;
  pointer-events: auto;
  overflow: hidden;
  box-shadow: 0 8px 28px -8px oklch(0% 0 0 / 0.3), 0 1px 3px oklch(0% 0 0 / 0.14);
  animation: slip-in 160ms var(--aff-ease) both;
  transform-origin: var(--origin-x, 100%) var(--origin-y, 0%);
}

@keyframes slip-in {
  from { opacity: 0; scale: 0.94; }
  to   { opacity: 1; scale: 1; }
}

.slip-head {
  padding: 8px 11px 7px;
  border-bottom: 1px solid var(--aff-guilloche-soft);
}

.slip-label {
  font-size: 9.5px;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--aff-ink3);
}

.slip-question {
  margin-top: 3px;
  font-size: 12px;
  color: var(--aff-ink);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.slip-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 11px;
  border: 0;
  border-bottom: 1px solid var(--aff-guilloche-soft);
  background: transparent;
  color: var(--aff-ink);
  font: inherit;
  font-size: 12.5px;
  text-align: left;
  cursor: pointer;
  transition: background-color 120ms var(--aff-ease);
}

.slip-item:last-child { border-bottom: 0; }
.slip-item:hover:not(:disabled),
.slip-item[data-active="true"] { background: var(--aff-guilloche-soft); }
.slip-item:disabled { color: var(--aff-ink3); cursor: default; }
.slip-item svg { width: 14px; height: 14px; flex: none; color: var(--aff-ink3); }
.slip-item-quiet { color: var(--aff-ink2); font-size: 12px; }
.slip-item:focus-visible { outline: 2px solid var(--aff-query); outline-offset: -2px; }

.slip-note {
  padding: 7px 11px;
  font-size: 11.5px;
  line-height: 1.4;
  color: var(--aff-ink3);
  border-top: 1px solid var(--aff-guilloche-soft);
}

.slip-note-bad { color: var(--aff-endorse); }

/* The review slip's editable answer. */
.slip-body { padding: 9px 11px; }

.slip-value {
  width: 100%;
  min-height: 58px;
  max-height: 180px;
  padding: 6px 7px;
  border: 1px solid var(--aff-guilloche);
  border-radius: var(--aff-radius);
  background: var(--aff-stock);
  color: var(--aff-ink);
  font: inherit;
  font-size: 12.5px;
  line-height: 1.5;
  resize: vertical;
}

.slip-value:focus-visible { outline: 2px solid var(--aff-query); outline-offset: -1px; }

.slip-actions { display: flex; gap: 6px; padding: 0 11px 10px; }

.slip-btn {
  flex: 1;
  padding: 5px 8px;
  border: 1px solid var(--aff-guilloche);
  border-radius: var(--aff-radius);
  background: transparent;
  color: var(--aff-ink);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
  transition: background-color 120ms var(--aff-ease), border-color 120ms var(--aff-ease);
}

.slip-btn:hover { border-color: var(--aff-ink); }
.slip-btn-plate { background: var(--aff-ink); border-color: var(--aff-ink); color: var(--aff-leaf); }
.slip-btn-plate:hover { opacity: 0.9; }
.slip-btn-bad { color: var(--aff-endorse); border-color: var(--aff-endorse); }
.slip-btn:focus-visible { outline: 2px solid var(--aff-query); outline-offset: 1px; }

/* The stamp on the review slip's header. */
.slip-stamp {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 1px 5px;
  border: 1px solid var(--aff-endorse);
  border-radius: var(--aff-radius);
  color: var(--aff-endorse);
  font-size: 9.5px;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.slip-stamp-unsure { border-color: var(--aff-query); color: var(--aff-query); }

/* ── Field marks ──────────────────────────────────────────────────────────
   A stated answer settles and leaves the page alone. A concluded one keeps
   its mark until the person acts on it — auto-filled content that becomes
   indistinguishable from typed content is how a confident wrong answer gets
   submitted, and the old markers faded after 1.6 seconds regardless.        */
.mark {
  position: fixed;
  border-radius: var(--aff-radius);
  pointer-events: none;
  box-shadow: 0 0 0 2px var(--mark-color, var(--aff-query));
  opacity: 0;
  transition: opacity 220ms var(--aff-ease);
}

.mark[data-state="active"] { --mark-color: var(--aff-query); opacity: 1; }

/* Read straight off what you told it: confirm, then get out of the way. */
.mark[data-state="printed"],
.mark[data-state="failed"] {
  animation: mark-settle 1500ms var(--aff-ease) forwards;
}

.mark[data-state="printed"] { --mark-color: var(--aff-ink); }
.mark[data-state="failed"]  { --mark-color: var(--aff-ink3); }

/* Concluded, or answered with low confidence. Persists. */
.mark[data-state="endorsed"] { --mark-color: var(--aff-endorse); opacity: 1; }
.mark[data-state="unsure"]   { --mark-color: var(--aff-query); opacity: 1; }

@keyframes mark-settle {
  0%   { opacity: 1; }
  60%  { opacity: 1; }
  100% { opacity: 0; }
}

/* The endorsement tab: the only clickable part of a mark, so the outline never
   steals a click meant for the field underneath. */
.tab {
  position: fixed;
  display: flex;
  align-items: center;
  gap: 3px;
  height: 16px;
  padding: 0 4px;
  border: 1px solid var(--aff-endorse);
  border-radius: var(--aff-radius);
  background: var(--aff-endorse);
  color: var(--aff-leaf);
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  cursor: pointer;
  pointer-events: auto;
  animation: tab-stamp 320ms var(--aff-ease) both;
}

.tab[data-kind="unsure"] { border-color: var(--aff-query); background: var(--aff-query); }
.tab svg { width: 10px; height: 10px; }
.tab:focus-visible { outline: 2px solid var(--aff-query); outline-offset: 2px; }

/* The stamp being pressed: over-scaled and off-angle, settling square. This is
   the one authored moment on the page, and it marks the one thing that must
   not be missed. */
@keyframes tab-stamp {
  0%   { opacity: 0; rotate: -6deg; scale: 1.3; }
  60%  { opacity: 1; }
  100% { opacity: 1; rotate: 0deg; scale: 1; }
}

/* A field a review row is pointing at. */
.mark[data-flash="true"] {
  animation: mark-flash 900ms var(--aff-ease);
}

@keyframes mark-flash {
  0%, 100% { box-shadow: 0 0 0 2px var(--mark-color, var(--aff-query)); }
  40%      { box-shadow: 0 0 0 5px var(--mark-color, var(--aff-query)); }
}

/* Anyone who has asked the OS for less motion gets none of the above. Marks that
   must persist still do — the request is about movement, not information. */
@media (prefers-reduced-motion: reduce) {
  .seal, .slip, .tab, .mark { animation: none !important; }
  .mark[data-state="printed"],
  .mark[data-state="failed"] { opacity: 0; }
}
`

export interface OverlayHost {
  root: ShadowRoot
  destroy: () => void
}

let host: OverlayHost | null = null
let hostElement: HTMLElement | null = null

export function getOverlayHost(): OverlayHost {
  if (host && document.documentElement.contains(hostElement)) return host

  const element = document.createElement('div')
  element.id = HOST_ID
  // Which document to print, judged from the page we are standing on rather than the OS —
  // see `detectPageScheme`. Re-read on every remount, which covers a site's own theme toggle.
  element.dataset.scheme = detectPageScheme()
  // Attached to <html>, not <body>: some sites replace body wholesale during client-side
  // navigation, which would silently remove the overlay.
  document.documentElement.appendChild(element)
  hostElement = element

  const root = element.attachShadow({ mode: 'closed' })
  const style = document.createElement('style')
  style.textContent = OVERLAY_STYLES
  root.appendChild(style)

  host = {
    root,
    destroy: () => {
      element.remove()
      host = null
      hostElement = null
    },
  }
  return host
}

export function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** Inline SVG, matching the panel's authored set: 16px grid, 1.5px stroke, mitred joins. */
export const GLYPH = {
  seal: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" aria-hidden="true"><circle cx="8" cy="8" r="6.75" stroke-width="1.5"/><path d="M8 2.6 9.9 6.1 13.4 8 9.9 9.9 8 13.4 6.1 9.9 2.6 8 6.1 6.1z" stroke-width="1"/><circle cx="8" cy="8" r="1.6" stroke-width="1"/></svg>',
  stamp:
    '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="butt" stroke-linejoin="miter" aria-hidden="true"><path d="M5.25 2.25h5.5v3.5l1.5 3.25h-8.5l1.5-3.25z"/><path d="M2.5 11.5h11M2.5 13.75h11"/></svg>',
  pen: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="butt" stroke-linejoin="miter" aria-hidden="true"><path d="m2.5 13.5.75-3 8-8 2.25 2.25-8 8z"/><path d="m9.75 4.25 2.25 2.25"/></svg>',
  form: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="butt" stroke-linejoin="miter" aria-hidden="true"><path d="M3.25 1.75h6l3.5 3.5v9h-9.5z"/><path d="M9.25 1.75v3.5h3.5"/><path d="M5.5 8.5h5M5.5 11h3"/></svg>',
  panel:
    '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="butt" stroke-linejoin="miter" aria-hidden="true"><path d="M2 2.75h12v10.5H2z"/><path d="M10 2.75v10.5"/></svg>',
  mute: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="butt" stroke-linejoin="miter" aria-hidden="true"><circle cx="8" cy="8" r="6"/><path d="m4 12 8-8"/></svg>',
} as const
