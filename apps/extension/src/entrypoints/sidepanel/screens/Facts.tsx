import { PLAN_FACT_LIMITS } from '@aff/shared'
import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  getGetAccountQueryKey,
  useGetAccount,
} from '../../../generated/endpoints/account/account.js'
import {
  getGetProfileQueryKey,
  usePatchProfile,
} from '../../../generated/endpoints/profile/profile.js'
import type { Profile } from '../../../generated/model/index.js'
import { openTrial, openUpgrade } from '../../../lib/billing.js'
import type { CatalogField, FactSection, ReconciledProfile } from '../../../lib/fact-catalog.js'
import {
  customFactCount,
  FIELDS_BY_SECTION,
  fieldFor,
  reconcile,
  SECTIONS,
  sectionProgress,
  toPatch,
} from '../../../lib/fact-catalog.js'
import { usePaywallSeen } from '../../../lib/paywall.js'
import {
  AddFactForm,
  Button,
  FieldRow,
  SaveState,
  type SaveStatus,
  Screen,
  ScreenBody,
  ScreenHeader,
  SearchInput,
  Section,
  SkeletonRow,
} from '../components.js'
import { IconCrown, IconPlus } from '../icons.js'
import { InfoTabs } from './info-tabs.js'

/**
 * How long after the last keystroke a field settles and saves. Blur still saves immediately.
 *
 * 800ms is inside the rhythm of ordinary typing — a pause to think mid-sentence beats it — so
 * filling in one address fired a PATCH every few words, each one a round trip that rewrites the
 * whole profile. Two seconds sits past the gaps in typing and well short of the point where a
 * save feels unreliable, and nothing is at risk in between: leaving the field commits at once,
 * and so does leaving the screen.
 */
const SETTLE_MS = 2000

/** How long "Saved" stays up before the header goes quiet again. */
const SAVED_MS = 1600

const EMPTY: ReconciledProfile = {
  values: {},
  extras: {},
  extraLinks: {},
  droppedLinks: [],
  merged: [],
}

function matches(query: string, ...haystack: string[]): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return haystack.some((text) => text.toLowerCase().includes(q))
}

/** Extra links keep the key the platform was stored under, title-cased for display. */
function linkLabel(key: string): string {
  return key.charAt(0).toUpperCase() + key.slice(1)
}

