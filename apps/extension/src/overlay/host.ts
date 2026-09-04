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
  /*
    The overlay's own scale, because there is no Tailwind on someone else's page.

    Same ramp as the panel: 11/12/13 with a 13.5 base for anything the person has to read. The
    tap floor is a floor: this UI is drawn over a form somebody is mid-way through, and a 22px
    target is a misclick into the page behind it.
  */
  --aff-text-2xs: 11px;
  --aff-text-xs: 12px;
  --aff-text-sm: 13px;
  --aff-text-base: 13.5px;
  --aff-pad: 12px;
  --aff-gap: 8px;
  --aff-tap: 28px;

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
  -webkit-font-smoothing: antialiased;
}

* { box-sizing: border-box; margin: 0; padding: 0; }
button { font-family: inherit; }

/* ── The launcher dock ────────────────────────────────────────────────────
   One object pinned to the right edge of the window: a raised strip with the
   mascot tile at its right end. Everything the launcher has to say or offer —
   the drag handle, the side-panel button, the shortcut, the progress of a
   fill, the stop button — lives inside that strip and grows it leftward into
   the page, where there is always room. Nothing floats above or below it.

   Anchored right, not positioned by arithmetic: right: 0 is correct at every
   width, and translate carries the vertical position alone.               */
.launcher-wrap {
  position: fixed;
  top: 0;
  right: 0;
  display: flex;
  align-items: center;
  height: 36px;
  overflow: hidden;
  border: 1px solid var(--aff-border);
  border-right: 0;
  border-radius: var(--aff-radius-lg) 0 0 var(--aff-radius-lg);
  background: var(--aff-surface-raised);
  box-shadow: 0 4px 16px -6px var(--aff-shadow-strong), 0 1px 2px var(--aff-shadow);
  /* The dock is a hit target exactly as large as it is painted — no invisible collar. */
  pointer-events: auto;
  animation: dock-in 200ms var(--aff-ease) both;
}

/* The tile. The mascot in accent on the raised ground; no gradient, no glow. */
.launcher {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: 36px;
  height: 34px;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--aff-accent);
  cursor: pointer;
  user-select: none;
  transition: background-color 120ms var(--aff-ease), color 120ms var(--aff-ease);
}
.launcher:hover { background: var(--aff-surface-muted); color: var(--aff-ink); }
.launcher:active .launcher-icon { scale: 0.92; }
.launcher:focus-visible { outline: 2px solid var(--aff-accent); outline-offset: -2px; }
.launcher-icon { display: flex; flex: none; transition: scale 100ms var(--aff-ease); }
.launcher-icon svg { width: 18px; height: 18px; }

/*
  Working: a thin ring turns around the tile. Rotation belongs to the ring, so the face stays
  a face — a spinning smile reads as panic, and scale stays free for :active.
*/
.launcher--loading::after {
  content: '';
  position: absolute;
  inset: 5px;
  border-radius: 50%;
  border: 1.5px solid transparent;
  border-top-color: var(--aff-accent);
  border-right-color: var(--aff-accent);
  animation: launcher-spin 900ms linear infinite;
}

@keyframes launcher-spin {
  to { rotate: 360deg; }
}

/*
  "There is a form here" — two gentle beats on detection, on the icon only, then still.
  The class sits on the button so animationend bubbles up to it and clears the class.
*/
.launcher--attention .launcher-icon {
  animation: launcher-attention 700ms var(--aff-spring) 2;
}

@keyframes launcher-attention {
  0%, 100% { scale: 1; }
  40% { scale: 1.2; }
}

/*
  The extras: drag handle, side panel, shortcut. Revealed on approach by growing a grid column
  from 0fr to 1fr — no measurement, no max-width guess — and only while the rail is quiet:
  during a fill the dock is busy saying something else.
*/
.launcher-extras {
  display: grid;
  grid-template-columns: 0fr;
  transition: grid-template-columns 180ms var(--aff-ease);
}
.launcher-extras-inner {
  display: flex;
  align-items: center;
  gap: 2px;
  min-width: 0;
  overflow: hidden;
  padding-left: 4px;
  opacity: 0;
  pointer-events: none;
  transition: opacity 120ms var(--aff-ease);
}
.launcher-wrap:not([data-rail="true"]):hover .launcher-extras,
.launcher-wrap:not([data-rail="true"])[data-near="true"] .launcher-extras,
.launcher-wrap[data-dragging="true"] .launcher-extras {
  grid-template-columns: 1fr;
}
.launcher-wrap:not([data-rail="true"]):hover .launcher-extras-inner,
.launcher-wrap:not([data-rail="true"])[data-near="true"] .launcher-extras-inner,
.launcher-wrap[data-dragging="true"] .launcher-extras-inner {
  opacity: 1;
  pointer-events: auto;
  transition-delay: 60ms;
}

