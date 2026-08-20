import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useGetAccount } from '../../../generated/endpoints/account/account.js'
import {
  addTextSource,
  getGetProfileQueryKey,
  uploadSource,
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
  type Segment,
  SegmentedControl,
} from '../components.js'
import { IconAudio, IconDocument, IconLink, IconMic, IconText, IconUpload } from '../icons.js'
import { useNavigation } from '../navigation.js'

const UPLOAD_LIMITS = {
  free: 15 * 1024 * 1024,
  pro: 30 * 1024 * 1024,
  ultra: 50 * 1024 * 1024,
} as const

type Mode = 'upload' | 'link' | 'text' | 'voice'

const MODES: Segment<Mode>[] = [
  { key: 'upload', label: 'File', icon: <IconDocument className="size-3.5" /> },
  { key: 'link', label: 'Link', icon: <IconLink className="size-3.5" /> },
  { key: 'text', label: 'Note', icon: <IconText className="size-3.5" /> },
  { key: 'voice', label: 'Voice', icon: <IconAudio className="size-3.5" /> },
]

/**
 * Adding a source, as its own screen with one segmented control.
 */
export function AddSource({ initial }: { initial?: Mode }) {
  const nav = useNavigation()
  const [mode, setMode] = useState<Mode>(initial ?? 'upload')
  const queryClient = useQueryClient()

  const settle = async () => {
    await queryClient.invalidateQueries({ queryKey: getGetProfileQueryKey() })
    nav.back()
  }

  return (
    <Screen>
      <ScreenHeader title="Add to your info" />

      <div className="shrink-0 px-4 py-3">
        <SegmentedControl segments={MODES} value={mode} onChange={setMode} label="Kind of source" />
      </div>

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
  label = 'Save',
}: {
  pending: boolean
  disabled: boolean
  error: unknown
  label?: string
}) {
  return (
    <ScreenFooter>
      {error != null && (
        <p className="mb-2 text-[12px] leading-snug text-danger" role="alert">
          {(error as Error).message}
        </p>
      )}
      <Button type="submit" variant="primary" block loading={pending} disabled={disabled}>
        {pending ? 'Saving…' : label}
      </Button>
    </ScreenFooter>
  )
}

function UploadMode({ onDone }: { onDone: () => Promise<void> }) {
  const [file, setFile] = useState<File | null>(null)
  const [label, setLabel] = useState('')
  const [dragging, setDragging] = useState(false)
  const account = useGetAccount()
  const plan = (account.data?.quota.plan ?? 'free') as keyof typeof UPLOAD_LIMITS
  const maxBytes = UPLOAD_LIMITS[plan]
  const maxMB = Math.round(maxBytes / 1024 / 1024)

  const tooBig = file !== null && file.size > maxBytes

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
          className={`rounded-2xl border border-dashed px-4 py-8 text-center transition-colors ${
            dragging ? 'border-accent bg-accent-muted' : 'border-border-muted bg-surface-raised'
          }`}
        >
          <IconUpload className="mx-auto size-5 text-ink-dim" />
          <p className="mt-2 text-[13px] font-semibold text-ink">
            {file ? file.name : 'Drop a file here, or choose one'}
          </p>
          <p className="mt-1 text-[12px] text-ink-dim">
            {file ? formatBytes(file.size) : `PDF, Word, slides, images, audio, up to ${maxMB} MB`}
          </p>
          <input
            type="file"
            aria-label="Choose a file"
            onChange={(event) => accept(event.currentTarget.files?.[0] ?? null)}
            className="mt-3 w-full text-[12px] text-ink-muted file:mr-2 file:rounded-full file:border file:border-border file:bg-surface-raised file:px-3 file:py-1.5 file:text-[12px] file:font-semibold file:text-ink"
          />
        </div>

        <Field
          label="Name"
          error={tooBig ? `That file is over ${maxMB} MB. Try a smaller one.` : undefined}
        >
          {({ id, describedBy }) => (
            <Input
              id={id}
              aria-describedby={describedBy}
              value={label}
              onChange={(event) => setLabel(event.currentTarget.value)}
              placeholder="Résumé 2026"
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

        <p className="text-[12px] leading-relaxed text-ink-dim">
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
          hint="No name needed. The first line becomes the label."
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

function VoiceMode({ onDone }: { onDone: () => Promise<void> }) {
  const [recording, setRecording] = useState(false)
  const [blob, setBlob] = useState<Blob | null>(null)
  const [seconds, setSeconds] = useState(0)
  const [denied, setDenied] = useState<string | null>(null)
  const [label, setLabel] = useState('')
  const [micPermission, setMicPermission] = useState<'unknown' | 'granted' | 'denied'>('unknown')

  const recorder = useRef<MediaRecorder | null>(null)
  const chunks = useRef<Blob[]>([])

  useEffect(() => {
    if (!recording) return
    const timer = setInterval(() => setSeconds((s) => s + 1), 1000)
    return () => clearInterval(timer)
  }, [recording])

  useEffect(
    () => () => {
      for (const track of recorder.current?.stream.getTracks() ?? []) track.stop()
    },
    [],
  )

  useEffect(() => {
    if (navigator.permissions?.query) {
      navigator.permissions
        .query({ name: 'microphone' as PermissionName })
        .then((result) => {
          setMicPermission(result.state as 'granted' | 'denied')
          result.onchange = () => setMicPermission(result.state as 'granted' | 'denied')
        })
        .catch(() => {})
    }
  }, [])

  const playbackUrl = useMemo(() => (blob ? URL.createObjectURL(blob) : null), [blob])
  useEffect(() => {
    if (!playbackUrl) return
    return () => URL.revokeObjectURL(playbackUrl)
  }, [playbackUrl])

  async function start() {
    setDenied(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      setMicPermission('granted')
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
      setMicPermission('denied')
      setDenied(
        'Microphone access is blocked. Click below to allow access, or enable it in your browser settings.',
      )
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
        <div className="rounded-2xl border border-border-muted bg-surface-raised px-4 py-6 text-center">
          <p className="font-display text-[30px] font-bold leading-none text-ink">
            {String(Math.floor(seconds / 60)).padStart(2, '0')}:
            {String(seconds % 60).padStart(2, '0')}
          </p>
          <p className="mt-2 text-[12px] text-ink-dim">
            {recording ? 'Recording' : blob ? 'Ready to save' : 'Talk about yourself'}
          </p>

          <Button
            variant={recording ? 'danger' : 'secondary'}
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
          <div className="flex flex-col items-center gap-2">
            <p className="text-[12px] leading-snug text-danger" role="alert">
              {denied}
            </p>
            {micPermission === 'denied' && (
              <Button variant="secondary" onClick={start}>
                <IconMic className="size-3.5" />
                Allow microphone
              </Button>
            )}
          </div>
        )}

        {playbackUrl && (
          <>
            {/* biome-ignore lint/a11y/useMediaCaption: a voice note the user recorded themselves */}
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
