/** Shared display formatting. Kept out of components so the rules are testable in one place. */

/** "1 September" — the date a quota comes back, not the ISO string the API sends. */
export function formatResetDate(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return 'next month'
  return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'long' }).format(date)
}

/** "14 August" for this year, "14 August 2025" for any other. */
export function formatAddedOn(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const sameYear = date.getFullYear() === new Date().getFullYear()
  return new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'long',
    ...(sameYear ? {} : { year: 'numeric' }),
  }).format(date)
}

export function plural(count: number, singular: string, plural = `${singular}s`): string {
  return count === 1 ? singular : plural
}

/** Grouped thousands, so "18,431 characters read" is legible at a glance. */
export function formatCount(value: number): string {
  return new Intl.NumberFormat().format(value)
}

/** Micro-dollars to cents, which is the only unit a person reads a fill's cost in. */
export function formatCost(microUsd: number): string {
  return `${(microUsd / 10_000).toFixed(2)}¢`
}

export function formatDuration(ms: number): string {
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`
}
