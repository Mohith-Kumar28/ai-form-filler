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
  IconRefresh,
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

/*
 * `KIND_NOUN` mapped each kind to a display word — "Document", "Voice note" — for the `·`-joined
 * metadata string the card used to carry. `formatLabel` names the actual format instead ("PDF",
 * "XLSX", "MP3"), which is both more specific and short enough to sit inside the tile.
 */

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
 * The card's leading tile.
 *
 * This was a 20px grey glyph, which is the single biggest reason the list read as a settings table
 * rather than a shelf of things the user handed over. A source is a *file* — it has a shape, a
 * format and often a picture — so the tile is large enough to carry that.
 *
 * Only images fetch their bytes. A real thumbnail of a PDF means rendering one, and an `<iframe>`
 * scaled into a 48px box is both expensive on a list of twenty and worse-looking than the format
 * name set properly. Links keep the favicon they already had.
 */
function SourceTile({ source }: { source: ProfileSourcesItem }) {
  const [preview, setPreview] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  const isImage = source.kind === 'image' && source.hasFile
  const Icon = KIND_ICON[source.kind as keyof typeof KIND_ICON] ?? IconDocument

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

  return (
    <span
      className={`relative flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border ${
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
          className="size-5 rounded"
        />
      ) : (
        <span className="flex flex-col items-center gap-0.5">
          <Icon className={`size-4 ${bad ? 'text-danger' : 'text-ink-dim'}`} />
          <span
            className={`text-[8.5px] font-bold leading-none tracking-[0.04em] ${
              bad ? 'text-danger' : 'text-ink-dim'
            }`}
          >
            {formatLabel(source)}
          </span>
        </span>
      )}
    </span>
  )
}

/**
 * One source, as a card.
 *
 * A card rather than a hairline-divided row because a source is a *thing* the user gave us —
 * a file, a page, a recording — and the previous list read as a settings table, with the one
 * fact worth knowing about it (did we manage to read it?) buried as the first clause of a grey
 * metadata string in the same size and colour as the file size.
 *
 * The rebuild fixes what survived that: a real tile instead of a glyph, one line of hierarchy
 * instead of a `·`-joined run of unrelated facts at equal weight, the date the source was added
 * (which the model has always carried and only the detail screen ever showed), a live shimmer while
 * it is being read rather than a static pill claiming to be busy, and a retry on failure — the
 * previous card announced that something had gone wrong and offered nothing to do about it.
 */
function SourceCard({
  source,
  onRemove,
  onRename,
  onRetry,
}: {
  source: ProfileSourcesItem
  onRemove: () => void
  onRename: (label: string) => void
  onRetry: () => void
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

  /**
   * The second line: what it is, and how much of it we read.
   *
   * Held to two facts. The old string could reach four — kind, size, character count and a
   * hostname — all in the same 12px grey, which is a sentence nobody finishes reading.
   */
  const detail =
    source.kind === 'link' && source.url
      ? hostnameOf(source.url)
      : [formatBytes(source.sizeBytes), formatAddedOn(source.createdAt)].filter(Boolean).join(' · ')

  return (
    <div className="overflow-hidden rounded-2xl border border-border-muted bg-surface-raised transition-colors hover:border-border">
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
          <SourceTile source={source} />
          <span className="min-w-0 flex-1 pt-0.5">
            <span className="block truncate text-base font-semibold text-ink">{source.label}</span>
            <span className="mt-0.5 block truncate text-xs text-ink-dim">{detail}</span>
            <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
              {busy ? (
                <StatusPill tone="busy">Reading</StatusPill>
              ) : source.status === 'failed' ? (
                <StatusPill tone="bad">Couldn’t read</StatusPill>
              ) : (
                <StatusPill tone="ready">Ready</StatusPill>
              )}
              {source.extractedChars ? (
                <span className="truncate text-xs text-ink-dim">
                  {formatCount(source.extractedChars)} characters read
                </span>
              ) : null}
            </span>
          </span>
        </button>
        <OverflowMenu items={items} label={`Actions for ${source.label}`} />
      </div>

      {/*
        Reading is work in progress, so it looks like it.

        The pill alone was a label that never changed, on a card that sat still for the ten or
        twenty seconds an ingest takes — indistinguishable from a card that had quietly stalled.
      */}
      {busy && <div className="awaiting h-0.5 w-full" aria-hidden="true" />}

      {source.status === 'failed' && (
        <div className="border-t border-border-muted px-3 py-2.5">
          {source.error && (
            <p className="flex items-start gap-1.5 text-xs leading-snug text-danger">
              <IconAlert className="mt-px size-3.5 shrink-0" />
              <span>{source.error}</span>
            </p>
          )}
          <Button size="sm" variant="secondary" className="mt-2" onClick={onRetry}>
            <IconRefresh className="size-3.5" />
            Add it again
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
                /*
                 * Retry means "add it again", not "re-run the ingest".
                 *
                 * There is no server-side reingest endpoint, and inventing one for this would be a
                 * larger change than the failure warrants. What went wrong is almost always the
                 * file itself — a password-protected PDF is the fixture case — so the useful move
                 * is to drop the user back at the picker with the right tab already open. The dead
                 * source stays until they remove it, which is honest: it is still taking a slot.
                 */
                onRetry={() =>
                  nav.push({
                    name: 'addInfo',
                    initial: source.kind === 'link' ? 'link' : 'upload',
                  })
                }
              />
            ))}

            {/*
              The other moment worth asking at.

              The product says nothing about money until somebody wants something it cannot give
              them — and asking for a sixth source is exactly that, in the same way pressing Fill
              is. So the offer appears here too, and it is the trial rather than a plan picker,
              because anyone still at five sources has not paid for anything yet.
            */}
            {atLimit && (
              <div className="rounded-2xl border border-border-muted bg-surface p-3">
                <p className="text-sm font-semibold text-ink">
                  All {sourceLimit} source slots are full
                </p>
                <p className="mt-1 text-xs leading-snug text-ink-muted">
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
                  <IconCrown className="size-3.5" />
                  {plan === 'free' ? 'Start free trial' : 'Compare plans'}
                </Button>
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
