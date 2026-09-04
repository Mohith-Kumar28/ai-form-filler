import { PLAN_SOURCE_LIMITS } from '@aff/shared'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import {
  getGetAccountQueryKey,
  useGetAccount,
} from '../../../generated/endpoints/account/account.js'
import {
  getGetProfileQueryKey,
  useDeleteSource,
  useRenameSource,
  useReprocessSource,
} from '../../../generated/endpoints/profile/profile.js'
import type { Profile, ProfileSourcesItem } from '../../../generated/model/index.js'
import { openTrial, openUpgrade } from '../../../lib/billing.js'
import { formatAddedOn, formatCount, plural } from '../../../lib/format.js'
import { usePaywallSeen } from '../../../lib/paywall.js'
import {
  faviconUrl,
  formatBytes,
  hostnameOf,
  loadSourceFile,
  openSourceInTab,
} from '../../../lib/source-file.js'
import {
  Button,
  Card,
  ConfirmSheet,
  EmptyState,
  ErrorNote,
  Input,
  ListCard,
  OverflowMenu,
  Screen,
  ScreenBody,
  ScreenHeader,
  SkeletonRow,
  StatusPill,
} from '../components.js'
import { IconAlert, IconPlus, IconRefresh } from '../icons.js'
import { useNavigation } from '../navigation.js'
import { InfoTabs } from './info-tabs.js'

/**
 * The extension, upper-cased, as a label for the tile.
 *
 * Derived from the media type rather than the file name because a name is whatever the user typed
 * after renaming, and by then it has no extension at all.
 */
function formatLabel(source: ProfileSourcesItem): string {
  if (source.kind === 'link') return 'LINK'
  if (source.kind === 'text') return 'NOTE'
  const subtype = source.mediaType?.split('/')[1] ?? ''
  if (!subtype) return source.kind === 'audio' ? 'AUDIO' : 'FILE'
  const known: Record<string, string> = {
    pdf: 'PDF',
    'vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
    'vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'XLSX',
    'vnd.openxmlformats-officedocument.presentationml.presentation': 'PPTX',
    msword: 'DOC',
    'vnd.ms-excel': 'XLS',
    'vnd.ms-powerpoint': 'PPT',
    plain: 'TXT',
    markdown: 'MD',
    csv: 'CSV',
    jpeg: 'JPG',
    'epub+zip': 'EPUB',
    'svg+xml': 'SVG',
    webm: 'WEBM',
    mpeg: 'MP3',
    'x-wav': 'WAV',
    wav: 'WAV',
    mp4: 'MP4',
  }
  return known[subtype] ?? subtype.slice(0, 4).toUpperCase()
}

/**
 * The row's leading tile: the format name, a favicon for a link, a thumbnail for an image.
 *
 * "XLSX" says what a document icon cannot, so the format stands alone as text. Only images
 * fetch their bytes; a PDF thumbnail means rendering one, which is not worth it in a list.
 */
export function SourceTile({ source }: { source: ProfileSourcesItem }) {
  const [preview, setPreview] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  const isImage = source.kind === 'image' && source.hasFile

  useEffect(() => {
    if (!isImage || source.status !== 'ready') return
    let revoke: (() => void) | undefined
    let live = true
    void loadSourceFile(source.id)
      .then((file) => {
        if (!live) return file.revoke()
        revoke = file.revoke
        setPreview(file.url)
      })
      .catch(() => setFailed(true))
    return () => {
      live = false
      revoke?.()
    }
  }, [isImage, source.id, source.status])

  const bad = source.status === 'failed'
  const label = formatLabel(source)

  return (
    <span
      className={`relative flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-md border ${
        bad ? 'border-danger/30 bg-danger-muted' : 'border-border-muted bg-surface-muted'
      }`}
    >
      {preview ? (
        <img src={preview} alt="" className="size-full object-cover" />
      ) : source.kind === 'link' && source.url && !failed ? (
        <img
          src={faviconUrl(source.url)}
          alt=""
          onError={() => setFailed(true)}
          className="size-4 rounded-sm"
        />
      ) : (
        <span
          className={`font-semibold leading-none ${
            label.length > 3 ? 'text-[9px] tracking-[-0.01em]' : 'text-[10px] tracking-[0.02em]'
          } ${bad ? 'text-danger' : 'text-ink-muted'}`}
        >
          {label}
        </span>
      )}
    </span>
  )
}

