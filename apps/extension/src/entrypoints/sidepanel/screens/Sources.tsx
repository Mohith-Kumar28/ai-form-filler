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
  ConfirmSheet,
  EmptyState,
  ErrorNote,
  Input,
  OverflowMenu,
  Screen,
  ScreenBody,
  ScreenHeader,
  SkeletonRow,
  StatusPill,
} from '../components.js'
import { IconAlert, IconCrown, IconPlus, IconRefresh } from '../icons.js'
import { useNavigation } from '../navigation.js'
import { InfoTabs } from './info-tabs.js'

/*
 * `KIND_ICON` mapped each source kind to a glyph. The tile shows the file format as text instead —
 * "XLSX" says what a document icon cannot — so the map, and the five icon imports behind it, are
 * gone. Links still show their favicon, which is a real picture of the thing.
 */

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
 * The format name stands alone, without a glyph above it. The first version stacked both, and at
 * 48px that is an icon and an 8px label competing in a space too small for either: the label was
 * barely legible and the glyph said less than it did. A document icon is the same picture for a PDF,
 * a spreadsheet and a deck, whereas "XLSX" is the answer. So the informative half stays and the
 * decorative half goes.
 *
 * Only images fetch their bytes. A real thumbnail of a PDF means rendering one, and an `<iframe>`
 * scaled into a 48px box is both expensive on a list of twenty and worse-looking than the format
 * name set properly. Links keep the favicon they already had.
 */
function SourceTile({ source }: { source: ProfileSourcesItem }) {
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
        <span
          /* Tracking tightens as the word lengthens, so LINK and EPUB occupy the same tile
             without either looking cramped or adrift. */
          className={`font-display font-bold leading-none ${
            label.length > 3 ? 'text-[10px] tracking-[-0.01em]' : 'text-[11px] tracking-[0.01em]'
          } ${bad ? 'text-danger' : 'text-ink-muted'}`}
        >
          {label}
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
  onReprocess,
  reprocessing,
}: {
  source: ProfileSourcesItem
  onRemove: () => void
  onRename: (label: string) => void
  onReprocess: () => void
  /** True while this card's own re-read is in flight, so the row can say so. */
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
    /*
      "Read again", not "Reprocess".

      It is the same endpoint, and reprocess is what the route is called, but a menu is read by
      somebody deciding whether to press it — and what they want to know is what happens to their
      document, not what the server does to a row. "Read again" also names the thing that actually
      changes: a link whose page has been rewritten, or a résumé whose phone number the first pass
      missed, gets read as it is now.

      Hidden while the card is busy: pressing it during an in-flight re-read would spend a second
      action for the same answer.
    */
    ...(busy ? [] : [{ label: 'Read again', onSelect: onReprocess }]),
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
            {/*
              A pill only when something is happening, or has gone wrong.

              Every card used to wear a green "Ready", which is the same claim on every row of a
              list whose rows are, overwhelmingly, ready — so it said nothing and drew the eye away
              from the two rows that did. The same rule the field marks follow: a fact asks nothing
              of the user, so it is not decorated. Ready is the absence of a pill.
            */}
            {(busy || source.status === 'failed' || source.extractedChars) && (
              <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
                {busy ? (
                  <StatusPill tone="busy">{reprocessing ? 'Reading again' : 'Reading'}</StatusPill>
                ) : source.status === 'failed' ? (
                  <StatusPill tone="bad">Couldn’t read</StatusPill>
                ) : null}
                {!busy && source.extractedChars ? (
                  <span className="truncate text-xs text-ink-dim">
                    {formatCount(source.extractedChars)} read
                  </span>
                ) : null}
              </span>
            )}
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
          {/*
            The footer now retries the thing that failed, instead of restarting the user.

            It used to push them back to the file picker — the comment on the old `onRetry` was
            honest that this was a workaround for there being no reingest endpoint, and that the
            dead source would sit there occupying a slot until they removed it by hand. There is
            an endpoint now, so the button does what it says: reads the stored original again,
            keeping the row, the slot and the file.
          */}
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
  /** Which source is being re-read, so only its own card goes busy. */
  const [rereading, setRereading] = useState<string | null>(null)
  const [rereadError, setRereadError] = useState<string | null>(null)

  /*
   * `updated.profile`, not `updated`.
   *
   * Rename, re-read and remove answer with `{ profile }`, whereas `GET /profile` answers with the
   * profile itself — so writing the envelope into the profile cache slot replaced the whole
   * profile with `{ profile: ... }`. Every read off it (`profile.sources`, the identity fields,
   * the fact count) then came back undefined, and the panel looked like every source and every
   * fact had just been deleted until a refetch put it back.
   */
  const rename = useRenameSource({
    mutation: {
      onSuccess: (updated) => queryClient.setQueryData(getGetProfileQueryKey(), updated.profile),
    },
  })

  /**
   * Re-reading spends an action, so the account has to be refetched afterwards.
   *
   * Same reason a fill does it: the meter on Account is the only place the number is shown now,
   * and a stale one there is worse than none — it is a number the user has no reason to distrust.
   */
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
            {/*
              A failed re-read is reported once, at the top, rather than per card.

              The card it belongs to is back to whatever it was before — nothing was changed by a
              request that did not land — so putting the message inside it would be claiming a new
              state the source is not in. The likely message is a quota one, which is about the
              account and not about this file at all.
            */}
            {rereadError && <ErrorNote>{rereadError}</ErrorNote>}
            {sources.map((source) => (
              <SourceCard
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
