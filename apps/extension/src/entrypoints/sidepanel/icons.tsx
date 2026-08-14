/**
 * One drawn icon set, single 1.5px stroke on a 16px grid.
 *
 * Authored rather than pulled from a library so the weight matches the page's hairline
 * rules — a 2px library icon beside a 1px rule reads as two different systems.
 */

const base = {
  viewBox: '0 0 16 16',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
}

export function IconUpload({ className }: { className?: string }) {
  return (
    <svg {...base} className={className}>
      <title>Upload</title>
      <path d="M8 10.5V2.5M8 2.5 5 5.5M8 2.5l3 3M2.5 10.5v2a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1v-2" />
    </svg>
  )
}

export function IconLink({ className }: { className?: string }) {
  return (
    <svg {...base} className={className}>
      <title>Link</title>
      <path d="M6.5 9.5a2.5 2.5 0 0 0 3.5 0l2-2a2.5 2.5 0 0 0-3.5-3.5l-.8.8M9.5 6.5a2.5 2.5 0 0 0-3.5 0l-2 2a2.5 2.5 0 0 0 3.5 3.5l.8-.8" />
    </svg>
  )
}

export function IconText({ className }: { className?: string }) {
  return (
    <svg {...base} className={className}>
      <title>Paste text</title>
      <path d="M3 4h10M3 8h10M3 12h6" />
    </svg>
  )
}

export function IconClose({ className }: { className?: string }) {
  return (
    <svg {...base} className={className}>
      <title>Remove</title>
      <path d="M4 4l8 8M12 4l-8 8" />
    </svg>
  )
}

/** The correction mark. Used only where the notebook recorded an inference. */
export function IconInferred({ className }: { className?: string }) {
  return (
    <svg {...base} className={className}>
      <title>Judgement call</title>
      <path d="M8 2.5 13.5 12.5H2.5L8 2.5Z" />
      <path d="M8 6.5v3M8 11.2v.05" />
    </svg>
  )
}

export function IconVerified({ className }: { className?: string }) {
  return (
    <svg {...base} className={className}>
      <title>From your profile</title>
      <path d="M3.5 8.5 6.5 11.5 12.5 5" />
    </svg>
  )
}

export function IconPen({ className }: { className?: string }) {
  return (
    <svg {...base} className={className}>
      <title>Fill</title>
      <path d="M11.5 2.5a1.4 1.4 0 0 1 2 2L6 12l-3 1 1-3 7.5-7.5Z" />
    </svg>
  )
}
