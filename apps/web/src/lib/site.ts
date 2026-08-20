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
    'Fillaform is a Chrome extension that fills any web form for you — job applications, Google Forms, registrations, surveys. Add your CV and a few notes once, then every form gets answered in your own words. It labels the answers it guessed, so you know what to check.',
  /** Pinned extension ID. The Web Store URL goes live once the listing is published. */
  chromeExtensionId: 'bkjmijloddfiilopdckanmnpmiimpcho',
  chromeWebStoreUrl: 'https://chromewebstore.google.com/detail/bkjmijloddfiilopdckanmnpmiimpcho',
  supportEmail: 'support@fillaform.in',
  twitter: '@fillaform',
  ogImage: '/og-default.png',
} as const

export const pricing = [
  {
    plan: 'free',
    name: 'Free',
    price: 0,
    cadence: 'forever',
    forms: 5,
    description: 'Enough to try it on real forms. No card needed.',
    features: [
      '5 forms per month',
      'Works on Greenhouse, Lever, Ashby, Google Forms and the rest',
      'CV, links and notes as sources',
      'Guessed answers labelled for review',
    ],
    cta: 'Add to Chrome',
    highlighted: false,
  },
  {
    plan: 'pro',
    name: 'Pro',
    price: 12,
    cadence: 'per month',
    forms: 50,
    description: 'For an active job search, or a busy month of forms.',
    features: [
      '50 forms per month',
      'Everything in Free',
      'Long written answers in your own words',
      'Faster processing',
      'Cancel anytime',
    ],
    cta: 'Upgrade to Pro',
    highlighted: true,
  },
  {
    plan: 'ultra',
    name: 'Ultra',
    price: 30,
    cadence: 'per month',
    forms: 300,
    description: 'For recruiters, agencies, and anyone filling forms daily.',
    features: [
      '300 forms per month',
      'Everything in Pro',
      'Long written answers in your own words',
      'First access to new site support',
    ],
    cta: 'Upgrade to Ultra',
    highlighted: false,
  },
] as const

export const navLinks = [
  { href: '/how-it-works', label: 'How it works' },
  { href: '/features', label: 'Features' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/compare', label: 'Compare' },
] as const
