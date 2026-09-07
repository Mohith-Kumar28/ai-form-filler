import { PLAN_UPLOAD_LIMITS } from '@aff/shared'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useGetAccount } from '../../../generated/endpoints/account/account.js'
import {
  addTextSource,
  getGetProfileQueryKey,
  uploadSource,
} from '../../../generated/endpoints/profile/profile.js'
import { formatBytes } from '../../../lib/source-file.js'
import { useVoiceNote } from '../../../lib/use-voice-note.js'
import {
  Body,
  Button,
  Field,
  Footer,
  Input,
  Note,
  type Segment,
  Segmented,
  Textarea,
} from '../components.js'
import { IconAudio, IconDocument, IconLink, IconMic, IconText, IconUpload } from '../icons.js'
import type { DocumentMode } from '../navigation.js'

/*
  Adding a document: a file, a link, a note, or a voice recording.

  One form, used by the Add screen and by first-run setup, so both save exactly the same way.
  It renders the scrolling body and the footer with the one Save button; whoever mounts it
  supplies the header.
*/

const ACCEPT = [
  '.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.md,.csv,.rtf,.json,.html,.epub',
  '.png,.jpg,.jpeg,.webp,.gif,.heic,.heif,.svg',
  '.mp3,.m4a,.wav,.ogg,.webm,.aac,.flac,.mp4,.mov',
].join(',')

const MODES: Segment<DocumentMode>[] = [
  { key: 'upload', label: 'File', icon: <IconDocument className="size-3.5" /> },
  { key: 'link', label: 'Link', icon: <IconLink className="size-3.5" /> },
  { key: 'text', label: 'Note', icon: <IconText className="size-3.5" /> },
  { key: 'voice', label: 'Voice', icon: <IconAudio className="size-3.5" /> },
]

function labelFromUrl(url: string): string {
  try {
    const { hostname, pathname } = new URL(url)
    const host = hostname.replace(/^www\./, '')
    const tail = pathname.replace(/\/+$/, '').split('/').filter(Boolean).pop()
    return tail ? `${host}/${tail}` : host
  } catch {
    return url.slice(0, 60)
  }
}

