/**
 * Single source of truth for marketing-site facts: name, domain, links, pricing.
 * Every page reads from here so a domain or price change is a one-line edit.
 */

export const site = {
  name: 'Fillaform',
  legalName: 'Fillaform',
  domain: 'https://fillaform.in',
  tagline: 'Fill any form in one click',
  description:
    'Fillaform is a Chrome extension that fills any web form for you: job applications, Google Forms, registrations, surveys. Add your CV and a few notes once, then every form gets answered in your own words. It labels the answers it guessed, so you know what to check.',
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
 * There is no free tier. Access starts with a 14-day trial of Pro, taken through Dodo's checkout,
 * which then converts at $5 a month. That is a deliberate trade: the nearest competitor gives
 * mechanical autofill away and charges $39.99/mo for the AI-written answers that are this product's
 * whole point, so the wedge here is price rather than a free allowance.
 *
 * The unit is an **AI action**: one field an AI answered, or one rewrite. Fields answered from the
 * user's own saved information cost nothing and are not counted — about a third of the fields on a
 * real application. These numbers must match `PLAN_LIMITS` and friends in `@aff/shared`; the site
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
      '600 AI actions a month',
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
      '2,500 AI actions a month',
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
