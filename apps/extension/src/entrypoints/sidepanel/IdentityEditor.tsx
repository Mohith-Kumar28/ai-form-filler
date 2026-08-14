import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { getGetAccountQueryKey } from '../../generated/endpoints/account/account.js'
import {
  getGetProfileQueryKey,
  usePatchProfile,
} from '../../generated/endpoints/profile/profile.js'
import type { LearnedAnswer, Profile, ProfileIdentity } from '../../generated/model/index.js'
import { IDENTITY_FIELDS } from '../../lib/identity-fields.js'

/**
 * The facing page: what the notebook holds as stated, in the user's own hand.
 *
 * Set as a ruled two-column register rather than stacked form cards. These values answer
 * fields with no model call at all, so they are the highest-leverage thing on the surface —
 * the layout says "this is a record you maintain", not "this is a settings screen".
 */
export function IdentityEditor({ profile }: { profile: Profile }) {
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState<ProfileIdentity>(profile.identity)
  const [custom, setCustom] = useState<Record<string, string>>(profile.custom ?? {})
  const [learned, setLearned] = useState<LearnedAnswer[]>(profile.learned ?? [])
  const [newKey, setNewKey] = useState('')
  const [dirty, setDirty] = useState(false)

  // Adding a source can extract new identity fields server-side, and submitting a form adds
  // learned answers. Adopt them, but never clobber an edit in progress.
  useEffect(() => {
    if (dirty) return
    setDraft(profile.identity)
    setCustom(profile.custom ?? {})
    setLearned(profile.learned ?? [])
  }, [profile.identity, profile.custom, profile.learned, dirty])

  /**
   * What was sent, so a save cannot discard what was typed while it was in flight.
   *
   * `onSuccess` cleared `dirty`, which released the resync effect above, which overwrote the
   * draft with the server's copy — so anything typed between pressing Save and the response
   * landing vanished. That is the "I edit a value, hit Save, and it snaps back" report.
   */
  const submitted = useRef<ProfileIdentity | null>(null)

  const save = usePatchProfile({
    mutation: {
      onSuccess: (updated) => {
        queryClient.setQueryData(getGetProfileQueryKey(), updated)
        // The real key is `['/v1/me']`; `['account']` matched nothing, so the header quota
        // and `profileReady` stayed stale until the panel was reopened.
        void queryClient.invalidateQueries({ queryKey: getGetAccountQueryKey() })

        // Still dirty if the user kept typing — only the exact submitted draft is settled.
        const unchanged = JSON.stringify(submitted.current) === JSON.stringify(draft)
        if (unchanged) setDirty(false)
      },
    },
  })

  const setField = (key: keyof ProfileIdentity, value: string) => {
    setDirty(true)
    setDraft((prev) => ({ ...prev, [key]: value }))
  }

  const setLink = (platform: string, value: string) => {
    setDirty(true)
    setDraft((prev) => ({ ...prev, links: { ...prev.links, [platform]: value } }))
  }

  const linkPlatforms = [
    ...new Set([...Object.keys(draft.links ?? {}), 'linkedin', 'github', 'website']),
  ].sort()

  const input =
    'w-full border-0 border-b border-transparent bg-transparent py-1 text-[13px] text-ink outline-none transition-colors placeholder:text-faint hover:border-rule focus:border-pen'

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        submitted.current = draft
        save.mutate({ data: { identity: draft, custom, learned } })
      }}
    >
      <dl>
        {IDENTITY_FIELDS.map(({ key, label, type }) => (
          <div
            key={key}
            className="grid grid-cols-[7.5rem_1fr] items-baseline gap-x-2 border-b border-rule px-4 py-1.5"
          >
            <dt className="text-[11px] text-faint">{label}</dt>
            <dd>
              <input
                type={type}
                aria-label={label}
                value={(draft[key as keyof ProfileIdentity] as string | undefined) ?? ''}
                onChange={(e) => setField(key as keyof ProfileIdentity, e.target.value)}
                placeholder="—"
                className={input}
              />
            </dd>
          </div>
        ))}

        {linkPlatforms.map((platform) => (
          <div
            key={platform}
            className="grid grid-cols-[7.5rem_1fr] items-baseline gap-x-2 border-b border-rule px-4 py-1.5"
          >
            <dt className="text-[11px] capitalize text-faint">{platform}</dt>
            <dd>
              <input
                type="url"
                aria-label={platform}
                value={draft.links?.[platform] ?? ''}
                onChange={(e) => setLink(platform, e.target.value)}
                placeholder="—"
                className={input}
              />
            </dd>
          </div>
        ))}
      </dl>

      {/*
        Anything the fixed schema does not cover — visa status, notice period, dietary
        needs, t-shirt size. Every other autofiller is limited to its own field list, and
        this is the escape hatch that lets an arbitrary form question be answered at all.
      */}
      <section className="border-b border-rule px-4 py-3">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-faint">
          Your own facts
        </h3>
        <p className="mt-0.5 text-[11.5px] text-muted">
          Anything a form might ask that isn't above.
        </p>

        <dl className="mt-2">
          {Object.entries(custom).map(([key, value]) => (
            <div key={key} className="grid grid-cols-[7.5rem_1fr_auto] items-baseline gap-x-2 py-1">
              <dt className="truncate text-[11.5px] text-muted" title={key}>
                {key}
              </dt>
              <dd>
                <input
                  aria-label={key}
                  value={value}
                  onChange={(e) => {
                    setDirty(true)
                    setCustom((prev) => ({ ...prev, [key]: e.target.value }))
                  }}
                  className={input}
                />
              </dd>
              <button
                type="button"
                aria-label={`Remove ${key}`}
                onClick={() => {
                  setDirty(true)
                  setCustom((prev) => {
                    const next = { ...prev }
                    delete next[key]
                    return next
                  })
                }}
                className="rounded-sharp p-1 text-faint transition-colors hover:text-annot"
              >
                <svg
                  viewBox="0 0 16 16"
                  className="size-3"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                >
                  <title>Remove</title>
                  <path d="M4 4l8 8M12 4l-8 8" />
                </svg>
              </button>
            </div>
          ))}
        </dl>

        <div className="mt-1.5 flex gap-1.5">
          <input
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
            onKeyDown={(e) => {
              // Enter inside a nested form would submit the outer form, saving a half-typed
              // key with no value.
              if (e.key !== 'Enter') return
              e.preventDefault()
              const key = newKey.trim()
              if (!key || key in custom) return
              setDirty(true)
              setCustom((prev) => ({ ...prev, [key]: '' }))
              setNewKey('')
            }}
            placeholder="Add a fact — e.g. Notice period"
            className="min-w-0 flex-1 rounded-sharp border border-rule bg-page px-2.5 py-1.5 text-[12px] text-ink outline-none placeholder:text-faint focus:border-pen"
          />
          <button
            type="button"
            disabled={!newKey.trim() || newKey.trim() in custom}
            onClick={() => {
              const key = newKey.trim()
              setDirty(true)
              setCustom((prev) => ({ ...prev, [key]: '' }))
              setNewKey('')
            }}
            className="shrink-0 rounded-sharp border border-rule px-2.5 text-[12px] text-muted transition-colors hover:border-pen hover:text-pen disabled:opacity-40"
          >
            Add
          </button>
        </div>
      </section>

      {/*
        The verso page: what the notebook wrote down by watching.

        Shown for the same reason the facing page is editable — these answers ride in every
        prompt, so one that is wrong is wrong on every future form. A memory the user cannot
        read or correct is not a memory, it is a liability. Newest first: the answer just
        learned is the one someone comes here to check.
      */}
      {learned.length > 0 && (
        <section className="border-b border-rule px-4 py-3">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-faint">
            Learned from your forms
          </h3>
          <p className="mt-0.5 text-[11.5px] text-muted">
            Answers you gave, reused when a form asks again.
          </p>

          <dl className="mt-2">
            {[...learned].reverse().map((entry) => (
              <div
                key={entry.question}
                className="grid grid-cols-[1fr_auto] items-baseline gap-x-2 py-1"
              >
                <dt
                  className="col-span-2 truncate text-[11px] text-faint"
                  title={entry.origin ? `Learned on ${entry.origin}` : entry.question}
                >
                  {entry.question}
                </dt>
                <dd>
                  <input
                    aria-label={entry.question}
                    value={entry.answer}
                    onChange={(e) => {
                      setDirty(true)
                      setLearned((prev) =>
                        prev.map((row) =>
                          row.question === entry.question
                            ? { ...row, answer: e.target.value }
                            : row,
                        ),
                      )
                    }}
                    className={input}
                  />
                </dd>
                <button
                  type="button"
                  aria-label={`Forget ${entry.question}`}
                  onClick={() => {
                    setDirty(true)
                    setLearned((prev) => prev.filter((row) => row.question !== entry.question))
                  }}
                  className="rounded-sharp p-1 text-faint transition-colors hover:text-annot"
                >
                  <svg
                    viewBox="0 0 16 16"
                    className="size-3"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  >
                    <title>Forget</title>
                    <path d="M4 4l8 8M12 4l-8 8" />
                  </svg>
                </button>
              </div>
            ))}
          </dl>
        </section>
      )}

      <div className="sticky bottom-0 flex items-center gap-2 border-t border-rule bg-page px-4 py-2">
        <button
          type="submit"
          disabled={!dirty || save.isPending}
          className="rounded-sharp border border-pen px-3 py-1 text-[12px] font-medium text-pen transition-colors hover:bg-pen-wash disabled:border-rule disabled:text-faint"
        >
          {save.isPending ? 'Saving…' : 'Save'}
        </button>
        {save.isSuccess && !dirty && <span className="text-[11px] text-verified">Saved</span>}
        {save.isError && (
          <span className="text-[11px] text-annot" role="alert">
            {save.error.message}
          </span>
        )}
      </div>
    </form>
  )
}
