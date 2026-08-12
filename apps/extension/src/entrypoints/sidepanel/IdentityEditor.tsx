import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import {
  getGetProfileQueryKey,
  usePatchProfile,
} from '../../generated/endpoints/profile/profile.js'
import type { Profile, ProfileIdentity } from '../../generated/model/index.js'
import { IDENTITY_FIELDS } from '../../lib/identity-fields.js'

/**
 * Identity is the tier-0 lookup table — these values answer name/email/phone fields with no
 * model call at all, so getting them right is the biggest cost and accuracy lever there is.
 * Values here are authoritative over anything heuristically extracted from a source.
 */
export function IdentityEditor({ profile }: { profile: Profile }) {
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState<ProfileIdentity>(profile.identity)
  const [dirty, setDirty] = useState(false)

  // Adding a source can extract new identity fields server-side. Adopt them, but never
  // clobber edits the user is in the middle of making.
  useEffect(() => {
    if (!dirty) setDraft(profile.identity)
  }, [profile.identity, dirty])

  const save = usePatchProfile({
    mutation: {
      onSuccess: (updated) => {
        queryClient.setQueryData(getGetProfileQueryKey(), updated)
        void queryClient.invalidateQueries({ queryKey: ['account'] })
        setDirty(false)
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

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        save.mutate({ data: { identity: draft } })
      }}
      className="flex flex-col gap-2"
    >
      {IDENTITY_FIELDS.map(({ key, label, type }) => (
        <label key={key} className="flex flex-col gap-0.5">
          <span className="text-[11px] font-medium text-ink-muted">{label}</span>
          <input
            type={type}
            value={(draft[key as keyof ProfileIdentity] as string | undefined) ?? ''}
            onChange={(e) => setField(key as keyof ProfileIdentity, e.target.value)}
            className="rounded-md border border-line bg-surface-raised px-2.5 py-1.5 text-xs outline-none focus:border-accent"
          />
        </label>
      ))}

      <fieldset className="flex flex-col gap-2">
        <legend className="text-[11px] font-medium text-ink-muted">Links</legend>
        {linkPlatforms.map((platform) => (
          <label key={platform} className="flex items-center gap-2">
            <span className="w-16 shrink-0 text-[11px] capitalize text-ink-muted">{platform}</span>
            <input
              type="url"
              value={draft.links?.[platform] ?? ''}
              onChange={(e) => setLink(platform, e.target.value)}
              className="min-w-0 flex-1 rounded-md border border-line bg-surface-raised px-2.5 py-1.5 text-xs outline-none focus:border-accent"
            />
          </label>
        ))}
      </fieldset>

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={!dirty || save.isPending}
          className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40"
        >
          {save.isPending ? 'Saving…' : 'Save'}
        </button>
        {save.isSuccess && !dirty && <span className="text-xs text-ok">Saved</span>}
        {save.isError && (
          <span className="text-xs text-review" role="alert">
            {save.error.message}
          </span>
        )}
      </div>
    </form>
  )
}
