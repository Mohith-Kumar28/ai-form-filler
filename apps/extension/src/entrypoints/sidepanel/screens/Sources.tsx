import { PLAN_SOURCE_LIMITS } from '@aff/shared'
import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import {
  getGetAccountQueryKey,
  useGetAccount,
} from '../../../generated/endpoints/account/account.js'
import {
  getGetProfileQueryKey,
  useDeleteSource,
  useRenameSource,
} from '../../../generated/endpoints/profile/profile.js'
import type { Profile, ProfileSourcesItem } from '../../../generated/model/index.js'
import { openUpgrade } from '../../../lib/billing.js'
import { formatCount, plural } from '../../../lib/format.js'
import { faviconUrl, formatBytes, hostnameOf, openSourceInTab } from '../../../lib/source-file.js'
import {
  Button,
  ConfirmSheet,
  EmptyState,
  Input,
  OverflowMenu,
  Screen,
  ScreenBody,
  ScreenHeader,
  SkeletonRow,
  StatusPill,
} from '../components.js'
import {
  IconAlert,
  IconAudio,
  IconCrown,
  IconDocument,
  IconImage,
  IconLink,
  IconPlus,
  IconText,
} from '../icons.js'
import { useNavigation } from '../navigation.js'
import { InfoTabs } from './info-tabs.js'

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

/** Size and reach, once parsing is done. Never the status — that has its own pill now. */
function sourceMeta(source: ProfileSourcesItem): string {
  const parts: string[] = []
  if (source.kind === 'link' && source.url) parts.push(hostnameOf(source.url))
  else {
    parts.push(KIND_NOUN[source.kind] ?? 'Source')
    if (source.sizeBytes) parts.push(formatBytes(source.sizeBytes))
  }
  if (source.extractedChars) parts.push(`${formatCount(source.extractedChars)} characters read`)
  return parts.join(' · ')
}

function SourceGlyph({ source }: { source: ProfileSourcesItem }) {
  const [failed, setFailed] = useState(false)
  const Icon = KIND_ICON[source.kind as keyof typeof KIND_ICON] ?? IconDocument

  if (source.kind === 'link' && source.url && !failed) {
    return (
      <img
        src={faviconUrl(source.url)}
        alt=""
        onError={() => setFailed(true)}
        className="size-5 shrink-0 rounded-md"
      />
    )
  }

  return (
    <Icon
      className={`size-5 shrink-0 ${source.status === 'failed' ? 'text-danger' : 'text-ink-muted'}`}
    />
  )
}

/**
 * One source, as a card.
 *
 * A card rather than a hairline-divided row because a source is a *thing* the user gave us —
 * a file, a page, a recording — and the previous list read as a settings table, with the one
 * fact worth knowing about it (did we manage to read it?) buried as the first clause of a grey
 * metadata string in the same size and colour as the file size.
 */
function SourceCard({
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
      <div className="rounded-2xl border border-accent bg-surface-raised p-3">
        <label htmlFor={`rename-${source.id}`} className="text-sm font-semibold text-ink-muted">
          Name
        </label>
        <Input
          id={`rename-${source.id}`}
          autoFocus
          value={draft}
          onChange={(event) => setDraft(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') commit()
            if (event.key === 'Escape') {
              setDraft(source.label)
              setRenaming(false)
            }
          }}
          className="mt-1.5"
        />
        <div className="mt-3 flex gap-2">
          <Button size="sm" variant="primary" onClick={commit}>
            Save name
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setDraft(source.label)
              setRenaming(false)
            }}
          >
            Cancel
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
    <div className="rounded-2xl border border-border-muted bg-surface-raised transition-colors hover:border-border">
      <div className="flex items-start gap-3 p-3">
        <button
          type="button"
          disabled={busy}
          onClick={
            source.kind === 'link'
              ? () => void openSourceInTab(source)
              : () => nav.push({ name: 'sourceDetail', sourceId: source.id })
          }
          className="flex min-w-0 flex-1 items-start gap-3 text-left"
        >
          <span className="mt-px flex size-5 shrink-0 items-center justify-center">
            <SourceGlyph source={source} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-base font-medium text-ink">{source.label}</span>
            <span className="mt-1 flex flex-wrap items-center gap-1.5">
              {busy ? (
                <StatusPill tone="busy">Reading</StatusPill>
              ) : source.status === 'failed' ? (
                <StatusPill tone="bad">Couldn’t read</StatusPill>
              ) : (
                <StatusPill tone="ready">Ready</StatusPill>
              )}
              <span className="truncate text-xs text-ink-dim">{sourceMeta(source)}</span>
            </span>
          </span>
        </button>
        <OverflowMenu items={items} label={`Actions for ${source.label}`} />
      </div>

      {source.status === 'failed' && source.error && (
        <p className="flex items-start gap-1.5 border-t border-border-muted px-3 py-2.5 text-xs leading-snug text-danger">
          <IconAlert className="mt-px size-3.5 shrink-0" />
          <span>{source.error}</span>
        </p>
      )}
    </div>
  )
}

