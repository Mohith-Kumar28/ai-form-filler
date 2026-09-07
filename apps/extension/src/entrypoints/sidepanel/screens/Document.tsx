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
  Body,
  Button,
  ConfirmSheet,
  Empty,
  Footer,
  Group,
  Header,
  Note,
  Row,
  Screen,
} from '../components.js'
import { IconExternal, IconTrash } from '../icons.js'
import { useNavigation } from '../navigation.js'
import { KIND_NOUN } from './documents.js'

/** The document itself, as far as it can be shown here, then what is known about it. */
function Preview({ source }: { source: ProfileSourcesItem }) {
  const [file, setFile] = useState<{ url: string; type: string } | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!source.hasFile) return
    let revoke: (() => void) | null = null
    let cancelled = false
    void loadSourceFile(source.id)
      .then((loaded) => {
        if (cancelled) return loaded.revoke()
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
      <div className="px-gutter">
        <p className="break-all text-sm text-ink">{source.url}</p>
        <Button size="sm" className="mt-2.5" onClick={() => void openSourceInTab(source)}>
          <IconExternal className="size-3.5" />
          Open {hostnameOf(source.url)}
        </Button>
      </div>
    )
  }
  if (!source.hasFile) {
    return (
      <p className="px-gutter text-xs leading-relaxed text-ink-muted">
        Pasted in as text, so there is no original to show. What it holds answers questions the same
        way everything else here does.
      </p>
    )
  }
  if (error) {
    return (
      <div className="px-gutter">
        <Note tone="danger">{error}</Note>
      </div>
    )
  }
  if (!file) {
    return (
      <div
        role="status"
        aria-label="Loading preview"
        className="awaiting mx-gutter h-40 rounded-lg"
      />
    )
  }
  if (file.type === 'application/pdf') {
    return (
      <iframe
        src={file.url}
        title={`${source.label} preview`}
        className="mx-gutter h-64 w-[calc(100%-2*var(--spacing-gutter))] rounded-lg border border-border bg-surface-muted"
      />
    )
  }
  if (file.type.startsWith('image/')) {
    return (
      <div className="mx-gutter rounded-lg border border-border bg-surface-muted p-2">
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
      <div className="px-gutter">
        {/* biome-ignore lint/a11y/useMediaCaption: a voice note the user recorded themselves */}
        <audio controls src={file.url} className="w-full" />
      </div>
    )
  }
  return (
    <div className="px-gutter">
      <p className="text-xs leading-relaxed text-ink-muted">
        No preview for this format. The original is stored and can be opened in a tab.
      </p>
      <Button size="sm" className="mt-2.5" onClick={() => void openSourceInTab(source)}>
        <IconExternal className="size-3.5" />
        Open in a tab
      </Button>
    </div>
  )
}

export function Document({ id, profile }: { id: string; profile: Profile | undefined }) {
  const nav = useNavigation()
  const queryClient = useQueryClient()
  const [confirming, setConfirming] = useState(false)
  const [removeError, setRemoveError] = useState<string | null>(null)
  const source = profile?.sources?.find((candidate) => candidate.id === id)

  const remove = useDeleteSource({
    mutation: {
      onSuccess: (updated) => {
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
        <Header title="Document" onBack={nav.back} />
        <Body>
          <Empty
            title="No longer on file"
            body="This document was removed. Everything else it knows is unaffected."
            action={<Button onClick={nav.back}>Back</Button>}
          />
        </Body>
      </Screen>
    )
  }

  return (
    <Screen>
      <Header title={source.label} onBack={nav.back} />
      <Body className="space-y-4 pt-1 pb-4">
        <Preview source={source} />
        <Group title="About this document">
          <Row title="Kind" value={KIND_NOUN[source.kind] ?? source.kind} />
          {source.mediaType && <Row title="Format" value={source.mediaType} />}
          {source.sizeBytes !== undefined && (
            <Row title="Size" value={formatBytes(source.sizeBytes)} />
          )}
          {source.extractedChars !== undefined && (
            <Row title="Read" value={`${formatCount(source.extractedChars)} characters`} />
          )}
          <Row title="Added" value={formatAddedOn(source.createdAt)} />
        </Group>
        {source.status === 'failed' && source.error && (
          <div className="px-gutter">
            <Note tone="danger">{source.error}</Note>
          </div>
        )}
        {confirming && (
          <ConfirmSheet
            title={`Remove ${source.label}?`}
            body="This deletes the stored copy and everything learned from it. Answers already written stay where they are. This cannot be undone."
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
      </Body>
      <Footer>
        <Button
          variant="danger"
          block
          onClick={() => {
            setRemoveError(null)
            setConfirming(true)
          }}
        >
          <IconTrash className="size-3.5" />
          Remove this document
        </Button>
      </Footer>
    </Screen>
  )
}
