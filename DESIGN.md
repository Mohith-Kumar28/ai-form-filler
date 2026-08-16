---
name: Fillaform
description: A credential document that fills forms and says which answers it read and which it concluded.
colors:
  stock: "oklch(96.5% 0.009 168)"
  leaf: "oklch(99.2% 0.004 168)"
  guilloche: "oklch(87% 0.022 168)"
  guilloche-soft: "oklch(93% 0.014 168)"
  engine: "oklch(84% 0.026 168)"
  ink: "oklch(23% 0.035 178)"
  ink2: "oklch(38% 0.03 178)"
  ink3: "oklch(46% 0.024 178)"
  endorse: "oklch(48% 0.19 30)"
  endorse-wash: "oklch(94% 0.04 30)"
  alert: "oklch(47% 0.13 62)"
  alert-wash: "oklch(94% 0.045 70)"
  query: "oklch(45% 0.1 195)"
  query-wash: "oklch(94% 0.03 195)"
  shadow-near: "oklch(20% 0.03 190 / 0.14)"
  shadow-far: "oklch(20% 0.03 190 / 0.26)"
  stock-dark: "oklch(18% 0.022 190)"
  leaf-dark: "oklch(22.5% 0.026 190)"
  guilloche-dark: "oklch(34% 0.03 190)"
  guilloche-soft-dark: "oklch(27% 0.024 190)"
  engine-dark: "oklch(62% 0.055 190)"
  ink-dark: "oklch(95% 0.012 180)"
  ink2-dark: "oklch(76% 0.02 180)"
  ink3-dark: "oklch(64% 0.022 180)"
  endorse-dark: "oklch(72% 0.17 32)"
  endorse-wash-dark: "oklch(30% 0.07 32)"
  alert-dark: "oklch(79% 0.14 72)"
  alert-wash-dark: "oklch(30% 0.06 66)"
  query-dark: "oklch(74% 0.11 195)"
  query-wash-dark: "oklch(28% 0.05 195)"
  shadow-near-dark: "oklch(0% 0 0 / 0.4)"
  shadow-far-dark: "oklch(0% 0 0 / 0.6)"
typography:
  title:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "13.5px"
    fontWeight: 600
    lineHeight: 1.5
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.5
  prose:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "12.5px"
    fontWeight: 400
    lineHeight: 1.625
  caption:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "11.5px"
    fontWeight: 400
    lineHeight: 1.4
  label:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "10px"
    fontWeight: 600
    letterSpacing: "0.1em"
    fontVariation: "'wdth' 80"
  mrz:
    fontFamily: "Chivo Mono, ui-monospace, SF Mono, Menlo, monospace"
    fontSize: "11.5px"
    fontWeight: 400
    letterSpacing: "-0.01em"
    fontFeature: "tabular-nums"
  stamp:
    fontFamily: "Chivo Mono, ui-monospace, SF Mono, Menlo, monospace"
    fontSize: "9.5px"
    fontWeight: 600
    letterSpacing: "0.1em"
rounded:
  doc: "2px"
  seal: "9999px"
spacing:
  rhythm: "4px"
  row-x: "16px"
  row-y: "12px"
  control-x: "14px"
  control-y: "8px"
components:
  button-plate:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.stock}"
    rounded: "{rounded.doc}"
    padding: "8px 14px"
    typography: "{typography.body}"
  button-plate-disabled:
    backgroundColor: "transparent"
    textColor: "{colors.ink3}"
    rounded: "{rounded.doc}"
    padding: "8px 14px"
  button-struck:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.doc}"
    padding: "8px 14px"
  button-quiet:
    backgroundColor: "transparent"
    textColor: "{colors.ink2}"
    rounded: "{rounded.doc}"
    padding: "8px 14px"
  button-danger:
    backgroundColor: "transparent"
    textColor: "{colors.alert}"
    rounded: "{rounded.doc}"
    padding: "8px 14px"
  input:
    backgroundColor: "{colors.leaf}"
    textColor: "{colors.ink}"
    rounded: "{rounded.doc}"
    padding: "6px 10px"
    typography: "{typography.body}"
  row:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    padding: "12px 16px"
    typography: "{typography.body}"
  stamp-endorsed:
    backgroundColor: "{colors.endorse-wash}"
    textColor: "{colors.endorse}"
    rounded: "{rounded.doc}"
    padding: "2px 6px"
    typography: "{typography.stamp}"
  stamp-unsure:
    backgroundColor: "transparent"
    textColor: "{colors.query}"
    rounded: "{rounded.doc}"
    padding: "2px 6px"
    typography: "{typography.stamp}"
  seal:
    backgroundColor: "{colors.leaf}"
    textColor: "{colors.ink}"
    rounded: "{rounded.seal}"
    size: "18px"
