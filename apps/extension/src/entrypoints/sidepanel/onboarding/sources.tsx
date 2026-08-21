import { PLAN_UPLOAD_LIMITS } from '@aff/shared'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { useGetAccount } from '../../../generated/endpoints/account/account.js'
import {
  addTextSource,
  getGetProfileQueryKey,
  uploadSource,
  useGetProfile,
} from '../../../generated/endpoints/profile/profile.js'
import type { ProfileSourcesItem } from '../../../generated/model/index.js'
import { formatCount } from '../../../lib/format.js'
import { formatBytes } from '../../../lib/source-file.js'
import { useVoiceNote } from '../../../lib/use-voice-note.js'
import {
  AutoTextarea,
  Button,
  Input,
  type Segment,
  SegmentedControl,
  StatusPill,
} from '../components.js'
import { IconAudio, IconDocument, IconLink, IconMic, IconText, IconUpload } from '../icons.js'
import { SourceTile } from '../screens/Sources.js'

/**
 * The step where the product stops being a claim.
 *
 * It is the "Add to your info" screen, inlined: the same segmented control over the same four
 * kinds, the same fields, the same footer submit. It is not a smaller bespoke version of that
 * screen, and it is not that screen behind an "Add source" button either, because you are already
 * here to add one.
 *
 * One button, and it is the flow's. Every kind used to carry its own primary action inside its own
 * card, sitting a few pixels above the flow's primary action in the footer, which is two buttons
 * asking the same question. So the draft is reported upward and the footer commits it: while
 * something is staged the footer adds it, and once something is added the footer moves on.
 *
 * Statuses are real. The profile is polled while anything is `pending` or `parsing` and the count
 * appears when it lands, because the one thing this screen must not do is claim to have read
 * something it has not.
 */

const ACCEPT = [
  '.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.md,.csv,.rtf,.json,.html,.epub',
  '.png,.jpg,.jpeg,.webp,.gif,.heic,.heif,.svg',
  '.mp3,.m4a,.wav,.ogg,.webm,.aac,.flac,.mp4,.mov',
].join(',')

type Mode = 'upload' | 'link' | 'text' | 'voice'

const MODES: Segment<Mode>[] = [
  { key: 'upload', label: 'File', icon: <IconDocument className="size-3.5" /> },
  { key: 'link', label: 'Link', icon: <IconLink className="size-3.5" /> },
  { key: 'text', label: 'Note', icon: <IconText className="size-3.5" /> },
  { key: 'voice', label: 'Voice', icon: <IconAudio className="size-3.5" /> },
]

/**
 * What the flow's footer needs to know about the half-finished thing on this screen.
 *
 * `submit` is stable for the life of the screen: it calls through a ref, so the footer can hold it
 * without the flow re-rendering every time a character is typed into the note.
 */
export interface SourceDraft {
  /** What the footer button should say, or null when there is nothing staged to add. */
  action: string | null
  pending: boolean
  error?: string
  submit: () => void
}

/** A label from a URL, so nobody has to name their own portfolio to add it. */
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

/* ── one added source ─────────────────────────────────────────────────────── */

/**
 * The same card as the list on "Your info", minus everything that acts.
 *
 * Rename, preview and remove all go through the navigation stack, and the flow renders instead of
 * that stack, so a menu here would open screens nobody can see. What is left is the part that
 * matters on this screen: the tile, the name, and whether we managed to read it.
 */
function AddedSource({ source }: { source: ProfileSourcesItem }) {
  const busy = source.status === 'pending' || source.status === 'parsing'

  return (
    <div className="pop overflow-hidden rounded-2xl border border-border-muted bg-surface-raised">
      <div className="flex items-start gap-3 p-3">
        <SourceTile source={source} />
        <div className="min-w-0 flex-1 pt-0.5">
          <p className="truncate text-base font-semibold text-ink">{source.label}</p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            {busy ? (
              <StatusPill tone="busy">Reading</StatusPill>
            ) : source.status === 'failed' ? (
              <StatusPill tone="bad">Couldn’t read</StatusPill>
            ) : source.extractedChars ? (
              <span className="text-xs font-semibold text-positive">
                {formatCount(source.extractedChars)} read
              </span>
            ) : (
              <span className="text-xs text-ink-dim">Kept</span>
            )}
          </div>
          {source.status === 'failed' && source.error && (
            <p className="mt-1 text-xs leading-snug text-danger">{source.error}</p>
          )}
        </div>
      </div>
      {busy && <div className="awaiting h-0.5 w-full" aria-hidden="true" />}
    </div>
  )
}