/* The drag handle: six dots in two columns, the conventional "pick this up" glyph. */
.launcher-grab {
  display: grid;
  grid-template-columns: repeat(2, 3px);
  gap: 3px;
  justify-content: center;
  align-content: center;
  flex: none;
  width: 16px;
  height: 28px;
  border: 0;
  border-radius: var(--aff-radius-sm);
  background: transparent;
  cursor: grab;
  color: var(--aff-ink-dim);
}
.launcher-grab:hover { color: var(--aff-ink-muted); background: var(--aff-surface-muted); }
.launcher-grab:active,
.launcher-wrap[data-dragging="true"] .launcher-grab { cursor: grabbing; }
.launcher-grab span {
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: currentColor;
}

/* Open the side panel — an icon button, named by its tooltip. */
.launcher-panel {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: 28px;
  height: 28px;
  border: 0;
  border-radius: var(--aff-radius-sm);
  background: transparent;
  color: var(--aff-ink-dim);
  cursor: pointer;
  transition: background-color 120ms var(--aff-ease), color 120ms var(--aff-ease);
}
.launcher-panel:hover { background: var(--aff-surface-muted); color: var(--aff-ink); }
.launcher-panel:active { scale: 0.96; }
.launcher-panel svg { width: 15px; height: 15px; flex: none; }
.launcher-panel:focus-visible { outline: 2px solid var(--aff-accent); outline-offset: -2px; }

/* The shortcut, as a key cap. Present only when the browser reports a real binding. */
.launcher-hint {
  display: none;
  align-items: center;
  flex: none;
  height: 20px;
  margin: 0 4px 0 2px;
  padding: 0 5px;
  border: 1px solid var(--aff-border);
  border-radius: var(--aff-radius-sm);
  background: var(--aff-surface-muted);
  color: var(--aff-ink-muted);
  font-family: inherit;
  font-size: var(--aff-text-2xs);
  font-weight: 500;
  line-height: 1;
  white-space: nowrap;
}
.launcher-wrap[data-hint="true"] .launcher-hint { display: inline-flex; }

/*
  The rail: what the fill is doing, then how far it has got, then a stop button. Shown only
  while it has something to say. Digits are tabular so "9/12" becoming "10/12" moves nothing.
*/
.launcher-rail {
  display: none;
  align-items: center;
  gap: 8px;
  height: 100%;
  padding: 0 4px 0 12px;
  color: var(--aff-ink-muted);
  font-size: var(--aff-text-xs);
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  line-height: 1;
  white-space: nowrap;
  max-width: 46vw;
}
.launcher-wrap[data-rail="true"] .launcher-rail { display: flex; }
.launcher-rail-text {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}
.launcher-rail[data-exhausted="true"] { color: var(--aff-accent); font-weight: 600; }

/* The thinking dot. The pulse is what says "still working". */
.launcher-rail-dot {
  flex: none;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--aff-accent);
  animation: count-breathe 1200ms var(--aff-ease) infinite;
}

@keyframes count-breathe {
  0%, 100% { opacity: 0.35; scale: 0.8; }
  50% { opacity: 1; scale: 1.15; }
}

/* Stop, pinned inside the rail, so the one control with a deadline never moves. */
.launcher-stop {
  display: none;
  align-items: center;
  justify-content: center;
  flex: none;
  width: 24px;
  height: 24px;
  border: 0;
  border-radius: var(--aff-radius-sm);
  background: var(--aff-danger-muted);
  color: var(--aff-danger);
  cursor: pointer;
  transition: filter 120ms var(--aff-ease);
}
.launcher-stop:hover { filter: brightness(0.96); }
.launcher-stop svg { width: 12px; height: 12px; }
.launcher-stop:focus-visible { outline: 2px solid var(--aff-danger); outline-offset: -2px; }
.launcher-wrap[data-filling="true"] .launcher-stop { display: flex; }

