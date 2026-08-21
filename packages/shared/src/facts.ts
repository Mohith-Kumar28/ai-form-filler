/**
 * The fact catalogue, and the one matcher that decides which fact answers a form field.
 *
 * This lives in `@aff/shared` because **both** answering paths need it and they used to have
 * one each. The extension matched a focused field against the full catalogue and offered the
 * right stored value instantly. The server's tier 0 knew only twelve fixed `identity` slots
 * plus, briefly, a hand-written table of alias keys — so the same profile answered the same
 * field differently depending on which path you were in. The failure that ended the argument:
 * focusing "Address Line" suggested the stored address, while pressing Fill wrote the user's
 * *country* into it, because the alias list for the `location` slot happened to reach
 * `country` before anything matched the address.
 *
 * There is no second matcher any more. `matchFact` is the answer to "which fact does this
 * field want", everywhere, and a rule added here changes both paths at once.
 *
 * **Import this by its subpath — `@aff/shared/facts` — never through the barrel.** The barrel
 * pulls in the Zod schemas, which took the content script from 11 kB to 93 kB the last time
 * somebody reached for it. Nothing in this file imports Zod, and `Identity` is a type-only
 * import, which is erased.
 */

import type { Identity } from './profile.js'

export type FactStore = 'identity' | 'link' | 'custom'

export type FactSection = 'about' | 'address' | 'ids' | 'work' | 'links' | 'extra'

export interface CatalogField {
  /**
   * The canonical storage key.
   *
   * `store: 'identity'` → a `keyof Identity`. `store: 'link'` → a platform key inside
   * `identity.links`. `store: 'custom'` → the exact `Profile.custom` key, in its canonical
   * casing. Anything that normalises to this key, or to one of `aliases`, folds into this
   * single field.
   */
  key: string
  store: FactStore
  section: FactSection
  label: string
  /** `<input type>`. Drives the keyboard on the control, nothing else. */
  type: string
  placeholder?: string
  hint?: string
  /**
   * Rendered as `••••1234` with a reveal toggle.
   *
   * This is about the room, not about storage: a government ID number sitting in plain text in
   * a docked panel is readable by anyone behind the user, on a page they do not control. The
   * value is stored and prompted exactly like every other fact.
   */
  sensitive?: boolean
  /** Spellings that fold into `key`. Compared through `normaliseKey`. */
  aliases?: string[]
  /**
   * How a *form field on someone else's page* is recognised as this fact.
   *
   * Absent means "never suggested from a label" — the field is still stored, edited and sent
   * to the model, it just gets no zero-latency local match.
   */
  match?: {
    /**
     * Order, and it is load-bearing.
     *
     * Matching is first-hit, not best-hit, because a keyword is a substring test: the label
     * "Email address" contains both `email` and `address`, and only rank decides which fact
     * answers it. Lower runs first. Leave gaps so a new field can be slotted in without
     * renumbering its neighbours.
     */
    rank: number
    /** Substring tests against the lowercased field label. */
    keywords?: string[]
    /**
     * Whole-label equality tests, for words too short or too common to use as substrings.
     *
     * "State" is the example that forced this: as a keyword it also matches "Statement of
     * purpose", and as `exact` it matches only the field actually asking for a state.
     */
    exact?: string[]
    /** HTML `autocomplete` tokens. The strongest signal there is, so checked before labels. */
    autocomplete?: string[]
  }
}

/**
 * A title and nothing else.
 *
 * These used to carry a line of explanation each — "Where you live, as a form would ask it",
 * "Hidden until you reveal them" — and six of them stacked down a 400px panel was more prose
 * than content. A section called Address does not need telling what an address is, and the
 * counter beside the title already says how much of it is filled.
 */
export interface SectionMeta {
  section: FactSection
  title: string
}

export const SECTIONS: SectionMeta[] = [
  { section: 'about', title: 'About you' },
  { section: 'address', title: 'Address' },
  { section: 'ids', title: 'IDs' },
  { section: 'work', title: 'Work' },
  { section: 'links', title: 'Links' },
  { section: 'extra', title: 'Extra fields' },
]