export function Sources({ profile }: { profile: Profile | undefined }) {
  const nav = useNavigation()
  const queryClient = useQueryClient()
  const account = useGetAccount()
  const plan = (account.data?.quota.plan ?? 'free') as keyof typeof PLAN_SOURCE_LIMITS
  const sourceLimit = PLAN_SOURCE_LIMITS[plan]

  const [pendingRemoval, setPendingRemoval] = useState<ProfileSourcesItem | null>(null)
  const [removeError, setRemoveError] = useState<string | null>(null)

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

  const sources = profile?.sources ?? []
  const ready = sources.filter((source) => source.status === 'ready').length
  const atLimit = sources.length >= sourceLimit

  return (
    <Screen>
      <ScreenHeader
        title="Your info"
        right={<InfoTabs view="sources" />}
        /* The measure on the left, the action on the right — the same row Facts puts them on. */
        search={
          <div className="flex items-center gap-2">
            <p className="min-w-0 flex-1 truncate text-xs text-ink-dim">
              {profile === undefined
                ? ''
                : `${sources.length} of ${sourceLimit} ${plural(sourceLimit, 'source')}${ready > 0 ? ` · ${ready} ready` : ''}`}
            </p>
            <Button
              size="sm"
              variant="primary"
              disabled={atLimit}
              onClick={() => nav.push({ name: 'addInfo', initial: 'upload' })}
            >
              <IconPlus className="size-3.5" />
              Add source
            </Button>
          </div>
        }
      />

      <ScreenBody className="relative">
        {profile === undefined ? (
          <div role="status" aria-busy="true" aria-label="Loading sources">
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </div>
        ) : sources.length === 0 ? (
          <EmptyState
            title="Nothing to read yet"
            mascot="happy"
            body="Add a résumé, a link, a note, or a voice recording. It answers forms out of whatever is here."
            action={
              <Button
                variant="primary"
                onClick={() => nav.push({ name: 'addInfo', initial: 'upload' })}
              >
                <IconPlus className="size-3.5" />
                Add a source
              </Button>
            }
          />
        ) : (
          <div className="flex flex-col gap-2.5 px-gutter py-3">
            {sources.map((source) => (
              <SourceCard
                key={source.id}
                source={source}
                onRename={(label) => rename.mutate({ id: source.id, data: { label } })}
                onRemove={() => {
                  setRemoveError(null)
                  setPendingRemoval(source)
                }}
              />
            ))}

            {atLimit && (
              <div className="rounded-2xl border border-border-muted bg-surface p-3">
                <p className="text-sm font-semibold text-ink">
                  All {sourceLimit} source slots are full
                </p>
                <p className="mt-1 text-xs leading-snug text-ink-muted">
                  Remove one to add another, or move up a plan.
                </p>
                {plan === 'free' && (
                  <Button
                    size="sm"
                    variant="primary"
                    className="mt-2.5"
                    onClick={() => void openUpgrade()}
                  >
                    <IconCrown className="size-3.5" />
                    Upgrade for more
                  </Button>
                )}
              </div>
            )}
          </div>
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
    </Screen>
  )
}
