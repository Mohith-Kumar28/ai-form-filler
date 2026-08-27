/**
 * Page content as Markdown, read at fill time.
 *
 * The thin `collectPageContext` (title, meta, headings) tells the model what page it is on;
 * this tells it what the page *says* — the job description behind "why do you want to work
 * here", the event blurb behind "any dietary requirements". Only the extension can produce
 * this: the DOM in front of the user is authenticated and fully rendered, and no server-side
 * fetcher can ever see it.
 *
 * A walker rather than a converter library: the content script must stay ~20 kB (see HANDOFF
 * 7.10 — zod alone once took the bundle from 11 kB to 93 kB), and turndown-class tools
 * serialise the DOM to HTML first only to parse it straight back. Walking live nodes and
 * emitting markdown directly costs a couple of kilobytes and never materialises HTML at all.
 *
 * Called once per fill, never from detection — `detectPageForm` runs on every debounced DOM
 * mutation, and a full-document walk there would tax every page load for a scrape most loads
 * never need.
 */

const DEFAULT_MAX_CHARS = 12_000

/**
 * Tags whose entire subtree is chrome or machinery — never content worth answering from.
 *
 * The rule this list follows: **skip controls, never containers.** A container's tag says
 * nothing about whether the page's substance is inside it, and getting that wrong is silent —
 * the walk returns something, just not the thing that mattered.
 *
 * `FORM` was here and broke the feature everywhere it mattered. On any page whose content *is*
 * the form — a hosted form builder, a survey, a job posting, any single-page app that renders
 * question text and description inside `<form>` — the entire page went missing and only the
 * fragments outside it survived. Measured against a real saved form: 307 characters of the
 * host's legal footer, nothing about the actual subject. The model then answered from the
 * user's profile alone, which is indistinguishable from the feature being switched off.
 *
 * `DIALOG` went for the same reason. A form in a modal is a normal way to ship one, and an
 * open `<dialog>` is usually the only thing the user can see. A closed one needs no rule here:
 * it is `display: none`, so `isHidden` already has it.
 *
 * `HEADER` stays, and is the one container skip that is safe: a page-level banner is chrome,
 * and the heading text inside it is not lost either way — `collectPageContext` sends the title,
 * the meta description and every h1–h3 separately, on the same request.
 *
 * `INPUT` and `TEXTAREA` need no entry: they hold no text nodes.
 */
const SKIP_TAGS = new Set([
  'SCRIPT',
  'STYLE',
  'NOSCRIPT',
  'TEMPLATE',
  'SVG',
  'CANVAS',
  'IFRAME',
  'NAV',
  'HEADER',
  'FOOTER',
  'ASIDE',
  // Controls, not containers: their text is the widget's own label, never the page's prose.
  'SELECT',
  'OPTION',
  'BUTTON',
])

/**
 * Landmark roles that mean chrome around the content, matching the tag skips above.
 *
 * `button` is here because the tag list alone misses most real widgets: Google Forms builds
 * "Submit" and "Clear form" out of `<div role="button">`, not `<button>`, and so does every
 * other framework that wanted custom styling. Option text is unaffected — those carry
 * `radio`, `checkbox` or `option`, and they stay, since which choices a question offers is
 * context worth having.
 *
 * The tradeoff, stated because it is a real one: a clickable *card* is sometimes marked
 * `role="button"` around genuine prose. On the pages this runs for — a form being filled —
 * losing a card's blurb costs less than carrying every control label into the prompt.
 */
const SKIP_ROLES = new Set([
  'navigation',
  'banner',
  'complementary',
  'contentinfo',
  'search',
  'button',
])

/**
 * Class/id fragments that mark boilerplate regions.
 *
 * Deliberately a substring test over the joined id+class string: real-world class names are
 * compound (`jobDescription-sidebar`, `footer-nav`) and word-boundary regexes miss them.
 *
 * Substring matching cuts both ways, which is what `BOILERPLATE_MAX_TEXT` below is for.
 */
