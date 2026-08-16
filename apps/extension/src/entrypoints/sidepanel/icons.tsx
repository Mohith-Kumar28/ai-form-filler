/**
 * Authored on a 16px grid, one 1.75px stroke, round caps and joins throughout.
 *
 * The round join is the whole character: the previous set was mitred, which reads as
 * engraving — the language of a credential. This surface is your hype friend, so the same
 * geometry now rounds off, the way a friendly UI icon does, and the stroke gets a touch
 * bolder so it holds up against the bright palette.
 */

export interface IconProps {
  className?: string
}

function Svg({ className, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className ?? 'size-4'}
    >
      {children}
    </svg>
  )
}

/**
 * The sparkle — the product's mark and the sign of a guessed answer.
 *
 * A four-point twinkle. It shows up on the logo, the fill button, and beside every answer it
 * concluded rather than read, so one glyph carries both "this is the tool" and "this is the
 * guess" — the one thing you must look at.
 */
export function IconSparkle(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M8 2 9.3 6.7 14 8 9.3 9.3 8 14 6.7 9.3 2 8 6.7 6.7Z" />
    </Svg>
  )
}

/** A cluster of sparkles — the done-celebration and empty-state cheer. */
export function IconParty(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M8 1.75 9.2 6 13.5 8 9.2 10 8 14.25 6.8 10 2.5 8 6.8 6Z" />
      <path d="M12.75 10.5v2.25M11.6 11.6h2.3" />
      <path d="M3.25 2.25v1.5M2.5 3h1.5" />
    </Svg>
  )
}

export function IconChevronRight(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M6 3.5 10.5 8 6 12.5" />
    </Svg>
  )
}

export function IconChevronDown(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3.5 6 8 10.5 12.5 6" />
    </Svg>
  )
}

export function IconBack(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M10 3.5 5.5 8 10 12.5" />
    </Svg>
  )
}

export function IconPlus(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M8 3v10M3 8h10" />
    </Svg>
  )
}

export function IconMore(props: IconProps) {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden="true"
      focusable="false"
      className={props.className ?? 'size-4'}
    >
      <circle cx="3.75" cy="8" r="1.35" fill="currentColor" />
      <circle cx="8" cy="8" r="1.35" fill="currentColor" />
      <circle cx="12.25" cy="8" r="1.35" fill="currentColor" />
    </svg>
  )
}

export function IconClose(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" />
    </Svg>
  )
}

export function IconCheck(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3 8.5 6.5 12 13 4.5" />
    </Svg>
  )
}

export function IconDocument(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3.5 2h5.5l3.5 3.5v8.5H3.5z" />
      <path d="M9 2v3.5h3.5" />
    </Svg>
  )
}

export function IconLink(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M6.5 9.5 9.5 6.5" />
      <path d="M7.75 4.75 9.5 3a2.47 2.47 0 0 1 3.5 3.5l-1.75 1.75" />
      <path d="M8.25 11.25 6.5 13A2.47 2.47 0 0 1 3 9.5l1.75-1.75" />
    </Svg>
  )
}

export function IconText(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M2.5 4h11M2.5 8h11M2.5 12h6.5" />
    </Svg>
  )
}

export function IconImage(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="2" y="2.75" width="12" height="10.5" rx="2" />
      <circle cx="5.75" cy="5.75" r="1" />
      <path d="m2.75 11.75 3.25-3 2.5 2.25 2.5-2.25 2.25 2.5" />
    </Svg>
  )
}

export function IconAudio(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3 6.5v3M6 4.5v7M9 2.5v11M12 4.5v7M13.5 6.5v3" />
    </Svg>
  )
}

export function IconMic(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="6" y="2.5" width="4" height="6.75" rx="2" />
      <path d="M3.5 7.5a4.5 4.5 0 0 0 9 0M8 12.25v1.25M5.5 13.5h5" />
    </Svg>
  )
}

export function IconUpload(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M8 11V3M4.5 6 8 2.5 11.5 6" />
      <path d="M2.5 10.5v3h11v-3" />
    </Svg>
  )
}

export function IconExternal(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M7 3H3v10h10V9" />
      <path d="M9.5 2.5H13.5V6.5M13.5 2.5 7.5 8.5" />
    </Svg>
  )
}

export function IconTrash(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M2.5 4h11M6 4V2.5h4V4M4.5 4l.5 9.5h6L11.5 4" />
      <path d="M6.75 6.5v5M9.25 6.5v5" />
    </Svg>
  )
}

export function IconPen(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="m2.5 13.5.75-3 8-8 2.25 2.25-8 8z" />
      <path d="m9.75 4.25 2.25 2.25" />
    </Svg>
  )
}

export function IconAlert(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M8 2.25 15 14H1z" />
      <path d="M8 6.5v3.25" />
      <circle cx="8" cy="11.75" r="0.85" fill="currentColor" stroke="none" />
    </Svg>
  )
}

export function IconSignOut(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M6.5 2.5h-4v11h4" />
      <path d="M9 5.25 11.75 8 9 10.75M11.75 8h-6" />
    </Svg>
  )
}

export function IconGear(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="8" cy="8" r="2.1" />
      <path d="M8 1.75v1.5M8 12.75v1.5M1.75 8h1.5M12.75 8h1.5M3.58 3.58l1.06 1.06M11.36 11.36l1.06 1.06M12.42 3.58l-1.06 1.06M4.64 11.36l-1.06 1.06" />
    </Svg>
  )
}

export function IconMoon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12.5 10.5A6 6 0 1 1 5.5 3.5a4.5 4.5 0 0 0 7 7Z" />
    </Svg>
  )
}

export function IconSun(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="8" cy="8" r="3" />
      <path d="M8 1.5v1.5M8 13v1.5M1.5 8H3M13 8h1.5M3.4 3.4l1.06 1.06M11.54 11.54l1.06 1.06M12.6 3.4l-1.06 1.06M4.46 11.54l-1.06 1.06" />
    </Svg>
  )
}

export function IconHeart(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M8 13.5S2.5 10 2.5 6.3A2.7 2.7 0 0 1 8 5.5a2.7 2.7 0 0 1 5.5.8C13.5 10 8 13.5 8 13.5Z" />
    </Svg>
  )
}

export function IconRefresh(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M13 8a5 5 0 1 1-1.5-3.5" />
      <path d="M13 2.5v3h-3" />
    </Svg>
  )
}

// Deprecated aliases, kept so nothing breaks while the screens are rebuilt. These go away at
// the end of the redesign once every call site points at `IconSparkle`.
export const IconSeal = IconSparkle
export const IconStamp = IconSparkle
