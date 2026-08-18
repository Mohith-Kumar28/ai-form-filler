import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import {
  getGetAccountQueryKey,
  useGetAccount,
} from '../../../generated/endpoints/account/account.js'
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
import { openUpgrade } from '../../../lib/billing.js'
import { formatCount, plural } from '../../../lib/format.js'
import { IDENTITY_FIELDS } from '../../../lib/identity-fields.js'
import { faviconUrl, formatBytes, hostnameOf, openSourceInTab } from '../../../lib/source-file.js'
import {
  Button,
  ConfirmSheet,
  EmptyState,
  Input,
  OverflowMenu,
  ProBadge,
  Screen,
  ScreenBody,
  ScreenFooter,
  ScreenHeader,
  SegmentedControl,
  SkeletonRow,
  SUNSET_GRADIENT,
} from '../components.js'
import {
  IconAlert,
  IconAudio,
  IconCheck,
  IconClose,
  IconCrown,
  IconDocument,
  IconImage,
  IconLink,
  IconPlus,
  IconText,
} from '../icons.js'
import { useNavigation } from '../navigation.js'

const SOURCE_LIMITS = { free: 5, pro: 25, ultra: 100 } as const
const FACT_LIMITS = { free: 10, pro: 50, ultra: 200 } as const

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
  const account = useGetAccount()
  const plan = (account.data?.quota.plan ?? 'free') as keyof typeof SOURCE_LIMITS
  const sourceLimit = SOURCE_LIMITS[plan]
  const factLimit = FACT_LIMITS[plan]

  const [tab, setTab] = useState<'facts' | 'sources'>('facts')

  const [identity, setIdentity] = useState<ProfileIdentity>(profile?.identity ?? { links: {} })
  const [facts, setFacts] = useState<Record<string, string>>(profile?.custom ?? {})
  const [newFact, setNewFact] = useState('')
  const [adding, setAdding] = useState(false)
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
  const sourceCount = sources.length
  const factCount =
    Object.keys(facts).length +
    IDENTITY_FIELDS.filter((f) => {
      const val = (identity[f.key as keyof ProfileIdentity] as string | undefined) ?? ''
      return val.trim() !== ''
    }).length +
    Object.keys(identity.links ?? {}).filter((k) => {
      const val = identity.links?.[k] ?? ''
      return val.trim() !== ''
    }).length
  const atSourceLimit = sourceCount >= sourceLimit
  const atFactLimit = factCount >= factLimit

  return (
    <Screen>
      <ScreenHeader
        title="Your info"
        usage={
          account.data
            ? {
                used: account.data.quota.used,
                limit: account.data.quota.limit,
                plan: account.data.quota.plan,
              }
            : undefined
        }
        right={
          <div className="flex items-center gap-1.5">
            {plan !== 'free' && <ProBadge plan={plan} />}
            {tab === 'facts' ? (
              <div className="flex items-center gap-1.5">
                {atFactLimit && plan === 'free' && (
                  <button
                    type="button"
                    onClick={() => void openUpgrade()}
                    className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold text-white transition-[filter] hover:brightness-110"
                    style={{
                      background: SUNSET_GRADIENT,
                    }}
                  >
                    <IconCrown className="size-3" />
                    Upgrade
                  </button>
                )}
                <Button
                  size="sm"
                  variant={adding ? 'primary' : 'secondary'}
                  onClick={() => {
                    setAdding((v) => !v)
                    setNewFact('')
                  }}
                  aria-label="Add a fact"
                >
                  {adding ? <IconCheck className="size-3.5" /> : <IconPlus className="size-3.5" />}
                  {adding ? 'Done' : 'Add'}
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                {atSourceLimit && plan === 'free' && (
                  <button
                    type="button"
                    onClick={() => void openUpgrade()}
                    className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold text-white transition-[filter] hover:brightness-110"
                    style={{
                      background: SUNSET_GRADIENT,
                    }}
                  >
                    <IconCrown className="size-3" />
                    Upgrade
                  </button>
                )}
                <Button
                  size="sm"
                  onClick={() => nav.push({ name: 'addInfo', initial: 'upload' })}
                  aria-label="Add a source"
                >
                  <IconPlus className="size-3.5" />
                  Add
                </Button>
              </div>
            )}
          </div>
        }
      />

      <div className="shrink-0 px-4 py-3">
        <SegmentedControl
          segments={[
            { key: 'facts' as const, label: 'Facts' },
            { key: 'sources' as const, label: 'Sources' },
          ]}
          value={tab}
          onChange={setTab}
          label="What to show"
        />
      </div>

      <ScreenBody className="relative flex flex-col">
        {profile === undefined ? (
          <div role="status" aria-label="Loading sources" aria-busy="true">
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </div>
        ) : tab === 'facts' ? (
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

            {adding && (
              <div className="flex items-center gap-2 border-b border-border-muted px-4 py-2.5">
                <Input
                  autoFocus
                  value={newFact}
                  onChange={(event) => setNewFact(event.currentTarget.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      addFact()
                    }
                    if (event.key === 'Escape') {
                      setAdding(false)
                      setNewFact('')
                    }
                  }}
                  placeholder="e.g. Notice period"
                  aria-label="New fact name"
                />
                <button
                  type="button"
                  onClick={addFact}
                  disabled={!newFact.trim() || newFact.trim() in facts}
                  aria-label="Confirm"
                  className="flex size-8 shrink-0 items-center justify-center rounded-full text-white transition-[filter] hover:brightness-110 active:brightness-95 disabled:pointer-events-none disabled:opacity-45"
                  style={{
                    background: SUNSET_GRADIENT,
                  }}
                >
                  <IconCheck className="size-4" />
                </button>
              </div>
            )}
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
          </>
        ) : sources.length === 0 ? (
          <EmptyState
            title="No sources yet"
            mascot="happy"
            body={
              <>
                Add a résumé, a link, a note, or a voice recording. It reads you out of whatever is
                here.
              </>
            }
            action={
              <Button
                variant="primary"
                onClick={() => nav.push({ name: 'addInfo', initial: 'upload' })}
              >
                Add a source
              </Button>
            }
          />
        ) : (
          <>
            <div className="flex items-center justify-between px-4 py-2">
              <p className="text-[12px] font-semibold uppercase text-ink-dim">
                {`${sources.length} of ${sourceLimit} ${plural(sourceLimit, 'source')}`}
              </p>
              {plan === 'free' && sources.length > 0 && (
                <button
                  type="button"
                  onClick={() => void openUpgrade()}
                  className="text-[11px] font-semibold text-accent hover:underline"
                >
                  Upgrade for more
                </button>
              )}
            </div>
            <div>
              {sources.map((source) => (
                <SourceRow
                  key={source.id}
                  source={source}
                  onRename={(label) => rename.mutate({ id: source.id, data: { label } })}
                  onRemove={() => {
                    setRemoveError(null)
                    setPendingRemoval(source)
                  }}
                />
              ))}
            </div>
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
