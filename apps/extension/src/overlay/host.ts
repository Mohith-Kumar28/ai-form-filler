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

.layer {
  position: fixed;
  font-family: ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif;
  font-size: 13px;
  line-height: 1.4;
  pointer-events: auto;
}

.launcher {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 7px 12px 7px 10px;
  border: none;
  border-radius: 999px;
  background: oklch(58% 0.19 274);
  color: white;
  font: inherit;
  font-weight: 500;
  cursor: pointer;
  box-shadow: 0 2px 8px oklch(0% 0 0 / 0.18), 0 0 0 1px oklch(0% 0 0 / 0.04);
  transition: transform 140ms cubic-bezier(0.2, 0, 0, 1), box-shadow 140ms ease;
}
.launcher:hover { transform: translateY(-1px); box-shadow: 0 4px 12px oklch(0% 0 0 / 0.22); }
.launcher:active { transform: translateY(0); }
.launcher:focus-visible { outline: 2px solid white; outline-offset: 2px; }
.launcher[disabled] { opacity: 0.7; cursor: default; transform: none; }

.spark { width: 14px; height: 14px; flex: none; }

/* Entry: a short rise and settle. Deliberately not a bounce — this appears unprompted on
   someone else's page, so it should read as arriving, not demanding attention. */
@keyframes aff-enter {
  from { opacity: 0; transform: translateY(6px) scale(0.96); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}
.launcher { animation: aff-enter 220ms cubic-bezier(0.2, 0, 0, 1) both; }

@keyframes aff-spin { to { transform: rotate(360deg); } }
.spinner {
  width: 13px; height: 13px; flex: none;
  border: 2px solid oklch(100% 0 0 / 0.35);
  border-top-color: white;
  border-radius: 50%;
  animation: aff-spin 700ms linear infinite;
}

/* Per-field markers drawn over the page during and after a fill. */
.marker {
  position: fixed;
  border-radius: 4px;
  pointer-events: none;
  box-shadow: 0 0 0 2px var(--marker-color, oklch(58% 0.19 274));
  opacity: 0;
  transition: opacity 200ms ease;
}
.marker[data-state='active']   { --marker-color: oklch(58% 0.19 274); opacity: 1; }
.marker[data-state='filled']   { --marker-color: oklch(65% 0.16 155); opacity: 1; }
.marker[data-state='review']   { --marker-color: oklch(72% 0.16 75);  opacity: 1; }
.marker[data-state='failed']   { --marker-color: oklch(60% 0.20 25);  opacity: 1; }

/* Anyone who has asked the OS for less motion gets none of the above. */
@media (prefers-reduced-motion: reduce) {
  .launcher, .marker { animation: none !important; transition: opacity 150ms ease !important; }
  .launcher:hover { transform: none; }
  .spinner { animation-duration: 2s; }
}
`

export interface OverlayHost {
  root: ShadowRoot
  destroy: () => void
}

let host: OverlayHost | null = null

export function getOverlayHost(): OverlayHost {
  if (host && document.documentElement.contains(hostElement)) return host

  const element = document.createElement('div')
  element.id = HOST_ID
  // The host is deliberately attached to <html>, not <body>: some sites replace body
  // wholesale during client-side navigation, which would silently remove our overlay.
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

let hostElement: HTMLElement | null = null

export function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}