/*
  The catalogue.

  Display order is this array's order, grouped by section. Match order is `match.rank`, which is
  independent — see the note on `rank` above for why they cannot be the same thing.
*/
export const CATALOG: CatalogField[] = [
  /* ── About you ─────────────────────────────────────────────────────────── */
  {
    key: 'fullName',
    store: 'identity',
    section: 'about',
    label: 'Full name',
    type: 'text',
    aliases: ['name', 'legal name'],
    match: { rank: 20, keywords: ['full name', 'legal name'], autocomplete: ['name'] },
  },
  {
    key: 'preferredName',
    store: 'identity',
    section: 'about',
    label: 'Preferred name',
    type: 'text',
    aliases: ['nickname', 'goes by'],
    match: { rank: 23, keywords: ['preferred name', 'nickname', 'goes by'] },
  },
  {
    key: 'First name',
    store: 'custom',
    section: 'about',
    label: 'First name',
    type: 'text',
    aliases: ['given name', 'forename'],
    match: { rank: 21, keywords: ['first name', 'given name'], autocomplete: ['given-name'] },
  },
  {
    key: 'Last name',
    store: 'custom',
    section: 'about',
    label: 'Last name',
    type: 'text',
    aliases: ['surname', 'family name'],
    match: {
      rank: 22,
      keywords: ['last name', 'surname', 'family name'],
      autocomplete: ['family-name'],
    },
  },
  {
    key: 'email',
    store: 'identity',
    section: 'about',
    label: 'Email',
    type: 'email',
    placeholder: 'you@example.com',
    aliases: ['e-mail', 'email address'],
    match: { rank: 10, keywords: ['email', 'e-mail'], autocomplete: ['email'] },
  },
  {
    key: 'phone',
    store: 'identity',
    section: 'about',
    label: 'Phone',
    type: 'tel',
    placeholder: '+91 98765 43210',
    aliases: ['mobile', 'phone number', 'contact number'],
    match: {
      rank: 11,
      keywords: ['phone', 'mobile', 'telephone', 'cell'],
      autocomplete: ['tel', 'tel-national'],
    },
  },
  /**
   * The dial code, stored separately from the number.
   *
   * Two different fields ask for this and neither is answered well by a single stored string.
   * A form that splits the phone into a `tel-country-code` control and a `tel-national` one
   * gets nothing from `phone` unless the model happens to split it correctly; and a country
   * dropdown beside a phone box is a `select` whose options are dial codes, which wants `+91`
   * and not a whole number.
   *
   * `custom`, not `identity`, on purpose — `identity` is a fixed wire schema that reaches
   * every prompt, and one more optional key there is a schema change and a migration for a
   * fact most people will never fill in. See `Profile` in `@aff/shared`.
   *
   * Ranked above `phone` so "Country code" does not get swallowed by the `phone` rule's
   * `keywords: ['phone']` — "Phone country code" contains both, and first hit wins.
   */
  {
    key: 'Country code',
    store: 'custom',
    section: 'about',
    label: 'Country code',
    type: 'text',
    placeholder: '+91',
    aliases: ['dial code', 'phone code', 'isd code', 'calling code'],
    match: {
      rank: 10.5,
      keywords: ['country code', 'dial code', 'calling code', 'isd code'],
      autocomplete: ['tel-country-code'],
    },
  },
  {
    key: 'Date of birth',
    store: 'custom',
    section: 'about',
    label: 'Date of birth',
    type: 'date',
    aliases: ['dob', 'birthday', 'birth date'],
    match: {
      rank: 30,
      keywords: ['date of birth', 'birth date', 'birthday'],
      exact: ['dob'],
      autocomplete: ['bday'],
    },
  },
  {
    key: 'pronouns',
    store: 'identity',
    section: 'about',
    label: 'Pronouns',
    type: 'text',
    placeholder: 'e.g. she/her',
    match: { rank: 31, keywords: ['pronouns'] },
  },
  {
    key: 'Gender',
    store: 'custom',
    section: 'about',
    label: 'Gender',
    type: 'text',
    match: { rank: 32, keywords: ['gender'] },
  },
  {
    key: 'Nationality',
    store: 'custom',
    section: 'about',
    label: 'Nationality',
    type: 'text',
    aliases: ['citizenship'],
    match: { rank: 33, keywords: ['nationality', 'citizenship'] },
  },

  /* ── Address ───────────────────────────────────────────────────────────── */
  {
    key: 'Address line 1',
    store: 'custom',
    section: 'address',
    label: 'Address line 1',
    type: 'text',
    placeholder: 'Flat, building, street',
    aliases: ['address', 'street address', 'address line1'],
    match: {
      rank: 40,
      keywords: [
        'address line 1',
        'address line1',
        'street address',
        'permanent address',
        'current address',
        'address',
      ],
      autocomplete: ['street-address', 'address-line1'],
    },
  },
  {
    key: 'Address line 2',
    store: 'custom',
    section: 'address',
    label: 'Address line 2',
    type: 'text',
    placeholder: 'Area, landmark',
    aliases: ['address line2'],
    match: {
      rank: 41,
      keywords: ['address line 2', 'address line2', 'apartment', 'suite'],
      autocomplete: ['address-line2'],
    },
  },
  {
    key: 'location',
    store: 'identity',
    section: 'address',
    label: 'Location',
    type: 'text',
    placeholder: 'e.g. Bengaluru, India',
    aliases: ['city', 'town'],
    match: {
      rank: 42,
      keywords: ['location', 'city', 'town', 'where are you', 'where do you live'],
      autocomplete: ['address-level2'],
    },
  },
  {
    key: 'State or region',
    store: 'custom',
    section: 'address',
    label: 'State or region',
    type: 'text',
    aliases: ['state', 'province', 'region'],
    match: {
      rank: 43,
      keywords: ['state or province', 'state/province', 'state / province', 'province'],
      exact: ['state', 'region', 'state/ut', 'state / ut'],
      autocomplete: ['address-level1'],
    },
  },
  {
    key: 'Postal code',
    store: 'custom',
    section: 'address',
    label: 'Postal code',
    type: 'text',
    aliases: ['pincode', 'pin code', 'zip', 'zip code', 'postcode'],
    match: {
      rank: 44,
      keywords: ['postal code', 'post code', 'postcode', 'zip', 'pin code', 'pincode'],
      autocomplete: ['postal-code'],
    },
  },
  {
    key: 'Country',
    store: 'custom',
    section: 'address',
    label: 'Country',
    type: 'text',
    match: { rank: 45, keywords: ['country'], autocomplete: ['country', 'country-name'] },
  },

  /* ── IDs and documents ─────────────────────────────────────────────────── */
  {
    key: 'Aadhaar number',
    store: 'custom',
    section: 'ids',
    label: 'Aadhaar number',
    type: 'text',
    sensitive: true,
    aliases: ['aadhar number', 'aadhaar', 'aadhar', 'uidai'],
    match: { rank: 50, keywords: ['aadhaar', 'aadhar'] },
  },
  {
    key: 'PAN number',
    store: 'custom',
    section: 'ids',
    label: 'PAN number',
    type: 'text',
    sensitive: true,
    aliases: ['pan', 'pan card', 'permanent account number'],
    match: {
      rank: 51,
      keywords: ['pan number', 'pan card', 'permanent account number'],
      exact: ['pan', 'pan no'],
    },
  },
  {
    key: 'Passport number',
    store: 'custom',
    section: 'ids',
    label: 'Passport number',
    type: 'text',
    sensitive: true,
    aliases: ['passport'],
    match: { rank: 52, keywords: ['passport'] },
  },
  {
    key: 'Driving licence number',
    store: 'custom',
    section: 'ids',
    label: 'Driving licence number',
    type: 'text',
    sensitive: true,
    aliases: ['driving license number', 'dl number', 'drivers licence', "driver's licence"],
    match: {
      rank: 53,
      keywords: ['driving licence', 'driving license', 'driver licence', 'driver license'],
      exact: ['dl', 'dl no', 'dl number'],
    },
  },
  {
    key: 'Voter ID',
    store: 'custom',
    section: 'ids',
    label: 'Voter ID',
    type: 'text',
    sensitive: true,
    aliases: ['voter id number', 'epic number'],
    match: { rank: 54, keywords: ['voter id', 'voter identity', 'epic number'] },
  },
  {
    key: 'Tax ID',
    store: 'custom',
    section: 'ids',
    label: 'Tax ID',
    type: 'text',
    sensitive: true,
    hint: 'SSN, NI number, TIN',
    aliases: ['ssn', 'social security number', 'tin', 'national insurance number'],
    match: {
      rank: 55,
      keywords: ['social security', 'tax id', 'national insurance'],
      exact: ['ssn', 'tin'],
    },
  },

  /* ── Work ──────────────────────────────────────────────────────────────── */
  {
    key: 'Current company',
    store: 'custom',
    section: 'work',
    label: 'Current company',
    type: 'text',
    aliases: ['company', 'current employer', 'employer'],
    match: {
      rank: 60,
      keywords: ['current company', 'current employer', 'present employer', 'employer name'],
      exact: ['company', 'employer', 'organisation', 'organization'],
    },
  },
  {
    key: 'Current job title',
    store: 'custom',
    section: 'work',
    label: 'Current job title',
    type: 'text',
    aliases: ['job title', 'designation', 'current role'],
    match: {
      rank: 61,
      keywords: [
        'job title',
        'current title',
        'current role',
        'current designation',
        'present designation',
      ],
    },
  },
  {
    key: 'Total experience',
    store: 'custom',
    section: 'work',
    label: 'Total experience',
    type: 'text',
    placeholder: 'e.g. 4 years',
    aliases: ['years of experience', 'experience'],
    match: {
      rank: 62,
      keywords: ['total experience', 'years of experience', 'work experience', 'total work exp'],
    },
  },
  {
    key: 'Notice period',
    store: 'custom',
    section: 'work',
    label: 'Notice period',
    type: 'text',
    placeholder: 'e.g. 2 months',
    match: { rank: 63, keywords: ['notice period'] },
  },
  {
    key: 'Current CTC',
    store: 'custom',
    section: 'work',
    label: 'Current CTC',
    type: 'text',
    aliases: ['current salary', 'current compensation'],
    match: {
      rank: 64,
      keywords: ['current ctc', 'current salary', 'current compensation', 'present ctc'],
    },
  },
  {
    key: 'Expected CTC',
    store: 'custom',
    section: 'work',
    label: 'Expected CTC',
    type: 'text',
    aliases: ['expected salary', 'salary expectation'],
    match: {
      rank: 65,
      keywords: [
        'expected ctc',
        'expected salary',
        'salary expectation',
        'expected compensation',
        'desired salary',
      ],
    },
  },
  {
    key: 'Earliest start date',
    store: 'custom',
    section: 'work',
    label: 'Earliest start date',
    type: 'text',
    aliases: ['earliest start', 'available from', 'start date'],
    match: {
      rank: 66,
      keywords: ['earliest start', 'start date', 'available from', 'when can you start'],
    },
  },
  {
    key: 'workAuthorization',
    store: 'identity',
    section: 'work',
    label: 'Work authorization',
    type: 'text',
    aliases: ['work authorisation', 'visa status', 'work permit'],
    match: {
      rank: 67,
      keywords: [
        'work authori',
        'authorised to work',
        'authorized to work',
        'visa',
        'sponsorship',
        'work permit',
      ],
    },
  },
  {
    key: 'Willing to relocate',
    store: 'custom',
    section: 'work',
    label: 'Willing to relocate',
    type: 'text',
    placeholder: 'e.g. Yes, anywhere in India',
    match: { rank: 68, keywords: ['relocate', 'relocation', 'willing to move'] },
  },

  /* ── Links ─────────────────────────────────────────────────────────────── */
  {
    key: 'linkedin',
    store: 'link',
    section: 'links',
    label: 'LinkedIn',
    type: 'url',
    placeholder: 'https://linkedin.com/in/…',
    match: { rank: 70, keywords: ['linkedin'] },
  },
  {
    key: 'github',
    store: 'link',
    section: 'links',
    label: 'GitHub',
    type: 'url',
    placeholder: 'https://github.com/…',
    match: { rank: 71, keywords: ['github'] },
  },
  {
    key: 'website',
    store: 'link',
    section: 'links',
    label: 'Portfolio or website',
    type: 'url',
    aliases: ['portfolio', 'personal site', 'personal website'],
    match: { rank: 72, keywords: ['website', 'portfolio', 'personal site'] },
  },
  {
    key: 'twitter',
    store: 'link',
    section: 'links',
    label: 'Twitter / X',
    type: 'url',
    aliases: ['x'],
    match: { rank: 73, keywords: ['twitter'] },
  },
  {
    key: 'instagram',
    store: 'link',
    section: 'links',
    label: 'Instagram',
    type: 'url',
    match: { rank: 74, keywords: ['instagram'] },
  },
  {
    key: 'dribbble',
    store: 'link',
    section: 'links',
    label: 'Dribbble or Behance',
    type: 'url',
    aliases: ['behance'],
    match: { rank: 75, keywords: ['dribbble', 'behance'] },
  },
]

