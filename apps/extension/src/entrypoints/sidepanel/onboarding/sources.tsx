import { PLAN_UPLOAD_LIMITS } from '@aff/shared'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
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
import { AutoTextarea, Button, Input, StatusPill } from '../components.js'
import {
  IconAudio,
  IconCheck,
  IconDocument,
  IconLink,
  IconMic,
  IconText,
  IconUpload,
} from '../icons.js'

/**
 * The step where the product stops being a claim.
 *
 * A file, a link, a voice note or a paste, and then the thing worth watching: the source going from
 * "Reading" to "18,431 characters read". That number is the whole argument of the screen — people
 * assume a link is filed as a bookmark, and the difference between this product and a password
 * manager is that the page behind the link is fetched, read and kept. So the count is not
 * decoration; it is the receipt.
 *
 * Statuses are real. The list polls while anything is `pending` or `parsing`, and stops as soon as
 * nothing is — no fake progress bar, because the one thing this screen must not do is claim to have
 * read something it has not.
 */

const ACCEPT = [
  '.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.md,.csv,.rtf,.json,.html,.epub',
  '.png,.jpg,.jpeg,.webp,.gif,.heic,.heif,.svg',
  '.mp3,.m4a,.wav,.ogg,.webm,.aac,.flac,.mp4,.mov',
].join(',')

type Composer = 'link' | 'text' | 'voice' | null

const KIND_ICON = {
  file: <IconDocument className="size-3.5" />,
  url: <IconLink className="size-3.5" />,
  text: <IconText className="size-3.5" />,
  audio: <IconAudio className="size-3.5" />,
  image: <IconDocument className="size-3.5" />,
} as const