export function DocumentForm({
  initial = 'upload',
  onSaved,
  note,
}: {
  initial?: DocumentMode
  onSaved: () => void | Promise<void>
  /** A line under the form: setup uses it to say what happens to what is added. */
  note?: string
}) {
  const [mode, setMode] = useState<DocumentMode>(initial)
  const queryClient = useQueryClient()
  const account = useGetAccount()
  const plan = (account.data?.quota.plan ?? 'free') as keyof typeof PLAN_UPLOAD_LIMITS
  const maxBytes = PLAN_UPLOAD_LIMITS[plan]
  const maxMB = Math.round(maxBytes / 1024 / 1024)

  const [file, setFile] = useState<File | null>(null)
  const [fileLabel, setFileLabel] = useState('')
  const [dragging, setDragging] = useState(false)
  const [url, setUrl] = useState('')
  const [urlTouched, setUrlTouched] = useState(false)
  const [text, setText] = useState('')
  const [voiceLabel, setVoiceLabel] = useState('')
  const voice = useVoiceNote()

  const tooBig = file !== null && file.size > maxBytes
  const urlValid = /^https?:\/\/\S+$/.test(url.trim())
  const textShort = text.trim().length > 0 && text.trim().length < 10

  const save = useMutation({
    mutationFn: async () => {
      if (mode === 'upload') {
        if (!file) return
        await uploadSource({
          file,
          label: fileLabel.trim() || file.name.replace(/\.[^.]+$/, '').slice(0, 200),
        })
      } else if (mode === 'link') {
        const trimmed = url.trim()
        await addTextSource({ url: trimmed, label: labelFromUrl(trimmed) })
      } else if (mode === 'text') {
        await addTextSource({ text: text.trim() })
      } else {
        const recording = voice.toFile(voiceLabel || 'Voice note')
        if (!recording) return
        await uploadSource({ file: recording, label: voiceLabel.trim() || 'Voice note' })
      }
    },
    onSuccess: async () => {
      setFile(null)
      setFileLabel('')
      setUrl('')
      setUrlTouched(false)
      setText('')
      setVoiceLabel('')
      voice.reset()
      await queryClient.invalidateQueries({ queryKey: getGetProfileQueryKey() })
      await onSaved()
    },
  })

  const ready =
    mode === 'upload'
      ? file !== null && !tooBig
      : mode === 'link'
        ? urlValid
        : mode === 'text'
          ? text.trim().length >= 10
          : voice.blob !== null && !voice.recording

  const accept = (next: File | null) => {
    if (!next) return
    setFile(next)
    if (fileLabel.trim() === '') setFileLabel(next.name.replace(/\.[^.]+$/, ''))
  }

  return (
    <form
      className="flex min-h-0 flex-1 flex-col"
      onSubmit={(event) => {
        event.preventDefault()
        if (ready) save.mutate()
      }}
    >
      <Body className="px-gutter pb-3">
        <Segmented segments={MODES} value={mode} onChange={setMode} label="Kind of document" />

        <div className="mt-3 space-y-3">
          {mode === 'upload' && (
            <>
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
                className={`rounded-lg border border-dashed px-4 py-6 text-center transition-colors ${
                  dragging ? 'border-accent bg-accent-muted' : 'border-border bg-surface-raised'
                }`}
              >
                <IconUpload className="mx-auto size-5 text-ink-dim" />
                <p className="mt-2 truncate text-sm font-medium text-ink">
                  {file ? file.name : 'Drop a file here'}
                </p>
                <p className="mt-0.5 text-xs text-ink-dim">
                  {file
                    ? formatBytes(file.size)
                    : `PDF, Word, slides, images, audio · up to ${maxMB} MB`}
                </p>
                {/*
                  Our own button with the native control hidden inside it. `sr-only` rather than
                  `hidden` so the input keeps its place in the tab order and the label picks up
                  the focus ring on its behalf.
                */}
                <label className="mt-3 inline-flex h-7 cursor-pointer items-center rounded-md border border-border bg-surface-raised px-2.5 text-xs font-medium text-ink shadow-[0_1px_2px_var(--color-shadow)] transition-colors hover:bg-surface-muted focus-within:ring-2 focus-within:ring-accent">
                  {file ? 'Choose another' : 'Choose a file'}
                  <input
                    type="file"
                    accept={ACCEPT}
                    onChange={(event) => accept(event.currentTarget.files?.[0] ?? null)}
                    className="sr-only"
                  />
                </label>
              </div>
              {file && (
                <Field
                  label="Name"
                  error={tooBig ? `That file is over ${maxMB} MB. Try a smaller one.` : undefined}
                >
                  {({ id, describedBy }) => (
                    <Input
                      id={id}
                      aria-describedby={describedBy}
                      value={fileLabel}
                      onChange={(event) => setFileLabel(event.currentTarget.value)}
                      placeholder="Résumé 2026"
                    />
                  )}
                </Field>
              )}
            </>
          )}

          {mode === 'link' && (
            <Field
              label="Address"
              hint="The words on the page are what get kept, not the address."
              error={
                urlTouched && url.trim() !== '' && !urlValid
                  ? 'Needs to start with https://'
                  : undefined
              }
            >
              {({ id, describedBy }) => (
                <Input
                  id={id}
                  aria-describedby={describedBy}
                  type="url"
                  inputMode="url"
                  value={url}
                  onBlur={() => setUrlTouched(true)}
                  onChange={(event) => setUrl(event.currentTarget.value)}
                  placeholder="https://your-site.com/about"
                />
              )}
            </Field>
          )}

          {mode === 'text' && (
            <Field
              label="Anything about you"
              hint="The first line becomes the name."
              error={
                textShort ? 'A little more than that, so there is something to read.' : undefined
              }
            >
              {({ id, describedBy }) => (
                <Textarea
                  id={id}
                  aria-describedby={describedBy}
                  minRows={7}
                  value={text}
                  onChange={(event) => setText(event.currentTarget.value)}
                  placeholder="A bio, a past answer you liked, the notes you keep re-typing into forms."
                />
              )}
            </Field>
          )}

          {mode === 'voice' && (
            <>
              <div className="rounded-lg border border-border bg-surface-raised px-4 py-5 text-center">
                <p className="tnum text-2xl font-semibold leading-none text-ink">
                  {String(Math.floor(voice.seconds / 60)).padStart(2, '0')}:
                  {String(voice.seconds % 60).padStart(2, '0')}
                </p>
                <p className="mt-1.5 text-xs text-ink-dim">
                  {voice.recording
                    ? 'Recording'
                    : voice.blob
                      ? 'Ready to save'
                      : 'Talk about yourself'}
                </p>
                <Button
                  variant={voice.recording ? 'destructive' : 'secondary'}
                  size="sm"
                  onClick={voice.recording ? voice.stop : () => void voice.start()}
                  className="mt-3"
                >
                  <IconMic className="size-3.5" />
                  {voice.recording ? 'Stop' : voice.blob ? 'Record again' : 'Start recording'}
                </Button>
              </div>
              {voice.denied && (
                <div className="space-y-2">
                  <Note tone="danger">{voice.denied}</Note>
                  {voice.permission === 'denied' && (
                    <Button variant="primary" size="sm" onClick={voice.requestPermission}>
                      <IconMic className="size-3.5" />
                      Allow microphone
                    </Button>
                  )}
                </div>
              )}
              {voice.playbackUrl && (
                <>
                  {/* biome-ignore lint/a11y/useMediaCaption: a voice note the user recorded themselves */}
                  <audio controls src={voice.playbackUrl} className="w-full" />
                  <Field label="Name">
                    {({ id, describedBy }) => (
                      <Input
                        id={id}
                        aria-describedby={describedBy}
                        value={voiceLabel}
                        onChange={(event) => setVoiceLabel(event.currentTarget.value)}
                        placeholder="How I describe my work"
                      />
                    )}
                  </Field>
                </>
              )}
            </>
          )}

          {note && <p className="text-xs leading-relaxed text-ink-dim">{note}</p>}
        </div>
      </Body>

      <Footer>
        {save.isError && (
          <Note tone="danger" className="mb-2">
            {(save.error as Error).message}
          </Note>
        )}
        <Button
          type="submit"
          variant="primary"
          size="lg"
          block
          loading={save.isPending}
          disabled={!ready}
        >
          {save.isPending ? 'Saving…' : mode === 'link' ? 'Read this page' : 'Save'}
        </Button>
      </Footer>
    </form>
  )
}