/**
 * The comparison form of a key or label.
 *
 * Lowercased, stripped of everything that is not a letter or digit. That is deliberately
 * aggressive: `"Notice Period "`, `"notice_period"`, `"notice-period"` and `"Notice period"`
 * were four separate facts in the previous build, all four reached the model as separate
 * lines, and the user saw four rows. They are one fact.
 */
export function normaliseKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]+/g, '')
}

/** Every spelling that resolves to a field → the field. Built once. */
export const CATALOG_INDEX: Map<string, CatalogField> = (() => {
  const index = new Map<string, CatalogField>()
  for (const field of CATALOG) {
    for (const spelling of [field.key, field.label, ...(field.aliases ?? [])]) {
      const normalised = normaliseKey(spelling)
      // First writer wins, so an alias can never shadow another field's canonical key.
      if (!index.has(normalised)) index.set(normalised, field)
    }
  }
  return index
})()

export const FIELDS_BY_SECTION: Record<FactSection, CatalogField[]> = {
  about: CATALOG.filter((f) => f.section === 'about'),
  address: CATALOG.filter((f) => f.section === 'address'),
  ids: CATALOG.filter((f) => f.section === 'ids'),
  work: CATALOG.filter((f) => f.section === 'work'),
  links: CATALOG.filter((f) => f.section === 'links'),
  extra: [],
}

