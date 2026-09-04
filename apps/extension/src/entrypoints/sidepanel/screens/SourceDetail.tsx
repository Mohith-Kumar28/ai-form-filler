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
  ListCard,
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

    return () => {
      cancelled = true
      revoke?.()
    }
  }, [source.id, source.hasFile])

  if (source.kind === 'link' && source.url) {
    return (
      <div className="border-b border-border-muted px-gutter py-3">
        <p className="text-2xs font-semibold uppercase tracking-[0.06em] text-ink-dim">Address</p>
        <p className="mt-1 break-all text-sm text-ink">{source.url}</p>
        <Button onClick={() => void openSourceInTab(source)} size="sm" className="mt-2.5">
          <IconExternal className="size-3.5" />
          Open {hostnameOf(source.url)}
        </Button>
      </div>
    )
  }

  if (!source.hasFile) {
    return (
      <div className="border-b border-border-muted px-gutter py-3">
        <p className="text-sm text-ink-muted">
          Pasted in as text, so there is no original file to show. What it holds answers questions
          the same way everything else here does.
        </p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="border-b border-border-muted px-gutter py-3">
        <p className="text-sm text-danger" role="alert">
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
        className="awaiting h-48 border-b border-border-muted"
      />
    )
  }

  if (file.type === 'application/pdf') {
    return (
      <iframe
        src={file.url}
        title={`${source.label} preview`}
        className="h-64 w-full border-b border-border-muted bg-surface-muted"
      />
    )
  }

  if (file.type.startsWith('image/')) {
    return (
      <div className="border-b border-border-muted bg-surface-muted p-3">
        <img
          src={file.url}
          alt={source.label}
          className="mx-auto max-h-64 w-auto max-w-full rounded-md object-contain"
        />
      </div>
    )
  }

  if (file.type.startsWith('audio/')) {
    return (
      <div className="border-b border-border-muted px-gutter py-3">
        {/* biome-ignore lint/a11y/useMediaCaption: a voice note the user recorded themselves */}
        <audio controls src={file.url} className="w-full" />
      </div>
    )
  }

  return (
    <div className="border-b border-border-muted px-gutter py-3">
      <p className="text-sm text-ink-muted">
        No preview for this format. The original is stored and can be opened in a tab.
      </p>
      <Button onClick={() => void openSourceInTab(source)} size="sm" className="mt-2.5">
        <IconExternal className="size-3.5" />
        Open in a tab
      </Button>
    </div>
  )
}

function Entry({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex h-9 items-center justify-between gap-3 px-3">
      <span className="shrink-0 text-xs text-ink-muted">{label}</span>
      <span className="tnum min-w-0 truncate text-right text-sm text-ink">{children}</span>
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
        // `updated.profile` — the delete answers with a `{ profile }` envelope, and writing the
        // envelope itself into the profile cache slot blanked the whole panel. See Sources.tsx.
        queryClient.setQueryData(getGetProfileQueryKey(), updated.profile)
        void queryClient.invalidateQueries({ queryKey: getGetAccountQueryKey() })
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

        <div className="px-gutter py-3">
          <ListCard>
            <Entry label="Kind">{KIND_NOUN[source.kind] ?? source.kind}</Entry>
            {source.mediaType && <Entry label="Format">{source.mediaType}</Entry>}
            {source.sizeBytes !== undefined && (
              <Entry label="Size">{formatBytes(source.sizeBytes)}</Entry>
            )}
            {source.extractedChars !== undefined && (
              <Entry label="Read">{formatCount(source.extractedChars)} characters</Entry>
            )}
            <Entry label="Added">{formatAddedOn(source.createdAt)}</Entry>
          </ListCard>

          {source.status === 'failed' && source.error && (
            <p
              role="alert"
              className="mt-3 rounded-md bg-danger-muted px-3 py-2 text-xs text-danger"
            >
              {source.error}
            </p>
          )}
        </div>

        {confirming && (
          <ConfirmSheet
            title={`Remove ${source.label}?`}
            body="This deletes the stored copy and everything the tool remembers from it. Answers it has already written stay where they are. This cannot be undone."
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
          variant="secondary"
          block
          className="text-danger"
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