/** One source, as a row: tile, name, one line of facts, and a pill only when something is up. */
function SourceRow({
  source,
  onRemove,
  onRename,
  onReprocess,
  reprocessing,
}: {
  source: ProfileSourcesItem
  onRemove: () => void
  onRename: (label: string) => void
  onReprocess: () => void
  /** True while this row's own re-read is in flight, so it can say so. */
  reprocessing: boolean
}) {
  const nav = useNavigation()
  const [renaming, setRenaming] = useState(false)
  const [draft, setDraft] = useState(source.label)
  const busy = source.status === 'pending' || source.status === 'parsing' || reprocessing

  const commit = () => {
    const next = draft.trim()
    setRenaming(false)
    if (next && next !== source.label) onRename(next)
    else setDraft(source.label)
  }

  if (renaming) {
    return (
      <div className="p-3">
        <Input
          aria-label="Name"
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
        />
        <div className="mt-2 flex gap-1.5">
          <Button size="sm" variant="primary" onClick={commit}>
            Save
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
    // "Read again", not "Reprocess": what changes is the document, as it is now.
    ...(busy ? [] : [{ label: 'Read again', onSelect: onReprocess }]),
    { label: 'Remove', onSelect: onRemove, tone: 'danger' as const },
  ]

  /** The second line: what it is, and how much of it we read. Two facts, no more. */
  const detail = [
    source.kind === 'link' && source.url ? hostnameOf(source.url) : formatBytes(source.sizeBytes),
    !busy && source.extractedChars ? `${formatCount(source.extractedChars)} read` : null,
    formatAddedOn(source.createdAt),
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <div>
      <div className="flex items-center gap-2.5 py-2 pl-3 pr-1.5">
        <button
          type="button"
          disabled={busy}
          onClick={
            source.kind === 'link'
              ? () => void openSourceInTab(source)
              : () => nav.push({ name: 'sourceDetail', sourceId: source.id })
          }
          className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
        >
          <SourceTile source={source} />
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5">
              <span className="truncate text-sm font-medium text-ink">{source.label}</span>
              {/* A pill only when something is happening, or has gone wrong. Ready is silence. */}
              {busy ? (
                <StatusPill tone="busy">{reprocessing ? 'Reading again' : 'Reading'}</StatusPill>
              ) : source.status === 'failed' ? (
                <StatusPill tone="bad">Couldn’t read</StatusPill>
              ) : null}
            </span>
            <span className="block truncate text-xs text-ink-dim">{detail}</span>
          </span>
        </button>
        <OverflowMenu items={items} label={`Actions for ${source.label}`} />
      </div>

      {/* Reading is work in progress, so it looks like it. */}
      {busy && <div className="awaiting h-0.5 w-full" aria-hidden="true" />}

      {source.status === 'failed' && (
        <div className="border-t border-border-muted px-3 py-2.5">
          {source.error && (
            <p className="flex items-start gap-1.5 text-xs leading-snug text-danger">
              <IconAlert className="mt-px size-3.5 shrink-0" />
              <span>{source.error}</span>
            </p>
          )}
          <Button size="sm" variant="secondary" className="mt-2" onClick={onReprocess}>
            <IconRefresh className="size-3.5" />
            Read it again
          </Button>
        </div>
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
  const { markSeen } = usePaywallSeen()

  const [pendingRemoval, setPendingRemoval] = useState<ProfileSourcesItem | null>(null)
  const [removeError, setRemoveError] = useState<string | null>(null)
  /** Which source is being re-read, so only its own row goes busy. */
  const [rereading, setRereading] = useState<string | null>(null)
  const [rereadError, setRereadError] = useState<string | null>(null)

  /*
   * `updated.profile`, not `updated`: rename, re-read and remove answer with `{ profile }`,
   * whereas `GET /profile` answers with the profile itself.
   */
  const rename = useRenameSource({
    mutation: {
      onSuccess: (updated) => queryClient.setQueryData(getGetProfileQueryKey(), updated.profile),
    },
  })

  /** Re-reading spends an action, so the account has to be refetched afterwards. */
  const reprocess = useReprocessSource({
    mutation: {
      onSuccess: (updated) => {
        queryClient.setQueryData(getGetProfileQueryKey(), updated.profile)
        void queryClient.invalidateQueries({ queryKey: getGetAccountQueryKey() })
        setRereadError(null)
      },
      onError: (error) => setRereadError(error.message),
      onSettled: () => setRereading(null),
    },
  })

  const remove = useDeleteSource({
    mutation: {
      onSuccess: (updated) => {
        queryClient.setQueryData(getGetProfileQueryKey(), updated.profile)
        void queryClient.invalidateQueries({ queryKey: getGetAccountQueryKey() })
        setPendingRemoval(null)
        setRemoveError(null)
      },
      onError: (error) => setRemoveError(error.message),
    },
  })

  const sources = profile?.sources ?? []
  const atLimit = sources.length >= sourceLimit

  return (
    <Screen>
      <ScreenHeader
        title="Profile"
        tabs={<InfoTabs view="sources" />}
        /* The measure on the left, the action on the right — the same row Facts puts them on. */
        search={
          <div className="flex items-center gap-2">
            <p className="tnum min-w-0 flex-1 truncate text-xs text-ink-dim">
              {profile === undefined
                ? ''
                : `${sources.length} of ${sourceLimit} ${plural(sourceLimit, 'source')}`}
            </p>
            <Button
              variant="secondary"
              disabled={atLimit}
              onClick={() => nav.push({ name: 'addInfo', initial: 'upload' })}
            >
              <IconPlus className="size-3.5" />
              Add
            </Button>
          </div>
        }
      />

      <ScreenBody className="relative">
        {profile === undefined ? (
          <div role="status" aria-busy="true" aria-label="Loading sources" className="py-2">
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </div>
        ) : sources.length === 0 ? (
          <EmptyState
            title="Nothing to read yet"
            mascot="think"
            body="Add a résumé, a link, a note or a voice recording. It answers forms from whatever is here."
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
            {/* A failed re-read is reported once, at the top: the row is back to what it was. */}
            {rereadError && <ErrorNote>{rereadError}</ErrorNote>}
            <ListCard>
              {sources.map((source) => (
                <SourceRow
                  key={source.id}
                  source={source}
                  onRename={(label) => rename.mutate({ id: source.id, data: { label } })}
                  onRemove={() => {
                    setRemoveError(null)
                    setPendingRemoval(source)
                  }}
                  reprocessing={rereading === source.id}
                  onReprocess={() => {
                    setRereadError(null)
                    setRereading(source.id)
                    reprocess.mutate({ id: source.id })
                  }}
                />
              ))}
            </ListCard>

            {/* Asking for a sixth source is the same kind of moment as pressing Fill. */}
            {atLimit && (
              <Card className="p-3">
                <p className="text-sm font-medium text-ink">
                  All {sourceLimit} source slots are full
                </p>
                <p className="mt-0.5 text-xs text-ink-muted">
                  {plan === 'free'
                    ? `Remove one to add another, or start the free trial for ${PLAN_SOURCE_LIMITS.pro} of them.`
                    : 'Remove one to add another, or move up a plan.'}
                </p>
                <Button
                  size="sm"
                  variant="primary"
                  className="mt-2.5"
                  onClick={() => {
                    markSeen()
                    void (plan === 'free' ? openTrial() : openUpgrade())
                  }}
                >
                  {plan === 'free' ? 'Start free trial' : 'Compare plans'}
                </Button>
              </Card>
            )}
          </div>
        )}

        {pendingRemoval && (
          <ConfirmSheet
            title={`Remove ${pendingRemoval.label}?`}
            body="This deletes the stored copy and everything the tool remembers from it. Answers it has already written stay where they are. This cannot be undone."
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
