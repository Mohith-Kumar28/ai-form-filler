import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { getGetAccountQueryKey } from '../../../generated/endpoints/account/account.js'
import {
  getGetProfileQueryKey,
  useDeleteSource,
} from '../../../generated/endpoints/profile/profile.js'
import type { Profile, ProfileSourcesItem } from '../../../generated/model/index.js'
import { formatAddedOn, formatCount } from '../../../lib/format.js'
import {
  formatBytes,
  hostnameOf,
  loadSourceFile,
  openSourceInTab,
} from '../../../lib/source-file.js'
import {
  Button,
  ConfirmSheet,
  EmptyState,
  Screen,
  ScreenBody,
  ScreenFooter,
  ScreenHeader,
} from '../components.js'
import { IconExternal, IconTrash } from '../icons.js'
import { useNavigation } from '../navigation.js'

const KIND_NOUN: Record<string, string> = {
  document: 'Document',
  link: 'Link',
  text: 'Note',
  image: 'Image',
  audio: 'Voice note',
}

/**
 * The stored original, rendered in place.
 *
 * A PDF goes into an `<iframe>` and Chrome's own viewer draws it — this is an extension page,
 * so that just works and no `pdf.js` dependency is needed for the single most common source
 * anyone adds. Audio gets the native player. Everything else falls back to opening a tab.
 */
function Preview({ source }: { source: ProfileSourcesItem }) {
  const [file, setFile] = useState<{ url: string; type: string } | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!source.hasFile) return

    let revoke: (() => void) | null = null
    let cancelled = false

    void loadSourceFile(source.id)
      .then((loaded) => {
        if (cancelled) {
          loaded.revoke()
          return
        }
        revoke = loaded.revoke
        setFile({ url: loaded.url, type: loaded.type })
      })
      .catch((cause: Error) => {
        if (!cancelled) setError(cause.message)
      })

    // The object URL dies with this screen, not on a timer that outlives the panel.
    return () => {
      cancelled = true
      revoke?.()
    }
  }, [source.id, source.hasFile])

  if (source.kind === 'link' && source.url) {
    return (
      <div className="border-b border-guilloche px-4 py-4">
        <p className="doc-label">Address</p>
        <p className="mt-1.5 break-all text-[12.5px] leading-relaxed text-ink">{source.url}</p>
        <Button onClick={() => void openSourceInTab(source)} size="sm" className="mt-3">
          <IconExternal className="size-3.5" />
          Open {hostnameOf(source.url)}
        </Button>
      </div>
    )
  }

  if (!source.hasFile) {
    return (
      <div className="border-b border-guilloche px-4 py-4">
        <p className="text-[12.5px] leading-relaxed text-ink2">
          This one was pasted in as text, so there is no original file to show. What it holds is
          used to answer questions the same way everything else here is.
        </p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="border-b border-guilloche px-4 py-4">
        <p className="text-[12.5px] leading-snug text-alert" role="alert">
          {error}
        </p>
      </div>
    )
  }

  if (!file) {
    return (
      <div
        role="status"
        aria-label="Loading preview"
        className="awaiting h-56 border-b border-guilloche"
      />
    )
  }

  if (file.type === 'application/pdf') {
    return (
      <iframe
        src={file.url}
        title={`${source.label} preview`}
        className="h-72 w-full border-b border-guilloche bg-leaf"
      />
    )
  }

  if (file.type.startsWith('image/')) {
    return (
      <div className="border-b border-guilloche bg-leaf p-3">
        <img
          src={file.url}
          alt={source.label}
          className="mx-auto max-h-72 w-auto max-w-full rounded-doc border border-guilloche object-contain"
        />
      </div>
    )
  }

  if (file.type.startsWith('audio/')) {
    return (
      <div className="border-b border-guilloche px-4 py-4">
        {/* biome-ignore lint/a11y/useMediaCaption: a voice note the user recorded themselves */}
        <audio controls src={file.url} className="w-full" />
      </div>
    )
  }

  return (
    <div className="border-b border-guilloche px-4 py-4">
      <p className="text-[12.5px] leading-relaxed text-ink2">
        No preview for this format. The original is stored and can be opened in a tab.
      </p>
      <Button onClick={() => void openSourceInTab(source)} size="sm" className="mt-3">
        <IconExternal className="size-3.5" />
        Open in a tab
      </Button>
    </div>
  )
}

function Entry({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 px-4 py-2.5">
      <span className="doc-label shrink-0">{label}</span>
      <span className="min-w-0 truncate text-right text-[12.5px] text-ink">{children}</span>
    </div>
  )
}

export function SourceDetail({
  sourceId,
  profile,
}: {
  sourceId: string
  profile: Profile | undefined
}) {
  const nav = useNavigation()
  const queryClient = useQueryClient()
  const [confirming, setConfirming] = useState(false)
  const [removeError, setRemoveError] = useState<string | null>(null)

  const source = profile?.sources?.find((candidate) => candidate.id === sourceId)

  const remove = useDeleteSource({
    mutation: {
      onSuccess: (updated) => {
        queryClient.setQueryData(getGetProfileQueryKey(), updated)
        void queryClient.invalidateQueries({ queryKey: getGetAccountQueryKey() })
        // The subject of this screen no longer exists, so there is nothing to come back to.
        nav.back()
      },
      onError: (error) => setRemoveError(error.message),
    },
  })

  if (!source) {
    return (
      <Screen>
        <ScreenHeader title="Source" />
        <ScreenBody className="flex flex-col">
          <EmptyState
            title="No longer on file"
            body="This source was removed. The rest of what it knows is unaffected."
            action={<Button onClick={() => nav.back()}>Back to the list</Button>}
          />
        </ScreenBody>
      </Screen>
    )
  }

  return (
    <Screen>
      <ScreenHeader title={source.label} />

      <ScreenBody className="relative">
        <Preview source={source} />

        <div className="divide-y divide-guilloche-soft">
          <Entry label="Kind">{KIND_NOUN[source.kind] ?? source.kind}</Entry>
          {source.mediaType && <Entry label="Format">{source.mediaType}</Entry>}
          {source.sizeBytes !== undefined && (
            <Entry label="Size">
              <span className="mrz">{formatBytes(source.sizeBytes)}</span>
            </Entry>
          )}
          {source.extractedChars !== undefined && (
            <Entry label="Read">
              <span className="mrz">{formatCount(source.extractedChars)} characters</span>
            </Entry>
          )}
          <Entry label="Added">{formatAddedOn(source.createdAt)}</Entry>
        </div>

        {source.status === 'failed' && source.error && (
          <p role="alert" className="px-4 py-3 text-[12px] leading-snug text-alert">
            {source.error}
          </p>
        )}

        {confirming && (
          <ConfirmSheet
            title={`Remove ${source.label}?`}
            body={
              <>
                This deletes the stored copy and everything the tool remembers from it. Answers it
                has already written stay where they are. This cannot be undone.
              </>
            }
            confirmLabel="Remove"
            pending={remove.isPending}
            error={removeError ?? undefined}
            onConfirm={() => remove.mutate({ id: source.id })}
            onCancel={() => {
              setConfirming(false)
              setRemoveError(null)
            }}
          />
        )}
      </ScreenBody>

      <ScreenFooter>
        <Button
          variant="danger"
          block
          onClick={() => {
            setRemoveError(null)
            setConfirming(true)
          }}
        >
          <IconTrash className="size-3.5" />
          Remove this source
        </Button>
      </ScreenFooter>
    </Screen>
  )
}
