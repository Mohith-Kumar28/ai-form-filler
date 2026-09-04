/**
 * One palette, two consumers.
 *
 * The side panel gets these as Tailwind v4 `@theme` variables (src/assets/tailwind.css); the
 * page overlay gets them as an inlined CSS string, because a `chrome-extension://` stylesheet
 * is blocked by the CSP of a meaningful number of sites. This module is the authority for both
 * and `tokens.test.ts` fails the build if tailwind.css stops agreeing with it.
 *
 * ### v3: neutral ground, one accent
 *
 * The previous generation was a violet-tinted near-black with a violet→pink→orange gradient on
 * every button, toggle and launcher. It read as an "AI product" rather than a tool. This palette
 * is the opposite bet: true neutrals, hairline borders, and exactly one colour that means
 * "press this" and "the tool guessed this" — violet. Everything else on screen is ink on paper.
 *
 * The mascot keeps a gradient body (`sparkle` → `sun`) because the face is the brand mark and
 * shares its geometry with the site and the toolbar icon. Those two stops are for the mascot
 * alone; no control, ring, bar or text may use them.
 *
 *   stated    came from your own info — green, settles, leaves nothing behind
 *   judged    the tool concluded it — accent, kept until you act
 *   broken    a fault — red, never the accent, so a guess never reads as an error
 */

export interface Scheme {
  /** The app ground. A hair off white in light; a true neutral near-black in dark. */
  surface: string
  /** Cards, sheets, menus, and every control at rest. */
  surfaceRaised: string
  /** Hover grounds, insets, key caps. Darker than `surface` in light, lighter in dark. */
  surfaceMuted: string
  /** Primary text. */
  ink: string
  /** Secondary text: labels, descriptions. */
  inkMuted: string
  /** Tertiary text: hints, measures, placeholders. Still ≥ 4.5:1 on `surface`. */
  inkDim: string
  /**
   * The one colour. Primary actions, focus rings, the "judged" mark, and nothing decorative.
   *
   * Never used for errors: an answer the tool guessed and a fault are different things.
   */
  accent: string
  /** Accent wash — chip grounds, focus halos, the selected option. */
  accentMuted: string
  /** Filled straight off what you told it. */
  positive: string
  positiveMuted: string
  /** Faults and destruction. */
  danger: string
  dangerMuted: string
  /** Heads-ups. */
  warning: string
  warningMuted: string
  /** The mascot body gradient's first stop. Mascot only. */
  sparkle: string
  /** The mascot body gradient's second stop. Mascot only. */
  sun: string
  /** Hairlines between groups, and around controls. */
  border: string
  /** Quieter hairlines inside a group. */
  borderMuted: string
  /**
   * Elevation, in two layers: the contact shadow and the cast one.
   *
   * Only floating things take these: menus, the on-page cards, the launcher dock. In dark the
   * separation comes from hairlines, so the shadows are heavier but still secondary.
   */
  shadow: string
  shadowStrong: string
}

export const LIGHT: Scheme = {
  surface: 'oklch(98.4% 0.002 260)',
  surfaceRaised: 'oklch(100% 0 0)',
  surfaceMuted: 'oklch(95.6% 0.003 260)',
  ink: 'oklch(18% 0.01 260)',
  inkMuted: 'oklch(46% 0.012 260)',
  inkDim: 'oklch(56% 0.012 260)',
  accent: 'oklch(52% 0.21 285)',
  accentMuted: 'oklch(95% 0.03 285)',
  positive: 'oklch(55% 0.15 150)',
  positiveMuted: 'oklch(95% 0.04 150)',
  danger: 'oklch(55% 0.2 25)',
  dangerMuted: 'oklch(95% 0.035 25)',
  warning: 'oklch(62% 0.15 75)',
  warningMuted: 'oklch(95% 0.05 80)',
  sparkle: 'oklch(60% 0.2 290)',
  sun: 'oklch(70% 0.18 20)',
  border: 'oklch(90% 0.004 260)',
  borderMuted: 'oklch(94% 0.003 260)',
  shadow: 'oklch(20% 0.01 260 / 0.08)',
  shadowStrong: 'oklch(20% 0.01 260 / 0.18)',
}

/**
 * Not an inversion — the same neutrals, read the other way up.
 *
 * `surfaceMuted` is *lighter* than `surface` here where in light it is darker: in both schemes
 * it is the ground a row takes when you point at it, and a hover that goes darker on a dark
 * panel reads as a hole.
 */
