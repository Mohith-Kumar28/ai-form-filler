import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { getGetAccountQueryKey } from '../../../generated/endpoints/account/account.js'
import {
  getGetProfileQueryKey,
  usePatchProfile,
} from '../../../generated/endpoints/profile/profile.js'
import type { Profile, ProfileIdentity } from '../../../generated/model/index.js'
import { IDENTITY_FIELDS } from '../../../lib/identity-fields.js'
import { Button, Input, Screen, ScreenBody, ScreenFooter, ScreenHeader } from '../components.js'
import { IconClose, IconPlus } from '../icons.js'

/** Only where the question is genuinely ambiguous. A hint under every field is noise. */
const HINTS: Partial<Record<string, string>> = {
  workAuthorization:
    'How you answer "are you authorised to work here?" — e.g. "UK citizen, no visa needed".',
  preferredName: 'What a form should call you when it is not asking for your legal name.',
}

const LINK_LABEL: Record<string, string> = {
  linkedin: 'LinkedIn',
  github: 'GitHub',
  website: 'Website',
  twitter: 'Twitter',
}

/**
 * A field caption in the document's label register.
 *
 * Set above the control rather than in a left-hand column: the two-column register is the
 * credential's native form, but at 400px a label column leaves about nine characters for a
 * URL. The condensed tracked caps keep the caption in the same voice at a third of the cost.
 */
function DocField({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="border-b border-guilloche-soft px-4 py-2.5">
      <p className="doc-label">{label}</p>
      <div className="mt-1.5">{children}</div>
      {hint && <p className="mt-1.5 text-[11.5px] leading-snug text-ink3">{hint}</p>}
    </div>
  )
}

export function AboutYou({ profile }: { profile: Profile }) {
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState<ProfileIdentity>(profile.identity)
  const [custom, setCustom] = useState<Record<string, string>>(profile.custom ?? {})
  const [newKey, setNewKey] = useState('')
  const [dirty, setDirty] = useState(false)

  // Adding a source can extract identity fields server-side. Adopt them, but never over an
  // edit in progress.
  useEffect(() => {
    if (dirty) return
    setDraft(profile.identity)
    setCustom(profile.custom ?? {})
  }, [profile.identity, profile.custom, dirty])

  /**
   * What was sent, so a save cannot discard what was typed while it was in flight.
   *
   * Clearing `dirty` in `onSuccess` releases the resync effect above, which then overwrites
   * the draft with the server's copy — so anything typed between pressing Save and the
   * response landing used to vanish.
   */
  const submitted = useRef<{ identity: ProfileIdentity; custom: Record<string, string> } | null>(
    null,
  )

  const save = usePatchProfile({
    mutation: {
      onSuccess: (updated) => {
        queryClient.setQueryData(getGetProfileQueryKey(), updated)
        void queryClient.invalidateQueries({ queryKey: getGetAccountQueryKey() })

        const unchanged =
          JSON.stringify(submitted.current) === JSON.stringify({ identity: draft, custom })
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

  const addFact = () => {
    const key = newKey.trim()
    if (!key || key in custom) return
    setDirty(true)
    setCustom((prev) => ({ ...prev, [key]: '' }))
    setNewKey('')
  }

  const linkPlatforms = [
    ...new Set([...Object.keys(draft.links ?? {}), 'linkedin', 'github', 'website']),
  ].sort()

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    submitted.current = { identity: draft, custom }
    save.mutate({ data: { identity: draft, custom } })
  }

  return (
    <Screen>
      <ScreenHeader title="About you" />

      <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
        <ScreenBody>
          <p className="px-4 py-3 text-[12.5px] leading-relaxed text-ink2">
            These answer a form's routine questions outright, with no guessing involved. Everything
            else comes from what you have given it.
          </p>

          <section className="border-t border-guilloche">
            {IDENTITY_FIELDS.map(({ key, label, type }) => (
              <DocField key={key} label={label} hint={HINTS[key]}>
                <Input
                  type={type}
                  aria-label={label}
                  value={(draft[key as keyof ProfileIdentity] as string | undefined) ?? ''}
                  onChange={(event) =>
                    setField(key as keyof ProfileIdentity, event.currentTarget.value)
                  }
                  placeholder="Not recorded"
                />
              </DocField>
            ))}
          </section>

          <section>
            <h2 className="doc-label px-4 pb-1 pt-4">Links</h2>
            {linkPlatforms.map((platform) => (
              <DocField key={platform} label={LINK_LABEL[platform] ?? platform}>
                <Input
                  type="url"
                  inputMode="url"
                  aria-label={LINK_LABEL[platform] ?? platform}
                  value={draft.links?.[platform] ?? ''}
                  onChange={(event) => setLink(platform, event.currentTarget.value)}
                  placeholder="Not recorded"
                />
              </DocField>
            ))}
          </section>

          {/*
            The escape hatch that makes this different from every fixed-schema autofiller:
            visa status, notice period, dietary needs, t-shirt size. Without it an arbitrary
            form question has nowhere to be answered from.
          */}
          <section className="pb-4">
            <h2 className="doc-label px-4 pb-1 pt-4">Your own facts</h2>
            <p className="px-4 pb-2 text-[11.5px] leading-snug text-ink3">
              Anything a form might ask that is not above.
            </p>

            {Object.entries(custom).map(([key, value]) => (
              <DocField key={key} label={key}>
                <div className="flex items-center gap-1.5">
                  <Input
                    aria-label={key}
                    value={value}
                    onChange={(event) => {
                      setDirty(true)
                      setCustom((prev) => ({ ...prev, [key]: event.currentTarget.value }))
                    }}
                    placeholder="Not recorded"
                  />
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
                    className="flex size-7 shrink-0 items-center justify-center rounded-doc text-ink3 transition-colors hover:bg-endorse-wash hover:text-endorse"
                  >
                    <IconClose className="size-3.5" />
                  </button>
                </div>
              </DocField>
            ))}

            <div className="flex gap-1.5 px-4 pt-3">
              <Input
                value={newKey}
                onChange={(event) => setNewKey(event.currentTarget.value)}
                onKeyDown={(event) => {
                  // Enter here would otherwise submit the outer form, saving a half-typed key
                  // with no value against it.
                  if (event.key !== 'Enter') return
                  event.preventDefault()
                  addFact()
                }}
                placeholder="Notice period"
                aria-label="New fact"
              />
              <Button
                size="sm"
                onClick={addFact}
                disabled={!newKey.trim() || newKey.trim() in custom}
                aria-label="Add fact"
                className="shrink-0"
              >
                <IconPlus className="size-3.5" />
                Add
              </Button>
            </div>
          </section>
        </ScreenBody>

        {/* Only present when there is something to save. A permanent bar at 400px is a tax. */}
        {(dirty || save.isError) && (
          <ScreenFooter>
            <div className="flex items-center gap-2.5">
              <Button type="submit" variant="plate" loading={save.isPending} disabled={!dirty}>
                {save.isPending ? 'Saving…' : 'Save'}
              </Button>
              {save.isError && (
                <span className="min-w-0 text-[11.5px] leading-snug text-endorse" role="alert">
                  {save.error.message}
                </span>
              )}
            </div>
          </ScreenFooter>
        )}
      </form>
    </Screen>
  )
}