export function fieldFor(key: string): CatalogField | undefined {
  return CATALOG_INDEX.get(normaliseKey(key))
}

/* ── Reconciliation ───────────────────────────────────────────────────────── */
/* ── Matching a form field to a fact ──────────────────────────────────────── */

/** Which field kinds can take a free-text fact. Choices must be matched against their options. */
const MATCHABLE_KINDS = new Set(['text', 'longtext', 'email', 'tel', 'url', 'number', 'date'])

/**
 * Matchable catalogue fields, in rank order.
 *
 * Rank, not array order. Matching is a first-hit substring test, so the label "Email address"
 * contains both `email` and `address` and only rank decides which fact answers it — see the
 * note on `match.rank` above. This ordering is the whole reason "Address Line" resolves to the
 * address (rank 40) and not to the country (rank 45).
 */
const RULES: CatalogField[] = CATALOG.filter((field) => field.match).sort(
  (a, b) => (a.match?.rank ?? 0) - (b.match?.rank ?? 0),
)

/** Everything the matcher may read. `custom` is keyed by whatever the user called the fact. */
export interface KnownFacts {
  identity: Identity
  custom: Record<string, string>
}

function firstWord(fullName?: string): string | undefined {
  return fullName?.trim().split(/\s+/)[0]
}

function lastWord(fullName?: string): string | undefined {
  const parts = fullName?.trim().split(/\s+/) ?? []
  return parts.length > 1 ? parts.slice(1).join(' ') : undefined
}

