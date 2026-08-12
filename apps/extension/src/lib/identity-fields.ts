import type { Identity } from '@aff/shared'

/** Identity fields the editor exposes, in display order. */
export const IDENTITY_FIELDS: { key: keyof Identity; label: string; type: string }[] = [
  { key: 'fullName', label: 'Full name', type: 'text' },
  { key: 'preferredName', label: 'Preferred name', type: 'text' },
  { key: 'email', label: 'Email', type: 'email' },
  { key: 'phone', label: 'Phone', type: 'tel' },
  { key: 'location', label: 'Location', type: 'text' },
  { key: 'pronouns', label: 'Pronouns', type: 'text' },
  { key: 'workAuthorization', label: 'Work authorization', type: 'text' },
]

/** Guessed from the URL so the user doesn't have to categorise their own link. */
export function inferSourceKind(url: string): 'linkedin' | 'github' | 'portfolio' {
  if (/linkedin\.com/i.test(url)) return 'linkedin'
  if (/github\.com/i.test(url)) return 'github'
  return 'portfolio'
}

export function labelFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url.slice(0, 60)
  }
}
