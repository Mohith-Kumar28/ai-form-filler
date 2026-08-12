import type { FieldSchema, FillTier } from '@aff/shared'

/**
 * Assigns each field the cheapest handler that can answer it correctly.
 *
 * This is the product's main cost lever — bigger than the choice of models. On a typical
 * application form most fields are identity lookups that should never reach a model at all;
 * routing those to tier 0 is the difference between ~$0.008 and ~$0.05 per form.
 *
 *   0 — deterministic lookup from the stored Identity. No model call.
 *   1 — constrained choice from a fixed option list. Cheapest model.
 *   2 — short free text. Cheap model.
 *   3 — long-form prose. Frontier model, with answer-bank retrieval.
 */

/** Identity concepts we can answer without a model, and how to recognise them. */
export type IdentitySlot =
  | 'fullName'
  | 'firstName'
  | 'lastName'
  | 'preferredName'
  | 'email'
  | 'phone'
  | 'location'
  | 'pronouns'
  | 'workAuthorization'
  | 'linkedin'
  | 'github'
  | 'website'

/**
 * Matched against the HTML `autocomplete` token first. This is the highest-confidence
 * signal available — it is the author explicitly declaring what the field is for, and it
 * is locale-independent in a way label text never is.
 */
const AUTOCOMPLETE_SLOT: Record<string, IdentitySlot> = {
  name: 'fullName',
  'given-name': 'firstName',
  'family-name': 'lastName',
  nickname: 'preferredName',
  email: 'email',
  tel: 'phone',
  'tel-national': 'phone',
  url: 'website',
  'street-address': 'location',
  'address-level1': 'location',
  'address-level2': 'location',
  country: 'location',
  'country-name': 'location',
}

/**
 * Label patterns, checked in order — **most specific first**.
 *
 * Order is load-bearing. `/name/` would swallow "First name", "Last name", and
 * "Company name" alike, so the narrower patterns must win before it is ever reached.
 */
const LABEL_SLOTS: { slot: IdentitySlot; pattern: RegExp }[] = [
  { slot: 'firstName', pattern: /\b(first|given|fore)[\s_-]?name\b/i },
  { slot: 'lastName', pattern: /\b(last|family|sur)[\s_-]?name\b/i },
  { slot: 'preferredName', pattern: /\b(preferred|nick|display)[\s_-]?name\b/i },
  { slot: 'email', pattern: /\be-?mail\b/i },
  { slot: 'phone', pattern: /\b(phone|mobile|cell|contact number|telephone)\b/i },
  { slot: 'linkedin', pattern: /\blinked-?in\b/i },
  { slot: 'github', pattern: /\bgit-?hub\b/i },
  { slot: 'website', pattern: /\b(website|portfolio|personal site|homepage|blog)\b/i },
  { slot: 'pronouns', pattern: /\bpronouns?\b/i },
  {
    slot: 'workAuthorization',
    pattern: /\b(work authoriz|visa status|right to work|sponsorship|work permit)/i,
  },
  { slot: 'location', pattern: /\b(city|location|address|country|where.*based|region)\b/i },
  // The catch-all, deliberately last.
  { slot: 'fullName', pattern: /\b(full[\s_-]?name|your name|name)\b/i },
]

/**
 * Labels that look like an identity slot but are asking about something else entirely.
 * "Company name" and "Reference name" both match /name/ and must not be auto-filled with
 * the user's own name — a wrong-but-confident answer is worse than leaving it blank.
 */
const NOT_ABOUT_APPLICANT =
  /\b(company|employer|organi[sz]ation|school|university|college|institution|reference|referee|emergency|manager|supervisor|recruiter|contact person|previous|current employer)\b/i

/** Long-form question markers — these want prose, not a fact. */
const ESSAY_PATTERN =
  /\b(why|describe|tell us|explain|how would|what makes|cover letter|motivation|elaborate|in your own words|share|walk us through|passionate|interest(ed)? in)\b/i

/** Above this, a free-text field is prose regardless of what the label says. */
const LONGFORM_MAXLENGTH = 300

export interface Classification {
  fieldId: string
  tier: FillTier
  /** Set only for tier 0 — which identity value answers this field. */
  slot?: IdentitySlot
}

export function identitySlotFor(field: FieldSchema): IdentitySlot | undefined {
  // A field asking about an employer or reference is never about the applicant, whatever
  // its label pattern-matches. Checked before anything else so it can't be overridden.
  const haystack = `${field.label} ${field.section ?? ''} ${field.hint ?? ''}`
  if (NOT_ABOUT_APPLICANT.test(haystack)) return undefined

  if (field.autocomplete) {
    const token = field.autocomplete.split(/\s+/).pop() ?? ''
    const slot = AUTOCOMPLETE_SLOT[token]
    if (slot) return slot
  }

  // Only the label — not section or hint. A field inside a "Contact details" section is not
  // itself the email field, and widening the haystack produces confident wrong answers.
  for (const { slot, pattern } of LABEL_SLOTS) {
    if (pattern.test(field.label)) return slot
  }

  // Typed inputs are a weak but real signal when the label gave us nothing.
  if (field.kind === 'email') return 'email'
  if (field.kind === 'tel') return 'phone'

  return undefined
}

export function classifyField(field: FieldSchema): Classification {
  // A choice field can never be tier 0: even when we know the answer, it must be expressed
  // as one of the given options, and picking the right one is a matching problem.
  const isChoice = field.kind === 'select' || field.kind === 'radio' || field.kind === 'multiselect'

  if (!isChoice && field.kind !== 'checkbox') {
    const slot = identitySlotFor(field)
    if (slot) return { fieldId: field.id, tier: 0, slot }
  }

  if (isChoice || field.kind === 'checkbox') {
    return { fieldId: field.id, tier: 1 }
  }

  if (field.kind === 'longtext') {
    return { fieldId: field.id, tier: 3 }
  }

  const looksLikeEssay = ESSAY_PATTERN.test(`${field.label} ${field.hint ?? ''}`)
  const isRoomy = (field.maxLength ?? Number.POSITIVE_INFINITY) > LONGFORM_MAXLENGTH

  if (looksLikeEssay && isRoomy) {
    return { fieldId: field.id, tier: 3 }
  }

  return { fieldId: field.id, tier: 2 }
}

export interface RoutedForm {
  classifications: Classification[]
  counts: Record<FillTier, number>
}

export function classifyForm(fields: FieldSchema[], quality: 'auto' | 'high' = 'auto'): RoutedForm {
  const counts: Record<FillTier, number> = { 0: 0, 1: 0, 2: 0, 3: 0 }

  const classifications = fields.map((field) => {
    const base = classifyField(field)

    // `high` escalates generative work to the frontier model. Tier 0 stays tier 0 — there is
    // no quality to be gained from asking a model what the user's own email address is, and
    // tier 1 is a constrained choice where a bigger model changes nothing.
    const tier: FillTier = quality === 'high' && base.tier >= 2 ? 3 : base.tier

    counts[tier] += 1
    return { ...base, tier }
  })

  return { classifications, counts }
}
