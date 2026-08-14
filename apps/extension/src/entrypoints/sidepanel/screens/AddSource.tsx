import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  addTextSource,
  getGetProfileQueryKey,
  uploadSource,
  useGetProfile,
  usePatchProfile,
} from '../../../generated/endpoints/profile/profile.js'
import { formatBytes } from '../../../lib/source-file.js'
import {
  AutoTextarea,
  Button,
  Field,
  Input,
  Screen,
  ScreenBody,
  ScreenFooter,
  ScreenHeader,
} from '../components.js'
import { IconAudio, IconDocument, IconLink, IconMic, IconText, IconUpload } from '../icons.js'
import { useNavigation } from '../navigation.js'

const MAX_UPLOAD_BYTES = 15 * 1024 * 1024

type Mode = 'fact' | 'upload' | 'link' | 'text' | 'voice'

/**
 * Fact leads, because it is the cheapest thing anyone can give it.
 *
 * A notice period or a visa status takes ten seconds to type and answers a question no résumé
 * contains, whereas uploading a document is the largest commitment on this screen.
 */
const MODES: { key: Mode; label: string; icon: typeof IconDocument }[] = [
  { key: 'fact', label: 'Fact', icon: IconText },
  { key: 'upload', label: 'File', icon: IconDocument },
  { key: 'link', label: 'Link', icon: IconLink },
  { key: 'text', label: 'Note', icon: IconText },
  { key: 'voice', label: 'Voice', icon: IconAudio },
]

/**
 * Adding a source, as its own screen with one segmented control.
 *
 * Naming is required for files, links and recordings and skipped for pasted text, which is not
 * an inconsistency: `Document (3).pdf` and a bare URL are both unrecognisable in a list a month
 * later, while pasted text carries its own first line.
 */
