import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import {
  addTextSource,
  getGetProfileQueryKey,
  uploadSource,
} from '../../generated/endpoints/profile/profile.js'

/**
 * Adding a source, as its own screen.
 *
 * This used to be a stack of three collapsed widgets pinned under the source list, so the
 * two most common actions — dropping in a resume and pasting a link — competed for a few
 * hundred pixels with the list of things already added. Taking the whole panel means each
 * input can be the size it deserves, and a name can be asked for without the form feeling
 * cramped.
 *
 * Naming is required for files and links and optional for pasted text, which is not an
 * inconsistency: a file called `Document (3).pdf` and a bare URL are both unrecognisable in
 * a list a month later, while pasted text carries its own first line.
 */

const MAX_UPLOAD_BYTES = 15 * 1024 * 1024

type Tab = 'upload' | 'link' | 'text' | 'voice'

const TABS: { key: Tab; label: string }[] = [
  { key: 'upload', label: 'File' },
  { key: 'link', label: 'Link' },
  { key: 'text', label: 'Text' },
  { key: 'voice', label: 'Voice' },
]

export function AddSource({ onDone }: { onDone: () => void }) {
  const [tab, setTab] = useState<Tab>('upload')

  return (
    <div className="flex h-full flex-col overflow-hidden bg-ground">
      <header className="shrink-0 border-b border-rule bg-page px-4 pb-0 pt-3">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-[14px] font-semibold text-ink">Add a source</h2>
          <button
            type="button"
            onClick={onDone}
            className="text-[11.5px] text-faint transition-colors hover:text-ink"
          >
            Cancel
          </button>
        </div>
        <p className="mt-0.5 text-[11.5px] leading-snug text-muted">
          Anything about you. It is read once and remembered.
        </p>

        <nav className="-mb-px mt-2.5 flex gap-1" aria-label="Source type">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              aria-current={tab === t.key ? 'page' : undefined}
              onClick={() => setTab(t.key)}
              className={`border-b-2 px-2.5 pb-1.5 text-[12.5px] transition-colors ${
                tab === t.key
                  ? 'border-pen font-medium text-ink'
                  : 'border-transparent text-faint hover:text-muted'
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      <div className="flex-1 overflow-y-auto p-4">
        {tab === 'upload' && <UploadTab onDone={onDone} />}
        {tab === 'link' && <LinkTab onDone={onDone} />}
        {tab === 'text' && <TextTab onDone={onDone} />}
        {tab === 'voice' && <VoiceTab onDone={onDone} />}
      </div>
    </div>
  )
}

/** Every add path ends the same way: refresh the profile, return to the list. */
function useAddSource(onDone: () => void) {
  const queryClient = useQueryClient()
  return {
    settle: async () => {
      await queryClient.invalidateQueries({ queryKey: getGetProfileQueryKey() })
      onDone()
    },
  }
}

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  // A <div> rather than a <label>: the control arrives as children, so the linter cannot
  // see the association and neither can a screen reader. `aria-label` on each input is what
  // actually does the work.
  return (
    <div className="block">
      <span className="text-[11.5px] font-medium text-muted">{label}</span>
      {hint && <span className="ml-1 text-[11px] text-faint">{hint}</span>}
      <div className="mt-1">{children}</div>
    </div>
  )
}

const INPUT =
  'w-full rounded-sharp border border-rule bg-page px-2.5 py-1.5 text-[13px] text-ink outline-none transition-colors focus:border-pen placeholder:text-faint'

function SaveButton({ pending, disabled }: { pending: boolean; disabled: boolean }) {
  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className="w-full rounded-sharp bg-pen py-2 text-[13px] font-medium text-page transition-opacity hover:opacity-90 disabled:opacity-40"
    >
      {pending ? 'Saving…' : 'Save source'}
    </button>
  )
}

function ErrorNote({ error }: { error: unknown }) {
  if (!error) return null
  return (
    <p className="text-[11.5px] text-annot" role="alert">
      {(error as Error).message}
    </p>
  )
}

function UploadTab({ onDone }: { onDone: () => void }) {
  const { settle } = useAddSource(onDone)
  const [file, setFile] = useState<File | null>(null)
  const [label, setLabel] = useState('')
  const [dragging, setDragging] = useState(false)
  const [tooBig, setTooBig] = useState(false)

  const save = useMutation({
    mutationFn: async () => {
      if (!file) return
      await uploadSource({ file, label: label.trim() })
    },
    onSuccess: settle,
  })

  function accept(next: File | null) {
    if (!next) return
    setTooBig(next.size > MAX_UPLOAD_BYTES)
    setFile(next)
    // Prefill the name from the filename, minus its extension — a starting point to edit,
    // not a value to accept blindly.
    if (label.trim() === '') setLabel(next.name.replace(/\.[^.]+$/, ''))
  }

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault()
        save.mutate()
      }}
    >
      {/* biome-ignore lint/a11y/noStaticElementInteractions: the inner input is the control */}
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          accept(e.dataTransfer.files[0] ?? null)
        }}
        className={`rounded-sharp border border-dashed px-4 py-6 text-center transition-colors ${
          dragging ? 'border-pen bg-pen-wash' : 'border-rule'
        }`}
      >
        <p className="text-[12.5px] text-muted">
          {file ? file.name : 'Drop a file here, or choose one'}
        </p>
        <p className="mt-0.5 text-[11px] text-faint">
          {file
            ? `${(file.size / 1024 / 1024).toFixed(1)} MB`
            : 'PDF, Word, slides, images, audio — anything up to 15 MB'}
        </p>
        <input
          type="file"
          aria-label="Choose a file"
          onChange={(e) => accept(e.target.files?.[0] ?? null)}
          className="mt-2 w-full text-[11.5px] text-muted file:mr-2 file:rounded-sharp file:border file:border-rule file:bg-page file:px-2 file:py-1 file:text-[11.5px] file:text-ink"
        />
      </div>

      {tooBig && (
        <p className="text-[11.5px] text-annot" role="alert">
          That file is over 15 MB. Try a smaller one.
        </p>
      )}

      <Field label="Name" hint="required">
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          aria-label="Name"
          placeholder="Resume — 2026"
          className={INPUT}
        />
      </Field>

      <ErrorNote error={save.error} />
      <SaveButton pending={save.isPending} disabled={!file || tooBig || label.trim() === ''} />
    </form>
  )
}

function LinkTab({ onDone }: { onDone: () => void }) {
  const { settle } = useAddSource(onDone)
  const [url, setUrl] = useState('')
  const [label, setLabel] = useState('')

  const save = useMutation({
    mutationFn: () => addTextSource({ url: url.trim(), label: label.trim() }),
    onSuccess: settle,
  })

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault()
        save.mutate()
      }}
    >
      <Field label="Address">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          aria-label="Address"
          placeholder="https://your-site.com"
          inputMode="url"
          className={INPUT}
        />
      </Field>

      <Field label="What is this?" hint="required">
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          aria-label="What is this?"
          placeholder="My portfolio"
          className={INPUT}
        />
      </Field>

      <p className="text-[11px] leading-snug text-faint">
        The page is read for you, and re-read as it changes.
      </p>

      <ErrorNote error={save.error} />
      <SaveButton
        pending={save.isPending}
        disabled={!/^https?:\/\/\S+$/.test(url.trim()) || label.trim() === ''}
      />
    </form>
  )
}

function TextTab({ onDone }: { onDone: () => void }) {
  const { settle } = useAddSource(onDone)
  const [text, setText] = useState('')

  const save = useMutation({
    mutationFn: () => addTextSource({ text: text.trim() }),
    onSuccess: settle,
  })

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault()
        save.mutate()
      }}
    >
      <Field label="Anything about you">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={12}
          aria-label="Anything about you"
          placeholder="Paste a bio, notes, a past answer you liked, anything."
          className={`${INPUT} resize-none leading-relaxed`}
        />
      </Field>
      {/* No name asked for: the first line becomes the label. */}
      <ErrorNote error={save.error} />
      <SaveButton pending={save.isPending} disabled={text.trim().length < 10} />
    </form>
  )
}

/**
 * Voice notes.
 *
 * Recorded here rather than asking the user to find a recorder app and upload the result —
 * the whole reason to support voice is that talking is faster than typing, and a workflow
 * that routes through the filesystem gives that back. Memory transcribes it; we never do.
 */
function VoiceTab({ onDone }: { onDone: () => void }) {
  const { settle } = useAddSource(onDone)
  const [recording, setRecording] = useState(false)
  const [blob, setBlob] = useState<Blob | null>(null)
  const [seconds, setSeconds] = useState(0)
  const [denied, setDenied] = useState<string | null>(null)
  const [label, setLabel] = useState('')

  const recorder = useRef<MediaRecorder | null>(null)
  const chunks = useRef<Blob[]>([])

  useEffect(() => {
    if (!recording) return
    const timer = setInterval(() => setSeconds((s) => s + 1), 1000)
    return () => clearInterval(timer)
  }, [recording])

  // Releases the microphone if the panel closes mid-recording — otherwise the browser keeps
  // showing the recording indicator for a tab that is no longer capturing anything.
  useEffect(
    () => () => {
      for (const track of recorder.current?.stream.getTracks() ?? []) track.stop()
    },
    [],
  )

  async function start() {
    setDenied(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const media = new MediaRecorder(stream)
      chunks.current = []
      media.ondataavailable = (e) => chunks.current.push(e.data)
      media.onstop = () => {
        setBlob(new Blob(chunks.current, { type: 'audio/webm' }))
        for (const track of stream.getTracks()) track.stop()
      }
      media.start()
      recorder.current = media
      setSeconds(0)
      setBlob(null)
      setRecording(true)
    } catch {
      setDenied('Microphone access was refused. Allow it in the site settings and try again.')
    }
  }

  function stop() {
    recorder.current?.stop()
    setRecording(false)
  }

  const save = useMutation({
    mutationFn: async () => {
      if (!blob) return
      const file = new File([blob], `${label.trim() || 'Voice note'}.webm`, { type: 'audio/webm' })
      await uploadSource({ file, label: label.trim() })
    },
    onSuccess: settle,
  })

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault()
        save.mutate()
      }}
    >
      <div className="rounded-sharp border border-rule px-4 py-6 text-center">
        <p className="measure text-[22px] tabular-nums text-ink">
          {String(Math.floor(seconds / 60)).padStart(2, '0')}:
          {String(seconds % 60).padStart(2, '0')}
        </p>
        <p className="mt-0.5 text-[11.5px] text-faint">
          {recording ? 'Recording…' : blob ? 'Ready to save' : 'Talk about yourself'}
        </p>

        <button
          type="button"
          onClick={recording ? stop : start}
          className={`mt-3 rounded-full px-4 py-1.5 text-[12.5px] font-medium transition-colors ${
            recording ? 'bg-annot text-page' : 'border border-pen text-pen hover:bg-pen-wash'
          }`}
        >
          {recording ? 'Stop' : blob ? 'Record again' : 'Start recording'}
        </button>
      </div>

      {denied && (
        <p className="text-[11.5px] text-annot" role="alert">
          {denied}
        </p>
      )}

      {blob && (
        <>
          {/* biome-ignore lint/a11y/useMediaCaption: the user just recorded this themselves */}
          <audio controls src={URL.createObjectURL(blob)} className="w-full" />
          <Field label="Name" hint="required">
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              aria-label="Name"
              placeholder="How I describe my work"
              className={INPUT}
            />
          </Field>
        </>
      )}

      <ErrorNote error={save.error} />
      <SaveButton pending={save.isPending} disabled={!blob || label.trim() === ''} />
    </form>
  )
}
