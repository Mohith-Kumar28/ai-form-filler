# Store artwork

Everything the Chrome Web Store listing needs, plus the share card the site has always pointed
at and never had.

The listing's **text** — name, short description, detailed description, and the justification
fields the store asks for — is in [LISTING.md](./LISTING.md). Two of those strings are also in
`apps/extension/wxt.config.ts` and have to match it.

```
pnpm assets:store              # rebuild all of it
pnpm assets:store --no-gallery # skip rebuilding the review harness (faster, if it is current)
```

## What is here

| File | Size | Where the store uses it |
| --- | --- | --- |
| `icon-128.png` | 128×128 | Listing header, search results, the install button. **Required.** |
| `screenshots/1-fill-any-form.png` | 1280×800 | Carousel, slide 1 |
| `screenshots/2-written-answers.png` | 1280×800 | Carousel, slide 2 |
| `screenshots/3-what-it-guessed.png` | 1280×800 | Carousel, slide 3 |
| `screenshots/4-feed-it-anything.png` | 1280×800 | Carousel, slide 4 |
| `screenshots/5-yours-to-submit.png` | 1280×800 | Carousel, slide 5 |
| `promo/small-tile-440x280.png` | 440×280 | Category and search tiles. **Effectively required** — listings without one are ranked lower. |
| `promo/marquee-1400x560.png` | 1400×560 | Editorial and featured placement. Optional, but a listing with no marquee cannot be featured in one. |
| `social/og-1200x630.png` | 1200×630 | Not a store asset. Copied to `apps/web/public/og-default.png` by the build, which is what `apps/web/src/lib/site.ts` has been referencing all along. |

Five screenshots is the maximum the store shows, and the store's own guidance is to supply all
five rather than one. Upload them in filename order — the numbering is the argument, not just a
sort key.

## The order, and why it is that order

Somebody deciding whether to install this reads the carousel in sequence, so the five slides are
the five questions in the order they get asked:

1. **What does it do** — a real job application in a browser window, panel docked, one button.
2. **Are the answers any good** — the answer card, its six one-tap rewrites, the instruction field.
3. **Can I trust them** — the same fill twice: labelled on the page, accounted for in the panel.
4. **What do I have to give it** — sources and facts, in dark, because that is when people do this.
5. **What does it do to my application** — nothing. It fills and stops.

## How the artwork is made

**The product in these images is the product.** The panel screens and the on-page overlay are
screenshots of the shipped components, captured out of `apps/extension/gallery/` — the harness
the UI is reviewed in — and then laid up on a brand ground in `build.mjs`. Nothing is drawn in a
design tool and nothing is traced.

That is deliberate. A listing is where the product is judged before it is installed, and a mock
that has drifted from the build is a promise the extension then fails to keep. When the panel
changes, `pnpm assets:store` makes the listing true again.

Two consequences worth knowing:

- **`PANELS` in `build.mjs` indexes `gallery/main.tsx` by frame position.** Reorder the frames in
  that file and the wrong screens land in the artwork. The build throws if an index is missing,
  but it cannot tell that index 6 is no longer the receipt.
- **The overlay harness publishes `window.__overlayRects`** so the answer card can be cropped to
  its own bounds. The overlay mounts into a closed shadow root, so that is the only way anything
  outside it can know where the card ended up.

## Editing

`src/base.css` holds the ground, the type, and the device frames. Every colour in it is a literal
copied from `apps/extension/src/lib/tokens.ts`, which stays the authority — `DESIGN.md` does not
describe this palette and should not be consulted for it.

Each composition is a `css` + `body` pair in `build.mjs`. They are absolute-positioned and pinned
to exact pixel sizes on purpose: each page **is** one store asset, the store rejects anything off
by a pixel, and nothing here is or should be responsive.

Captures render at 3× so they can be scaled freely; the final compositions render at 1× so the
PNG is exactly its declared size.

## What the images do not say

No prices and no trial terms anywhere in the artwork. Those change, images are cached by the
store and by everyone who has ever screenshotted a listing, and a stale number in a picture is
not something that can be edited later. Plan details belong in the listing description
([LISTING.md](./LISTING.md)) and on the site, where they are one line of text.

Sources: [Supplying images](https://developer.chrome.com/docs/webstore/images) ·
[Creating a great listing page](https://developer.chrome.com/docs/webstore/best-listing)