---

# Design System: Fillaform

## Overview

**Creative North Star: "The Credential Document"**

A credential exists to vouch for a person to a stranger who has to decide whether to trust it. It does that with a grammar for degrees of certainty that is structural, not decorative: the printed fields are what the issuer read, and an endorsement is something applied afterwards, in a second ink, by a second hand. This product has exactly that problem — a stated fact and a judgement call must be told apart at a glance, at 400px, in both schemes — so the world is not a metaphor laid over the interface, it is the interface's actual mechanism.

The surface is dense, ruled and flat. Content is delimited by hairlines rather than boxed in cards; text sits on a safety-tint stock that is deliberately neither cream nor white; every vertical measure is a multiple of 4px, because a document is set on a ruled bed. Two registers of one typeface do the work of two families: Archivo at 80% width for tracked condensed caps on every field label, Archivo at normal width for prose, and Chivo Mono for quantities that must align. The dark scheme is not an inversion but a second physical scene — a passport page under a desk lamp with the room dark — which is why its hairlines and its engine-turned ground sit at different distances from the ground than the light scheme's do.

Two directions were refused by name in the direction contract and remain refused: the AI-panel card grid on near-black with a violet glow, and the white minimal app shell that is its predictable opposite. There is one accent, vermilion, and it has one meaning. There is no other ornament except the guilloche, which appears twice in the entire build.

**Key Characteristics:**
- Ruled registers, never cards; hairlines carry all structure.
- Sixteen tokens per scheme, both schemes authored, neither derived from the other.
- One accent (vermilion) with one meaning: inference. Faults speak amber, uncertainty speaks petrol.
- 2px radius on struck controls, full circle for seals, nothing in between.
- 4px vertical rhythm; 13px body on a 400px column.
- Authored 16px icons, one 1.5px stroke, butt caps and mitre joins, no library.

## Colors

A safety-tint document palette: a green-leaning stock and near-teal intaglio ink, cut by three semantic inks that never trade jobs. Values are normative in the frontmatter; every token exists in both a light and a dark authoring, and `tokens.ts` is the single authority both the panel's `@theme` block and the overlay's inlined variables are checked against.

### Primary
- **Endorsement Vermilion** (`endorse`): the stamp, and the product's one true accent. It marks an answer this tool concluded rather than read — the review screen's CONCLUDED stamp, the on-page endorsement tab, the persistent field mark. Nowhere else.
- **Stamp Wash** (`endorse-wash`): the stamp's ink bleeding into paper. Backgrounds behind a stamp only, never text.

### Secondary
- **Query Petrol** (`query`): the second ink. Three jobs that are one job — uncertainty (an UNSURE stamp with its confidence figure), focus (every focus ring on both surfaces, at 2px with 1px offset), and the field being written right now.
- **Query Wash** (`query-wash`): selection background, and the ground of low-confidence marks.
- **Shadow Near / Shadow Far** (`shadow-near`, `shadow-far`): the only elevation in the system,
  in two layers — the contact shadow and the cast one. Ink-hued in light, because a shadow
  belongs to the material that casts it; near-black and much heavier in dark, where a light
  shadow on a near-black ground separates nothing. Three surfaces float and no others: the
  overflow menu, the on-page slip, and the seal.

### Tertiary
- **Caution Amber** (`alert`): faults, refusals, and anything that destroys. Field errors, error notes, the danger button, the failed field mark. Deliberately not vermilion.
- **Caution Wash** (`alert-wash`): the danger button's hover ground.

