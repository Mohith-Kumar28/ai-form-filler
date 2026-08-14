/**
 * The Credential Document — one palette, two consumers.
 *
 * The side panel gets these as Tailwind v4 `@theme` variables (src/assets/tailwind.css); the
 * page overlay gets them as an inlined CSS string, because a `chrome-extension://` stylesheet
 * is blocked by the CSP of a meaningful number of sites. Those used to be two hand-maintained
 * copies that had already drifted apart. This module is the authority for both, and
 * `tokens.test.ts` fails the build if tailwind.css stops agreeing with it.
 *
 * The world: a credential document. Its whole job is vouching for a person to a stranger who
 * has to decide whether to trust it, and it has a grammar for degrees of certainty that is
 * semantic rather than merely chromatic — a printed field is issued and fixed, an endorsement
 * is applied afterwards in another ink and carries who added it and when.
 *
 *   printed   a stated fact — no mark at all, just the document's own ink
 *   endorsed  a judgement call — the vermilion stamp, and the only true accent here
 *   queried   answered but uncertain — petrol, the second ink of the guilloche
 *
 * Faults are a fourth ink, `alert`, and deliberately not vermilion. Sharing one red between
 * "this was concluded, check it" and "this failed" made the product's single load-bearing
 * distinction indistinguishable from an upload error at a glance.
 */

export interface Scheme {
  /** Scroll ground: the safety-tint stock a credential is printed on. Never cream, never white. */
  stock: string
  /** Raised bands — header, footers, the document leaf itself. */
  leaf: string
  /** Every hairline. The engine-turned line, flattened to a rule. */
  guilloche: string
  /** The quieter hairline, for rules inside a group rather than between groups. */
  guillocheSoft: string
  /**
   * The engine-turned security ground, and only that.
   *
   * A token of its own rather than the hairline colour, because the two need different
   * distances from `stock` to read at the same weight: a 1px rule and a field of 0.65px curves
   * do not survive the same contrast. Sharing them shipped a ground that was right on the pale
   * stock and invisible on the dark one.
   */
  engine: string
  /** Intaglio ink. Primary text, and the plate a primary action is struck from. */
  ink: string
  /** Secondary text. */
  ink2: string
  /** Labels and measures. Still >= 4.5:1 on `stock` — this scale has no decorative tier. */
  ink3: string
  /**
   * The endorsement stamp, and nothing else: an answer this tool concluded rather than read.
   *
   * It used to carry errors and destructive actions too, which meant the product's one
   * load-bearing distinction shared an ink with "something broke" — a failed upload and a
   * guessed salary expectation spoke in the same voice. Faults now have `alert`.
   */
  endorse: string
  /** The stamp's ink bleeding into the paper — backgrounds only, never text. */
  endorseWash: string
  /** Faults: errors, refusals, and anything that destroys. The caution stamp, not the inspector's. */
  alert: string
  alertWash: string
  /** The second ink: uncertainty, focus, and the field being written right now. */
  query: string
  queryWash: string
  /**
   * Elevation, in two layers: the contact shadow and the cast one.
   *
   * Ink-hued rather than pure black, because a shadow belongs to the material that casts it —
   * and considerably heavier in dark, where a black shadow on a near-black ground does nothing
   * at all. Only three things in this system float: the overflow menu, the on-page slip, and
   * the seal. Nothing else may take these.
   */
  shadowNear: string
  shadowFar: string
}

export const LIGHT: Scheme = {
  stock: 'oklch(96.5% 0.009 168)',
  leaf: 'oklch(99.2% 0.004 168)',
  guilloche: 'oklch(87% 0.022 168)',
  guillocheSoft: 'oklch(93% 0.014 168)',
  engine: 'oklch(84% 0.026 168)',
  ink: 'oklch(23% 0.035 178)',
  ink2: 'oklch(38% 0.03 178)',
  ink3: 'oklch(46% 0.024 178)',
  endorse: 'oklch(48% 0.19 30)',
  endorseWash: 'oklch(94% 0.04 30)',
  alert: 'oklch(47% 0.13 62)',
  alertWash: 'oklch(94% 0.045 70)',
  query: 'oklch(45% 0.1 195)',
  queryWash: 'oklch(94% 0.03 195)',
  shadowNear: 'oklch(20% 0.03 190 / 0.14)',
  shadowFar: 'oklch(20% 0.03 190 / 0.26)',
}

/**
 * Not an inversion — a different physical scene.
 *
 * PRODUCT.md puts this person on a laptop, late, during a job hunt. In that light the
 * document reads the other way round: the ink becomes the ground and the printing comes up
 * pale off it, the way a passport page looks under a desk lamp with the room dark.
 */
export const DARK: Scheme = {
  stock: 'oklch(18% 0.022 190)',
  leaf: 'oklch(22.5% 0.026 190)',
  guilloche: 'oklch(34% 0.03 190)',
  guillocheSoft: 'oklch(27% 0.024 190)',
  engine: 'oklch(62% 0.055 190)',
  ink: 'oklch(95% 0.012 180)',
  ink2: 'oklch(76% 0.02 180)',
  ink3: 'oklch(64% 0.022 180)',
  endorse: 'oklch(72% 0.17 32)',
  endorseWash: 'oklch(30% 0.07 32)',
  alert: 'oklch(79% 0.14 72)',
  alertWash: 'oklch(30% 0.06 66)',
  query: 'oklch(74% 0.11 195)',
  queryWash: 'oklch(28% 0.05 195)',
  shadowNear: 'oklch(0% 0 0 / 0.4)',
  shadowFar: 'oklch(0% 0 0 / 0.6)',
}