export function Facts({ profile }: { profile: Profile | undefined }) {
  const queryClient = useQueryClient()
  const account = useGetAccount()
  const plan = (account.data?.quota.plan ?? 'free') as keyof typeof PLAN_FACT_LIMITS
  const { markSeen } = usePaywallSeen()
  const factLimit = PLAN_FACT_LIMITS[plan]

  const [draft, setDraft] = useState<ReconciledProfile>(EMPTY)
  const [query, setQuery] = useState('')
  const [adding, setAdding] = useState(false)
  const [status, setStatus] = useState<SaveStatus>('idle')
  const [saveError, setSaveError] = useState<string | undefined>()

  /*
    Save coalescing.

    `pending` holds the newest draft while a request is in flight; when that request lands, the
    pending one goes out. Without it a fast typist queues one PATCH per keystroke, each of which
    recompiles the prompt document server-side.
  */
  const inFlight = useRef(false)
  const pending = useRef<ReconciledProfile | null>(null)
  const settleTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const savedTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  /**
   * Set on the first edit and cleared **only by a save that succeeded**.
   *
   * Clearing it on settle instead lost work: the next render re-ran the adopt-from-server
   * effect, found the draft clean, and replaced everything the user had typed with the stored
   * copy the failed save never reached. A failed save has to leave the draft alone so Retry has
   * something to send.
   */
  const dirty = useRef(false)
  /** Whether the server copy has been taken once. After that, only a save may replace it. */
  const hydrated = useRef(false)

  const patch = usePatchProfile()

  /*
    `mutateAsync` off a ref rather than the hook's `mutate`.

    `usePatchProfile` returns a new object on every state transition, so a `useCallback` that
    closes over it changes identity mid-save — which re-ran the effect below at exactly the
    wrong moment. The ref keeps `flush` stable for the life of the screen.
  */
  const mutateRef = useRef(patch.mutateAsync)
  mutateRef.current = patch.mutateAsync

  const flush = useCallback(
    (next: ReconciledProfile) => {
      if (inFlight.current) {
        pending.current = next
        return
      }
      inFlight.current = true
      setStatus('saving')
      setSaveError(undefined)

      mutateRef
        .current({ data: toPatch(next) })
        .then((updated) => {
          queryClient.setQueryData(getGetProfileQueryKey(), updated)
          void queryClient.invalidateQueries({ queryKey: getGetAccountQueryKey() })
          dirty.current = false
          setStatus('saved')
        })
        .catch((error: Error) => {
          setStatus('error')
          setSaveError(error.message)
        })
        .finally(() => {
          inFlight.current = false
          const queued = pending.current
          pending.current = null
          if (queued) flush(queued)
        })
    },
    [queryClient],
  )

  // "Saved" is a receipt, not a state — it goes away on its own.
  useEffect(() => {
    if (status !== 'saved') return
    savedTimer.current = setTimeout(() => setStatus('idle'), SAVED_MS)
    return () => clearTimeout(savedTimer.current)
  }, [status])

  useEffect(() => () => clearTimeout(settleTimer.current), [])

  /*
    Take the server's copy once, and after that only when a save has landed.

    This is also where an already-duplicated profile gets repaired: `reconcile` folds the variant
    spellings, and the fold is written back immediately so the duplicates stop reaching the model
    as conflicting lines.
  */
  useEffect(() => {
    if (!profile) return
    if (hydrated.current && (dirty.current || inFlight.current)) return
    hydrated.current = true

    const next = reconcile(profile)
    setDraft(next)
    // Repaired silently. `merged` is still returned for tests and for the debug log.
    if (next.merged.length > 0) {
      console.debug('[aff] folded duplicate fields', next.merged)
      dirty.current = true
      flush(next)
    }
  }, [profile, flush])

  /*
    One edit.

    The state updater is pure and the bookkeeping sits outside it: React invokes updaters twice
    in development, so a timer scheduled inside one is scheduled twice and cleared once.
  */
  const edit = (mutate: (current: ReconciledProfile) => ReconciledProfile) => {
    const next = mutate(draft)
    setDraft(next)
    dirty.current = true
    clearTimeout(settleTimer.current)
    settleTimer.current = setTimeout(() => flush(next), SETTLE_MS)
  }

  /** Blur, or Enter: settle now rather than waiting out the debounce. */
  const commit = () => {
    if (!dirty.current) return
    clearTimeout(settleTimer.current)
    flush(draft)
  }

  const setValue = (key: string, value: string) =>
    edit((current) => ({ ...current, values: { ...current.values, [key]: value } }))

  const setExtra = (key: string, value: string) =>
    edit((current) => ({ ...current, extras: { ...current.extras, [key]: value } }))

  const setExtraLink = (key: string, value: string) =>
    edit((current) => ({ ...current, extraLinks: { ...current.extraLinks, [key]: value } }))

  const removeExtra = (key: string) =>
    edit((current) => {
      const extras = { ...current.extras }
      delete extras[key]
      return { ...current, extras }
    })

  const removeExtraLink = (key: string) =>
    edit((current) => {
      const extraLinks = { ...current.extraLinks }
      // An empty string is how a link is cleared server-side; deleting the key locally would
      // simply leave the stored one behind.
      extraLinks[key] = ''
      return { ...current, extraLinks }
    })

  const usedFacts = customFactCount(draft)
  const atLimit = usedFacts >= factLimit

  /*
    Section open state.

    A section the user shut stays shut, except while searching — a result inside a collapsed
    section is a result nobody can see. An empty profile opens everything, because a new person
    needs to see what there is to fill rather than six closed doors.
  */
  const [manualOpen, setManualOpen] = useState<Partial<Record<FactSection, boolean>>>({})

  const visible = useMemo(() => {
    const out: Record<string, CatalogField[]> = {}
    for (const section of SECTIONS) {
      if (section.section === 'extra') continue
      out[section.section] = FIELDS_BY_SECTION[section.section].filter((field) =>
        matches(query, field.label, field.key, ...(field.aliases ?? [])),
      )
    }
    return out
  }, [query])

  const visibleExtras = Object.keys(draft.extras).filter((key) =>
    matches(query, key, draft.extras[key] ?? ''),
  )
  const visibleExtraLinks = Object.keys(draft.extraLinks).filter((key) => matches(query, key))

  /**
   * Shut, unless the person opened it or is searching.
   *
   * Nothing is open on arrival — not even the first section. Six titles with a filled count each
   * is the whole map of what is stored, on one screen, with no scrolling; opening one by default
   * pushed the rest below the fold and made the map the thing you had to scroll to find.
   * Searching overrides it, because a result inside a shut section is a result nobody can see.
   */
  const isOpen = (section: FactSection, hasMatches: boolean) => {
    if (query.trim()) return hasMatches
    return manualOpen[section] === true
  }

  /** Refuses a name that already exists — and says where it already is. */
  const validateNewFact = (name: string): string | null => {
    const known = fieldFor(name)
    if (known) {
      const section = SECTIONS.find((s) => s.section === known.section)
      return `That is already the "${known.label}" field, under ${section?.title ?? 'another section'}.`
    }
    const clash = Object.keys(draft.extras).find(
      (key) => key.trim().toLowerCase() === name.trim().toLowerCase(),
    )
    if (clash) return `You already have a field called "${clash}".`
    return null
  }

  const addFact = (name: string, value: string) => {
    setAdding(false)
    setExtra(name, value)
  }

  if (profile === undefined) {
    return (
      <Screen>
        <ScreenHeader
          title="Your info"
          right={<InfoTabs view="facts" />}
          /*
            The loading header keeps the second row, empty.

            Dropping it made the header 52px shorter while the profile was in flight and then
            taller the instant it landed — the same jolt as the tab switch, just earlier. An empty
            row of the right height costs nothing and holds the screen still.
          */
          search={<span />}
        />
        <ScreenBody role="status" aria-busy="true" aria-label="Loading your info">
          <div className="px-gutter py-3">
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </div>
        </ScreenBody>
      </Screen>
    )
  }

  return (
    <Screen>
      <ScreenHeader
        title="Your info"
        right={
          <div className="flex items-center gap-2">
            <SaveState status={status} error={saveError} onRetry={() => flush(draft)} />
            <InfoTabs view="facts" />
          </div>
        }
        /*
          Search and the action share one row, right-aligned.

          Adding a fact used to be a button at the bottom of the last collapsed section — which
          meant scrolling past six sections and opening one to reach the most common thing
          somebody comes here to do. It is now in the same place on both halves of this screen.
        */
        search={
          <div className="flex items-center gap-2">
            <SearchInput
              value={query}
              onChange={setQuery}
              label="Search your info"
              placeholder="Search"
              // Grows, so the action beside it lands on the same right edge as the tabs above.
              className="min-w-0 flex-1"
            />
            <Button
              size="sm"
              variant={adding ? 'secondary' : 'primary'}
              onClick={() => setAdding((v) => !v)}
            >
              <IconPlus className="size-3.5" />
              Add fact
            </Button>
          </div>
        }
      />

      <ScreenBody className="flex flex-col gap-2.5 px-gutter py-3">
        {/*
          There is no "merged N duplicate fields" banner here any more.

          It reported an internal repair: the ingest pass takes a link's platform name as a bare
          string from a model, so `"LinkedIn"` could land beside `"linkedin"` and become two rows.
          Folding them is right; telling the user is not. It is our extraction artefact, they never
          asked for it, and the only action offered was "OK" — an alert whose entire content is that
          something they did not do has been undone.

          It was also permanent. `identity.links` is merged key by key on the server, so the fold
          could never delete the variant and the same notice appeared on every single open. That is
          fixed in `toPatch`, which now sends the explicit deletion; this just stops narrating it.
        */}
        {/* The new fact appears here, directly under the button that asked for it. */}
        {adding &&
          (atLimit ? (
            <div className="rounded-2xl border border-border bg-surface-raised p-4">
              <p className="text-sm font-semibold text-ink">
                {usedFacts} of {factLimit} extra fields used
              </p>
              <p className="mt-1 text-xs leading-snug text-ink-muted">
                {plan === 'free'
                  ? `The free trial raises this to ${PLAN_FACT_LIMITS.pro}.`
                  : 'Remove one to add another, or move up a plan.'}
              </p>
              <Button
                variant="primary"
                size="sm"
                className="mt-2.5"
                onClick={() => {
                  markSeen()
                  void (plan === 'free' ? openTrial() : openUpgrade())
                }}
              >
                <IconCrown className="size-3.5" />
                {plan === 'free' ? 'Start free trial' : 'Compare plans'}
              </Button>
            </div>
          ) : (
            <AddFactForm
              onAdd={addFact}
              onCancel={() => setAdding(false)}
              validate={validateNewFact}
            />
          ))}

        {SECTIONS.map((section) => {
          if (section.section === 'extra') return null
          const fields = visible[section.section] ?? []
          const extraLinkRows = section.section === 'links' ? visibleExtraLinks : []
          const hasMatches = fields.length > 0 || extraLinkRows.length > 0
          if (query.trim() && !hasMatches) return null

          return (
            <Section
              key={section.section}
              title={section.title}
              count={sectionProgress(section.section, draft)}
              open={isOpen(section.section, hasMatches)}
              onToggle={(open) =>
                setManualOpen((current) => ({ ...current, [section.section]: open }))
              }
            >
              {fields.map((field) => (
                <FieldRow
                  key={field.key}
                  label={field.label}
                  hint={field.hint}
                  type={field.type}
                  placeholder={field.placeholder}
                  sensitive={field.sensitive}
                  value={draft.values[field.key] ?? ''}
                  onChange={(next) => setValue(field.key, next)}
                  onCommit={commit}
                />
              ))}

              {/* Platforms the ingest pass invented. Editable, so they can be cleared. */}
              {extraLinkRows.map((key) => (
                <FieldRow
                  key={key}
                  label={linkLabel(key)}
                  type="url"
                  value={draft.extraLinks[key] ?? ''}
                  onChange={(next) => setExtraLink(key, next)}
                  onCommit={commit}
                  onRemove={() => removeExtraLink(key)}
                />
              ))}
            </Section>
          )
        })}

        {/* Extra fields: the user's own, kept apart from everything the catalogue knows. */}
        {(!query.trim() || visibleExtras.length > 0) && (
          <Section
            title="Extra fields"
            count={sectionProgress('extra', draft)}
            open={isOpen('extra', visibleExtras.length > 0)}
            onToggle={(open) => setManualOpen((current) => ({ ...current, extra: open }))}
          >
            {visibleExtras.map((key) => (
              <FieldRow
                key={key}
                label={key}
                value={draft.extras[key] ?? ''}
                onChange={(next) => setExtra(key, next)}
                onCommit={commit}
                onRemove={() => removeExtra(key)}
              />
            ))}

            {visibleExtras.length === 0 && (
              <p className="col-span-full py-2 text-sm text-ink-dim">
                Nothing here yet. Use Add fact.
              </p>
            )}
          </Section>
        )}

        {query.trim() &&
          visibleExtras.length === 0 &&
          SECTIONS.every(
            (s) => s.section === 'extra' || (visible[s.section] ?? []).length === 0,
          ) && (
            <p className="px-gutter py-8 text-center text-sm text-ink-muted">
              Nothing matches “{query.trim()}”. Add it as an extra field.
            </p>
          )}
      </ScreenBody>
    </Screen>
  )
}
