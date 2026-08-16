import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { getGetAccountQueryKey } from '../../../generated/endpoints/account/account.js'
import {
  getGetProfileQueryKey,
  useDeleteSource,
  usePatchProfile,
  useRenameSource,
} from '../../../generated/endpoints/profile/profile.js'
import type {
  Profile,
  ProfileIdentity,
  ProfileSourcesItem,
} from '../../../generated/model/index.js'
import { formatCount, plural } from '../../../lib/format.js'
import { IDENTITY_FIELDS } from '../../../lib/identity-fields.js'
import { faviconUrl, formatBytes, hostnameOf, openSourceInTab } from '../../../lib/source-file.js'
import {
  Button,
  ConfirmSheet,
  EmptyState,
  Input,
  OverflowMenu,
  Screen,
  ScreenBody,
  ScreenFooter,
  ScreenHeader,
  SkeletonRow,
} from '../components.js'
import {
  IconAlert,
  IconAudio,
  IconClose,
  IconDocument,
  IconImage,
  IconLink,
  IconPlus,
  IconText,
} from '../icons.js'
import { useNavigation } from '../navigation.js'

const KIND_ICON = {
  document: IconDocument,
  link: IconLink,
  text: IconText,
  image: IconImage,
  audio: IconAudio,
} as const

const KIND_NOUN: Record<string, string> = {
  document: 'Document',
  link: 'Link',
  text: 'Note',
  image: 'Image',
  audio: 'Voice note',
}

const LINK_LABEL: Record<string, string> = {
  linkedin: 'LinkedIn',
  github: 'GitHub',
  website: 'Website',
  twitter: 'Twitter',
}

const HINTS: Partial<Record<string, string>> = {
  workAuthorization: 'How you answer "are you authorised to work here?"',
  preferredName: 'What a form should call you when it is not asking for your legal name.',
}

function sourceDetail(source: ProfileSourcesItem): string {
  if (source.status === 'pending' || source.status === 'parsing') return 'Reading…'
  if (source.status === 'failed') return 'Could not be read'

  const parts: string[] = []
  if (source.kind === 'link' && source.url) parts.push(hostnameOf(source.url))
  else {
    parts.push(KIND_NOUN[source.kind] ?? 'Source')
    if (source.sizeBytes) parts.push(formatBytes(source.sizeBytes))
  }
  if (source.extractedChars) parts.push(`${formatCount(source.extractedChars)} characters read`)
  return parts.join(' · ')
}

/* ── Fact row ─────────────────────────────────────────────────────────────── */

function FactRow({
  label,
  hint,
  value,
  type = 'text',
  onChange,
  onRemove,
}: {
  label: string
  hint?: string
  value: string
  type?: string
  onChange: (next: string) => void
  onRemove?: () => void
}) {
  return (
    <div className="border-b border-border-muted px-4 py-3">
      <div className="flex items-center gap-2">
        <p className="min-w-0 flex-1 text-[12px] font-semibold text-ink-muted">{label}</p>
        {onRemove && (
          <button
            type="button"
            aria-label={`Remove ${label}`}
            onClick={onRemove}
            className="flex size-5 shrink-0 items-center justify-center rounded-full text-ink-dim transition-colors hover:bg-danger-muted hover:text-danger"
          >
            <IconClose className="size-3" />
          </button>
        )}
      </div>
      <Input
        type={type}
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
        placeholder="Not recorded"
        className="mt-1.5"
      />
      {hint && <p className="mt-1.5 text-[12px] text-ink-dim">{hint}</p>}
    </div>
  )
}

/* ── Source row ───────────────────────────────────────────────────────────── */

function SourceGlyph({ source }: { source: ProfileSourcesItem }) {
  const [failed, setFailed] = useState(false)
  const Icon = KIND_ICON[source.kind as keyof typeof KIND_ICON] ?? IconDocument

  if (source.kind === 'link' && source.url && !failed) {
    return (
      <img
        src={faviconUrl(source.url)}
        alt=""
        onError={() => setFailed(true)}
        className="size-4 shrink-0 rounded-full"
      />
    )
  }

  return (
    <Icon
      className={`size-4 shrink-0 ${source.status === 'failed' ? 'text-danger' : 'text-ink-dim'}`}
    />
  )
}