### Neutral
- **Safety Stock** (`stock`): the scroll ground of every screen. The paper.
- **Leaf** (`leaf`): raised bands — header, footer, inputs, menus, sheets, the on-page slip.
- **Guilloche** (`guilloche`): every hairline that separates one group from the next, and the scrollbar thumb.
- **Guilloche Soft** (`guilloche-soft`): the quieter hairline, for rules *inside* a group, plus every hover ground on a row or menu item.
- **Engine** (`engine`): the engine-turned security ground and only that. It is a token of its own because a field of 0.65px curves and a 1px rule need different distances from the stock to read at the same weight; sharing them shipped a ground that was correct on pale stock and invisible on dark.
- **Intaglio Ink** (`ink`) / **Second Ink** (`ink2`) / **Measure Ink** (`ink3`): the three-step text ramp, plus `ink` as the plate a primary action is struck from and the scrim behind a confirm sheet. Every tier clears 4.5:1 on stock in both schemes; there is no decorative text colour.

### Named Rules

**The One Stamp Rule.** Vermilion means inference and nothing else. A failed upload, a refusal and a destructive action all speak in `alert`; uncertainty speaks in `query`. The moment an error borrows the stamp's ink, the one distinction this product exists to make becomes indistinguishable from "something broke".

**The Unmarked Fact Rule.** A stated answer gets no mark at all — no badge, no tint, no chip. The absence *is* the notation: the document's own ink is what a printed field looks like. Adding a "verified" mark to stated answers would flatten the very contrast the stamp creates.

**The Two Scenes Rule.** Dark is authored, not derived. Never generate the dark value by inverting or lightening a light one; both schemes are measured against their own ground, which is why `engine` sits 12 points from stock in light and 44 in dark.

## Typography

**Body Font:** Archivo variable (with ui-sans-serif, system-ui, sans-serif) — bundled, 90KB, weight 400–700, width 62–125%.
**Label Register:** the same Archivo at 80% width, 600 weight, uppercase, 0.1em tracking.
**Machine-Readable Zone:** Chivo Mono variable (with ui-monospace, SF Mono, Menlo) — Archivo's sibling from the same foundry, tabular figures.

**Character:** One family carrying two registers, the way a printed credential titles its fields in condensed tracked caps and sets its contents in normal width. The mono is not a costume for "technical"; it is the zone where quantities align.

### Hierarchy
- **Title** (600, 13.5px, -0.01em): screen headers and confirm-sheet headings. There is no display tier — the panel is 400px and never the main event.
- **Body** (400, 13px, 1.5): row titles, inputs, buttons, the document's default.
- **Prose** (400, 12.5px, 1.625): explanatory paragraphs, empty-state bodies, menu items. Held to `max-w-[30ch]` where it is centred.
- **Caption** (400, 11.5px): row details, hints, field errors, slip notes.
- **Label** (600, 10px, 0.1em, uppercase, width 80%): field labels and section titles, via `.doc-label`.
- **Stamp** (mono, 600, 9.5px, 0.1em, uppercase): the CONCLUDED / UNSURE stamps and the on-page tab. The smallest type in the build, and load-bearing.

### Named Rules

**The Two Registers Rule.** Condensed tracked caps title a field; they never set running prose. Prose never takes the width axis. Anything that is neither — a heading pretending to be a label, an all-caps sentence — is outside the system.

**The Measurement-Only Mono Rule.** Chivo Mono carries counts, quotas, confidence, sizes, timings and costs — quantities compared against each other. It is never a category label. The one sanctioned exception is the stamp text, where mono is doing the work of a struck impression, not of a category.

## Layout

A single 400px column of variable height, docked. Every screen is one leaf: a fixed 44px header (`h-11`), a scrolling body that owns all overflow, and an optional fixed footer. Nothing else scrolls; nothing floats.

