import type { SourceKind } from '@aff/shared'

/**
 * What an upload is, and whether we will take it.
 *
 * The old rule was a five-entry allowlist of things *we* could parse — PDF and a few image
 * types — and everything else was refused with "paste the text instead". We no longer parse
 * anything: memory does extraction, including formats we have no reader for at all. So the
 * only sensible policy is to take what memory can use and stop guarding a capability we no
 * longer implement.
 */

/** 15 MB. Above this an upload is a video or a scan set, and the round trip stops being free. */
export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024

/**
 * Extension to media type, for the many browsers and platforms that send an empty or wrong
 * `File.type` — which is most of them for anything that is not a web-native format.
 */
const BY_EXTENSION: Record<string, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  txt: 'text/plain',
  md: 'text/markdown',
  csv: 'text/csv',
  rtf: 'application/rtf',
  json: 'application/json',
  html: 'text/html',
  epub: 'application/epub+zip',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  heic: 'image/heic',
  heif: 'image/heif',
  svg: 'image/svg+xml',
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  webm: 'audio/webm',
  aac: 'audio/aac',
  flac: 'audio/flac',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
}

export function mediaTypeFor(file: { type: string; name: string }): string {
  const extension = file.name.toLowerCase().split('.').pop() ?? ''
  // The extension wins over a browser-supplied type only when the browser gave us nothing
  // useful — `application/octet-stream` is what Safari sends for half of these.
  if (file.type && file.type !== 'application/octet-stream') return file.type
  return BY_EXTENSION[extension] ?? 'application/octet-stream'
}

/** The medium, which is what the interface renders and how a preview is opened. */
export function sourceKindFor(mediaType: string): SourceKind {
  if (mediaType.startsWith('image/')) return 'image'
  if (mediaType.startsWith('audio/') || mediaType.startsWith('video/')) return 'audio'
  return 'document'
}

/**
 * Images and PDFs render inline in a browser tab; everything else must download, and
 * serving a .docx as inline is how you get a blank tab instead of a file.
 */
export function isPreviewableInline(mediaType: string): boolean {
  return mediaType.startsWith('image/') || mediaType === 'application/pdf'
}
