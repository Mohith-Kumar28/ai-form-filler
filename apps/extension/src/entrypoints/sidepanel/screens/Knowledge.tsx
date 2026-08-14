import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { getGetAccountQueryKey } from '../../../generated/endpoints/account/account.js'
import {
  getGetProfileQueryKey,
  useDeleteSource,
} from '../../../generated/endpoints/profile/profile.js'
import type { Profile, ProfileSourcesItem } from '../../../generated/model/index.js'
import { formatCount, plural } from '../../../lib/format.js'
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
  OverflowMenu,
  Screen,
  ScreenBody,
  ScreenHeader,
  SkeletonRow,
} from '../components.js'
import {
  IconAlert,
  IconAudio,
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

/**
 * A source's second line, which is the whole difference from the old list.
 *
 * Every row used to read `label · 240 KB · Remove`, so a link never showed where it pointed
 * and a PDF was indistinguishable from a pasted note. What a person needs here is the thing
 * itself: the host for a link, the format and weight for a file, and — once parsing has
 * finished — how much of it was actually readable, which is the cheap proof that the upload
 * did anything at all.
 */
function sourceDetail(source: ProfileSourcesItem): string {
  if (source.status === 'pending' || source.status === 'parsing') return 'Reading…'
  if (source.status === 'failed') return 'Could not be read'

  const parts: string[] = []

  if (source.kind === 'link' && source.url) {
    parts.push(hostnameOf(source.url))
  } else {
    parts.push(KIND_NOUN[source.kind] ?? 'Source')
    if (source.sizeBytes) parts.push(formatBytes(source.sizeBytes))
  }

  if (source.extractedChars) {
    parts.push(`${formatCount(source.extractedChars)} characters read`)
  }

  return parts.join(' · ')
}

/** Chrome's cached favicon, with the drawn glyph standing in until (or unless) it loads. */
function SourceGlyph({ source }: { source: ProfileSourcesItem }) {
  const [failed, setFailed] = useState(false)
  const Icon = KIND_ICON[source.kind as keyof typeof KIND_ICON] ?? IconDocument

  if (source.kind === 'link' && source.url && !failed) {
    return (
      <img
        src={faviconUrl(source.url)}
        alt=""
        onError={() => setFailed(true)}
        className="size-4 shrink-0 rounded-[1px]"
      />
    )
  }

  if (source.kind === 'image' && source.hasFile) {
    return <ImageThumb sourceId={source.id} fallback={<Icon className="size-4" />} />
  }

  return (
    <Icon
      className={`size-4 shrink-0 ${source.status === 'failed' ? 'text-endorse' : 'text-ink3'}`}
    />
  )
}

function ImageThumb({ sourceId, fallback }: { sourceId: string; fallback: React.ReactNode }) {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    let revoke: (() => void) | null = null
    let cancelled = false

    void loadSourceFile(sourceId)
      .then((file) => {
        if (cancelled) {
          file.revoke()
          return
        }
        revoke = file.revoke
        setUrl(file.url)
      })
      .catch(() => undefined)

    // Revoking on unmount is what the previous 60-second timer could not do: a panel closed
    // before it fired leaked the blob for the lifetime of the worker.
    return () => {
      cancelled = true
      revoke?.()
    }
  }, [sourceId])

  if (!url) return <span className="shrink-0 text-ink3">{fallback}</span>

  return (
    <img
      src={url}
      alt=""
      className="size-4 shrink-0 rounded-[1px] border border-guilloche object-cover"
    />
  )
}

