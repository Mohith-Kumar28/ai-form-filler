/**
 * Single source of truth for marketing-site facts: name, domain, links, pricing.
 * Every page reads from here so a domain or price change is a one-line edit.
 */

export const site = {
  name: 'Fillaform',
  legalName: 'Fillaform',
  domain: 'https://fillaform.in',
  tagline: 'Fill any form, in your own voice.',
  description:
    'Fillaform is a Chrome extension that fills any web form — job applications, Google Forms, event registrations, surveys — from your own knowledge base, in your own writing voice. It tells you which answers it read and which it guessed.',
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
    description: 'Try it on real forms. No card, no time limit.',
    features: [
      '5 forms per month',
      'Every site adapter (Google Forms, Greenhouse, Lever, Ashby)',
      'Résumé, link & text sources',
      'Read vs. guessed stamps',
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
    description: 'For a steady job search or a busy season of forms.',
    features: [
      '50 forms per month',
      'Everything in Free',
      'Long-form answers in your voice',
      'Priority processing',
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
    description: 'For heavy users filling forms all day, every day.',
    features: [
      '300 forms per month',
      'Everything in Pro',
      'Earliest access to new adapters',
      'Long-form answers in your voice',
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
  { href: '/blog', label: 'Blog' },
] as const
