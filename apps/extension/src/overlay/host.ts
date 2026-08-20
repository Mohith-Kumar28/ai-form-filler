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
   Three shapes: a circle icon with a field-count badge below it when idle; an
   expanded pill with progress text and a red stop button while filling; and a
   brief pulse while thinking. A dots grabber appears on hover to drag it.     */
.launcher-wrap {
  position: fixed;
  display: flex;
  align-items: center;
  gap: 6px;
}

.launcher-body {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.launcher {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 34px;
  height: 34px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--aff-sparkle), var(--aff-accent));
  color: #fff;
  cursor: pointer;
  pointer-events: auto;
  user-select: none;
  box-shadow: 0 6px 18px -6px var(--aff-shadow-strong);
  transition: scale 140ms var(--aff-spring);
  animation: pop-in 200ms var(--aff-spring) both;
}
.launcher:active { scale: 0.97; }
.launcher-icon { display: flex; flex: none; }
.launcher-icon svg { width: 16px; height: 16px; }
.launcher-progress {
  display: none;
  font-size: 12px;
  font-weight: 700;
  line-height: 1;
  white-space: nowrap;
}

/* The field-count badge under the icon, idle only. */
.launcher-count {
  position: absolute;
  top: calc(100% + 4px);
  left: 50%;
  translate: -50% 0;
  padding: 1px 7px;
  border-radius: 999px;
  background: var(--aff-surface-raised);
  color: var(--aff-ink-dim);
  font-size: 11px;
  font-weight: 600;
  line-height: 1.6;
  white-space: nowrap;
  pointer-events: none;
  box-shadow: 0 1px 4px -1px var(--aff-shadow);
}

.launcher-count[data-exhausted="true"] {
  background: linear-gradient(135deg, var(--aff-sparkle), var(--aff-accent));
  color: #fff;
  font-weight: 700;
}

/* The stop button, filling only. Placed below the pill so it stays on screen. */
.launcher-stop {
  position: absolute;
  top: calc(100% + 10px);
  left: 50%;
  translate: -50% 0;
  display: none;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: 0;
  border-radius: 50%;
  background: var(--aff-danger);
  color: #fff;
  cursor: pointer;
  pointer-events: auto;
  box-shadow: 0 2px 8px -2px var(--aff-shadow);
  animation: pop-in 160ms var(--aff-ease) both;
}
.launcher-stop svg { width: 12px; height: 12px; }

/* ── Filling state ──────────────────────────────────────────────────────── */
.launcher-wrap[data-filling="true"] .launcher {
  width: auto;
  padding: 0 13px;
  border-radius: 999px;
}
.launcher-wrap[data-filling="true"] .launcher-progress { display: inline; }
.launcher-wrap[data-filling="true"] .launcher-count { display: none; }
.launcher-wrap[data-filling="true"] .launcher-stop { display: flex; }

/* Thinking pulse, while the pill is not yet showing progress. */
.launcher--loading {
  animation: launcher-think 1.2s ease-in-out infinite;
}

@keyframes launcher-think {
  0%, 100% { scale: 1; }
  50% { scale: 1.14; }
}

/* The drag handle — a little column of dots that appears only on hover. It stays in the flow
   so the wrap's own box includes it, and the hover area extends left for free. */
.launcher-grab {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  padding: 9px 5px;
  border: 0;
  border-radius: 999px;
  background: var(--aff-surface-raised);
  cursor: grab;
  pointer-events: none;
  opacity: 0;
  box-shadow: 0 2px 8px -2px var(--aff-shadow);
  transition: opacity 140ms var(--aff-ease);
}
.launcher-wrap:hover .launcher-grab {
  opacity: 1;
  pointer-events: auto;
}
.launcher-grab:active { cursor: grabbing; }
.launcher-grab span {
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: var(--aff-ink-dim);
}

/* ── The field trigger ─────────────────────────────────────────────────────
   A small sparkle icon beside a focused field. Clicking it opens the field's
   action menu: fill this one, write it with AI, or fill the whole form.      */
.field-trigger {
  position: fixed;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border: 0;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--aff-sparkle), var(--aff-accent));
  color: #fff;
  cursor: pointer;
  pointer-events: auto;
  box-shadow: 0 2px 8px -2px var(--aff-shadow-strong);
  animation: pop-in 160ms var(--aff-ease) both;
}
.field-trigger svg { width: 12px; height: 12px; }
.field-trigger:focus-visible { outline: 2px solid var(--aff-accent); outline-offset: 2px; }