The rhythm is 4px. Rows are 16px horizontal / 12px vertical padding with a 10px gap between icon, content and trailing element; footers are 16px / 12px; controls are 14px / 8px at medium and 10px / 4px at small. Content is grouped by `RowGroup` — a group carries a `guilloche` rule top and bottom and divides its children with `guilloche-soft` — so a list reads as a register with a rule under each entry, not as a stack of containers.

There are no breakpoints. The width is fixed by the Chrome side panel and the system does not pretend otherwise; the only responsive behaviour is vertical, and it is handled by growth (`AutoTextarea` sizes to its content so a 900-character answer is not read through a four-line window) and by truncation on single-line row titles.

Navigation is a seven-screen push/pop stack, not a router — home, filling, review, sources, addSource, sourceDetail, profile. Depth is the only spatial state. Welcome sits outside the stack as a first-run leaf, rendered in place of the whole app rather than pushed onto it.

### Named Rules

**The No-Card Rule.** A credential's contents are a ruled register. Content already delimited by the rule above it does not get a box, a shadow or a radius around it. If something needs separating, add a hairline.

## Elevation & Depth

The panel is flat. Depth is tonal and structural: `leaf` lifts a band off `stock`, a `guilloche` hairline separates, and that is the entire vocabulary for anything anchored in the layout. Shadows appear only on surfaces that genuinely leave the page — an overflow menu, and the on-page slip and seal, which float above a website we do not control and need to be told apart from it.

### Shadow Vocabulary
- **Menu lift** (`box-shadow: 0 6px 20px -6px var(--color-shadow-far), 0 1px 2px var(--color-shadow-near)`): the overflow menu only.
- **Slip lift** (`box-shadow: 0 8px 28px -8px var(--aff-shadow-far), 0 1px 3px var(--aff-shadow-near)`): the on-page endorsement slip.
- **Seal lift** (`box-shadow: 0 1px 4px var(--aff-shadow-near)`): the field seal, so an 18px circle survives any page background.
- **Mark ring** (`box-shadow: 0 0 0 2px <mark-color>`): not elevation — a field outline drawn as a spread shadow so it never affects layout or intercepts a click.

### Named Rules

**The Floating-Only Rule.** A shadow means "this is not part of the document underneath". Headers, footers, rows, inputs, buttons and sheets are flat forever. A confirm sheet earns separation with a 35% ink scrim and a top hairline, not a shadow.

## Shapes

Two radii and no scale between them. `2px` (`--radius-doc`) on everything struck — buttons, inputs, chips, stamps, menus, marks, skeleton bars. Full circle for seals: the field seal (18px), the portrait oval on Home (28px), the Welcome mark (36px). A credential has no rounded fields; the only curve on a document is a seal, and a seal is a full circle.

Borders are 1px and semantic: `ink` for a struck control that is available, `guilloche` for an input or a container edge, `endorse` or `query` or `alert` for a stamp in that register. The one deliberate double-line is the plate's inset keyline — a 1px rule at 3px inset in `stock/30` — which is what makes a primary action read as a struck plate rather than a filled rectangle, and it is repeated on the overlay's primary button at 2px inset so one plate reads across both surfaces. Both keylines are square: a rule set 2px or 3px inside a 2px corner is concentric at zero radius, so the inner line takes none.

The only ornament is the guilloche: three co-prime Lissajous rings (23, 19 and 29 lobes) at roughly a tenth of their radius, stroked at 0.65px, generated at runtime from the token colour. High lobe count and shallow amplitude are the point — the eye must see a ring first and the pattern second; at higher amplitude a rose curve renders as a daisy, and at 0.4px stroke it dissolves below a device pixel on the dark ground.

### Named Rules

**The Two-Grounds Rule.** The guilloche covers area in exactly two places in the shipped build: the first-run ground and the empty-state ground. Everywhere else it is flattened to a hairline. Used as wallpaper it becomes the gimmick this direction exists to avoid.

**The Cleared Centre Rule.** Where the guilloche sits behind copy, it is masked out under the copy (`radial-gradient(circle at 50% 45%, transparent 34%, black 76%)`), never concentrated there. A decorative ground that costs legibility has stopped being structure.

## Components

