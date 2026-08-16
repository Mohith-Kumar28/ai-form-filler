import { IconSparkle } from '@/components/ui'
import { cn } from '@/lib/cn'

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <span
        className="flex size-7 shrink-0 items-center justify-center rounded-full"
        style={{ background: 'linear-gradient(135deg, var(--sparkle), var(--accent))' }}
      >
        <IconSparkle className="size-4 text-white" />
      </span>
      <span className="font-display text-lg font-bold tracking-[-0.02em] text-ink">
        filla<span className="text-ink-muted">form</span>
      </span>
    </span>
  )
}
