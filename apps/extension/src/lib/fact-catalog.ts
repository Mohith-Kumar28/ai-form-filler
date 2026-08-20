import type { Identity } from '@aff/shared'

/**
 * The one description of what a person's information *is*.
 *
 * Before this file there were four overlapping lists — `IDENTITY_FIELDS` (7 entries, display
 * order), `suggest.ts`'s `RULES` (12 entries, matching), the API's `IdentitySlot` (12 slots,
 * tier 0), and the free-for-all of `Profile.custom` keys — none derived from any other. The
 * panel rendered three of them into one flat scroll, so the same fact could appear twice under
 * two spellings and nothing anywhere could tell that it had.
 *
 * Note what this module deliberately is **not**: a schema change. The wire contract still has
 * exactly `Identity` (7 typed fields + a free-form `links` record) and `custom`
 * (`Record<string, string>`). Everything below is a presentation and reconciliation layer over
 * that, which is why sections, order and labels can change freely — `compileProfileDoc` sorts
 * `custom` keys itself and never sees any of this.
 *
 * Zod-free on purpose. `suggest.ts` imports this, `suggest.ts` runs in the content script, and
 * the content script is a tax on every page the user visits: one runtime import from a module
 * that also defines Zod schemas took that bundle from 11 kB to 93 kB. `import type` is erased,
 * so the `Identity` type above costs nothing.
 */

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

export interface ReconciledProfile {
  /** Canonical catalogue key → value. Only keys that had a source value are present. */
  values: Record<string, string>
  /** `custom` keys matching no catalogue field, in the casing the user typed. */
  extras: Record<string, string>
  /** `links` platforms matching no catalogue field, in the casing they were stored under. */
  extraLinks: Record<string, string>
  /**
   * Keys that collided with another spelling of the same field and will not survive the next
   * save, so the screen can say `Merged 2 duplicate fields` rather than silently rewriting
   * what the user thought they had. A lone key under a non-canonical spelling is not listed:
   * there was never a second row to merge.
   */
  merged: string[]
}

interface Source {
  raw: string
  value: string
  /** A value read from the field's own canonical store outranks one read from anywhere else. */
  canonical: boolean
}

/**
 * Folds a profile into catalogue slots, merging everything that means the same thing.
 *
 * Precedence, when two source keys land on one field: a non-empty value beats an empty one;
 * between two non-empty values the canonical store wins (`identity.email` over a hand-typed
 * `custom["Email"]`), because the canonical one is the value the fill path actually reads.
 * Ties break on the sorted raw key so the result never depends on object insertion order.
 */
export function reconcile(input: {
  // `Partial` because the generated wire type makes `links` optional where the schema gives it
  // a default. Widening here beats a cast at every call site.
  identity?: Partial<Identity>
  custom?: Record<string, string>
}): ReconciledProfile {
  const identity = input.identity ?? { links: {} }
  const custom = input.custom ?? {}

  const candidates = new Map<string, Source[]>()
  const extras: Record<string, string> = {}
  const extraLinks: Record<string, string> = {}
  const merged: string[] = []

  const offer = (field: CatalogField, raw: string, value: string, canonical: boolean) => {
    const list = candidates.get(field.key)
    if (list) list.push({ raw, value, canonical })
    else candidates.set(field.key, [{ raw, value, canonical }])
  }

  // The typed identity fields. Their key *is* canonical, so there is nothing to resolve here.
  for (const field of CATALOG) {
    if (field.store !== 'identity') continue
    const value = (identity as Record<string, unknown>)[field.key]
    if (typeof value === 'string') offer(field, field.key, value, true)
  }

  // Link platforms are free-form strings — the ingest pass gets `platform` straight from a
  // model — so this is where `"LinkedIn"` next to `"linkedin"` became two permanent rows.
  for (const raw of Object.keys(identity.links ?? {}).sort()) {
    const value = identity.links?.[raw] ?? ''
    const field = fieldFor(raw)
    if (field?.store === 'link') offer(field, raw, value, raw === field.key)
    else extraLinks[raw] = value
  }

  // Whatever the user typed themselves. A key here may name a catalogue field of any store —
  // somebody who adds a fact called "Email" means the email field, not a second one.
  for (const raw of Object.keys(custom).sort()) {
    const value = custom[raw] ?? ''
    const field = fieldFor(raw)
    if (field) offer(field, raw, value, field.store === 'custom' && raw === field.key)
    else extras[raw] = value
  }

  const values: Record<string, string> = {}
  for (const [key, sources] of candidates) {
    const winner = sources.reduce((best, next) => {
      const bestFilled = best.value.trim() !== ''
      const nextFilled = next.value.trim() !== ''
      if (bestFilled !== nextFilled) return bestFilled ? best : next
      if (best.canonical !== next.canonical) return best.canonical ? best : next
      return best.raw <= next.raw ? best : next
    })
    values[key] = winner.value
    // Only a genuine collision is reported. One key under a non-canonical spelling is a
    // silent rename — there was never a second row, so there is nothing to tell the user.
    if (sources.length > 1) {
      for (const source of sources) if (source.raw !== key) merged.push(source.raw)
    }
  }

  return { values, extras, extraLinks, merged: [...new Set(merged)].sort() }
}

