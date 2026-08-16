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
 * module the side panel's palette is checked against.
 *
 * The panel's bundled typeface is deliberately absent. Serving it here needs `FontFace` plus an
 * ArrayBuffer to survive a strict `font-src` policy, which is not worth it for a few short
 * labels; identity on the page is carried by colour and motion instead.
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
  pointer-events: none;
  color-scheme: light dark;
  font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
}

* { box-sizing: border-box; margin: 0; padding: 0; }

/* ── The launcher ─────────────────────────────────────────────────────────
   A draggable pill, bottom-right. Appears when a form is detected, and is
   the extension's entire persistent presence: one click fills the form,
   and it turns into the progress indicator and then the result.            */
.launcher {
  position: fixed;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 10px 15px;
  border: 0;
  border-radius: var(--aff-radius-full);
  background: linear-gradient(135deg, var(--aff-sparkle), var(--aff-accent));
  color: #fff;
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  line-height: 1;
  cursor: grab;
  pointer-events: auto;
  user-select: none;
  box-shadow: 0 6px 20px -6px var(--aff-shadow-strong);
  transition: scale 140ms var(--aff-spring);
  animation: pop-in 200ms var(--aff-spring) both;
}

.launcher:active { cursor: grabbing; scale: 0.97; }
.launcher svg { width: 14px; height: 14px; flex: none; }

.launcher[data-busy="true"] {
  background: var(--aff-surface-raised);
  color: var(--aff-ink);
  border: 1px solid var(--aff-border);
  box-shadow: 0 6px 20px -6px var(--aff-shadow-strong);
  cursor: default;
}

.launcher-ring {
  width: 14px;
  height: 14px;
  flex: none;
  border-radius: 50%;
  border: 2px solid currentColor;
  border-top-color: transparent;
  animation: spin 900ms linear infinite;
}

/* ── Confetti ─────────────────────────────────────────────────────────────
   The done-moment celebration. Pure DOM scraps, flown and spun on standalone
   translate/rotate so they never touch the placement of anything anchored. */
.confetti {
  position: fixed;
  width: 7px;
  height: 7px;
  border-radius: 2px;
  pointer-events: none;
  animation: confetti-pop 800ms var(--aff-ease) forwards;
}

@keyframes confetti-pop {
  from { opacity: 1; translate: 0 0; rotate: 0deg; }
  to { opacity: 0; translate: var(--dx) var(--dy); rotate: var(--rot); }
}

/* ── The card ─────────────────────────────────────────────────────────────
   Every popover: the launcher's menu, the review card, the result.         */
.card {
  position: fixed;
  min-width: 210px;
  max-width: min(300px, calc(100vw - 24px));
  border: 1px solid var(--aff-border);
  border-radius: var(--aff-radius-md);
  background: var(--aff-surface-raised);
  color: var(--aff-ink);
  font-size: 13px;
  line-height: 1.45;
  pointer-events: auto;
  overflow: hidden;
  box-shadow: 0 8px 28px -8px var(--aff-shadow-strong), 0 1px 3px var(--aff-shadow);
  animation: pop-in 160ms var(--aff-ease) both;
  transform-origin: var(--origin-x, 100%) var(--origin-y, 0%);
}

.card-item {
  display: flex;
  align-items: center;
  gap: 9px;
  width: 100%;
  padding: 10px 13px;
  border: 0;
  border-bottom: 1px solid var(--aff-border-muted);
  background: transparent;
  color: var(--aff-ink);
  font: inherit;
  font-size: 13px;
  text-align: left;
  cursor: pointer;
  transition: background-color 120ms var(--aff-ease);
}

.card-item:last-child { border-bottom: 0; }
.card-item:hover:not(:disabled),
.card-item[data-active="true"] { background: var(--aff-surface-muted); }
.card-item:disabled { color: var(--aff-ink-dim); cursor: default; }
.card-item svg { width: 14px; height: 14px; flex: none; color: var(--aff-ink-muted); }
.card-item:focus-visible { outline: 2px solid var(--aff-accent); outline-offset: -2px; }
.card-item-quiet { color: var(--aff-ink-muted); font-size: 12.5px; }