/* A 2px progress line along the bottom edge of the dock while answers land. */
.launcher-wrap::after {
  content: '';
  position: absolute;
  left: 0;
  bottom: 0;
  height: 2px;
  width: var(--progress, 0%);
  background: var(--aff-accent);
  opacity: 0;
  transition: width 240ms var(--aff-ease), opacity 160ms var(--aff-ease);
}
.launcher-wrap[data-filling="true"]::after { opacity: 1; }

@keyframes dock-in {
  from { opacity: 0; scale: 0.96; }
  to { opacity: 1; scale: 1; }
}

/* ── The field trigger ────────────────────────────────────────────────────
   A small button beside a focused field: fill this one, or rewrite what is
   already there. Quiet at rest, accent on hover, a ring while it works.   */
.field-trigger {
  position: fixed;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: 1px solid var(--aff-border);
  border-radius: var(--aff-radius-sm);
  background: var(--aff-surface-raised);
  color: var(--aff-ink-muted);
  cursor: pointer;
  pointer-events: auto;
  box-shadow: 0 1px 3px var(--aff-shadow);
  transition: border-color 120ms var(--aff-ease), color 120ms var(--aff-ease);
  animation: trigger-in 140ms var(--aff-ease) both;
}
.field-trigger svg { width: 14px; height: 14px; }
.field-trigger:hover { border-color: var(--aff-accent); color: var(--aff-accent); }
.field-trigger:focus-visible { outline: 2px solid var(--aff-accent); outline-offset: 2px; }

/* Rewrite, not fill: same box, a pen. */
.field-trigger[data-mode="review"] svg { width: 13px; height: 13px; }

/* Working: the glyph gives way to a ring, and the button stops taking clicks. */
.field-trigger[data-loading="true"] { pointer-events: none; color: transparent; }
.field-trigger[data-loading="true"]::after {
  content: '';
  position: absolute;
  inset: 5px;
  border-radius: 50%;
  border: 1.5px solid var(--aff-border);
  border-top-color: var(--aff-accent);
  animation: launcher-spin 900ms linear infinite;
}

@keyframes trigger-in {
  from { opacity: 0; scale: 0.9; }
  to { opacity: 1; scale: 1; }
}

/* ── Confetti ─────────────────────────────────────────────────────────────
   A small burst when a fill lands. Pure DOM scraps on standalone translate,
   anchored to nothing, so they never touch the placement of anything else. */
.confetti {
  position: fixed;
  width: 6px;
  height: 6px;
  border-radius: 2px;
  pointer-events: none;
  animation: confetti-pop 700ms var(--aff-ease) forwards;
}

@keyframes confetti-pop {
  from { opacity: 1; translate: 0 0; rotate: 0deg; }
  to { opacity: 0; translate: var(--dx) var(--dy); rotate: var(--rot); }
}

/* ── The card ─────────────────────────────────────────────────────────────
   Every popover: an error, an inline suggestion, the answer editor.        */
.card {
  position: fixed;
  min-width: 240px;
  max-width: min(340px, calc(100vw - 24px));
  border: 1px solid var(--aff-border);
  border-radius: var(--aff-radius-lg);
  background: var(--aff-surface-raised);
  color: var(--aff-ink);
  font-size: var(--aff-text-sm);
  line-height: 1.5;
  pointer-events: auto;
  overflow: hidden;
  box-shadow: 0 12px 32px -10px var(--aff-shadow-strong), 0 1px 3px var(--aff-shadow);
  animation: pop-in 140ms var(--aff-ease) both;
  transform-origin: var(--origin-x, 100%) var(--origin-y, 0%);
}

