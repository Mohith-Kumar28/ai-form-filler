import { useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import {
  getGetProfileQueryKey,
  useAddTextSource,
  useUploadSource,
} from '../../generated/endpoints/profile/profile.js'
import type { AddSourceResponse } from '../../generated/model/index.js'
import { inferSourceKind, labelFromUrl } from '../../lib/identity-fields.js'

type Mode = 'file' | 'url' | 'text'

const TABS: { mode: Mode; label: string }[] = [
  { mode: 'file', label: 'Upload' },
  { mode: 'url', label: 'Link' },
  { mode: 'text', label: 'Paste' },
]

export function AddSource() {
  const [mode, setMode] = useState<Mode>('file')
  const [url, setUrl] = useState('')
  const [text, setText] = useState('')
  const [dragging, setDragging] = useState(false)
  const [truncated, setTruncated] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const queryClient = useQueryClient()

  const onAdded = (result: AddSourceResponse) => {
    queryClient.setQueryData(getGetProfileQueryKey(), result.profile)
    void queryClient.invalidateQueries({ queryKey: ['account'] })
    setTruncated(result.truncated)
    setUrl('')
    setText('')
    if (fileInput.current) fileInput.current.value = ''
  }

  const upload = useUploadSource({ mutation: { onSuccess: onAdded } })
  const addText = useAddTextSource({ mutation: { onSuccess: onAdded } })

  const busy = upload.isPending || addText.isPending
  const error = upload.error ?? addText.error

  return (
    <section className="flex flex-col gap-2">
      <div className="flex gap-1" role="tablist" aria-label="Source type">
        {TABS.map((tab) => (
          <button
            key={tab.mode}
            type="button"
            role="tab"
            aria-selected={mode === tab.mode}
            onClick={() => setMode(tab.mode)}
            className={`rounded px-2.5 py-1 text-xs transition-colors ${
              mode === tab.mode
                ? 'bg-accent-soft font-medium text-accent'
                : 'text-ink-muted hover:bg-line'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {mode === 'file' && (
        <>
          <input
            ref={fileInput}
            type="file"
            accept="application/pdf"
            className="sr-only"
            id="aff-file"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) upload.mutate({ data: { file, kind: 'resume' } })
            }}
          />
          {/*
            The drag handlers live on the <label>, not on a wrapper div. The label is already
            the accessible control for the hidden file input — keyboard and screen reader
            users get it for free — so drag-and-drop becomes a pointer-only enhancement on
            the same element rather than a second, inaccessible target.
          */}
          <label
            htmlFor="aff-file"
            onDragOver={(e) => {
              e.preventDefault()
              setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDragging(false)
              const file = e.dataTransfer.files[0]
              if (file) upload.mutate({ data: { file, kind: 'resume' } })
            }}
            className={`block cursor-pointer rounded-lg border border-dashed p-4 text-center text-xs transition-colors ${
              dragging
                ? 'border-accent bg-accent-soft text-accent'
                : 'border-line text-ink-muted hover:text-ink'
            }`}
          >
            {busy ? 'Reading…' : 'Drop a PDF here, or click to choose'}
          </label>
        </>
      )}

      {mode === 'url' && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (!url.trim()) return
            addText.mutate({
              data: { kind: inferSourceKind(url), label: labelFromUrl(url), url },
            })
          }}
          className="flex gap-1.5"
        >
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://github.com/you"
            className="min-w-0 flex-1 rounded-md border border-line bg-surface-raised px-2.5 py-1.5 text-xs outline-none focus:border-accent"
          />
          <button
            type="submit"
            disabled={busy || !url.trim()}
            className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40"
          >
            {busy ? '…' : 'Add'}
          </button>
        </form>
      )}

      {mode === 'text' && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (!text.trim()) return
            addText.mutate({
              data: {
                kind: 'freeform',
                // The first line reads better in the source list than "Pasted text".
                label: text.trim().split('\n')[0]?.slice(0, 60) || 'Pasted notes',
                text,
              },
            })
          }}
          className="flex flex-col gap-1.5"
        >
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={5}
            placeholder="Paste anything — a bio, past answers, your visa status, dietary needs…"
            className="w-full resize-y rounded-md border border-line bg-surface-raised px-2.5 py-1.5 text-xs outline-none focus:border-accent"
          />
          <button
            type="submit"
            disabled={busy || !text.trim()}
            className="self-end rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40"
          >
            {busy ? 'Saving…' : 'Add'}
          </button>
        </form>
      )}

      {error && (
        <p className="text-xs text-review" role="alert">
          {error.message}
        </p>
      )}
      {truncated && (
        <p className="text-xs text-review">
          That source was long, so only the first part was kept.
        </p>
      )}
    </section>
  )
}