/** Tailwind reads `--color-<name>`; the overlay reads `--aff-<name>`. Same values, same order. */
export const TOKEN_NAMES: (keyof Scheme)[] = [
  'stock',
  'leaf',
  'guilloche',
  'guillocheSoft',
  'engine',
  'ink',
  'ink2',
  'ink3',
  'endorse',
  'endorseWash',
  'alert',
  'alertWash',
  'query',
  'queryWash',
  'shadowNear',
  'shadowFar',
]

/** camelCase in TS, kebab-case in CSS. `guillocheSoft` -> `guilloche-soft`. */
export function cssName(token: keyof Scheme): string {
  return token.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)
}

/**
 * A credential has no rounded fields. The only curve on the document is a seal, and a seal is
 * a full circle — so there is one small radius for struck controls and nothing in between.
 */
export const RADIUS_DOC = '2px'

/** Everything vertical is a multiple of this. Documents are set on a ruled bed. */
export const RHYTHM = 4

export const EASE = 'cubic-bezier(0.2, 0, 0, 1)'

/**
 * The engine-turned rosette, as a real Lissajous curve rather than a stock texture.
 *
 * Guilloche is the one ornament on a credential that is not ornament: it exists because it is
 * expensive to reproduce. It earns its place in exactly two positions — the first-run ground
 * and the empty-state ground — and nowhere else. Used as wallpaper it would be the gimmick
 * this direction risks.
 */
export function guillocheDataUri(stroke: string, opacity = 0.9, size = 104): string {
  const cx = size / 2

  /**
   * High lobe count, shallow amplitude.
   *
   * The first version used seven lobes at 0.38 amplitude and rendered as a daisy — which is
   * what a rose curve is, and the opposite of the point. Engine turning reads as a *fine*
   * disturbance of a circle: the eye should see a ring first and the pattern second. Three
   * co-prime frequencies at a tenth of the radius, each phase-shifted, give the interference
   * beat a real rosette has without any of them reading as petals.
   */
  const rings: { lobes: number; radius: number; amplitude: number; phase: number }[] = [
    { lobes: 23, radius: 0.46, amplitude: 0.1, phase: 0 },
    { lobes: 19, radius: 0.36, amplitude: 0.11, phase: 0.4 },
    { lobes: 29, radius: 0.26, amplitude: 0.09, phase: 0.9 },
  ]

  const path = rings
    .map(({ lobes, radius, amplitude, phase }) => {
      const points: string[] = []
      const steps = lobes * 24
      for (let i = 0; i <= steps; i++) {
        const t = (i / steps) * Math.PI * 2
        const rr = size * radius * (1 + amplitude * Math.cos(lobes * t + phase))
        points.push(`${(cx + rr * Math.cos(t)).toFixed(2)},${(cx + rr * Math.sin(t)).toFixed(2)}`)
      }
      return `<polyline points="${points.join(' ')}"/>`
    })
    .join('')

  /*
    0.65 rather than a hairline. At 0.4 the strokes fell below one device pixel and the
    anti-aliaser dissolved them — legible on the pale stock, effectively invisible on the dark
    ground, which is how a texture ships looking right in exactly one of two real schemes.
  */
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">` +
    `<g fill="none" stroke="${stroke}" stroke-width="0.65" opacity="${opacity}">${path}</g>` +
    `</svg>`

  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
}

/**
 * The overlay's variable block, for both schemes.
 *
 * Emitted into the closed shadow root's single `<style>` node. The overlay deliberately does
 * **not** load the panel's bundled face: a webfont in a content script needs FontFace plus an
 * ArrayBuffer to survive a strict `font-src` policy, which is not worth it for four short
 * labels. Identity there is carried by the seal, the stamp, and the motion instead.
 */
export function overlayVariables(selector = ':host'): string {
  const emit = (scheme: Scheme) =>
    TOKEN_NAMES.map((name) => `  --aff-${cssName(name)}: ${scheme[name]};`).join('\n')

  /**
   * Keyed to the host page, not the operating system.
   *
   * This was a `prefers-color-scheme` media query, and it was wrong. The panel is our surface
   * and rightly follows the OS; the overlay is a guest on a page we do not control, and a
   * near-black slip landing on a white job application is a visitor announcing itself. The
   * content script measures what it is standing on and sets `data-scheme`, so a light site
   * gets the light document whatever the laptop is set to — and a site with its own dark mode
   * gets the dark one without the user changing anything.
   */
  return `:host {
  --aff-radius: ${RADIUS_DOC};
  --aff-ease: ${EASE};
}

${selector}, ${selector}([data-scheme="light"]) {
${emit(LIGHT)}
}

${selector}([data-scheme="dark"]) {
${emit(DARK)}
}`
}

/**
 * Which document to print, judged from the page's own ground.
 *
 * Walks outward for the first painted background — many sites leave `body` transparent and
 * colour `html`, or the other way round — and falls back to the OS only when the page declares
 * nothing at all. Perceptual luminance rather than a naive average, because a saturated blue
 * and a yellow of the same average channel value read nothing alike.
 */
export function detectPageScheme(view: Window = window): 'light' | 'dark' {
  const doc = view.document
  const candidates = [doc.body, doc.documentElement].filter(Boolean)

  for (const element of candidates) {
    const color = view.getComputedStyle(element).backgroundColor
    const match = color.match(/rgba?\(([^)]+)\)/)
    if (!match?.[1]) continue

    const parts = match[1].split(',').map((value) => Number.parseFloat(value.trim()))
    const [r, g, b, a = 1] = parts as [number, number, number, number?]
    // Transparent tells us nothing about what is actually painted behind it.
    if (!Number.isFinite(r) || a === 0) continue

    const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
    return luminance < 0.45 ? 'dark' : 'light'
  }

  return view.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}