### Buttons
- **Shape:** barely-softened corners (2px), 1px border on every variant including the ones with no visible edge.
- **Plate (primary):** solid intaglio ink on stock text, with the inset keyline. Hover drops to 90% opacity; active presses down 1px.
- **Struck (default):** ink hairline frame, ink text, hover fills to 8% ink.
- **Quiet:** transparent frame, second-ink text, hover takes a `guilloche-soft` ground and darkens to full ink.
- **Danger:** alert hairline frame and alert text, hover fills `alert-wash`. Never the plate treatment; destruction is not a primary action.
- **Disabled:** a disabled plate stops being a plate. It drops to a transparent ground with a `guilloche` frame and `ink3` text, and its keyline goes transparent. Fading a solid ink field to 40% still leaves the heaviest block on screen, which in dark reads as a bar demanding to be pressed.
- **Focus:** 2px `query` outline at 1px offset, globally, on both surfaces.

### Inputs / Fields
- **Style:** `leaf` ground, `guilloche` hairline, 2px radius, 13px ink text, `ink3` placeholder.
- **Focus:** the border shifts to `query` and the global petrol outline appears.
- **Label:** always above the control in the label register, never inside it. A placeholder that vanishes on focus takes the question away exactly when the person is answering it.
- **Error:** the message sits below in `alert` at 11.5px, led by the 16px alert glyph and wired through `aria-describedby` with `role="alert"`.

### Cards / Containers
There are none. `RowGroup` is the container primitive: a `guilloche` rule above and below, `guilloche-soft` between children, no background, no radius, no shadow.

### Rows
A ruled register entry: optional 16px glyph in `ink3` (or `alert` when the row is destructive), a truncating 13px title with an optional 11.5px detail beneath, an optional mono measure on the right, and a disclosure chevron only when the row actually pushes a screen. Hover takes `guilloche-soft`. Rows settle in sequence with a 22ms stagger, capped by the caller at eight before a list starts to flicker.

### Navigation
A push/pop stack over the View Transitions API. Each screen carries `viewTransitionName: 'screen'`; `html[data-nav]` picks the direction, and screens slide as leaves of one document — forward enters from +12px and leaves to -8px, back mirrors it, both over 200ms. Never a cross-fade. Back is a 16px chevron in the header's left slot, present exactly when there is somewhere to go back to.

### Empty and loading states
Loading is unissued stock: the *shape* of the row that is coming, shimmered across `guilloche-soft` to `leaf` over 1.6s, never a spinner. Empty is a blank document leaf: the guilloche ground at 0.5 opacity, masked clear at the centre, with a 14px heading, a 30ch body and an action. Every empty state says what to do, not that there is nothing.

### The endorsement stamp (signature)
A 2px-radius outline in `endorse` on an `endorse-wash` ground, carrying the 16px stamp glyph and the word CONCLUDED in the 9.5px mono stamp register. It arrives with `endorse-in`: 320ms from -4° at 1.18 scale, settling at -1.5° and full size, because that is what pressing a stamp onto paper looks like. Its sibling is the UNSURE stamp — the same geometry in `query`, no wash, carrying the confidence figure. A stated answer carries neither.

### The field seal and marks (signature, on-page)
On someone else's page the identity is carried by three things and no typeface: an 18px circular seal anchored inside the focused field (ink border, leaf ground, no dock, no persistent launcher, and hover darkens but never expands); the slip, a `leaf` panel with a masthead, the question set as a field caption, and the same inset-keyline plate as the panel — one component in four shapes: a menu of what can be done to this field, a progress slip whose three stages (reading the page, generating, applying) resolve in place so it neither re-animates nor moves, a done slip that gives the page-initiated flow the ending it never had, and the review slip carrying the endorsement stamp; and the field marks, drawn as a 2px spread ring. Marks are the trust rule made visible: `printed` and `failed` settle and clear over 1.5s, while `endorsed` and `unsure` persist until the person acts on them. Auto-filled content that becomes indistinguishable from typed content is how a confident wrong answer gets submitted.

### Icons
Authored on a 16px grid, one 1.5px stroke, butt caps and mitre joins, `currentColor`, no fill, no library. The cap and join choice is the whole character: a rounded stroke reads as a UI icon library, a mitred one reads as engraving.

