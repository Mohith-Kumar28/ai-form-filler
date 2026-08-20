import { ApiErrorResponse } from '@aff/shared'
import { normalizeText } from './compile.js'

/** Guards against a pathological upload filling the profile document and the context window. */
const MAX_EXTRACTED_CHARS = 200_000

export interface ParsedSource {
  text: string
  /** Set when the source was truncated, so the UI can say so rather than silently losing data. */
  truncated: boolean
}

function finish(raw: string): ParsedSource {
  const normalized = normalizeText(raw)
  if (normalized.length <= MAX_EXTRACTED_CHARS) {
    return { text: normalized, truncated: false }
  }
  return { text: normalized.slice(0, MAX_EXTRACTED_CHARS), truncated: true }
}

/**
 * Minimal HTML-to-text. Not a full parser — it strips the elements that carry no prose and
 * collapses what's left. Good enough for a GitHub profile or a portfolio page; deliberately
 * not attempting to defeat a JS-rendered SPA, which would need a headless browser.
 */
export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style|noscript|svg|head)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<\/(p|div|section|article|li|tr|h[1-6])>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
}

export async function parseUrl(url: string): Promise<ParsedSource> {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new ApiErrorResponse('INVALID_REQUEST', 'That is not a valid URL')
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new ApiErrorResponse('INVALID_REQUEST', 'Only http and https URLs are supported')
  }

  let response: Response
  try {
    response = await fetch(parsed.toString(), {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AIFormFiller/0.1)' },
      redirect: 'follow',
      signal: AbortSignal.timeout(15_000),
    })
  } catch {
    throw new ApiErrorResponse('UPSTREAM_ERROR', 'Could not reach that URL')
  }

  if (!response.ok) {
    // LinkedIn in particular blocks unauthenticated fetches, so name the workaround.
    throw new ApiErrorResponse(
      'UPSTREAM_ERROR',
      response.status === 403 || response.status === 999
        ? 'That site blocks automated access. Copy the page text and paste it instead.'
        : `That URL returned ${response.status}`,
    )
  }

  const body = await response.text()
  const text = finish(htmlToText(body))

  if (text.text.length < 50) {
    throw new ApiErrorResponse(
      'INVALID_REQUEST',
      'That page had almost no readable text. It may need JavaScript, so paste the text instead.',
    )
  }

  return text
}

export function parseFreeform(text: string): ParsedSource {
  const result = finish(text)
  if (result.text.length === 0) {
    throw new ApiErrorResponse('INVALID_REQUEST', 'Source text is empty')
  }
  return result
}
