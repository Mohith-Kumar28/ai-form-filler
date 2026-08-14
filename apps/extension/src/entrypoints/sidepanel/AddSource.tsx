import { useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import {
  getGetProfileQueryKey,
  useAddTextSource,
  useUploadSource,
} from '../../generated/endpoints/profile/profile.js'
import type { AddSourceResponse } from '../../generated/model/index.js'
import { inferSourceKind, labelFromUrl } from '../../lib/identity-fields.js'
import { IconLink, IconText, IconUpload } from './icons.js'

type Mode = 'file' | 'url' | 'text'

const MODES: { mode: Mode; label: string; Icon: typeof IconUpload }[] = [
  { mode: 'file', label: 'File', Icon: IconUpload },
  { mode: 'url', label: 'Link', Icon: IconLink },
  { mode: 'text', label: 'Text', Icon: IconText },
]

/**
 * The intake block.
 *
 * Sits above the entry list the way a notebook's current, unwritten line does — the place
 * you add to, directly above what you have already recorded.
 */
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

  const field =
    'w-full rounded-sharp border border-rule bg-page px-2.5 py-2 text-[13px] text-ink outline-none placeholder:text-faint focus:border-pen'

  return (
    <section className="border-b border-rule bg-page px-4 py-3">
      <div className="flex items-center gap-1" role="tablist" aria-label="Source type">
        {MODES.map(({ mode: value, label, Icon }) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={mode === value}
            onClick={() => setMode(value)}
            className={`flex items-center gap-1.5 rounded-sharp px-2 py-1 text-[12px] transition-colors ${
              mode === value ? 'bg-pen-wash font-medium text-pen' : 'text-muted hover:text-ink'
            }`}
          >
            <Icon className="size-3.5" />
            {label}
          </button>
        ))}
      </div>

      <div className="mt-2.5">
        {mode === 'file' && (
          <>
            <input
              ref={fileInput}
              type="file"
              accept="application/pdf,image/*"
              className="sr-only"
              id="aff-file"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) upload.mutate({ data: { file, kind: 'resume' } })
              }}
            />
            {/*
              Drag handlers on the <label>, not a wrapper: the label is already the
              accessible control for the hidden input, so drag-and-drop enhances the same
              element rather than adding a second, keyboard-invisible target.
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
              className={`flex h-[68px] cursor-pointer flex-col items-center justify-center gap-1 rounded-sharp border border-dashed text-[12px] transition-colors ${
                dragging
                  ? 'border-pen bg-pen-wash text-pen'
                  : 'border-rule text-muted hover:border-pen hover:text-ink'
              }`}
            >
              <IconUpload className="size-4" />
              {busy ? 'Reading…' : 'Drop a PDF or image, or choose a file'}
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
              placeholder="your-site.com"
              className={field}
            />
            <button
              type="submit"
              disabled={busy || !url.trim()}
              className="shrink-0 rounded-sharp border border-pen px-3 text-[12px] font-medium text-pen transition-colors hover:bg-pen-wash disabled:opacity-40"
            >
              {busy ? '…' : 'Read'}
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
                  label: text.trim().split('\n')[0]?.slice(0, 60) || 'Notes',
                  text,
                },
              })
            }}
            className="flex flex-col gap-1.5"
          >
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={4}
              placeholder="Anything about you — visa status, what you're looking for, past answers…"
              className={`${field} resize-y`}
            />
            <button
              type="submit"
              disabled={busy || !text.trim()}
              className="self-end rounded-sharp border border-pen px-3 py-1 text-[12px] font-medium text-pen transition-colors hover:bg-pen-wash disabled:opacity-40"
            >
              {busy ? 'Recording…' : 'Record'}
            </button>
          </form>
        )}
      </div>

      {error && (
        <p className="mt-2 text-[12px] text-annot" role="alert">
          {error.message}
        </p>
      )}
      {truncated && (
        <p className="mt-2 text-[12px] text-muted">
          That source was long — only the first part was kept.
        </p>
      )}
    </section>
  )
}