### Motion
One easing (`cubic-bezier(0.2, 0, 0, 1)`) and four durations: 120–160ms for hovers and the seal, 200ms for a screen leaf, 240–260ms for a row settling or a plate landing, 320ms for a stamp. Two loops carry work that is still running, and neither is a spinner: `impress` (1400ms) swells a mark and lets it settle on the beat of the work — it is the Filling screen's active indicator, and as `impress-dot` the progress slip's active stage — and `seal-sweep` (900ms linear) rotates a masked conic arc around the field seal for the stretch of a fill nobody can measure, where a determinate ring sits frozen at zero and reads as broken. Everything the overlay anchors to a field is positioned with the standalone `translate` property and animated with standalone `scale` and `rotate` — never the `transform` shorthand, because a keyframe with `fill-mode: both` holds its final value forever and outranks the inline placement, which parks every seal and stamp at the top-left of the page. `host.test.ts` enforces this.

Reduced motion removes every animation on both surfaces — `strike`, `endorse-in`, `settle`, `awaiting`, `impress`, the seal sweep and the progress dot, including — with the project's single `!important` — the browser's own default view-transition cross-fade. Marks that must persist still persist; the request is about movement, not information.

## Do's and Don'ts

### Do:
- **Do** add new colours to `src/lib/tokens.ts` and nowhere else. `tokens.test.ts` fails the build if `tailwind.css` diverges, and the overlay reads the same module.
- **Do** author both schemes by eye against their own ground. Sixteen tokens, two real palettes.
- **Do** reserve vermilion for inference, amber for faults and destruction, petrol for uncertainty and focus.
- **Do** leave a stated answer unmarked.
- **Do** set every vertical measure on the 4px rhythm and separate content with hairlines.
- **Do** use the label register (condensed tracked caps) for field labels and section titles, and the mono only for quantities.
- **Do** draw new glyphs on the 16px grid with a 1.5px stroke, butt caps and mitre joins.
- **Do** position overlay elements with `translate` and animate them with `scale` / `rotate`.
- **Do** let the panel follow the OS scheme and the overlay follow the host page's own background (`detectPageScheme`) — it is a guest on a site we do not control.
- **Do** keep a concluded or uncertain mark on the field until the person acts on it.

### Don't:
- **Don't** put a card, a box or a shadow around content a hairline already delimits.
- **Don't** use vermilion for an error, a warning, a delete, or a generic "AI" flourish.
- **Don't** introduce a radius between 2px and a full circle, or apply a radius to a container.
- **Don't** tile the guilloche as wallpaper, or place it behind copy without masking the centre clear.
- **Don't** fade a disabled primary to a translucent plate; draw the empty frame.
- **Don't** put a label inside a control as a placeholder.
- **Don't** set running prose in the condensed tracked-caps register, or use mono for a category name.
- **Don't** add an icon library, or mix a 2px rounded-stroke glyph into a surface ruled with 1px hairlines.
- **Don't** replace the screen push/pop with a cross-fade, or reach for an animation runtime — View Transitions is available by construction here.
- **Don't** cross-fade or animate anything for someone who asked the OS for reduced motion, and don't take persistent information away from them either.
- **Don't** put a persistent dock, pill or launcher on the host page. The seal exists only while a field is focused.

## Open

- No image generation was available in this session, so the comp round was skipped: there is no approved comp and no QUALITY BAR card. The direction was chosen from a text-and-palette decision board (seed `c13f78b8`, position 4 of 7).
- The build has never been seen in a signed-in browser session. Every screenshot behind the finish review came from the fixture-driven gallery harness at `apps/extension/gallery/`, which renders all 13 panel states and the on-page layer. The harness is not shipped — WXT bundles only `src/entrypoints`.
- `tokens.ts` documents the guilloche as earning three positions (a header security band, the empty ground, and the field of an endorsement). The shipped build uses two: the first-run ground and the empty-state ground. The build wins; the header band was never printed and is recorded here as absent, not pending.
