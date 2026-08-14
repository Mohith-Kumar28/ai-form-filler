/**
 * The overlay's isolated rendering surface.
 *
 * A **closed** shadow root, not open: page scripts cannot reach `.shadowRoot` to read or
 * mutate our UI, and page CSS cannot select into it. Equally important in the other
 * direction — our styles cannot leak out and restyle the page, which is how an injected
 * overlay breaks the site it is trying to help.
 *
 * Styles are inlined rather than linked because a `chrome-extension://` stylesheet is
 * blocked by the CSP of a meaningful number of sites.
 */

const HOST_ID = 'aff-overlay-host'

/**
 * `2147483647` is the maximum 32-bit signed integer, and the value sites use for their own
 * "always on top" layers. Matching it rather than exceeding it (which is impossible) means
 * we lose ties to elements declared later — acceptable, and better than an arms race.
 */
const OVERLAY_STYLES = `
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
}

* { box-sizing: border-box; margin: 0; padding: 0; }

/* ── The dock ──────────────────────────────────────────────────────────────
   Fixed to the bottom-right. Never anchored to a field, so it cannot land on
   the form it is offering to fill, and scrolling costs nothing to track.
   safe-area insets keep it clear of mobile browser chrome.                  */
.dock {
  position: fixed;
  right: max(16px, env(safe-area-inset-right));
  bottom: max(16px, env(safe-area-inset-bottom));
  width: max-content;
  max-width: min(320px, calc(100vw - 32px));
  pointer-events: auto;
  font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  font-size: 13px;
  line-height: 1.45;
  color: var(--dock-ink);
  animation: dock-in 240ms cubic-bezier(0.2, 0, 0, 1) both;

  --dock-page: oklch(99.5% 0.002 230);
  --dock-ink: oklch(26% 0.022 250);
  --dock-graphite: oklch(48% 0.016 250);
  --dock-rule: oklch(89% 0.012 230);
  --dock-pen: oklch(45% 0.15 250);
  --dock-annot: oklch(53% 0.19 25);
  --dock-ok: oklch(48% 0.13 155);
}

@media (prefers-color-scheme: dark) {
  .dock {
    --dock-page: oklch(23.5% 0.02 250);
    --dock-ink: oklch(93% 0.01 250);
    --dock-graphite: oklch(72% 0.014 250);
    --dock-rule: oklch(33% 0.022 250);
    --dock-pen: oklch(72% 0.14 250);
    --dock-annot: oklch(70% 0.17 28);
    --dock-ok: oklch(72% 0.15 155);
  }
}

@keyframes dock-in {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: none; }
}

.dock-bar,
.dock-panel {
  background: var(--dock-page);
  border: 1px solid var(--dock-rule);
  border-radius: 3px;
  box-shadow: 0 4px 16px oklch(0% 0 0 / 0.14), 0 1px 3px oklch(0% 0 0 / 0.08);
}

.dock-bar { display: flex; align-items: stretch; overflow: hidden; }

.dock-main {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 9px 12px;
  border: 0;
  background: var(--dock-pen);
  color: var(--dock-page);
  font: inherit;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 140ms ease;
}
.dock-main:hover { opacity: 0.9; }

.dock-x {
  display: flex;
  align-items: center;
  padding: 0 8px;
  border: 0;
  border-left: 1px solid var(--dock-rule);
  background: var(--dock-page);
  color: var(--dock-graphite);
  cursor: pointer;
  transition: color 140ms ease;
}
.dock-x:hover { color: var(--dock-annot); }
.dock-x svg { width: 13px; height: 13px; }

.dock-panel { padding: 11px 13px; }
.dock-row { display: flex; align-items: center; gap: 7px; }
.dock-title { font-weight: 500; }
.dock-title b { font-weight: 600; }

.dock-icon { display: flex; flex: none; }
.dock-icon svg { width: 15px; height: 15px; }
.dock-ok { color: var(--dock-ok); }
.dock-bad { color: var(--dock-annot); }

.dock-num {
  font-family: ui-monospace, "SF Mono", Menlo, monospace;
  font-variant-numeric: tabular-nums;
}

.dock-detail { margin-top: 3px; color: var(--dock-graphite); font-size: 12px; }
.dock-annot { color: var(--dock-annot); }

.dock-actions { display: flex; gap: 6px; margin-top: 9px; }

.dock-btn {
  padding: 4px 10px;
  border: 1px solid var(--dock-pen);
  border-radius: 2px;
  background: transparent;
  color: var(--dock-pen);
  font: inherit;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: background 140ms ease;
}
.dock-btn:hover { background: color-mix(in oklch, var(--dock-pen) 12%, transparent); }
.dock-btn-quiet { border-color: var(--dock-rule); color: var(--dock-graphite); }

.dock button:focus-visible { outline: 2px solid var(--dock-pen); outline-offset: 1px; }

@keyframes dock-spin { to { transform: rotate(360deg); } }
.dock-spinner {
  width: 13px; height: 13px; flex: none;
  border: 1.5px solid var(--dock-rule);
  border-top-color: var(--dock-pen);
  border-radius: 50%;
  animation: dock-spin 700ms linear infinite;
}

/* ── Field markers ────────────────────────────────────────────────────────
   Transient by design. An outline on every answered field turned the form
   into a wall of colour and buried the handful that actually wanted a second
   look — and a permanent border on someone else's page is our chrome sitting
   on their design. Markers now trace the fill as it happens and clear after,
   and the dock plus the review panel carry what needs acting on.            */
.marker {
  position: fixed;
  border-radius: 3px;
  pointer-events: none;
  box-shadow: 0 0 0 2px var(--marker-color, oklch(45% 0.15 250));
  opacity: 0;
  transition: opacity 220ms ease;
}

/* Only the field being written right now is marked strongly. */
.marker[data-state="active"] {
  --marker-color: oklch(48% 0.19 262);
  opacity: 1;
}

/* Every settled state confirms briefly, then leaves the page alone. */
.marker[data-state="filled"],
.marker[data-state="review"],
.marker[data-state="failed"] {
  animation: marker-confirm 1600ms ease-out forwards;
}
.marker[data-state="filled"] { --marker-color: oklch(46% 0.14 155); }
.marker[data-state="review"] { --marker-color: oklch(52% 0.2 25); }
.marker[data-state="failed"] { --marker-color: oklch(55% 0.02 255); }

@keyframes marker-confirm {
  0%   { opacity: 1; }
  55%  { opacity: 1; }
  100% { opacity: 0; }
}

/* Anyone who has asked the OS for less motion gets none of the above. */
@media (prefers-reduced-motion: reduce) {
  .dock, .marker { animation: none !important; transition: opacity 150ms ease !important; }
  /* No animation means no fade-out, so settled markers simply never show. */
  .marker[data-state="filled"],
  .marker[data-state="review"],
  .marker[data-state="failed"] { opacity: 0; }
  .dock-spinner { animation-duration: 2s; }
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
