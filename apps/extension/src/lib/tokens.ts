/**
 * One bright palette, two consumers.
 *
 * The side panel gets these as Tailwind v4 `@theme` variables (src/assets/tailwind.css); the
 * page overlay gets them as an inlined CSS string, because a `chrome-extension://` stylesheet
 * is blocked by the CSP of a meaningful number of sites. Those used to be two hand-maintained
 * copies that had already drifted apart; this module is the authority for both and
 * `tokens.test.ts` fails the build if tailwind.css stops agreeing with it.
 *
 * The palette is bright and saturated on purpose — a signature violet→pink→orange "sunset"
 * gradient for the hero moments, hot pink for the one thing you must look at (an answer the
 * tool guessed), lime for what came straight from you, and warm neutrals that are never pure
 * gray or pure black.
 *
 * The colour is where the personality lives. **The words are not** — copy says what the thing
 * does, in plain language. An earlier generation of this file described the product as "your
 * hype friend who does the boring homework for you", and screens written to that brief opened
 * with "forms suck. let's make 'em not." and reported a failed fill as "oof. that one didn't
 * land." Someone reading this panel is mid-application and mildly dreading it; they need to
 * know what happened, not to be cheered at.
 *
 *   filled    came from your own info — the friendly green, nothing to check
 *   judged    the tool concluded it rather than reading it — accent + a sparkle, on a tab
 *   broken    a fault — coral, and never pink, so an AI answer never reads as an error
 */

export interface Scheme {
  /** Scroll ground. A warm near-white, faintly lilac-tinted — never pure white. */
  surface: string
  /** Raised cards, headers, sheets, menus. */
  surfaceRaised: string
  /** Muted bands and hover grounds. */
  surfaceMuted: string
  /** Primary text. Warm near-black, violet-tinted. */
  ink: string
  /** Secondary text. */
  inkMuted: string
  /** Labels, hints, measures. Still >= 4.5:1 on `surface` — no decorative tier. */
  inkDim: string
  /**
   * The one thing you must look at: an answer the AI wrote rather than read off your info.
   *
   * Hot pink, always with a sparkle. Never used for errors — an AI answer and a fault are
   * different things, and sharing one colour between "check this" and "this broke" was the
   * exact failure of the previous build.
   */
  accent: string
  /** Pink wash — backgrounds and chips behind a guessed answer. */
  accentMuted: string
  /** Filled straight off what you told it. The friendly lime. */
  positive: string
  positiveMuted: string
  /** Faults and destruction. Coral, deliberately not pink. */
  danger: string
  dangerMuted: string
  /** Warnings and heads-ups. Amber. */
  warning: string
  warningMuted: string
  /** The violet stop of the signature sunset gradient. */
  sparkle: string
  /** The orange stop of the signature sunset gradient. */
  sun: string
  /** Hairlines that separate one group from the next. */
  border: string
  /** Quieter hairlines inside a group. */
  borderMuted: string
  /**
   * Elevation, in two layers: the contact shadow and the cast one.
   *
   * Slightly tinted rather than pure black — a shadow belongs to the material that casts it.
   * Heavier in dark, where a black shadow on a near-black ground separates nothing. Only
   * floating things take these: menus, the on-page cards, the launcher.
   */
  shadow: string
  shadowStrong: string
}

export const LIGHT: Scheme = {
  surface: 'oklch(97.2% 0.006 320)',
  surfaceRaised: 'oklch(99.3% 0.003 320)',
  surfaceMuted: 'oklch(93.5% 0.007 320)',
  ink: 'oklch(20% 0.02 300)',
  inkMuted: 'oklch(44% 0.02 300)',
  inkDim: 'oklch(60% 0.015 300)',
  accent: 'oklch(55% 0.24 350)',
  accentMuted: 'oklch(93% 0.04 350)',
  positive: 'oklch(58% 0.16 145)',
  positiveMuted: 'oklch(93% 0.055 145)',
  danger: 'oklch(55% 0.22 25)',
  dangerMuted: 'oklch(93% 0.045 25)',
  warning: 'oklch(68% 0.15 80)',
  warningMuted: 'oklch(94% 0.05 80)',
  sparkle: 'oklch(52% 0.24 290)',
  sun: 'oklch(68% 0.18 45)',
  border: 'oklch(87% 0.008 320)',
  borderMuted: 'oklch(92% 0.006 320)',
  shadow: 'oklch(25% 0.02 300 / 0.08)',
  shadowStrong: 'oklch(25% 0.02 300 / 0.16)',
}

/**
 * Not an inversion — a different scene.
 *
 * PRODUCT.md puts this person on a laptop, late, during a job hunt. In that light the surface
 * goes a deep violet-tinted near-black and the brights come up louder off it, the way a neon
 * sign reads brighter in the dark.
 */
export const DARK: Scheme = {
  surface: 'oklch(15% 0.022 300)',
  surfaceRaised: 'oklch(19.5% 0.024 300)',
  surfaceMuted: 'oklch(12% 0.018 300)',
  ink: 'oklch(96% 0.008 320)',
  inkMuted: 'oklch(74% 0.014 320)',
  inkDim: 'oklch(58% 0.012 320)',
  accent: 'oklch(70% 0.22 350)',
  accentMuted: 'oklch(26% 0.06 350)',
  positive: 'oklch(72% 0.17 145)',
  positiveMuted: 'oklch(24% 0.05 145)',
  danger: 'oklch(70% 0.19 25)',
  dangerMuted: 'oklch(26% 0.05 25)',
  warning: 'oklch(78% 0.14 80)',
  warningMuted: 'oklch(26% 0.045 80)',
  sparkle: 'oklch(70% 0.2 290)',
  sun: 'oklch(76% 0.16 45)',
  border: 'oklch(30% 0.02 300)',
  borderMuted: 'oklch(23% 0.018 300)',
  shadow: 'oklch(0% 0 0 / 0.35)',
  shadowStrong: 'oklch(0% 0 0 / 0.55)',
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
 * Two radii and no scale between them — but now the bubbly way round: a small one for struck
 * controls, a full pill for buttons, chips and the launcher.
 */
export const RADIUS_SM = '6px'
export const RADIUS_MD = '12px'
export const RADIUS_LG = '18px'
export const RADIUS_FULL = '9999px'

/** Everything vertical is a multiple of this. */
export const RHYTHM = 4

/** The one snappy ease for hovers and settles. */
export const EASE = 'cubic-bezier(0.2, 0, 0, 1)'

/** The bouncy spring for pops and celebrations — a tiny overshoot is the whole joke. */
export const SPRING = 'cubic-bezier(0.34, 1.56, 0.64, 1)'

/**
 * The signature sunset gradient, as a CSS value (violet → pink → orange).
 *
 * The one place the palette gets to be loud. Used on the primary button, the launcher, and
 * the welcome hero — nowhere it would compete with an answer.
 */
export function sunsetGradient(angle = '135deg'): string {
  return `linear-gradient(${angle}, ${LIGHT.sparkle}, ${LIGHT.accent}, ${LIGHT.sun})`
}

/**
 * The overlay's variable block, for both schemes.
 *
 * Emitted into the closed shadow root's single `<style>` node. The overlay deliberately does
 * **not** load the panel's bundled face: a webfont in a content script needs FontFace plus an
 * ArrayBuffer to survive a strict `font-src` policy, which is not worth it for a few short
 * labels. Identity there is carried by colour and motion instead.
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
