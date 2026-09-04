# Fillaform — design system (v3)

The authority for the extension's look is `apps/extension/src/lib/tokens.ts`, mirrored into
`src/assets/tailwind.css` (the side panel) and inlined into the overlay's shadow root
(`src/overlay/host.ts`). `tokens.test.ts` fails the build if the two drift. This document is the
reasoning behind those values and the rules that are not expressible as a token.

## The bet

Neutral ground, hairline borders, one violet accent. The tool sits in a 400px column beside
somebody's job application; it should read like a good utility (a password manager, an issue
tracker) rather than an "AI product". The mascot is the brand mark and keeps its gradient
body; nothing else on screen carries a gradient, a glow or a bounce.

## Colour

| token | light | dark | used for |
|---|---|---|---|
| `surface` | 98.4% | 16% | app ground |
| `surface-raised` | white | 20% | cards, sheets, menus, controls at rest |
| `surface-muted` | 95.6% | 24.5% | hover grounds, insets, key caps (lighter than surface in dark) |
| `ink` / `ink-muted` / `ink-dim` | 18 / 46 / 56% | 95 / 70 / 56% | text ramp; every tier ≥ 4.5:1 on surface |
| `accent` / `accent-muted` | violet 52% / 95% | violet 66% / 28% | primary action, focus ring, the "judged" mark, selected state |
| `positive` | green | | stated answers, saved |
| `danger` | red | | faults and destruction — never the accent |
| `warning` | amber | | heads-ups |
| `sparkle` / `sun` | violet / coral | | **mascot body only** |
| `border` / `border-muted` | 90 / 94% | 28 / 23% | hairlines; dark separates with these, not shadows |
| `shadow` / `shadow-strong` | | | floating things only: menus, overlay cards, the launcher dock |

Rules: one accent per screen (a primary button *or* a highlighted mark, never both competing);
an error is red, a guess is violet, and the two never share a colour; `accent-muted` grounds a
chip or a selected option, never a whole card.

## Type

Inter only, self-hosted. Body 13px. Ramp: `2xs 11 / xs 12 / sm 13 / base 14 / lg 16 / xl 18 /
2xl 22`. Headings are 15–18px semibold with `-0.01em` tracking (`.display`); there is no display
face. Counters, meters, timers and `done/total` use `.tnum` (tabular numerals). The overlay uses
the system UI face at the same sizes — an injected widget should look like the other injected
widgets on the page.

## Shape and density

- Radii: `sm 6` chips and key caps · `md 8` buttons and inputs · `lg 12` cards, sheets, menus,
  the launcher dock. Pills are for chips only.
- Density: gutter 14, row 40, control 32. Buttons 28 / 32 / 36. A fact is a 36px row.
- Panel primitives live in `src/entrypoints/sidepanel/components.tsx`: `ScreenHeader` (with
  `tabs` and `search` slots), `TabBar`, `Button` (`primary | secondary | ghost | danger |
  destructive`), `IconButton`, `Kbd`, `Card`, `ListCard`, `SectionLabel`, `Row`, `Section` +
  `FieldRow` (label-left / value-right, editable in place), `Toggle`, `UsageBar`, the three
  sheets, `EmptyState`, `Stat`, `Chip`, `Mascot`.

## The three rules that survive every re-skin

1. **The Unmarked Fact Rule.** An answer read straight off the profile ends with *no mark at
   all*. The absence is the notation; marking everything flattens the only contrast that
   matters. (`overlay/markers.ts`)
2. **Settle-and-clear vs persist-until-acted.** A stated or failed mark settles and clears on
   its own. A judged mark and its tab stay until the person keeps, edits or clears the answer.
3. **Standalone `translate` is placement.** Everything the scheduler anchors is positioned with
   the `translate` property; animations use `scale`, `rotate` and `opacity` only, and never
   `transform`. `overlay/host.test.ts` enforces it.

## The overlay, state by state

- **Launcher dock** (`overlay/launcher.ts`): a raised strip pinned to the right edge, 36px
  tall, the mascot tile at its right end. On approach it grows leftward to show the drag
  handle, the side-panel button and the shortcut key cap. During a fill the rail says what is
  happening, then `done/total` with a stop button, and a 2px progress line runs along the
  bottom edge. An exhausted account keeps "Upgrade" in the rail. Working = a thin ring turning
  around the tile; the face never spins.
- **Field trigger** (`content.ts`): a 24px raised square beside a focused field — mascot glyph
  to fill, pen to rewrite; a ring while it works.
- **Marks** (`overlay/markers.ts`): active 2px accent ring; stated 1.5px green, clears; judged
  1.5px accent, stays; failed red, clears.
- **Provenance tab**: a raised chip beside the field — sparkle, "I guessed" / "not sure", a
  tick and a cross. Placement is `placeTab`; height is `TAB_HEIGHT`.
- **Cards** (`overlay/card.ts`): suggestion = one row (face, value, `Enter`, ×); answer card =
  reason chip + question, textarea or options, Tone/Length chips, an instruction box with an
  accent send button, Keep (accent) / Undo / Clear; menu = items + a note.
- **Learning chip**: raised, transient, tints its icon by state; `learned` fills accent.

## Copy

Plain, short, no persona. Say what the thing does ("Fill this form", "12 fields found",
"Nothing to read yet"). The product's two words for a judged answer are "I guessed" and "not
sure" — the site's demo mirrors them verbatim. Money is not mentioned until the first fill
attempt (`usePaywallSeen`), and stays visible once it has been.

## Not in step yet

`apps/web` (site palette, display font, and `ExtensionDemo.tsx`, which replicates the overlay)
and `store-assets/` screenshots still show the previous generation.