const BOILERPLATE = new RegExp(
  [
    'cookie',
    'banner',
    'sidebar',
    'footer',
    'nav',
    'advert',
    '\\bads?\\b',
    'related',
    'comment',
    'promo',
    'social',
    'share',
    'newsletter',
    'subscribe',
    'popup',
    'modal',
  ].join('|'),
  'i',
)

/**
 * Above this much text, a name match is not enough to discard a region.
 *
 * The names above are matched as substrings, so they hit things they were never aimed at:
 * `modal` and `popup` are how half the web wraps a form, and a class as innocent as
 * `docssharedWizToggleLabel` contains `share`. Discarding a region on its name alone therefore
 * risked throwing away the page itself — the same failure as skipping `<form>`, arriving by a
 * different route.
 *
 * The asymmetry decides it. Including a wordy cookie notice costs a few hundred wasted tokens;
 * excluding the form's own description costs the entire feature, silently. So size breaks the
 * tie: chrome is short by nature — a banner, a share row, a subscribe box — and 1000 characters
 * of prose under any name is the page having something to say.
 */
const BOILERPLATE_MAX_TEXT = 1000

/** Our own shadow-DOM host; without this the launcher scrapes itself into every prompt. */
const OVERLAY_HOST_ID = 'aff-overlay-host'

/** Below this, a "main" region is mislabelled decoration and body text serves better. */
const MIN_ROOT_TEXT = 80

/** Single-space collapse without trimming — edge spaces separate adjacent inline nodes. */
function collapse(text: string): string {
  return text.replace(/\s+/g, ' ')
}

function isHidden(el: Element): boolean {
  if (el.getAttribute('aria-hidden') === 'true') return true
  if (el.hasAttribute('hidden')) return true

  // Best-effort: happy-dom computes styles differently from Chrome, so a throw or an odd
  // answer here degrades to reading slightly more text, never to failing the walk.
  try {
    const style = el.ownerDocument.defaultView?.getComputedStyle(el)
    if (style && (style.display === 'none' || style.visibility === 'hidden')) return true
  } catch {
    // Attribute checks above still apply.
  }
  return false
}

function isSkippable(el: Element): boolean {
  if (SKIP_TAGS.has(el.tagName)) return true
  if (el.id === OVERLAY_HOST_ID) return true
  const role = el.getAttribute('role')
  if (role && SKIP_ROLES.has(role)) return true

  if (!BOILERPLATE.test(`${el.id} ${el.getAttribute('class') ?? ''}`)) return false
  return (el.textContent?.length ?? 0) <= BOILERPLATE_MAX_TEXT
}

/**
 * The region whose text is the page's point.
 *
 * Preferring `main`/`article` over body is half of the cost control: on a well-structured
 * page the answer-relevant prose lives there, so the walk reaches the budget before it ever
 * sees the footer. Largest-candidate wins because pages nest them (`<main>` wrapping three
 * `<article>`s) and any single one can be a card rather than the content.
 */
function selectRoot(doc: Document): Element {
  let best: Element | null = null
  let bestLength = 0
  for (const el of doc.querySelectorAll('main, [role="main"], article')) {
    const length = el.textContent?.length ?? 0
    if (length > bestLength) {
      best = el
      bestLength = length
    }
  }
  return best && bestLength >= MIN_ROOT_TEXT ? best : doc.body
}

/**
 * Inline content of a leaf block: collapsed text with links kept as `[label](url)` — a link's
 * href often names what its label does not ("apply" → the ATS posting), and markdown renders
 * both compactly.
 */
function inlineMarkdown(node: Node): string {
  if (node.nodeType === node.TEXT_NODE) return collapse(node.textContent ?? '')
  if (node.nodeType !== node.ELEMENT_NODE) return ''
  const el = node as Element
  if (el.tagName === 'BR') return '\n'
  if (SKIP_TAGS.has(el.tagName)) return ''

  const inner = Array.from(el.childNodes).map(inlineMarkdown).join('').replace(/\n\s*/g, ' ')

  if (el.tagName === 'A') {
    const href = el.getAttribute('href')
    const label = inner.trim() || el.getAttribute('title')?.trim() || ''
    if (href && !/^\s*javascript:/i.test(href)) {
      try {
        const absolute = new URL(href, el.ownerDocument.baseURI)
        if (absolute.protocol === 'http:' || absolute.protocol === 'https:') {
          return label ? `[${label}](${absolute.href})` : ''
        }
      } catch {
        // Unresolvable href: fall through and keep the label as plain text.
      }
    }
  }
  return inner
}

