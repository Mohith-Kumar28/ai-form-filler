# Design system — laboratory notebook

Recorded from the built side panel, not from intentions. Seed key `b24f3290`.

## The world

A laboratory notebook. Entries are dated, numbered, and carry their provenance; observation
and inference are recorded distinctly; nothing is erased. That convention is not decoration
here — it is the product's trust model, because the one thing this UI must make unmissable is
which answers the user **stated** versus which the tool **concluded**.

Refused: the card grid over a near-black ground with a violet accent and glow, which is what
every AI panel ships and what this project shipped before. Also refused: its predictable
opposite, the white minimal app shell.

## Ground and light

The panel sits beside someone else's website, often late, during a job hunt. Both schemes are
real, neither is a default. Light is a cool bench-lit page — deliberately **not** cream, which
is the paper-adjacent rut. Dark is slate ink.

| Token | Light | Dark | Use |
|---|---|---|---|
| `ground` | `oklch(97.5% .004 230)` | `oklch(20% .018 250)` | scroll region |
| `page` | `oklch(99.5% .002 230)` | `oklch(23.5% .02 250)` | header, nav, footer bands |
| `rule` | `oklch(89% .012 230)` | `oklch(33% .022 250)` | every hairline separator |
| `quad` | `oklch(93.5% .016 220)` | `oklch(28% .02 235)` | the 16px quadrille |
| `ink` | `oklch(26% .022 250)` | `oklch(93% .01 250)` | primary text |
| `graphite` | `oklch(48% .016 250)` | `oklch(72% .014 250)` | secondary text |
| `faint` | `oklch(64% .014 250)` | `oklch(56% .014 250)` | labels, measures |

Three semantic colors, each with exactly one job. Using them for anything else breaks the
system's one promise.

| Token | Meaning | Never used for |
|---|---|---|
| `pen` — ink blue | action, focus, current state | status |
| `annot` — correction red | **inference**, and errors | decoration, generic warning |
| `verified` — green | recorded as stated | success toasts |

## Structure

**The quadrille is the armature, not a texture.** 16px grid; every vertical rhythm is a
multiple of it, so ruled content lands on the grid. Applied to the scroll region so it moves
with the content, the way ruling on paper does.

**Ruled entries, never cards.** Content is separated by `border-b border-rule` hairlines. There
are no rounded containers, no elevation, no nested boxes. `--radius-sharp: 2px` is the only
radius, used on controls only.

**Entry numbers carry information.** Sources are numbered by order of record — `01` is the
first thing ever added. This is the one case where numbering is not ornament.

**Measurements are mono.** `.measure` (tabular-nums) for counts, quotas, char counts, timings,
costs. Prose is never mono; mono is never a costume for "technical".

## Typography

System sans for prose, system mono for measured quantities. Operate mode at 400px is well
served by a system stack, and an extension avoids a webfont for CSP and load reasons.
13px base, 11–12px for secondary, 15–17px for the few headings.

## Motion

One authored moment, not scattered effects: `entry-in` settles rows onto the page in
sequence, the way lines get written, staggered 25ms and capped at 8 items. `rule-draw` draws
the completion rule under a finished fill. Both `cubic-bezier(0.2, 0, 0, 1)`, both fully
disabled under `prefers-reduced-motion`.

## Iconography

Authored SVG on a 16px grid, single 1.5px stroke, in `sidepanel/icons.tsx`. Matched to the
page's hairline rules on purpose — a 2px library icon beside a 1px rule reads as two systems.
No emoji, no unicode glyphs.

## The page overlay

The content-script overlay inherits this world: `pen` for active, `verified` for filled,
`annot` for a judgement call or low confidence, neutral grey for failed. 2px radius, closed
Shadow DOM, styles inlined against site CSP.

## Open

- Not yet reviewed against screenshots of the real panel — it requires a signed-in browser
  session, so the finish review is outstanding rather than passed.
- The `summary` and `preferences` blocks on the Details tab have only been seen with one
  real profile; long preference lists at 400px are untested.
