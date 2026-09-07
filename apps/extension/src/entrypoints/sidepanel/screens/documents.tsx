import { useEffect, useState } from 'react'
import type { ProfileSourcesItem } from '../../../generated/model/index.js'
import { formatAddedOn, formatCount } from '../../../lib/format.js'
import { faviconUrl, formatBytes, hostnameOf, loadSourceFile } from '../../../lib/source-file.js'

/*
  What a document looks like in a list, wherever it is listed: the knowledge base, first-run
  setup, and the document's own screen share this so a résumé is the same 28px tile everywhere.
*/

export const KIND_NOUN: Record<string, string> = {
  document: 'Document',
  link: 'Link',
  text: 'Note',
  image: 'Image',
  audio: 'Voice note',
}

export function isBusy(source: ProfileSourcesItem): boolean {
  return source.status === 'pending' || source.status === 'parsing'
}

function formatLabel(source: ProfileSourcesItem): string {
  if (source.kind === 'link') return 'LINK'
  if (source.kind === 'text') return 'NOTE'
  const subtype = source.mediaType?.split('/')[1] ?? ''
  if (!subtype) return source.kind === 'audio' ? 'AUDIO' : 'FILE'
  const known: Record<string, string> = {
    pdf: 'PDF',
    'vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
    'vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'XLSX',
    'vnd.openxmlformats-officedocument.presentationml.presentation': 'PPTX',
    msword: 'DOC',
    'vnd.ms-excel': 'XLS',
    'vnd.ms-powerpoint': 'PPT',
    plain: 'TXT',
    markdown: 'MD',
    csv: 'CSV',
    jpeg: 'JPG',
    'epub+zip': 'EPUB',
    'svg+xml': 'SVG',
    webm: 'WEBM',
    mpeg: 'MP3',
    'x-wav': 'WAV',
    wav: 'WAV',
    mp4: 'MP4',
  }
  return known[subtype] ?? subtype.slice(0, 4).toUpperCase()
}

/**
 * One line under the name: where it came from, how much was read, when it was added.
 *
 * A link is named after its host by default, so repeating the host underneath said the same
 * word twice. When they match, the line says what kind of thing it is instead.
 */
export function documentMeta(source: ProfileSourcesItem): string {
  const host = source.kind === 'link' && source.url ? hostnameOf(source.url) : null
  return [
    host ? (host === source.label ? KIND_NOUN.link : host) : formatBytes(source.sizeBytes),
    !isBusy(source) && source.extractedChars ? `${formatCount(source.extractedChars)} read` : null,
    formatAddedOn(source.createdAt),
  ]
    .filter(Boolean)
    .join(' · ')
}

/** A 28px tile: the file type as a word, a favicon for a link, a thumbnail for an image. */
export function DocumentTile({ source }: { source: ProfileSourcesItem }) {
  const [preview, setPreview] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  const isImage = source.kind === 'image' && source.hasFile

  useEffect(() => {
    if (!isImage || source.status !== 'ready') return
    let revoke: (() => void) | undefined
    let live = true
    void loadSourceFile(source.id)
      .then((file) => {
        if (!live) return file.revoke()
        revoke = file.revoke
        setPreview(file.url)
      })
      .catch(() => setFailed(true))
    return () => {
      live = false
      revoke?.()
    }
  }, [isImage, source.id, source.status])

  const bad = source.status === 'failed'
  const label = formatLabel(source)

  return (
    <span
      className={`relative flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-md border ${
        bad ? 'border-danger/30 bg-danger-muted' : 'border-border-muted bg-surface-muted'
      }`}
    >
      {preview ? (
        <img src={preview} alt="" className="size-full object-cover" />
      ) : source.kind === 'link' && source.url && !failed ? (
        <img
          src={faviconUrl(source.url)}
          alt=""
          onError={() => setFailed(true)}
          className="size-3.5 rounded-sm"
        />
      ) : (
        <span
          className={`font-semibold leading-none ${
            label.length > 3 ? 'text-[8px] tracking-[-0.01em]' : 'text-[9px] tracking-[0.02em]'
          } ${bad ? 'text-danger' : 'text-ink-muted'}`}
        >
          {label}
        </span>
      )}
    </span>
  )
}