function SourceRow({
  source,
  index,
  onRemove,
}: {
  source: ProfileSourcesItem
  index: number
  onRemove: () => void
}) {
  const nav = useNavigation()
  const busy = source.status === 'pending' || source.status === 'parsing'

  const open = () => {
    if (source.kind === 'link') void openSourceInTab(source)
    else nav.push({ name: 'sourceDetail', sourceId: source.id })
  }

  const items = [
    ...(source.kind === 'link'
      ? [{ label: 'Open link', onSelect: () => void openSourceInTab(source) }]
      : [
          { label: 'Preview', onSelect: open },
          ...(source.hasFile
            ? [{ label: 'Open in a tab', onSelect: () => void openSourceInTab(source) }]
            : []),
        ]),
    { label: 'Remove', onSelect: onRemove, tone: 'endorse' as const },
  ]

  return (
    <li className="settle border-b border-guilloche-soft" style={{ '--i': index } as never}>
      <div className="flex items-start gap-2.5 pr-1.5 transition-colors hover:bg-guilloche-soft">
        <button
          type="button"
          onClick={busy ? undefined : open}
          disabled={busy}
          className="flex min-w-0 flex-1 items-start gap-2.5 py-3 pl-4 text-left"
        >
          <span className="mt-px flex size-4 shrink-0 items-center justify-center">
            <SourceGlyph source={source} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] text-ink">{source.label}</span>
            <span
              className={`mt-0.5 block truncate text-[11.5px] ${
                source.status === 'failed' ? 'text-endorse' : 'text-ink3'
              }`}
            >
              {sourceDetail(source)}
            </span>
          </span>
        </button>
        <span className="py-2.5">
          <OverflowMenu items={items} label={`Actions for ${source.label}`} />
        </span>
      </div>

      {/*
        The server's own words, in the row that produced them. A parse failure used to set
        `error` on the record and then never render it anywhere.
      */}
      {source.status === 'failed' && source.error && (
        <p className="flex items-start gap-1.5 px-4 pb-3 text-[11.5px] leading-snug text-endorse">
          <IconAlert className="mt-px size-3.5 shrink-0" />
          <span>{source.error}</span>
        </p>
      )}
    </li>
  )
}

export function Knowledge({ profile }: { profile: Profile | undefined }) {
  const nav = useNavigation()
  const queryClient = useQueryClient()
  const [pendingRemoval, setPendingRemoval] = useState<ProfileSourcesItem | null>(null)
  const [removeError, setRemoveError] = useState<string | null>(null)

  const remove = useDeleteSource({
    mutation: {
      onSuccess: (updated) => {
        queryClient.setQueryData(getGetProfileQueryKey(), updated)
        void queryClient.invalidateQueries({ queryKey: getGetAccountQueryKey() })
        setPendingRemoval(null)
        setRemoveError(null)
      },
      /**
       * The one error this screen must not swallow.
       *
       * Deleting a source deletes the D1 row, the stored original in R2, *and* the document
       * the memory service holds. If that last call fails the server says so explicitly —
       * "Removed from your profile, but the stored copy could not be deleted" — and the old
       * UI had nowhere to put it, so a partial delete looked exactly like a clean one.
       */
      onError: (error) => setRemoveError(error.message),
    },
  })

  const sources = profile?.sources ?? []

  const addButton = (
    <Button
      size="sm"
      onClick={() => nav.push({ name: 'addSource' })}
      aria-label="Add a source"
      className="shrink-0"
    >
      <IconPlus className="size-3.5" />
      Add
    </Button>
  )

  return (
    <Screen>
      <ScreenHeader title="What it knows" right={addButton} />

      <ScreenBody className="relative flex flex-col">
        {profile === undefined ? (
          <div role="status" aria-label="Loading sources" aria-busy="true">
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </div>
        ) : sources.length === 0 ? (
          <EmptyState
            title="Nothing on file yet"
            body={
              <>
                Give it a résumé, a link to your site, or a few pasted lines about yourself. It
                answers forms from whatever is here — the more it has, the fewer answers it has to
                guess at.
              </>
            }
            action={
              <Button variant="plate" onClick={() => nav.push({ name: 'addSource' })}>
                Add the first one
              </Button>
            }
          />
        ) : (
          <>
            <p className="px-4 py-2.5 text-[11.5px] text-ink3">
              {sources.length} {plural(sources.length, 'source')} · answers are drawn from all of
              them
            </p>
            <ul className="border-t border-guilloche">
              {sources.map((source, i) => (
                <SourceRow
                  key={source.id}
                  source={source}
                  index={Math.min(i, 8)}
                  onRemove={() => {
                    setRemoveError(null)
                    setPendingRemoval(source)
                  }}
                />
              ))}
            </ul>
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
    </Screen>
  )
}
