import type { DetectedField } from './types.js'

/**
 * Whether what was detected is an **actual form**, as opposed to a stray control.
 *
 * `detectForms` answers "what on this page could be written to", and it is right to be
 * generous about that: a field the user has focused and asked for help with is worth filling
 * wherever it lives. This answers the narrower question the launcher needs — "is there
 * something here a person would call a form?" — and it has to be *stingy*, because the
 * launcher is unsolicited. It appears on its own, on top of somebody else's page, and every
 * time it appears where there is nothing to fill it teaches the user to ignore it.
 *
 * The case that forced this: an Instagram profile has no form at all, and the launcher sat on
 * it anyway. The single "field" was the `<select aria-label="Switch Display Language">` in the
 * page footer — 57×12px of site furniture, no `<form>` around it, nothing to do with the user.
 * Offering to fill that is offering to change the language of the site.
 *
 * So a lone control is not a form. Nearly every one on the web is page furniture: a language
 * or currency picker, a sort dropdown, a filter, a search box, a theme toggle. The exceptions
 * are the ones that carry their own evidence, and those are what `isSubstantive` names.
 */
export function isActualForm(fields: DetectedField[]): boolean {
  if (fields.length === 0) return false

  /*
    A field that means business on its own is enough by itself, however few of them there are.

    A standalone "Tell us about yourself" textarea is one field and is the single most valuable
    thing this product fills, so a plain count would have been the wrong test — it would have
    traded a false positive on Instagram for a false negative on the essay box.
  */
  if (fields.some(isSubstantive)) return true

  /*
    Otherwise it takes a crowd. Two unremarkable controls is a footer with a language picker
    beside a currency picker; three or more sitting together is a form somebody built, even if
    no single one of them proves it.
  */
  return fields.length >= 3
}

/** Kinds nobody puts on a page as furniture. You do not garnish a layout with a phone number. */
const SUBSTANTIVE_KINDS = new Set(['longtext', 'email', 'tel', 'url', 'date', 'file'])

/**
 * Autocomplete tokens that say, in the page's own words, that this collects a person's details.
 *
 * The attribute is the strongest signal available and it is the author's own declaration, so it
 * outranks every guess made from a label. `off` and `on` are excluded because they say only
 * whether the browser should help, which is not the same claim.
 */
const IDENTITY_AUTOCOMPLETE =
  /name|email|tel|url|address|street|country|postal|\bzip\b|organization|birthday|\bbday\b|sex|language/i

function isSubstantive(field: DetectedField): boolean {
  if (SUBSTANTIVE_KINDS.has(field.schema.kind)) return true

  const autocomplete = field.schema.autocomplete
  if (autocomplete && autocomplete !== 'on' && IDENTITY_AUTOCOMPLETE.test(autocomplete)) return true

  return inSubmittableForm(field.element)
}

/**
 * Whether the control sits in a real form that can be sent somewhere.
 *
 * A `<form>` around a control is the author saying "these answers go somewhere", which is the
 * whole of what we mean by a form — so one field inside one counts. The submit control is
 * required with it because a bare `<form>` is also how a great many sites wrap a search box or
 * a single-select filter that posts on change, and `role="search"` is excluded outright for the
 * same reason: a site that has bothered to label its search box as search has told us it is not
 * an application.
 */
function inSubmittableForm(element: HTMLElement): boolean {
  const form = element.closest('form, [role="form"]')
  if (!form) return false
  if (form.getAttribute('role') === 'search') return false
  return (
    form.querySelector('button:not([type="button"]), input[type="submit"], [type="submit"]') !==
    null
  )
}
