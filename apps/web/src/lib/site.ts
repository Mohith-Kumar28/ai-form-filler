/**
 * Single source of truth for marketing-site facts: name, domain, links, pricing.
 * Every page reads from here so a domain or price change is a one-line edit.
 */

export const site = {
  name: 'Fillaform',
  legalName: 'Fillaform',
  domain: 'https://fillaform.in',
  /**
   * The tagline is a page title, not a headline — it is only ever read through `buildMeta`.
   *
   * It says "AI form filler" because that is the phrase people search, and because "fill any form
   * in one click" describes mechanical autofill, which is the commodity this product is trying not
   * to be mistaken for. The hero on the page still speaks in its own words; this string speaks to
   * search. Same reason the extension's manifest name carries the phrase.
   */
  tagline: 'AI form filler for any web form',
  description:
    'Fillaform is an AI-powered form filler for Chrome. It answers any web form for you: job applications, Google Forms, registrations, surveys. Add your CV and a few notes once, then the AI writes every answer in your own words. It labels the answers it guessed, so you know what to check.',
  /** Pinned extension ID. The Web Store URL goes live once the listing is published. */
  chromeExtensionId: 'bkjmijloddfiilopdckanmnpmiimpcho',
  chromeWebStoreUrl: 'https://chromewebstore.google.com/detail/bkjmijloddfiilopdckanmnpmiimpcho',
  supportEmail: 'support@fillaform.in',
  twitter: '@fillaform',
  ogImage: '/og-default.png',
} as const

/**
 * The plans, and the only place the site states a number.
 *
 * There is a free grant, and it is not a tier. A new account gets a one-time 50 auto-fills and 20
 * long answers — which do not refill; after that, access is a 14-day trial of Pro through Dodo's
 * checkout, converting at $5 a month.
 *
 * The split between those two numbers is the strategy: the short-field half is the commodity and is
 * deliberately small, while the long answers are the part worth paying for and are deliberately
 * generous enough to form a habit. See `PLAN_LIMITS` and `PLAN_LONGFORM_LIMITS`.
 *
 * The grant exists because the nearest competitor gives mechanical autofill away and charges
 * $39.99/mo for the AI-written answers that are this product's whole point. Matching them on the
 * commodity costs us about a cent a head; the wedge is still price on the part that matters.
 *
 * NOTE: `pricing` below is still two cards and says nothing about the grant. Deliberate — the cards
 * and their copy are a design change, not a constants change, and are not done here.
 *
 * The unit is one **form field**: a field an AI answered, a rewrite, or a source added or
 * reprocessed. Fields answered from the user's own saved information cost nothing and are not
 * counted — about a third of the fields on a real application. The site says "form fields" rather
 * than "AI actions" because an action is a billing unit nobody can price in work: 600 fields is a
 * number you can convert into applications, 600 actions is not. These numbers must match `PLAN_LIMITS` and friends in `@aff/shared`; the site
 * cannot import from the workspace, so they are restated here and nowhere else on the site.
 */
export const pricing = [
  {
    plan: 'pro',
    name: 'Pro',
    price: 5,
    cadence: 'per month',
    actions: 600,
    trialDays: 14,
    description: 'For an active job search, or a busy month of forms.',
    features: [
      '600 form fields a month',
      '150 long written answers and rewrites',
      'Fields it already knows never count',
      '30 sources, 100 saved facts, 30 MB files',
      'Cancel any time',
    ],
    cta: 'Start 14-day free trial',
    highlighted: true,
  },
  {
    plan: 'ultra',
    name: 'Ultra',
    price: 15,
    cadence: 'per month',
    actions: 2500,
    trialDays: 0,
    description: 'For recruiters, agencies, and anyone filling forms daily.',
    features: [
      '2,500 form fields a month',
      '500 long written answers and rewrites',
      'More essays get the frontier model to themselves',
      '100 sources, 400 saved facts, 50 MB files',
      'Learns your voice roughly three times faster',
      'Cancel any time',
    ],
    cta: 'Choose Ultra',
    highlighted: false,
  },
] as const

export const navLinks = [
  { href: '/how-it-works', label: 'How it works' },
  { href: '/features', label: 'Features' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/compare', label: 'Compare' },
] as const