/* ── the step ─────────────────────────────────────────────────────────────── */

export function Sources({ onDraftChange }: { onDraftChange: (draft: SourceDraft) => void }) {
  const queryClient = useQueryClient()
  const account = useGetAccount()
  const plan = (account.data?.quota.plan ?? 'free') as keyof typeof PLAN_UPLOAD_LIMITS
  const maxBytes = PLAN_UPLOAD_LIMITS[plan]

  /*
    The same query key the panel already holds, so this is one request either way. What the flow
    adds is the interval; see the note on the poll in `index.tsx`, which owns it now so the count
    keeps arriving after this screen is gone.
  */
  const profile = useGetProfile()
  const sources = profile.data?.sources ?? []

  const [mode, setMode] = useState<Mode>('upload')
  const [dragging, setDragging] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [url, setUrl] = useState('')
  const [text, setText] = useState('')
  const voice = useVoiceNote()

  /*
    Nothing is counted here.

    The flow's footer gates on whether a source exists, and it reads that off the same profile query
    this screen invalidates. One subscription, one truth. An `onCountChange` callback was a second
    count of the same list, which is the shape of bug where Continue stays disabled beside a source
    that is plainly there.
  */
  const add = useMutation({
    mutationFn: async () => {
      if (mode === 'upload') {
        if (!file) return
        if (file.size > maxBytes) {
          throw new Error(
            `That file is over ${Math.round(maxBytes / 1024 / 1024)} MB. Try a smaller one.`,
          )
        }
        await uploadSource({ file, label: file.name.replace(/\.[^.]+$/, '').slice(0, 200) })
        return
      }
      if (mode === 'link') {
        const trimmed = url.trim()
        await addTextSource({ url: trimmed, label: labelFromUrl(trimmed) })
        return
      }
      if (mode === 'text') {
        await addTextSource({ text: text.trim() })
        return
      }
      // A recording needs no name. It is the only source whose label carries no information the
      // list does not already show, and asking for one was a whole extra field and button.
      const recording = voice.toFile('Voice note')
      if (!recording) return
      await uploadSource({ file: recording, label: 'Voice note' })
    },
    onSuccess: async () => {
      setFile(null)
      setUrl('')
      setText('')
      // The composer stays on screen, so a kept take has to be thrown away here. Otherwise it is
      // still staged, and the footer goes on offering to add the same recording again.
      voice.reset()
      await queryClient.invalidateQueries({ queryKey: getGetProfileQueryKey() })
    },
  })

  const urlValid = /^https?:\/\/\S+$/.test(url.trim())

  /** What is staged, and what the footer should call adding it. */
  const action =
    mode === 'upload'
      ? file
        ? 'Add this file'
        : null
      : mode === 'link'
        ? urlValid
          ? 'Read this page'
          : null
        : mode === 'text'
          ? text.trim().length >= 10
            ? 'Keep this note'
            : null
          : voice.blob && !voice.recording
            ? 'Keep this recording'
            : null

  /*
    Reported as primitives, with `submit` calling through a ref.

    The alternative — handing the footer a fresh object every render — either loops the effect or
    makes the flow re-render on every keystroke in the note.
  */
  const submitRef = useRef<() => void>(() => undefined)
  submitRef.current = () => add.mutate()
  const report = useRef(onDraftChange)
  report.current = onDraftChange

  const error = add.error ? (add.error as Error).message : undefined
  useEffect(() => {
    report.current({
      action,
      pending: add.isPending,
      error,
      submit: () => submitRef.current(),
    })
  }, [action, add.isPending, error])

  return (
    <div>
      <SegmentedControl segments={MODES} value={mode} onChange={setMode} label="Kind of source" />

      {mode === 'upload' && (
        /* biome-ignore lint/a11y/noStaticElementInteractions: the inner input is the control */
        <div
          onDragOver={(event) => {
            event.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault()
            setDragging(false)
            const dropped = event.dataTransfer.files[0]
            if (dropped) setFile(dropped)
          }}
          className={`mt-3 rounded-2xl border border-dashed px-gutter py-7 text-center transition-colors ${
            dragging ? 'border-accent bg-accent-muted' : 'border-border bg-surface-raised'
          }`}
        >
          <IconUpload className="mx-auto size-5 text-accent" />
          <p className="mt-2 text-sm font-semibold text-ink">
            {file ? file.name : 'Drop a file here'}
          </p>
          <p className="mt-1 text-2xs text-ink-dim">
            {file ? formatBytes(file.size) : 'PDF, Word, slides, images, audio.'}
          </p>
          {/*
            Our own button, with the native control hidden inside it. Same pattern, and the same
            reasoning, as `AddSource.tsx`: a native file input renders a "No file chosen" label
            beside its button and a box wider than both, so it cannot be centred under a centred
            heading.
          */}
          <label className="mt-3 inline-flex min-h-8 cursor-pointer items-center rounded-full border border-border bg-surface-raised px-3.5 text-xs font-semibold text-ink transition-colors focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent hover:border-ink/30 hover:bg-surface-muted">
            {file ? 'Choose another' : 'Choose file'}
            <input
              type="file"
              accept={ACCEPT}
              onChange={(event) => setFile(event.currentTarget.files?.[0] ?? null)}
              className="sr-only"
            />
          </label>
        </div>
      )}

      {mode === 'link' && (
        <div className="mt-3">
          <Input
            type="url"
            inputMode="url"
            aria-label="Address"
            value={url}
            onChange={(event) => setUrl(event.currentTarget.value)}
            placeholder="https://your-site.com/about"
          />
          <p className="mt-2 text-2xs leading-snug text-ink-dim">
            The words on the page are what get kept, not the address.
          </p>
        </div>
      )}

      {mode === 'text' && (
        <div className="mt-3">
          <AutoTextarea
            aria-label="Anything about you"
            minRows={6}
            value={text}
            onChange={(event) => setText(event.currentTarget.value)}
            placeholder="Paste a bio, a past answer you liked, the notes you keep re-typing into forms."
          />
        </div>
      )}

      {mode === 'voice' && (
        <div className="mt-3 rounded-2xl border border-border-muted bg-surface-raised px-gutter py-6 text-center">
          <p className="font-display text-2xl font-bold leading-none tabular-nums text-ink">
            {String(Math.floor(voice.seconds / 60)).padStart(2, '0')}:
            {String(voice.seconds % 60).padStart(2, '0')}
          </p>
          <p className="mt-1.5 text-2xs text-ink-dim">
            {voice.recording ? 'Recording' : voice.blob ? 'Ready' : 'Talk about your work'}
          </p>

          <Button
            size="sm"
            variant={voice.recording ? 'danger' : 'secondary'}
            className="mt-3"
            onClick={voice.recording ? voice.stop : () => void voice.start()}
          >
            <IconMic className="size-3.5" />
            {voice.recording ? 'Stop' : voice.blob ? 'Record again' : 'Start recording'}
          </Button>

          {voice.denied && (
            <div className="mt-3 flex flex-col items-center gap-2">
              <p className="text-2xs leading-snug text-danger" role="alert">
                {voice.denied}
              </p>
              {voice.permission === 'denied' && (
                <Button size="sm" variant="primary" onClick={voice.requestPermission}>
                  <IconMic className="size-3.5" />
                  Allow microphone
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      {sources.length > 0 && (
        <div className="mt-4 flex flex-col gap-2.5">
          {sources.map((source) => (
            <AddedSource key={source.id} source={source} />
          ))}
        </div>
      )}

      <p className="mt-3 text-2xs leading-relaxed text-ink-dim">
        Nothing here is shared. Delete any source later and its contents go with it. Up to{' '}
        {formatBytes(maxBytes)} a file.
      </p>
    </div>
  )
}
