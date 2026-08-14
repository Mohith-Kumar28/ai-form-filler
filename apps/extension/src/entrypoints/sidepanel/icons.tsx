/**
 * Authored on a 16px grid, one 1.5px stroke, butt caps and mitre joins throughout.
 *
 * The cap and join choice is the whole character: a rounded stroke reads as a UI icon library,
 * a mitred one reads as engraving, which is the register every other mark on this surface is
 * in. Mixing a 2px library icon into a page ruled with 1px hairlines reads as two systems, so
 * there is no library here.
 */

interface IconProps {
  className?: string
}

function Svg({ className, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="butt"
      strokeLinejoin="miter"
      aria-hidden="true"
      focusable="false"
      className={className ?? 'size-4'}
    >
      {children}
    </svg>
  )
}

export function IconChevronRight(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M6 3.5 10.5 8 6 12.5" />
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
    <Svg {...props}>
      <path d="M3.25 8h.01M8 8h.01M12.75 8h.01" strokeWidth={2} strokeLinecap="round" />
    </Svg>
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

/** The document leaf, with the corner turned — every credential is a folded sheet. */
export function IconDocument(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3.25 1.75h6l3.5 3.5v9h-9.5z" />
      <path d="M9.25 1.75v3.5h3.5" />
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
      <path d="M2 2.75h12v10.5H2z" />
      <path d="m2 10.5 3.25-3 3 2.75 2.5-2.25L14 10.75" />
      <path d="M5.75 5.75h.01" strokeWidth={2} strokeLinecap="round" />
    </Svg>
  )
}

export function IconAudio(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M2 6.5v3M5 4v8M8 2.25v11.5M11 4.75v6.5M14 6.5v3" />
    </Svg>
  )
}

export function IconMic(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M6 3.25a2 2 0 0 1 4 0v4a2 2 0 0 1-4 0z" />
      <path d="M3.5 7.5a4.5 4.5 0 0 0 9 0M8 12v2.25M5.75 14.25h4.5" />
    </Svg>
  )
}

export function IconUpload(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M8 10.5V2.5M4.75 5.75 8 2.5l3.25 3.25" />
      <path d="M2.5 10.5v3h11v-3" />
    </Svg>
  )
}

export function IconExternal(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M7 3H2.75v10.25H13V9" />
      <path d="M9.5 2.5H13.5v4M13.5 2.5 7.75 8.25" />
    </Svg>
  )
}

export function IconTrash(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M2.5 4h11M6 4V2.25h4V4M4 4l.75 9.75h6.5L12 4" />
      <path d="M6.75 6.5v5M9.25 6.5v5" />
    </Svg>
  )
}

/** Rewrite: the correcting pen, not a magic wand. */
export function IconPen(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="m2.5 13.5.75-3 8-8 2.25 2.25-8 8z" />
      <path d="m9.75 4.25 2.25 2.25" />
    </Svg>
  )
}

/**
 * The endorsement stamp — an oval on a shaft, which is what an inspector's stamp looks like
 * from the side and what marks every answer this thing concluded rather than read.
 */
export function IconStamp(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M5.25 2.25h5.5v3.5l1.5 3.25h-8.5l1.5-3.25z" />
      <path d="M2.5 11.5h11M2.5 13.75h11" />
    </Svg>
  )
}

export function IconAlert(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M8 2 15 14H1z" />
      <path d="M8 6.5v3.25" />
      <path d="M8 12h.01" strokeWidth={2} strokeLinecap="round" />
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

/**
 * The seal: the product's mark.
 *
 * A miniature of the same engine-turned rosette the guilloche band draws, so the mark and the
 * document's security printing are demonstrably one system rather than a logo dropped onto a
 * theme. Drawn once here rather than generated, because at 16px the generated curve resolves
 * to mud.
 */
export function IconSeal({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      aria-hidden="true"
      focusable="false"
      className={className ?? 'size-4'}
    >
      <circle cx="8" cy="8" r="6.75" strokeWidth={1.5} />
      <path
        d="M8 2.6 9.9 6.1 13.4 8 9.9 9.9 8 13.4 6.1 9.9 2.6 8 6.1 6.1z"
        strokeWidth={1}
        strokeLinejoin="miter"
      />
      <circle cx="8" cy="8" r="1.6" strokeWidth={1} />
    </svg>
  )
}