/**
 * The inverse: catalogue slots back into a `ProfilePatch` body.
 *
 * Two asymmetries, both deliberate.
 *
 * An empty **catalogue** `custom` field is omitted rather than stored as `""`. Nobody created
 * those rows — the catalogue did — and an empty one is not a fact. Storing it would also spend
 * one of the user's `PLAN_FACT_LIMITS` on nothing.
 *
 * An empty **extra** is kept. The user made that row on purpose; it disappears when they press
 * remove, not when they clear the box they are still typing in.
 */
export function toPatch(reconciled: {
  values: Record<string, string>
  extras: Record<string, string>
  extraLinks: Record<string, string>
}): { identity: Identity; custom: Record<string, string> } {
  const identity: Record<string, unknown> = {}
  const links: Record<string, string> = {}
  const custom: Record<string, string> = {}

  for (const field of CATALOG) {
    const value = reconciled.values[field.key]
    if (value === undefined) continue
    if (field.store === 'identity') identity[field.key] = value
    else if (field.store === 'link') links[field.key] = value
    else if (value.trim() !== '') custom[field.key] = value
  }

  for (const [key, value] of Object.entries(reconciled.extraLinks)) links[key] = value
  for (const [key, value] of Object.entries(reconciled.extras)) custom[key] = value

  identity.links = links
  return { identity: identity as Identity, custom }
}

/** Fields in a section that have a value, over the total. Drives each section's counter. */
export function sectionProgress(
  section: FactSection,
  reconciled: { values: Record<string, string>; extras: Record<string, string> },
): { filled: number; total: number } {
  if (section === 'extra') {
    const keys = Object.keys(reconciled.extras)
    return { filled: keys.filter((k) => reconciled.extras[k]?.trim()).length, total: keys.length }
  }
  const fields = FIELDS_BY_SECTION[section]
  return {
    filled: fields.filter((f) => reconciled.values[f.key]?.trim()).length,
    total: fields.length,
  }
}

/** Every catalogue field carrying a value, plus every extra. What the fill path can answer. */
export function factCount(reconciled: {
  values: Record<string, string>
  extras: Record<string, string>
  extraLinks: Record<string, string>
}): number {
  const patch = toPatch(reconciled)
  const identityFilled = CATALOG.filter(
    (f) => f.store === 'identity' && patch.identity[f.key as keyof Identity],
  ).length
  const linksFilled = Object.values(patch.identity.links ?? {}).filter((v) => v.trim()).length
  const customFilled = Object.values(patch.custom).filter((v) => v.trim()).length
  return identityFilled + linksFilled + customFilled
}

/**
 * `custom` keys only — what `PLAN_FACT_LIMITS` is actually measured against.
 *
 * The previous screen counted identity fields and links into the same total while the server
 * counted only `custom` (`routes/profile.ts`), so a free-tier user saw "10 of 10 — Upgrade"
 * with zero facts of their own.
 */
export function customFactCount(reconciled: {
  values: Record<string, string>
  extras: Record<string, string>
  extraLinks: Record<string, string>
}): number {
  return Object.keys(toPatch(reconciled).custom).length
}

/** `••••3210` — enough tail to recognise the value, not enough to read it over a shoulder. */
export function maskValue(value: string): string {
  const trimmed = value.trim()
  if (trimmed.length <= 4) return '•'.repeat(trimmed.length)
  return `${'•'.repeat(Math.min(8, trimmed.length - 4))}${trimmed.slice(-4)}`
}