export interface PageMarkdownOptions {
  /** Hard stop. Once reached the walk ends mid-document; main-region preference puts the content first. */
  maxChars?: number
}

/**
 * The page's relevant content as Markdown, capped at `maxChars` (default 12_000 ≈ 3.3k tokens).
 *
 * Returns '' when nothing meaningful was collected — SPA shells, empty tabs — which callers
 * treat as "no page context today", exactly as before this existed.
 */
export function collectPageMarkdown(doc: Document, options?: PageMarkdownOptions): string {
  const maxChars = options?.maxChars ?? DEFAULT_MAX_CHARS
  const lines: string[] = []
  let used = 0

  const push = (line: string): boolean => {
    const trimmed = line.trim()
    if (!trimmed) return true
    if (used >= maxChars) return false
    const remaining = maxChars - used
    lines.push(trimmed.length > remaining ? trimmed.slice(0, remaining) : trimmed)
    used += Math.min(trimmed.length, remaining) + 1
    return used < maxChars
  }

  const emitBlock = (text: string): boolean => {
    if (!push(text)) return false
    lines.push('')
    // The blank line is a newline too — count it or the cap leaks by one per block.
    used += 1
    return used < maxChars
  }

  const visit = (el: Element): boolean => {
    if (isSkippable(el) || isHidden(el)) return true

    const tag = el.tagName
    if (/^H[1-6]$/.test(tag)) {
      return emitBlock(`${'#'.repeat(Math.min(Number(tag[1]), 4))} ${inlineMarkdown(el)}`)
    }

    /**
     * `role="heading"` counts as a heading, because on a real page it usually is one.
     *
     * Component libraries and hosted form builders routinely ship headings as
     * `<div role="heading" aria-level="2">` rather than `<h2>` — a form's own title arrives that
     * way. Reading only real heading tags left those as undifferentiated paragraphs, so the
     * markdown had no structure at exactly the point where structure says what the page is.
     * `aria-level` is honoured when present and sane; 2 is the fallback ARIA itself implies.
     */
    if (el.getAttribute('role') === 'heading') {
      const level = Number(el.getAttribute('aria-level'))
      const depth = Number.isInteger(level) && level >= 1 && level <= 6 ? level : 2
      return emitBlock(`${'#'.repeat(Math.min(depth, 4))} ${inlineMarkdown(el)}`)
    }
    if (tag === 'P' || tag === 'BLOCKQUOTE') {
      return emitBlock(inlineMarkdown(el))
    }
    if (tag === 'LI') {
      return emitBlock(`- ${inlineMarkdown(el)}`)
    }
    if (tag === 'TR') {
      const cells = Array.from(el.children)
        .filter((c) => c.tagName === 'TD' || c.tagName === 'TH')
        .map((c) => collapse(c.textContent ?? '').trim())
        .filter(Boolean)
      return cells.length > 0 ? emitBlock(cells.join(' | ')) : true
    }

    // Container: direct text nodes become their own line, then descend. This is what makes
    // div-soup readable — ATS markup rarely bothers with <p> around anything.
    for (const node of Array.from(el.childNodes)) {
      if (node.nodeType === node.TEXT_NODE) {
        const text = collapse(node.textContent ?? '')
        if (text.length > 1 && !emitBlock(text)) return false
      } else if (node.nodeType === node.ELEMENT_NODE) {
        if (!visit(node as Element)) return false
      }
    }
    return used < maxChars
  }

  visit(selectRoot(doc))

  return (
    lines
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
      // The API fences everything inside <page> ... </page>; a literal closing tag in page
      // content could break out of the fence and turn data into instructions.
      .replace(/<\/page/gi, '<\\/page')
  )
}
