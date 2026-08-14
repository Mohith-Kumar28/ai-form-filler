import { ApiErrorResponse } from '@aff/shared'
import type { Env } from '../env.js'
import { htmlToText } from './parse.js'

/**
 * Turns a URL into readable markdown.
 *
 * Uses Cloudflare's Browser Rendering `/markdown` quick action, which loads the page in a
 * real headless browser and returns structured markdown. That matters more than it sounds:
 * a portfolio or profile page is usually JS-rendered, so a plain `fetch` returns an empty
 * shell, and stripping tags out of the shell that does arrive yields navigation and footer
 * soup rather than prose.
 *
 * The Worker binding is used rather than the REST endpoint because the binding needs no
 * API token — one less credential to manage.
 */

/** Guards against a pathological page filling the profile document. */
const MAX_CHARS = 200_000

export interface FetchedPage {
  markdown: string
  truncated: boolean
  /** How the content was obtained, surfaced in the UI so a degraded fetch is visible. */
  via: 'browser' | 'fetch'
}

interface BrowserBinding {
  quickAction: (action: string, options: Record<string, unknown>) => Promise<Response>
}

function finish(text: string, via: FetchedPage['via']): FetchedPage {
  const trimmed = text.trim()
  return trimmed.length <= MAX_CHARS
    ? { markdown: trimmed, truncated: false, via }
    : { markdown: trimmed.slice(0, MAX_CHARS), truncated: true, via }
}

/**
 * Plain fetch plus tag stripping. Kept only as a fallback for when the binding is absent —
 * `wrangler dev` without the browser binding, or a Workers plan without Browser Rendering.
 * It cannot render JS, so it is strictly a degraded path.
 */
async function fetchAndStrip(url: string): Promise<FetchedPage> {
  let response: Response
  try {
    response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AIFormFiller/0.1)' },
      redirect: 'follow',
      signal: AbortSignal.timeout(15_000),
    })
  } catch {
    throw new ApiErrorResponse('UPSTREAM_ERROR', 'Could not reach that URL')
  }

  if (!response.ok) {
    throw new ApiErrorResponse(
      'UPSTREAM_ERROR',
      response.status === 403 || response.status === 999
        ? 'That site blocks automated access. Copy the page text and paste it instead.'
        : `That URL returned ${response.status}`,
    )
  }

  return finish(htmlToText(await response.text()), 'fetch')
}

export async function fetchUrlAsMarkdown(env: Env, rawUrl: string): Promise<FetchedPage> {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    throw new ApiErrorResponse('INVALID_REQUEST', 'That is not a valid URL')
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new ApiErrorResponse('INVALID_REQUEST', 'Only http and https URLs are supported')
  }

  const browser = (env as unknown as { BROWSER?: BrowserBinding }).BROWSER

  if (browser) {
    try {
      const response = await browser.quickAction('markdown', { url: url.toString() })
      if (response.ok) {
        const body = await response.text()
        // The quick action returns either raw markdown or Cloudflare's result envelope.
        let markdown = body
        try {
          const parsed = JSON.parse(body) as { result?: string | { markdown?: string } }
          const result = parsed.result
          if (typeof result === 'string') markdown = result
          else if (result?.markdown) markdown = result.markdown
        } catch {
          // Not JSON — already markdown.
        }
        if (markdown.trim().length > 0) return finish(markdown, 'browser')
      }
    } catch {
      // Rendering can fail on a slow or hostile page. Fall through rather than fail the
      // whole ingest — degraded content beats no content.
    }
  }

  const fallback = await fetchAndStrip(url.toString())

  if (fallback.markdown.length < 50) {
    throw new ApiErrorResponse(
      'INVALID_REQUEST',
      'That page had almost no readable text. Paste the content instead.',
    )
  }

  return fallback
}