/* Rewrite, not fill. The gradient means "the AI will write something here", and a field that
   already has an answer is not that — so this one recedes to a bordered surface and carries a
   pen. Same size and position, so it never reads as a different control appearing. */
.field-trigger[data-mode="review"] {
  background: var(--aff-surface);
  border: 1px solid var(--aff-border);
  color: var(--aff-ink-dim);
  box-shadow: 0 1px 4px -1px var(--aff-shadow);
}
.field-trigger[data-mode="review"]:hover {
  border-color: var(--aff-accent);
  color: var(--aff-accent);
}

/* Clicked: the icon pulses and glows while the AI thinks in the background, and stays put until
   the field is written — a clear "working on it" instead of an instant vanish. */
.field-trigger[data-loading="true"] {
  animation: trigger-think 1.1s ease-in-out infinite;
  pointer-events: none;
}
.field-trigger[data-loading="true"]::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 50%;
  animation: trigger-halo 1.1s ease-out infinite;
}

@keyframes trigger-think {
  0%, 100% { scale: 1; }
  50% { scale: 1.15; }
}

@keyframes trigger-halo {
  0% { box-shadow: 0 0 0 0 var(--aff-accent); opacity: 0.55; }
  100% { box-shadow: 0 0 0 12px var(--aff-accent); opacity: 0; }
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

.card-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: var(--aff-ink-dim);
  cursor: pointer;
  flex: none;
}
.card-close:hover { background: var(--aff-surface-muted); color: var(--aff-ink); }
.card-close svg { width: 12px; height: 12px; }

.card-body { padding: 10px 13px; }

/* ── The answer card ──────────────────────────────────────────────────────
   One card under the field: what was asked, what we wrote, and everything the
   person might want to do about it. There is no "save to the page" button —
   edits write through on a debounce, so the card and the field can never hold
   different text. Opens only when the tab is pressed.                       */
.card-answer { min-width: 280px; max-width: min(380px, calc(100vw - 24px)); }

.answer-head {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 10px 12px 8px;
  border-bottom: 1px solid var(--aff-border-muted);
}

.answer-why {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex: none;
  padding: 2px 7px;
  border-radius: var(--aff-radius-full);
  background: var(--aff-accent-muted);
  color: var(--aff-accent);
  font-size: 10px;
  font-weight: 700;
  white-space: nowrap;
}
.answer-why svg { width: 10px; height: 10px; }

.answer-question {
  flex: 1;
  min-width: 0;
  font-size: 12px;
  line-height: 1.35;
  color: var(--aff-ink-muted);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.answer-body { padding: 10px 12px 0; }

.answer-text {
  width: 100%;
  min-height: 62px;
  max-height: 200px;
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
.answer-text:focus-visible { outline: 2px solid var(--aff-accent); outline-offset: -1px; }

/* Rewriting: the text stays readable. A spinner over the answer hides the one thing the person
   is trying to judge, and this call takes seconds. */
.answer-text[aria-busy="true"] {
  border-left: 1.5px solid var(--aff-accent);
  color: var(--aff-ink-muted);
}

.answer-options {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  max-height: 168px;
  overflow-y: auto;
}

.answer-option {
  padding: 4px 9px;
  border: 1px solid var(--aff-border-muted);
  border-radius: var(--aff-radius-full);
  background: transparent;
  color: var(--aff-ink-muted);
  font: inherit;
  font-size: 12.5px;
  cursor: pointer;
  transition: border-color 120ms var(--aff-ease), color 120ms var(--aff-ease);
}
.answer-option:hover { border-color: var(--aff-border); color: var(--aff-ink); }
.answer-option[aria-checked="true"] {
  border-color: transparent;
  background: var(--aff-accent);
  color: #fff;
}
.answer-option:focus-visible { outline: 2px solid var(--aff-accent); outline-offset: 2px; }

.answer-filter {
  width: 100%;
  margin-bottom: 6px;
  padding: 5px 9px;
  border: 1px solid var(--aff-border);
  border-radius: var(--aff-radius-full);
  background: var(--aff-surface);
  color: var(--aff-ink);
  font: inherit;
  font-size: 12.5px;
}

.answer-nudge { padding: 8px 12px 0; }

.answer-chips { display: flex; flex-wrap: wrap; gap: 5px; margin-bottom: 6px; }

.answer-chip {
  padding: 3px 9px;
  border: 1px solid var(--aff-border);
  border-radius: var(--aff-radius-full);
  background: transparent;
  color: var(--aff-ink-muted);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
  transition: border-color 120ms var(--aff-ease), color 120ms var(--aff-ease);
}
.answer-chip:hover:not(:disabled) { border-color: var(--aff-accent); color: var(--aff-ink); }
.answer-chip:disabled { opacity: 0.5; cursor: default; }
/* The last instruction used on this field, so a second nudge is one keystroke. */
.answer-chip[data-last="true"] { border-color: var(--aff-accent); color: var(--aff-ink); }
.answer-chip:focus-visible { outline: 2px solid var(--aff-accent); outline-offset: 2px; }

.answer-ask { display: flex; align-items: center; gap: 6px; }

.answer-ask-input {
  flex: 1;
  min-width: 0;
  padding: 5px 10px;
  border: 1px solid var(--aff-border);
  border-radius: var(--aff-radius-full);
  background: var(--aff-surface);
  color: var(--aff-ink);
  font: inherit;
  font-size: 12.5px;
}
.answer-ask-input::placeholder { color: var(--aff-ink-dim); }
.answer-ask-input:focus-visible { outline: 2px solid var(--aff-accent); outline-offset: -1px; }

/* Same treatment as .field-trigger, so "make the AI do something" has one look on the page. */
.answer-ask-go {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: 22px;
  height: 22px;
  border: 0;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--aff-sparkle), var(--aff-accent));
  color: #fff;
  cursor: pointer;
}
.answer-ask-go svg { width: 12px; height: 12px; }
.answer-ask-go:disabled { opacity: 0.5; cursor: default; }
.answer-ask-go[data-stop="true"] { background: var(--aff-danger); }
.answer-ask-go:focus-visible { outline: 2px solid var(--aff-accent); outline-offset: 2px; }

