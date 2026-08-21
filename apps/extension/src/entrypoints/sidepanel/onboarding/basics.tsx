import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  getGetProfileQueryKey,
  usePatchProfile,
} from '../../../generated/endpoints/profile/profile.js'
import type { Account, Profile } from '../../../generated/model/index.js'
import { type CatalogField, fieldFor, reconcile, toPatch } from '../../../lib/fact-catalog.js'
import { FieldRow } from '../components.js'
import { IconCheck } from '../icons.js'

/**
 * The ten questions every form asks, in the order a person can answer them without thinking.
 *
 * Not a section of the catalogue and not the whole of it: the catalogue has thirty-eight fields and
 * six sections, which is a data-entry job, and the point here is the first five minutes. These are
 * the fields that (a) almost every form wants and (b) somebody can answer from memory while a
 * browser tab waits. Everything else lives in My info, where there is a search box and no pressure.
 *
 * Pulled through `fieldFor` rather than written out, so the label, type, placeholder and hint are
 * the catalogue's — one catalogue, one spelling of "Notice period", matched by the same matcher the
 * fill path uses.
 */
const KEYS = [
  'fullName',
  'email',
  'phone',
  'location',
  'Current job title',
  'Current company',
  'linkedin',
  'website',
  'Total experience',
  'Notice period',
]

/** How many of them have to be answered before the flow will move on. */
export const BASICS_REQUIRED = 5

const FIELDS: CatalogField[] = KEYS.map((key) => fieldFor(key)).filter(
  (field): field is CatalogField => field !== undefined,
)

/** Which of the asked-for fields already hold something. Drives the counter and the gate. */
export function countBasics(profile: Profile | undefined): number {
  if (!profile) return 0
  const { values } = reconcile(profile)
  return FIELDS.filter((field) => (values[field.key] ?? '').trim() !== '').length
}

/**
 * The one screen in the flow that asks for typing.
 *
 * Everything about it is arranged around not being abandoned: the fields the account already knows
 * are filled in and counted (signing in with Google hands over a name and an email, so nobody
 * starts at zero), the goal is five rather than ten, and the counter says how many are left rather
 * than how many exist. Saving happens on the way out of each field, so closing the panel
 * mid-address loses nothing — this surface gets closed constantly, because the form the user came
 * for is behind it.
 */
