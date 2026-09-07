# Fillaform — side panel and overlay

The panel is about the form beside it. That is the whole structure.

## Structure

```
Welcome                signed out
Setup                  first run: Add your résumé → Check the basics
Page                   the root, and the only screen about the form
  ├─ Knowledge base    tabs: Sources · Facts
  │    ├─ Add a document   File / Link / Note / Voice
  │    └─ Document         preview · facts · remove
  └─ Settings          Account · Plan (once money has been met) · On the page · Delete
```

No tab bar. The page is the root; everything else is somewhere you go and come back from with
Back. The header on the root carries the mark on the left and the two places to go on the right.

### Page — the ledger

One screen, one list, three moments:

- **Before a fill.** Site card (favicon, host, "12 questions · 5 from your details") and the one
  primary button. Under it, every question grouped by what Fill will do: *From your details*
  (matched locally by `matchFact`, value shown, free), *It will write* (the model), *Already
  answered* (left alone). A question that asks for a catalogue detail nothing is saved under gets
  an inline **Add** that saves straight to the profile — the form tells you what to save.
- **While filling.** The card shows the stage and a progress bar; Fill becomes Stop; the ledger
  dims. Stages are smoothed by `stage-walk` so a fast fill still reads as a sequence.
- **After a fill.** The card becomes the receipt ("Filled 6 of 12 questions · 3 to check"), the
  groups become *Check these* (judgement calls with verdict tags, hover highlights the field,
  click opens its card on the page), *From your details*, *Left blank* (with the reason). The
  footer walks the open judgement calls one at a time on the page, then offers Fill again / Done.

The grouping is pure (`lib/ledger.ts`, tested) so the screen is only a renderer.

### Knowledge base

Two halves, on two tabs, because they are two different jobs and mixing them into one scroll
made both harder to see.

- **Sources** (first, and the default) — what it *reads*: a résumé, a link, a pasted note, a
  voice recording. First because they are what make the answers good, and because somebody
  arriving with an empty account has to add one before anything else matters. Row: 28px tile ·
  name · status tag · meta · ⋯ menu (Rename / Preview or Open / Read again / Remove).
- **Facts** — the short answers it copies into a field exactly, laid out as **the whole
  catalogue**: About you, Address, IDs, Work, Links, then Extra fields for your own. Every
  section starts collapsed with a *filled of total* count on its header, so the tab opens as six
  lines you can read at a glance rather than thirty-eight rows to scroll past.

The empty boxes are the point. A list of only what happens to be filled tells you nothing you
did not already know; seeing every row a form can ask for is how you learn what to save without
waiting for a bad fill to teach you. Searching filters across every section at once and opens
whatever it hits. Anything the catalogue does not cover is a named field of your own under
Extra, and it can be renamed later.

Every screen that edits facts goes through `lib/profile-editor.ts`: a draft that settles after
1.5s, flushes on blur or Enter, and never queues more than one PATCH behind the one in flight.

### Setup

Two steps, both made of the real screens' parts: add a document (skippable), then check the
five basics seeded from the Google account. It ends one button short of the first fill, so
nothing in it mentions money.

## Rules that do not move

- **A stated answer and a judgement call never look the same.** Green dot = from your details.
  Violet dot = written. A violet "I guessed" / "not sure" tag = wants a look. The wording is
  verbatim on the page's provenance tab and in the panel, and the site demo mirrors it.
- **No money before the first fill attempt.** Nothing about plans, prices or meters until Fill
  is pressed (or the page asks). Once met, it stays visible under Settings → Plan.
- **The limit is the moment.** Asking for a sixth document or a twenty-sixth custom detail gets
  the same quiet offer, in place, not a lecture.
- **Deciding to pay ends the conversation.** A button somebody presses *because they want to
  upgrade* goes straight to checkout — Settings' trial and Compare plans both do. `UpgradeSheet`
  is only for the paywall moments, where it explains an interruption; it is never a toll gate in
  front of a person who has already decided.
- **Submitting is theirs.** Every receipt says so.

## System

- **Colour.** True neutrals, hairline borders, one violet accent for actions, focus and the
  written mark. Green for stated, red for faults, amber for heads-ups. The mascot body is the
  only gradient. Values live in `src/lib/tokens.ts`, mirrored byte-for-byte into
  `src/assets/tailwind.css` (`tokens.test.ts`) and inlined into the overlay.
- **Type.** Inter only. 13px body, 12 meta, 11 tags, 14–18 headings. Tabular numerals on every
  counter.
- **Shape.** Radii 6 / 8 / 12. Controls 32px, rows 40px, gutter 14px. Dark mode separates with
  hairlines, not shadows; shadows are for things that float (menus, sheets).
- **Width.** Chrome decides how wide the panel is. Everything is laid out for 320px first;
  there is no breakpoint.
- **Parts.** `components.tsx` is deliberately small: Screen / Header / Body / Footer, Button,
  IconButton, Kbd, Group, Row, Tag, Dot, Input, Textarea, Field, Toggle, Segmented, Note,
  Empty, Skeleton, Menu, Sheet (+ Confirm, Upgrade, DeleteAccount), Meter. Screens compose
  these and carry no styling of their own beyond spacing.
- **Motion.** Four verbs: pop in, fade in, slide up, shimmer. Screens push and pop as leaves
  through the View Transitions API. Everything stops under reduced motion.

## On the page (overlay)

The dock carries **Stop from the first stage**, not just once fields start landing: the flag the
stop button hangs off used to be set only in the branch that has a `done/total` count, which is
`applying` — the last and shortest phase. For the ten to twenty seconds of detecting, reading and
generating there was no way to call off a fill started by mistake, which is exactly the window in
which somebody wants to.

Otherwise unchanged in this pass. A dock pinned to the right edge (tile + rail; drag handle, side-panel
button and shortcut key cap fold out on hover), a 24px field trigger, coloured field marks with
a provenance tab, and the suggest / answer / menu cards. Styles are the inlined string in
`src/overlay/host.ts`; placement uses standalone `translate` only, and no keyframe on an
anchored element animates `translate` (`host.test.ts`).

## Review

`pnpm --filter @aff/extension gallery` builds every screen in every fixture state to
`apps/extension/.gallery/index.html` (`?scheme=dark`, `?width=320`). It is the only way to see
the whole panel at once; review there before reviewing in Chrome.

## Not in step yet

- `apps/web` and `store-assets/` still show the previous panel and palette.
- `ExtensionDemo.tsx` on the site mirrors the overlay, not the panel, and is unaffected.
