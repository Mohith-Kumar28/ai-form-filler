import type { ApplyReport, FillPlan } from '@aff/shared'
import type { Account, Profile } from '../src/generated/model/index.js'

/**
 * Fixture content for the review gallery.
 *
 * Authored at production fidelity on purpose: a screen reviewed against `Lorem ipsum` and
 * `50%` hides every failure that matters — the wrap of a real job-application question, a
 * source label that is longer than its row, a confidence that is not a round number. None of
 * this is real data about anyone; it is synthetic, and it never leaves this harness.
 */

/**
 * Mid-trial, which is the state most of the panel is designed around.
 *
 * The old fixture was `plan: 'free', limit: 50`, matching no plan that has ever existed — free was
 * 5 at the time — so every screenshot of the meter showed an allowance the server would never
 * report. Numbers here are the real `PLAN_LIMITS.pro`.
 */
export const ACCOUNT: Account = {
  id: 'usr_fixture',
  email: 'ifeoma.balogun@fastmail.com',
  name: 'Ifeoma Balogun',
  quota: {
    plan: 'pro',
    used: 138,
    limit: 600,
    longUsed: 21,
    longLimit: 150,
    resetsAt: '2026-09-01T00:00:00.000Z',
  },
  profileReady: true,
  profileVersion: 7,
  subscription: {
    plan: 'pro',
    status: 'trial',
    // Four days out from the fixture "today" of 2026-08-21.
    trialEndsAt: Math.floor(Date.UTC(2026, 7, 25) / 1000),
  },
}

/** Past 80% of the month's actions — the warning branch of the meter. */
export const ACCOUNT_LOW_QUOTA: Account = {
  ...ACCOUNT,
  quota: { ...ACCOUNT.quota, used: 552, longUsed: 96 },
}

/**
 * Signed in, onboarded, never subscribed. The state the panel must say nothing about money in.
 *
 * A limit of zero is what makes filling the paywall: `enforceQuota` refuses the very first request,
 * and Home turns that into the trial sheet rather than an error.
 */
export const ACCOUNT_ONBOARDING: Account = {
  ...ACCOUNT,
  quota: { ...ACCOUNT.quota, plan: 'free', used: 0, limit: 0, longUsed: 0, longLimit: 0 },
  subscription: null,
}

/** Out of long answers with plenty of actions left — the meter's quiet secondary line. */
export const ACCOUNT_NO_LONGFORM: Account = {
  ...ACCOUNT,
  quota: { ...ACCOUNT.quota, used: 240, longUsed: 150 },
}

/** A card that failed. Previously unrepresentable: the server never reported this status. */
export const ACCOUNT_ON_HOLD: Account = {
  ...ACCOUNT,
  subscription: { plan: 'pro', status: 'on_hold' },
}

export const PROFILE: Profile = {
  version: 7,
  identity: {
    fullName: 'Ifeoma Balogun',
    preferredName: 'Ife',
    email: 'ifeoma.balogun@fastmail.com',
    phone: '+44 7911 248 630',
    location: 'Bristol, United Kingdom',
    pronouns: 'she/her',
    workAuthorization: 'British citizen, no sponsorship needed',
    links: {
      linkedin: 'https://www.linkedin.com/in/ifeomabalogun',
      github: 'https://github.com/ifeomab',
      website: 'https://ifeomabalogun.com',
    },
  },
  custom: {
    'Notice period': '6 weeks from signing',
    'Earliest start': '3 November 2026',
  },
  sources: [
    {
      id: 'src_1',
      kind: 'document',
      label: 'Résumé 2026',
      status: 'ready',
      mediaType: 'application/pdf',
      sizeBytes: 291_112,
      extractedChars: 18_431,
      hasFile: true,
      createdAt: '2026-07-02T09:14:00.000Z',
    },
    {
      id: 'src_2',
      kind: 'link',
      label: 'My portfolio',
      status: 'ready',
      url: 'https://ifeomabalogun.com/work',
      extractedChars: 9_264,
      hasFile: false,
      createdAt: '2026-07-02T09:22:00.000Z',
    },
    {
      id: 'src_3',
      kind: 'text',
      label: 'Why I left Kestrel Health',
      status: 'ready',
      extractedChars: 2_190,
      hasFile: false,
      createdAt: '2026-07-14T21:48:00.000Z',
    },
    {
      id: 'src_4',
      kind: 'audio',
      label: 'How I describe my work out loud',
      status: 'parsing',
      mediaType: 'audio/webm',
      sizeBytes: 1_842_004,
      hasFile: true,
      createdAt: '2026-08-11T23:03:00.000Z',
    },
    {
      id: 'src_5',
      kind: 'document',
      label: 'Bristol MSc transcript.docx',
      status: 'failed',
      error: 'The file is password protected, so nothing could be read from it.',
      mediaType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      sizeBytes: 47_802,
      hasFile: true,
      createdAt: '2026-08-12T08:31:00.000Z',
    },
  ],
}