.card-question {
  padding: 9px 13px 7px;
  border-bottom: 1px solid var(--aff-border-muted);
  font-size: 12px;
  line-height: 1.35;
  color: var(--aff-ink-muted);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.card-note {
  padding: 8px 13px;
  font-size: 12px;
  line-height: 1.4;
  color: var(--aff-ink-dim);
  border-top: 1px solid var(--aff-border-muted);
}

.card-note-bad { color: var(--aff-danger); }

.card-body { padding: 10px 13px; }

.card-value {
  width: 100%;
  min-height: 58px;
  max-height: 180px;
  padding: 7px 9px;
  border: 1px solid var(--aff-border);
  border-radius: var(--aff-radius-sm);
  background: var(--aff-surface);
  color: var(--aff-ink);
  font: inherit;
  font-size: 12.5px;
  line-height: 1.5;
  resize: vertical;
}

.card-value:focus-visible { outline: 2px solid var(--aff-accent); outline-offset: -1px; }

.card-actions { display: flex; gap: 6px; padding: 10px 13px 12px; }
.card-chips { display: flex; flex-wrap: wrap; gap: 5px; padding: 10px 13px 12px; }

.card-chip {
  padding: 4px 9px;
  border: 1px solid var(--aff-border);
  border-radius: var(--aff-radius-full);
  background: transparent;
  color: var(--aff-ink-muted);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
  transition: border-color 120ms var(--aff-ease), color 120ms var(--aff-ease);
}

.card-chip:hover:not(:disabled) { border-color: var(--aff-accent); color: var(--aff-ink); }
.card-chip:disabled { opacity: 0.5; cursor: default; }

.card-btn {
  flex: 1;
  padding: 6px 10px;
  border: 1px solid var(--aff-border);
  border-radius: var(--aff-radius-full);
  background: transparent;
  color: var(--aff-ink);
  font: inherit;
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 120ms var(--aff-ease), border-color 120ms var(--aff-ease);
}

.card-btn:hover { border-color: var(--aff-accent); }
.card-btn-primary {
  background: linear-gradient(135deg, var(--aff-sparkle), var(--aff-accent));
  border-color: transparent;
  color: #fff;
}
.card-btn-primary:hover { opacity: 0.9; }
.card-btn-bad { color: var(--aff-danger); border-color: var(--aff-danger); }

/* The guessed badge on a review card header. */
.card-stamp {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 1px 7px;
  border-radius: var(--aff-radius-full);
  background: var(--aff-accent-muted);
  color: var(--aff-accent);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
.card-stamp svg { width: 10px; height: 10px; }

/* ── Field marks ──────────────────────────────────────────────────────────
   What happened to a field, drawn over it rather than on it. A guessed
   answer keeps its ring and gains a clickable "check" pill; a fact settles
   and leaves the page alone.                                                 */
.mark {
  position: fixed;
  border-radius: var(--aff-radius-sm);
  pointer-events: none;
  box-shadow: 0 0 0 2.5px var(--mark-color, var(--aff-accent));
  opacity: 0;
  transition: opacity 220ms var(--aff-ease);
}

.mark[data-state="active"] { --mark-color: var(--aff-accent); opacity: 1; }

.mark[data-state="filled"],
.mark[data-state="failed"] {
  animation: mark-settle 1500ms var(--aff-ease) forwards;
}

.mark[data-state="filled"] { --mark-color: var(--aff-positive); }
.mark[data-state="failed"] { --mark-color: var(--aff-danger); }
.mark[data-state="aiWrote"] { --mark-color: var(--aff-accent); opacity: 1; }

@keyframes mark-settle {
  0% { opacity: 1; }
  60% { opacity: 1; }
  100% { opacity: 0; }
}

/* The "check me" pill: the only clickable part of a mark, so the outline
   never steals a click meant for the field underneath. */
.check-pill {
  position: fixed;
  display: flex;
  align-items: center;
  gap: 4px;
  height: 20px;
  padding: 0 8px;
  border: 0;
  border-radius: var(--aff-radius-full);
  background: var(--aff-accent);
  color: #fff;
  font: inherit;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  cursor: pointer;
  pointer-events: auto;
  animation: pill-in 220ms var(--aff-spring) both;
}
.check-pill svg { width: 10px; height: 10px; }
.check-pill:focus-visible { outline: 2px solid var(--aff-accent); outline-offset: 2px; }

@keyframes pill-in {
  from { opacity: 0; scale: 0.8; }
  to { opacity: 1; scale: 1; }
}

/* A field a review row is pointing at. */
.mark[data-flash="true"] {
  animation: mark-flash 900ms var(--aff-ease);
}

@keyframes mark-flash {
  0%, 100% { box-shadow: 0 0 0 2.5px var(--mark-color, var(--aff-accent)); }
  40% { box-shadow: 0 0 0 6px var(--mark-color, var(--aff-accent)); }
}

@keyframes pop-in {
  from { opacity: 0; scale: 0.94; }
  to { opacity: 1; scale: 1; }
}

@keyframes spin {
  to { rotate: 1turn; }
}

@media (prefers-reduced-motion: reduce) {
  .launcher, .card, .mark, .check-pill { animation: none !important; }
  .mark[data-state="filled"],
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
  element.dataset.scheme = detectPageScheme()
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

export function isOverlayEvent(event: Event): boolean {
  return event.composedPath().some((node) => node instanceof HTMLElement && node.id === HOST_ID)
}

/** Inline SVG, matching the panel's authored set: 16px grid, 1.75px stroke, round joins. */
export const GLYPH = {
  sparkle:
    '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linejoin="round" aria-hidden="true"><path d="M8 2 9.3 6.7 14 8 9.3 9.3 8 14 6.7 9.3 2 8 6.7 6.7Z"/></svg>',
  pen: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m2.5 13.5.75-3 8-8 2.25 2.25-8 8z"/><path d="m9.75 4.25 2.25 2.25"/></svg>',
  check:
    '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 8.5 6.5 12 13 4.5"/></svg>',
  form: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 2h5.5l3.5 3.5v8.5H3.5z"/><path d="M9 2v3.5h3.5M5.5 8.5h5M5.5 11h3"/></svg>',
  panel:
    '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 2.75h12v10.5H2z"/><path d="M10 2.75v10.5"/></svg>',
  mute: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="8" cy="8" r="6"/><path d="m4 12 8-8"/></svg>',
} as const