export function Basics({
  account,
  profile,
  onCountChange,
}: {
  account: Account
  profile: Profile | undefined
  /** Reported upward so the flow's footer can gate on it without owning the draft. */
  onCountChange: (filled: number) => void
}) {
  const queryClient = useQueryClient()
  const patch = usePatchProfile()
  // `usePatchProfile` returns a fresh object on every state transition, so the seeding effect below
  // would re-run mid-save if it closed over `patch` itself. Same reason `Facts` keeps one.
  const patchRef = useRef(patch.mutate)
  patchRef.current = patch.mutate

  const stored = useMemo(() => reconcile(profile ?? { identity: {}, custom: {} }), [profile])
  const [draft, setDraft] = useState<Record<string, string>>({})

  /**
   * The server's copy is adopted once per field, and only into fields nobody has touched.
   *
   * A source finishing parsing rewrites the profile — extraction fills in exactly these fields —
   * and if that landed on top of the draft it would overwrite a half-typed phone number with an
   * older one. So `draft` wins wherever it has a value.
   */
  const values = useMemo(() => {
    const merged: Record<string, string> = {}
    for (const field of FIELDS) {
      merged[field.key] = draft[field.key] ?? stored.values[field.key] ?? ''
    }
    return merged
  }, [draft, stored])

  const filled = FIELDS.filter((field) => (values[field.key] ?? '').trim() !== '').length

  // The count is state the footer needs and this screen owns, so it is reported rather than
  // recomputed there — two counters over one draft is how a "Continue" button ends up disabled
  // next to five filled fields.
  const report = useRef(onCountChange)
  report.current = onCountChange
  useEffect(() => {
    report.current(filled)
  }, [filled])

  /**
   * Saves the whole set, not the one field.
   *
   * `toPatch` needs the complete reconciled profile — it rebuilds `identity`, `links` and `custom`
   * from it — and sending one field would not be smaller anyway: the server recompiles the prompt
   * document on any write. Fired on blur, which for a keyboard user is every field they finish.
   */
  const save = () => {
    const next = { ...stored, values: { ...stored.values, ...values } }
    patch.mutate(
      { data: toPatch(next) },
      {
        onSuccess: (updated) => queryClient.setQueryData(getGetProfileQueryKey(), updated),
      },
    )
  }

  /**
   * Two fields for free, from the account they just signed in with.
   *
   * Google has already told us a name and an email; asking for them again is the product admitting
   * it was not paying attention. Saved rather than merely shown, because a value sitting in a draft
   * nobody focuses is a value that is never written — and the counter above would then be counting
   * something the server does not have.
   *
   * Once, and only into empty fields: somebody whose forms want a different name from their Google
   * one must be able to change it without this putting it back.
   */
  const seeded = useRef(false)
  useEffect(() => {
    if (seeded.current || !profile) return
    seeded.current = true

    const seed: Record<string, string> = {}
    if ((stored.values.fullName ?? '').trim() === '' && account.name) seed.fullName = account.name
    if ((stored.values.email ?? '').trim() === '') seed.email = account.email
    if (Object.keys(seed).length === 0) return

    setDraft((current) => ({ ...seed, ...current }))
    patchRef.current(
      { data: toPatch({ ...stored, values: { ...stored.values, ...seed } }) },
      { onSuccess: (updated) => queryClient.setQueryData(getGetProfileQueryKey(), updated) },
    )
  }, [profile, stored, account, queryClient])

  const left = Math.max(0, BASICS_REQUIRED - filled)

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-xs font-semibold text-ink-muted">
          {left === 0 ? (
            <span className="inline-flex items-center gap-1 text-positive">
              <IconCheck className="size-3.5" />
              {filled} answered — that is plenty to start
            </span>
          ) : (
            `${filled} of ${BASICS_REQUIRED} — ${left} more to go`
          )}
        </p>
        {patch.isPending && <span className="text-2xs text-ink-dim">Saving…</span>}
      </div>

      {/*
        A goal, not a total.

        The bar fills against five, so answering five fills it — a bar against ten would sit at
        half full at the exact moment the screen says "that is plenty", which reads as failure.
      */}
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-muted">
        <div
          className="h-full rounded-full transition-[width] duration-500 ease-out"
          style={{
            width: `${Math.min(100, (filled / BASICS_REQUIRED) * 100)}%`,
            background:
              left === 0
                ? 'var(--color-positive)'
                : 'linear-gradient(90deg, var(--color-sparkle), var(--color-accent))',
          }}
        />
      </div>

      <div className="mt-2 divide-y divide-border-muted">
        {FIELDS.map((field, index) => (
          <FieldRow
            key={field.key}
            label={field.label}
            hint={field.hint}
            type={field.type}
            placeholder={field.placeholder}
            sensitive={field.sensitive}
            autoFocus={index === 0 && filled === 0}
            value={values[field.key] ?? ''}
            onChange={(next) => setDraft((current) => ({ ...current, [field.key]: next }))}
            onCommit={save}
          />
        ))}
      </div>

      {patch.isError && (
        <p className="mt-2 text-xs leading-snug text-danger" role="alert">
          {(patch.error as Error).message}
        </p>
      )}

      <p className="mt-3 text-2xs leading-relaxed text-ink-dim">
        Saved as you go. Everything here is editable later in My info, along with twenty-eight other
        fields — addresses, IDs, salary, whatever your forms ask for.
      </p>
    </div>
  )
}