/**
 * Values a form asks for separately but nobody stores separately.
 *
 * A blank "First name" row in the panel is correct, not missing data — most people type one
 * full name and expect the halves to follow. These run only when the stored field is empty, so
 * an explicitly typed override always wins.
 */
const DERIVED: Record<string, (facts: KnownFacts) => string | undefined> = {
  'First name': (f) => f.identity.preferredName || firstWord(f.identity.fullName),
  'Last name': (f) => lastWord(f.identity.fullName),
}

/** The stored value for one catalogue field, or undefined. */
export function factValue(field: CatalogField, facts: KnownFacts): string | undefined {
  const stored =
    field.store === 'identity'
      ? ((facts.identity as Record<string, unknown>)[field.key] as string | undefined)
      : field.store === 'link'
        ? facts.identity.links?.[field.key]
        : facts.custom[field.key]

  if (stored?.trim()) return stored.trim()
  return DERIVED[field.key]?.(facts)?.trim() || undefined
}

/** A fact that answers a field: the name to show for it, and the value to write. */
export interface FactMatch {
  /** The catalogue label, or the user's own key for a fact the catalogue does not know. */
  label: string
  value: string
}

/**
 * The fact that answers this field, or null.
 *
 * Signals in descending order of trust:
 *
 *   1. The `autocomplete` token. The page author declaring what the field is for, and
 *      locale-independent in a way label text never is.
 *   2. A whole-label match, for words too short or common to test as substrings — "State"
 *      as a keyword also matches "Statement of purpose".
 *   3. Label keywords, in rank order.
 *   4. A typed fact the catalogue does not know, where the field label and the user's own key
 *      name each other. This is what answers "Notice period" or a bespoke fact somebody added,
 *      and it is bidirectional so "Address Line" reaches a fact called "Address line 1".
 *
 * Conservative on purpose: a wrong answer on a real form is worse than no answer, so every
 * rule needs a reasonably specific signal and the short-key floor in step 4 stops a two-letter
 * custom key matching half the page.
 */