function iconFor(kind: string) {
  return KIND_ICON[kind as keyof typeof KIND_ICON] ?? <IconDocument className="size-3.5" />
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

function SourceRow({ source }: { source: ProfileSourcesItem }) {
  const busy = source.status === 'pending' || source.status === 'parsing'

  return (
    <li className="pop flex items-center gap-2.5 py-2.5">
      <span
        className={`flex size-7 shrink-0 items-center justify-center rounded-full ${
          source.status === 'failed'
            ? 'bg-danger-muted text-danger'
            : busy
              ? 'bg-surface-muted text-ink-muted'
              : 'bg-positive-muted text-positive'
        }`}
      >
        {iconFor(source.kind)}
      </span>

      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-ink">{source.label}</span>
        <span className="block truncate text-2xs text-ink-dim">
          {busy ? (
            'Reading what is inside it…'
          ) : source.status === 'failed' ? (
            (source.error ?? 'Could not read this one.')
          ) : source.extractedChars ? (
            <span className="font-semibold text-positive">
              {formatCount(source.extractedChars)} characters read
            </span>
          ) : (
            'In your knowledge base'
          )}
        </span>
      </span>

      {busy ? (
        <StatusPill tone="busy">Reading</StatusPill>
      ) : source.status === 'failed' ? (
        <StatusPill tone="bad">Failed</StatusPill>
      ) : (
        <IconCheck className="size-4 shrink-0 text-positive" />
      )}
    </li>
  )
}

/* ── the step ─────────────────────────────────────────────────────────────── */

export function Sources() {
  const queryClient = useQueryClient()
  const account = useGetAccount()
  const plan = (account.data?.quota.plan ?? 'free') as keyof typeof PLAN_UPLOAD_LIMITS
  const maxBytes = PLAN_UPLOAD_LIMITS[plan]

  /**
   * Its own subscription to the profile, with a poll attached.
   *
   * Same query key as the one the panel already holds, so this is one request either way — what it
   * adds is an interval, and only while something is actually being read. A source takes a few
   * seconds to parse and the count on it appears when it lands; without the poll the user would sit
   * looking at "Reading" until they navigated away and back.
   */
  const profile = useGetProfile({
    query: {
      refetchInterval: (query) =>
        (query.state.data?.sources ?? []).some(
          (source) => source.status === 'pending' || source.status === 'parsing',
        )
          ? 2000
          : false,
    },
  })

  const sources = profile.data?.sources ?? []
  const readChars = sources.reduce((total, source) => total + (source.extractedChars ?? 0), 0)

  const [composer, setComposer] = useState<Composer>(null)
  const [dragging, setDragging] = useState(false)
  const [url, setUrl] = useState('')
  const [text, setText] = useState('')
  const [voiceLabel, setVoiceLabel] = useState('')
  const voice = useVoiceNote()

  /*
    Nothing is reported upward.

    The flow's footer gates on whether a source exists, and it reads that off the same profile query
    this screen invalidates — one subscription, one truth. An `onCountChange` callback here was a
    second count of the same list, which is the shape of bug where Continue stays disabled beside a
    source that is plainly there.
  */
  const settle = async () => {
    setComposer(null)
    setUrl('')
    setText('')
    setVoiceLabel('')
    await queryClient.invalidateQueries({ queryKey: getGetProfileQueryKey() })
  }

  const add = useMutation({
    mutationFn: async (input: File | { url: string } | { text: string }) => {
      if (input instanceof File) {
        if (input.size > maxBytes) {
          throw new Error(
            `That file is over ${Math.round(maxBytes / 1024 / 1024)} MB. Try a smaller one.`,
          )
        }
        await uploadSource({ file: input, label: input.name.replace(/\.[^.]+$/, '').slice(0, 200) })
        return
      }
      if ('url' in input) {
        await addTextSource({ url: input.url.trim(), label: labelFromUrl(input.url.trim()) })
        return
      }
      await addTextSource({ text: input.text.trim() })
    },
    onSuccess: () => void settle(),
  })

  const urlValid = /^https?:\/\/\S+$/.test(url.trim())

  return (
    <div>
      {/*
        One target, sized like it means it.

        A résumé is the source that answers the most fields, so it gets the whole width and the
        drop behaviour, and everything else is a small button underneath. The alternative — four
        equal tabs — makes the user choose before they have any reason to prefer one.
      */}
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
          const file = event.dataTransfer.files[0]
          if (file) add.mutate(file)
        }}
        className={`rounded-2xl border border-dashed px-gutter py-6 text-center transition-colors ${
          dragging ? 'border-accent bg-accent-muted' : 'border-border bg-surface-raised'
        }`}
      >
        <IconUpload className="mx-auto size-5 text-accent" />
        <p className="mt-2 text-sm font-semibold text-ink">Drop your résumé in</p>
        <p className="mt-1 text-2xs leading-snug text-ink-dim">
          PDF, Word, slides, images, audio. It is read once and kept as text.
        </p>
        <input
          type="file"
          aria-label="Choose a file"
          accept={ACCEPT}
          disabled={add.isPending}
          onChange={(event) => {
            const file = event.currentTarget.files?.[0]
            if (file) add.mutate(file)
          }}
          className="mt-3 w-full text-xs text-ink-muted file:mr-2 file:rounded-full file:border file:border-border file:bg-surface-raised file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-ink"
        />
      </div>

      <div className="mt-2.5 grid grid-cols-3 gap-2">
        {(
          [
            { key: 'link', label: 'Link', icon: <IconLink className="size-3.5" /> },
            { key: 'text', label: 'Note', icon: <IconText className="size-3.5" /> },
            { key: 'voice', label: 'Voice', icon: <IconAudio className="size-3.5" /> },
          ] as const
        ).map((option) => (
          <Button
            key={option.key}
            size="sm"
            variant={composer === option.key ? 'primary' : 'secondary'}
            onClick={() => setComposer(composer === option.key ? null : option.key)}
          >
            {option.icon}
            {option.label}
          </Button>
        ))}
      </div>

      {composer === 'link' && (
        <div className="pop mt-2.5 rounded-2xl border border-border-muted bg-surface-raised p-3">
          <Input
            type="url"
            inputMode="url"
            aria-label="Address"
            value={url}
            onChange={(event) => setUrl(event.currentTarget.value)}
            placeholder="https://your-site.com/about"
          />
          <p className="mt-2 text-2xs leading-snug text-ink-dim">
            The page is fetched and read — the words on it are what get kept, not the address. It is
            re-read as the page changes.
          </p>
          <Button
            variant="primary"
            block
            size="sm"
            className="mt-2.5"
            loading={add.isPending}
            disabled={!urlValid}
            onClick={() => add.mutate({ url })}
          >
            Read this page
          </Button>
        </div>
      )}

      {composer === 'text' && (
        <div className="pop mt-2.5 rounded-2xl border border-border-muted bg-surface-raised p-3">
          <AutoTextarea
            aria-label="Anything about you"
            minRows={5}
            value={text}
            onChange={(event) => setText(event.currentTarget.value)}
            placeholder="Paste a bio, a past answer you liked, the notes you keep re-typing into forms."
          />
          <Button
            variant="primary"
            block
            size="sm"
            className="mt-2.5"
            loading={add.isPending}
            disabled={text.trim().length < 10}
            onClick={() => add.mutate({ text })}
          >
            Keep this
          </Button>
        </div>
      )}

      {composer === 'voice' && (
        <div className="pop mt-2.5 rounded-2xl border border-border-muted bg-surface-raised p-3 text-center">
          <p className="font-display text-xl font-bold leading-none tabular-nums text-ink">
            {String(Math.floor(voice.seconds / 60)).padStart(2, '0')}:
            {String(voice.seconds % 60).padStart(2, '0')}
          </p>
          <p className="mt-1.5 text-2xs text-ink-dim">
            {voice.recording
              ? 'Recording — say what you do, in your own words'
              : voice.blob
                ? 'Ready to keep'
                : 'Talk for a minute about your work. It is transcribed and read.'}
          </p>

          <Button
            size="sm"
            variant={voice.recording ? 'danger' : 'secondary'}
            className="mt-2.5"
            onClick={voice.recording ? voice.stop : () => void voice.start()}
          >
            <IconMic className="size-3.5" />
            {voice.recording ? 'Stop' : voice.blob ? 'Record again' : 'Start recording'}
          </Button>

          {voice.denied && (
            <div className="mt-2.5 flex flex-col items-center gap-2">
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

          {voice.playbackUrl && (
            <>
              {/* biome-ignore lint/a11y/useMediaCaption: a voice note the user recorded themselves */}
              <audio controls src={voice.playbackUrl} className="mt-2.5 w-full" />
              <Input
                aria-label="Name for this note"
                value={voiceLabel}
                onChange={(event) => setVoiceLabel(event.currentTarget.value)}
                placeholder="How I describe my work"
                className="mt-2"
              />
              <Button
                variant="primary"
                block
                size="sm"
                className="mt-2.5"
                loading={add.isPending}
                disabled={voiceLabel.trim() === ''}
                onClick={() => {
                  const file = voice.toFile(voiceLabel)
                  if (file) add.mutate(file)
                }}
              >
                Keep this note
              </Button>
            </>
          )}
        </div>
      )}

      {add.isError && (
        <p className="mt-2.5 text-xs leading-snug text-danger" role="alert">
          {(add.error as Error).message}
        </p>
      )}

      {add.isPending && !composer && (
        <p className="mt-2.5 text-xs text-ink-muted" aria-live="polite">
          Uploading…
        </p>
      )}

      {sources.length > 0 && (
        <div className="mt-4 border-t border-border-muted pt-3">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-xs font-semibold text-ink-muted">
              {sources.length} {sources.length === 1 ? 'source' : 'sources'}
            </p>
            {readChars > 0 && (
              <p className="text-2xs text-ink-dim">
                <span className="font-bold tabular-nums text-positive">
                  {formatCount(readChars)}
                </span>{' '}
                characters read
              </p>
            )}
          </div>
          <ul className="mt-1 divide-y divide-border-muted">
            {sources.map((source) => (
              <SourceRow key={source.id} source={source} />
            ))}
          </ul>
        </div>
      )}

      <p className="mt-3 text-2xs leading-relaxed text-ink-dim">
        Nothing here is shared with anyone. Files are kept so you can download them again; you can
        delete any source, and its contents go with it. Up to {formatBytes(maxBytes)} a file.
      </p>
    </div>
  )
}