.answer-note {
  padding: 8px 12px 0;
  font-size: 12px;
  line-height: 1.4;
  color: var(--aff-ink-dim);
  min-height: 0;
}
.answer-note:empty { display: none; }
.answer-note[data-bad="true"] { color: var(--aff-danger); }
.answer-note[data-good="true"] { color: var(--aff-positive); }

.answer-actions { display: flex; align-items: center; gap: 6px; padding: 10px 12px 12px; }

.answer-keep,
.answer-undo,
.answer-clear {
  padding: 6px 12px;
  border: 1px solid var(--aff-border);
  border-radius: var(--aff-radius-full);
  background: transparent;
  color: var(--aff-ink);
  font: inherit;
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
  transition: border-color 120ms var(--aff-ease), opacity 120ms var(--aff-ease);
}
.answer-keep {
  background: linear-gradient(135deg, var(--aff-sparkle), var(--aff-accent));
  border-color: transparent;
  color: #fff;
}
.answer-keep:hover { opacity: 0.9; }
.answer-undo { color: var(--aff-ink-muted); border-color: transparent; }
.answer-undo:disabled { opacity: 0.4; cursor: default; }
.answer-clear { margin-left: auto; color: var(--aff-danger); border-color: transparent; }
.answer-clear:hover { border-color: var(--aff-danger); }
.answer-keep:focus-visible,
.answer-undo:focus-visible,
.answer-clear:focus-visible { outline: 2px solid var(--aff-accent); outline-offset: 2px; }

/* Scrolled away from its anchor but still usable — closing a card somebody is mid-sentence in
   is worse than letting it detach visibly. */
.card[data-adrift="true"] { border-top: 1px solid var(--aff-accent); }

/* ── Field marks ──────────────────────────────────────────────────────────
   What happened to a field, drawn over it rather than on it. A judged answer
   keeps a hairline ring and gains a provenance tab above its top border; a
   stated fact settles and leaves the page alone, marked by nothing at all.  */
.mark {
  position: fixed;
  border-radius: var(--aff-radius-sm);
  pointer-events: none;
  box-shadow: 0 0 0 2.5px var(--mark-color, var(--aff-accent));
  opacity: 0;
  transition: opacity 220ms var(--aff-ease);
}

.mark[data-state="active"] { --mark-color: var(--aff-accent); opacity: 1; }

.mark[data-state="stated"],
.mark[data-state="failed"] {
  animation: mark-settle 1500ms var(--aff-ease) forwards;
}

.mark[data-state="stated"] { --mark-color: var(--aff-positive); }
.mark[data-state="failed"] { --mark-color: var(--aff-danger); }
/* A judged answer keeps a hairline rather than the full ring: the tab is the notation, and a
   2.5px ring plus a solid pill was two loud things saying one thing. */
.mark[data-state="judged"] {
  --mark-color: var(--aff-accent);
  box-shadow: 0 0 0 1.5px var(--mark-color);
  opacity: 1;
}