export function matchFact(
  field: { label: string; autocomplete?: string; kind: string },
  facts: KnownFacts,
): FactMatch | null {
  if (!MATCHABLE_KINDS.has(field.kind)) return null

  const ac = (field.autocomplete ?? '').toLowerCase()
  if (ac === 'off' || ac === 'one-time-code') return null
  const label = field.label.toLowerCase().trim()
  if (!label && !ac) return null

  if (ac) {
    for (const rule of RULES) {
      if (rule.match?.autocomplete?.includes(ac)) {
        const value = factValue(rule, facts)
        if (value) return { label: rule.label, value }
      }
    }
  }

  for (const rule of RULES) {
    if (rule.match?.exact?.includes(label)) {
      const value = factValue(rule, facts)
      if (value) return { label: rule.label, value }
    }
  }

  for (const rule of RULES) {
    if (rule.match?.keywords?.some((keyword) => label.includes(keyword))) {
      const value = factValue(rule, facts)
      if (value) return { label: rule.label, value }
    }
  }

  /*
    Compared twice: as written, then with punctuation and spacing removed.

    The raw pass is what has always run. The normalised pass exists because a `custom` key is
    whatever the user, or an importer, put there — `pan_number`, `notice-period`, `Address
    Line 1` — and none of those reach a field labelled "PAN number" by substring. The panel's
    editor already folds keys through `normaliseKey` when it renders them, so the two halves of
    the product disagreed about whether `pan_number` and "PAN number" were the same thing.

    Same length floor on both, measured before normalising so that stripping punctuation cannot
    take a key under the bar it was checked against.
  */
  for (const [key, value] of Object.entries(facts.custom)) {
    const k = key.trim().toLowerCase()
    if (!value.trim() || k.length < 4) continue
    if (label.includes(k) || k.includes(label)) return { label: key, value: value.trim() }
  }

  const flatLabel = normaliseKey(label)
  if (flatLabel.length >= 4) {
    for (const [key, value] of Object.entries(facts.custom)) {
      if (!value.trim() || key.trim().length < 4) continue
      const flatKey = normaliseKey(key)
      if (!flatKey) continue
      if (flatLabel.includes(flatKey) || flatKey.includes(flatLabel)) {
        return { label: key, value: value.trim() }
      }
    }
  }

  return null
}
