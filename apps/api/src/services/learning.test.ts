import type { FieldSchema, Identity } from '@aff/shared'
import { describe, expect, it } from 'vitest'
import { classifyField, identitySlotFor } from '../router/classify.js'
import { resolveTier0 } from '../router/tier0.js'

/**
 * The loop that was broken: a phone number typed on one form was still missing on the next.
 *
 * Learning wrote every correction to memory, but phone, email, and name are answered by
 * **tier 0** — a direct lookup in the structured profile with no model call and no retrieval.
 * Tier 0 never searches memory, so a value learned there was unreachable by the one path
 * that answers those fields. These tests pin the routing rather than the storage call.
 */

function field(label: string, kind: FieldSchema['kind'] = 'text'): FieldSchema {
  return { id: 'f1', label, kind, required: false }
}

describe('a learned identity value reaches the path that answers it', () => {
  it('recognises the fields that tier 0 owns', () => {
    // If these stop mapping to a slot, the value goes to memory instead and the field stays
    // blank forever — silently, because memory ingestion always reports success.
    expect(identitySlotFor(field('Phone number'))).toBe('phone')
    expect(identitySlotFor(field('Mobile'))).toBe('phone')
    expect(identitySlotFor(field('Email address'))).toBe('email')
  })

  it('answers the next form from the profile, with no model call', () => {
    const identity: Identity = { links: {}, phone: '+1 555 0100' }
    const classifications = [classifyField(field('Phone number', 'tel'))]
    const labels = new Map([['f1', 'Phone number']])

    const { fills, unresolved } = resolveTier0(identity, classifications, labels)

    expect(fills[0]?.value).toBe('+1 555 0100')
    expect(fills[0]?.tier).toBe(0)
    // Nothing left for a paid tier: this is the whole point of storing it here.
    expect(unresolved).toHaveLength(0)
  })

  it('leaves the field unresolved when the profile has no phone', () => {
    const identity: Identity = { links: {} }
    const classifications = [classifyField(field('Phone number', 'tel'))]

    const { fills, skipped } = resolveTier0(identity, classifications, new Map())

    expect(fills).toHaveLength(0)
    expect(skipped).toHaveLength(1)
  })
})