function SourceRow({
  source,
  onRemove,
  onRename,
}: {
  source: ProfileSourcesItem
  index: number
  onRemove: () => void
  onRename: (label: string) => void
}) {
  const nav = useNavigation()
  const [renaming, setRenaming] = useState(false)
  const [draft, setDraft] = useState(source.label)
  const busy = source.status === 'pending' || source.status === 'parsing'

  const commit = () => {
    const next = draft.trim()
    setRenaming(false)
    if (next && next !== source.label) onRename(next)
    else setDraft(source.label)
  }

  if (renaming) {
    return (
      <div className="border-b border-border-muted px-4 py-3">
        <p className="text-[12px] font-semibold text-ink-muted">Name</p>
        <div className="mt-1.5 flex items-center gap-1.5">
          <Input
            autoFocus
            aria-label="Name"
            value={draft}
            onChange={(event) => setDraft(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') commit()
              if (event.key === 'Escape') {
                setDraft(source.label)
                setRenaming(false)
              }
            }}
          />
          <Button size="sm" variant="primary" onClick={commit} className="shrink-0">
            Save
          </Button>
        </div>
      </div>
    )
  }

  const items = [
    { label: 'Rename', onSelect: () => setRenaming(true) },
    ...(source.kind === 'link'
      ? [{ label: 'Open link', onSelect: () => void openSourceInTab(source) }]
      : [
          {
            label: 'Preview',
            onSelect: () => nav.push({ name: 'sourceDetail', sourceId: source.id }),
          },
          ...(source.hasFile
            ? [{ label: 'Open in a tab', onSelect: () => void openSourceInTab(source) }]
            : []),
        ]),
    { label: 'Remove', onSelect: onRemove, tone: 'danger' as const },
  ]

  return (
    <div className="border-b border-border-muted">
      <div className="flex items-start gap-2.5 pr-1.5 transition-colors hover:bg-surface-muted">
        <button
          type="button"
          onClick={
            busy
              ? undefined
              : source.kind === 'link'
                ? () => void openSourceInTab(source)
                : () => nav.push({ name: 'sourceDetail', sourceId: source.id })
          }
          disabled={busy}
          className="flex min-w-0 flex-1 items-start gap-2.5 py-3 pl-4 text-left"
        >
          <span className="mt-px flex size-4 shrink-0 items-center justify-center">
            <SourceGlyph source={source} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[14px] text-ink">{source.label}</span>
            <span
              className={`mt-0.5 block truncate text-[12px] ${source.status === 'failed' ? 'text-danger' : 'text-ink-dim'}`}
            >
              {sourceDetail(source)}
            </span>
          </span>
        </button>
        <span className="py-2.5">
          <OverflowMenu items={items} label={`Actions for ${source.label}`} />
        </span>
      </div>

      {source.status === 'failed' && source.error && (
        <p className="flex items-start gap-1.5 px-4 pb-3 text-[12px] leading-snug text-danger">
          <IconAlert className="mt-px size-3.5 shrink-0" />
          <span>{source.error}</span>
        </p>
      )}
    </div>
  )
}

/* ── The screen ───────────────────────────────────────────────────────────── */