export const DARK: Scheme = {
  surface: 'oklch(16% 0.005 260)',
  surfaceRaised: 'oklch(20% 0.006 260)',
  surfaceMuted: 'oklch(24.5% 0.006 260)',
  ink: 'oklch(95% 0.004 260)',
  inkMuted: 'oklch(70% 0.008 260)',
  inkDim: 'oklch(56% 0.008 260)',
  accent: 'oklch(66% 0.18 285)',
  accentMuted: 'oklch(28% 0.07 285)',
  positive: 'oklch(75% 0.15 150)',
  positiveMuted: 'oklch(26% 0.05 150)',
  danger: 'oklch(72% 0.17 25)',
  dangerMuted: 'oklch(27% 0.06 25)',
  warning: 'oklch(78% 0.14 80)',
  warningMuted: 'oklch(27% 0.05 80)',
  sparkle: 'oklch(66% 0.18 290)',
  sun: 'oklch(74% 0.16 20)',
  border: 'oklch(28% 0.006 260)',
  borderMuted: 'oklch(23% 0.006 260)',
  shadow: 'oklch(0% 0 0 / 0.4)',
  shadowStrong: 'oklch(0% 0 0 / 0.6)',
}

/** Tailwind reads `--color-<name>`; the overlay reads `--aff-<name>`. Same values, same order. */
export const TOKEN_NAMES: (keyof Scheme)[] = [
  'surface',
  'surfaceRaised',
  'surfaceMuted',
  'ink',
  'inkMuted',
  'inkDim',
  'accent',
  'accentMuted',
  'positive',
  'positiveMuted',
  'danger',
  'dangerMuted',
  'warning',
  'warningMuted',
  'sparkle',
  'sun',
  'border',
  'borderMuted',
  'shadow',
  'shadowStrong',
]

/** camelCase in TS, kebab-case in CSS. `surfaceRaised` -> `surface-raised`. */
export function cssName(token: keyof Scheme): string {
  return token.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)
}

/**
 * Three radii, each tied to a kind of thing: chips and key caps, controls, containers. Pills are
 * for chips only — a pill-shaped button in a 400px panel spends its width on corners.
 */
export const RADIUS_SM = '6px'
export const RADIUS_MD = '8px'
export const RADIUS_LG = '12px'
export const RADIUS_FULL = '9999px'

/** Everything vertical is a multiple of this. */
export const RHYTHM = 4

/** The one snappy ease for hovers and settles. */
export const EASE = 'cubic-bezier(0.2, 0, 0, 1)'

/** A small spring for things that pop in. The overshoot is slight on purpose. */
export const SPRING = 'cubic-bezier(0.3, 1.3, 0.5, 1)'

/**
 * The mascot's body, as a CSS value. The only gradient in the product.
 *
 * Used by nothing but the mascot mark itself; a control that reaches for this is a control
 * pretending to be the brand.
 */
export function mascotGradient(angle = '135deg'): string {
  return `linear-gradient(${angle}, ${LIGHT.sparkle}, ${LIGHT.sun})`
}

/**
 * The overlay's variable block, for both schemes.
 *
 * Emitted into the closed shadow root's single `<style>` node. The overlay deliberately does
 * **not** load a webfont: one in a content script needs FontFace plus an ArrayBuffer to survive a
 * strict `font-src` policy, which is not worth it for a few short labels. The system UI face is
 * what every other injected tool on the page uses, and matching that is the point.
 */
export function overlayVariables(selector = ':host'): string {
  const emit = (scheme: Scheme) =>
    TOKEN_NAMES.map((name) => `  --aff-${cssName(name)}: ${scheme[name]};`).join('\n')

  /**
   * Keyed to the host page, not the operating system.
   *
   * The panel is our surface and rightly follows the OS; the overlay is a guest on a page we
   * do not control, and a near-black card landing on a white job application is a visitor
   * announcing itself. The content script measures what it is standing on and sets
   * `data-scheme`, so a light site gets the light card whatever the laptop is set to.
   */
  return `:host {
  --aff-radius-sm: ${RADIUS_SM};
  --aff-radius-md: ${RADIUS_MD};
  --aff-radius-lg: ${RADIUS_LG};
  --aff-radius-full: ${RADIUS_FULL};
  --aff-ease: ${EASE};
  --aff-spring: ${SPRING};
}

${selector}, ${selector}([data-scheme="light"]) {
${emit(LIGHT)}
}

${selector}([data-scheme="dark"]) {
${emit(DARK)}
}`
}

/**
 * Which scheme to print, judged from the page's own ground.
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