@keyframes mark-settle {
  0% { opacity: 1; }
  60% { opacity: 1; }
  100% { opacity: 0; }
}

/* ── The provenance tab ───────────────────────────────────────────────────
   Sits fully ABOVE the field's top border, never over its text. The flat edge
   always faces the field, which is what makes 18px of accent read as a tab on
   something rather than a badge floating near it. Placement is placeTab in
   markers.ts; nothing here may set top/left.                                 */
.answer-tab {
  position: fixed;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 18px;
  padding: 0 7px;
  border: 0;
  background: var(--aff-accent);
  color: #fff;
  font-family: inherit;
  font-size: 10.5px;
  font-weight: 700;
  line-height: 1;
  white-space: nowrap;
  cursor: pointer;
  pointer-events: auto;
  box-shadow: 0 1px 4px -1px var(--aff-shadow);
  animation: tab-in 200ms var(--aff-spring) both;
}

/* The flat edge always faces the field, which is what makes 18px of accent read as a tab on
   something rather than a badge floating near it. */
.answer-tab[data-place="above"] { border-radius: 6px 6px 2px 2px; }
.answer-tab[data-place="below"],
.answer-tab[data-place="pinned"] { border-radius: 2px 2px 6px 6px; }
.answer-tab[data-place="beside"] { border-radius: 2px 6px 6px 2px; }

.answer-tab svg { width: 10px; height: 10px; flex: none; }
.answer-tab:hover { background: color-mix(in oklab, var(--aff-accent) 88%, black); }
.answer-tab:focus-visible { outline: 2px solid var(--aff-accent); outline-offset: 2px; }

/* scale only — never translate, which is this element's placement, and never the
   transform shorthand. See the note in host.test.ts. */
@keyframes tab-in {
  from { opacity: 0; scale: 0.9; }
  to { opacity: 1; scale: 1; }
}

/* ── The learning chip ────────────────────────────────────────────────────
   "I'm keeping that", under the field, at the moment it happens. The receipt
   for the one interaction the product is built around — see learning.ts. It
   is transient and non-interactive: no buttons, no focus, leaves on its own. */
.learn-chip {
  position: fixed;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  max-width: 320px;
  padding: 3px 9px;
  border-radius: var(--aff-radius-full);
  background: var(--aff-surface);
  color: var(--aff-ink-dim);
  font-size: 11.5px;
  font-weight: 600;
  line-height: 1.5;
  white-space: nowrap;
  pointer-events: none;
  box-shadow: 0 2px 10px -3px var(--aff-shadow-strong);
  opacity: 1;
  animation: chip-in 220ms var(--aff-spring) both;
  /* Never the translate property, and never the transform shorthand: translate is this
     element's placement, written inline on every scroll frame. Transitioning it would make the
     chip lag a scrolling field, and animating it in a keyframe would overwrite the placement
     outright. See the note in host.test.ts. */
  transition: opacity 260ms var(--aff-ease), scale 260ms var(--aff-ease);
}

.learn-chip svg { width: 11px; height: 11px; flex: none; }
.learn-chip span { overflow: hidden; text-overflow: ellipsis; }

/* Thinking. The sparkle breathes rather than spins: nothing is being waited *for* here — the
   answer is already on the page — so a spinner would overstate it. */
.learn-chip[data-state="learning"] {
  color: var(--aff-accent);
  animation: chip-in 220ms var(--aff-spring) both, chip-breathe 1.6s ease-in-out 220ms infinite;
}

/* Landed. The one state that earns the accent gradient, because something is now known that
   was not known a second ago. */
.learn-chip[data-state="learned"] {
  background: linear-gradient(135deg, var(--aff-sparkle), var(--aff-accent));
  color: #fff;
}

.learn-chip[data-state="known"] { color: var(--aff-positive); }
.learn-chip[data-state="failed"] { color: var(--aff-danger); }

/* Leaving. Shrinks slightly as it fades, which reads as "done" rather than "dismissed".
   A scale, not a nudge upwards: the upward nudge would have to be the translate property,
   which is the inline placement this element cannot touch. */
.learn-chip[data-leaving="true"] { opacity: 0; scale: 0.96; }

@keyframes chip-in {
  from { opacity: 0; scale: 0.94; }
  to { opacity: 1; scale: 1; }
}

@keyframes chip-breathe {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.62; }
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

@media (prefers-reduced-motion: reduce) {
  .launcher, .card, .mark, .answer-tab, .field-trigger, .learn-chip {
    animation: none !important;
  }
  .learn-chip { transition: none !important; }
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
} as const