.card-item {
  display: flex;
  align-items: center;
  gap: var(--aff-gap);
  width: 100%;
  min-height: var(--aff-tap);
  padding: 8px var(--aff-pad);
  border: 0;
  border-bottom: 1px solid var(--aff-border-muted);
  background: transparent;
  color: var(--aff-ink);
  font: inherit;
  font-size: var(--aff-text-sm);
  font-weight: 500;
  text-align: left;
  cursor: pointer;
  transition: background-color 100ms var(--aff-ease);
}
.card-item:last-child { border-bottom: 0; }
.card-item:hover:not(:disabled),
.card-item[data-active="true"] { background: var(--aff-surface-muted); }
.card-item:disabled { color: var(--aff-ink-dim); cursor: default; }
.card-item svg { width: 14px; height: 14px; flex: none; color: var(--aff-accent); }
.card-item:focus-visible { outline: 2px solid var(--aff-accent); outline-offset: -2px; }
.card-item-quiet { color: var(--aff-ink-muted); font-weight: 400; }

.card-question {
  padding: 9px var(--aff-pad) 8px;
  border-bottom: 1px solid var(--aff-border-muted);
  font-size: var(--aff-text-xs);
  line-height: 1.4;
  color: var(--aff-ink-muted);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.card-note {
  padding: 9px var(--aff-pad);
  font-size: var(--aff-text-xs);
  line-height: 1.45;
  color: var(--aff-ink-muted);
  border-top: 1px solid var(--aff-border-muted);
}
.card-note-bad { color: var(--aff-danger); }

.card-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  margin: -2px -4px -2px 0;
  border: 0;
  border-radius: var(--aff-radius-sm);
  background: transparent;
  color: var(--aff-ink-dim);
  cursor: pointer;
  flex: none;
}
.card-close:hover { background: var(--aff-surface-muted); color: var(--aff-ink); }
.card-close svg { width: 13px; height: 13px; }
.card-close:focus-visible { outline: 2px solid var(--aff-accent); outline-offset: -2px; }

/* ── The inline suggestion ────────────────────────────────────────────────
   One row: who is speaking, what they propose, and the key that accepts it. */
.card-suggest { min-width: 0; }

.suggest { display: flex; align-items: stretch; }

.suggest-main {
  display: flex;
  flex: 1;
  min-width: 0;
  align-items: center;
  gap: 8px;
  padding: 6px 8px 6px 10px;
  border: 0;
  background: transparent;
  color: var(--aff-ink);
  font: inherit;
  font-size: var(--aff-text-sm);
  text-align: left;
  cursor: pointer;
  transition: background-color 100ms var(--aff-ease);
}
.suggest-main:hover { background: var(--aff-surface-muted); }
.suggest-main:focus-visible { outline: 2px solid var(--aff-accent); outline-offset: -2px; }
.suggest-main svg { width: 14px; height: 14px; flex: none; color: var(--aff-accent); }

.suggest-value {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  font-weight: 500;
}

/* The key cap, which is also the button: pressing Enter and clicking this do the same thing. */
.suggest-key {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  flex: none;
  height: 20px;
  padding: 0 5px;
  border: 1px solid var(--aff-border);
  border-radius: var(--aff-radius-sm);
  background: var(--aff-surface-muted);
  color: var(--aff-ink-muted);
  font-size: var(--aff-text-2xs);
  font-weight: 500;
  transition: border-color 100ms var(--aff-ease), color 100ms var(--aff-ease);
}
.suggest-main:hover .suggest-key { border-color: var(--aff-accent); color: var(--aff-accent); }
.suggest-key svg { width: 10px !important; height: 10px !important; color: currentColor !important; }

.suggest-close {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 28px;
  border: 0;
  border-left: 1px solid var(--aff-border-muted);
  background: transparent;
  color: var(--aff-ink-dim);
  cursor: pointer;
  transition: background-color 100ms var(--aff-ease), color 100ms var(--aff-ease);
}
.suggest-close:hover { background: var(--aff-surface-muted); color: var(--aff-ink); }
.suggest-close:focus-visible { outline: 2px solid var(--aff-accent); outline-offset: -2px; }
.suggest-close svg { width: 12px; height: 12px; }

/* ── The answer card ──────────────────────────────────────────────────────
   One card under the field: what was asked, what we wrote, and everything
   the person might want to do about it. Edits write through on a debounce,
   so the card and the field can never hold different text.               */
.card-answer { min-width: 300px; max-width: min(380px, calc(100vw - 24px)); }

.answer-head {
  display: flex;
  align-items: flex-start;
  gap: var(--aff-gap);
  padding: 10px var(--aff-pad) 9px;
  border-bottom: 1px solid var(--aff-border-muted);
}

