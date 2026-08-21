import type { FormSchema } from '@aff/shared'
import { AtsAdapter } from './ats.js'
import { GenericAdapter } from './generic.js'
import { GoogleFormsAdapter } from './google-forms.js'
import { isActualForm } from './substance.js'
import type { DetectionResult, FormAdapter } from './types.js'

export { AtsAdapter } from './ats.js'
export { GenericAdapter } from './generic.js'
export { GoogleFormsAdapter } from './google-forms.js'
export * from './label.js'
export * from './substance.js'
export * from './types.js'
export * from './write.js'

const genericAdapter = new GenericAdapter()

/**
 * Site adapters, most specific first. The generic adapter is the terminal fallback and is
 * deliberately not in this list — `selectAdapter` returns it only when nothing else claims
 * the URL, so a site adapter can never be shadowed by it.
 */
const siteAdapters: FormAdapter[] = [new GoogleFormsAdapter(), new AtsAdapter()]

export function selectAdapter(url: URL): FormAdapter {
  return siteAdapters.find((adapter) => adapter.matches(url)) ?? genericAdapter
}

export function registerAdapter(adapter: FormAdapter): void {
  siteAdapters.push(adapter)
}

/** Page text near the form, giving the model the company and role for "why this company". */
function collectPageContext(doc: Document, limit = 4000): string {
  const headings = [...doc.querySelectorAll('h1, h2, h3')]
    .map((h) => h.textContent?.replace(/\s+/g, ' ').trim() ?? '')
    .filter(Boolean)

  const title = doc.title?.trim() ?? ''
  const meta = doc.querySelector('meta[name="description"]')?.getAttribute('content')?.trim() ?? ''

  return [title, meta, ...headings].filter(Boolean).join('\n').slice(0, limit)
}

/**
 * Detects the page's form and produces both halves: the serialisable `FormSchema` for the
 * server, and the `fieldId → element` map that stays in the content script.
 *
 * The map never crosses a message boundary — DOM nodes are not serialisable, and keeping
 * elements local means the server never receives a selector it could be tricked into
 * acting on.
 */
export function detectPageForm(doc: Document, url: URL): DetectionResult | null {
  const adapter = selectAdapter(url)
  const forms = adapter.detectForms(doc)
  if (forms.length === 0) return null

  // Largest form wins. A page with a search box and an application form should fill the
  // application, and field count is a better proxy for "the real form" than DOM order.
  const primary = forms.reduce((best, candidate) =>
    candidate.fields.length > best.fields.length ? candidate : best,
  )

  const elements = new Map(primary.fields.map((field) => [field.schema.id, field]))
  const pageContext = collectPageContext(doc)

  const form: FormSchema = {
    origin: url.origin,
    path: url.pathname,
    ...(doc.title ? { pageTitle: doc.title } : {}),
    adapter: adapter.name,
    ...(pageContext ? { pageContext } : {}),
    fields: primary.fields.map((f) => f.schema),
  }

  return { form, elements, adapter, actualForm: isActualForm(primary.fields) }
}