/**
 * The state a real profile drifts into, which is what this rebuild exists to fix.
 *
 * Every defect here is one that actually happens: the ingest structuring pass takes `platform`
 * as a bare string from a model, so `LinkedIn` lands beside the extractor's `linkedin`; the old
 * editor cleared a link by writing `''` and the merge only ever added keys, so the empty one
 * survived every save; nothing normalised a `custom` key, so `notice period` and
 * `Notice Period ` were two facts that both reached the model; and `addFact` only checked
 * against `custom`, so a fact called `Email` sat below the identity field of the same name.
 *
 * Reviewed against this, the Facts screen has to show **one** row per fact.
 */
export const MESSY_PROFILE: Profile = {
  version: 12,
  identity: {
    fullName: 'Ifeoma Balogun',
    email: 'ifeoma.balogun@fastmail.com',
    phone: '+44 7911 248 630',
    location: 'Bristol, United Kingdom',
    links: {
      linkedin: '',
      LinkedIn: 'https://www.linkedin.com/in/ifeomabalogun',
      github: 'https://github.com/ifeomab',
      GitHub: '',
      mastodon: 'https://mas.to/@ife',
    },
  },
  custom: {
    Email: 'ife@oldmail.example',
    'notice period': '6 weeks',
    'Notice Period ': '',
    'Current CTC': '£68,000',
    'PAN number': 'ABCDE1234F',
    'Aadhaar number': '2345 6789 0123',
    'Current company': 'Kestrel Health',
    'T-shirt size': 'M',
    'Dietary needs': 'No shellfish',
  },
  sources: PROFILE.sources,
}

export const EMPTY_PROFILE: Profile = {
  version: 0,
  identity: { links: {} },
  custom: {},
  sources: [],
}

export const PLAN: FillPlan = {
  fills: [
    {
      fieldId: 'f_why',
      label: 'Why do you want to work at Alderman & Roe?',
      value:
        'I spent four years at Kestrel Health rebuilding a claims pipeline that nobody wanted to touch, and the part I liked was the archaeology of working out why a system had ended up the way it had before changing it. Your engineering posts read like people who do that on purpose rather than under duress.',
      confidence: 0.58,
      tier: 3,
      inferred: true,
      options: [],
      kind: 'longtext',
      reasoning: 'No stated reason for this employer; written from tone and prior roles.',
    },
    {
      fieldId: 'f_salary',
      label: 'What are your salary expectations?',
      value: '£72,000',
      confidence: 0.41,
      tier: 2,
      inferred: true,
      options: [],
      kind: 'text',
    },
    {
      fieldId: 'f_hear',
      label: 'How did you hear about this role?',
      value: 'LinkedIn',
      confidence: 0.63,
      tier: 1,
      inferred: false,
      options: ['LinkedIn', 'A friend', 'Our careers page', 'A recruiter', 'Other'],
      kind: 'select',
    },
    {
      fieldId: 'f_notice',
      label: 'When could you start?',
      value: '3 November 2026',
      confidence: 0.94,
      tier: 0,
      inferred: false,
      options: [],
      kind: 'date',
    },
    {
      fieldId: 'f_name',
      label: 'Full name',
      value: 'Ifeoma Balogun',
      confidence: 0.99,
      tier: 0,
      inferred: false,
      options: [],
      kind: 'text',
    },
    {
      fieldId: 'f_email',
      label: 'Email address',
      value: 'ifeoma.balogun@fastmail.com',
      confidence: 0.99,
      tier: 0,
      inferred: false,
      options: [],
      kind: 'email',
    },
    {
      fieldId: 'f_auth',
      label: 'Do you require visa sponsorship?',
      value: 'No',
      confidence: 0.91,
      tier: 0,
      inferred: false,
      options: ['Yes', 'No'],
      kind: 'radio',
    },
  ],
  skipped: [
    {
      fieldId: 'f_ref',
      reason: 'no_matching_knowledge',
      detail: 'Nothing on file names a referee',
    },
    { fieldId: 'f_port', reason: 'already_filled' },
  ],
  usage: {
    inputTokens: 14_209,
    outputTokens: 682,
    cacheReadTokens: 11_840,
    cacheWriteTokens: 0,
    costMicroUsd: 4_180,
    latencyMs: 12_640,
    modelsUsed: ['claude-haiku-4-5-20251001', 'claude-sonnet-5'],
  },
  quotaRemaining: 37,
}

export const REPORT: ApplyReport = {
  applied: ['f_why', 'f_salary', 'f_hear', 'f_notice', 'f_name', 'f_email'],
  failed: ['f_auth'],
}