/* Why the card is open. Accent for a guess; neutral for the person's own answer. */
.answer-why {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex: none;
  height: 20px;
  padding: 0 7px;
  border-radius: var(--aff-radius-full);
  background: var(--aff-accent-muted);
  color: var(--aff-accent);
  font-size: var(--aff-text-2xs);
  font-weight: 600;
  white-space: nowrap;
}
.answer-why svg { width: 11px; height: 11px; }
.card-answer[data-reason="stated"] .answer-why {
  background: var(--aff-surface-muted);
  color: var(--aff-ink-muted);
}
.card-answer[data-reason="stated"] .answer-why svg { display: none; }

.answer-question {
  flex: 1;
  min-width: 0;
  padding-top: 2px;
  font-size: var(--aff-text-xs);
  line-height: 1.4;
  color: var(--aff-ink-muted);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.answer-body { padding: 10px var(--aff-pad) 0; }

.answer-text {
  width: 100%;
  min-height: 72px;
  max-height: 220px;
  padding: 8px 10px;
  border: 1px solid var(--aff-border);
  border-radius: var(--aff-radius-md);
  background: var(--aff-surface);
  color: var(--aff-ink);
  font: inherit;
  font-size: var(--aff-text-base);
  line-height: 1.5;
  resize: vertical;
}
.answer-text:focus-visible {
  outline: 0;
  border-color: var(--aff-accent);
  box-shadow: 0 0 0 3px var(--aff-accent-muted);
}

/* Rewriting: the text stays readable, just dimmed. A spinner over it would hide the one thing
   the person is trying to judge. */
.answer-text[aria-busy="true"] { color: var(--aff-ink-dim); }

.answer-options {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  max-height: 200px;
  overflow-y: auto;
}

.answer-option {
  min-height: var(--aff-tap);
  padding: 4px 11px;
  border: 1px solid var(--aff-border);
  border-radius: var(--aff-radius-md);
  background: var(--aff-surface-raised);
  color: var(--aff-ink-muted);
  font: inherit;
  font-size: var(--aff-text-sm);
  cursor: pointer;
  transition: border-color 100ms var(--aff-ease), color 100ms var(--aff-ease), background-color 100ms var(--aff-ease);
}
.answer-option:hover { border-color: var(--aff-ink-dim); color: var(--aff-ink); }
.answer-option[aria-checked="true"] {
  border-color: var(--aff-accent);
  background: var(--aff-accent-muted);
  color: var(--aff-ink);
  font-weight: 500;
}
.answer-option:focus-visible { outline: 2px solid var(--aff-accent); outline-offset: 2px; }

.answer-filter {
  width: 100%;
  min-height: var(--aff-tap);
  margin-bottom: 8px;
  padding: 4px 10px;
  border: 1px solid var(--aff-border);
  border-radius: var(--aff-radius-md);
  background: var(--aff-surface);
  color: var(--aff-ink);
  font: inherit;
  font-size: var(--aff-text-sm);
}
.answer-filter:focus-visible { outline: 0; border-color: var(--aff-accent); }

/* The rewrite controls, fenced off from the answer above them. */
.answer-nudge {
  margin-top: 10px;
  padding: 10px var(--aff-pad) 0;
  border-top: 1px solid var(--aff-border-muted);
}

/* Two columns: the label, then the chips. */
.answer-chips { display: flex; align-items: flex-start; gap: 6px; margin-bottom: 6px; }
.answer-chip-set { display: flex; flex-wrap: wrap; gap: 4px; min-width: 0; }

.answer-chips-label {
  flex: none;
  width: 44px;
  padding-top: 6px;
  color: var(--aff-ink-dim);
  font-size: var(--aff-text-2xs);
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.answer-chip {
  height: 24px;
  padding: 0 9px;
  white-space: nowrap;
  border: 1px solid var(--aff-border);
  border-radius: var(--aff-radius-full);
  background: transparent;
  color: var(--aff-ink-muted);
  font: inherit;
  font-size: var(--aff-text-xs);
  cursor: pointer;
  transition: border-color 100ms var(--aff-ease), color 100ms var(--aff-ease), background-color 100ms var(--aff-ease);
}
.answer-chip:hover:not(:disabled) { border-color: var(--aff-ink-dim); color: var(--aff-ink); }
.answer-chip:disabled { opacity: 0.5; cursor: default; }
/* The last instruction used on this field, so a second nudge is one keystroke. */
.answer-chip[data-last="true"] {
  border-color: var(--aff-accent);
  background: var(--aff-accent-muted);
  color: var(--aff-ink);
}
.answer-chip:focus-visible { outline: 2px solid var(--aff-accent); outline-offset: 2px; }

/* Bottom-aligned, so the send button stays beside the last line as the box grows. */
.answer-ask { display: flex; align-items: flex-end; gap: 6px; margin-top: 4px; }

.answer-ask-input {
  flex: 1;
  min-width: 0;
  min-height: var(--aff-tap);
  padding: 6px 10px;
  border: 1px solid var(--aff-border);
  border-radius: var(--aff-radius-md);
  background: var(--aff-surface);
  color: var(--aff-ink);
  font: inherit;
  font-size: var(--aff-text-sm);
  line-height: 1.4;
  resize: none;
  overflow-y: auto;
}
.answer-ask-input::placeholder { color: var(--aff-ink-dim); }
.answer-ask-input:focus-visible {
  outline: 0;
  border-color: var(--aff-accent);
  box-shadow: 0 0 0 3px var(--aff-accent-muted);
}

.answer-ask-go {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: var(--aff-tap);
  height: var(--aff-tap);
  border: 0;
  border-radius: var(--aff-radius-md);
  background: var(--aff-accent);
  color: #fff;
  cursor: pointer;
  transition: filter 100ms var(--aff-ease);
}
.answer-ask-go:hover { filter: brightness(1.08); }
.answer-ask-go svg { width: 14px; height: 14px; }
.answer-ask-go:disabled { opacity: 0.5; cursor: default; }
.answer-ask-go[data-stop="true"] { background: var(--aff-danger); }
.answer-ask-go:focus-visible { outline: 2px solid var(--aff-accent); outline-offset: 2px; }

.answer-note {
  padding: 8px var(--aff-pad) 0;
  font-size: var(--aff-text-xs);
  line-height: 1.4;
  color: var(--aff-ink-dim);
}
.answer-note:empty { display: none; }
.answer-note[data-bad="true"] { color: var(--aff-danger); }
.answer-note[data-good="true"] { color: var(--aff-positive); }

.answer-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px var(--aff-pad) var(--aff-pad);
}

.answer-keep,
.answer-undo,
.answer-clear {
  height: var(--aff-tap);
  padding: 0 12px;
  border: 1px solid transparent;
  border-radius: var(--aff-radius-md);
  background: transparent;
  color: var(--aff-ink-muted);
  font: inherit;
  font-size: var(--aff-text-sm);
  font-weight: 500;
  cursor: pointer;
  transition: background-color 100ms var(--aff-ease), color 100ms var(--aff-ease), filter 100ms var(--aff-ease);
}

/* Keep is the one thing to do here; Undo and Clear are exits. */
.answer-keep { background: var(--aff-accent); color: #fff; }
.answer-keep:hover { filter: brightness(1.08); }
.answer-undo:hover:not(:disabled) { background: var(--aff-surface-muted); color: var(--aff-ink); }
.answer-undo:disabled { opacity: 0.4; cursor: default; }
.answer-clear { margin-left: auto; color: var(--aff-danger); }
.answer-clear:hover { background: var(--aff-danger-muted); }
.answer-keep:focus-visible,
.answer-undo:focus-visible,
.answer-clear:focus-visible { outline: 2px solid var(--aff-accent); outline-offset: 2px; }

/* Scrolled away from its anchor but still usable. */
.card[data-adrift="true"] { border-top: 2px solid var(--aff-accent); }

/* ── Field marks ──────────────────────────────────────────────────────────
   What happened to a field, drawn over it rather than on it. A judged answer
   keeps a hairline ring and a tab; a stated fact settles and leaves the page
   alone, marked by nothing at all.                                         */
.mark {
  position: fixed;
  border-radius: var(--aff-radius-sm);
  pointer-events: none;
  box-shadow: 0 0 0 2px var(--mark-color, var(--aff-accent));
  opacity: 0;
  transition: opacity 200ms var(--aff-ease);
}

.mark[data-state="active"] { --mark-color: var(--aff-accent); opacity: 1; }

.mark[data-state="stated"],
.mark[data-state="failed"] {
  animation: mark-settle 1400ms var(--aff-ease) forwards;
}

.mark[data-state="stated"] { --mark-color: var(--aff-positive); }
.mark[data-state="failed"] { --mark-color: var(--aff-danger); }
.mark[data-state="judged"] {
  --mark-color: var(--aff-accent);
  box-shadow: 0 0 0 1.5px var(--mark-color);
  opacity: 0.9;
}

@keyframes mark-settle {
  0% { opacity: 1; }
  60% { opacity: 1; }
  100% { opacity: 0; }
}

/* A field a review row is pointing at. */
.mark[data-flash="true"] { animation: mark-flash 800ms var(--aff-ease); }

@keyframes mark-flash {
  0%, 100% { box-shadow: 0 0 0 2px var(--mark-color, var(--aff-accent)); }
  40% { box-shadow: 0 0 0 5px var(--mark-color, var(--aff-accent)); }
}

/* ── The provenance tab ───────────────────────────────────────────────────
   A small raised chip beside the field: a sparkle, what is true about the
   answer ("I guessed" / "not sure"), and a tick and a cross. The flat edge
   faces the field. Placement is placeTab in markers.ts; nothing here may set
   top/left, and the height is TAB_HEIGHT.                                  */
.answer-tab {
  position: fixed;
  display: inline-flex;
  align-items: center;
  gap: 2px;
  height: 24px;
  padding: 0 3px 0 7px;
  border: 1px solid var(--aff-border);
  background: var(--aff-surface-raised);
  color: var(--aff-ink);
  font-family: inherit;
  font-size: var(--aff-text-2xs);
  font-weight: 600;
  line-height: 1;
  white-space: nowrap;
  pointer-events: auto;
  box-shadow: 0 2px 6px -2px var(--aff-shadow-strong);
  animation: tab-in 160ms var(--aff-spring) both;
}

.answer-tab-open {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 100%;
  padding: 0 4px 0 0;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  cursor: pointer;
}
.answer-tab-open svg { width: 11px; height: 11px; flex: none; color: var(--aff-accent); }
.answer-tab-open:hover { color: var(--aff-accent); }
.answer-tab-open:focus-visible { outline: 2px solid var(--aff-accent); outline-offset: -2px; }

/* Verdict in one tap. 18px, under the tap floor on purpose: this control is pinned to the
   edge of a form field and a taller one would cover the question it is labelling. */
.answer-tab-act {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: 18px;
  height: 18px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  cursor: pointer;
  transition: background-color 100ms var(--aff-ease);
}
.answer-tab-act svg { width: 11px; height: 11px; }
.answer-tab-act:focus-visible { outline: 2px solid var(--aff-accent); outline-offset: 1px; }
.answer-tab-yes { color: var(--aff-positive); }
.answer-tab-yes:hover { background: var(--aff-positive-muted); }
.answer-tab-no { color: var(--aff-danger); }
.answer-tab-no:hover { background: var(--aff-danger-muted); }

.answer-tab[data-place="above"] { border-radius: 6px 6px 2px 2px; }
.answer-tab[data-place="below"],
.answer-tab[data-place="pinned"] { border-radius: 2px 2px 6px 6px; }
.answer-tab[data-place="beside"] { border-radius: 2px 6px 6px 2px; }

/* scale only — never translate, which is this element's placement. See host.test.ts. */
@keyframes tab-in {
  from { opacity: 0; scale: 0.92; }
  to { opacity: 1; scale: 1; }
}

/* ── The learning chip ────────────────────────────────────────────────────
   "I'm keeping that", under the field, at the moment it happens. Transient
   and non-interactive: no buttons, no focus, leaves on its own.           */
.learn-chip {
  position: fixed;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  max-width: 320px;
  height: 24px;
  padding: 0 9px;
  border: 1px solid var(--aff-border);
  border-radius: var(--aff-radius-full);
  background: var(--aff-surface-raised);
  color: var(--aff-ink-muted);
  font-size: var(--aff-text-xs);
  font-weight: 500;
  line-height: 1;
  white-space: nowrap;
  pointer-events: none;
  box-shadow: 0 2px 8px -3px var(--aff-shadow-strong);
  opacity: 1;
  animation: chip-in 200ms var(--aff-spring) both;
  /* Never translate: it is this element's placement. See host.test.ts. */
  transition: opacity 240ms var(--aff-ease), scale 240ms var(--aff-ease);
}
.learn-chip svg { width: 12px; height: 12px; flex: none; }
.learn-chip span { overflow: hidden; text-overflow: ellipsis; }
.learn-chip[data-state="learning"] svg { color: var(--aff-accent); }
.learn-chip[data-state="learning"] {
  animation: chip-in 200ms var(--aff-spring) both, chip-breathe 1.6s ease-in-out 200ms infinite;
}
.learn-chip[data-state="learned"] {
  border-color: var(--aff-accent);
  background: var(--aff-accent);
  color: #fff;
}
.learn-chip[data-state="known"] svg { color: var(--aff-positive); }
.learn-chip[data-state="failed"] { color: var(--aff-danger); }
.learn-chip[data-leaving="true"] { opacity: 0; scale: 0.96; }

@keyframes chip-in {
  from { opacity: 0; scale: 0.94; }
  to { opacity: 1; scale: 1; }
}

@keyframes chip-breathe {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

@keyframes pop-in {
  from { opacity: 0; scale: 0.96; }
  to { opacity: 1; scale: 1; }
}

@media (prefers-reduced-motion: reduce) {
  .launcher-wrap, .launcher-icon, .launcher--loading::after, .launcher-rail-dot, .card, .mark,
  .answer-tab, .field-trigger, .field-trigger::after, .learn-chip {
    animation: none !important;
  }
  .launcher-extras, .launcher-extras-inner, .learn-chip, .launcher-wrap::after {
    transition: none !important;
  }
  .mark[data-state="stated"],
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

/** Whether focus is inside the overlay host — a closed root reports itself, not its children. */
export function isOverlayHost(node: unknown): boolean {
  return node instanceof HTMLElement && node.id === HOST_ID
}

/** Inline SVG, matching the panel's authored set: 16px grid, 1.75px stroke, round joins. */
export const GLYPH = {
  /* The logo. The launcher and the field trigger wear this; the sparkle below stays
     reserved for "I guessed this answer", so the two never blur together. */
  mascot:
    '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="8" cy="8" r="6.25"/><circle cx="5.9" cy="6.7" r="1" fill="currentColor" stroke="none"/><circle cx="10.1" cy="6.7" r="1" fill="currentColor" stroke="none"/><path d="M5.6 9.7c1.6 1.8 3.2 1.8 4.8 0"/></svg>',
  sparkle:
    '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linejoin="round" aria-hidden="true"><path d="M8 2 9.3 6.7 14 8 9.3 9.3 8 14 6.7 9.3 2 8 6.7 6.7Z"/></svg>',
  pen: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m2.5 13.5.75-3 8-8 2.25 2.25-8 8z"/><path d="m9.75 4.25 2.25 2.25"/></svg>',
  check:
    '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 8.5 6.5 12 13 4.5"/></svg>',
  form: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 2h5.5l3.5 3.5v8.5H3.5z"/><path d="M9 2v3.5h3.5M5.5 8.5h5M5.5 11h3"/></svg>',
  panel:
    '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 2.75h12v10.5H2z"/><path d="M10 2.75v10.5"/></svg>',
  mute: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="8" cy="8" r="6"/><path d="m4 12 8-8"/></svg>',
  close:
    '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8"/></svg>',
  /* The face, mouth closed.

     The suggestion card wore a tick, which is the wrong word: a tick says "this is correct",
     and the card is *offering* a value the user has not looked at yet. The mascot says who is
     speaking instead. It is deliberately the straight-mouthed one — the smile belongs to a
     finished fill, and a face grinning at you before you have read the answer is the interface
     being pleased with itself. */
  face: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="8" cy="8" r="6.25"/><circle cx="5.9" cy="6.9" r="1" fill="currentColor" stroke="none"/><circle cx="10.1" cy="6.9" r="1" fill="currentColor" stroke="none"/><path d="M5.9 10.4h4.2"/></svg>',
  /* The return arrow, for the keyboard hint. */
  enter:
    '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13 3.5v4A2 2 0 0 1 11 9.5H3.5"/><path d="M6 7 3.5 9.5 6 12"/></svg>',
} as const