export function AddSource() {
  const nav = useNavigation()
  const [mode, setMode] = useState<Mode>('fact')
  const queryClient = useQueryClient()

  /** Every path ends the same way: refresh the profile, return to the list. */
  const settle = async () => {
    await queryClient.invalidateQueries({ queryKey: getGetProfileQueryKey() })
    nav.back()
  }

  return (
    <Screen>
      <ScreenHeader title="Add a source" />

      {/*
        A segmented control, not a second tab strip. The old screen carried its own four tabs
        directly under the panel's other two, so the surface had two independent tab rows
        eleven pixels apart, neither of which was navigation.
      */}
      <div className="shrink-0 border-b border-guilloche bg-leaf px-4 py-2.5">
        <div
          role="tablist"
          aria-label="Kind of source"
          className="flex overflow-hidden rounded-doc border border-guilloche"
        >
          {MODES.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={mode === key}
              onClick={() => setMode(key)}
              className={`flex flex-1 items-center justify-center gap-1.5 border-r border-guilloche py-1.5 text-[12px] transition-colors last:border-r-0 ${
                mode === key
                  ? 'bg-ink font-medium text-stock'
                  : 'bg-leaf text-ink2 hover:bg-guilloche-soft hover:text-ink'
              }`}
            >
              <Icon className="size-3.5" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {mode === 'fact' && <FactMode onDone={settle} />}
      {mode === 'upload' && <UploadMode onDone={settle} />}
      {mode === 'link' && <LinkMode onDone={settle} />}
      {mode === 'text' && <TextMode onDone={settle} />}
      {mode === 'voice' && <VoiceMode onDone={settle} />}
    </Screen>
  )
}

function Submit({
  pending,
  disabled,
  error,
  label = 'Save source',
}: {
  pending: boolean
  disabled: boolean
  error: unknown
  label?: string
}) {
  return (
    <ScreenFooter>
      {error != null && (
        <p className="mb-2 text-[11.5px] leading-snug text-alert" role="alert">
          {(error as Error).message}
        </p>
      )}
      <Button type="submit" variant="plate" block loading={pending} disabled={disabled}>
        {pending ? 'Saving…' : label}
      </Button>
    </ScreenFooter>
  )
}

/**
 * One name, one value.
 *
 * Written straight into the profile's own key/value store rather than ingested as a document:
 * a fact is already structured, so there is nothing to extract, nothing to embed, and it
 * answers directly with no model call at the point of use.
 */
function FactMode({ onDone }: { onDone: () => Promise<void> }) {
  const queryClient = useQueryClient()
  const profile = useGetProfile()
  const [name, setName] = useState('')
  const [value, setValue] = useState('')

  const existing = profile.data?.custom ?? {}
  const duplicate = name.trim() !== '' && name.trim() in existing

  const save = usePatchProfile({
    mutation: {
      onSuccess: async (updated) => {
        queryClient.setQueryData(getGetProfileQueryKey(), updated)
        await onDone()
      },
    },
  })

  return (
    <form
      className="flex min-h-0 flex-1 flex-col"
      onSubmit={(event) => {
        event.preventDefault()
        save.mutate({ data: { custom: { ...existing, [name.trim()]: value.trim() } } })
      }}
    >
      <ScreenBody className="flex flex-col gap-4 p-4">
        <Field
          label="Name"
          hint="What a form would call it."
          error={duplicate ? 'You already have a fact by that name.' : undefined}
        >
          {({ id, describedBy }) => (
            <Input
              id={id}
              aria-describedby={describedBy}
              value={name}
              onChange={(event) => setName(event.currentTarget.value)}
              placeholder="Notice period"
            />
          )}
        </Field>

        <Field label="Value">
          {({ id, describedBy }) => (
            <Input
              id={id}
              aria-describedby={describedBy}
              value={value}
              onChange={(event) => setValue(event.currentTarget.value)}
              placeholder="6 weeks from signing"
            />
          )}
        </Field>

        <p className="text-[11.5px] leading-relaxed text-ink3">
          Facts are answered directly, word for word, with no guessing involved.
        </p>
      </ScreenBody>

      <Submit
        pending={save.isPending}
        disabled={!name.trim() || !value.trim() || duplicate}
        error={save.error}
        label="Save fact"
      />
    </form>
  )
}

function UploadMode({ onDone }: { onDone: () => Promise<void> }) {
  const [file, setFile] = useState<File | null>(null)
  const [label, setLabel] = useState('')
  const [dragging, setDragging] = useState(false)

  const tooBig = file !== null && file.size > MAX_UPLOAD_BYTES

  const save = useMutation({
    mutationFn: async () => {
      if (!file) return
      await uploadSource({ file, label: label.trim() })
    },
    onSuccess: onDone,
  })

  function accept(next: File | null) {
    if (!next) return
    setFile(next)
    // A starting point to edit, not a value to accept blindly.
    if (label.trim() === '') setLabel(next.name.replace(/\.[^.]+$/, ''))
  }

  return (
    <form
      className="flex min-h-0 flex-1 flex-col"
      onSubmit={(event) => {
        event.preventDefault()
        save.mutate()
      }}
    >
      <ScreenBody className="flex flex-col gap-4 p-4">
        {/* biome-ignore lint/a11y/noStaticElementInteractions: the inner input is the control */}
        <div
          onDragOver={(event) => {
            event.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault()
            setDragging(false)
            accept(event.dataTransfer.files[0] ?? null)
          }}
          className={`rounded-doc border border-dashed px-4 py-7 text-center transition-colors ${
            dragging ? 'border-query bg-query-wash' : 'border-guilloche bg-leaf'
          }`}
        >
          <IconUpload className="mx-auto size-5 text-ink3" />
          <p className="mt-2 text-[12.5px] text-ink">
            {file ? file.name : 'Drop a file here, or choose one'}
          </p>
          <p className="mrz mt-1 text-[11px] text-ink3">
            {file ? formatBytes(file.size) : 'PDF, Word, slides, images, audio — up to 15 MB'}
          </p>
          <input
            type="file"
            aria-label="Choose a file"
            onChange={(event) => accept(event.currentTarget.files?.[0] ?? null)}
            className="mt-3 w-full text-[11.5px] text-ink2 file:mr-2 file:rounded-doc file:border file:border-guilloche file:bg-leaf file:px-2 file:py-1 file:text-[11.5px] file:text-ink"
          />
        </div>

        <Field
          label="Name"
          error={tooBig ? 'That file is over 15 MB. Try a smaller one.' : undefined}
        >
          {({ id, describedBy }) => (
            <Input
              id={id}
              aria-describedby={describedBy}
              value={label}
              onChange={(event) => setLabel(event.currentTarget.value)}
              placeholder="Résumé — 2026"
            />
          )}
        </Field>
      </ScreenBody>

      <Submit
        pending={save.isPending}
        disabled={!file || tooBig || label.trim() === ''}
        error={save.error}
      />
    </form>
  )
}

function LinkMode({ onDone }: { onDone: () => Promise<void> }) {
  const [url, setUrl] = useState('')
  const [label, setLabel] = useState('')
  const [touched, setTouched] = useState(false)

  const save = useMutation({
    mutationFn: () => addTextSource({ url: url.trim(), label: label.trim() }),
    onSuccess: onDone,
  })

  const valid = /^https?:\/\/\S+$/.test(url.trim())

  return (
    <form
      className="flex min-h-0 flex-1 flex-col"
      onSubmit={(event) => {
        event.preventDefault()
        save.mutate()
      }}
    >
      <ScreenBody className="flex flex-col gap-4 p-4">
        <Field
          label="Address"
          error={
            touched && url.trim() !== '' && !valid ? 'Needs to start with https://' : undefined
          }
        >
          {({ id, describedBy }) => (
            <Input
              id={id}
              aria-describedby={describedBy}
              type="url"
              inputMode="url"
              value={url}
              onBlur={() => setTouched(true)}
              onChange={(event) => setUrl(event.currentTarget.value)}
              placeholder="https://your-site.com"
            />
          )}
        </Field>

        <Field label="What is this?" hint="So you recognise it in the list later.">
          {({ id, describedBy }) => (
            <Input
              id={id}
              aria-describedby={describedBy}
              value={label}
              onChange={(event) => setLabel(event.currentTarget.value)}
              placeholder="My portfolio"
            />
          )}
        </Field>

        <p className="text-[11.5px] leading-relaxed text-ink3">
          The page is read for you, and re-read as it changes.
        </p>
      </ScreenBody>

      <Submit
        pending={save.isPending}
        disabled={!valid || label.trim() === ''}
        error={save.error}
      />
    </form>
  )
}

function TextMode({ onDone }: { onDone: () => Promise<void> }) {
  const [text, setText] = useState('')
  const short = text.trim().length > 0 && text.trim().length < 10

  const save = useMutation({
    mutationFn: () => addTextSource({ text: text.trim() }),
    onSuccess: onDone,
  })

  return (
    <form
      className="flex min-h-0 flex-1 flex-col"
      onSubmit={(event) => {
        event.preventDefault()
        save.mutate()
      }}
    >
      <ScreenBody className="flex flex-col gap-4 p-4">
        <Field
          label="Anything about you"
          hint="No name needed — the first line becomes the label."
          error={short ? 'A little more than that, so there is something to read.' : undefined}
        >
          {({ id, describedBy }) => (
            <AutoTextarea
              id={id}
              aria-describedby={describedBy}
              minRows={10}
              value={text}
              onChange={(event) => setText(event.currentTarget.value)}
              placeholder="Paste a bio, notes, a past answer you liked, anything."
            />
          )}
        </Field>
      </ScreenBody>

      <Submit pending={save.isPending} disabled={text.trim().length < 10} error={save.error} />
    </form>
  )
}

/**
 * Voice notes.
 *
 * Recorded here rather than sending the user to find a recorder app: the whole reason to
 * support voice is that talking is faster than typing, and routing through the filesystem
 * gives that back. Memory transcribes it; we never do.
 */
function VoiceMode({ onDone }: { onDone: () => Promise<void> }) {
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

  // Releases the microphone if the panel closes mid-recording, so the browser stops showing a
  // recording indicator for a tab that is no longer capturing anything.
  useEffect(
    () => () => {
      for (const track of recorder.current?.stream.getTracks() ?? []) track.stop()
    },
    [],
  )

  // Recreating the object URL on every render leaked one per keystroke in the name field.
  const playbackUrl = useMemo(() => (blob ? URL.createObjectURL(blob) : null), [blob])
  useEffect(() => {
    if (!playbackUrl) return
    return () => URL.revokeObjectURL(playbackUrl)
  }, [playbackUrl])

  async function start() {
    setDenied(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const media = new MediaRecorder(stream)
      chunks.current = []
      media.ondataavailable = (event) => chunks.current.push(event.data)
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
      setDenied('Microphone access was refused. Allow it in your browser settings and try again.')
    }
  }

  const save = useMutation({
    mutationFn: async () => {
      if (!blob) return
      const file = new File([blob], `${label.trim() || 'Voice note'}.webm`, { type: 'audio/webm' })
      await uploadSource({ file, label: label.trim() })
    },
    onSuccess: onDone,
  })

  return (
    <form
      className="flex min-h-0 flex-1 flex-col"
      onSubmit={(event) => {
        event.preventDefault()
        save.mutate()
      }}
    >
      <ScreenBody className="flex flex-col gap-4 p-4">
        <div className="rounded-doc border border-guilloche bg-leaf px-4 py-6 text-center">
          <p className="mrz text-[26px] leading-none text-ink">
            {String(Math.floor(seconds / 60)).padStart(2, '0')}:
            {String(seconds % 60).padStart(2, '0')}
          </p>
          <p className="mt-2 text-[11.5px] text-ink3">
            {recording ? 'Recording' : blob ? 'Ready to save' : 'Talk about yourself'}
          </p>

          <Button
            variant={recording ? 'danger' : 'struck'}
            onClick={
              recording
                ? () => {
                    recorder.current?.stop()
                    setRecording(false)
                  }
                : start
            }
            className="mt-3"
          >
            <IconMic className="size-3.5" />
            {recording ? 'Stop' : blob ? 'Record again' : 'Start recording'}
          </Button>
        </div>

        {denied && (
          <p className="text-[11.5px] leading-snug text-alert" role="alert">
            {denied}
          </p>
        )}

        {playbackUrl && (
          <>
            {/* biome-ignore lint/a11y/useMediaCaption: the user just recorded this themselves */}
            <audio controls src={playbackUrl} className="w-full" />
            <Field label="Name">
              {({ id, describedBy }) => (
                <Input
                  id={id}
                  aria-describedby={describedBy}
                  value={label}
                  onChange={(event) => setLabel(event.currentTarget.value)}
                  placeholder="How I describe my work"
                />
              )}
            </Field>
          </>
        )}
      </ScreenBody>

      <Submit pending={save.isPending} disabled={!blob || label.trim() === ''} error={save.error} />
    </form>
  )
}
