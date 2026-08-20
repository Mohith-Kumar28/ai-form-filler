import { useState } from 'react'
import { Mascot } from '@/components/ui'
import { cn } from '@/lib/cn'

/**
 * The mark is the mascot's face — the same one the extension draws. It blinks on
 * its own and grins wider when you point at it.
 */
export function Logo({ className, size = 28 }: { className?: string; size?: number }) {
  const [hovered, setHovered] = useState(false)

  return (
    <span
      className={cn('group inline-flex items-center gap-2', className)}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
    >
      <Mascot
        expression={hovered ? 'party' : 'happy'}
        size={size}
        blink
        className="shrink-0 transition-transform duration-200 group-hover:-rotate-6 group-hover:scale-110"
      />
      <span className="font-display text-lg font-bold tracking-[-0.02em] text-ink">
        filla<span className="text-ink-muted">form</span>
      </span>
    </span>
  )
}