export function Sources({ profile }: { profile: Profile | undefined }) {
  const nav = useNavigation()
  const queryClient = useQueryClient()

  const [identity, setIdentity] = useState<ProfileIdentity>(profile?.identity ?? { links: {} })
  const [facts, setFacts] = useState<Record<string, string>>(profile?.custom ?? {})
  const [newFact, setNewFact] = useState('')
  const [dirty, setDirty] = useState(false)
  const [pendingRemoval, setPendingRemoval] = useState<ProfileSourcesItem | null>(null)
  const [removeError, setRemoveError] = useState<string | null>(null)

  useEffect(() => {
    if (dirty || !profile) return
    setIdentity(profile.identity)
    setFacts(profile.custom ?? {})
  }, [profile, dirty])

  const submitted = useRef<string | null>(null)

  const save = usePatchProfile({
    mutation: {
      onSuccess: (updated) => {
        queryClient.setQueryData(getGetProfileQueryKey(), updated)
        void queryClient.invalidateQueries({ queryKey: getGetAccountQueryKey() })
        if (submitted.current === JSON.stringify({ identity, custom: facts })) setDirty(false)
      },
    },
  })

  const rename = useRenameSource({
    mutation: {
      onSuccess: (updated) => queryClient.setQueryData(getGetProfileQueryKey(), updated),
    },
  })

  const remove = useDeleteSource({
    mutation: {
      onSuccess: (updated) => {
        queryClient.setQueryData(getGetProfileQueryKey(), updated)
        void queryClient.invalidateQueries({ queryKey: getGetAccountQueryKey() })
        setPendingRemoval(null)
        setRemoveError(null)
      },
      onError: (error) => setRemoveError(error.message),
    },
  })

  const setField = (key: keyof ProfileIdentity, value: string) => {
    setDirty(true)
    setIdentity((prev) => ({ ...prev, [key]: value }))
  }

  const setLink = (platform: string, value: string) => {
    setDirty(true)
    setIdentity((prev) => ({ ...prev, links: { ...prev.links, [platform]: value } }))
  }

  const addFact = () => {
    const key = newFact.trim()
    if (!key || key in facts) return
    setDirty(true)
    setFacts((prev) => ({ ...prev, [key]: '' }))
    setNewFact('')
  }

  const linkPlatforms = [
    ...new Set([...Object.keys(identity.links ?? {}), 'linkedin', 'github', 'website']),
  ].sort()

  const sources = profile?.sources ?? []
  const nothingYet = profile !== undefined && sources.length === 0 && !profile.identity.fullName

  return (
    <Screen>
      <ScreenHeader
        title="What it knows"
        right={
          <Button
            size="sm"
            onClick={() => nav.push({ name: 'addSource' })}
            aria-label="Add a source"
          >
            <IconPlus className="size-3.5" />
            Add
          </Button>
        }
      />

      <ScreenBody className="relative flex flex-col">
        {profile === undefined ? (
          <div role="status" aria-label="Loading sources" aria-busy="true">
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </div>
        ) : nothingYet ? (
          <EmptyState
            title="Nothing on file yet"
            mascot="happy"
            body={
              <>
                Give it a résumé, a link to your site, or a few facts about yourself. It answers
                forms from whatever is here — the more it knows, the less it has to guess.
              </>
            }
            action={
              <Button variant="primary" onClick={() => nav.push({ name: 'addSource' })}>
                Add the first one
              </Button>
            }
          />
        ) : (
          <>
            <p className="px-4 py-2 text-[12px] font-semibold uppercase text-ink-dim">About you</p>
            {IDENTITY_FIELDS.map(({ key, label, type }) => (
              <FactRow
                key={key}
                label={label}
                type={type}
                hint={HINTS[key]}
                value={(identity[key as keyof ProfileIdentity] as string | undefined) ?? ''}
                onChange={(next) => setField(key as keyof ProfileIdentity, next)}
              />
            ))}
            {linkPlatforms.map((platform) => (
              <FactRow
                key={platform}
                label={LINK_LABEL[platform] ?? platform}
                type="url"
                value={identity.links?.[platform] ?? ''}
                onChange={(next) => setLink(platform, next)}
              />
            ))}

            <p className="mt-3 px-4 py-2 text-[12px] font-semibold uppercase text-ink-dim">Facts</p>
            {Object.entries(facts).map(([key, value]) => (
              <FactRow
                key={key}
                label={key}
                value={value}
                onChange={(next) => {
                  setDirty(true)
                  setFacts((prev) => ({ ...prev, [key]: next }))
                }}
                onRemove={() => {
                  setDirty(true)
                  setFacts((prev) => {
                    const next = { ...prev }
                    delete next[key]
                    return next
                  })
                }}
              />
            ))}
            <div className="flex gap-1.5 border-b border-border-muted px-4 py-3">
              <Input
                value={newFact}
                onChange={(event) => setNewFact(event.currentTarget.value)}
                onKeyDown={(event) => {
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
                disabled={!newFact.trim() || newFact.trim() in facts}
              >
                <IconPlus className="size-3.5" />
                Add
              </Button>
            </div>

            <p className="px-4 py-2 text-[12px] font-semibold uppercase text-ink-dim">
              {sources.length === 0
                ? 'Documents'
                : `${sources.length} ${plural(sources.length, 'document')}`}
            </p>
            {sources.length === 0 ? (
              <p className="border-b border-border-muted px-4 py-3 text-[13px] leading-relaxed text-ink-muted">
                A résumé, a link to your site, a voice note — anything it can read you out of.
              </p>
            ) : (
              <div>
                {sources.map((source, i) => (
                  <SourceRow
                    key={source.id}
                    source={source}
                    index={Math.min(i, 8)}
                    onRename={(label) => rename.mutate({ id: source.id, data: { label } })}
                    onRemove={() => {
                      setRemoveError(null)
                      setPendingRemoval(source)
                    }}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {pendingRemoval && (
          <ConfirmSheet
            title={`Remove ${pendingRemoval.label}?`}
            body={
              <>
                This deletes the stored copy and everything the tool remembers from it. Answers it
                has already written stay where they are. This cannot be undone.
              </>
            }
            confirmLabel="Remove"
            pending={remove.isPending}
            error={removeError ?? undefined}
            onConfirm={() => remove.mutate({ id: pendingRemoval.id })}
            onCancel={() => {
              setPendingRemoval(null)
              setRemoveError(null)
            }}
          />
        )}
      </ScreenBody>

      {(dirty || save.isError) && (
        <ScreenFooter>
          <div className="flex items-center gap-2.5">
            <Button
              variant="primary"
              loading={save.isPending}
              disabled={!dirty}
              onClick={() => {
                submitted.current = JSON.stringify({ identity, custom: facts })
                save.mutate({ data: { identity, custom: facts } })
              }}
            >
              {save.isPending ? 'Saving…' : 'Save'}
            </Button>
            {save.isError && (
              <span className="min-w-0 text-[12px] leading-snug text-danger" role="alert">
                {save.error.message}
              </span>
            )}
          </div>
        </ScreenFooter>
      )}
    </Screen>
  )
}
