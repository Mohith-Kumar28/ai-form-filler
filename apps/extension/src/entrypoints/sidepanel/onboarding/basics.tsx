import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  getGetProfileQueryKey,
  usePatchProfile,
} from '../../../generated/endpoints/profile/profile.js'
import type { Account, Profile } from '../../../generated/model/index.js'
import {
  type CatalogField,
  type FactSection,
  FIELDS_BY_SECTION,
  reconcile,
  SECTIONS,
  sectionProgress,
  toPatch,
} from '../../../lib/fact-catalog.js'
import { FieldRow, Section } from '../components.js'
import { IconCheck } from '../icons.js'

/**
 * The catalogue, in its own sections, on the first-run screen.
 *
 * This used to be a hand-picked list of ten keys in one flat scroll, and that was the wrong shape
 * twice over: it hid twenty-eight fields somebody may well have wanted to fill while they were
 * already typing, and it threw away the grouping "Your info" spends its whole design on. Same
 * `SECTIONS`, same `Section` cards, same `FieldRow`, same `n/m` counters, same catalogue order.
 * One editor, in two places.
 *
 * Collapsed is what keeps it from being a data-entry job: six shut cards with a count each fit on
 * one screen and say exactly how much there is, and only "About you" opens on arrival, because
 * that is where the five that matter live.
 */
const SHOWN = SECTIONS.filter((section) => section.section !== 'extra')

const FIELDS: CatalogField[] = SHOWN.flatMap((section) => FIELDS_BY_SECTION[section.section])

/** How many answers the flow will move on for. */
export const BASICS_REQUIRED = 5

/** Which catalogue fields already hold something. Drives the counter and the gate. */
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
 * starts at zero), the goal is five rather than everything, and the counter says how many are left
 * rather than how many exist. Saving happens on the way out of each field, so closing the panel
 * mid-address loses nothing. This surface gets closed constantly, because the form the user came
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

  /* Shut, except "About you". The same rule `Facts` follows, minus the search box it overrides. */
  const [open, setOpen] = useState<Partial<Record<FactSection, boolean>>>({ about: true })

  /**
   * The server's copy is adopted once per field, and only into fields nobody has touched.
   *
   * A source finishing parsing rewrites the profile, and if that landed on top of the draft it
   * would overwrite a half-typed phone number with an older one. So `draft` wins wherever it has
   * a value.
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
  // recomputed there. Two counters over one draft is how a "Continue" button ends up disabled
  // next to five filled fields.
  const report = useRef(onCountChange)
  report.current = onCountChange
  useEffect(() => {
    report.current(filled)
  }, [filled])

  /**
   * Saves the whole set, not the one field.
   *
   * `toPatch` needs the complete reconciled profile: it rebuilds `identity`, `links` and `custom`
   * from it, and sending one field would not be smaller anyway, because the server recompiles the
   * prompt document on any write. Fired on blur, which for a keyboard user is every field they
   * finish.
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
   * nobody focuses is a value that is never written, and the counter above would then be counting
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
  /** What the section counters count against. `sectionProgress` also wants extras. */
  const counted = { values, extras: {} }

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-xs font-semibold text-ink-muted">
          {left === 0 ? (
            <span className="inline-flex items-center gap-1 text-positive">
              <IconCheck className="size-3.5" />
              {filled} answered
            </span>
          ) : (
            `${filled} of ${BASICS_REQUIRED}`
          )}
        </p>
        {patch.isPending && <span className="text-2xs text-ink-dim">Saving…</span>}
      </div>

      {/*
        A goal, not a total.

        The bar fills against five, so answering five fills it. A bar against thirty-eight would sit
        near empty at the exact moment the screen says that is plenty, which reads as failure.
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

      <div className="mt-3 flex flex-col gap-2.5">
        {SHOWN.map((section) => (
          <Section
            key={section.section}
            title={section.title}
            count={sectionProgress(section.section, counted)}
            open={open[section.section] === true}
            onToggle={(next) => setOpen((current) => ({ ...current, [section.section]: next }))}
          >
            {FIELDS_BY_SECTION[section.section].map((field, index) => (
              <FieldRow
                key={field.key}
                label={field.label}
                hint={field.hint}
                type={field.type}
                placeholder={field.placeholder}
                sensitive={field.sensitive}
                autoFocus={section.section === 'about' && index === 0 && filled === 0}
                value={values[field.key] ?? ''}
                onChange={(next) => setDraft((current) => ({ ...current, [field.key]: next }))}
                onCommit={save}
              />
            ))}
          </Section>
        ))}
      </div>

      {patch.isError && (
        <p className="mt-2 text-xs leading-snug text-danger" role="alert">
          {(patch.error as Error).message}
        </p>
      )}

      <p className="mt-3 text-2xs leading-relaxed text-ink-dim">
        Saved as you go. All of it is editable later in Your info.
      </p>
    </div>
  )
}
